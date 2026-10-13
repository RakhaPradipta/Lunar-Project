import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, X, Send, Sparkles, RefreshCw, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { aiChatApi, type AiChatTurn } from '../api/aiChatApi';
import { voice } from '../utils/voice';
import { audioEngine } from '../utils/audioEngine';

// Robot 3D di-lazy-load agar bundle three.js masuk chunk terpisah dan
// tidak memperlambat muat awal halaman (fallback ikon Bot saat loading).
const Robot3D = lazy(() => import('./Robot3D'));

interface Msg {
  role: 'user' | 'assistant';
  content: string;
}

const QUICK_ASKS = [
  'Rekomendasi desa wisata?',
  'Harga tiket & pajak?',
  'Desa yang sedang ramai?',
  'Jam operasional?',
];

/** Render teks chat sederhana: **bold**, link [teks](/desa/..?booking=1), bullet. Aman (tanpa innerHTML). */
function ChatText({ text, onBooking }: { text: string; onBooking: (desaId: number) => void }) {
  const lines = text.split('\n');
  // pecah per bold ATAU per link markdown
  const TOKEN_RE = /\*\*(.+?)\*\*|\[([^\]]+)\]\((\/desa\/\d+\?booking=1)\)/g;
  return (
    <>
      {lines.map((line, i) => {
        const nodes: React.ReactNode[] = [];
        let last = 0;
        let k = 0;
        let m: RegExpExecArray | null;
        TOKEN_RE.lastIndex = 0;
        while ((m = TOKEN_RE.exec(line)) !== null) {
          if (m.index > last) nodes.push(line.slice(last, m.index));
          if (m[1]) {
            nodes.push(<strong key={`b${i}-${k++}`}>{m[1]}</strong>);
          } else if (m[2] && m[3]) {
            const desaId = Number(m[3].match(/\d+/)?.[0]);
            nodes.push(
              <button
                key={`l${i}-${k++}`}
                className="ai-chat-bookbtn"
                onClick={() => onBooking(desaId)}
                title="Buka formulir booking"
              >
                🎟️ {m[2]}
              </button>,
            );
          }
          last = m.index + m[0].length;
        }
        if (last < line.length) nodes.push(line.slice(last));
        return (
          <div key={i} className={line.trim().startsWith('•') ? 'ai-chat-li' : undefined}>
            {nodes}
          </div>
        );
      })}
    </>
  );
}

/** Web Speech Recognition (input suara) — opsional, tidak semua browser punya. */
function useSpeechRecognition(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);

  const supported =
    typeof window !== 'undefined' &&
    (('SpeechRecognition' in window) || ('webkitSpeechRecognition' in window));

  const start = () => {
    if (!supported || listening) return;
    const Ctor =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'id-ID';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      const text = e.results?.[0]?.[0]?.transcript ?? '';
      if (text) onResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stop = () => {
    try { recRef.current?.stop(); } catch { /* ignore */ }
    setListening(false);
  };

  return { supported, listening, start, stop };
}

export default function AiChatWidget() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [waveOnce, setWaveOnce] = useState(false); // robot melambaikan saat chat dibuka
  const [mode, setMode] = useState<'llm' | 'fallback' | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      role: 'assistant',
      content:
        'Halo! 👋 Aku **WisataBot**, asisten DesaWisata Nusantara.\nAku bisa bantu soal desa wisata di platform ini: rekomendasi, harga tiket & pajak, jam buka, kepadatan pengunjung, fasilitas & kontak.\nMau tanya apa hari ini? 😊',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false); // suara jawaban bot
  const [speaking, setSpeaking] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const spokenRef = useRef<Set<number>>(new Set());

  // Inisialisasi TTS & SFX
  useEffect(() => {
    voice.init();
    voice.setOnStateChange((s) => setSpeaking(s));
    audioEngine.warmup();
  }, []);

  useEffect(() => {
    if (open && mode === null) {
      aiChatApi
        .status()
        .then((s) => setMode(s.mode))
        .catch(() => setMode('fallback'));
    }
  }, [open, mode]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs, open, loading]);

  // Bicara jawaban bot terbaru saat suara aktif (sekali per pesan)
  useEffect(() => {
    if (!voiceOn || loading) return;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    if (spokenRef.current.has(msgs.length - 1)) return;
    spokenRef.current.add(msgs.length - 1);
    voice.speak(last.content);
  }, [msgs, voiceOn, loading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    audioEngine.pop(); // SFX kirim
    voice.stop(); // jangan tumpuk suara
    setInput('');
    const history: AiChatTurn[] = msgs
      .slice(1) // skip pesan sambutan
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    setMsgs((prev) => [...prev, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const res = await aiChatApi.ask(message, history);
      setMsgs((prev) => [...prev, { role: 'assistant', content: res.reply }]);
    } catch (e) {
      setMsgs((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: e instanceof Error ? e.message : 'Maaf, terjadi kesalahan. Coba lagi ya.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const rec = useSpeechRecognition((text) => {
    setInput('');
    void send(text);
  });

  const reset = () => {
    voice.stop();
    setMsgs((prev) => prev.slice(0, 1));
    spokenRef.current = new Set([0]);
  };

  const toggleVoice = () => {
    setVoiceOn((v) => {
      const next = !v;
      voice.setEnabled(next);
      if (!next) voice.stop();
      else {
        // Bacakan sambutan pertama ketika suara baru diaktifkan
        spokenRef.current.delete(0);
      }
      return next;
    });
    audioEngine.click();
  };

  /** Klik tombol booking di chat → buka halaman desa dengan modal booking terbuka. */
  const handleBooking = (desaId: number) => {
    if (!Number.isFinite(desaId) || desaId <= 0) return;
    voice.stop();
    setOpen(false);
    navigate(`/desa/${desaId}?booking=1`);
  };

  return (
    <>
      {/* Tombol bulat mengambang */}
      {!open && (
        <button
          className="ai-chat-fab"
          onClick={() => { setOpen(true); setWaveOnce(true); audioEngine.greet(); }}
          aria-label="Chat dengan WisataBot"
          title="Tanya WisataBot 🤖"
        >
          <span className="ai-chat-fab-3d" aria-hidden="true">
            <Suspense fallback={<Bot size={26} />}>
              <Robot3D interactive onPoke={audioEngine.pop} />
            </Suspense>
          </span>
          <span className="ai-chat-fab-dot" />
        </button>
      )}

      {/* Jendela chat */}
      {open && (
        <div className="ai-chat-panel" role="dialog" aria-label="WisataBot — Asisten DesaWisata">
          <div className="ai-chat-header">
            <div className="ai-chat-header-info">
              <div className={`ai-chat-avatar ${speaking ? 'talking' : ''}`}>
                <span className="ai-chat-avatar-3d" aria-hidden="true">
                  <Suspense fallback={<Bot size={20} />}>
                    <Robot3D speaking={speaking} interactive={false} wave={waveOnce} />
                  </Suspense>
                </span>
              </div>
              <div>
                <div className="ai-chat-name">
                  WisataBot
                  {mode && (
                    <span className={`ai-chat-mode ai-chat-mode-${mode}`}>
                      {mode === 'llm' ? 'AI' : 'Data'}
                    </span>
                  )}
                </div>
                <div className="ai-chat-sub">
                  {speaking ? 'sedang berbicara…' : 'Asisten DesaWisata • online'}
                </div>
              </div>
            </div>
            <div className="ai-chat-header-actions">
              <button
                className={`ai-chat-iconbtn ${voiceOn ? 'active' : ''}`}
                onClick={toggleVoice}
                title={voiceOn ? 'Matikan suara jawaban' : 'Dengarkan jawaban bersuara'}
                aria-pressed={voiceOn}
              >
                {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button className="ai-chat-iconbtn" onClick={reset} title="Chat baru" aria-label="Chat baru">
                <RefreshCw size={15} />
              </button>
              <button className="ai-chat-iconbtn" onClick={() => { voice.stop(); setOpen(false); }} title="Tutup" aria-label="Tutup chat">
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="ai-chat-list" ref={listRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`ai-chat-msg ai-chat-msg-${m.role}`}>
                {m.role === 'assistant' && (
                  <div className={`ai-chat-msg-avatar ${speaking && i === msgs.length - 1 ? 'talking' : ''}`}>
                    <Bot size={14} />
                  </div>
                )}
                <div className="ai-chat-bubble">
                  <ChatText text={m.content} onBooking={handleBooking} />
                  {m.role === 'assistant' && voiceOn && i === msgs.length - 1 && speaking && (
                    <div className="ai-chat-speaking" aria-hidden="true">
                      <span /><span /><span /><span /><span />
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-chat-msg ai-chat-msg-assistant">
                <div className="ai-chat-msg-avatar">
                  <Bot size={14} />
                </div>
                <div className="ai-chat-bubble ai-chat-waiting">
                  <Sparkles size={13} /> WisataBot sedang menyiapkan jawaban…
                </div>
              </div>
            )}
          </div>

          {msgs.length <= 1 && (
            <div className="ai-chat-chips">
              {QUICK_ASKS.map((q) => (
                <button key={q} className="ai-chat-chip" onClick={() => void send(q)} disabled={loading}>
                  <Sparkles size={12} />
                  {q}
                </button>
              ))}
            </div>
          )}

          <form
            className="ai-chat-inputrow"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            {rec.supported && (
              <button
                type="button"
                className={`ai-chat-micbtn ${rec.listening ? 'listening' : ''}`}
                onClick={() => (rec.listening ? rec.stop() : rec.start())}
                title={rec.listening ? 'Berhenti merekam' : 'Ngobrol dengan suara'}
                aria-pressed={rec.listening}
              >
                {rec.listening ? <MicOff size={17} /> : <Mic size={17} />}
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={rec.listening ? 'Mendengarkan… bicara sekarang' : 'Tanya soal desa wisata…'}
              maxLength={1000}
              aria-label="Pesan untuk WisataBot"
            />
            <button type="submit" disabled={loading || !input.trim()} aria-label="Kirim">
              <Send size={17} />
            </button>
          </form>
          <div className="ai-chat-footnote">
            {voiceOn ? '🔊 Suara aktif — WisataBot menjawab dengan suara' : 'WisataBot hanya menjawab seputar platform DesaWisata'}
          </div>
        </div>
      )}
    </>
  );
}
