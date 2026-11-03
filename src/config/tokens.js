/**
 * Design, Motion, and Cartographic Tokens
 * Project: Lider European 2026 — Comuna Runcu, Județul Gorj
 */

export const MOTION_TOKENS = {
  duration: {
    micro: 0.22,
    ui: 0.72,
    stagger: 0.075,
    introReveal: 1.05,
    boundaryDraw: 2.2,
    cameraFlyMs: 2800,
    cameraPointFlyMs: 2400
  },
  ease: {
    outExpo: 'expo.out',
    outPower3: 'power3.out',
    inOutCubic: 'power2.inOut',
    backOut: 'back.out(1.5)'
  }
};

export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

const LOCAL_DEM_TILES_URL =
  typeof window !== 'undefined'
    ? `${new URL('./dem/', window.location.href).href}{z}/{x}/{y}.png`
    : '/dem/{z}/{x}/{y}.png';

export const MAP_CONFIG = {
  // Verified Comuna Runcu, Județul Gorj (OSM relation 9717317)
  center: [23.136, 45.164],
  introCamera: {
    center: [23.136, 45.168],
    zoom: 11.35,
    pitch: 64,
    bearing: -28
  },
  overviewCamera: {
    center: [23.136, 45.164],
    zoom: 11.58,
    pitch: 60,
    bearing: -24
  },
  maxBounds: [
    [22.82, 44.96], // Southwest [lng, lat]
    [23.46, 45.42]  // Northeast [lng, lat]
  ],
  minZoom: 10,
  maxZoom: 18,
  maxPitch: 78,
  terrainExaggeration: 1.7,
  styles: {
    dark: {
      id: 'dark',
      labelRo: 'Cinematic Nocturn',
      labelEn: 'Cinematic Dark',
      url: 'https://tiles.openfreemap.org/styles/dark'
    },
    liberty: {
      id: 'liberty',
      labelRo: 'Explorator Topografic',
      labelEn: 'Topographic Liberty',
      url: 'https://tiles.openfreemap.org/styles/liberty'
    },
    positron: {
      id: 'positron',
      labelRo: 'Editorial Luminos',
      labelEn: 'Light Positron',
      url: 'https://tiles.openfreemap.org/styles/positron'
    },
    satellite: {
      id: 'satellite',
      labelRo: 'Satelit + Relief 3D',
      labelEn: 'Satellite + 3D Terrain',
      url: 'custom-satellite'
    }
  },
  demSource: {
    type: 'raster-dem',
    tiles: [LOCAL_DEM_TILES_URL],
    encoding: 'terrarium',
    tileSize: 256,
    minzoom: 8,
    maxzoom: 12,
    attribution: 'Terrain © Mapzen / AWS Open Data'
  },
  // Per-mode relief, hypsometric tint, multidirectional hillshade, atmosphere, contour, boundary & label presets
  modePresets: {
    dark: {
      terrainExaggeration: 1.72,
      colorRelief: {
        enabled: true,
        opacity3D: 0.76,
        opacity2D: 0.82,
        ramp: [
          'interpolate',
          ['linear'],
          ['elevation'],
          200,
          '#0F1E2E',
          350,
          '#13283A',
          550,
          '#16383A',
          850,
          '#1D4944',
          1150,
          '#295B59',
          1450,
          '#3C727A',
          1700,
          '#5E90A3',
          1900,
          '#88B4C9'
        ]
      },
      hillshade: {
        method: 'multidirectional',
        directions: [315, 265, 45],
        altitudes: [30, 30, 30],
        exaggeration3D: 0.82,
        exaggeration2D: 0.92,
        shadowColors: ['#040B16', '#06101F', '#081426'],
        highlightColors: ['#E2F2FF', '#93D5FF', '#FDE098'],
        accentColor: '#4E95CC'
      },
      contours: {
        minorColor: '#93C5FD',
        minorOpacity3D: 0.22,
        minorOpacity2D: 0.30,
        majorColor: '#F6C86E',
        majorOpacity3D: 0.48,
        majorOpacity2D: 0.58,
        labelColor: '#E2E8F0',
        labelHalo: 'rgba(6, 14, 26, 0.95)'
      },
      sky: {
        'sky-color': '#071222',
        'horizon-color': '#2B568A',
        'fog-color': '#162E4C',
        'fog-ground-blend': 0.34,
        'horizon-fog-blend': 0.76,
        'sky-horizon-blend': 0.65,
        'atmosphere-blend': 0.88
      },
      outsideMask: {
        color: '#07111F',
        opacity: 0.28
      },
      interiorTint: {
        color: '#E5A93C',
        opacity: 0.04
      },
      boundary: {
        casingColor: '#050C16',
        casingWidth: 5.8,
        glowColor: '#E5A93C',
        glowWidth: 11,
        glowOpacity: 0.68,
        mainColor: '#FFE082',
        mainWidth: 3.1
      },
      labels: {
        villageColor: '#F8FAFC',
        villageHalo: 'rgba(6, 13, 24, 0.96)',
        peakColor: '#FDE68A',
        peakHalo: 'rgba(6, 13, 24, 0.96)',
        riverColor: '#7DD3FC',
        riverHalo: 'rgba(6, 13, 24, 0.95)',
        riverLineColor: '#3898EC',
        riverGlowColor: 'rgba(56, 189, 248, 0.42)'
      }
    },
    liberty: {
      terrainExaggeration: 1.62,
      colorRelief: {
        enabled: true,
        opacity3D: 0.42,
        opacity2D: 0.48,
        ramp: [
          'interpolate',
          ['linear'],
          ['elevation'],
          220,
          '#CBE3C8',
          450,
          '#D8E8C8',
          750,
          '#E5E6BD',
          1100,
          '#ECD6AC',
          1450,
          '#EBC39E',
          1850,
          '#F5E6D8'
        ]
      },
      hillshade: {
        method: 'multidirectional',
        directions: [315, 265, 45],
        altitudes: [30, 30, 30],
        exaggeration3D: 0.78,
        exaggeration2D: 0.88,
        shadowColors: ['#182C26', '#213830', '#293F37'],
        highlightColors: ['#FFFFFF', '#F8FAFC', '#FFF5D6'],
        accentColor: '#486A50'
      },
      contours: {
        minorColor: '#8B572A',
        minorOpacity3D: 0.46,
        minorOpacity2D: 0.54,
        majorColor: '#663814',
        majorOpacity3D: 0.78,
        majorOpacity2D: 0.86,
        labelColor: '#4A2508',
        labelHalo: 'rgba(255, 252, 245, 0.95)'
      },
      sky: {
        'sky-color': '#6BAEE6',
        'horizon-color': '#DFEEF8',
        'fog-color': '#E3EDE8',
        'fog-ground-blend': 0.30,
        'horizon-fog-blend': 0.75,
        'sky-horizon-blend': 0.65,
        'atmosphere-blend': 0.82
      },
      outsideMask: {
        color: '#172320',
        opacity: 0.25
      },
      interiorTint: {
        color: '#D97706',
        opacity: 0.035
      },
      boundary: {
        casingColor: '#1E1206',
        casingWidth: 6.0,
        glowColor: '#D97706',
        glowWidth: 11,
        glowOpacity: 0.58,
        mainColor: '#FBBF24',
        mainWidth: 3.1
      },
      labels: {
        villageColor: '#0F172A',
        villageHalo: 'rgba(255, 255, 255, 0.96)',
        peakColor: '#5C2D0C',
        peakHalo: 'rgba(255, 253, 245, 0.96)',
        riverColor: '#0369A1',
        riverHalo: 'rgba(255, 255, 255, 0.95)',
        riverLineColor: '#0284C7',
        riverGlowColor: 'rgba(2, 132, 199, 0.24)'
      }
    },
    positron: {
      terrainExaggeration: 1.62,
      colorRelief: {
        enabled: true,
        opacity3D: 0.42,
        opacity2D: 0.48,
        ramp: [
          'interpolate',
          ['linear'],
          ['elevation'],
          220,
          '#E2EBF2',
          450,
          '#DCECE4',
          800,
          '#E3EAE0',
          1200,
          '#EAE8DF',
          1600,
          '#F3EFEA',
          1880,
          '#FFFFFF'
        ]
      },
      hillshade: {
        method: 'multidirectional',
        directions: [315, 265, 45],
        altitudes: [30, 30, 30],
        exaggeration3D: 0.72,
        exaggeration2D: 0.82,
        shadowColors: ['#2C3E55', '#374B63', '#415268'],
        highlightColors: ['#FFFFFF', '#F8FAFC', '#FFFBEB'],
        accentColor: '#5B708B'
      },
      contours: {
        minorColor: '#64748B',
        minorOpacity3D: 0.28,
        minorOpacity2D: 0.35,
        majorColor: '#334155',
        majorOpacity3D: 0.52,
        majorOpacity2D: 0.60,
        labelColor: '#334155',
        labelHalo: 'rgba(255, 255, 255, 0.95)'
      },
      sky: {
        'sky-color': '#8EC2F0',
        'horizon-color': '#EFF6FF',
        'fog-color': '#F1F5F9',
        'fog-ground-blend': 0.28,
        'horizon-fog-blend': 0.74,
        'sky-horizon-blend': 0.65,
        'atmosphere-blend': 0.80
      },
      outsideMask: {
        color: '#1E293B',
        opacity: 0.22
      },
      interiorTint: {
        color: '#D97706',
        opacity: 0.03
      },
      boundary: {
        casingColor: '#1E293B',
        casingWidth: 6.2,
        glowColor: '#D97706',
        glowWidth: 10,
        glowOpacity: 0.52,
        mainColor: '#F59E0B',
        mainWidth: 3.1
      },
      labels: {
        villageColor: '#0F172A',
        villageHalo: 'rgba(255, 255, 255, 0.97)',
        peakColor: '#1E293B',
        peakHalo: 'rgba(255, 255, 255, 0.97)',
        riverColor: '#0369A1',
        riverHalo: 'rgba(255, 255, 255, 0.96)',
        riverLineColor: '#2563EB',
        riverGlowColor: 'rgba(37, 99, 235, 0.20)'
      }
    },
    satellite: {
      terrainExaggeration: 1.66,
      colorRelief: {
        enabled: false,
        opacity3D: 0,
        opacity2D: 0,
        ramp: ['interpolate', ['linear'], ['elevation'], 0, '#000000']
      },
      hillshade: {
        method: 'multidirectional',
        directions: [315, 265, 45],
        altitudes: [30, 30, 30],
        exaggeration3D: 0.48,
        exaggeration2D: 0.58,
        shadowColors: ['#040B14', '#06101E', '#081424'],
        highlightColors: ['#FFFDF5', '#F1F5F9', '#FDE68A'],
        accentColor: '#1E293B'
      },
      contours: {
        minorColor: '#E2E8F0',
        minorOpacity3D: 0.14,
        minorOpacity2D: 0.20,
        majorColor: '#FDE68A',
        majorOpacity3D: 0.32,
        majorOpacity2D: 0.40,
        labelColor: '#F8FAFC',
        labelHalo: 'rgba(6, 13, 24, 0.92)'
      },
      sky: {
        'sky-color': '#0F2542',
        'horizon-color': '#5282B8',
        'fog-color': '#233D5E',
        'fog-ground-blend': 0.24,
        'horizon-fog-blend': 0.72,
        'sky-horizon-blend': 0.65,
        'atmosphere-blend': 0.85
      },
      outsideMask: {
        color: '#07101C',
        opacity: 0.28
      },
      interiorTint: {
        color: '#E5A93C',
        opacity: 0.025
      },
      boundary: {
        casingColor: '#050B14',
        casingWidth: 5.8,
        glowColor: '#E5A93C',
        glowWidth: 11,
        glowOpacity: 0.65,
        mainColor: '#FFE082',
        mainWidth: 3.1
      },
      labels: {
        villageColor: '#FFFFFF',
        villageHalo: 'rgba(5, 11, 20, 0.96)',
        peakColor: '#FDE68A',
        peakHalo: 'rgba(5, 11, 20, 0.96)',
        riverColor: '#7DD3FC',
        riverHalo: 'rgba(5, 11, 20, 0.95)',
        riverLineColor: '#38BDF8',
        riverGlowColor: 'rgba(56, 189, 248, 0.32)'
      }
    }
  }
};

export function createSatelliteStyleObject() {
  return {
    version: 8,
    name: 'Runcu Satellite 3D',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      'esri-world-imagery': {
        type: 'raster',
        tiles: [
          'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        maxzoom: 18,
        attribution:
          'Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community'
      },
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet'
      }
    },
    layers: [
      {
        id: 'background-sat',
        type: 'background',
        paint: {
          'background-color': '#0B1522'
        }
      },
      {
        id: 'esri-satellite-layer',
        type: 'raster',
        source: 'esri-world-imagery',
        paint: {
          'raster-opacity': 1,
          'raster-contrast': 0.08,
          'raster-saturation': 0.06
        }
      },
      {
        id: 'sat-waterway',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'waterway',
        paint: {
          'line-color': '#38BDF8',
          'line-opacity': 0.65,
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1.1,
            15,
            2.8
          ]
        }
      },
      {
        id: 'sat-roads-minor',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'minor', 'service', 'track', 'path'],
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.42)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11,
            0.8,
            15,
            2.0
          ]
        }
      },
      {
        id: 'sat-roads-major',
        type: 'line',
        source: 'openmaptiles',
        'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary', 'tertiary', 'trunk'],
        paint: {
          'line-color': 'rgba(253, 230, 138, 0.72)',
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            1.4,
            15,
            3.2
          ]
        }
      }
    ]
  };
}

export const CATEGORY_META = {
  A: {
    id: 'A',
    color: '#10B981',
    glow: 'rgba(16, 185, 129, 0.45)',
    bgSubtle: 'rgba(16, 185, 129, 0.14)',
    labelRo: 'Obiective turistice',
    labelEn: 'Tourist Attractions',
    descRo: 'Naturale, locuri de interes, belvedere, trasee și zone de vizitare',
    descEn: 'Natural sites, points of interest, viewpoints, trails',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/><path d="M4.14 15.08c2.62-1.57 5.24-1.43 7.86.42 2.74 1.94 5.49 2 8.23.19"/></svg>`
  },
  B: {
    id: 'B',
    color: '#F97316',
    glow: 'rgba(249, 115, 22, 0.45)',
    bgSubtle: 'rgba(249, 115, 22, 0.14)',
    labelRo: 'Tradiții și obiceiuri',
    labelEn: 'Traditions & Customs',
    descRo: 'Sărbători, tradiții de comunitate, port popular, preparate și meșteșuguri',
    descEn: 'Celebrations, community traditions, folk costume, crafts',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 15 8l6 3-6 3-3 6-3-6-6-3 6-3 3-6z"/><circle cx="12" cy="11" r="2"/></svg>`
  },
  C: {
    id: 'C',
    color: '#EAB308',
    glow: 'rgba(234, 179, 8, 0.45)',
    bgSubtle: 'rgba(234, 179, 8, 0.14)',
    labelRo: 'Personalități locale',
    labelEn: 'Local Personalities',
    descRo: 'Oameni care au contribuit la comunitate, oameni de cultură, meșteri populari',
    descEn: 'Community contributors, cultural figures, master artisans',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polygon points="19 8 20.2 10.5 23 10.9 21 12.8 21.5 15.5 19 14.2 16.5 15.5 17 12.8 15 10.9 17.8 10.5 19 8"/></svg>`
  },
  D: {
    id: 'D',
    color: '#A855F7',
    glow: 'rgba(168, 85, 247, 0.45)',
    bgSubtle: 'rgba(168, 85, 247, 0.14)',
    labelRo: 'Poveștile comunității',
    labelEn: 'Community Stories',
    descRo: 'Legende, amintiri ale localnicilor, povești despre locuri, mărturii intergeneraționale',
    descEn: 'Legends, local memories, stories of places, oral history',
    iconSvg: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`
  }
};
