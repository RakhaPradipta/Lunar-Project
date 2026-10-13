import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { Music, Repeat, Shuffle, SkipBack, SkipForward, Volume1, Volume2, VolumeX } from 'lucide-react';

// Piringan vinyl 3D di-lazy-load agar three.js tetap di chunk terpisah.
const MusicDisc3D = lazy(() => import('./MusicDisc3D'));
import { audioEngine } from '../utils/audioEngine';
import { songEngine } from '../utils/songEngine';
import {
  SONGS,
  resolveTrack,
  trackTitle,
  type MusicMode,
  type SongDef,
} from '../utils/musicTracks';
import { settingsApi, type MusicSettings } from '../api/settingsApi';

/**
 * MusicPlayer — musik latar yang langsung mengalir saat web dibuka.
 *
 * Dua mode (dikendalikan admin via dashboard):
 *  - mode 'youtube'   : lagu dari pustaka admin (CRUD /api/MusicLibrary), audio-only
 *                       via YouTube IFrame API (lihat utils/songEngine).
 *  - mode 'procedural': nuansa Nusantara yang disintesis di browser (audioEngine).
 *
 * Playlist: seluruh lagu aktif pada pustaka diputar berurutan atau acak —
 * pengunjung bisa mengganti mode lewat tombol kecil di widget player.
 *
 * Autoplay policy browser melarang audio sebelum ada interaksi user, jadi:
 *  1. Saat web dibuka: player menunggu gestur pertama (klik/scroll/keydown/tap)
 *     lalu langsung memulai musik — pengunjung hampir tidak sadar ada "klik pertama".
 *  2. Pengaturan (nyala/mati, lagu, volume) dikendalikan admin: GET/PUT /api/Settings/music.
 *  3. Preferensi mute per-pengunjung disimpan di localStorage, default mengikuti admin.
 */

const LS_KEY = 'dw_music_user_pref';
const LS_PLAYLIST_KEY = 'dw_music_playlist_mode';
const LS_VOLUME_KEY = 'dw_music_user_volume';

type PlaylistMode = 'sequential' | 'shuffle';

function loadUserPref(): { muted: boolean } | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as { muted: boolean }) : null;
  } catch {
    return null;
  }
}

function loadPlaylistMode(): PlaylistMode {
  try {
    return localStorage.getItem(LS_PLAYLIST_KEY) === 'shuffle' ? 'shuffle' : 'sequential';
  } catch {
    return 'sequential';
  }
}

function loadUserVolume(): number {
  try {
    const raw = localStorage.getItem(LS_VOLUME_KEY);
    const v = raw === null ? NaN : parseFloat(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.35;
  } catch {
    return 0.35;
  }
}

export default function MusicPlayer() {
  const [settings, setSettings] = useState<MusicSettings | null>(null);
  const [songs, setSongs] = useState<SongDef[]>(SONGS); // fallback statis dulu
  const [muted, setMuted] = useState<boolean>(() => loadUserPref()?.muted ?? false);
  const [started, setStarted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [playlistMode, setPlaylistMode] = useState<PlaylistMode>(loadPlaylistMode);
  // Volume pilihan pengunjung (slider) — default mengikuti volume pilihan admin
  const [volume, setVolume] = useState<number>(() => loadUserVolume());
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  // Judul/indikator lagu yang sedang diputar (berubah via playlist, skip, dan ganti pengaturan)
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const settingsRef = useRef<MusicSettings | null>(null);
  const songsRef = useRef<SongDef[]>(SONGS);
  const startedRef = useRef(false);
  // VideoId yang sedang diputar (urutan playlist bergerak dari sini)
  const currentVideoRef = useRef<string | null>(null);

  settingsRef.current = settings;
  songsRef.current = songs;

  // Muat pengaturan dari admin (publik) + pustaka lagu dari API
  useEffect(() => {
    settingsApi
      .getMusic()
      .then((s) => setSettings(s))
      .catch(() =>
        setSettings({
          enabled: true, track: 'pompeii', volume: 0.35, autoplay: true,
          mode: 'youtube', title: 'Pompeii — Bastille',
        }),
      );
    settingsApi
      .getSongs()
      .then((list) => {
        if (list.length > 0) {
          setSongs(
            list.map((s) => ({
              id: s.videoId,
              label: s.judul,
              artist: s.artis,
              videoId: s.videoId,
              desc: s.deskripsi,
              dbId: s.id,
              aktif: s.aktif,
            })),
          );
        }
      })
      .catch(() => { /* fallback statis tetap dipakai */ });
  }, []);

  // Callback "lagu berakhir" -> mainkan lagu berikutnya (berurutan/acak)
  useEffect(() => {
    songEngine.setOnEnded(() => {
      const s = settingsRef.current;
      if (!s || s.mode !== 'youtube' || !s.enabled) return;
      const list = songsRef.current;
      if (list.length <= 1) {
        // Pustaka hanya satu lagu — putar ulang lagu yang sama
        songEngine.play(list[0]?.videoId ?? '', volumeRef.current);
        return;
      }
      const idx = list.findIndex((x) => x.videoId === currentVideoRef.current);
      let nextIdx: number;
      if (playlistModeRef.current === 'shuffle') {
        nextIdx = Math.floor(Math.random() * list.length);
        // Hindari mengulang lagu yang sama dua kali berturut-turut
        if (nextIdx === idx) nextIdx = (nextIdx + 1) % list.length;
      } else {
        nextIdx = (idx + 1 + list.length) % list.length;
      }
      const next = list[nextIdx];
      if (!next) return;
      currentVideoRef.current = next.videoId;
      setActiveVideoId(next.videoId); // setter stabil — aman dipanggil dari callback
      songEngine.play(next.videoId, volumeRef.current);
    });
    return () => songEngine.setOnEnded(null);
  }, []);

  // Ref mode agar callback onEnded selalu membaca nilai terbaru tanpa re-registrasi
  const playlistModeRef = useRef<PlaylistMode>(playlistMode);
  playlistModeRef.current = playlistMode;

  // Autoplay: mulai pada gestur pertama pengunjung (policy browser)
  useEffect(() => {
    if (started) return;
    const tryStart = () => {
      const s = settingsRef.current;
      if (!s || !s.enabled || !s.autoplay) return;
      if (loadUserPref()?.muted) return; // user pernah mute -> hormati
      startMusic(s);
      audioEngine.setSfxEnabled(true);
      setStarted(true);
      setMuted(false);
    };
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, tryStart, { once: true, passive: true }));
    return () => events.forEach((ev) => window.removeEventListener(ev, tryStart));
  }, [started, settings]);

  // Sinkronkan saat pengaturan berubah (mis. admin ganti lagu / matikan musik)
  useEffect(() => {
    if (!settings) return;
    if (!settings.enabled) {
      stopAll();
      setStarted(false);
    } else if (startedRef.current) {
      startMusic(settings);
    }
  }, [settings]);

  // Sinkronkan mute
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ muted }));
    } catch { /* private mode */ }
    if (muted) {
      stopAll();
      setStarted(false);
    } else {
      const s = settingsRef.current;
      if (s?.enabled) {
        startMusic(s);
        audioEngine.setSfxEnabled(true);
        setStarted(true);
      }
    }
  }, [muted]);

  // Hentikan musik saat tab tidak terlihat (hemat & sopan), lanjut saat kembali
  useEffect(() => {
    const onVis = () => {
      const s = settingsRef.current;
      if (!s?.enabled || muted) return;
      if (document.hidden) {
        stopAll();
        startedRef.current = false;
      } else if (startedRef.current || started) {
        startMusic(s);
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [muted, started]);

  const startMusic = (s: MusicSettings) => {
    startedRef.current = true;
    if (s.mode === 'youtube') {
      audioEngine.stop();
      // Lagu dari pustaka admin — bila lagu tersimpan sudah dihapus, pakai lagu pertama
      // Mulai acak juga masuk akal saat mode shuffle, tapi tetap mulai dari lagu pilihan admin
      const videoId = resolveTrack('youtube', s.track, songsRef.current);
      currentVideoRef.current = videoId;
      setActiveVideoId(videoId);
      songEngine.play(videoId, volumeRef.current);
    } else {
      songEngine.stop();
      audioEngine.play(s.track as never, volumeRef.current);
    }
  };

  const stopAll = () => {
    songEngine.stop();
    audioEngine.stop();
    startedRef.current = false;
  };

  const toggleMute = () => {
    setMuted((m) => !m);
    setExpanded(true);
    window.setTimeout(() => setExpanded(false), 1800);
  };

  const togglePlaylistMode = () => {
    setPlaylistMode((m) => {
      const next = m === 'sequential' ? 'shuffle' : 'sequential';
      try {
        localStorage.setItem(LS_PLAYLIST_KEY, next);
      } catch { /* private mode */ }
      return next;
    });
    setExpanded(true);
    window.setTimeout(() => setExpanded(false), 2400);
  };

  // Geser slider volume pengunjung: terapkan langsung ke engine aktif + simpan pref.
  const changeVolume = (v: number) => {
    const clamped = Math.min(1, Math.max(0, v));
    setVolume(clamped);
    try {
      localStorage.setItem(LS_VOLUME_KEY, String(clamped));
    } catch { /* private mode */ }
    const s = settingsRef.current;
    if (s?.mode === 'youtube') songEngine.setVolume(clamped);
    else audioEngine.setVolume(clamped);
  };

  // Lompat ke lagu berikutnya/sebelumnya pada pustaka (dipakai tombol next/prev).
  // Saat sedang mute, klik skip dianggap ingin mendengarkan -> langsung unmute & play.
  const skipSong = (dir: 1 | -1) => {
    const s = settingsRef.current;
    if (!s || !s.enabled || s.mode !== 'youtube') return;
    const list = songsRef.current;
    if (list.length === 0) return;
    const idx = list.findIndex((x) => x.videoId === currentVideoRef.current);
    let nextIdx: number;
    if (list.length === 1) {
      nextIdx = 0; // satu-satunya lagu — putar ulang dari awal
    } else if (playlistModeRef.current === 'shuffle' && dir === 1) {
      nextIdx = Math.floor(Math.random() * list.length);
      if (nextIdx === idx) nextIdx = (nextIdx + 1) % list.length;
    } else {
      nextIdx = (idx + dir + list.length) % list.length;
    }
    const next = list[nextIdx];
    if (!next) return;
    currentVideoRef.current = next.videoId;
    setActiveVideoId(next.videoId);
    if (muted || !startedRef.current) {
      // Nyalakan musik dari lagu yang dipilih
      setMuted(false);
    }
    songEngine.play(next.videoId, s.volume);
    audioEngine.setSfxEnabled(true);
    setStarted(true);
    setExpanded(true);
    window.setTimeout(() => setExpanded(false), 2200);
  };

  const fallbackTitle = settings?.title ?? 'Pompeii — Bastille';
  // Judul mengikuti lagu yang AKTIF diputar (bisa berubah via playlist/skip),
  // bukan sekadar lagu pilihan admin di pengaturan. Guard null: settings bisa
  // belum ter-load saat render pertama.
  const resolvedAdminTrack = settings
    ? resolveTrack(settings.mode as MusicMode, settings.track, songs)
    : null;
  const activeSong = songs.find((x) => x.videoId === (activeVideoId ?? resolvedAdminTrack));
  const title = settings && settings.mode === 'youtube'
    ? (activeSong ? `${activeSong.label} — ${activeSong.artist}` : fallbackTitle)
    : trackTitle(settings?.mode as MusicMode, settings?.track ?? '', fallbackTitle, songs);
  const active = started && !muted && settings?.enabled;
  const isYouTubeMode = settings?.mode === 'youtube';
  const multiSongs = isYouTubeMode && songs.length > 1;

  return (
    <div className={`music-player ${expanded ? 'expanded' : ''} ${active ? 'is-playing' : ''}`} aria-label="Musik latar">
      <button
        className="music-toggle"
        onClick={toggleMute}
        title={muted ? 'Putar musik latar' : 'Matikan musik latar'}
        aria-pressed={!muted}
      >
        <span className="music-toggle-3d" aria-hidden="true">
          <Suspense fallback={
            <>
              <Music size={16} className={active ? 'music-icon-on' : 'music-icon-off'} />
              {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </>
          }>
            <MusicDisc3D playing={Boolean(active)} />
          </Suspense>
        </span>
        {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      <div className="music-info">
        <span
          className="music-vol"
          onClick={(e) => e.stopPropagation()}
          title={`Volume ${Math.round(volume * 100)}%`}
        >
          <button
            className="music-vol-btn"
            onClick={toggleMute}
            title={muted ? 'Bunyikan' : 'Bisukan'}
            aria-label={muted ? 'Bunyikan musik' : 'Bisukan musik'}
          >
            {muted || volume === 0
              ? <VolumeX size={12} />
              : volume < 0.5 ? <Volume1 size={12} /> : <Volume2 size={12} />}
          </button>
          <input
            type="range" min={0} max={1} step={0.01}
            className="music-vol-slider"
            value={muted ? 0 : volume}
            onChange={(e) => changeVolume(parseFloat(e.target.value))}
            aria-label="Volume musik"
          />
        </span>
        {multiSongs && (
          <button
            className="music-skip-btn"
            onClick={() => skipSong(-1)}
            title="Lagu sebelumnya"
            aria-label="Lagu sebelumnya"
          >
            <SkipBack size={13} />
          </button>
        )}
        <span className="music-title">{muted || !settings?.enabled ? 'Musik mati' : title}</span>
        <span className="music-eq" aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        {multiSongs && (
          <>
            <button
              className="music-skip-btn"
              onClick={() => skipSong(1)}
              title="Lagu berikutnya"
              aria-label="Lagu berikutnya"
            >
              <SkipForward size={13} />
            </button>
            <button
              className="music-mode-btn"
              onClick={togglePlaylistMode}
              title={playlistMode === 'sequential'
                ? 'Mode berurutan — klik untuk acak'
                : 'Mode acak — klik untuk berurutan'}
              aria-label={playlistMode === 'sequential' ? 'Mode putar berurutan' : 'Mode putar acak'}
            >
              {playlistMode === 'sequential' ? <Repeat size={13} /> : <Shuffle size={13} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
