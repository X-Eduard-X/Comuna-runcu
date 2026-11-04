import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de';
const DIST_DIR = path.join(process.cwd(), 'dist');

// Simple static server for dist/
function startServer(port = 4173) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.svg': 'image/svg+xml'
  };

  const server = http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/') reqPath = '/index.html';
    let filePath = path.join(DIST_DIR, reqPath);
    if (!fs.existsSync(filePath)) {
      // fallback to project root for assets if not in dist
      filePath = path.join(process.cwd(), reqPath);
    }
    if (!fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function run() {
  const server = await startServer(4178);
  console.log('Server running on http://localhost:4178');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto('http://localhost:4178');
    await page.waitForTimeout(1000);

    // 1. Intro topbar
    const topbar = page.locator('.intro-topbar');
    await topbar.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7-01-intro-topbar-new-logo.png')
    });
    console.log('[OK] Captured v7-01-intro-topbar-new-logo.png');

    // 2. Open map by clicking "Începe călătoria" and choosing mode
    await page.click('#btn-enter-map');
    await page.waitForTimeout(500);

    // Click confirm mode to enter map
    await page.click('#btn-confirm-map-mode');
    await page.waitForTimeout(2000);

    // 3. HUD brand pill
    const hudBrand = page.locator('.hud-brand');
    await hudBrand.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7-02-hud-brand-new-logo.png')
    });
    console.log('[OK] Captured v7-02-hud-brand-new-logo.png');

    // 4. Click info button to open "Vă mulțumim!" modal
    await page.click('[data-open-modal="thanks"]', { noWaitAfter: true });
    await page.waitForTimeout(600);

    const thanksCard = page.locator('#thanks-modal .modal-card');
    await thanksCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7-03-thanks-modal-new-logo.png')
    });
    console.log('[OK] Captured v7-03-thanks-modal-new-logo.png');

    // Also mobile view of intro
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:4178', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const mobileTopbar = page.locator('.intro-topbar');
    await mobileTopbar.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v7-04-intro-topbar-mobile.png')
    });
    console.log('[OK] Captured v7-04-intro-topbar-mobile.png');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(console.error);
