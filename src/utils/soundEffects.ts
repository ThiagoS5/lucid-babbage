import type { VisualEffectTrigger } from '../types/jjk';

/**
 * Procedural Web Audio API Sound Synthesizer for the Jujutsu Kaisen chronicle.
 * Zero external assets required — works offline & online on Desktop and Mobile.
 */
class JujutsuAudioEngine {
  private ctx: AudioContext | null = null;
  public enabled = true;

  private getContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch {
      return null;
    }
  }

  /**
   * KOKUSEN (Black Flash) — 0.000001s spatial distortion sub-bass + electric crackle
   */
  public playBlackFlash() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // 1. Sub-bass spatial impact
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.45);

    subGain.gain.setValueAtTime(0.32, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.5);

    // 2. High-voltage crimson lightning snap
    const snapOsc = ctx.createOscillator();
    const snapGain = ctx.createGain();
    snapOsc.type = 'square';
    snapOsc.frequency.setValueAtTime(920, now + 0.02);
    snapOsc.frequency.exponentialRampToValueAtTime(65, now + 0.22);

    snapGain.gain.setValueAtTime(0.22, now + 0.02);
    snapGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    snapOsc.connect(snapGain);
    snapGain.connect(ctx.destination);
    snapOsc.start(now + 0.02);
    snapOsc.stop(now + 0.26);
  }

  /**
   * RYŌIKI TENKAI (Domain Expansion) — Deep ominous shrine bell + sub-harmonic resonance
   */
  public playDomainExpansion() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [110, 164.81, 220, 277.18];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.96, now + 1.4);

      gain.gain.setValueAtTime(0.12 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.5);
    });
  }

  /**
   * RCT (Reverse Cursed Technique) — Positive energy crystalline harmonic chord
   */
  public playRctHeal() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = now + idx * 0.06;
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0.1, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  public playForVfx(vfx: VisualEffectTrigger) {
    if (vfx === 'BLACK_FLASH') {
      this.playBlackFlash();
    } else if (
      vfx === 'DOMAIN_EXPANSION' ||
      vfx === 'DOMAIN_GOJO' ||
      vfx === 'DOMAIN_SUKUNA' ||
      vfx === 'DOMAIN_HIGURUMA' ||
      vfx === 'DOMAIN_GENERIC'
    ) {
      this.playDomainExpansion();
    } else if (vfx === 'RCT_HEAL') {
      this.playRctHeal();
    }
  }
}

export const jjkAudio = new JujutsuAudioEngine();
