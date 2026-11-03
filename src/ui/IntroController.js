import gsap from 'gsap';
import { MOTION_TOKENS, prefersReducedMotion } from '../config/tokens.js';

export class IntroController {
  constructor({
    projectMeta,
    onStartJourney,
    onStartTourDirectly,
    onRequestModeSelection,
    onEnterMap,
    onStartGuidedTour
  } = {}) {
    this.projectMeta = projectMeta || {};
    this.onStartJourney = onStartJourney || onEnterMap;
    this.onStartTourDirectly = onStartTourDirectly || onStartGuidedTour;
    this.onRequestModeSelection = onRequestModeSelection;

    this.loaderEl = document.getElementById('loading-screen');
    this.loaderInnerEl = this.loaderEl?.querySelector('.loading-screen__inner');
    this.barFillEl = document.getElementById('loading-bar-fill');
    this.statusTextEl = document.getElementById('loading-status-text');
    this.percentageEl = document.getElementById('loading-percentage');

    this.introEl = document.getElementById('intro-screen');
    this.heroBgEl = document.getElementById('intro-hero-bg-img');
    this.coverFrameEl = document.getElementById('intro-cover-frame');
    this.enterMapBtn = document.getElementById('btn-enter-map');
    this.startTourBtn = document.getElementById('btn-intro-tour');

    this.currentProgress = 8;
    this.isIntroActive = true;
    this.hasPlayedIntro = false;
    this.coverDecodePromise = Promise.resolve();
    this.heroBgDecodePromise = Promise.resolve();
    this.masterTimeline = null;

    this.bindEvents();
  }

  bindEvents() {
    this.enterMapBtn?.addEventListener('click', () => {
      if (this.onRequestModeSelection) {
        this.onRequestModeSelection();
      } else {
        this.dismissIntro(() => {
          if (this.onStartJourney) this.onStartJourney();
        });
      }
    });

    this.startTourBtn?.addEventListener('click', () => {
      this.dismissIntro(() => {
        if (this.onStartTourDirectly) this.onStartTourDirectly();
      });
    });
  }

  /**
   * Updates real loading progress bar & percentage
   */
  updateLoadingProgress(percent, statusMessage) {
    this.currentProgress = Math.max(
      this.currentProgress,
      Math.min(100, Math.round(percent))
    );
    if (this.barFillEl) {
      this.barFillEl.style.width = `${this.currentProgress}%`;
    }
    if (this.percentageEl) {
      this.percentageEl.textContent = `${this.currentProgress}%`;
    }
    if (statusMessage && this.statusTextEl) {
      this.statusTextEl.textContent = statusMessage;
    }
  }

  setProgress(percent, statusMessage) {
    this.updateLoadingProgress(percent, statusMessage);
  }

  /**
   * Injects the cover photo (5.jpg -> Runcu, județul Gorj sign) into the Intro card
   * and returns a promise that resolves once the image is decoded so there is zero layout shift.
   */
  renderCoverPhoto(coverPhoto) {
    const cover = coverPhoto || this.projectMeta?.introCover;
    if (!this.coverFrameEl || !cover) {
      this.coverDecodePromise = Promise.resolve();
      return this.coverDecodePromise;
    }

    const avifSource = cover.srcsetAvif
      ? `<source type="image/avif" srcset="${cover.srcsetAvif}" sizes="(max-width: 960px) 85vw, 380px">`
      : '';
    const webpSource = cover.srcsetWebp
      ? `<source type="image/webp" srcset="${cover.srcsetWebp}" sizes="(max-width: 960px) 85vw, 380px">`
      : '';

    this.coverFrameEl.innerHTML = `
      <picture>
        ${avifSource}
        ${webpSource}
        <img
          id="intro-cover-img"
          class="intro-cover__img"
          src="${cover.src || cover.fallback}"
          alt="${cover.alt || 'Runcu, județul Gorj'}"
          width="${cover.width || 1600}"
          height="${cover.height || 2143}"
          loading="eager"
          fetchpriority="high"
          decoding="sync"
        />
      </picture>
      <div class="intro-cover__badge">
        <span class="intro-cover__dot"></span>
        <span>${cover.caption || 'Runcu, județul Gorj'}</span>
      </div>
    `;

    const imgEl = this.coverFrameEl.querySelector('#intro-cover-img');
    if (imgEl && typeof imgEl.decode === 'function') {
      this.coverDecodePromise = Promise.race([
        imgEl.decode().catch(() => {}),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } else {
      this.coverDecodePromise = Promise.resolve();
    }

    return this.coverDecodePromise;
  }

  /**
   * Preloads & decodes critical intro cover image, hero backdrop, and waits for document.fonts.ready
   * BEFORE the master timeline starts, preventing any reflow or text re-split.
   */
  async preloadIntroAssets(onProgress) {
    if (onProgress) {
      onProgress(76, 'Se încarcă fonturile și fotografia de copertă...');
    }

    const decodePromise = this.renderCoverPhoto(this.projectMeta?.introCover);

    const heroBgPromise =
      this.heroBgEl && typeof this.heroBgEl.decode === 'function'
        ? Promise.race([
            this.heroBgEl.decode().catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 1200))
          ])
        : Promise.resolve();
    this.heroBgDecodePromise = heroBgPromise;

    const fontsPromise =
      typeof document !== 'undefined' && document.fonts?.ready
        ? Promise.race([
            document.fonts.ready.catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 1500))
          ])
        : Promise.resolve();

    await Promise.all([decodePromise, heroBgPromise, fontsPromise]);

    if (onProgress) {
      onProgress(94, 'Resursele vizuale sunt pregătite...');
    }
  }

  /**
   * Single Master GSAP Timeline controlling:
   * 1. Loader exit (#loading-screen)
   * 2. Intro container appearance (#intro-screen)
   * 3. Headline words (.reveal-word__inner), UI blocks (.intro-stagger) & cover card (.intro-visual-card)
   * with tight overlap (0.04s between intro appearance and text animation) and zero pauses.
   *
   * Note: Initial states of .intro-screen, .reveal-word__inner, .intro-stagger, and .intro-visual-card
   * are strictly hidden in CSS (opacity: 0; visibility: hidden; transform: ...).
   */
  async finishLoadingAndPlayIntro(onTimelineComplete) {
    if (this.hasPlayedIntro) return;
    this.hasPlayedIntro = true;

    this.updateLoadingProgress(100, 'Bun venit în Comuna Runcu!');

    // Ensure fonts, cover decode, and hero backdrop decode are settled before starting timeline
    await Promise.all([
      this.coverDecodePromise,
      this.heroBgDecodePromise,
      typeof document !== 'undefined' && document.fonts?.ready
        ? Promise.race([
            document.fonts.ready.catch(() => {}),
            new Promise((resolve) => setTimeout(resolve, 600))
          ])
        : Promise.resolve()
    ]);

    const words = this.introEl
      ? Array.from(this.introEl.querySelectorAll('.reveal-word__inner'))
      : [];
    const staggerBlocks = this.introEl
      ? Array.from(this.introEl.querySelectorAll('.intro-stagger'))
      : [];
    const visualCard = this.introEl?.querySelector('.intro-visual-card');

    if (this.introEl) {
      this.introEl.hidden = false;
      this.introEl.setAttribute('aria-hidden', 'false');
      this.introEl.style.pointerEvents = 'auto';
    }

    if (prefersReducedMotion()) {
      if (this.loaderEl) {
        this.loaderEl.style.display = 'none';
        this.loaderEl.hidden = true;
      }
      if (this.introEl) {
        gsap.set(this.introEl, { autoAlpha: 1 });
      }
      gsap.set([words, staggerBlocks, visualCard].filter(Boolean), {
        autoAlpha: 1,
        y: 0,
        rotateZ: 0,
        scale: 1
      });
      if (onTimelineComplete) onTimelineComplete();
      return;
    }

    if (this.masterTimeline) {
      this.masterTimeline.kill();
    }

    const tl = gsap.timeline({
      defaults: { overwrite: 'auto' },
      onComplete: () => {
        if (onTimelineComplete) onTimelineComplete();
      }
    });
    this.masterTimeline = tl;

    // 1. Loader inner content gently lifts & fades out at t = 0.00s
    if (this.loaderInnerEl) {
      tl.to(
        this.loaderInnerEl,
        {
          autoAlpha: 0,
          y: -14,
          scale: 0.98,
          duration: 0.34,
          ease: 'power2.inOut'
        },
        0
      );
    }

    // 2. Loader backdrop crossfades out at t = 0.06s
    if (this.loaderEl) {
      tl.to(
        this.loaderEl,
        {
          autoAlpha: 0,
          duration: 0.46,
          ease: 'power2.inOut',
          onComplete: () => {
            if (this.loaderEl) {
              this.loaderEl.style.display = 'none';
              this.loaderEl.hidden = true;
            }
          }
        },
        0.06
      );
    }

    // 3. Intro screen container becomes visible at t = 0.10s (overlapping loader exit)
    if (this.introEl) {
      tl.to(
        this.introEl,
        {
          autoAlpha: 1,
          duration: 0.38,
          ease: 'power2.out'
        },
        0.1
      );
    }

    // 4. Headline words animate in immediately at t = 0.14s (0.04s overlap with intro appearance!)
    //    Animating directly from their CSS-hidden state (opacity: 0; visibility: hidden; translate3d(0, 115%, 0) rotateZ(2deg))
    if (words.length > 0) {
      tl.to(
        words,
        {
          autoAlpha: 1,
          y: 0,
          rotateZ: 0,
          duration: 0.82,
          stagger: 0.065,
          ease: MOTION_TOKENS.ease.outExpo
        },
        0.14
      );
    }

    // 5. Staggered UI elements (topbar logos, eyebrow, lead text, CTA buttons, categories) at t = 0.20s
    if (staggerBlocks.length > 0) {
      tl.to(
        staggerBlocks,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.72,
          stagger: 0.065,
          ease: MOTION_TOKENS.ease.outPower3
        },
        0.2
      );
    }

    // 6. Visual cover card scales & glides in at t = 0.22s
    if (visualCard) {
      tl.to(
        visualCard,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.88,
          ease: MOTION_TOKENS.ease.outExpo
        },
        0.22
      );
    }
  }

  /**
   * Dismisses the Intro screen with scale/fade and triggers map entry
   */
  dismissIntro(callback) {
    if (!this.isIntroActive || !this.introEl) {
      if (callback) callback();
      return;
    }
    this.isIntroActive = false;

    if (this.masterTimeline) {
      this.masterTimeline.progress(1);
    }

    if (prefersReducedMotion()) {
      this.introEl.style.pointerEvents = 'none';
      gsap.set(this.introEl, { autoAlpha: 0 });
      this.introEl.hidden = true;
      this.introEl.setAttribute('aria-hidden', 'true');
      if (callback) callback();
      return;
    }

    this.introEl.style.pointerEvents = 'none';

    // Trigger map flyTo concurrently as the cover dissolves
    if (callback) callback();

    gsap.to(this.introEl, {
      autoAlpha: 0,
      scale: 1.03,
      duration: 0.85,
      ease: MOTION_TOKENS.ease.inOutCubic,
      onComplete: () => {
        if (this.introEl) {
          this.introEl.hidden = true;
          this.introEl.setAttribute('aria-hidden', 'true');
          gsap.set(this.introEl, { scale: 1 });
        }
      }
    });
  }

  /**
   * Re-opens the Intro screen when user clicks the top-left Runcu brand button
   */
  reopenIntro() {
    if (!this.introEl) return;
    this.isIntroActive = true;
    this.introEl.hidden = false;
    this.introEl.setAttribute('aria-hidden', 'false');
    this.introEl.style.pointerEvents = 'auto';

    const words = Array.from(
      this.introEl.querySelectorAll('.reveal-word__inner')
    );
    const staggerBlocks = Array.from(
      this.introEl.querySelectorAll('.intro-stagger')
    );
    const visualCard = this.introEl.querySelector('.intro-visual-card');

    if (prefersReducedMotion()) {
      gsap.set(this.introEl, { autoAlpha: 1, scale: 1 });
      gsap.set([words, staggerBlocks, visualCard].filter(Boolean), {
        autoAlpha: 1,
        y: 0,
        rotateZ: 0,
        scale: 1
      });
      return;
    }

    // Reset elements to initial hidden state before replaying reveal
    gsap.set(words, { autoAlpha: 0, y: '115%', rotateZ: 2 });
    gsap.set(staggerBlocks, { autoAlpha: 0, y: 22 });
    if (visualCard) {
      gsap.set(visualCard, { autoAlpha: 0, y: 32, scale: 0.94 });
    }

    const tl = gsap.timeline({ defaults: { overwrite: 'auto' } });
    tl.fromTo(
      this.introEl,
      { autoAlpha: 0, scale: 1.02 },
      {
        autoAlpha: 1,
        scale: 1,
        duration: 0.42,
        ease: MOTION_TOKENS.ease.outPower3
      },
      0
    );
    if (words.length > 0) {
      tl.to(
        words,
        {
          autoAlpha: 1,
          y: 0,
          rotateZ: 0,
          duration: 0.78,
          stagger: 0.06,
          ease: MOTION_TOKENS.ease.outExpo
        },
        0.06
      );
    }
    if (staggerBlocks.length > 0) {
      tl.to(
        staggerBlocks,
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.68,
          stagger: 0.06,
          ease: MOTION_TOKENS.ease.outPower3
        },
        0.12
      );
    }
    if (visualCard) {
      tl.to(
        visualCard,
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.82,
          ease: MOTION_TOKENS.ease.outExpo
        },
        0.14
      );
    }
  }
}
