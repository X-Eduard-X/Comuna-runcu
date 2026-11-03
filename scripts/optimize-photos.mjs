import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const INBOX_DIR = path.join(ROOT_DIR, 'assets', 'photos-inbox');
const OUTPUT_BASE_DIR = path.join(ROOT_DIR, 'assets', 'photos');

/**
 * Complete mapping of all 30 photos + 2 official logos from assets/photos-inbox/
 * (root 1..10, Varful-arcanului/ 5 photos, Traditi/ 15 photos, Logouri/ 2 logos).
 *
 * Privacy & Metadata policy:
 * - EXIF/XMP/IPTC metadata (GPS, date, device) is completely stripped on all
 *   published variants (sharp strips metadata by default unless .withMetadata() is called).
 */
const PHOTO_MAPPING = [
  // Intro cover & Satul Răchiți / Intrarea în Comuna Runcu
  {
    inboxFile: '5.jpg',
    targetFolder: 'intro-cover',
    baseName: 'cover-runcu-gorj'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.38 PM(3).jpeg'),
    targetFolder: 'd-rachiti-troite-lemn',
    baseName: '01-intrare-sat-rachiti-troita'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM(3).jpeg'),
    targetFolder: 'd-rachiti-troite-lemn',
    baseName: '02-troita-lemn-vie-2023'
  },

  // Cat. A — Cheile Sohodolului (3 photos)
  {
    inboxFile: '1.jpg',
    targetFolder: 'a-chei-rau',
    baseName: '06-chei-rau-1'
  },
  {
    inboxFile: '2.jpg',
    targetFolder: 'a-chei-rau',
    baseName: '07-chei-rau-2'
  },
  {
    inboxFile: '3.jpeg',
    targetFolder: 'a-chei-rau',
    baseName: '08-chei-rau-3'
  },

  // Cat. A — Vârful Arcanu (1760 m) & Crucea Eroilor „Drumul Crucii” (6 photos total: 5 in Varful-arcanului/ + 1 in Traditi/)
  {
    inboxFile: path.join('Varful-arcanului', 'WhatsApp Image 2026-11-03 at 3.03.40 PM.jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '01-varful-arcanu-creasta-valcan'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM(4).jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '02-crucea-arcanu-drumul-crucii'
  },
  {
    inboxFile: path.join('Varful-arcanului', 'WhatsApp Image 2026-11-03 at 3.03.41 PM.jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '03-varful-arcanu-panorama-runcu'
  },
  {
    inboxFile: path.join('Varful-arcanului', 'WhatsApp Image 2026-11-03 at 3.03.41 PM(1).jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '04-varful-arcanu-depresiunea-gorj'
  },
  {
    inboxFile: path.join('Varful-arcanului', 'WhatsApp Image 2026-11-03 at 3.03.38 PM.jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '05-varful-arcanu-belvedere-apus'
  },
  {
    inboxFile: path.join('Varful-arcanului', 'WhatsApp Image 2026-11-03 at 3.03.41 PM(2).jpeg'),
    targetFolder: 'a-varful-arcanu',
    baseName: '06-varful-arcanu-pajiste-alpina'
  },

  // Cat. A — Drumul montan DJ672C pe Valea Sohodolului
  {
    inboxFile: '7.jpg',
    targetFolder: 'a-drum-priveliste',
    baseName: '02-drum-priveliste'
  },

  // Cat. A — Potecă de pădure în Munții Vâlcan
  {
    inboxFile: '8.jpg',
    targetFolder: 'a-poteca-padure',
    baseName: '01-poteca-padure'
  },

  // Cat. A — Interior de biserică ortodoxă din Runcu (policandru și frescă)
  {
    inboxFile: '6.jpg',
    targetFolder: 'a-interior-candelabru',
    baseName: '03-interior-candelabru'
  },

  // Cat. B — Portul popular gorjenesc și ansamblul de tineri din Runcu (4 photos)
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.37 PM(2).jpeg'),
    targetFolder: 'b-port-popular-ansamblu',
    baseName: '01-ansamblu-tineri-runcu'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.37 PM(3).jpeg'),
    targetFolder: 'b-port-popular-ansamblu',
    baseName: '02-tinere-ulcioare-port-gorjenesc'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.38 PM(1).jpeg'),
    targetFolder: 'b-port-popular-ansamblu',
    baseName: '03-sube-pastoresti-iarna'
  },
  {
    inboxFile: '9.jpg',
    targetFolder: 'b-portret-port-popular',
    baseName: '10-portret-port-popular'
  },

  // Cat. B — Hora satului și sărbătorile comunității (2 photos)
  {
    inboxFile: '4.jpg',
    targetFolder: 'b-dans-hora',
    baseName: '05-dans-hora'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.38 PM(2).jpeg'),
    targetFolder: 'b-dans-hora',
    baseName: '02-hora-comunitate-interior'
  },

  // Cat. B — Meșteșuguri casnice: torsul lânii și țesăturile pe prispă (1 photo)
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.38 PM.jpeg'),
    targetFolder: 'b-mesteguri-torsul-lanii',
    baseName: '01-torsul-lanii-prispa'
  },

  // Cat. B — Bucate tradiționale gorjenești (2 photos)
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.38 PM(4).jpeg'),
    targetFolder: 'b-gastronomie-locala',
    baseName: '01-platou-branza-praz'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM(5).jpeg'),
    targetFolder: 'b-gastronomie-locala',
    baseName: '02-carnati-afumaturi-casa'
  },

  // Cat. C — Maria Apostol (1954–1993): portret de copertă, monument memorial cu bujori și festival (3 photos)
  {
    inboxFile: path.join('Maria-Apostol', '01-portret-maria-apostol.jpg'),
    targetFolder: 'c-personalitate-locala',
    baseName: '01-portret-maria-apostol'
  },
  {
    inboxFile: path.join('Maria-Apostol', '02-monument-maria-apostol-bujori.jpg'),
    targetFolder: 'c-personalitate-locala',
    baseName: '02-monument-maria-apostol-bujori'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.37 PM(1).jpeg'),
    targetFolder: 'c-personalitate-locala',
    baseName: '03-festivalul-maria-apostol-runcu'
  },

  // Cat. D — Arhivă etnografică: viața satului de altădată (4 photos)
  {
    inboxFile: '10.jpg',
    targetFolder: 'd-poveste-comunitate',
    baseName: '09-constructie-lemn-sepia'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM.jpeg'),
    targetFolder: 'd-poveste-comunitate',
    baseName: '02-arhiva-gospodarie-car-boi'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM(1).jpeg'),
    targetFolder: 'd-poveste-comunitate',
    baseName: '03-arhiva-sarbatoare-cerdac'
  },
  {
    inboxFile: path.join('Traditi', 'WhatsApp Image 2026-11-03 at 3.09.39 PM(2).jpeg'),
    targetFolder: 'd-poveste-comunitate',
    baseName: '04-arhiva-car-cu-fan'
  }
];

const LOGO_MAPPING = [
  {
    inboxFile: path.join('Logouri', 'Lider EUROPEAN 2026.jpg'),
    targetFolder: 'logos',
    baseName: 'lider-european-2026'
  },
  {
    inboxFile: path.join('Logouri', 'LOGO COMUNA RUNCU.png'),
    targetFolder: 'logos',
    baseName: 'stema-comuna-runcu'
  },
  {
    inboxFile: path.join('Logouri', 'LOGO LICEUL TEHNOLOGIC BALTA.jpg'),
    targetFolder: 'logos',
    baseName: 'liceul-tehnologic-balta'
  }
];

const SIZES = [480, 960, 1600];

async function optimizeSinglePhoto({ inboxFile, targetFolder, baseName }) {
  const inputPath = path.join(INBOX_DIR, inboxFile);
  const outDir = path.join(OUTPUT_BASE_DIR, targetFolder);
  await fs.mkdir(outDir, { recursive: true });

  const rawMeta = await sharp(inputPath).metadata();
  const image = sharp(inputPath).rotate(); // Auto-orient based on EXIF, strips EXIF on output
  const metadata = await image.metadata();
  const origWidth = metadata.width || 1600;
  const origHeight = metadata.height || 1200;

  // Compute display dimensions at 1600px max width
  const scale = Math.min(1, 1600 / origWidth);
  const displayWidth = Math.round(origWidth * scale);
  const displayHeight = Math.round(origHeight * scale);

  for (const width of SIZES) {
    const targetWidth = Math.min(width, origWidth);
    const pipeline = sharp(inputPath)
      .rotate()
      .resize({ width: targetWidth, withoutEnlargement: true });

    await Promise.all([
      pipeline
        .clone()
        .webp({ quality: 82, effort: 4 })
        .toFile(path.join(outDir, `${baseName}-${width}w.webp`)),
      pipeline
        .clone()
        .avif({ quality: 68, effort: 4 })
        .toFile(path.join(outDir, `${baseName}-${width}w.avif`)),
      pipeline
        .clone()
        .jpeg({ quality: 84, mozjpeg: true })
        .toFile(path.join(outDir, `${baseName}-${width}w.jpg`))
    ]);
  }

  // Also save default main WebP and JPG for simple direct src usage
  const defaultPipeline = sharp(inputPath)
    .rotate()
    .resize({ width: displayWidth, withoutEnlargement: true });

  const mainWebpPath = path.join(outDir, `${baseName}.webp`);
  const mainJpgPath = path.join(outDir, `${baseName}.jpg`);

  await Promise.all([
    defaultPipeline.clone().webp({ quality: 84 }).toFile(mainWebpPath),
    defaultPipeline
      .clone()
      .jpeg({ quality: 85, mozjpeg: true })
      .toFile(mainJpgPath)
  ]);

  // Verify EXIF was stripped from published output
  const outMeta = await sharp(mainWebpPath).metadata();
  const outJpgMeta = await sharp(mainJpgPath).metadata();
  if (outMeta.exif || outJpgMeta.exif) {
    throw new Error(`EXIF metadata still present on ${baseName}`);
  }

  console.log(
    `[OK] ${inboxFile} (inputExif=${Boolean(rawMeta.exif)}) -> assets/photos/${targetFolder}/${baseName} (${displayWidth}x${displayHeight}, outputExif=false)`
  );

  return {
    inboxFile: inboxFile.replace(/\\/g, '/'),
    targetFolder,
    baseName,
    width: displayWidth,
    height: displayHeight,
    hadInputExif: Boolean(rawMeta.exif),
    outputExifStripped: !outMeta.exif && !outJpgMeta.exif
  };
}

async function optimizeLogos() {
  for (const item of LOGO_MAPPING) {
    const inputPath = path.join(INBOX_DIR, item.inboxFile);
    try {
      await fs.access(inputPath);
    } catch {
      continue;
    }
    const outDir = path.join(OUTPUT_BASE_DIR, item.targetFolder);
    await fs.mkdir(outDir, { recursive: true });
    await sharp(inputPath)
      .rotate()
      .resize({ height: 256, withoutEnlargement: true })
      .webp({ quality: 92 })
      .toFile(path.join(outDir, `${item.baseName}.webp`));
    await sharp(inputPath)
      .rotate()
      .resize({ height: 256, withoutEnlargement: true })
      .png()
      .toFile(path.join(outDir, `${item.baseName}.png`));
    console.log(`[OK] Logo ${item.inboxFile} -> assets/photos/logos/${item.baseName}.webp`);
  }
}

async function run() {
  if (process.argv.includes('--logos-only')) {
    await optimizeLogos();
    return;
  }
  console.log('Starting photo optimization from assets/photos-inbox/ ...');
  const results = [];
  for (const item of PHOTO_MAPPING) {
    const info = await optimizeSinglePhoto(item);
    results.push(info);
  }
  await optimizeLogos();
  await fs.writeFile(
    path.join(OUTPUT_BASE_DIR, 'manifest.json'),
    JSON.stringify(results, null, 2),
    'utf8'
  );
  console.log(
    `All ${results.length} photos optimized and verified (0 EXIF metadata in published outputs). Originals in assets/photos-inbox/ untouched.`
  );
}

run().catch((err) => {
  console.error('Photo optimization failed:', err);
  process.exit(1);
});
