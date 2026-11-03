import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.cwd();
const WAYPOINTS_PATH = path.join(ROOT_DIR, 'data', 'waypoints.json');
const OUTPUT_CSV_PATH = path.join(ROOT_DIR, 'data', 'runcu-google-my-maps.csv');

function escapeCsvCell(value) {
  const str = String(value ?? '').replace(/\r?\n/g, ' ');
  if (str.includes(',') || str.includes('"') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function isWaypointAllowedByConsent(wp) {
  if (wp.consent !== true) return false;
  if ((wp.category === 'C' || wp.category === 'D') && wp.consent !== true) {
    return false;
  }
  if (Array.isArray(wp.photos) && wp.photos.length > 0) {
    const validPhotos = wp.photos.filter(
      (p) => !(p.hasPeople && p.consent !== true) && p.consent !== false
    );
    if (validPhotos.length === 0 && wp.photos.some((p) => p.hasPeople)) {
      return false;
    }
  }
  return true;
}

async function exportCsv() {
  const raw = await fs.readFile(WAYPOINTS_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const waypoints = Array.isArray(parsed) ? parsed : parsed.waypoints || [];
  const categories = parsed.categories || {};

  const headers = [
    'Titlu',
    'Descriere',
    'Latitudine',
    'Longitudine',
    'Categorie',
    'Cod Categorie',
    'Sursa',
    'ID'
  ];

  const rows = [headers.join(',')];
  let exportedCount = 0;

  for (const wp of waypoints) {
    if (!isWaypointAllowedByConsent(wp)) {
      continue;
    }
    const [lng, lat] = wp.coordinates || [0, 0];
    const catName =
      categories[wp.category]?.label || `Categoria ${wp.category}`;

    const row = [
      escapeCsvCell(wp.title),
      escapeCsvCell(wp.description),
      escapeCsvCell(lat),
      escapeCsvCell(lng),
      escapeCsvCell(`${wp.category}. ${catName}`),
      escapeCsvCell(wp.category),
      escapeCsvCell(wp.source || ''),
      escapeCsvCell(wp.id)
    ];

    rows.push(row.join(','));
    exportedCount++;
  }

  // Write with UTF-8 BOM so Excel and Google My Maps recognize Romanian diacritics (ă â î ș ț)
  const csvContent = '\uFEFF' + rows.join('\r\n') + '\r\n';
  await fs.writeFile(OUTPUT_CSV_PATH, csvContent, 'utf8');

  console.log(
    `[OK] Exported ${exportedCount} waypoints to data/runcu-google-my-maps.csv (Google My Maps compatible).`
  );
}

exportCsv().catch((err) => {
  console.error('Failed to export CSV:', err);
  process.exit(1);
});
