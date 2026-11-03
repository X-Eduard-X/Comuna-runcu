import fs from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';

const ROOT_DIR = process.cwd();
const WAYPOINTS_PATH = path.join(ROOT_DIR, 'data', 'waypoints.json');
const QR_DIR = path.join(ROOT_DIR, 'assets', 'qr');

async function generateQr() {
  const cliUrl = process.argv[2]?.trim();
  const raw = await fs.readFile(WAYPOINTS_PATH, 'utf8');
  const data = JSON.parse(raw);

  const targetUrl = cliUrl || data?.project?.deployUrl?.trim() || '';

  if (!targetUrl) {
    console.log(
      '[INFO] Niciun URL final de deploy nu este setat încă.\n' +
        'Pentru a genera codul QR oficial (SVG + PNG 2048px), rulează:\n' +
        '  npm run generate:qr -- https://adresa-ta-finala.ro\n' +
        'Sau completează câmpul "project.deployUrl" în data/waypoints.json.'
    );
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch {
    console.error(`[EROARE] URL invalid: "${targetUrl}". Folosește un URL complet (ex. https://...).`);
    process.exit(1);
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.endsWith('.local')
  ) {
    console.error(
      `[EROARE] Generarea codului QR către "${host}" este blocată conform cerințelor proiectului.\n` +
        'Folosește doar URL-ul public final după deploy (ex. GitHub Pages sau Netlify).'
    );
    process.exit(1);
  }

  await fs.mkdir(QR_DIR, { recursive: true });

  const svgPath = path.join(QR_DIR, 'runcu-qr.svg');
  const pngPath = path.join(QR_DIR, 'runcu-qr.png');

  const svgString = await QRCode.toString(targetUrl, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#0A0E0D',
      light: '#FFFFFF'
    }
  });
  await fs.writeFile(svgPath, svgString, 'utf8');

  await QRCode.toFile(pngPath, targetUrl, {
    type: 'png',
    width: 2048,
    errorCorrectionLevel: 'H',
    margin: 2,
    color: {
      dark: '#0A0E0D',
      light: '#FFFFFF'
    }
  });

  if (cliUrl && data.project && data.project.deployUrl !== cliUrl) {
    data.project.deployUrl = cliUrl;
    await fs.writeFile(WAYPOINTS_PATH, JSON.stringify(data, null, 2), 'utf8');
  }

  console.log(`[OK] Cod QR generat pentru: ${targetUrl}`);
  console.log(`  - SVG vectorial: assets/qr/runcu-qr.svg`);
  console.log(`  - PNG 2048x2048: assets/qr/runcu-qr.png`);
}

generateQr().catch((err) => {
  console.error('QR generation failed:', err);
  process.exit(1);
});
