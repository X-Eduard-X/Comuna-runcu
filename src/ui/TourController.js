import { getGuidedTourWaypoints } from '../utils/dataLoader.js';

export class TourController {
  constructor({
    waypoints,
    onSelectTourWaypoint,
    onExitTour,
    onFinishTour
  }) {
    this.tourWaypoints = getGuidedTourWaypoints(waypoints);
    this.onSelectTourWaypoint = onSelectTourWaypoint;
    this.onExitTour = onExitTour;
    this.onFinishTour = onFinishTour;

    this.isActive = false;
    this.currentIndex = 0;
    this.isAutoplay = false;
    this.autoplayDurationMs = 9500;
    this.autoplayElapsedMs = 0;
    this.autoplayRafId = null;
    this.lastTickTime = 0;

    this.hudEl = document.getElementById('tour-hud');
    this.stepLabelEl = document.getElementById('tour-step-label');
    this.dotsContainerEl = document.getElementById('tour-dots');
    this.prevBtn = document.getElementById('tour-prev-btn');
    this.nextBtn = document.getElementById('tour-next-btn');
    this.autoplayBtn = document.getElementById('tour-autoplay-btn');
    this.autoplayProgressEl = document.getElementById('tour-autoplay-progress');
    this.exitBtn = document.getElementById('tour-exit-btn');
    this.startTourHeaderBtn = document.getElementById('btn-start-tour');

    this.bindEvents();
  }

  bindEvents() {
    this.startTourHeaderBtn?.addEventListener('click', () => {
      if (this.isActive) {
        this.stop();
      } else {
        this.start(0);
      }
    });

    this.prevBtn?.addEventListener('click', () => this.prev());
    this.nextBtn?.addEventListener('click', () => this.next());
    this.autoplayBtn?.addEventListener('click', () => this.toggleAutoplay());
    this.exitBtn?.addEventListener('click', () => this.stop());
  }

  start(startIndex = 0) {
    if (this.tourWaypoints.length === 0) return;
    this.isActive = true;
    this.currentIndex = Math.max(
      0,
      Math.min(startIndex, this.tourWaypoints.length - 1)
    );

    if (this.hudEl) {
      this.hudEl.hidden = false;
      this.hudEl.setAttribute('aria-hidden', 'false');
    }

    if (this.startTourHeaderBtn) {
      this.startTourHeaderBtn.classList.add('is-active');
      this.startTourHeaderBtn.setAttribute('aria-pressed', 'true');
    }

    this.renderDots();
    this.goToIndex(this.currentIndex);
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;
    this.stopAutoplay();

    if (this.hudEl) {
      this.hudEl.hidden = true;
      this.hudEl.setAttribute('aria-hidden', 'true');
    }

    if (this.startTourHeaderBtn) {
      this.startTourHeaderBtn.classList.remove('is-active');
      this.startTourHeaderBtn.setAttribute('aria-pressed', 'false');
    }

    if (this.onExitTour) this.onExitTour();
  }

  goToIndex(idx) {
    if (this.tourWaypoints.length === 0) return;
    this.currentIndex =
      (idx + this.tourWaypoints.length) % this.tourWaypoints.length;

    const wp = this.tourWaypoints[this.currentIndex];
    if (this.stepLabelEl) {
      this.stepLabelEl.textContent = `Tur Recomandat • ${
        this.currentIndex + 1
      } / ${this.tourWaypoints.length}`;
    }

    // Highlight active dot
    const dots = this.dotsContainerEl?.querySelectorAll('.tour-dot');
    dots?.forEach((d, i) => {
      d.classList.toggle('is-active', i === this.currentIndex);
    });

    this.autoplayElapsedMs = 0;
    if (this.autoplayProgressEl) {
      this.autoplayProgressEl.style.width = '0%';
    }

    if (this.onSelectTourWaypoint && wp) {
      this.onSelectTourWaypoint(wp, this.currentIndex, this.tourWaypoints.length);
    }
  }

  next() {
    if (!this.isActive) return;
    if (this.currentIndex === this.tourWaypoints.length - 1) {
      // At the end of the recommended tour, offer the Thank You presentation screen
      if (this.isAutoplay) {
        this.stopAutoplay();
      }
      if (this.onFinishTour) {
        this.onFinishTour();
        return;
      }
    }
    this.goToIndex(this.currentIndex + 1);
  }

  prev() {
    if (!this.isActive) return;
    this.goToIndex(this.currentIndex - 1);
  }

  toggleAutoplay() {
    if (this.isAutoplay) {
      this.stopAutoplay();
    } else {
      this.startAutoplay();
    }
  }

  startAutoplay() {
    this.isAutoplay = true;
    this.autoplayElapsedMs = 0;
    this.lastTickTime = performance.now();

    if (this.autoplayBtn) {
      this.autoplayBtn.classList.add('is-playing');
      this.autoplayBtn.setAttribute('aria-pressed', 'true');
      const labelEl = this.autoplayBtn.querySelector('.tour-autoplay-label');
      if (labelEl) labelEl.textContent = 'Pauză';
    }

    const tick = (now) => {
      if (!this.isAutoplay || !this.isActive) return;
      const dt = now - this.lastTickTime;
      this.lastTickTime = now;
      this.autoplayElapsedMs += dt;

      const pct = Math.min(
        100,
        (this.autoplayElapsedMs / this.autoplayDurationMs) * 100
      );
      if (this.autoplayProgressEl) {
        this.autoplayProgressEl.style.width = `${pct.toFixed(1)}%`;
      }

      if (this.autoplayElapsedMs >= this.autoplayDurationMs) {
        this.autoplayElapsedMs = 0;
        this.next();
      }

      if (this.isAutoplay) {
        this.autoplayRafId = requestAnimationFrame(tick);
      }
    };

    this.autoplayRafId = requestAnimationFrame(tick);
  }

  stopAutoplay() {
    this.isAutoplay = false;
    if (this.autoplayRafId) {
      cancelAnimationFrame(this.autoplayRafId);
      this.autoplayRafId = null;
    }
    if (this.autoplayBtn) {
      this.autoplayBtn.classList.remove('is-playing');
      this.autoplayBtn.setAttribute('aria-pressed', 'false');
      const labelEl = this.autoplayBtn.querySelector('.tour-autoplay-label');
      if (labelEl) labelEl.textContent = 'Autoplay';
    }
    if (this.autoplayProgressEl) {
      this.autoplayProgressEl.style.width = '0%';
    }
  }

  renderDots() {
    if (!this.dotsContainerEl) return;
    this.dotsContainerEl.innerHTML = this.tourWaypoints
      .map(
        (wp, idx) => `
        <button
          type="button"
          class="tour-dot ${idx === this.currentIndex ? 'is-active' : ''}"
          data-idx="${idx}"
          aria-label="Mergi la oprirea ${idx + 1}: ${wp.title}"
          title="${idx + 1}. ${wp.title}"
        ></button>
      `
      )
      .join('');

    this.dotsContainerEl.querySelectorAll('.tour-dot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.idx || 0);
        this.goToIndex(idx);
      });
    });
  }
}
