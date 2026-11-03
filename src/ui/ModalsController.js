import gsap from 'gsap';
import QRCode from 'qrcode';
import { MOTION_TOKENS, prefersReducedMotion } from '../config/tokens.js';

export class ModalsController {
  constructor({ projectMeta = {} }) {
    this.projectMeta = projectMeta;

    this.qrModalEl = document.getElementById('qr-modal');
    this.thanksModalEl = document.getElementById('thanks-modal');
    this.mapModeModalEl = document.getElementById('map-mode-modal');

    this.qrCanvasWrap = document.getElementById('qr-render-box');
    this.qrUrlDisplay = document.getElementById('qr-url-display');
    this.qrUrlInput = document.getElementById('qr-custom-url-input');
    this.qrApplyBtn = document.getElementById('qr-apply-url-btn');
    this.qrDownloadSvgBtn = document.getElementById('qr-download-svg');
    this.qrDownloadPngBtn = document.getElementById('qr-download-png');
    this.qrStatusNote = document.getElementById('qr-status-note');

    this.currentSvgString = '';
    this.currentPngDataUrl = '';
    this.activeUrl = '';
    this.currentSelectedMode = 'dark';
    this.onConfirmMode = null;

    this.bindEvents();
    this.initQrState();
  }

  isLocalhostHost(hostname = '') {
    const h = hostname.toLowerCase();
    return (
      !h ||
      h === 'localhost' ||
      h === '127.0.0.1' ||
      h === '0.0.0.0' ||
      h.endsWith('.local')
    );
  }

  initQrState() {
    const configuredUrl = (this.projectMeta?.deployUrl || '').trim();
    const browserOrigin =
      typeof window !== 'undefined' ? window.location.href.split('#')[0] : '';
    const browserHost =
      typeof window !== 'undefined' ? window.location.hostname : 'localhost';

    if (configuredUrl) {
      this.renderQrForUrl(configuredUrl);
    } else if (!this.isLocalhostHost(browserHost)) {
      this.renderQrForUrl(browserOrigin);
    } else {
      // Never generate a QR code pointing to localhost
      this.showPendingDeployUrlState();
    }
  }

  showPendingDeployUrlState() {
    this.activeUrl = '';
    this.currentSvgString = '';
    this.currentPngDataUrl = '';

    if (this.qrCanvasWrap) {
      this.qrCanvasWrap.innerHTML = `
        <div class="qr-placeholder-box">
          <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <path d="M14 14h3v3h-3zM18 18h3v3h-3zM14 19h2M19 14v2"/>
          </svg>
          <span>În așteptarea URL-ului public de deploy</span>
          <small>Conform cerințelor, nu se generează cod QR către localhost.</small>
        </div>
      `;
    }

    if (this.qrUrlDisplay) {
      this.qrUrlDisplay.textContent = 'URL final nesetat (mod local)';
    }

    if (this.qrStatusNote) {
      this.qrStatusNote.textContent =
        'Introdu mai jos URL-ul public (ex. GitHub Pages / Netlify) sau setează "project.deployUrl" în data/waypoints.json pentru a activa codul QR.';
    }

    if (this.qrDownloadSvgBtn) this.qrDownloadSvgBtn.disabled = true;
    if (this.qrDownloadPngBtn) this.qrDownloadPngBtn.disabled = true;
  }

  async renderQrForUrl(rawUrl) {
    const trimmed = (rawUrl || '').trim();
    if (!trimmed) {
      this.showPendingDeployUrlState();
      return;
    }

    let parsed;
    try {
      parsed = new URL(trimmed);
    } catch {
      if (this.qrStatusNote) {
        this.qrStatusNote.textContent =
          'Te rugăm să introduci un URL complet valid (începând cu https://).';
      }
      return;
    }

    if (this.isLocalhostHost(parsed.hostname)) {
      if (this.qrStatusNote) {
        this.qrStatusNote.textContent =
          'Generarea codului QR către localhost este dezactivată. Folosește URL-ul public de după deploy.';
      }
      this.showPendingDeployUrlState();
      return;
    }

    this.activeUrl = parsed.toString();

    const svgStr = await QRCode.toString(this.activeUrl, {
      type: 'svg',
      errorCorrectionLevel: 'H',
      margin: 2,
      color: {
        dark: '#0A0E0D',
        light: '#FFFFFF'
      }
    });

    const pngDataUrl = await QRCode.toDataURL(this.activeUrl, {
      errorCorrectionLevel: 'H',
      width: 2048,
      margin: 2,
      color: {
        dark: '#0A0E0D',
        light: '#FFFFFF'
      }
    });

    this.currentSvgString = svgStr;
    this.currentPngDataUrl = pngDataUrl;

    if (this.qrCanvasWrap) {
      this.qrCanvasWrap.innerHTML = `<div class="qr-svg-rendered">${svgStr}</div>`;
    }
    if (this.qrUrlDisplay) {
      this.qrUrlDisplay.textContent = this.activeUrl;
    }
    if (this.qrStatusNote) {
      this.qrStatusNote.textContent =
        'Scanează codul cu camera telefonului pentru a deschide harta interactivă a comunei Runcu.';
    }
    if (this.qrDownloadSvgBtn) this.qrDownloadSvgBtn.disabled = false;
    if (this.qrDownloadPngBtn) this.qrDownloadPngBtn.disabled = false;
  }

  bindEvents() {
    // Open triggers
    document
      .querySelectorAll('[data-open-modal="qr"]')
      .forEach((btn) =>
        btn.addEventListener('click', () => this.openModal(this.qrModalEl))
      );

    document
      .querySelectorAll('[data-open-modal="thanks"]')
      .forEach((btn) =>
        btn.addEventListener('click', () => this.openModal(this.thanksModalEl))
      );

    document
      .querySelectorAll('[data-open-modal="map-mode"]')
      .forEach((btn) =>
        btn.addEventListener('click', () => this.openMapModeModal())
      );

    // Close triggers
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.closeAll();
      });
    });

    [this.qrModalEl, this.thanksModalEl, this.mapModeModalEl].forEach((modal) => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAll();
      });
    });

    this.qrApplyBtn?.addEventListener('click', () => {
      const val = this.qrUrlInput?.value || '';
      this.renderQrForUrl(val);
    });

    this.qrUrlInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.renderQrForUrl(this.qrUrlInput.value);
      }
    });

    this.qrDownloadSvgBtn?.addEventListener('click', () => {
      if (!this.currentSvgString) return;
      const blob = new Blob([this.currentSvgString], {
        type: 'image/svg+xml;charset=utf-8'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'runcu-gorj-qr.svg';
      a.click();
      URL.revokeObjectURL(url);
    });

    this.qrDownloadPngBtn?.addEventListener('click', () => {
      if (!this.currentPngDataUrl) return;
      const a = document.createElement('a');
      a.href = this.currentPngDataUrl;
      a.download = 'runcu-gorj-qr-2048px.png';
      a.click();
    });
  }

  /**
   * Initializes the map mode selector cards, radio group behavior, and enter confirmation
   */
  initMapModeSelector({ onConfirmMode } = {}) {
    this.onConfirmMode = onConfirmMode;
    const cards = Array.from(document.querySelectorAll('.map-mode-card'));
    const confirmBtn = document.getElementById('btn-confirm-map-mode');

    const MODE_TITLES = {
      dark: 'Cinematic Nocturn',
      satellite: 'Satelit + Relief 3D',
      liberty: 'Explorator Topografic',
      positron: 'Editorial Luminos'
    };

    const updateSelectedMode = (modeId) => {
      if (!modeId) return;
      this.currentSelectedMode = modeId;
      cards.forEach((card) => {
        const isMatch = card.dataset.modeId === modeId;
        card.classList.toggle('is-selected', isMatch);
        card.setAttribute('aria-checked', String(isMatch));
      });
      if (confirmBtn) {
        const title = MODE_TITLES[modeId] || 'acest mod';
        confirmBtn.innerHTML = `
          <span>Explorează cu ${title}</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
        `;
      }
    };

    cards.forEach((card) => {
      card.addEventListener('click', () => {
        const modeId = card.dataset.modeId;
        updateSelectedMode(modeId);
      });

      card.addEventListener('dblclick', () => {
        const modeId = card.dataset.modeId;
        updateSelectedMode(modeId);
        this.confirmAndEnterMode();
      });

      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const modeId = card.dataset.modeId;
          updateSelectedMode(modeId);
          this.confirmAndEnterMode();
        }
      });
    });

    confirmBtn?.addEventListener('click', () => {
      this.confirmAndEnterMode();
    });

    // Initialize with current mode
    updateSelectedMode(this.currentSelectedMode || 'dark');
  }

  setSelectedMode(modeId) {
    if (!modeId) return;
    this.currentSelectedMode = modeId;
    const cards = Array.from(document.querySelectorAll('.map-mode-card'));
    cards.forEach((card) => {
      const isMatch = card.dataset.modeId === modeId;
      card.classList.toggle('is-selected', isMatch);
      card.setAttribute('aria-checked', String(isMatch));
    });
    const confirmBtn = document.getElementById('btn-confirm-map-mode');
    const MODE_TITLES = {
      dark: 'Cinematic Nocturn',
      satellite: 'Satelit + Relief 3D',
      liberty: 'Explorator Topografic',
      positron: 'Editorial Luminos'
    };
    if (confirmBtn) {
      const title = MODE_TITLES[modeId] || 'acest mod';
      confirmBtn.innerHTML = `
        <span>Explorează cu ${title}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m9 18 6-6-6-6"/></svg>
      `;
    }
  }

  confirmAndEnterMode() {
    this.closeAll();
    if (this.onConfirmMode) {
      this.onConfirmMode(this.currentSelectedMode);
    }
  }

  openMapModeModal(initialMode) {
    if (initialMode) {
      this.setSelectedMode(initialMode);
    }
    this.openModal(this.mapModeModalEl);
  }

  openQrModal() {
    this.openModal(this.qrModalEl);
  }

  openThanksModal() {
    this.openModal(this.thanksModalEl);
  }

  openModal(modalEl) {
    if (!modalEl) return;
    this.closeAll();
    modalEl.hidden = false;
    modalEl.setAttribute('aria-hidden', 'false');

    const card = modalEl.querySelector('.modal-card');
    if (!prefersReducedMotion() && card) {
      gsap.fromTo(
        modalEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.3, ease: MOTION_TOKENS.ease.outPower3 }
      );
      gsap.fromTo(
        card,
        { y: 28, scale: 0.96, opacity: 0 },
        {
          y: 0,
          scale: 1,
          opacity: 1,
          duration: 0.5,
          ease: MOTION_TOKENS.ease.outExpo
        }
      );
    }
  }

  closeAll() {
    [this.qrModalEl, this.thanksModalEl, this.mapModeModalEl].forEach((modal) => {
      if (modal && !modal.hidden) {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  isAnyOpen() {
    return (
      (this.qrModalEl && !this.qrModalEl.hidden) ||
      (this.thanksModalEl && !this.thanksModalEl.hidden) ||
      (this.mapModeModalEl && !this.mapModeModalEl.hidden)
    );
  }
}
