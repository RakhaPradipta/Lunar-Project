/**
 * Konfigurasi API terpusat — SATU-SATUNYA tempat yang boleh menentukan
 * alamat backend. Semua modul API & komponen mengimpor dari sini.
 *
 * VITE_API_URL di-set di file .env (salin dari .env.example di root proyek):
 *   Development : tidak perlu diisi (fallback ke http://localhost:5200)
 *   Production  : VITE_API_URL=https://api.domain-anda.com
 *
 * Harus di-set SAAT BUILD (`npm run build`) karena Vite menyuntikkan nilainya
 * ke bundle statis, bukan saat runtime.
 *
 * FIX PENTING: dulu fallback memakai `??` yang TIDAK menganggap string kosong
 * sebagai "tidak diisi". Bila .env berisi `VITE_API_URL=` (kosong — persis
 * seperti template .env.example), API_URL menjadi string kosong -> semua fetch
 * menuju origin Vite sendiri (5173) dan mendapat index.html alih-alih JSON
 * ("Unexpected token '<' ... is not valid JSON") -> seluruh web gagal memuat
 * data. Sekarang string kosong/whitespace dianggap tidak di-set.
 */
const RAW_API_URL = import.meta.env.VITE_API_URL as string | undefined;
const API_BASE = RAW_API_URL && RAW_API_URL.trim().length > 0 ? RAW_API_URL : 'http://localhost:5200';

export const API_URL = API_BASE.replace(/\/+$/, '');
