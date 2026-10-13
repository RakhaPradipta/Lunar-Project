/**
 * audioEngine — musik latar prosedural + efek suara UI.
 *
 * Musik DISINTESIS langsung di browser via Web Audio API (oscillator, filter,
 * delay, konvolusi). Tidak ada file audio yang diunduh, sehingga:
 *  - bebas royalti & bebas hotlink,
 *  - tetap bunyi walau offline,
 *  - ukurannya ~0 KB.
 *
 * Semua track mendengar "organik": nada dipilih dari skala pentatonik, timing
 * sedikit humanized (jitter), dan setiap voice punya detune/pitch drift lembut —
 * bukan loop MIDI yang kaku.
 *
 * Terinspirasi instrumen Nusantara: gamelan (metalofon), suling/angklung (Sunda),
 * ombak & angin (laut).
 */

export type TrackId = 'ambient' | 'gamelan' | 'sundanese' | 'laut';

interface Layer {
  stop: () => void;
}

/** Skala pentatonik slendro-esque (rasio terhadap tonika) — khas Nusantara. */
const SLENDRO = [0, 2, 5, 7, 9]; // semitone
const PELlog = [0, 1, 5, 7, 8]; // variasi pelog-ish (lebih eksotis)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private layers: Layer[] = [];
  private schedulers: number[] = [];
  private currentTrack: TrackId | null = null;
  private _volume = 0.35;
  private _muted = true; // SFX mute (terpisah dari musik)

  get playing(): boolean {
    return this.currentTrack !== null;
  }

  get track(): TrackId | null {
    return this.currentTrack;
  }

  get volume(): number {
    return this._volume;
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();

      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);

      // Bus musik & SFX dipisah agar mute SFX tidak mematikan musik
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = this._volume;
      this.musicBus.connect(this.master);

      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = this._muted ? 0 : 0.5;
      this.sfxBus.connect(this.master);

      // Reverb ringan (impulse response sintetis — ekor peluruhan noise)
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.makeImpulse(2.4, 2.2);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.25;
      this.reverb.connect(wet);
      wet.connect(this.master);
    }
    return this.ctx;
  }

  /** Impulse response reverb sintetis: noise dengan peluruhan eksponensial. */
  private makeImpulse(seconds: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const rate = ctx.sampleRate;
    const len = Math.max(1, Math.floor(rate * seconds));
    const buf = ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  private toReverb(node: AudioNode): void {
    if (this.reverb) node.connect(this.reverb);
  }

  // ============ VOICE SYNTHESIS (instrumen virtual) ============

  /**
   * Nada metalofon/gamelan: dua sinus (fundamental + oktaf) dengan attack cepat
   * dan ekor peluruhan panjang, sedikit detune antar-kanal -> hangat, bukan "beep".
   */
  private strike(freq: number, when: number, gain = 0.5, decay = 3.5, pan = 0): void {
    const ctx = this.ensureCtx();
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.012); // attack hammer
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);

    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;

    const o1 = ctx.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.004); // humanize pitch
    const o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 2.01; // partial oktaf (khas logam gamelan)
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;

    o1.connect(g);
    o2.connect(g2);
    g2.connect(g);
    g.connect(panner);
    panner.connect(this.musicBus!);
    this.toReverb(panner);

    o1.start(when);
    o2.start(when);
    o1.stop(when + decay + 0.1);
    o2.stop(when + decay + 0.1);
  }

  /** Nada seruling/suling: gelombang triangle + vibrato lembut + napas noise. */
  private flute(freq: number, when: number, dur: number, gain = 0.18): void {
    const ctx = this.ensureCtx();
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(freq * 0.985, when);
    o.frequency.linearRampToValueAtTime(freq, when + 0.09); // slur masuk
    o.frequency.linearRampToValueAtTime(freq * 0.99, when + dur); // drift keluar

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = freq * 0.006; // vibrato halus
    lfo.connect(lfoGain);
    lfoGain.connect(o.frequency);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(gain, when + 0.12);
    g.gain.setValueAtTime(gain, when + dur * 0.7);
    g.gain.linearRampToValueAtTime(0, when + dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1600;

    o.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus!);
    this.toReverb(g);

    o.start(when);
    lfo.start(when);
    o.stop(when + dur + 0.1);
    lfo.stop(when + dur + 0.1);
  }

  /** Pad angin: noise ter-filter bandpass yang frekuensinya bergerak lambat. */
  private windLayer(): Layer {
    const ctx = this.ensureCtx();
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown-ish noise: lebih lembut dari white noise
      last = (last + (Math.random() * 2 - 1) * 0.02) * 0.998;
      data[i] = last * 3.2;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 420;
    filter.Q.value = 0.6;

    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4); // fade-in pelan

    src.connect(filter);
    filter.connect(g);
    g.connect(this.musicBus!);

    src.start();
    lfo.start();
    return {
      stop: () => {
        try {
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
          src.stop(ctx.currentTime + 1.4);
          lfo.stop(ctx.currentTime + 1.4);
        } catch { /* sudah berhenti */ }
      },
    };
  }

  /** Ombak: noise lowpass dengan swell periodik (naik-turun ~12 detik). */
  private waveLayer(): Layer {
    const ctx = this.ensureCtx();
    const len = ctx.sampleRate * 8;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.03) * 0.995;
      data[i] = last * 2.4;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;

    const swell = ctx.createGain();
    swell.gain.value = 0.015;

    // LFO sangat lambat untuk swell ombak
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1 / 12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(swell.gain);

    src.connect(filter);
    filter.connect(swell);
    swell.connect(this.musicBus!);

    src.start();
    lfo.start();
    return {
      stop: () => {
        try {
          swell.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
          src.stop(ctx.currentTime + 1.4);
          lfo.stop(ctx.currentTime + 1.4);
        } catch { /* sudah berhenti */ }
      },
    };
  }

  // ============ SCHEDULER MELODI ============

  /** Loop penjadwal melodi. Tiap track punya karakternya sendiri. */
  private startScheduler(track: TrackId): void {
    const ctx = this.ensureCtx();

    const scheduleBar = () => {
      if (this.currentTrack !== track) return; // sudah diganti/dihentikan
      const t = ctx.currentTime + 0.1;
      const root = track === 'laut' ? 220 : track === 'gamelan' ? 261.6 : 196; // G3/C4
      const scale = track === 'gamelan' ? PELlog : SLENDRO;

      if (track === 'ambient') {
        // Pad lembut + seruling jarang — tenang seperti pagi di sawah
        const deg = pick(scale);
        this.flute(root * Math.pow(2, deg / 12) * 2, t, 4.5 + Math.random() * 2, 0.12);
        if (Math.random() < 0.5) {
          this.strike(root * Math.pow(2, pick(scale) / 12) * 2, t + 2 + Math.random() * 2, 0.16, 5, (Math.random() - 0.5) * 0.8);
        }
      } else if (track === 'gamelan') {
        // Pola balungan: nada berirama dengan bolongan (rest), pentalan bolak-balik
        const motif = [0, 2, 4, 3, 4, 2];
        motif.forEach((deg, i) => {
          if (Math.random() < 0.15) return; // rest — membuat hidup
          const oct = i % 2 === 0 ? 1 : 2;
          const f = root * Math.pow(2, (scale[deg % scale.length] + 12 * oct) / 12);
          this.strike(f, t + i * 0.62 + (Math.random() - 0.5) * 0.02, 0.32, 3.2, (i % 3 - 1) * 0.4);
        });
        // Gong besar penutup bar
        this.strike(root / 2, t + 3.9, 0.4, 6, 0);
      } else if (track === 'sundanese') {
        // Degung-ish: seruling melodi + angklung punctuate
        const mel = [4, 3, 2, 3, 4, 1, 0].filter(() => Math.random() > 0.12);
        let cursor = t;
        for (const deg of mel) {
          const dur = 0.5 + Math.random() * 0.5;
          const f = root * Math.pow(2, (scale[deg % scale.length] + 12) / 12);
          this.flute(f, cursor, dur * 1.6, 0.14);
          if (Math.random() < 0.4) {
            this.strike(root * 2 * Math.pow(2, scale[pick(scale)] / 12), cursor + dur / 2, 0.2, 2.4, (Math.random() - 0.5));
          }
          cursor += dur + (Math.random() - 0.5) * 0.08; // humanize timing
        }
      } else if (track === 'laut') {
        // Ombak + lonceng pelabuhan + nada tinggi jarang
        if (Math.random() < 0.7) {
          this.strike(root * 4 * Math.pow(2, pick(scale) / 12), t + Math.random() * 4, 0.12, 6, (Math.random() - 0.5) * 1.2);
        }
        if (Math.random() < 0.25) {
          this.strike(root * 3, t + 1, 0.15, 8, 0); // lonceng
        }
      }

      const next = track === 'gamelan' ? 4200 : 5200;
      const jitter = Math.random() * 800; // anti-robotik
      const id = window.setTimeout(scheduleBar, next + jitter);
      this.schedulers.push(id);
    };

    // Bar pertama sedikit ditunda agar fade-in terasa
    const id = window.setTimeout(scheduleBar, 400);
    this.schedulers.push(id);
  }

  // ============ PUBLIC API ============

  /**
   * Mulai memutar track. Aman dipanggil berulang (track sama -> no-op).
   * HARUS dipanggil dari event handler user (klik/keydown) karena autoplay policy.
   */
  play(track: TrackId, volume?: number): void {
    if (volume !== undefined) this.setVolume(volume);
    if (this.currentTrack === track) {
      // resume bila suspended (autoplay policy)
      void this.ctx?.resume();
      return;
    }
    this.stop();
    const ctx = this.ensureCtx();
    void ctx.resume();

    this.currentTrack = track;
    if (track === 'laut' || track === 'ambient') {
      this.layers.push(this.waveLayer());
    }
    if (track === 'ambient') {
      this.layers.push(this.windLayer());
    }
    this.startScheduler(track);
  }

  stop(): void {
    this.schedulers.forEach((id) => window.clearTimeout(id));
    this.schedulers = [];
    this.layers.forEach((l) => l.stop());
    this.layers = [];
    this.currentTrack = null;
  }

  setVolume(v: number): void {
    this._volume = Math.min(1, Math.max(0, v));
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.linearRampToValueAtTime(this._volume, this.ctx.currentTime + 0.15);
    }
  }

  // ============ SFX UI (tidak tergantung musik) ============

  private sfxEnabled(): boolean {
    return !this._muted;
  }

  /** Klik lembut untuk tombol UI. */
  click(): void {
    if (!this.sfxEnabled()) return;
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(740, t);
    o.frequency.exponentialRampToValueAtTime(520, t + 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g);
    g.connect(this.sfxBus!);
    o.start(t);
    o.stop(t + 0.1);
  }

  /** Pop halus saat chat terbuka / notifikasi. */
  pop(): void {
    if (!this.sfxEnabled()) return;
    const ctx = this.ensureCtx();
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(880, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g);
    g.connect(this.sfxBus!);
    o.start(t);
    o.stop(t + 0.25);
  }

  /**
   * Sapaan robot kecil "boop-beep!" — diputar saat jendela chat dibuka,
   * sinkron dengan animasi lambaikan tangan robot 3D.
   *
   * Nadanya dituning via uji DSP offline (frontend/greet-test.mjs):
   *  - kontur zigzag (naik→turun→naik) terasa seperti "robot bicara",
   *  - filter 2100 Hz memberi kilau tanpa mengubah loudness,
   *  - suku kata kedua berakhir di C6 (1047 Hz) supaya sapaan terasa ceria.
   *
   * Sengaja TIDAK lewat sfxBus (yang ter-mute bila musik dimatikan):
   * sapaan ini dipicu klik eksplisit user sehingga selalu boleh berbunyi.
   * Volume dijaga kecil agar tidak mengagetkan.
   */
  greet(): void {
    try {
      const ctx = this.ensureCtx();
      if (ctx.state === 'suspended') void ctx.resume();
      const t0 = ctx.currentTime + 0.02;

      // Dua suku kata: "boop" (C5→E5) lalu "beep!" (E5→C6, berakhir tinggi).
      const syllables: Array<{ from: number; to: number; at: number; dur: number }> = [
        { from: 523, to: 659, at: 0, dur: 0.13 },
        { from: 659, to: 1047, at: 0.16, dur: 0.16 },
      ];

      const out = ctx.createGain();
      out.gain.value = 1;
      out.connect(this.master!);
      this.toReverb(out);

      for (const s of syllables) {
        const t = t0 + s.at;
        // square ter-filter = karakter "vokal robot", bukan beep tajam
        const o = ctx.createOscillator();
        o.type = 'square';
        o.frequency.setValueAtTime(s.from, t);
        o.frequency.exponentialRampToValueAtTime(s.to, t + s.dur);

        const sub = ctx.createOscillator(); // sub-osinus satu oktaf di bawah: bikin tebal
        sub.type = 'triangle';
        sub.frequency.setValueAtTime(s.from / 2, t);
        sub.frequency.exponentialRampToValueAtTime(s.to / 2, t + s.dur);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 2100;
        filter.Q.value = 1;

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.095, t + 0.025); // attack cepat
        g.gain.exponentialRampToValueAtTime(0.0001, t + s.dur + 0.06); // ekor peluruhan

        const gs = ctx.createGain();
        gs.gain.value = 0.5; // sub lebih pelan dari nada utama

        o.connect(filter);
        sub.connect(gs);
        gs.connect(filter);
        filter.connect(g);
        g.connect(out);

        o.start(t);
        sub.start(t);
        o.stop(t + s.dur + 0.1);
        sub.stop(t + s.dur + 0.1);
      }
    } catch {
      /* Web Audio tidak didukung — abaikan */
    }
  }

  setSfxEnabled(on: boolean): void {
    this._muted = !on;
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.linearRampToValueAtTime(on ? 0.5 : 0, this.ctx.currentTime + 0.1);
    }
  }

  /** Pre-warm AudioContext dari gesture user apa pun (klik pertama di halaman). */
  warmup(): void {
    try {
      const ctx = this.ensureCtx();
      if (ctx.state === 'suspended') void ctx.resume();
    } catch { /* Web Audio tidak didukung */ }
  }
}

export const audioEngine = new AudioEngine();
