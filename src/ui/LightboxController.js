import gsap from 'gsap';
import { MOTION_TOKENS, prefersReducedMotion } from '../config/tokens.js';

export class LightboxController {
  constructor() {
    this.isOpen = false;
    this.photos = [];
    this.currentIndex = 0;
    this.isZoomed = false;
    this.touchStartX = 0;
    this.touchEndX = 0;

    this.rootEl = document.getElementById('lightbox-modal');
    this.imgContainerEl = document.getElementById('lightbox-stage');
    this.counterEl = document.getElementById('lightbox-counter');
    this.captionEl = document.getElementById('lightbox-caption');
    this.creditEl = document.getElementById('lightbox-credit');
    this.btnPrev = document.getElementById('lightbox-prev');
    this.btnNext = document.getElementById('lightbox-next');
    this.btnZoom = document.getElementById('lightbox-zoom');
    this.btnClose = document.getElementById('lightbox-close');

    this.bindEvents();
  }

  bindEvents() {
    if (!this.rootEl) return;

    this.btnClose?.addEventListener('click', () => this.close());
    this.btnPrev?.addEventListener('click', () => this.prev());
    this.btnNext?.addEventListener('click', () => this.next());
    this.btnZoom?.addEventListener('click', () => this.toggleZoom());

    this.rootEl.addEventListener('click', (e) => {
      if (e.target === this.rootEl || e.target === this.imgContainerEl) {
        this.close();
      }
    });

    // Touch swipe support
    this.imgContainerEl?.addEventListener(
      'touchstart',
      (e) => {
        this.touchStartX = e.changedTouches[0].screenX;
      },
      { passive: true }
    );

    this.imgContainerEl?.addEventListener(
      'touchend',
      (e) => {
        this.touchEndX = e.changedTouches[0].screenX;
        const delta = this.touchEndX - this.touchStartX;
        if (Math.abs(delta) > 45 && !this.isZoomed) {
          if (delta < 0) this.next();
          else this.prev();
        }
      },
      { passive: true }
    );
  }

  open(photos = [], startIndex = 0) {
    if (!photos || photos.length === 0 || !this.rootEl) return;
    this.photos = photos;
    this.currentIndex = Math.max(0, Math.min(startIndex, photos.length - 1));
    this.isZoomed = false;
    this.isOpen = true;

    this.rootEl.hidden = false;
    this.rootEl.setAttribute('aria-hidden', 'false');
    this.renderSlide();

    if (!prefersReducedMotion()) {
      gsap.fromTo(
        this.rootEl,
        { opacity: 0 },
        { opacity: 1, duration: 0.32, ease: MOTION_TOKENS.ease.outPower3 }
      );
    } else {
      this.rootEl.style.opacity = '1';
    }

    this.btnClose?.focus();
  }

  close() {
    if (!this.isOpen || !this.rootEl) return;
    this.isOpen = false;
    this.isZoomed = false;

    const finalize = () => {
      this.rootEl.hidden = true;
      this.rootEl.setAttribute('aria-hidden', 'true');
      if (this.imgContainerEl) this.imgContainerEl.innerHTML = '';
    };

    if (!prefersReducedMotion()) {
      gsap.to(this.rootEl, {
        opacity: 0,
        duration: 0.24,
        ease: MOTION_TOKENS.ease.outPower3,
        onComplete: finalize
      });
    } else {
      finalize();
    }
  }

  prev() {
    if (!this.isOpen || this.photos.length <= 1) return;
    this.isZoomed = false;
    this.currentIndex =
      (this.currentIndex - 1 + this.photos.length) % this.photos.length;
    this.renderSlide();
  }

  next() {
    if (!this.isOpen || this.photos.length <= 1) return;
    this.isZoomed = false;
    this.currentIndex = (this.currentIndex + 1) % this.photos.length;
    this.renderSlide();
  }

  toggleZoom() {
    if (!this.isOpen) return;
    this.isZoomed = !this.isZoomed;
    const imgEl = this.imgContainerEl?.querySelector('.lightbox-image');
    if (imgEl) {
      imgEl.classList.toggle('is-zoomed', this.isZoomed);
    }
    if (this.btnZoom) {
      this.btnZoom.setAttribute('aria-pressed', String(this.isZoomed));
      this.btnZoom.title = this.isZoomed ? 'Micșorează (1x)' : 'Mărește (2x)';
    }
  }

  renderSlide() {
    const photo = this.photos[this.currentIndex];
    if (!photo || !this.imgContainerEl) return;

    const total = this.photos.length;
    if (this.counterEl) {
      this.counterEl.textContent = `${this.currentIndex + 1} / ${total}`;
    }

    if (this.btnPrev) this.btnPrev.hidden = total <= 1;
    if (this.btnNext) this.btnNext.hidden = total <= 1;

    const avifSource = photo.srcsetAvif
      ? `<source type="image/avif" srcset="${photo.srcsetAvif}" sizes="95vw">`
      : '';
    const webpSource = photo.srcsetWebp
      ? `<source type="image/webp" srcset="${photo.srcsetWebp}" sizes="95vw">`
      : '';

    this.imgContainerEl.innerHTML = `
      <picture class="lightbox-picture">
        ${avifSource}
        ${webpSource}
        <img
          class="lightbox-image"
          src="${photo.src || photo.fallback}"
          alt="${photo.alt || ''}"
          width="${photo.width || 1600}"
          height="${photo.height || 1200}"
        />
      </picture>
    `;

    const imgEl = this.imgContainerEl.querySelector('.lightbox-image');
    imgEl?.addEventListener('dblclick', () => this.toggleZoom());

    if (!prefersReducedMotion() && imgEl) {
      gsap.fromTo(
        imgEl,
        { opacity: 0, scale: 0.96 },
        {
          opacity: 1,
          scale: 1,
          duration: 0.38,
          ease: MOTION_TOKENS.ease.outExpo
        }
      );
    }

    if (this.captionEl) {
      if (photo.caption) {
        this.captionEl.textContent = photo.caption;
        this.captionEl.hidden = false;
      } else {
        this.captionEl.hidden = true;
      }
    }

    if (this.creditEl) {
      if (photo.credit) {
        this.creditEl.textContent = `Foto / Sursă: ${photo.credit}`;
        this.creditEl.hidden = false;
      } else {
        this.creditEl.hidden = true;
      }
    }
  }
}
