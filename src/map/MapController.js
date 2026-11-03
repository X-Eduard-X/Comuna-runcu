import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import gsap from 'gsap';
import {
  MAP_CONFIG,
  MOTION_TOKENS,
  CATEGORY_META,
  createSatelliteStyleObject,
  prefersReducedMotion
} from '../config/tokens.js';
import { getLocalizedWaypoint, isDevEnvironment } from '../utils/dataLoader.js';

export class MapController {
  constructor({
    containerId,
    boundaryGeoJson,
    contoursGeoJson,
    reliefLabelsGeoJson,
    riversGeoJson,
    waypoints,
    onSelectWaypoint,
    onMapReady
  }) {
    this.containerId = containerId;
    this.boundaryGeoJson = boundaryGeoJson;
    this.contoursGeoJson = contoursGeoJson || {
      type: 'FeatureCollection',
      features: []
    };
    this.reliefLabelsGeoJson = reliefLabelsGeoJson || {
      type: 'FeatureCollection',
      features: []
    };
    this.riversGeoJson = riversGeoJson || {
      type: 'FeatureCollection',
      features: []
    };
    this.allWaypoints = waypoints;
    this.filteredWaypoints = waypoints;
    this.onSelectWaypoint = onSelectWaypoint;
    this.onMapReady = onMapReady;

    this.map = null;
    this.currentStyleId = 'dark';
    this.is3DEnabled = true;
    this.activeWaypointId = null;
    this.hoveredWaypointId = null;
    this.lang = 'ro';
    this.isIntroOrbitActive = false;
    this.orbitRafId = null;
    this.hasEnteredMap = false;
    this.isMapLoaded = false;
    this.pendingOnLoadCallbacks = [];

    // MapLibre Marker instances keyed by waypoint id
    this.markerEntries = new Map();
    // Cluster Marker instances
    this.clusterMarkers = [];
    // Cached & sanitized style JSON objects for instant, race-free mode switching
    this.styleJsonCache = new Map();
    this.styleSwitchToken = 0;

    // Extracted boundary ring coordinates [[lng, lat], ...]
    this.boundaryRing =
      this.boundaryGeoJson?.features?.[0]?.geometry?.coordinates?.[0] || [];
    this.computedBounds = this.computeGeometryBounds(this.boundaryRing);
  }

  sanitizeExternalStyleJson(rawStyle) {
    const cloned = JSON.parse(JSON.stringify(rawStyle));
    if (Array.isArray(cloned.layers)) {
      for (const lyr of cloned.layers) {
        // Prevent null number warnings on rural buildings without render_height
        if (lyr.type === 'fill-extrusion' && lyr.paint) {
          if (lyr.paint['fill-extrusion-base']) {
            lyr.paint['fill-extrusion-base'] = [
              'coalesce',
              ['get', 'render_min_height'],
              0
            ];
          }
          if (lyr.paint['fill-extrusion-height']) {
            lyr.paint['fill-extrusion-height'] = [
              'coalesce',
              ['get', 'render_height'],
              5
            ];
          }
        }
        // Remove repeating sprite wood pattern that conflicts with 3D hillshade
        if (lyr.id === 'landcover_wood' && lyr.paint?.['fill-pattern']) {
          delete lyr.paint['fill-pattern'];
        }
      }
    }
    return cloned;
  }

  async resolveStyleObject(styleId) {
    const styleDef = MAP_CONFIG.styles[styleId];
    if (!styleDef) return null;
    if (styleDef.url === 'custom-satellite') {
      return createSatelliteStyleObject();
    }
    if (this.styleJsonCache.has(styleDef.url)) {
      return this. sanitizeExternalStyleJson(
        this.styleJsonCache.get(styleDef.url)
      );
    }
    const res = await fetch(styleDef.url);
    const json = await res.json();
    this.styleJsonCache.set(styleDef.url, json);
    return this.sanitizeExternalStyleJson(json);
  }

  preloadExternalStyles() {
    for (const key of ['dark', 'liberty', 'positron']) {
      const url = MAP_CONFIG.styles[key]?.url;
      if (url && url.startsWith('http') && !this.styleJsonCache.has(url)) {
        fetch(url)
          .then((r) => r.json())
          .then((json) => {
            this.styleJsonCache.set(url, json);
          })
          .catch(() => {
            // ignore background preload failure
          });
      }
    }
  }

  getCurrentPreset() {
    return (
      MAP_CONFIG.modePresets[this.currentStyleId] || MAP_CONFIG.modePresets.dark
    );
  }

  computeGeometryBounds(ring) {
    if (!ring || ring.length === 0) {
      return {
        bbox: [23.0153, 45.0784, 23.2318, 45.2913],
        center: MAP_CONFIG.center
      };
    }
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    return {
      bbox: [minLng, minLat, maxLng, maxLat],
      center: [(minLng + maxLng) / 2, (minLat + maxLat) / 2]
    };
  }

  init() {
    if (this.map) return;
    const initialStyle = MAP_CONFIG.styles[this.currentStyleId].url;

    this.map = new maplibregl.Map({
      container: this.containerId,
      style: initialStyle,
      center: MAP_CONFIG.introCamera.center,
      zoom: MAP_CONFIG.introCamera.zoom,
      pitch: MAP_CONFIG.introCamera.pitch,
      bearing: MAP_CONFIG.introCamera.bearing,
      minZoom: MAP_CONFIG.minZoom,
      maxZoom: MAP_CONFIG.maxZoom,
      maxBounds: MAP_CONFIG.maxBounds,
      maxPitch: MAP_CONFIG.maxPitch || 78,
      attributionControl: false,
      cooperativeGestures: false,
      fadeDuration: 200
    });

    // Keep required attributions clearly visible
    this.map.addControl(
      new maplibregl.AttributionControl({
        compact: false,
        customAttribution: 'Comuna Runcu, Jud. Gorj — Lider European 2026'
      }),
      'bottom-right'
    );

    // Gracefully handle optional missing sprite icons in external vector styles
    this.map.on('styleimagemissing', (e) => {
      const id = e.id;
      if (!id || this.map.hasImage(id)) return;
      const emptyPixel = new Uint8Array([0, 0, 0, 0]);
      this.map.addImage(id, { width: 1, height: 1, data: emptyPixel });
    });

    this.map.on('load', () => {
      this.isMapLoaded = true;
      if (typeof window !== 'undefined') {
        window.__runcuMap = this.map;
      }
      this.preloadExternalStyles();
      this.setupTerrainAndBoundaryLayers({ animateDraw: false });
      this.createDomMarkers();
      this.updateClustersAndMarkers();
      if (!this.hasEnteredMap) {
        this.startIntroOrbit();
      }
      if (this.onMapReady) this.onMapReady();
      while (this.pendingOnLoadCallbacks.length > 0) {
        const fn = this.pendingOnLoadCallbacks.shift();
        try {
          fn();
        } catch {
          // ignore callback error
        }
      }
    });

    this.map.on('move', () => {
      if (this.hasEnteredMap) {
        this.updateClustersAndMarkers();
      }
    });

    this.map.on('zoomend', () => {
      if (this.hasEnteredMap) {
        this.updateClustersAndMarkers();
      }
    });
  }

  /**
   * Builds inverted mask polygon (world with a hole for Comuna Runcu)
   */
  createInvertedMaskGeoJson() {
    const outerWorld = [
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85]
    ];
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'Polygon',
            coordinates: [outerWorld, this.boundaryRing]
          }
        }
      ]
    };
  }

  createBoundaryLineGeoJson(sliceCount = null) {
    const coords =
      sliceCount !== null
        ? this.boundaryRing.slice(0, Math.max(2, sliceCount))
        : this.boundaryRing;

    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { name: 'Comuna Runcu, Județul Gorj' },
          geometry: {
            type: 'LineString',
            coordinates: coords
          }
        }
      ]
    };
  }

  /**
   * Finds the first line or symbol layer in the current style so hillshade
   * and landcover tints can be inserted underneath rivers, roads, and labels.
   */
  findFirstOverlayLayerId() {
    const layers = this.map?.getStyle()?.layers || [];
    for (const lyr of layers) {
      if (
        lyr.id.startsWith('runcu-') ||
        lyr.type === 'background' ||
        lyr.type === 'raster' ||
        lyr.type === 'fill' ||
        lyr.type === 'hillshade'
      ) {
        continue;
      }
      return lyr.id;
    }
    return undefined;
  }

  /**
   * Finds the first symbol (label) layer in the current style so boundaries and
   * contours sit beneath crisp text labels.
   */
  findFirstSymbolLayerId() {
    const layers = this.map?.getStyle()?.layers || [];
    for (const lyr of layers) {
      if (lyr.type === 'symbol' && !lyr.id.startsWith('runcu-')) {
        return lyr.id;
      }
    }
    return undefined;
  }

  /**
   * Enhances base map colors, forests, water, roads, and existing vector labels
   * so there are zero pure-black flat zones in Nocturn and strong contrast in all modes.
   */
  enhanceBaseMapStyle(preset, beforeOverlayId) {
    if (!this.map) return;
    const styleLayers = this.map.getStyle()?.layers || [];
    const hasOpenMapTiles = Boolean(this.map.getSource('openmaptiles'));

    // 1. Nocturn base color lift & landcover differentiation
    if (this.currentStyleId === 'dark') {
      if (this.map.getLayer('background')) {
        this.map.setPaintProperty('background', 'background-color', '#122132');
      }
      if (this.map.getLayer('water')) {
        this.map.setPaintProperty('water', 'fill-color', '#154269');
      }
      if (this.map.getLayer('waterway')) {
        this.map.setPaintProperty('waterway', 'line-color', '#2B79B8');
      }
      if (this.map.getLayer('landuse_residential')) {
        this.map.setPaintProperty(
          'landuse_residential',
          'fill-color',
          '#1E3044'
        );
        this.map.setPaintProperty('landuse_residential', 'fill-opacity', 0.65);
      }
      // Elevate road visibility in Nocturn so villages & gorges have clear local streets and paths
      const roadColors = {
        highway_path: { color: '#7898BA', opacity: 0.85 },
        highway_minor: { color: '#6E90B5', opacity: 0.92 },
        highway_major_casing: { color: '#102032', opacity: 0.92 },
        highway_major_inner: { color: '#B2D2F2', opacity: 0.95 },
        highway_major_subtle: { color: '#90B8E0', opacity: 0.92 },
        highway_motorway_inner: { color: '#E5A93C', opacity: 0.96 }
      };
      for (const [layerId, cfg] of Object.entries(roadColors)) {
        if (this.map.getLayer(layerId)) {
          try {
            this.map.setPaintProperty(layerId, 'line-color', cfg.color);
            this.map.setPaintProperty(layerId, 'line-opacity', cfg.opacity);
          } catch {
            // ignore incompatible paint properties
          }
        }
      }
    } else if (this.currentStyleId === 'positron') {
      if (this.map.getLayer('background')) {
        this.map.setPaintProperty('background', 'background-color', '#EEF2F6');
      }
      if (this.map.getLayer('water')) {
        this.map.setPaintProperty('water', 'fill-color', '#78B7E6');
      }
      if (this.map.getLayer('waterway')) {
        this.map.setPaintProperty('waterway', 'line-color', '#3887BE');
      }
    }

    // 1b. Sanitize building-3d if present to avoid null number warnings
    if (this.map.getLayer('building-3d')) {
      try {
        this.map.setPaintProperty('building-3d', 'fill-extrusion-base', [
          'coalesce',
          ['get', 'render_min_height'],
          0
        ]);
        this.map.setPaintProperty('building-3d', 'fill-extrusion-height', [
          'coalesce',
          ['get', 'render_height'],
          5
        ]);
      } catch {
        // ignore
      }
    }

    // 2. Subtle forest & meadow landcover tint (kept gentle so OSM polygon edges never interrupt DEM relief)
    if (
      hasOpenMapTiles &&
      (this.currentStyleId === 'dark' || this.currentStyleId === 'positron')
    ) {
      const forestColor =
        this.currentStyleId === 'dark' ? '#163631' : '#CEE8DA';
      const forestOpacity = this.currentStyleId === 'dark' ? 0.14 : 0.18;
      const grassColor =
        this.currentStyleId === 'dark' ? '#1A303B' : '#E2EFE4';
      const grassOpacity = this.currentStyleId === 'dark' ? 0.12 : 0.14;

      if (!this.map.getLayer('runcu-landcover-grass')) {
        this.map.addLayer(
          {
            id: 'runcu-landcover-grass',
            type: 'fill',
            source: 'openmaptiles',
            'source-layer': 'landcover',
            filter: ['==', 'class', 'grass'],
            paint: {
              'fill-color': grassColor,
              'fill-opacity': grassOpacity
            }
          },
          beforeOverlayId
        );
      } else {
        this.map.setPaintProperty(
          'runcu-landcover-grass',
          'fill-color',
          grassColor
        );
        this.map.setPaintProperty(
          'runcu-landcover-grass',
          'fill-opacity',
          grassOpacity
        );
      }

      if (!this.map.getLayer('runcu-landcover-forest')) {
        this.map.addLayer(
          {
            id: 'runcu-landcover-forest',
            type: 'fill',
            source: 'openmaptiles',
            'source-layer': 'landcover',
            filter: ['==', 'class', 'wood'],
            paint: {
              'fill-color': forestColor,
              'fill-opacity': forestOpacity
            }
          },
          beforeOverlayId
        );
      } else {
        this.map.setPaintProperty(
          'runcu-landcover-forest',
          'fill-color',
          forestColor
        );
        this.map.setPaintProperty(
          'runcu-landcover-forest',
          'fill-opacity',
          forestOpacity
        );
      }
    }

    // 3. Boost contrast and halo on existing base-map place & water symbol layers
    for (const lyr of styleLayers) {
      if (lyr.type !== 'symbol' || lyr.id.startsWith('runcu-')) continue;
      const id = lyr.id;
      const srcLayer = lyr['source-layer'] || '';

      if (srcLayer === 'place' || id.includes('place') || id.includes('label_')) {
        try {
          this.map.setPaintProperty(
            id,
            'text-color',
            preset.labels.villageColor
          );
          this.map.setPaintProperty(
            id,
            'text-halo-color',
            preset.labels.villageHalo
          );
          this.map.setPaintProperty(id, 'text-halo-width', 2.2);
          this.map.setPaintProperty(id, 'text-halo-blur', 0.5);
        } catch {
          // ignore
        }
      } else if (srcLayer === 'water_name' || srcLayer === 'waterway') {
        try {
          this.map.setPaintProperty(id, 'text-color', preset.labels.riverColor);
          this.map.setPaintProperty(
            id,
            'text-halo-color',
            preset.labels.riverHalo
          );
          this.map.setPaintProperty(id, 'text-halo-width', 2.0);
        } catch {
          // ignore
        }
      }
    }
  }

  setupTerrainAndBoundaryLayers({ animateDraw = false } = {}) {
    if (!this.map) return;

    const preset = this.getCurrentPreset();
    const beforeOverlayId = this.findFirstOverlayLayerId();

    // 0. Enhance base style colors, forests, roads, and existing labels
    this.enhanceBaseMapStyle(preset, beforeOverlayId);

    // 1. Add shared free AWS Terrarium 3D DEM source for terrain, hypsometric color-relief, and multidirectional hillshade
    if (!this.map.getSource('runcu-dem-terrain')) {
      this.map.addSource('runcu-dem-terrain', MAP_CONFIG.demSource);
    }

    // 1b. GPU Hypsometric Color-Relief Layer (colors elevations 200m -> 1900m)
    const cr = preset.colorRelief;
    if (cr && cr.enabled) {
      const crOpacity = this.is3DEnabled ? cr.opacity3D : cr.opacity2D;
      if (!this.map.getLayer('runcu-hypsometric-relief')) {
        this.map.addLayer(
          {
            id: 'runcu-hypsometric-relief',
            type: 'color-relief',
            source: 'runcu-dem-terrain',
            paint: {
              'color-relief-color': cr.ramp,
              'color-relief-opacity': crOpacity
            }
          },
          beforeOverlayId
        );
      } else {
        this.map.setPaintProperty(
          'runcu-hypsometric-relief',
          'color-relief-color',
          cr.ramp
        );
        this.map.setPaintProperty(
          'runcu-hypsometric-relief',
          'color-relief-opacity',
          crOpacity
        );
      }
    } else if (this.map.getLayer('runcu-hypsometric-relief')) {
      this.map.setPaintProperty(
        'runcu-hypsometric-relief',
        'color-relief-opacity',
        0
      );
    }

    // 2. Multidirectional Hillshade Layer (NW 315° moonlight/sun + WSW 255° + ENE 55° rim light)
    const hs = preset.hillshade;
    const hsExag = this.is3DEnabled ? hs.exaggeration3D : hs.exaggeration2D;

    if (!this.map.getLayer('runcu-hillshade-multi')) {
      this.map.addLayer(
        {
          id: 'runcu-hillshade-multi',
          type: 'hillshade',
          source: 'runcu-dem-terrain',
          paint: {
            'hillshade-method': hs.method,
            'hillshade-illumination-direction': hs.directions,
            'hillshade-illumination-altitude': hs.altitudes,
            'hillshade-illumination-anchor': 'map',
            'hillshade-exaggeration': hsExag,
            'hillshade-shadow-color': hs.shadowColors,
            'hillshade-highlight-color': hs.highlightColors,
            'hillshade-accent-color': hs.accentColor
          }
        },
        beforeOverlayId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-method',
        hs.method
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-illumination-direction',
        hs.directions
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-illumination-altitude',
        hs.altitudes
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-exaggeration',
        hsExag
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-shadow-color',
        hs.shadowColors
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-highlight-color',
        hs.highlightColors
      );
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-accent-color',
        hs.accentColor
      );
    }

    // 3. Apply 3D Terrain DEM or 2D flat mode (with hillshade kept active)
    if (this.is3DEnabled) {
      this.map.setTerrain({
        source: 'runcu-dem-terrain',
        exaggeration: preset.terrainExaggeration || MAP_CONFIG.terrainExaggeration
      });
    } else {
      this.map.setTerrain(null);
    }

    // 4. Apply Atmosphere Sky & Horizon Fog Gradient
    if (typeof this.map.setSky === 'function' && preset.sky) {
      try {
        this.map.setSky(preset.sky);
      } catch {
        // ignore if unsupported in fallback context
      }
    }

    // 5. Real Topographic Contour Lines (curbe de nivel: 50m minor, 200m major)
    const beforeSymbolId = this.findFirstSymbolLayerId();
    const contourCfg = preset.contours;
    const minorOpacity = this.is3DEnabled
      ? contourCfg.minorOpacity3D
      : contourCfg.minorOpacity2D;
    const majorOpacity = this.is3DEnabled
      ? contourCfg.majorOpacity3D
      : contourCfg.majorOpacity2D;

    if (!this.map.getSource('runcu-contours-source')) {
      this.map.addSource('runcu-contours-source', {
        type: 'geojson',
        data: this.contoursGeoJson
      });
    }

    if (!this.map.getLayer('runcu-contours-minor')) {
      this.map.addLayer(
        {
          id: 'runcu-contours-minor',
          type: 'line',
          source: 'runcu-contours-source',
          filter: ['==', ['get', 'major'], 0],
          paint: {
            'line-color': contourCfg.minorColor,
            'line-opacity': minorOpacity,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              0.55,
              14,
              1.05
            ]
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-contours-minor',
        'line-color',
        contourCfg.minorColor
      );
      this.map.setPaintProperty(
        'runcu-contours-minor',
        'line-opacity',
        minorOpacity
      );
    }

    if (!this.map.getLayer('runcu-contours-major')) {
      this.map.addLayer(
        {
          id: 'runcu-contours-major',
          type: 'line',
          source: 'runcu-contours-source',
          filter: ['==', ['get', 'major'], 1],
          paint: {
            'line-color': contourCfg.majorColor,
            'line-opacity': majorOpacity,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              1.1,
              14,
              1.85
            ]
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-contours-major',
        'line-color',
        contourCfg.majorColor
      );
      this.map.setPaintProperty(
        'runcu-contours-major',
        'line-opacity',
        majorOpacity
      );
    }

    if (!this.map.getLayer('runcu-contours-labels')) {
      this.map.addLayer(
        {
          id: 'runcu-contours-labels',
          type: 'symbol',
          source: 'runcu-contours-source',
          filter: ['==', ['get', 'major'], 1],
          minzoom: 11.3,
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 420,
            'text-field': ['get', 'label'],
            'text-font': ['Noto Sans Regular'],
            'text-size': 10.5,
            'text-pitch-alignment': 'viewport'
          },
          paint: {
            'text-color': contourCfg.labelColor,
            'text-halo-color': contourCfg.labelHalo,
            'text-halo-width': 1.8
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-contours-labels',
        'text-color',
        contourCfg.labelColor
      );
      this.map.setPaintProperty(
        'runcu-contours-labels',
        'text-halo-color',
        contourCfg.labelHalo
      );
    }

    // 6. Highlighted Local Rivers & Valley Courses (Sohodol, Jaleș, Bistrița)
    if (!this.map.getSource('runcu-rivers-source')) {
      this.map.addSource('runcu-rivers-source', {
        type: 'geojson',
        data: this.riversGeoJson
      });
    }

    if (!this.map.getLayer('runcu-rivers-glow')) {
      this.map.addLayer(
        {
          id: 'runcu-rivers-glow',
          type: 'line',
          source: 'runcu-rivers-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': preset.labels.riverGlowColor,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              3.5,
              15,
              8.0
            ],
            'line-blur': 2.5
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-rivers-glow',
        'line-color',
        preset.labels.riverGlowColor
      );
    }

    if (!this.map.getLayer('runcu-rivers-main')) {
      this.map.addLayer(
        {
          id: 'runcu-rivers-main',
          type: 'line',
          source: 'runcu-rivers-source',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': preset.labels.riverLineColor,
            'line-width': [
              'interpolate',
              ['linear'],
              ['zoom'],
              10,
              1.4,
              15,
              3.2
            ],
            'line-opacity': 0.9
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-rivers-main',
        'line-color',
        preset.labels.riverLineColor
      );
    }

    // 7. Soft Inverted Mask outside Comuna Runcu (~22-28% opacity so surrounding mountains stay visible)
    const maskData = this.createInvertedMaskGeoJson();
    if (!this.map.getSource('runcu-inverted-mask')) {
      this.map.addSource('runcu-inverted-mask', {
        type: 'geojson',
        data: maskData
      });
    }

    const targetMaskOpacity =
      this.hasEnteredMap && !animateDraw
        ? preset.outsideMask.opacity
        : Math.min(0.18, preset.outsideMask.opacity);

    if (!this.map.getLayer('runcu-outside-mask-layer')) {
      this.map.addLayer(
        {
          id: 'runcu-outside-mask-layer',
          type: 'fill',
          source: 'runcu-inverted-mask',
          paint: {
            'fill-color': preset.outsideMask.color,
            'fill-opacity': targetMaskOpacity
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-outside-mask-layer',
        'fill-color',
        preset.outsideMask.color
      );
      this.map.setPaintProperty(
        'runcu-outside-mask-layer',
        'fill-opacity',
        targetMaskOpacity
      );
    }

    // 8. Commune Interior Subtle Warm Tint
    if (!this.map.getSource('runcu-polygon-source')) {
      this.map.addSource('runcu-polygon-source', {
        type: 'geojson',
        data: this.boundaryGeoJson
      });
    }

    if (!this.map.getLayer('runcu-interior-tint')) {
      this.map.addLayer(
        {
          id: 'runcu-interior-tint',
          type: 'fill',
          source: 'runcu-polygon-source',
          paint: {
            'fill-color': preset.interiorTint.color,
            'fill-opacity': preset.interiorTint.opacity
          }
        },
        beforeSymbolId
      );
    } else {
      this.map.setPaintProperty(
        'runcu-interior-tint',
        'fill-color',
        preset.interiorTint.color
      );
      this.map.setPaintProperty(
        'runcu-interior-tint',
        'fill-opacity',
        preset.interiorTint.opacity
      );
    }

    // 9. Commune Boundary Line (High-Contrast Casing + Outer Glow + Luminous Core)
    const initialLineData = animateDraw
      ? this.createBoundaryLineGeoJson(2)
      : this.createBoundaryLineGeoJson(null);

    if (!this.map.getSource('runcu-boundary-line-source')) {
      this.map.addSource('runcu-boundary-line-source', {
        type: 'geojson',
        data: initialLineData
      });
    } else {
      this.map.getSource('runcu-boundary-line-source').setData(initialLineData);
    }

    if (!this.map.getLayer('runcu-boundary-glow')) {
      this.map.addLayer({
        id: 'runcu-boundary-glow',
        type: 'line',
        source: 'runcu-boundary-line-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': preset.boundary.glowColor,
          'line-width': preset.boundary.glowWidth,
          'line-blur': 7,
          'line-opacity': preset.boundary.glowOpacity
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-boundary-glow',
        'line-color',
        preset.boundary.glowColor
      );
      this.map.setPaintProperty(
        'runcu-boundary-glow',
        'line-width',
        preset.boundary.glowWidth
      );
      this.map.setPaintProperty(
        'runcu-boundary-glow',
        'line-opacity',
        preset.boundary.glowOpacity
      );
    }

    if (!this.map.getLayer('runcu-boundary-casing')) {
      this.map.addLayer({
        id: 'runcu-boundary-casing',
        type: 'line',
        source: 'runcu-boundary-line-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': preset.boundary.casingColor,
          'line-width': preset.boundary.casingWidth,
          'line-opacity': 0.88
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-boundary-casing',
        'line-color',
        preset.boundary.casingColor
      );
      this.map.setPaintProperty(
        'runcu-boundary-casing',
        'line-width',
        preset.boundary.casingWidth
      );
    }

    if (!this.map.getLayer('runcu-boundary-main')) {
      this.map.addLayer({
        id: 'runcu-boundary-main',
        type: 'line',
        source: 'runcu-boundary-line-source',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': preset.boundary.mainColor,
          'line-width': preset.boundary.mainWidth,
          'line-opacity': 0.98
        }
      });
      if (this.map.getLayer('runcu-boundary-main')) {
        this.map.setPaintProperty(
          'runcu-boundary-main',
          'line-color',
          preset.boundary.mainColor
        );
        this.map.setPaintProperty(
          'runcu-boundary-main',
          'line-width',
          preset.boundary.mainWidth
        );
      }
    }

    // 9b. Dashed proximity connector for neighboring peaks/landmarks (e.g., Vârful Arcanu -> NW boundary)
    const proximityFeatures = (this.allWaypoints || [])
      .filter(
        (w) =>
          Array.isArray(w.boundaryAnchor) &&
          w.boundaryAnchor.length === 2 &&
          Array.isArray(w.coordinates) &&
          w.coordinates.length === 2
      )
      .map((w) => ({
        type: 'Feature',
        properties: {
          id: w.id,
          label: w.proximityBadge || 'În vecinătate'
        },
        geometry: {
          type: 'LineString',
          coordinates: [w.boundaryAnchor, w.coordinates]
        }
      }));

    const proximityGeoJson = {
      type: 'FeatureCollection',
      features: proximityFeatures
    };

    if (!this.map.getSource('runcu-proximity-links-source')) {
      this.map.addSource('runcu-proximity-links-source', {
        type: 'geojson',
        data: proximityGeoJson
      });
    } else {
      this.map
        .getSource('runcu-proximity-links-source')
        .setData(proximityGeoJson);
    }

    if (!this.map.getLayer('runcu-proximity-links-layer')) {
      this.map.addLayer({
        id: 'runcu-proximity-links-layer',
        type: 'line',
        source: 'runcu-proximity-links-source',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': preset.boundary.mainColor,
          'line-width': 2.2,
          'line-dasharray': [2, 2.5],
          'line-opacity': 0.85
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-proximity-links-layer',
        'line-color',
        preset.boundary.mainColor
      );
    }

    // 10. High-Contrast Topographic Labels: Rivers, Mountain Peaks, and Villages
    if (!this.map.getLayer('runcu-rivers-labels')) {
      this.map.addLayer({
        id: 'runcu-rivers-labels',
        type: 'symbol',
        source: 'runcu-rivers-source',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 320,
          'text-field': ['get', 'name'],
          'text-font': ['Noto Sans Italic'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10.5,
            11.5,
            14,
            14
          ],
          'text-letter-spacing': 0.06,
          'text-pitch-alignment': 'viewport'
        },
        paint: {
          'text-color': preset.labels.riverColor,
          'text-halo-color': preset.labels.riverHalo,
          'text-halo-width': 2.2
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-rivers-labels',
        'text-color',
        preset.labels.riverColor
      );
      this.map.setPaintProperty(
        'runcu-rivers-labels',
        'text-halo-color',
        preset.labels.riverHalo
      );
    }

    if (!this.map.getSource('runcu-relief-labels-source')) {
      this.map.addSource('runcu-relief-labels-source', {
        type: 'geojson',
        data: this.reliefLabelsGeoJson
      });
    }

    // Mountain Peaks (Vf. Straja, Arcanu, Coarnele, Mutu, Șigleu Mare, etc.)
    if (!this.map.getLayer('runcu-peaks-labels')) {
      this.map.addLayer({
        id: 'runcu-peaks-labels',
        type: 'symbol',
        source: 'runcu-relief-labels-source',
        filter: ['==', ['get', 'kind'], 'peak'],
        layout: {
          'text-field': ['get', 'display'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            11.5,
            13,
            13.5,
            15,
            15
          ],
          'text-line-height': 1.18,
          'text-padding': 6,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport'
        },
        paint: {
          'text-color': preset.labels.peakColor,
          'text-halo-color': preset.labels.peakHalo,
          'text-halo-width': 2.4,
          'text-halo-blur': 0.4
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-peaks-labels',
        'text-color',
        preset.labels.peakColor
      );
      this.map.setPaintProperty(
        'runcu-peaks-labels',
        'text-halo-color',
        preset.labels.peakHalo
      );
    }

    // Neighboring localities for regional orientation
    if (!this.map.getLayer('runcu-neighbor-places-labels')) {
      this.map.addLayer({
        id: 'runcu-neighbor-places-labels',
        type: 'symbol',
        source: 'runcu-relief-labels-source',
        filter: ['==', ['get', 'kind'], 'neighbor_place'],
        minzoom: 11,
        layout: {
          'text-field': ['get', 'display'],
          'text-font': ['Noto Sans Regular'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            11.5,
            14,
            13.5
          ],
          'text-padding': 8,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport'
        },
        paint: {
          'text-color': preset.labels.villageColor,
          'text-opacity': 0.82,
          'text-halo-color': preset.labels.villageHalo,
          'text-halo-width': 2.2
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-neighbor-places-labels',
        'text-color',
        preset.labels.villageColor
      );
      this.map.setPaintProperty(
        'runcu-neighbor-places-labels',
        'text-halo-color',
        preset.labels.villageHalo
      );
    }

    // Official Runcu Component Villages (Runcu, Dobrița, Suseni, Bâlta, Bâltișoara, Răchiți, Valea Mare)
    if (!this.map.getLayer('runcu-villages-labels')) {
      this.map.addLayer({
        id: 'runcu-villages-labels',
        type: 'symbol',
        source: 'runcu-relief-labels-source',
        filter: ['==', ['get', 'kind'], 'runcu_village'],
        layout: {
          'text-field': ['get', 'display'],
          'text-font': ['Noto Sans Bold'],
          'text-size': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            13,
            12,
            14.5,
            15,
            17
          ],
          'text-letter-spacing': 0.04,
          'text-padding': 4,
          'text-allow-overlap': false,
          'text-pitch-alignment': 'viewport',
          'text-rotation-alignment': 'viewport'
        },
        paint: {
          'text-color': preset.labels.villageColor,
          'text-halo-color': preset.labels.villageHalo,
          'text-halo-width': 2.6,
          'text-halo-blur': 0.4
        }
      });
    } else {
      this.map.setPaintProperty(
        'runcu-villages-labels',
        'text-color',
        preset.labels.villageColor
      );
      this.map.setPaintProperty(
        'runcu-villages-labels',
        'text-halo-color',
        preset.labels.villageHalo
      );
    }
  }

  /**
   * Gentle 3D orbital camera drift while the Intro cover overlay is active
   */
  startIntroOrbit() {
    if (prefersReducedMotion()) return;
    this.isIntroOrbitActive = true;
    let lastTime = performance.now();

    const tick = (now) => {
      if (!this.isIntroOrbitActive || !this.map) return;
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      const currentBearing = this.map.getBearing();
      this.map.setBearing(currentBearing + dt * 1.4);
      this.orbitRafId = requestAnimationFrame(tick);
    };

    this.orbitRafId = requestAnimationFrame(tick);
  }

  stopIntroOrbit() {
    this.isIntroOrbitActive = false;
    if (this.orbitRafId) {
      cancelAnimationFrame(this.orbitRafId);
      this.orbitRafId = null;
    }
  }

  /**
   * Sequence 3: Cinematic entry into the map
   * - flyTo commune overview with curve, pitch (60°), bearing (-24°) (2.8s)
   * - Softly dim outside area (~25-28%) so surrounding mountains remain visible
   * - Progressively draw Runcu boundary with glow
   * - Cascade markers into view
   */
  enterMapCinematic(onComplete = () => {}) {
    if (!this.map) {
      this.init();
    }
    if (!this.isMapLoaded) {
      this.pendingOnLoadCallbacks.push(() =>
        this.enterMapCinematic(onComplete)
      );
      return;
    }
    this.stopIntroOrbit();
    this.hasEnteredMap = true;
    const reduced = prefersReducedMotion();
    const preset = this.getCurrentPreset();

    // Reset boundary line to 2 points before drawing
    const lineSource = this.map?.getSource('runcu-boundary-line-source');
    if (lineSource && !reduced) {
      lineSource.setData(this.createBoundaryLineGeoJson(2));
    }

    // Fly camera to Comuna Runcu overview with ridges in profile
    this.map.flyTo({
      center: MAP_CONFIG.overviewCamera.center,
      zoom: MAP_CONFIG.overviewCamera.zoom,
      pitch: this.is3DEnabled ? MAP_CONFIG.overviewCamera.pitch : 0,
      bearing: this.is3DEnabled ? MAP_CONFIG.overviewCamera.bearing : 0,
      duration: reduced ? 0 : MOTION_TOKENS.duration.cameraFlyMs,
      curve: 1.42,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true
    });

    // Animate inverted mask opacity to soft target (~0.22–0.28)
    if (this.map.getLayer('runcu-outside-mask-layer')) {
      const maskProxy = { opacity: 0.14 };
      gsap.to(maskProxy, {
        opacity: preset.outsideMask.opacity,
        duration: reduced ? 0.1 : 1.6,
        ease: MOTION_TOKENS.ease.outPower3,
        onUpdate: () => {
          if (this.map?.getLayer('runcu-outside-mask-layer')) {
            this.map.setPaintProperty(
              'runcu-outside-mask-layer',
              'fill-opacity',
              maskProxy.opacity
            );
          }
        }
      });
    }

    // Animate progressive boundary line drawing
    const totalVertices = this.boundaryRing.length;
    const drawProxy = { count: reduced ? totalVertices : 2 };

    gsap.to(drawProxy, {
      count: totalVertices,
      duration: reduced ? 0.05 : MOTION_TOKENS.duration.boundaryDraw,
      delay: reduced ? 0 : 0.35,
      ease: MOTION_TOKENS.ease.inOutCubic,
      onUpdate: () => {
        const src = this.map?.getSource('runcu-boundary-line-source');
        if (src) {
          src.setData(
            this.createBoundaryLineGeoJson(Math.round(drawProxy.count))
          );
        }
      },
      onComplete: () => {
        const src = this.map?.getSource('runcu-boundary-line-source');
        if (src) {
          src.setData(this.createBoundaryLineGeoJson(null));
        }
        this.revealMarkersCascade();
        onComplete();
      }
    });
  }

  /**
   * Builds custom HTML markers for all waypoints
   */
  createDomMarkers() {
    for (const entry of this.markerEntries.values()) {
      entry.marker.remove();
    }
    this.markerEntries.clear();

    const isDev = isDevEnvironment();

    for (const wp of this.allWaypoints) {
      const catMeta = CATEGORY_META[wp.category] || CATEGORY_META.A;
      const localized = getLocalizedWaypoint(wp, this.lang);

      const el = document.createElement('button');
      el.type = 'button';
      el.className = `runcu-marker cat-${wp.category.toLowerCase()} is-hidden-pre-entry`;
      el.dataset.id = wp.id;
      el.dataset.category = wp.category;
      el.style.setProperty('--marker-color', catMeta.color);
      el.style.setProperty('--marker-glow', catMeta.glow);
      el.setAttribute(
        'aria-label',
        `${localized.title} — Categoria ${wp.category}: ${
          this.lang === 'en' ? catMeta.labelEn : catMeta.labelRo
        }`
      );

      const devBadgeHtml =
        isDev && wp.verified === false
          ? `<span class="marker-tooltip__dev">Locație provizorie</span>`
          : '';

      const proximityPillHtml = wp.proximityBadge
        ? `<span class="runcu-marker__proximity-pill">În vecinătate</span>`
        : '';

      const proximityTooltipHtml = wp.proximityBadge
        ? `<span class="marker-tooltip__proximity">${wp.proximityBadge}</span>`
        : '';

      el.innerHTML = `
        <span class="runcu-marker__pulse" aria-hidden="true"></span>
        <span class="runcu-marker__core">
          <span class="runcu-marker__icon">${catMeta.iconSvg}</span>
          <span class="runcu-marker__badge">${wp.category}</span>
        </span>
        ${proximityPillHtml}
        <span class="runcu-marker__tooltip" role="tooltip">
          <span class="marker-tooltip__cat" style="color:${catMeta.color}">
            Cat. ${wp.category} • ${
        this.lang === 'en' ? catMeta.labelEn : catMeta.labelRo
      }
          </span>
          <strong class="marker-tooltip__title">${localized.title}</strong>
          ${proximityTooltipHtml}
          ${devBadgeHtml}
        </span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onSelectWaypoint) {
          this.onSelectWaypoint(wp.id);
        }
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat(wp.coordinates)
        .addTo(this.map);

      this.markerEntries.set(wp.id, {
        wp,
        el,
        marker
      });
    }
  }

  /**
   * Cascades visible markers in with staggered pop-in animation
   */
  revealMarkersCascade() {
    this.updateClustersAndMarkers();

    const visibleElements = [];
    for (const wp of this.filteredWaypoints) {
      const entry = this.markerEntries.get(wp.id);
      if (entry && !entry.isClustered) {
        entry.el.classList.remove('is-hidden-pre-entry');
        const core = entry.el.querySelector('.runcu-marker__core');
        if (core) visibleElements.push(core);
      }
    }

    for (const cm of this.clusterMarkers) {
      const core = cm.el.querySelector('.runcu-cluster__core');
      if (core) visibleElements.push(core);
    }

    if (prefersReducedMotion() || visibleElements.length === 0) {
      return;
    }

    gsap.fromTo(
      visibleElements,
      { scale: 0.2, opacity: 0, y: 14 },
      {
        scale: 1,
        opacity: 1,
        y: 0,
        duration: 0.65,
        stagger: MOTION_TOKENS.duration.stagger,
        ease: MOTION_TOKENS.ease.backOut,
        clearProps: 'transform,opacity'
      }
    );
  }

  /**
   * Screen-space clustering for custom markers when zoomed out
   */
  updateClustersAndMarkers() {
    if (!this.map) return;

    for (const cm of this.clusterMarkers) {
      cm.marker.remove();
    }
    this.clusterMarkers = [];

    const filteredIds = new Set(this.filteredWaypoints.map((w) => w.id));
    const zoom = this.map.getZoom();
    const enableClustering = zoom < 12.8 && this.filteredWaypoints.length > 2;
    const clusterRadiusPx = 48;

    const projected = [];
    for (const wp of this.filteredWaypoints) {
      const pt = this.map.project(wp.coordinates);
      projected.push({
        wp,
        x: pt.x,
        y: pt.y,
        clustered: false
      });
    }

    const clusters = [];
    if (enableClustering) {
      for (let i = 0; i < projected.length; i++) {
        if (projected[i].clustered) continue;
        if (projected[i].wp.id === this.activeWaypointId) continue;

        const members = [projected[i]];
        for (let j = i + 1; j < projected.length; j++) {
          if (projected[j].clustered) continue;
          if (projected[j].wp.id === this.activeWaypointId) continue;
          const dx = projected[i].x - projected[j].x;
          const dy = projected[i].y - projected[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist <= clusterRadiusPx) {
            members.push(projected[j]);
          }
        }

        if (members.length > 1) {
          for (const m of members) m.clustered = true;
          clusters.push(members.map((m) => m.wp));
        }
      }
    }

    const clusteredIds = new Set(clusters.flat().map((wp) => wp.id));

    for (const [id, entry] of this.markerEntries.entries()) {
      const isFilteredIn = filteredIds.has(id);
      const isClustered = clusteredIds.has(id);
      entry.isClustered = isClustered;

      if (!isFilteredIn || isClustered) {
        entry.el.classList.add('is-hidden-by-filter');
      } else {
        entry.el.classList.remove('is-hidden-by-filter');
        if (this.hasEnteredMap) {
          entry.el.classList.remove('is-hidden-pre-entry');
        }
      }
    }

    for (const group of clusters) {
      const avgLng =
        group.reduce((acc, w) => acc + w.coordinates[0], 0) / group.length;
      const avgLat =
        group.reduce((acc, w) => acc + w.coordinates[1], 0) / group.length;

      const step = 100 / group.length;
      const stops = group
        .map((w, idx) => {
          const color = CATEGORY_META[w.category]?.color || '#E5A93C';
          return `${color} ${(idx * step).toFixed(1)}% ${(
            (idx + 1) *
            step
          ).toFixed(1)}%`;
        })
        .join(', ');

      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'runcu-cluster';
      el.setAttribute(
        'aria-label',
        `Grup de ${group.length} puncte pe hartă. Apasă pentru a apropia.`
      );
      el.innerHTML = `
        <span class="runcu-cluster__core" style="background: conic-gradient(${stops})">
          <span class="runcu-cluster__inner">${group.length}</span>
        </span>
        <span class="runcu-cluster__tooltip">${group.length} puncte apropiate — Click pentru zoom</span>
      `;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const bounds = new maplibregl.LngLatBounds();
        for (const w of group) {
          bounds.extend(w.coordinates);
        }
        this.map.fitBounds(bounds, {
          padding: 110,
          maxZoom: 14.5,
          pitch: this.is3DEnabled ? 58 : 0,
          duration: prefersReducedMotion() ? 0 : 1200
        });
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'center'
      })
        .setLngLat([avgLng, avgLat])
        .addTo(this.map);

      this.clusterMarkers.push({ el, marker, group });
    }
  }

  setFilteredWaypoints(waypoints) {
    this.filteredWaypoints = waypoints;
    this.updateClustersAndMarkers();
  }

  setLanguage(lang) {
    this.lang = lang;
    this.createDomMarkers();
    this.setActiveMarker(this.activeWaypointId);
    this.updateClustersAndMarkers();
  }

  setActiveMarker(waypointId) {
    this.activeWaypointId = waypointId;
    for (const [id, entry] of this.markerEntries.entries()) {
      entry.el.classList.toggle('is-active', id === waypointId);
    }
    this.updateClustersAndMarkers();
  }

  setHoveredMarker(waypointId) {
    this.hoveredWaypointId = waypointId;
    for (const [id, entry] of this.markerEntries.entries()) {
      entry.el.classList.toggle('is-hovered', id === waypointId);
    }
  }

  /**
   * Sequence 5: Animated camera flight to a selected waypoint
   */
  flyToWaypoint(wp) {
    if (!this.map || !wp) return;
    this.setActiveMarker(wp.id);

    const cam = wp.camera || {};
    const targetZoom = cam.zoom ?? 14.2;
    const targetPitch = this.is3DEnabled ? (cam.pitch ?? 60) : 0;
    const targetBearing = this.is3DEnabled ? (cam.bearing ?? -22) : 0;

    // Offset slightly on desktop so the point sits centered in the visible map area left of the side panel
    const isDesktop = window.innerWidth >= 960;
    const offset = isDesktop ? [-160, 0] : [0, -90];

    this.map.flyTo({
      center: wp.coordinates,
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      offset,
      duration: prefersReducedMotion()
        ? 0
        : MOTION_TOKENS.duration.cameraPointFlyMs,
      curve: 1.38,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      essential: true
    });
  }

  resetView() {
    if (!this.map) return;
    this.setActiveMarker(null);
    this.map.flyTo({
      center: MAP_CONFIG.overviewCamera.center,
      zoom: MAP_CONFIG.overviewCamera.zoom,
      pitch: this.is3DEnabled ? MAP_CONFIG.overviewCamera.pitch : 0,
      bearing: this.is3DEnabled ? MAP_CONFIG.overviewCamera.bearing : 0,
      offset: [0, 0],
      duration: prefersReducedMotion() ? 0 : 1800,
      curve: 1.3,
      essential: true
    });
  }

  toggle3D(forceState) {
    this.is3DEnabled =
      typeof forceState === 'boolean' ? forceState : !this.is3DEnabled;

    if (!this.map) return this.is3DEnabled;

    const preset = this.getCurrentPreset();
    const hs = preset.hillshade;
    const cr = preset.colorRelief;
    const contourCfg = preset.contours;

    // Update 2D/3D hillshade, color-relief & contour intensities so 2D still shows rich relief
    if (this.map.getLayer('runcu-hillshade-multi')) {
      this.map.setPaintProperty(
        'runcu-hillshade-multi',
        'hillshade-exaggeration',
        this.is3DEnabled ? hs.exaggeration3D : hs.exaggeration2D
      );
    }
    if (cr?.enabled && this.map.getLayer('runcu-hypsometric-relief')) {
      this.map.setPaintProperty(
        'runcu-hypsometric-relief',
        'color-relief-opacity',
        this.is3DEnabled ? cr.opacity3D : cr.opacity2D
      );
    }
    if (this.map.getLayer('runcu-contours-minor')) {
      this.map.setPaintProperty(
        'runcu-contours-minor',
        'line-opacity',
        this.is3DEnabled ? contourCfg.minorOpacity3D : contourCfg.minorOpacity2D
      );
    }
    if (this.map.getLayer('runcu-contours-major')) {
      this.map.setPaintProperty(
        'runcu-contours-major',
        'line-opacity',
        this.is3DEnabled ? contourCfg.majorOpacity3D : contourCfg.majorOpacity2D
      );
    }

    if (this.is3DEnabled) {
      if (this.map.getSource('runcu-dem-terrain')) {
        this.map.setTerrain({
          source: 'runcu-dem-terrain',
          exaggeration:
            preset.terrainExaggeration || MAP_CONFIG.terrainExaggeration
        });
      }
      this.map.easeTo({
        pitch: MAP_CONFIG.overviewCamera.pitch,
        bearing:
          Math.abs(this.map.getBearing()) < 2
            ? MAP_CONFIG.overviewCamera.bearing
            : this.map.getBearing(),
        duration: prefersReducedMotion() ? 0 : 900
      });
    } else {
      this.map.setTerrain(null);
      this.map.easeTo({
        pitch: 0,
        bearing: 0,
        duration: prefersReducedMotion() ? 0 : 900
      });
    }

    return this.is3DEnabled;
  }

  async setStyle(styleId) {
    if (!this.map || !MAP_CONFIG.styles[styleId]) return;
    if (this.currentStyleId === styleId) return;

    this.currentStyleId = styleId;
    const switchToken = ++this.styleSwitchToken;

    try {
      const styleObject = await this.resolveStyleObject(styleId);
      if (!styleObject || this.styleSwitchToken !== switchToken || !this.map) {
        return;
      }

      // Detach 3D terrain cleanly before switching styles to avoid MapLibre _checkLoaded diff warning
      if (this.map.getTerrain()) {
        this.map.setTerrain(null);
      }

      this.map.once('style.load', () => {
        if (this.styleSwitchToken !== switchToken || !this.map) return;
        this.setupTerrainAndBoundaryLayers({ animateDraw: false });
      });

      this.map.setStyle(styleObject, { diff: false });
    } catch (err) {
      console.error('Style switch error:', err);
    }
  }
}
