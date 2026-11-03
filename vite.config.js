import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { defineConfig } from 'vite';

const MIME_TYPES = {
  '.json': 'application/json; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

async function copyDirRecursive(srcDir, destDir, excludeDirs = []) {
  if (!fs.existsSync(srcDir)) return;
  await fsp.mkdir(destDir, { recursive: true });
  const entries = await fsp.readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    if (excludeDirs.includes(entry.name)) continue;
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, excludeDirs);
    } else {
      await fsp.copyFile(srcPath, destPath);
    }
  }
}

function serveAndBundleDataAssets() {
  const rootDir = process.cwd();

  const middleware = (req, res, next) => {
    if (!req.url) return next();
    const cleanUrl = decodeURIComponent(req.url.split('?')[0]);
    if (cleanUrl.startsWith('/data/') || cleanUrl.startsWith('/assets/')) {
      const filePath = path.join(rootDir, cleanUrl);
      // Prevent directory traversal outside rootDir
      if (!filePath.startsWith(rootDir)) return next();
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader(
          'Content-Type',
          MIME_TYPES[ext] || 'application/octet-stream'
        );
        res.setHeader('Cache-Control', 'no-cache');
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    }
    next();
  };

  return {
    name: 'serve-and-bundle-data-assets',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
    async closeBundle() {
      const distDir = path.join(rootDir, 'dist');
      await copyDirRecursive(
        path.join(rootDir, 'data'),
        path.join(distDir, 'data')
      );
      await copyDirRecursive(
        path.join(rootDir, 'assets'),
        path.join(distDir, 'assets'),
        ['photos-inbox'] // Keep raw inbox originals out of dist bundle
      );
    }
  };
}

export default defineConfig({
  base: './',
  plugins: [serveAndBundleDataAssets()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    assetsDir: 'bundle',
    target: 'es2020'
  }
});
