import gsap from 'gsap';
import {
  CATEGORY_META,
  MOTION_TOKENS,
  prefersReducedMotion
} from '../config/tokens.js';
import { getLocalizedWaypoint, isDevEnvironment } from '../utils/dataLoader.js';

export class PanelController {
  constructor({
    onClose,
    onPrevWaypoint,
    onNextWaypoint,
    onOpenLightbox
  }) {
    this.onClose = onClose;
    this.onPrevWaypoint = onPrevWaypoint;
    this.onNextWaypoint = onNextWaypoint;
    this.onOpenLightbox = onOpenLightbox;

    this.panelEl = document.getElementById('detail-panel');
    this.scrollBodyEl = document.getElementById('detail-panel-body');
    this.closeBtn = document.getElementById('detail-close-btn');
    this.dragHandle = document.getElementById('detail-drag-handle');
    this.prevBtn = document.getElementById('detail-prev-btn');
    this.nextBtn = document.getElementById('detail-next-btn');
    this.progressTextEl = document.getElementById('detail-progress-text');
    this.progressFillEl = document.getElementById('detail-progress-fill');

    this.currentWaypoint = null;
    this.activeGalleryIndex = 0;
    this.isOpen = false;
    this.isSheetExpanded = false;
    this.lang = 'ro';

    this.bindEvents();
  }

  bindEvents() {
    this.closeBtn?.addEventListener('click', () => {
      this.close();
      if (this.onClose) this.onClose();
    });

    this.prevBtn?.addEventListener('click', () => {
      if (this.onPrevWaypoint) this.onPrevWaypoint();
    });

    this.nextBtn?.addEventListener('click', () => {
      if (this.onNextWaypoint) this.onNextWaypoint();
    });

    // Mobile bottom sheet toggle expand/collapse on drag handle tap or swipe
    if (this.dragHandle) {
      let startY = 0;
      this.dragHandle.addEventListener('click', () => {
        this.isSheetExpanded = !this.isSheetExpanded;
        this.panelEl?.classList.toggle(
          'is-sheet-expanded',
          this.isSheetExpanded
        );
      });

      this.dragHandle.addEventListener(
        'touchstart',
        (e) => {
          startY = e.changedTouches[0].clientY;
        },
        { passive: true }
      );

      this.dragHandle.addEventListener(
        'touchend',
        (e) => {
          const endY = e.changedTouches[0].clientY;
          const deltaY = endY - startY;
          if (deltaY < -35) {
            this.isSheetExpanded = true;
            this.panelEl?.classList.add('is-sheet-expanded');
          } else if (deltaY > 45) {
            if (this.isSheetExpanded) {
              this.isSheetExpanded = false;
              this.panelEl?.classList.remove('is-sheet-expanded');
            } else {
              this.close();
              if (this.onClose) this.onClose();
            }
          }
        },
        { passive: true }
      );
    }
  }

  setLanguage(lang) {
    this.lang = lang;
  }

  open(wp, { index = 0, total = 1 } = {}) {
    if (!wp || !this.panelEl || !this.scrollBodyEl) return;

    const localized = getLocalizedWaypoint(wp, this.lang);
    this.currentWaypoint = localized;
    this.activeGalleryIndex = 0;
    this.isOpen = true;

    this.panelEl.hidden = false;
    this.panelEl.setAttribute('aria-hidden', 'false');
    this.panelEl.classList.add('is-open');

    this.renderContent(localized);
    this.updateProgress(index, total);

    this.scrollBodyEl.scrollTop = 0;

    if (!prefersReducedMotion()) {
      const isMobile = window.innerWidth < 960;
      gsap.fromTo(
        this.panelEl,
        isMobile ? { y: 80, opacity: 0 } : { x: 60, opacity: 0 },
        {
          x: 0,
          y: 0,
          opacity: 1,
          duration: MOTION_TOKENS.duration.ui,
          ease: MOTION_TOKENS.ease.outExpo,
          clearProps: 'transform'
        }
      );

      // Stagger internal sections
      const staggerItems = this.scrollBodyEl.querySelectorAll('.stagger-item');
      if (staggerItems.length > 0) {
        gsap.fromTo(
          staggerItems,
          { y: 18, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.55,
            stagger: 0.065,
            delay: 0.12,
            ease: MOTION_TOKENS.ease.outPower3
          }
        );
      }
    }
  }

  close() {
    if (!this.isOpen || !this.panelEl) return;
    this.isOpen = false;
    this.isSheetExpanded = false;
    this.panelEl.classList.remove('is-open', 'is-sheet-expanded');

    // Pause any active audio/video inside panel
    this.scrollBodyEl
      ?.querySelectorAll('audio, video')
      .forEach((media) => media.pause());

    const finalize = () => {
      this.panelEl.hidden = true;
      this.panelEl.setAttribute('aria-hidden', 'true');
    };

    if (!prefersReducedMotion()) {
      const isMobile = window.innerWidth < 960;
      gsap.to(this.panelEl, {
        x: isMobile ? 0 : 40,
        y: isMobile ? 60 : 0,
        opacity: 0,
        duration: 0.35,
        ease: MOTION_TOKENS.ease.outPower3,
        onComplete: () => {
          gsap.set(this.panelEl, { clearProps: 'transform,opacity' });
          finalize();
        }
      });
    } else {
      finalize();
    }
  }

  updateProgress(index, total) {
    const safeTotal = Math.max(1, total);
    const currentNum = index + 1;
    if (this.progressTextEl) {
      this.progressTextEl.textContent =
        this.lang === 'en'
          ? `Waypoint ${currentNum} of ${safeTotal}`
          : `Punctul ${currentNum} din ${safeTotal}`;
    }
    if (this.progressFillEl) {
      const pct = Math.round((currentNum / safeTotal) * 100);
      this.progressFillEl.style.width = `${pct}%`;
    }
  }

  renderContent(wp) {
    const catMeta = CATEGORY_META[wp.category] || CATEGORY_META.A;
    const isDev = isDevEnvironment();
    const photos = Array.isArray(wp.photos) ? wp.photos : [];
    const heroPhoto = photos[0] || null;
    const [lng, lat] = wp.coordinates || [0, 0];

    // Dev badge for unverified provisional locations
    const devBadgeHtml =
      isDev && wp.verified === false
        ? `<div class="detail-dev-badge stagger-item" title="Vizibil doar în modul dev (verified: false)">
            <span class="detail-dev-badge__dot"></span>
            Locație provizorie (coordonate și texte în curs de verificare)
          </div>`
        : '';

    // Hero Image with Ken Burns effect (only if photo exists)
    let heroHtml = '';
    if (heroPhoto) {
      const avifSource = heroPhoto.srcsetAvif
        ? `<source type="image/avif" srcset="${heroPhoto.srcsetAvif}" sizes="(max-width: 960px) 94vw, 440px">`
        : '';
      const webpSource = heroPhoto.srcsetWebp
        ? `<source type="image/webp" srcset="${heroPhoto.srcsetWebp}" sizes="(max-width: 960px) 94vw, 440px">`
        : '';

      heroHtml = `
        <div class="detail-hero stagger-item">
          <div class="detail-hero__frame" id="detail-hero-trigger" role="button" tabindex="0" aria-label="Deschide imaginea pe tot ecranul">
            <picture>
              ${avifSource}
              ${webpSource}
              <img
                class="detail-hero__img ken-burns-img"
                src="${heroPhoto.src || heroPhoto.fallback}"
                alt="${heroPhoto.alt || ''}"
                width="${heroPhoto.width || 1600}"
                height="${heroPhoto.height || 1200}"
                loading="eager"
              />
            </picture>
            <div class="detail-hero__overlay">
              <span class="detail-hero__zoom-hint">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                Fullscreen (${photos.length} ${
        photos.length === 1 ? 'foto' : 'fotografii'
      })
              </span>
            </div>
          </div>
          ${
            heroPhoto.caption
              ? `<p class="detail-hero__caption">${heroPhoto.caption}</p>`
              : ''
          }
        </div>
      `;
    }

    // Description paragraphs (only if description exists)
    const paragraphs = String(wp.description || '')
      .split(/\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    const descriptionHtml =
      paragraphs.length > 0
        ? `<div class="detail-description">
            ${paragraphs
              .map(
                (p) => `<p class="detail-description__p stagger-item">${p}</p>`
              )
              .join('')}
          </div>`
        : '';

    // Gallery Carousel (when photos exist)
    let galleryHtml = '';
    if (photos.length > 0) {
      const thumbsHtml = photos
        .map(
          (p, idx) => `
          <button
            type="button"
            class="gallery-thumb ${idx === 0 ? 'is-active' : ''}"
            data-photo-idx="${idx}"
            aria-label="Fotografia ${idx + 1} din ${photos.length}"
          >
            <img
              src="${p.src || p.fallback}"
              alt="${p.alt || ''}"
              width="120"
              height="90"
              loading="lazy"
            />
          </button>
        `
        )
        .join('');

      galleryHtml = `
        <section class="detail-section detail-gallery stagger-item" aria-label="Galerie foto">
          <div class="detail-section__header">
            <h3 class="detail-section__title">
              ${this.lang === 'en' ? 'Photo Gallery' : 'Galerie foto'}
            </h3>
            <span class="detail-section__meta">${photos.length} ${
        photos.length === 1 ? 'imagine' : 'imagini'
      }</span>
          </div>
          <div class="gallery-carousel" id="panel-gallery-carousel">
            <div class="gallery-thumbs">
              ${thumbsHtml}
            </div>
            <button type="button" class="btn-secondary btn-open-lightbox" id="btn-open-gallery-lightbox">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
              ${
                this.lang === 'en'
                  ? 'Open Fullscreen Lightbox'
                  : 'Deschide galeria pe tot ecranul'
              }
            </button>
          </div>
        </section>
      `;
    }

    // Optional Stylized Audio Player
    let audioHtml = '';
    if (wp.audio && typeof wp.audio === 'string' && wp.audio.trim().length > 0) {
      audioHtml = `
        <section class="detail-section detail-audio stagger-item" aria-label="Înregistrare audio">
          <div class="detail-section__header">
            <h3 class="detail-section__title">
              ${
                this.lang === 'en'
                  ? 'Audio Testimony / Guide'
                  : 'Mărturie / Ghid Audio'
              }
            </h3>
          </div>
          <div class="custom-audio-player">
            <audio controls preload="metadata" src="${wp.audio}" class="native-audio-el">
              Browserul tău nu suportă redarea audio.
            </audio>
          </div>
        </section>
      `;
    }

    // Optional Video Player
    let videoHtml = '';
    if (wp.video && typeof wp.video === 'string' && wp.video.trim().length > 0) {
      videoHtml = `
        <section class="detail-section detail-video stagger-item" aria-label="Material video">
          <div class="detail-section__header">
            <h3 class="detail-section__title">
              ${this.lang === 'en' ? 'Video Material' : 'Secvență Video'}
            </h3>
          </div>
          <div class="custom-video-wrapper">
            <video controls preload="metadata" playsinline src="${wp.video}" class="native-video-el"></video>
          </div>
        </section>
      `;
    }

    // Mandatory Source at the bottom (with clickable external URLs)
    const formatSourceWithLinks = (rawSource) => {
      const escaped = String(rawSource || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      return escaped.replace(
        /(https?:\/\/[^\s)]+)/g,
        '<a href="$1" target="_blank" rel="noopener noreferrer" class="detail-source__link">$1</a>'
      );
    };

    const sourceHtml = wp.source
      ? `
        <footer class="detail-source stagger-item">
          <span class="detail-source__label">
            ${
              this.lang === 'en' ? 'Information Source' : 'Sursa informației'
            }
          </span>
          <p class="detail-source__value">${formatSourceWithLinks(wp.source)}</p>
        </footer>
      `
      : '';

    const proximityBadgeHtml = wp.proximityBadge
      ? `<span class="detail-proximity-badge" title="Punct situat în imediata vecinătate a conturului administrativ al comunei Runcu">${wp.proximityBadge}</span>`
      : '';

    this.scrollBodyEl.innerHTML = `
      <div class="detail-header stagger-item">
        <div class="detail-cat-row">
          <span class="detail-cat-pill" style="--cat-color:${catMeta.color}; --cat-bg:${catMeta.bgSubtle}">
            <span class="detail-cat-pill__icon">${catMeta.iconSvg}</span>
            <span>Cat. ${wp.category} • ${
      this.lang === 'en' ? catMeta.labelEn : catMeta.labelRo
    }</span>
          </span>
          ${proximityBadgeHtml}
          <span class="detail-coords" title="Coordonate GPS (OpenStreetMap / Comuna Runcu, Jud. Gorj)">
            ${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E
          </span>
        </div>
        <h2 class="detail-title">${wp.title}</h2>
      </div>
      ${devBadgeHtml}
      ${heroHtml}
      ${descriptionHtml}
      ${galleryHtml}
      ${audioHtml}
      ${videoHtml}
      ${sourceHtml}
    `;

    // Bind hero and gallery triggers to Lightbox
    const heroTrigger = document.getElementById('detail-hero-trigger');
    heroTrigger?.addEventListener('click', () => {
      if (this.onOpenLightbox) {
        this.onOpenLightbox(photos, this.activeGalleryIndex);
      }
    });
    heroTrigger?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (this.onOpenLightbox) {
          this.onOpenLightbox(photos, this.activeGalleryIndex);
        }
      }
    });

    const openGalleryBtn = document.getElementById('btn-open-gallery-lightbox');
    openGalleryBtn?.addEventListener('click', () => {
      if (this.onOpenLightbox) {
        this.onOpenLightbox(photos, this.activeGalleryIndex);
      }
    });

    const thumbButtons = this.scrollBodyEl.querySelectorAll('.gallery-thumb');
    thumbButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.photoIdx || 0);
        this.activeGalleryIndex = idx;
        thumbButtons.forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');

        // Also update hero image if multiple photos exist
        const chosen = photos[idx];
        const heroImg = this.scrollBodyEl.querySelector('.detail-hero__img');
        if (chosen && heroImg) {
          heroImg.src = chosen.src || chosen.fallback;
          heroImg.alt = chosen.alt || '';
        }
        // Double click or direct click opens lightbox when clicking already active thumb
        if (this.onOpenLightbox) {
          this.onOpenLightbox(photos, idx);
        }
      });
    });
  }
}
