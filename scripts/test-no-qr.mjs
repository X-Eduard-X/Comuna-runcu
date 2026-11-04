import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de';
const DIST_DIR = path.join(process.cwd(), 'dist');

function startServer(port = 4185) {
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
  const server = await startServer(4185);
  console.log('Server running on http://localhost:4185');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  try {
    await page.goto('http://localhost:4185');
    await page.waitForTimeout(1500);

    // 1. Intro topbar without QR button
    const topbar = page.locator('.intro-topbar');
    await topbar.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v9-01-intro-topbar-no-qr.png')
    });
    console.log('[OK] Captured v9-01-intro-topbar-no-qr.png');

    // 2. Open map mode selector and enter map
    await page.click('#btn-enter-map');
    await page.waitForTimeout(500);
    await page.click('#btn-confirm-map-mode');
    await page.waitForTimeout(2000);

    // 3. HUD top bar without QR button
    const hudHeader = page.locator('.hud-header');
    await hudHeader.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v9-02-hud-header-no-qr.png')
    });
    console.log('[OK] Captured v9-02-hud-header-no-qr.png');

    // 4. Open thanks modal and check footer
    await page.click('[data-open-modal="thanks"]', { noWaitAfter: true });
    await page.waitForTimeout(600);

    const thanksCard = page.locator('#thanks-modal .modal-card');
    await thanksCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v9-03-thanks-modal-no-qr.png')
    });
    console.log('[OK] Captured v9-03-thanks-modal-no-qr.png');

    console.log('Errors caught during test:', errors);

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(console.error);
