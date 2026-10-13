import type { LoginResponse } from '../types/desawisata';
import { authApi } from '../api/authApi';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';
const LEGACY_STORAGE_KEY = 'admin_logged_in';
const LEGACY_EMAIL_KEY = 'admin_email';

export interface AuthUser {
  userId: number;
  email: string;
  namaLengkap: string;
  role: string;
  organisasiId: number | null;
  organisasiNama: string | null;
}

export const auth = {
  /** Simpan sesi login dari response backend (JWT).
   *  remember=true -> localStorage (tahan tutup browser), false -> sessionStorage (hilang saat browser ditutup). */
  setSession(res: LoginResponse, remember = true): void {
    const store = remember ? window.localStorage : window.sessionStorage;
    store.setItem(TOKEN_KEY, res.token);
    store.setItem(
      USER_KEY,
      JSON.stringify({
        userId: res.userId,
        email: res.email,
        namaLengkap: res.namaLengkap,
        role: res.role,
        organisasiId: res.organisasiId,
        organisasiNama: res.organisasiNama,
      } satisfies AuthUser),
    );
    // Bersihkan sisa login lama (hardcoded) jika ada
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    localStorage.removeItem(LEGACY_EMAIL_KEY);
  },

  /** Token ditemukan di localStorage ATAU sessionStorage. */
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  },

  isLoggedIn(): boolean {
    return !!this.getToken();
  },

  getUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY) ?? sessionStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as AuthUser) : null;
    } catch {
      return null;
    }
  },

  isSuperAdmin(): boolean {
    return this.getUser()?.role === 'SuperAdmin';
  },

  async logout(): Promise<void> {
    // Coba catat logout di backend (opsional; tetap logout lokal walau gagal)
    try {
      await authApi.logout();
    } catch {
      /* abaikan */
    }
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  },

  /** Nama tampilan user yang sedang login. */
  getDisplayName(): string {
    const u = this.getUser();
    return u?.namaLengkap || u?.email || 'Admin';
  },

  getEmail(): string {
    return this.getUser()?.email || '';
  },
};
