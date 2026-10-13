/** Klien API untuk pengaturan situs (mis. musik latar yang dikendalikan admin). */
import { throwApiError } from '../utils/apiError';

import { API_URL } from './config';

const BASE = API_URL;

/** Lagu YouTube pada pustaka musik — dikelola admin via CRUD. */
export interface Song {
  id: number;
  judul: string;
  artis: string;
  /** ID video YouTube (bagian setelah watch?v=). */
  videoId: string;
  deskripsi: string;
  urutan: number;
  aktif: boolean;
  createdAt: string;
  updatedBy: string;
}

export interface SongInput {
  judul: string;
  artis: string;
  videoId: string;
  deskripsi?: string;
  urutan?: number;
  aktif?: boolean;
}

async function authHeaders(token: string | null): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export interface MusicSettings {
  enabled: boolean;
  /** ID lagu YouTube (pompeii, fixyou, ...) saat mode 'youtube',
   *  atau ID track prosedural (ambient, ...) saat mode 'procedural'. */
  track: string;
  /** Volume 0..1 */
  volume: number;
  autoplay: boolean;
  mode: 'procedural' | 'youtube';
  title?: string | null;
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export const settingsApi = {
  /** Baca pengaturan musik (publik, tanpa login). */
  async getMusic(): Promise<MusicSettings> {
    const res = await fetch(`${BASE}/api/Settings/music`);
    if (!res.ok) throw new Error('Gagal mengambil pengaturan musik');
    return res.json();
  },

  /** Simpan pengaturan musik (khusus admin; token dari utils/auth). */
  async updateMusic(
    s: Pick<MusicSettings, 'enabled' | 'track' | 'volume' | 'autoplay' | 'mode' | 'title'>,
    token: string | null,
  ): Promise<MusicSettings> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}/api/Settings/music`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        enabled: s.enabled,
        track: s.track,
        volume: s.volume,
        autoplay: s.autoplay,
        mode: s.mode,
        title: s.title ?? null,
      }),
    });
    if (!res.ok) await throwApiError(res, 'Gagal menyimpan pengaturan musik');
    return res.json();
  },

  // ===== Pustaka lagu (CRUD admin) =====

  /** Daftar lagu aktif dari pustaka (publik — dipakai player & pengaturan). */
  async getSongs(): Promise<Song[]> {
    const res = await fetch(`${BASE}/api/MusicLibrary`);
    if (!res.ok) throw new Error('Gagal mengambil daftar lagu');
    const data = (await res.json()) as Song[];
    return Array.isArray(data) ? data : [];
  },

  /** Tambah lagu baru ke pustaka (admin pusat / SuperAdmin). */
  async createSong(s: SongInput, token: string | null): Promise<Song> {
    const res = await fetch(`${BASE}/api/MusicLibrary`, {
      method: 'POST',
      headers: await authHeaders(token),
      body: JSON.stringify(s),
    });
    if (!res.ok) await throwApiError(res, 'Gagal menambah lagu');
    return res.json();
  },

  /** Ubah lagu pada pustaka (admin pusat / SuperAdmin). */
  async updateSong(id: number, s: Partial<SongInput>, token: string | null): Promise<Song> {
    const res = await fetch(`${BASE}/api/MusicLibrary/${id}`, {
      method: 'PUT',
      headers: await authHeaders(token),
      body: JSON.stringify(s),
    });
    if (!res.ok) await throwApiError(res, 'Gagal mengubah lagu');
    return res.json();
  },

  /** Hapus lagu dari pustaka (admin pusat / SuperAdmin). */
  async deleteSong(id: number, token: string | null): Promise<void> {
    const res = await fetch(`${BASE}/api/MusicLibrary/${id}`, {
      method: 'DELETE',
      headers: await authHeaders(token),
    });
    if (!res.ok) await throwApiError(res, 'Gagal menghapus lagu');
  },
};
