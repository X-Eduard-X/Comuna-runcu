import './styles/main.css';
import gsap from 'gsap';

// Ensure GSAP animations run on real wall-clock time even during heavy 3D WebGL tile rendering
gsap.ticker.lagSmoothing(0);

import {
  CATEGORY_META,
  MOTION_TOKENS,
  prefersReducedMotion
} from './config/tokens.js';
import {
  loadProjectData,
  getLocalizedWaypoint,
  isDevEnvironment
} from './utils/dataLoader.js';
import { MapController } from './map/MapController.js';
import { IntroController } from './ui/IntroController.js';
import { PanelController } from './ui/PanelController.js';
import { LightboxController } from './ui/LightboxController.js';
import { TourController } from './ui/TourController.js';
import { ModalsController } from './ui/ModalsController.js';
import { soundController } from './utils/soundController.js';

class RuncuApp {
  constructor() {
    this.data = null;
    this.waypoints = [];
    this.filteredWaypoints = [];
    this.selectedCategory = 'ALL';
    this.selectedMapStyle = 'dark';
    this.searchQuery = '';
    this.selectedWaypointId = null;
    this.lang = 'ro';
    this.isListDrawerOpen = false;
    this.isHudHidden = false;

    this.mapController = null;
    this.introController = null;
    this.panelController = null;
    this.lightboxController = null;
    this.tourController = null;
    this.modalsController = null;
  }

  async init() {
    try {
      // Temporary progress updater before IntroController is instantiated
      const updateInitialLoader = (pct, msg) => {
        const bar = document.getElementById('loading-bar-fill');
        const pctEl = document.getElementById('loading-percentage');
        const statusEl = document.getElementById('loading-status-text');
        if (bar) bar.style.width = `${pct}%`;
        if (pctEl) pctEl.textContent = `${Math.round(pct)}%`;
        if (statusEl && msg) statusEl.textContent = msg;
      };

      this.data = await loadProjectData(updateInitialLoader);
      this.waypoints = this.data.waypoints;
      this.filteredWaypoints = [...this.waypoints];

      // Initialize Intro & Loading controller
      this.introController = new IntroController({
        projectMeta: this.data.project,
        onRequestModeSelection: () => {
          this.modalsController?.openMapModeModal(this.selectedMapStyle || 'dark');
        },
        onStartJourney: () => {
          this.mapController?.enterMapCinematic();
        },
        onStartTourDirectly: () => {
          this.mapController?.enterMapCinematic(() => {
            this.tourController?.start(0);
          });
        }
      });

      await this.introController.preloadIntroAssets((pct, msg) =>
        this.introController.updateLoadingProgress(pct, msg)
      );

      // Initialize Lightbox, Panel, Modals, and Guided Tour
      this.lightboxController = new LightboxController();

      this.panelController = new PanelController({
        onClose: () => {
          this.selectedWaypointId = null;
          this.mapController?.setActiveMarker(null);
          this.syncListActiveCard();
        },
        onPrevWaypoint: () => this.navigateRelativeWaypoint(-1),
        onNextWaypoint: () => this.navigateRelativeWaypoint(1),
        onOpenLightbox: (photos, idx) => {
          this.lightboxController.open(photos, idx);
        }
      });

      this.tourController = new TourController({
        waypoints: this.waypoints,
        onSelectTourWaypoint: (wp, idx, total) => {
          this.selectWaypointById(wp.id, {
            customProgressIndex: idx,
            customProgressTotal: total
          });
        },
        onExitTour: () => {
          // Return smoothly to free exploration
        },
        onFinishTour: () => {
          this.modalsController?.openThanksModal();
        }
      });

      this.modalsController = new ModalsController({
        projectMeta: this.data.project
      });

      this.modalsController.initMapModeSelector({
        onConfirmMode: (selectedMode) => {
          this.selectedMapStyle = selectedMode;
          this.applyMapStyle(selectedMode);
          this.introController?.dismissIntro(() => {
            this.mapController?.enterMapCinematic();
          });
        }
      });

      // Setup UI controls, category filters, synchronized list, and language toggle
      this.setupCategoryChips();
      this.setupSearchAndListDrawer();
      this.setupMapControls();
      this.setupSoundControls();
      this.setupLanguageSwitcher();
      this.setupGlobalKeyboardShortcuts();
      this.renderWaypointsList();
      this.renderDevConsentBanner();

      // Prepare MapController instance without blocking the main thread during the intro sequence
      this.mapController = new MapController({
        containerId: 'map-canvas',
        boundaryGeoJson: this.data.boundaryGeoJson,
        contoursGeoJson: this.data.contoursGeoJson,
        reliefLabelsGeoJson: this.data.reliefLabelsGeoJson,
        riversGeoJson: this.data.riversGeoJson,
        waypoints: this.waypoints,
        onSelectWaypoint: (id) => {
          this.selectWaypointById(id);
        },
        onMapReady: () => {
          // Smoothly reveal the 3D background map canvas once ready
          const mapCanvasEl = document.getElementById('map-canvas');
          if (mapCanvasEl) {
            mapCanvasEl.classList.add('is-map-ready');
          }
        }
      });

      const initBackgroundMapIdle = () => {
        const startMap = () => {
          this.mapController?.init();
        };
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          window.requestIdleCallback(startMap, { timeout: 300 });
        } else {
          setTimeout(startMap, 60);
        }
      };

      // Run the single master GSAP timeline (loader exit -> intro appearance -> text animation)
      // and initialize the heavy 3D background map in idle after the sequence completes
      await this.introController.finishLoadingAndPlayIntro(() => {
        initBackgroundMapIdle();
      });
    } catch (err) {
      console.error('Initialization error:', err);
      const statusEl = document.getElementById('loading-status-text');
      if (statusEl) {
        statusEl.textContent = `Eroare la încărcarea datelor: ${err.message}`;
        statusEl.style.color = '#F87171';
      }
    }
  }

  renderDevConsentBanner() {
    const devBannerEl = document.getElementById('dev-status-pill');
    if (!devBannerEl) return;

    if (isDevEnvironment()) {
      const hiddenCount = this.data.hiddenByConsentCount || 0;
      devBannerEl.hidden = false;
      devBannerEl.textContent =
        hiddenCount > 0
          ? `Mod Dev • ${this.waypoints.length} puncte active (${hiddenCount} ascuns: consent=false)`
          : `Mod Dev • ${this.waypoints.length} puncte active`;
    } else {
      devBannerEl.hidden = true;
    }
  }

  setupLanguageSwitcher() {
    const langBtn = document.getElementById('btn-lang-switch');
    if (!langBtn) return;

    // Language switcher appears ONLY if English texts exist in data/waypoints.json
    if (!this.data.hasEn) {
      langBtn.hidden = true;
      return;
    }

    langBtn.hidden = false;
    langBtn.addEventListener('click', () => {
      this.lang = this.lang === 'ro' ? 'en' : 'ro';
      langBtn.textContent = this.lang.toUpperCase();
      this.panelController?.setLanguage(this.lang);
      this.mapController?.setLanguage(this.lang);
      this.setupCategoryChips();
      this.renderWaypointsList();
      if (this.selectedWaypointId) {
        this.selectWaypointById(this.selectedWaypointId, { skipFly: true });
      }
    });
  }

  setupCategoryChips() {
    const container = document.getElementById('category-chips-bar');
    if (!container) return;

    const counts = {
      ALL: this.waypoints.length,
      A: 0,
      B: 0,
      C: 0,
      D: 0
    };
    for (const wp of this.waypoints) {
      if (counts[wp.category] !== undefined) {
        counts[wp.category]++;
      }
    }

    const categoriesOrder = ['ALL', 'A', 'B', 'C', 'D'];
    container.innerHTML = categoriesOrder
      .map((catKey) => {
        const isActive = this.selectedCategory === catKey;
        if (catKey === 'ALL') {
          return `
            <button
              type="button"
              class="filter-chip ${isActive ? 'is-active' : ''}"
              data-category="ALL"
              aria-pressed="${isActive}"
            >
              <span class="filter-chip__label">${
                this.lang === 'en' ? 'All Points' : 'Toate'
              }</span>
              <span class="filter-chip__count">${counts.ALL}</span>
            </button>
          `;
        }

        const meta = CATEGORY_META[catKey];
        const label = this.lang === 'en' ? meta.labelEn : meta.labelRo;

        return `
          <button
            type="button"
            class="filter-chip cat-chip-${catKey.toLowerCase()} ${
          isActive ? 'is-active' : ''
        }"
            data-category="${catKey}"
            style="--chip-color: ${meta.color}; --chip-bg: ${meta.bgSubtle}"
            aria-pressed="${isActive}"
          >
            <span class="filter-chip__dot" style="background:${meta.color}"></span>
            <span class="filter-chip__code">${catKey}.</span>
            <span class="filter-chip__label">${label}</span>
            <span class="filter-chip__count">${counts[catKey]}</span>
          </button>
        `;
      })
      .join('');

    container.querySelectorAll('.filter-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cat = btn.dataset.category || 'ALL';
        this.selectedCategory = cat;
        container.querySelectorAll('.filter-chip').forEach((b) => {
          const active = b.dataset.category === cat;
          b.classList.toggle('is-active', active);
          b.setAttribute('aria-pressed', String(active));
        });
        this.applyFilters();
      });
    });
  }

  setupSearchAndListDrawer() {
    const searchInput = document.getElementById('search-waypoints-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');
    const toggleListBtn = document.getElementById('btn-toggle-list');
    const closeListBtn = document.getElementById('btn-close-list');
    const listDrawer = document.getElementById('list-drawer');

    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim();
      if (clearSearchBtn) {
        clearSearchBtn.hidden = this.searchQuery.length === 0;
      }
      this.applyFilters();
    });

    clearSearchBtn?.addEventListener('click', () => {
      if (searchInput) searchInput.value = '';
      this.searchQuery = '';
      clearSearchBtn.hidden = true;
      this.applyFilters();
      searchInput?.focus();
    });

    const setListDrawerState = (open) => {
      this.isListDrawerOpen = open;
      if (!listDrawer) return;
      listDrawer.hidden = !open;
      listDrawer.setAttribute('aria-hidden', String(!open));
      listDrawer.classList.toggle('is-open', open);
      toggleListBtn?.classList.toggle('is-active', open);
      toggleListBtn?.setAttribute('aria-expanded', String(open));

      if (open && !prefersReducedMotion()) {
        gsap.fromTo(
          listDrawer,
          { x: -30, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.42,
            ease: MOTION_TOKENS.ease.outExpo
          }
        );
      }
    };

    toggleListBtn?.addEventListener('click', () => {
      setListDrawerState(!this.isListDrawerOpen);
    });

    closeListBtn?.addEventListener('click', () => {
      setListDrawerState(false);
    });
  }

  applyFilters() {
    const q = this.searchQuery.toLowerCase();

    this.filteredWaypoints = this.waypoints.filter((wp) => {
      const catMatch =
        this.selectedCategory === 'ALL' ||
        wp.category === this.selectedCategory;
      if (!catMatch) return false;

      if (!q) return true;
      const localized = getLocalizedWaypoint(wp, this.lang);
      const catMeta = CATEGORY_META[wp.category];
      const searchable = [
        localized.title,
        localized.description,
        localized.source,
        catMeta?.labelRo,
        catMeta?.labelEn,
        wp.id
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchable.includes(q);
    });

    this.mapController?.setFilteredWaypoints(this.filteredWaypoints);
    this.renderWaypointsList();
  }

  renderWaypointsList() {
    const listContainer = document.getElementById('waypoints-list-container');
    const countBadge = document.getElementById('list-count-badge');
    if (!listContainer) return;

    if (countBadge) {
      countBadge.textContent = `${this.filteredWaypoints.length} ${
        this.filteredWaypoints.length === 1 ? 'punct' : 'puncte'
      }`;
    }

    if (this.filteredWaypoints.length === 0) {
      listContainer.innerHTML = `
        <div class="list-empty-state">
          <p>Niciun punct nu corespunde filtrului sau căutării curente.</p>
          <button type="button" class="btn-secondary" id="btn-reset-filters">Resetează filtrele</button>
        </div>
      `;
      document
        .getElementById('btn-reset-filters')
        ?.addEventListener('click', () => {
          this.selectedCategory = 'ALL';
          this.searchQuery = '';
          const searchInput = document.getElementById('search-waypoints-input');
          if (searchInput) searchInput.value = '';
          const clearBtn = document.getElementById('btn-clear-search');
          if (clearBtn) clearBtn.hidden = true;
          this.setupCategoryChips();
          this.applyFilters();
        });
      return;
    }

    const isDev = isDevEnvironment();

    listContainer.innerHTML = this.filteredWaypoints
      .map((wp) => {
        const localized = getLocalizedWaypoint(wp, this.lang);
        const catMeta = CATEGORY_META[wp.category] || CATEGORY_META.A;
        const thumb = wp.photos?.[0]?.src || wp.photos?.[0]?.fallback || '';
        const isActive = wp.id === this.selectedWaypointId;

        return `
          <article
            class="waypoint-list-card ${isActive ? 'is-active' : ''}"
            data-wp-id="${wp.id}"
            tabindex="0"
            role="button"
            aria-label="${localized.title} — Categoria ${wp.category}"
          >
            <div class="waypoint-list-card__media" style="--cat-color:${catMeta.color}">
              ${
                thumb
                  ? `<img src="${thumb}" alt="${
                      wp.photos?.[0]?.alt || ''
                    }" width="72" height="72" loading="lazy" />`
                  : `<span class="waypoint-list-card__placeholder-icon">${catMeta.iconSvg}</span>`
              }
            </div>
            <div class="waypoint-list-card__body">
              <div class="waypoint-list-card__meta">
                <span class="waypoint-list-card__cat" style="color:${catMeta.color}">
                  ${wp.category}. ${
          this.lang === 'en' ? catMeta.labelEn : catMeta.labelRo
        }
                </span>
                ${
                  isDev && wp.verified === false
                    ? `<span class="waypoint-list-card__dev">Provizoriu</span>`
                    : ''
                }
              </div>
              <h3 class="waypoint-list-card__title">${localized.title}</h3>
              <p class="waypoint-list-card__excerpt">${localized.description}</p>
            </div>
          </article>
        `;
      })
      .join('');

    listContainer.querySelectorAll('.waypoint-list-card').forEach((card) => {
      const id = card.dataset.wpId;
      card.addEventListener('mouseenter', () => {
        this.mapController?.setHoveredMarker(id);
      });
      card.addEventListener('mouseleave', () => {
        this.mapController?.setHoveredMarker(null);
      });
      card.addEventListener('click', () => {
        this.selectWaypointById(id);
        if (window.innerWidth < 768) {
          // On phones, close list drawer so bottom sheet & map are visible
          const closeListBtn = document.getElementById('btn-close-list');
          closeListBtn?.click();
        }
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.selectWaypointById(id);
        }
      });
    });
  }

  syncListActiveCard() {
    const cards = document.querySelectorAll('.waypoint-list-card');
    cards.forEach((card) => {
      card.classList.toggle(
        'is-active',
        card.dataset.wpId === this.selectedWaypointId
      );
    });
  }

  selectWaypointById(
    waypointId,
    { skipFly = false, customProgressIndex = null, customProgressTotal = null } = {}
  ) {
    const wp = this.waypoints.find((w) => w.id === waypointId);
    if (!wp) return;

    this.selectedWaypointId = wp.id;
    this.syncListActiveCard();

    if (!skipFly) {
      this.mapController?.flyToWaypoint(wp);
    } else {
      this.mapController?.setActiveMarker(wp.id);
    }

    const activeList =
      this.filteredWaypoints.length > 0
        ? this.filteredWaypoints
        : this.waypoints;
    const listIdx = activeList.findIndex((w) => w.id === wp.id);

    const index =
      customProgressIndex !== null
        ? customProgressIndex
        : Math.max(0, listIdx);
    const total =
      customProgressTotal !== null ? customProgressTotal : activeList.length;

    this.panelController?.open(wp, { index, total });
  }

  navigateRelativeWaypoint(direction = 1) {
    // If Guided Tour is active, use tour navigation
    if (this.tourController?.isActive) {
      if (direction > 0) this.tourController.next();
      else this.tourController.prev();
      return;
    }

    const list =
      this.filteredWaypoints.length > 0
        ? this.filteredWaypoints
        : this.waypoints;
    if (list.length === 0) return;

    const currentIdx = list.findIndex((w) => w.id === this.selectedWaypointId);
    const nextIdx =
      currentIdx === -1
        ? 0
        : (currentIdx + direction + list.length) % list.length;

    this.selectWaypointById(list[nextIdx].id);
  }

  applyMapStyle(styleId) {
    if (!styleId) return;
    this.selectedMapStyle = styleId;
    const styleButtons = document.querySelectorAll('[data-map-style]');
    styleButtons.forEach((b) => {
      const active = b.dataset.mapStyle === styleId;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', String(active));
    });
    this.modalsController?.setSelectedMode(styleId);
    this.mapController?.setStyle(styleId);
  }

  setupMapControls() {
    const resetViewBtn = document.getElementById('btn-reset-view');
    const toggle3DBtn = document.getElementById('btn-toggle-3d');
    const styleButtons = document.querySelectorAll('[data-map-style]');
    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    const toggleHudBtn = document.getElementById('btn-toggle-hud');
    const restoreHudBtn = document.getElementById('btn-restore-hud');

    resetViewBtn?.addEventListener('click', () => {
      this.panelController?.close();
      this.selectedWaypointId = null;
      this.syncListActiveCard();
      this.mapController?.resetView();
    });

    toggle3DBtn?.addEventListener('click', () => {
      const enabled = this.mapController?.toggle3D();
      toggle3DBtn.classList.toggle('is-active', Boolean(enabled));
      toggle3DBtn.setAttribute('aria-pressed', String(Boolean(enabled)));
    });

    styleButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const styleId = btn.dataset.mapStyle;
        if (!styleId) return;
        this.applyMapStyle(styleId);
      });
    });

    fullscreenBtn?.addEventListener('click', () => {
      this.toggleFullscreen();
    });

    toggleHudBtn?.addEventListener('click', () => {
      this.toggleCleanHud();
    });

    restoreHudBtn?.addEventListener('click', () => {
      this.toggleCleanHud(false);
    });
  }

  setupSoundControls() {
    const soundButtons = document.querySelectorAll('.btn-toggle-sound');

    const updateSoundUI = (muted) => {
      soundButtons.forEach((btn) => {
        const iconOn = btn.querySelector('.sound-icon-on');
        const iconOff = btn.querySelector('.sound-icon-off');
        if (iconOn) iconOn.style.display = muted ? 'none' : 'block';
        if (iconOff) iconOff.style.display = muted ? 'block' : 'none';
        btn.classList.toggle('is-muted', muted);
        btn.setAttribute('aria-pressed', String(!muted));
        btn.title = muted
          ? 'Sunet interfață (Dezactivat - Click pentru activare)'
          : 'Sunet interfață (Activat - Click pentru mut)';
      });
    };

    updateSoundUI(soundController.isMuted());

    soundButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const muted = soundController.toggleMute();
        updateSoundUI(muted);
      });
    });
  }

  toggleFullscreen() {
    const fullscreenBtn = document.getElementById('btn-toggle-fullscreen');
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      fullscreenBtn?.classList.add('is-active');
    } else {
      document.exitFullscreen?.().catch(() => {});
      fullscreenBtn?.classList.remove('is-active');
    }
  }

  toggleCleanHud(forceState) {
    this.isHudHidden =
      typeof forceState === 'boolean' ? forceState : !this.isHudHidden;
    document.body.classList.toggle('is-hud-hidden', this.isHudHidden);

    const restoreBtn = document.getElementById('btn-restore-hud');
    if (restoreBtn) {
      restoreBtn.hidden = !this.isHudHidden;
    }
  }

  setupGlobalKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      const isTyping =
        tag === 'input' ||
        tag === 'textarea' ||
        document.activeElement?.isContentEditable;

      // 1. If Lightbox is open, delegate keyboard to Lightbox
      if (this.lightboxController?.isOpen) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.lightboxController.close();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.lightboxController.next();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.lightboxController.prev();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          this.lightboxController.toggleZoom();
        }
        return;
      }

      // 2. If QR or Thanks modal is open, Escape closes it
      if (this.modalsController?.isAnyOpen()) {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.modalsController.closeAll();
        }
        return;
      }

      if (isTyping) {
        if (e.key === 'Escape') {
          document.activeElement?.blur();
        }
        return;
      }

      // 3. Presentation & Guided Tour shortcuts
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          this.navigateRelativeWaypoint(1);
          break;

        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          this.navigateRelativeWaypoint(-1);
          break;

        case ' ':
          // Space advances to next point when in Guided Tour or when detail panel is open
          if (this.tourController?.isActive || this.panelController?.isOpen) {
            e.preventDefault();
            this.navigateRelativeWaypoint(1);
          }
          break;

        case 'Escape':
          if (this.isHudHidden) {
            this.toggleCleanHud(false);
          } else if (this.tourController?.isActive) {
            this.tourController.stop();
          } else if (this.panelController?.isOpen) {
            this.panelController.close();
            this.selectedWaypointId = null;
            this.mapController?.setActiveMarker(null);
            this.syncListActiveCard();
          }
          break;

        case 'f':
        case 'F':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.toggleFullscreen();
          }
          break;

        case 'h':
        case 'H':
          if (!e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            this.toggleCleanHud();
          }
          break;

        default:
          break;
      }
    });
  }
}

const bootApp = () => {
  const app = new RuncuApp();
  app.init();
};

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
