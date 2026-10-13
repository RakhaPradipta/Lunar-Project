import type { ApiResponse, LoginResponse, MeResponse } from '../types/desawisata';
import { API_URL } from './config';

const API_BASE = `${API_URL}/api/Auth`;

export const authApi = {
  async login(email: string, password: string): Promise<ApiResponse<LoginResponse>> {
    const response = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.message || 'Email atau password salah!');
    }
    return json;
  },

  async me(token: string): Promise<ApiResponse<MeResponse>> {
    const response = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error('Sesi tidak valid');
    return response.json();
  },

  /**
   * Logout server-side: jti token dimasukkan blacklist backend sehingga token
   * yang sama tidak bisa dipakai lagi walaupun belum kedaluwarsa.
   * Gagal jaringan diabaikan — pembersihan lokal tetap berjalan.
   */
  async logout(): Promise<void> {
    try {
      const token = (localStorage.getItem('auth_token') ?? sessionStorage.getItem('auth_token')) || '';
      if (!token) return;
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Backend tidak terjangkau — logout lokal tetap sah
    }
  },
};
