/**
 * songEngine — pemutar audio YouTube (IFrame API) untuk musik latar.
 *
 * Video resmi dari kanal artis diputar AUDIO-ONLY (iframe 1x1 tersembunyi,
 * tanpa tampilan visual). Autoplay & kontrol penuh via IFrame API.
 *
 * Catatan autoplay: browser hanya mengizinkan play() setelah gesture user.
 * MusicPlayer sudah menangani ini (mulai pada gestur pertama).
 *
 * Playlist: bila callback onEnded terpasang (via setOnEnded), saat lagu selesai
 * engine memanggilnya alih-alih mengulang lagu yang sama — MusicPlayer memakai
 * ini untuk memutar lagu berikutnya pada pustaka (berurutan/acak).
 *
 * API publik sengaja mirip audioEngine supaya pemakai (MusicPlayer,
 * MusicSettingsTab) tinggal switch.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPlayer = any;

interface SongEngineState {
  player: AnyPlayer | null;
  ready: boolean;
  pending: { videoId: string; volume: number } | null;
  currentVideoId: string | null;
  onEnded: (() => void) | null;
  /** True saat lagu terakhir di-play oleh resume() — jangan trigger onEnded ganda. */
  resuming: boolean;
}

const st: SongEngineState = {
  player: null,
  ready: false,
  pending: null,
  currentVideoId: null,
  onEnded: null,
  resuming: false,
};

let apiLoading = false;

/** Muat skrip IFrame API YouTube sekali (idempotent). */
function loadApi(): void {
  if (apiLoading) return;
  const w = window as unknown as {
    YT?: {
      Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => AnyPlayer;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      PlayerState: Record<string, any>;
    };
    onYouTubeIframeAPIReady?: () => void;
  };
  if (w.YT?.Player) return; // sudah ada
  apiLoading = true;

  const prev = w.onYouTubeIframeAPIReady;
  w.onYouTubeIframeAPIReady = () => {
    prev?.();
    st.ready = true;
    if (st.pending && !st.player) createPlayer(st.pending.videoId, st.pending.volume);
    if (st.pending) playPending();
  };

  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  tag.async = true;
  document.head.appendChild(tag);
}

function playPending(): void {
  if (!st.pending || !st.player) return;
  const { videoId, volume } = st.pending;
  st.pending = null;
  play(videoId, volume);
}

function createPlayer(videoId: string, volume: number): void {
  const w = window as unknown as {
    YT: { Player: new (el: HTMLElement | string, opts: Record<string, unknown>) => AnyPlayer };
  };
  let host = document.getElementById('yt-music-host');
  if (!host) {
    host = document.createElement('div');
    host.id = 'yt-music-host';
    // Tersembunyi total: tidak terlihat, tidak mengganggu layout, tetap audio
    host.style.cssText =
      'position:fixed;width:1px;height:1px;left:-9999px;top:-9999px;opacity:0;pointer-events:none;overflow:hidden;';
    document.body.appendChild(host);
  }
  st.player = new w.YT.Player(host, {
    videoId,
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      playsinline: 1,
      // Tanpa loop/playlist: akhir lagu memicu onStateChange ENDED -> onEnded (playlist)
    },
    events: {
      onReady: (e: { target: AnyPlayer }) => {
        e.target.setVolume(Math.round(volume * 100));
        e.target.playVideo();
      },
      onStateChange: (e: { data: number }) => {
        // ENDED = 0 -> panggil callback playlist (berurutan/acak ditangani pemanggil)
        if (e.data === 0 && st.player && st.onEnded) {
          st.onEnded();
        }
      },
    },
  });
}

function play(videoId: string, volume: number): void {
  if (st.player) {
    if (st.currentVideoId !== videoId) {
      st.player.loadVideoById(videoId);
      st.currentVideoId = videoId;
    }
    st.player.setVolume(Math.round(volume * 100));
    st.player.playVideo();
    return;
  }
  loadApi();
  st.pending = { videoId, volume };
  if (st.ready) createPlayer(videoId, volume);
}

function stop(): void {
  if (st.player) {
    try {
      st.player.stopVideo();
    } catch {
      /* iframe mungkin sudah mati */
    }
  }
  st.currentVideoId = null;
  st.pending = null;
}

function setVolume(v: number): void {
  st.pending && (st.pending.volume = v);
  if (st.player) st.player.setVolume(Math.round(v * 100));
}

function pause(): void {
  if (st.player) {
    try {
      st.player.pauseVideo();
    } catch {
      /* ignore */
    }
  }
}

function resume(): void {
  if (st.player) {
    try {
      st.resuming = true;
      st.player.playVideo();
    } catch {
      /* ignore */
    }
  }
}

/** Pasang callback yang dipanggil saat lagu berakhir (untuk playlist). */
function setOnEnded(cb: (() => void) | null): void {
  st.onEnded = cb;
}

export const songEngine = { play, stop, setVolume, pause, resume, setOnEnded };
