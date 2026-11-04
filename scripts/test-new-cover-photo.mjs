import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de';
const DIST_DIR = path.join(process.cwd(), 'dist');

function startServer(port = 4182) {
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
  const server = await startServer(4182);
  console.log('Server running on http://localhost:4182');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto('http://localhost:4182');
    // Wait for intro animations to complete (GSAP intro timeline)
    await page.waitForTimeout(2000);

    // 1. Screenshot the entire intro screen
    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v8-01-intro-screen-full.png')
    });
    console.log('[OK] Captured v8-01-intro-screen-full.png');

    // 2. Screenshot the intro card specifically
    const visualCard = page.locator('.intro-visual-card');
    await visualCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v8-02-intro-card-primaria.png')
    });
    console.log('[OK] Captured v8-02-intro-card-primaria.png');

    // 3. Mobile screen
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('http://localhost:4182');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v8-03-intro-mobile-full.png')
    });
    console.log('[OK] Captured v8-03-intro-mobile-full.png');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(console.error);
