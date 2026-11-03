/**
 * Fetches official OpenStreetMap geographic labels (mountain peaks, villages,
 * valleys/gorges, and river courses) for Comuna Runcu & Munții Vâlcan (Jud. Gorj).
 * Saves locally to data/runcu-relief-labels.geojson and data/runcu-rivers.geojson.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BBOX = '45.07,22.99,45.31,23.27';

// The 7 official component villages of Comuna Runcu, Jud. Gorj
const RUNCU_VILLAGES = new Set([
  'Runcu',
  'Dobrița',
  'Suseni',
  'Bâlta',
  'Bâltișoara',
  'Răchiți',
  'Valea Mare'
]);

async function main() {
  const query = `
    [out:json][timeout:30];
    (
      node["natural"="peak"]["name"](${BBOX});
      node["natural"~"saddle|ridge|cliff|gorge|valley"]["name"](${BBOX});
      node["place"~"village|town|suburb"](${BBOX});
      way["waterway"~"river|stream"]["name"](${BBOX});
    );
    out body geom;
  `;

  console.log('Querying Overpass API for OSM features in Runcu & Vâlcan...');
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  let res = null;
  for (const ep of endpoints) {
    try {
      const r = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LiderEuropean2026-RuncuGorj/1.0',
          Accept: 'application/json'
        },
        body: 'data=' + encodeURIComponent(query)
      });
      if (r.ok) {
        res = r;
        console.log('Connected to:', ep);
        break;
      }
    } catch {
      // try next mirror
    }
  }

  if (!res || !res.ok) {
    throw new Error('All Overpass mirrors failed');
  }

  const data = await res.json();
  const labelFeatures = [];
  const riverFeatures = [];
  const seenNames = new Set();

  for (const el of data.elements || []) {
    const tags = el.tags || {};
    const name = tags['name:ro'] || tags.name;
    if (!name) continue;

    if (el.type === 'node') {
      if (tags.natural === 'peak') {
        const ele = tags.ele ? parseInt(tags.ele, 10) : null;
        const key = `peak:${name}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        labelFeatures.push({
          type: 'Feature',
          properties: {
            kind: 'peak',
            name,
            ele: Number.isFinite(ele) ? ele : null,
            display: Number.isFinite(ele) ? `▲ ${name}\n${ele} m` : `▲ ${name}`,
            priority: Number.isFinite(ele) && ele >= 1300 ? 1 : 2
          },
          geometry: {
            type: 'Point',
            coordinates: [el.lon, el.lat]
          }
        });
      } else if (tags.place) {
        const isRuncuVillage = RUNCU_VILLAGES.has(name);
        const key = `place:${name}:${Math.round(el.lat * 20)}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        labelFeatures.push({
          type: 'Feature',
          properties: {
            kind: isRuncuVillage ? 'runcu_village' : 'neighbor_place',
            name,
            display: name,
            priority: isRuncuVillage ? 1 : 3
          },
          geometry: {
            type: 'Point',
            coordinates: [el.lon, el.lat]
          }
        });
      } else if (tags.natural) {
        const key = `nat:${name}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        labelFeatures.push({
          type: 'Feature',
          properties: {
            kind: 'landform',
            name,
            display: name,
            priority: 2
          },
          geometry: {
            type: 'Point',
            coordinates: [el.lon, el.lat]
          }
        });
      }
    } else if (el.type === 'way' && tags.waterway && el.geometry?.length >= 2) {
      const coords = el.geometry.map((pt) => [
        Number(pt.lon.toFixed(5)),
        Number(pt.lat.toFixed(5))
      ]);
      riverFeatures.push({
        type: 'Feature',
        properties: {
          name,
          waterway: tags.waterway
        },
        geometry: {
          type: 'LineString',
          coordinates: coords
        }
      });
    }
  }

  const labelsPath = path.join(
    process.cwd(),
    'data',
    'runcu-relief-labels.geojson'
  );
  const riversPath = path.join(process.cwd(), 'data', 'runcu-rivers.geojson');

  await fs.writeFile(
    labelsPath,
    JSON.stringify({ type: 'FeatureCollection', features: labelFeatures })
  );
  await fs.writeFile(
    riversPath,
    JSON.stringify({ type: 'FeatureCollection', features: riverFeatures })
  );

  console.log(
    `[OK] Saved ${labelFeatures.length} geographic labels (peaks, villages, landforms) and ${riverFeatures.length} river segments.`
  );
  console.log(
    'Sample peaks:',
    labelFeatures
      .filter((f) => f.properties.kind === 'peak')
      .slice(0, 12)
      .map((f) => f.properties.display.replace('\n', ' '))
  );
  console.log(
    'Runcu villages found:',
    labelFeatures
      .filter((f) => f.properties.kind === 'runcu_village')
      .map((f) => f.properties.name)
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
