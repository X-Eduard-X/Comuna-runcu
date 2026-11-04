import gsap from 'gsap';
import { MOTION_TOKENS, prefersReducedMotion } from '../config/tokens.js';

export class ModalsController {
  constructor({ projectMeta = {} } = {}) {
    this.projectMeta = projectMeta;

    this.thanksModalEl = document.getElementById('thanks-modal');
    this.mapModeModalEl = document.getElementById('map-mode-modal');

    this.currentSelectedMode = 'dark';
    this.onConfirmMode = null;

    this.bindEvents();
  }

  bindEvents() {
    // Open triggers
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

    [this.thanksModalEl, this.mapModeModalEl].forEach((modal) => {
      modal?.addEventListener('click', (e) => {
        if (e.target === modal) this.closeAll();
      });
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
    [this.thanksModalEl, this.mapModeModalEl].forEach((modal) => {
      if (modal && !modal.hidden) {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
      }
    });
  }

  isAnyOpen() {
    return (
      (this.thanksModalEl && !this.thanksModalEl.hidden) ||
      (this.mapModeModalEl && !this.mapModeModalEl.hidden)
    );
  }
}
