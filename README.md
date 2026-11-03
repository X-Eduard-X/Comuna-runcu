# Harta Digitală Interactivă — Comuna Runcu, Județul Gorj
**Proiect:** Lider European 2026 — Descoperirea Patrimoniului Local

Site static cinematic cu hartă 3D interactivă (MapLibre GL JS + OpenFreeMap + Relief DEM 3D + GSAP), fără chei API și fără costuri de rulare.

---

## 1. Cum rulez proiectul local

1. Asigură-te că ai instalat **Node.js** (v18+).
2. Instalează dependențele (doar prima dată):
   ```bash
   npm install
   ```
3. Pornește serverul local de dezvoltare:
   ```bash
   npm run dev
   ```
4. Deschide în browser adresa afișată în terminal (de obicei `http://localhost:5173`).

---

## 2. Cum adaug sau modific un punct pe hartă (fără modificări de cod)

Tot conținutul hărții se află într-un singur fișier: **`data/waypoints.json`**.

### Adăugarea unui punct nou:
1. Creează un folder nou pentru fotografii în `assets/photos/<id-punct>/` (ex. `assets/photos/a-cheile-sohodolului/`) și pune acolo fotografiile (`.webp` sau `.jpg`).
2. Deschide `data/waypoints.json` și adaugă un obiect în lista `"waypoints"`:
   ```json
   {
     "id": "a-cheile-sohodolului",
     "category": "A",
     "featured": true,
     "order": 1,
     "title": "Titlul Locului",
     "description": "Primul paragraf al descrierii.\nAl doilea paragraf.",
     "coordinates": [23.1365, 45.1625],
     "camera": {
       "zoom": 14.8,
       "pitch": 60,
       "bearing": 12
     },
     "photos": [
       {
         "src": "assets/photos/a-cheile-sohodolului/foto1.webp",
         "alt": "Descriere vizuală a imaginii pentru accesibilitate",
         "caption": "Legendă afișată sub fotografie",
         "credit": "Arhiva locală / Autor",
         "hasPeople": false,
         "consent": true
       }
     ],
     "source": "Sursa obligatorie a informației",
     "audio": "",
     "video": "",
     "consent": true,
     "verified": true
   }
   ```
3. **Reguli automate de afișare și confidențialitate (`consent`):**
   - Punctele din categoriile **C** (Personalități locale) și **D** (Poveștile comunității), precum și orice fotografie cu persoane (`"hasPeople": true`), **nu se afișează în site** dacă `"consent"` nu este `true`.
   - Cât timp `"verified": false`, în modul de dezvoltare (`npm run dev` sau `?dev=1`) apare o etichetă discretă `Locație provizorie`. După ce verifici coordonatele și textul real, schimbă `"verified": true`.
   - Dacă adaugi câmpuri opționale în engleză (`"title_en"`, `"description_en"`, `"source_en"`), comutatorul de limbă **RO / EN** apare automat în bara de sus.

---

## 3. Cum optimizez pozele noi și cum export CSV-ul pentru Google My Maps

- **Optimizare automată poze (AVIF + WebP + JPG la 480w, 960w, 1600w):**
  ```bash
  npm run optimize:photos
  ```
  *(Originalele din `assets/photos-inbox/` rămân neatinse).*

- **Generare CSV de rezervă compatibil cu Google My Maps:**
  ```bash
  npm run export:csv
  ```
  Fișierul rezultat este salvat în **`data/runcu-google-my-maps.csv`** și poate fi importat direct în Google My Maps.

---

## 4. Scurtături de tastatură pentru Prezentarea LIVE (Clicker / Tastatură)

| Tastă | Acțiune |
| :--- | :--- |
| `→` / `PageDown` / `Space` | Punctul următor (în Turul Ghidat sau când panoul este deschis) |
| `←` / `PageUp` | Punctul anterior |
| `Esc` | Închide galeria fullscreen / panoul / iese din Turul Ghidat |
| `F` | Activează / dezactivează modul **Fullscreen** |
| `H` | Ascunde / afișează toată interfața (**Clean HUD**) pentru proiector |

---

## 5. Build, Deploy Gratuit și Generarea Codului QR

1. **Generează build-ul static de producție:**
   ```bash
   npm run build
   ```
   Rezultatul complet este generat în folderul **`dist/`**.
2. **Deploy gratuit:**
   - **Netlify:** Trage folderul `dist/` în Netlify Drop sau conectează repository-ul GitHub (Build command: `npm run build`, Publish directory: `dist`).
   - **GitHub Pages:** Publică conținutul folderului `dist/` pe ramura `gh-pages` (configurația `base: './'` din Vite asigură funcționarea în orice subfolder).
3. **Generarea Codului QR oficial (după ce ai URL-ul final de deploy):**
   ```bash
   npm run generate:qr -- https://adresa-finala-a-proiectului.netlify.app
   ```
   Comanda salvează automat:
   - `assets/qr/runcu-qr.svg` (vectorial, pentru tipar la orice dimensiune)
   - `assets/qr/runcu-qr.png` (2048×2048 px, înaltă rezoluție)
   - Actualizează `"project.deployUrl"` în `data/waypoints.json`.
   *(Conform regulilor proiectului, scriptul și interfața blochează generarea unui cod QR către `localhost`).*
