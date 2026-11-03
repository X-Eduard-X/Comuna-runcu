/**
 * SoundController — Web Audio API Tactile UI Audio Feedback
 * Project: Lider European 2026 — Comuna Runcu, Județul Gorj
 *
 * Generates soft, organic, elegant tactile audio feedback (clicks, taps, card selections, chimes)
 * using synthetic oscillators and gentle lowpass filters with zero external audio assets.
 */

export class SoundController {
  constructor() {
    this.ctx = null;
    this.isAudioUnlocked = false;
    this.lastPlayTime = 0;

    // Load mute preference from localStorage (defaults to enabled/unmuted)
    const stored = typeof window !== 'undefined' ? localStorage.getItem('runcu_sound_muted') : null;
    this.muted = stored === 'true';

    this.initAudioUnlock();
    this.setupGlobalClickDelegation();
  }

  /**
   * Initializes audio context unlock on first user gesture
   */
  initAudioUnlock() {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      this.ensureContext();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.isAudioUnlocked = true;
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('touchstart', unlock, true);
    };

    window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
    window.addEventListener('keydown', unlock, { capture: true, passive: true });
    window.addEventListener('touchstart', unlock, { capture: true, passive: true });
  }

  ensureContext() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Global click delegation: plays tactile soft sounds for buttons, cards, pills, chips
   */
  setupGlobalClickDelegation() {
    if (typeof document === 'undefined') return;

    document.addEventListener(
      'click',
      (e) => {
        if (this.muted) return;

        const target = e.target.closest(
          'button, [role="button"], a, input[type="radio"], input[type="checkbox"], .style-pill, .category-chip, .waypoint-list-card, .map-mode-card, .gallery-thumb-btn, .map-ctrl-btn, .intro-action-btn'
        );

        if (!target) return;
        if (target.disabled || target.getAttribute('aria-disabled') === 'true') return;

        // Don't play if element explicitly opted out with data-no-sound
        if (target.hasAttribute('data-no-sound')) return;

        if (
          target.matches(
            '#btn-confirm-map-mode, #btn-enter-map, #btn-intro-tour, #btn-start-tour, #btn-enter-with-mode'
          )
        ) {
          this.playConfirm();
        } else if (
          target.matches(
            '.map-mode-card, [data-map-style], .category-chip, .waypoint-list-card, .gallery-thumb-btn'
          )
        ) {
          this.playCardSelect();
        } else if (target.matches('[data-close-modal], .modal-close-btn, #btn-close-list, #detail-close-btn')) {
          this.playModalClose();
        } else {
          this.playSoftTap();
        }
      },
      { capture: true, passive: true }
    );
  }

  /**
   * 1. Soft UI Tap — gentle organic wooden/ceramic droplet click
   * Used for standard buttons, icons, pills, navigation arrows.
   */
  playSoftTap() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastPlayTime < 0.03) return; // Prevent double trigger
    this.lastPlayTime = now;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.Q.setValueAtTime(1.0, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.038);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.042);
    } catch {
      // AudioContext safe failover
    }
  }

  /**
   * 2. Card / Map Mode Select — warm, tactile mellow resonance
   * Used when picking map modes, selecting categories, or tapping waypoint cards.
   */
  playCardSelect() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastPlayTime < 0.03) return;
    this.lastPlayTime = now;

    try {
      const osc = ctx.createOscillator();
      const subOsc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(1.5, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.065); // A4

      subOsc.type = 'triangle';
      subOsc.frequency.setValueAtTime(293.66, now); // D4
      subOsc.frequency.exponentialRampToValueAtTime(220, now + 0.065);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.14, now + 0.004);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc.connect(filter);
      subOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      subOsc.start(now);
      osc.stop(now + 0.07);
      subOsc.stop(now + 0.07);
    } catch {
      // AudioContext safe failover
    }
  }

  /**
   * 3. Confirm / Enter Map — warm, ascending micro-chime (rich & welcoming)
   * Used when confirming map mode or entering map/guided tour.
   */
  playConfirm() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastPlayTime < 0.03) return;
    this.lastPlayTime = now;

    try {
      // Note 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.linearRampToValueAtTime(0.11, now + 0.005);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.095);

      // Note 2: 659.25 Hz (E5) or 783.99 Hz (G5) slightly delayed
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.045);
      gain2.gain.setValueAtTime(0.0001, now + 0.045);
      gain2.gain.linearRampToValueAtTime(0.13, now + 0.052);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.045);
      osc2.stop(now + 0.17);
    } catch {
      // AudioContext safe failover
    }
  }

  /**
   * 4. Modal Close — gentle descending soft micro-tap
   */
  playModalClose() {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== 'running') return;

    const now = ctx.currentTime;
    if (now - this.lastPlayTime < 0.03) return;
    this.lastPlayTime = now;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1000, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(240, now + 0.04);

      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // AudioContext safe failover
    }
  }

  /**
   * Toggle mute state
   */
  toggleMute() {
    this.muted = !this.muted;
    if (typeof window !== 'undefined') {
      localStorage.setItem('runcu_sound_muted', String(this.muted));
    }
    if (!this.muted) {
      this.playSoftTap();
    }
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }
}

export const soundController = new SoundController();
