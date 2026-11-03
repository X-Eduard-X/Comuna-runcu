/**
 * Data Loader, Consent Guard, and Localization Helper
 * All content comes exclusively from data/waypoints.json and data/runcu-boundary.geojson.
 */

export function isDevEnvironment() {
  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (params.get('dev') === '1') return true;
    if (params.get('dev') === '0') return false;
  }
  return Boolean(import.meta.env && import.meta.env.DEV);
}

/**
 * Filter photos and waypoints according to strict consent rules:
 * - Points in categories C and D are hidden unless consent === true.
 * - Any point with consent !== true is hidden.
 * - Any photo with people (hasPeople: true) or explicit consent: false is hidden unless consent === true.
 */
export function filterWaypointsByConsent(rawWaypoints = []) {
  const visible = [];
  const hiddenByConsent = [];

  for (const wp of rawWaypoints) {
    // 1. Check waypoint-level consent
    if (wp.consent !== true) {
      hiddenByConsent.push(wp);
      continue;
    }

    // 2. Explicit check for categories C and D
    if ((wp.category === 'C' || wp.category === 'D') && wp.consent !== true) {
      hiddenByConsent.push(wp);
      continue;
    }

    // 3. Filter photos for individual photo consent
    const rawPhotos = Array.isArray(wp.photos) ? wp.photos : [];
    const allowedPhotos = rawPhotos.filter((photo) => {
      if (photo.consent === false) return false;
      if (photo.hasPeople && photo.consent !== true) return false;
      return true;
    });

    // If a waypoint originally had photos, but all were removed due to consent, hide waypoint
    if (rawPhotos.length > 0 && allowedPhotos.length === 0) {
      hiddenByConsent.push(wp);
      continue;
    }

    visible.push({
      ...wp,
      photos: allowedPhotos
    });
  }

  // Sort by order field ascending
  visible.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  return {
    visibleWaypoints: visible,
    hiddenByConsentCount: hiddenByConsent.length,
    hiddenWaypoints: hiddenByConsent
  };
}

/**
 * Check if any waypoint has English translations (title_en / description_en or en object).
 * The language switcher only appears if at least one waypoint has English text.
 */
export function hasEnglishTranslations(waypoints = []) {
  return waypoints.some((wp) => {
    const hasTopLevelEn =
      (typeof wp.title_en === 'string' && wp.title_en.trim().length > 0) ||
      (typeof wp.description_en === 'string' &&
        wp.description_en.trim().length > 0);
    const hasNestedEn =
      wp.en &&
      ((typeof wp.en.title === 'string' && wp.en.title.trim().length > 0) ||
        (typeof wp.en.description === 'string' &&
          wp.en.description.trim().length > 0));
    return Boolean(hasTopLevelEn || hasNestedEn);
  });
}

export function getLocalizedWaypoint(wp, lang = 'ro') {
  if (!wp) return null;
  if (lang !== 'en') return wp;

  const titleEn = wp.title_en || wp.en?.title || wp.title;
  const descEn = wp.description_en || wp.en?.description || wp.description;
  const sourceEn = wp.source_en || wp.en?.source || wp.source;

  const localizedPhotos = (wp.photos || []).map((photo) => ({
    ...photo,
    alt: photo.alt_en || photo.en?.alt || photo.alt,
    caption: photo.caption_en || photo.en?.caption || photo.caption
  }));

  return {
    ...wp,
    title: titleEn,
    description: descEn,
    source: sourceEn,
    photos: localizedPhotos
  };
}

export function getGuidedTourWaypoints(waypoints = []) {
  const featured = waypoints.filter((wp) => wp.featured === true);
  return (featured.length > 0 ? featured : waypoints)
    .slice()
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export async function loadProjectData(onProgress = () => {}) {
  onProgress(15, 'Se încarcă conturul geografic și relieful comunei Runcu...');
  const [boundaryRes, contoursRes, labelsRes, riversRes] = await Promise.all([
    fetch('./data/runcu-boundary.geojson'),
    fetch('./data/runcu-contours.geojson').catch(() => null),
    fetch('./data/runcu-relief-labels.geojson').catch(() => null),
    fetch('./data/runcu-rivers.geojson').catch(() => null)
  ]);

  if (!boundaryRes || !boundaryRes.ok) {
    throw new Error(
      `Nu s-a putut încărca data/runcu-boundary.geojson (HTTP ${boundaryRes?.status})`
    );
  }
  const boundaryGeoJson = await boundaryRes.json();
  const contoursGeoJson =
    contoursRes && contoursRes.ok
      ? await contoursRes.json()
      : { type: 'FeatureCollection', features: [] };
  const reliefLabelsGeoJson =
    labelsRes && labelsRes.ok
      ? await labelsRes.json()
      : { type: 'FeatureCollection', features: [] };
  const riversGeoJson =
    riversRes && riversRes.ok
      ? await riversRes.json()
      : { type: 'FeatureCollection', features: [] };

  onProgress(40, 'Se încarcă punctele de patrimoniu...');
  const waypointsRes = await fetch('./data/waypoints.json');
  if (!waypointsRes.ok) {
    throw new Error(
      `Nu s-a putut încărca data/waypoints.json (HTTP ${waypointsRes.status})`
    );
  }
  const rawData = await waypointsRes.json();
  const rawWaypoints = Array.isArray(rawData)
    ? rawData
    : rawData.waypoints || [];

  const { visibleWaypoints, hiddenByConsentCount, hiddenWaypoints } =
    filterWaypointsByConsent(rawWaypoints);

  const hasEn = hasEnglishTranslations(visibleWaypoints);

  return {
    project: rawData.project || {},
    categories: rawData.categories || {},
    boundaryGeoJson,
    contoursGeoJson,
    reliefLabelsGeoJson,
    riversGeoJson,
    waypoints: visibleWaypoints,
    allRawWaypointsCount: rawWaypoints.length,
    hiddenByConsentCount,
    hiddenWaypoints,
    hasEn
  };
}
