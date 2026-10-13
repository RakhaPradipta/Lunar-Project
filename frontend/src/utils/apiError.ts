import { auth } from './auth';

/**
 * Penanganan 401 global.
 *
 * Dulu: request 401 (token invalid setelah backend restart) hanya muncul sebagai
 * toast "Gagal memuat data. Pastikan backend berjalan." — menyesatkan, karena
 * backend sebenarnya hidup; sesi login-lah yang sudah berakhir.
 *
 * Sekarang: saat API menjawab 401, sesi lokal dibersihkan dan user diarahkan
 * ke halaman login dengan pesan yang jelas. Aman dipanggil berulang.
 */
/** Guard: jangan redirect berulang saat beberapa request 401 bersamaan. */
let redirectingToLogin = false;

export function handleUnauthorized(): void {
  if (redirectingToLogin || !auth.isLoggedIn()) return;
  redirectingToLogin = true;

  // Bersihkan token + data user yang sudah tidak valid
  void auth.logout();

  // Simpan pesan untuk ditampilkan di halaman login
  try {
    sessionStorage.setItem('auth_expired', '1');
  } catch {
    /* abaikan */
  }

  // Arahkan ke login, bawa tujuan awal agar bisa kembali setelah login ulang.
  // Full reload (bukan router navigate) supaya semua state lama dibuang bersih.
  const target = `${window.location.pathname}${window.location.search}`;
  const redirect = target.startsWith('/admin') ? `?redirect=${encodeURIComponent(target)}` : '';
  window.location.replace(`/login${redirect}`);
}

/** Pesan sesi berakhir (dibaca halaman login, lalu dihapus). */
export function consumeSessionExpiredMessage(): string | null {
  try {
    if (sessionStorage.getItem('auth_expired')) {
      sessionStorage.removeItem('auth_expired');
      return 'Sesi login Anda telah berakhir. Silakan masuk kembali.';
    }
  } catch {
    /* abaikan */
  }
  return null;
}

/**
 * Apakah error ini berasal dari response 401 (fetch TypeError tidak — ini khusus
 * Error ber-pattern 401 yang dibuang helper API).
 */
export function isUnauthorizedError(err: unknown): boolean {
  return err instanceof Error && 'status' in err && (err as { status?: number }).status === 401;
}

/**
 * Baca pesan error dari response lalu lempar Error yang membawa `status` HTTP,
 * sehingga pemanggil bisa membedakan 401 (sesi berakhir) dari error lain.
 * Response 401 otomatis memicu pembersihan sesi + redirect ke login, berlaku
 * untuk semua API client yang memakai helper ini.
 */
export async function throwApiError(response: Response, fallback: string): Promise<never> {
  if (response.status === 401) handleUnauthorized();
  let message = fallback;
  try {
    const json = await response.json();
    if (json?.message) message = json.message;
  } catch {
    /* body bukan JSON -> pakai fallback */
  }
  const err = new Error(message) as Error & { status?: number };
  err.status = response.status;
  throw err;
}
