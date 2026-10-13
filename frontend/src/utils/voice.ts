/**
 * voice — text-to-speech yang terdengar alami, bukan robot.
 *
 * Trik "humanizing" dipakai di sini:
 *  1. Pra-proses teks: singkatan & angka ditulis sebagai kata-kata, emoji dibuang,
 *     markdown dibersihkan — yang diucapkan = yang memang diucapkan manusia.
 *  2. Setiap kalimat dipecah dan diucapkan sebagai antrean utterance dengan jeda
 *     mikro di antaranya (seperti napas).
 *  3. Pitch & rate diberi variasi acak kecil per kalimat — TTS bawaan terdengar
 *     datar karena konstan; manusia tidak pernah konstan.
 *  4. Prioritas pemilihan suara: suara Indonesia lokal (Google/Damayanti/Andika),
 *     lalu suara non-lokal, lalu default. Baru fallback ke bahasa Inggris.
 */

type VoicePrefs = { rate: number; pitch: number };

class VoiceManager {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private queue: SpeechSynthesisUtterance[] = [];
  private _enabled = false;
  private onStateChange: ((speaking: boolean) => void) | null = null;

  /** Benar saat browser punya TTS dan user mengaktifkan suara. */
  get supported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  setEnabled(on: boolean): void {
    this._enabled = on;
    if (!on) this.stop();
  }

  /** Callback dipanggil saat status speaking berubah (untuk animasi UI). */
  setOnStateChange(cb: ((speaking: boolean) => void) | null): void {
    this.onStateChange = cb;
  }

  private refreshVoices(): void {
    if (!this.supported) return;
    this.voices = window.speechSynthesis.getVoices();
  }

  /** Dipanggil sekali saat app start — daftar suara kadang datang async. */
  init(): void {
    if (!this.supported) return;
    this.synth = window.speechSynthesis;
    this.refreshVoices();
    this.synth.onvoiceschanged = () => this.refreshVoices();
  }

  /** Pilih suara terbaik: id-ID lokal dulu, lalu apapun yang mirip. */
  private bestVoice(): SpeechSynthesisVoice | null {
    if (this.voices.length === 0) this.refreshVoices();
    const id = this.voices.filter((v) => v.lang.toLowerCase().startsWith('id'));
    const googleId = id.find((v) => /google/i.test(v.name));
    if (googleId) return googleId;
    if (id.length > 0) return id[0];
    const msId = this.voices.find((v) => /damayanti|andika/i.test(v.name));
    if (msId) return msId;
    // fallback: suara Melayu, lalu bahasa apa pun non-Inggris, lalu default
    const ms = this.voices.find((v) => v.lang.toLowerCase().startsWith('ms'));
    if (ms) return ms;
    return this.voices.find((v) => !v.lang.toLowerCase().startsWith('en')) ?? this.voices[0] ?? null;
  }

  // ============ PRA-PROSES TEKS ============

  /** Bersihkan markdown/emoji dan ubah angka+singkatan jadi kata yang diucapkan. */
  private speakable(text: string): string {
    let s = text;
    // buang blok kode & URL
    s = s.replace(/```[\s\S]*?```/g, ' ');
    s = s.replace(/https?:\/\/\S+/g, ' tautan ');
    // markdown: bold/italic/link -> teks saja
    s = s.replace(/\*\*(.+?)\*\*/g, '$1');
    s = s.replace(/\*(.+?)\*/g, '$1');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
    // buang emoji & simbol dekoratif
    s = s.replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,
      ' ',
    );
    // bullet jadi jeda
    s = s.replace(/^[\s]*[•·-]\s+/gmu, ', ');
    // singkatan umum
    const ABBR: Record<string, string> = {
      'wib': 'wib',
      'Rp': 'rupiah ',
      'km': 'kilometer',
      'wa': 'whatsapp',
      'IG': 'instagram',
      'dll': 'dan lain-lain',
      'mis.': 'misalnya',
      'yaitu': 'yaitu',
    };
    for (const [k, v] of Object.entries(ABBR)) {
      s = s.replace(new RegExp(`\\b${k}\\b`, 'g'), v);
    }
    // "Rp10.000" sudah jadi "rupiah 10.000" -> sekarang angkanya
    s = s.replace(/rupiah\s+(\d[\d.,]*)/g, (_, num: string) => `rupiah ${this.numberToWordsId(num)}`);
    // angka lain: jam (08:00), persen, dll
    s = s.replace(/\b(\d{1,2}):(\d{2})\b/g, (_m, h: string, mm: string) =>
      `${this.numberToWordsId(h)} lewat ${this.numberToWordsId(mm)}`,
    );
    s = s.replace(/\b(\d+(?:[.,]\d+)?)\s*%/g, (_m, n: string) => `${this.numberToWordsId(n)} persen`);
    // angka polos tersisa
    s = s.replace(/\b\d+(?:[.,]\d+)?\b/g, (m) => this.numberToWordsId(m));
    // rapikan spasi & tanda baca ganda
    s = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.!?;:])/g, '$1');
    return s.trim();
  }

  /** Angka -> kata Bahasa Indonesia (cukup untuk harga/tiket: sampai miliaran). */
  private numberToWordsId(input: string): string {
    const n = Math.round(parseFloat(input.replace(/\./g, '').replace(',', '.')));
    if (!Number.isFinite(n)) return input;
    if (n === 0) return 'nol';
    const units = ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];
    const belas = (x: number) => (x === 10 ? 'sepuluh' : x === 11 ? 'sebelas' : `${units[x - 10]} belas`);
    const below100 = (x: number): string => {
      if (x < 10) return units[x];
      if (x < 20) return belas(x);
      const puluh = Math.floor(x / 10);
      const sisa = x % 10;
      return `${puluh === 1 ? 'se' : units[puluh]}puluh${sisa ? ` ${units[sisa]}` : ''}`;
    };
    const below1000 = (x: number): string => {
      if (x < 100) return below100(x);
      const ratus = Math.floor(x / 100);
      const sisa = x % 100;
      return `${ratus === 1 ? 'seratus' : `${units[ratus]} ratus`}${sisa ? ` ${below100(sisa)}` : ''}`;
    };
    const parts: string[] = [];
    const miliar = Math.floor(n / 1_000_000_000);
    const juta = Math.floor((n % 1_000_000_000) / 1_000_000);
    const ribu = Math.floor((n % 1_000_000) / 1000);
    const sisa = n % 1000;
    if (miliar) parts.push(miliar === 1 ? 'satu miliar' : `${below1000(miliar)} miliar`);
    if (juta) parts.push(juta === 1 ? 'satu juta' : `${below1000(juta)} juta`);
    if (ribu) parts.push(ribu === 1 ? 'seribu' : `${below1000(ribu)} ribu`);
    if (sisa) parts.push(below1000(sisa));
    return parts.join(' ');
  }

  /** Pecah jadi kalimat/frasa pendek agar intonasi terasa bernapas. */
  private sentences(text: string): string[] {
    return text
      .split(/(?<=[.!?…])\s+|\n+/u)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  // ============ SPEAK ============

  /**
   * Ucapkan teks. Per kalimat: pitch & rate dijitter ±sedikit, lalu jeda mikro
   * antar kalimat via setTimeout (bukan bagian utterance) supaya terdengar napas.
   */
  speak(text: string, prefs?: Partial<VoicePrefs>): void {
    if (!this.supported || !this._enabled) return;
    const synth = this.synth!;
    synth.cancel();
    this.queue = [];

    const clean = this.speakable(text);
    if (!clean) return;
    const sents = this.sentences(clean);
    const voice = this.bestVoice();

    sents.forEach((sent, i) => {
      const u = new SpeechSynthesisUtterance(sent);
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? 'id-ID';
      // humanize: variasi kecil per kalimat
      const jitterR = (Math.random() - 0.5) * 0.12;
      const jitterP = (Math.random() - 0.5) * 0.16;
      u.rate = Math.min(2, Math.max(0.6, (prefs?.rate ?? 1.02) + jitterR));
      u.pitch = Math.min(2, Math.max(0.4, (prefs?.pitch ?? 1.0) + jitterP));
      u.volume = 1;

      const isLast = i === sents.length - 1;
      u.onstart = () => this.onStateChange?.(true);
      if (isLast) {
        u.onend = () => {
          this.onStateChange?.(false);
          this.queue = [];
        };
        u.onerror = () => {
          this.onStateChange?.(false);
          this.queue = [];
        };
      }
      this.queue.push(u);
    });

    // Antrekan dengan jeda: utterance berurutan di synth terdengar terburu-buru;
    // sedikit delay per kalimat memberi ritme bicara alami.
    let acc = 0;
    this.queue.forEach((u, i) => {
      const d = acc;
      acc += /[,;:]$/.test(u.text) ? 240 : 120;
      if (i === 0) {
        synth.speak(u); // kalimat pertama langsung
      } else {
        const utter = u;
        window.setTimeout(() => {
          if (this._enabled && this.queue.includes(utter)) synth.speak(utter);
        }, d);
      }
    });
  }

  stop(): void {
    if (!this.supported) return;
    this.queue = [];
    window.speechSynthesis.cancel();
    this.onStateChange?.(false);
  }

}

export const voice = new VoiceManager();
