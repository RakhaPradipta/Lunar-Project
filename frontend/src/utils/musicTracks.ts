/**
 * musicTracks — definisi pusat untuk musik latar web.
 *
 * Dua mode:
 *  - 'youtube'   : lagu dari pustaka admin (CRUD via /api/MusicLibrary), diputar
 *                  audio-only via YouTube IFrame API (video resmi, tanpa visual).
 *                  Daftar statis di bawah hanya fallback bila API tidak tersedia.
 *  - 'procedural': nuansa Nusantara yang disintesis di browser (audioEngine).
 */

import type { TrackId } from './audioEngine';

export type { TrackId };

export type MusicMode = 'procedural' | 'youtube';

/** Satu lagu pada pustaka (dari API atau fallback statis). */
export interface SongDef {
  /** Identitas lagu untuk pengaturan `track` — kami pakai videoId (stabil & langsung dipakai engine). */
  id: string;
  label: string;
  artist: string;
  videoId: string;
  desc: string;
  /** Id baris DB (ada hanya untuk lagu dari API). */
  dbId?: number;
  /** Status aktif (ada hanya untuk lagu dari API). */
  aktif?: boolean;
}

/** Lagu bawaan — fallback saat API gagal / belum di-seed. */
export const SONGS: SongDef[] = [
  {
    id: 'F90Cw4l-8NY',
    label: 'Pompeii',
    artist: 'Bastille',
    videoId: 'F90Cw4l-8NY',
    desc: 'Anthem dengan tepuk tangan & harmoni megah — semangat yang menenangkan',
  },
  {
    id: 'k4V3Mo61fJM',
    label: 'Fix You',
    artist: 'Coldplay',
    videoId: 'k4V3Mo61fJM',
    desc: 'Balada organ yang hangat — menenangkan hati seperti senja di desa',
  },
  {
    id: 'RBumgq5yVrA',
    label: 'Let Her Go',
    artist: 'Passenger',
    videoId: 'RBumgq5yVrA',
    desc: 'Gitar akustik lembut — hening, penuh perenungan',
  },
  {
    id: 'uJ_1HMAGb4k',
    label: 'Riptide',
    artist: 'Vance Joy',
    videoId: 'uJ_1HMAGb4k',
    desc: 'Ukulele ceria — ringan seperti angin pantai',
  },
];

/** Peta id lama (pompeii, fixyou, ...) -> videoId, untuk pengaturan tersimpan sebelum CRUD. */
const LEGACY_ID_TO_VIDEO: Record<string, string> = {
  pompeii: 'F90Cw4l-8NY',
  fixyou: 'k4V3Mo61fJM',
  lethergo: 'RBumgq5yVrA',
  riptide: 'uJ_1HMAGb4k',
};

/** Track prosedural Nusantara (disintesis di browser via audioEngine). */
export const MUSIC_TRACKS: { id: TrackId; label: string; desc: string }[] = [
  { id: 'ambient', label: 'Angin Dedaunan', desc: 'Pad hangat + seruling lembut — tenang seperti pagi di sawah' },
  { id: 'gamelan', label: 'Gamelan Sore', desc: 'Metalofon & gong dengan pola balungan — nuansa Jawa klasik' },
  { id: 'sundanese', label: 'Degung Priangan', desc: 'Seruling degung & pentalan angklung — Sunda yang hangat' },
  { id: 'laut', label: 'Ombak Selat', desc: 'Ombak, angin & lonceng pelabuhan — laut Nusantara' },
];

/** Cari lagu di daftar (termasuk id legacy lama). */
export function songById(id: string, songs: SongDef[] = SONGS): SongDef | undefined {
  return (
    songs.find((s) => s.id === id) ??
    songs.find((s) => s.videoId === id) ??
    // id legacy: 'pompeii' dll. -> videoId
    songs.find((s) => s.videoId === LEGACY_ID_TO_VIDEO[id])
  );
}

export function trackById(id: string): (typeof MUSIC_TRACKS)[number] | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}

/**
 * Resolusi `track` dari pengaturan menjadi apa yang diterima engine:
 * videoId (mode youtube) atau id track prosedural.
 * Bila lagu tidak dikenal (dihapus admin), kembalikan lagu pertama dari daftar.
 */
export function resolveTrack(mode: MusicMode, track: string, songs: SongDef[] = SONGS): string {
  if (mode === 'youtube') {
    const song = songById(track, songs) ?? songs[0];
    return song ? song.videoId : track;
  }
  return track;
}

/** Judul yang tampil di widget player sesuai mode + track aktif. */
export function trackTitle(mode: MusicMode, id: string, fallback: string, songs: SongDef[] = SONGS): string {
  if (mode === 'youtube') {
    const s = songById(id, songs);
    return s ? `${s.label} — ${s.artist}` : fallback;
  }
  const t = trackById(id);
  return t ? t.label : fallback;
}
