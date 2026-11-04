import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = 'C:/Users/Edy/.gemini/antigravity/brain/49d8c9e4-356e-471a-9d42-a559564ee2de';
const DIST_DIR = path.join(process.cwd(), 'dist');

function startServer(port = 4188) {
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
  const server = await startServer(4188);
  console.log('Server running on http://localhost:4188');

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  try {
    await page.goto('http://localhost:4188');
    await page.waitForTimeout(1500);

    // 1. Intro footer screenshot
    const footer = page.locator('.intro-footer');
    await footer.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10-01-intro-footer-team-names.png')
    });
    console.log('[OK] Captured v10-01-intro-footer-team-names.png');

    // 2. Open map mode selector and enter map
    await page.click('#btn-enter-map');
    await page.waitForTimeout(500);
    await page.click('#btn-confirm-map-mode');
    await page.waitForTimeout(2000);

    // 3. Open thanks modal
    await page.click('[data-open-modal="thanks"]', { noWaitAfter: true });
    await page.waitForTimeout(600);

    const thanksCard = page.locator('#thanks-modal .modal-card');
    await thanksCard.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10-02-thanks-modal-new-names.png')
    });
    console.log('[OK] Captured v10-02-thanks-modal-new-names.png');

    // Also close up of the team block in thanks modal
    const teamBlock = page.locator('#thanks-modal .thanks-block').first();
    await teamBlock.screenshot({
      path: path.join(ARTIFACTS_DIR, 'v10-03-team-block-closeup.png')
    });
    console.log('[OK] Captured v10-03-team-block-closeup.png');

  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(console.error);
