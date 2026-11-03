/**
 * Generates real topographic contour lines (curbe de nivel) for Comuna Runcu
 * and the surrounding Vâlcan Mountains (Jud. Gorj) from free AWS Terrarium DEM tiles.
 * Outputs: data/runcu-contours.geojson (50m minor contours, 200m major index contours).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const BBOX = {
  minLng: 22.96,
  minLat: 45.05,
  maxLng: 23.30,
  maxLat: 45.32
};

const ZOOM = 11;
const TILE_SIZE = 256;

function lng2tileX(lng, z) {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, z));
}

function lat2tileY(lat, z) {
  const rad = (lat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) *
      Math.pow(2, z)
  );
}

function tileX2lng(x, z) {
  return (x / Math.pow(2, z)) * 360 - 180;
}

function tileY2lat(y, z) {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

async function fetchTerrariumTile(z, x, y) {
  const url = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch DEM tile ${url}: ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

function smoothGrid(grid, w, h, passes = 2) {
  let current = Float32Array.from(grid);
  let next = new Float32Array(w * h);

  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0;
        let weight = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.min(w - 1, Math.max(0, x + dx));
            const ny = Math.min(h - 1, Math.max(0, y + dy));
            const wgt = dx === 0 && dy === 0 ? 4 : dx === 0 || dy === 0 ? 2 : 1;
            sum += current[ny * w + nx] * wgt;
            weight += wgt;
          }
        }
        next[y * w + x] = sum / weight;
      }
    }
    current.set(next);
  }
  return current;
}

/**
 * Marching squares extraction for a single elevation threshold
 */
function extractContourLines(grid, w, h, threshold, toLngLat) {
  const segments = [];

  const interp = (v1, v2) => {
    const denom = v2 - v1;
    if (Math.abs(denom) < 1e-6) return 0.5;
    return Math.min(1, Math.max(0, (threshold - v1) / denom));
  };

  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w - 1; x++) {
      const v0 = grid[y * w + x]; // top-left
      const v1 = grid[y * w + (x + 1)]; // top-right
      const v2 = grid[(y + 1) * w + (x + 1)]; // bottom-right
      const v3 = grid[(y + 1) * w + x]; // bottom-left

      let idx = 0;
      if (v0 >= threshold) idx |= 8;
      if (v1 >= threshold) idx |= 4;
      if (v2 >= threshold) idx |= 2;
      if (v3 >= threshold) idx |= 1;

      if (idx === 0 || idx === 15) continue;

      // Edge points: top(0), right(1), bottom(2), left(3)
      const ptEdge = (edge) => {
        switch (edge) {
          case 0:
            return [x + interp(v0, v1), y];
          case 1:
            return [x + 1, y + interp(v1, v2)];
          case 2:
            return [x + interp(v3, v2), y + 1];
          case 3:
            return [x, y + interp(v0, v3)];
          default:
            return [x, y];
        }
      };

      const edgePairs = {
        1: [[3, 2]],
        2: [[2, 1]],
        3: [[3, 1]],
        4: [[0, 1]],
        5: [
          [0, 3],
          [2, 1]
        ],
        6: [[0, 2]],
        7: [[0, 3]],
        8: [[0, 3]],
        9: [[0, 2]],
        10: [
          [0, 1],
          [3, 2]
        ],
        11: [[0, 1]],
        12: [[3, 1]],
        13: [[2, 1]],
        14: [[3, 2]]
      }[idx];

      if (!edgePairs) continue;
      for (const [eA, eB] of edgePairs) {
        const [gx1, gy1] = ptEdge(eA);
        const [gx2, gy2] = ptEdge(eB);
        segments.push([toLngLat(gx1, gy1), toLngLat(gx2, gy2)]);
      }
    }
  }

  // Stitch connected segments into polylines
  const keyOf = (pt) => `${pt[0].toFixed(5)},${pt[1].toFixed(5)}`;
  const endpointMap = new Map();

  segments.forEach((seg, i) => {
    const k0 = keyOf(seg[0]);
    const k1 = keyOf(seg[1]);
    if (!endpointMap.has(k0)) endpointMap.set(k0, []);
    if (!endpointMap.has(k1)) endpointMap.set(k1, []);
    endpointMap.get(k0).push(i);
    endpointMap.get(k1).push(i);
  });

  const visited = new Uint8Array(segments.length);
  const lines = [];

  for (let i = 0; i < segments.length; i++) {
    if (visited[i]) continue;
    visited[i] = 1;
    const line = [segments[i][0], segments[i][1]];

    // Extend forward
    let extended = true;
    while (extended) {
      extended = false;
      const tailKey = keyOf(line[line.length - 1]);
      const candidates = endpointMap.get(tailKey) || [];
      for (const cIdx of candidates) {
        if (visited[cIdx]) continue;
        visited[cIdx] = 1;
        const [p0, p1] = segments[cIdx];
        if (keyOf(p0) === tailKey) {
          line.push(p1);
        } else {
          line.push(p0);
        }
        extended = true;
        break;
      }
    }

    // Extend backward
    extended = true;
    while (extended) {
      extended = false;
      const headKey = keyOf(line[0]);
      const candidates = endpointMap.get(headKey) || [];
      for (const cIdx of candidates) {
        if (visited[cIdx]) continue;
        visited[cIdx] = 1;
        const [p0, p1] = segments[cIdx];
        if (keyOf(p1) === headKey) {
          line.unshift(p0);
        } else {
          line.unshift(p1);
        }
        extended = true;
        break;
      }
    }

    // Simplify slightly by keeping every 2nd vertex + endpoints if long
    if (line.length >= 4) {
      const simplified = [line[0]];
      for (let k = 1; k < line.length - 1; k += 2) {
        simplified.push([
          Number(line[k][0].toFixed(5)),
          Number(line[k][1].toFixed(5))
        ]);
      }
      simplified.push([
        Number(line[line.length - 1][0].toFixed(5)),
        Number(line[line.length - 1][1].toFixed(5))
      ]);
      lines.push(simplified);
    }
  }

  return lines;
}

async function main() {
  const minX = lng2tileX(BBOX.minLng, ZOOM);
  const maxX = lng2tileX(BBOX.maxLng, ZOOM);
  const minY = lat2tileY(BBOX.maxLat, ZOOM);
  const maxY = lat2tileY(BBOX.minLat, ZOOM);

  const tilesX = maxX - minX + 1;
  const tilesY = maxY - minY + 1;
  const fullW = tilesX * TILE_SIZE;
  const fullH = tilesY * TILE_SIZE;
  const rawElev = new Float32Array(fullW * fullH);

  console.log(
    `Fetching ${tilesX}x${tilesY} Terrarium DEM tiles at zoom ${ZOOM}...`
  );

  for (let ty = minY; ty <= maxY; ty++) {
    for (let tx = minX; tx <= maxX; tx++) {
      const tile = await fetchTerrariumTile(ZOOM, tx, ty);
      const offsetX = (tx - minX) * TILE_SIZE;
      const offsetY = (ty - minY) * TILE_SIZE;

      for (let py = 0; py < TILE_SIZE; py++) {
        for (let px = 0; px < TILE_SIZE; px++) {
          const idx = (py * TILE_SIZE + px) * 4;
          const r = tile.data[idx];
          const g = tile.data[idx + 1];
          const b = tile.data[idx + 2];
          const elev = r * 256 + g + b / 256 - 32768;
          rawElev[(offsetY + py) * fullW + (offsetX + px)] = elev;
        }
      }
    }
  }

  // Subsample by 2x for compact GeoJSON size and smooth cartographic contours
  const step = 2;
  const gridW = Math.floor(fullW / step);
  const gridH = Math.floor(fullH / step);
  const subGrid = new Float32Array(gridW * gridH);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      subGrid[y * gridW + x] = rawElev[y * step * fullW + x * step];
    }
  }

  const smoothed = smoothGrid(subGrid, gridW, gridH, 2);

  const toLngLat = (gx, gy) => {
    const globalTileX = minX + (gx * step) / TILE_SIZE;
    const globalTileY = minY + (gy * step) / TILE_SIZE;
    const lng = tileX2lng(globalTileX, ZOOM);
    const lat = tileY2lat(globalTileY, ZOOM);
    return [lng, lat];
  };

  const features = [];
  for (let ele = 250; ele <= 1900; ele += 50) {
    const allLines = extractContourLines(
      smoothed,
      gridW,
      gridH,
      ele,
      toLngLat
    );
    // Filter lines to those intersecting our target BBOX
    const clipped = allLines.filter((line) =>
      line.some(
        ([lng, lat]) =>
          lng >= BBOX.minLng &&
          lng <= BBOX.maxLng &&
          lat >= BBOX.minLat &&
          lat <= BBOX.maxLat
      )
    );
    if (clipped.length > 0) {
      features.push({
        type: 'Feature',
        properties: {
          ele,
          label: `${ele} m`,
          major: ele % 200 === 0 ? 1 : 0
        },
        geometry: {
          type: 'MultiLineString',
          coordinates: clipped
        }
      });
    }
  }

  const outPath = path.join(process.cwd(), 'data', 'runcu-contours.geojson');
  const geojson = {
    type: 'FeatureCollection',
    features
  };
  await fs.writeFile(outPath, JSON.stringify(geojson));
  const stats = await fs.stat(outPath);
  console.log(
    `[OK] Generated ${features.length} elevation contour levels (${(
      stats.size / 1024
    ).toFixed(1)} KB) at data/runcu-contours.geojson`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
