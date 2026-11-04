import sharp from 'sharp';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const INPUT_IMAGE = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de/.user_uploaded/media_1793811854780_0d28372f.jpg';
const INBOX_TARGET = path.join(ROOT_DIR, 'assets', 'photos-inbox', 'Logouri', 'LOGO LICEUL TEHNOLOGIC BALTA.png');
const OPTIMIZED_DIR = path.join(ROOT_DIR, 'assets', 'photos', 'logos');
const ARTIFACT_PREVIEW = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de/v7-school-logo-preview.png';

async function main() {
  console.log('Loading new school logo from:', INPUT_IMAGE);
  const { data, info } = await sharp(INPUT_IMAGE).raw().toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  console.log(`Original dimensions: ${w}x${h}`);

  // Create alpha mask using flood-fill from border
  // Outside pixels will have alpha = 0; inside shield will have alpha = 255.
  // In addition, any soft anti-aliased edge gets smooth alpha.
  const visited = new Uint8Array(w * h);
  const queue = [];

  function isBackground(x, y) {
    if (x < 0 || x >= w || y < 0 || y >= h) return false;
    // Everything above y=107 is definitely outside/noise
    if (y < 108) return true;
    const idx = (y * w + x) * 3;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    // Background is near white (r > 218 && g > 218 && b > 218)
    return r > 218 && g > 218 && b > 218;
  }

  // Seed boundary
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < 108; y++) {
      const idx = y * w + x;
      if (!visited[idx]) {
        visited[idx] = 1;
        queue.push(x, y);
      }
    }
    const bottomIdx = (h - 1) * w + x;
    if (!visited[bottomIdx] && isBackground(x, h - 1)) {
      visited[bottomIdx] = 1;
      queue.push(x, h - 1);
    }
  }

  for (let y = 108; y < h; y++) {
    const leftIdx = y * w + 0;
    if (!visited[leftIdx] && isBackground(0, y)) {
      visited[leftIdx] = 1;
      queue.push(0, y);
    }
    const rightIdx = y * w + (w - 1);
    if (!visited[rightIdx] && isBackground(w - 1, y)) {
      visited[rightIdx] = 1;
      queue.push(w - 1, y);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const cx = queue[head++];
    const cy = queue[head++];

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1]
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nidx = ny * w + nx;
        if (!visited[nidx] && isBackground(nx, ny)) {
          visited[nidx] = 1;
          queue.push(nx, ny);
        }
      }
    }
  }

  console.log(`Flooded outside pixels: ${queue.length / 2} / ${w * h}`);

  // Create RGBA buffer
  const rgba = Buffer.alloc(w * h * 4);
  let minX = w, maxX = 0, minY = h, maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const srcIdx = (y * w + x) * 3;
      const dstIdx = (y * w + x) * 4;
      const r = data[srcIdx];
      const g = data[srcIdx + 1];
      const b = data[srcIdx + 2];

      const isOutside = visited[y * w + x] === 1;

      rgba[dstIdx] = r;
      rgba[dstIdx + 1] = g;
      rgba[dstIdx + 2] = b;

      if (isOutside) {
        rgba[dstIdx + 3] = 0;
      } else {
        // Smooth feathering at border if near-white
        rgba[dstIdx + 3] = 255;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log(`Shield bounding box: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}] (width=${maxX - minX + 1}, height=${maxY - minY + 1})`);

  // Pad slightly by 4px on each side if within bounds
  const pad = 4;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, maxX - cropX + 1 + pad * 2);
  const cropH = Math.min(h - cropY, maxY - cropY + 1 + pad * 2);

  // Extract trimmed shield with transparency
  const trimmedShield = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extract({ left: cropX, top: cropY, width: cropW, height: cropH })
    .png()
    .toBuffer();

  // Save full master PNG to assets/photos-inbox/Logouri/
  await fs.writeFile(INBOX_TARGET, trimmedShield);
  console.log('[OK] Saved master inbox PNG:', INBOX_TARGET);

  // Also replace old JPG in inbox if needed or keep both
  await sharp(trimmedShield)
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .jpeg({ quality: 95 })
    .toFile(path.join(ROOT_DIR, 'assets', 'photos-inbox', 'Logouri', 'LOGO LICEUL TEHNOLOGIC BALTA.jpg'));
  console.log('[OK] Updated inbox JPG');

  // Output optimized versions (webp & png) to assets/photos/logos/
  await fs.mkdir(OPTIMIZED_DIR, { recursive: true });

  const webpPath = path.join(OPTIMIZED_DIR, 'liceul-tehnologic-balta.webp');
  const pngPath = path.join(OPTIMIZED_DIR, 'liceul-tehnologic-balta.png');

  // Generate crisp 256px height version
  await sharp(trimmedShield)
    .resize({ height: 256, withoutEnlargement: true })
    .webp({ quality: 95, effort: 6, alphaQuality: 100 })
    .toFile(webpPath);
  console.log('[OK] Optimized webp saved:', webpPath);

  await sharp(trimmedShield)
    .resize({ height: 256, withoutEnlargement: true })
    .png({ quality: 95, compressionLevel: 9 })
    .toFile(pngPath);
  console.log('[OK] Optimized png saved:', pngPath);

  // Create preview against dark background (like our navbar/modal #0b1120) to inspect quality
  await sharp({
    create: {
      width: 400,
      height: 400,
      channels: 4,
      background: { r: 15, g: 23, b: 42, alpha: 1 } // slate-900
    }
  })
    .composite([
      {
        input: await sharp(trimmedShield).resize({ height: 320, fit: 'inside' }).toBuffer(),
        gravity: 'centre'
      }
    ])
    .png()
    .toFile(ARTIFACT_PREVIEW);

  console.log('[OK] Preview on dark background generated:', ARTIFACT_PREVIEW);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
