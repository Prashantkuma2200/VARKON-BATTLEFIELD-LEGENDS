import { AudioSettings, WeaponCategory } from './types';

class TacticalAudioEngine {
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: AudioSettings = {
    master: 0.8,
    sfx: 0.85,
    music: 0.45,
    ambient: 0.5,
    voice: 0.7,
    muted: false,
  };
  private ambientGain: GainNode | null = null;
  private ambientSource: AudioBufferSourceNode | null = null;

  public updateSettings(next: AudioSettings) {
    this.settings = { ...next };
    if (this.ambientGain && this.ctx) {
      const vol = this.settings.muted ? 0 : this.settings.master * this.settings.ambient * 0.08;
      this.ambientGain.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.15);
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.settings.muted) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    if (!this.noiseBuffer && this.ctx) {
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 1.5, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    return this.ctx;
  }

  private sfxVol(): number {
    return this.settings.muted ? 0 : this.settings.master * this.settings.sfx;
  }

  public startAmbient(isStorm: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    this.stopAmbient();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = isStorm ? 680 : 280;

    const gain = ctx.createGain();
    gain.gain.value = this.settings.muted ? 0 : this.settings.master * this.settings.ambient * (isStorm ? 0.12 : 0.045);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start();

    this.ambientSource = src;
    this.ambientGain = gain;
  }

  public stopAmbient() {
    if (this.ambientSource) {
      try {
        this.ambientSource.stop();
      } catch {
        // ignore
      }
      this.ambientSource.disconnect();
      this.ambientSource = null;
    }
    if (this.ambientGain) {
      this.ambientGain.disconnect();
      this.ambientGain = null;
    }
  }

  public playGunshot(category: WeaponCategory, suppressed = false, distanceFactor = 1) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const vol = this.sfxVol() * Math.max(0.05, Math.min(1, distanceFactor));
    if (vol <= 0.01) return;

    const now = ctx.currentTime;

    // Noise burst for propellant crack
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = suppressed ? 'bandpass' : 'lowpass';

    let dur = 0.14;
    let baseFreq = 1600;
    let punchFreq = 140;

    if (category === 'SNIPER') {
      dur = suppressed ? 0.16 : 0.34;
      baseFreq = suppressed ? 1100 : 2400;
      punchFreq = 85;
    } else if (category === 'SHOTGUN') {
      dur = 0.28;
      baseFreq = 1350;
      punchFreq = 95;
    } else if (category === 'SMG') {
      dur = 0.085;
      baseFreq = suppressed ? 1400 : 2100;
      punchFreq = 190;
    } else if (category === 'DMR') {
      dur = 0.2;
      baseFreq = suppressed ? 1200 : 2200;
      punchFreq = 115;
    } else if (category === 'LMG') {
      dur = 0.19;
      baseFreq = suppressed ? 1150 : 1950;
      punchFreq = 105;
    } else if (category === 'PISTOL') {
      dur = 0.095;
      baseFreq = suppressed ? 1300 : 2300;
      punchFreq = 210;
    } else if (category === 'MELEE') {
      dur = 0.075;
      baseFreq = 2600;
      punchFreq = 280;
    }

    filter.frequency.setValueAtTime(baseFreq, now);
    filter.frequency.exponentialRampToValueAtTime(220, now + dur);

    const nGain = ctx.createGain();
    const peak = (suppressed ? 0.22 : 0.52) * vol;
    nGain.gain.setValueAtTime(peak, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + dur + 0.02);

    // Low-end mechanical punch oscillator
    const osc = ctx.createOscillator();
    osc.type = suppressed ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(punchFreq * 1.4, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + dur * 0.7);

    const oGain = ctx.createGain();
    oGain.gain.setValueAtTime((suppressed ? 0.16 : 0.42) * vol, now);
    oGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.75);

    osc.connect(oGain);
    oGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + dur);
  }

  public playHitMarker(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol();
    if (vol <= 0.01) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = headshot ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1650 : 980, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 620 : 420, now + 0.065);

    const g = ctx.createGain();
    g.gain.setValueAtTime((headshot ? 0.26 : 0.18) * vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.075);
  }

  public playKillConfirm() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol();
    if (vol <= 0.01) return;
    const now = ctx.currentTime;
    const notes = [660, 990];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.22 * vol, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.07 + 0.18);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.2);
    });
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol();
    if (vol <= 0.01) return;
    const now = ctx.currentTime;
    [0, 0.22, 0.55].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(i === 2 ? 780 : 340 + i * 110, now + offset);
      osc.frequency.exponentialRampToValueAtTime(140, now + offset + 0.045);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.11 * vol, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.05);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.06);
    });
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const vol = this.sfxVol();
    if (vol <= 0.01) return;
    const now = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(620, now);
    filter.frequency.exponentialRampToValueAtTime(55, now + 0.95);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.75 * vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 1.0);

    noise.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 1.05);

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(110, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 0.65);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.6 * vol, now);
    sg.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    sub.connect(sg);
    sg.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 0.72);
  }

  public playFootstep(sprinting: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.noiseBuffer) return;
    const vol = this.sfxVol() * (sprinting ? 0.14 : 0.08);
    if (vol <= 0.005) return;
    const now = ctx.currentTime;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = sprinting ? 380 : 250;

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + 0.07);
  }

  public playUiClick(accent = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol() * 0.16;
    if (vol <= 0.005) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(accent ? 740 : 520, now);
    osc.frequency.exponentialRampToValueAtTime(accent ? 1020 : 320, now + 0.045);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playAbility() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol() * 0.25;
    if (vol <= 0.005) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.26);

    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  public playVictoryFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const vol = this.sfxVol() * 0.22;
    if (vol <= 0.005) return;
    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880];
    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.11);
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, now + idx * 0.11);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.11 + 0.7);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + idx * 0.11);
      osc.stop(now + idx * 0.11 + 0.72);
    });
  }
}

export const audioEngine = new TacticalAudioEngine();
