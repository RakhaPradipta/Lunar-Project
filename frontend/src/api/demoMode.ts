/**
 * Saklar MODE DEMO — frontend only, tanpa menyentuh tampilan maupun backend.
 *
 * Aktifkan lewat env:  VITE_DEMO_MODE=true   (di file .env root)
 * Saat aktif, modul-modul API mengembalikan data mock realistis sehingga
 * seluruh halaman publik (landing, profil desa, booking, peta, chatbot)
 * bisa didemokan tanpa backend berjalan.
 *
 * Catatan: Vite membaca .env saat server start — ubah nilai ini wajib
 * restart dev server / build ulang.
 */
export function isDemoMode(): boolean {
  try {
    return (import.meta.env.VITE_DEMO_MODE as string | undefined) === 'true';
  } catch {
    return false;
  }
}

/** Jeda tiruan agar skeleton/spinner loading tetap terlihat natural saat demo. */
export function demoDelay(ms = 350): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
