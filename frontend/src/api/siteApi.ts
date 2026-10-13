import { auth } from '../utils/auth';
import { throwApiError } from '../utils/apiError';
import { API_URL } from './config';

const SITE_BASE = `${API_URL}/api/Site`;

export interface ApiClientItem {
  id: number;
  namaWebsite: string;
  urlWebsite: string;
  emailKontak: string;
  keyPreview: string;
  organisasiId: number;
  organisasiNama: string;
  aktif: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  jumlahRequest: number;
}

export interface RegisteredSite {
  clientId: number;
  namaWebsite: string;
  organisasiId: number;
  organisasiNama: string;
  /** Hanya terisi saat register/regenerate — server hanya menyimpan hash. */
  apiKey?: string;
  createdAt: string;
}

function authHeaders(json = false): HeadersInit {
  const token = auth.getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export const siteApi = {
  /** Daftar semua website klien (SuperAdmin). */
  async getClients(): Promise<{ success: boolean; message: string; data: ApiClientItem[] }> {
    const response = await fetch(`${SITE_BASE}/clients`, { headers: authHeaders() });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil daftar website');
    return response.json();
  },

  /** Daftarkan website baru -> auto-generate tenant + API key (dipakai di UI admin). */
  async register(data: {
    namaWebsite: string;
    urlWebsite?: string;
    emailKontak?: string;
    organisasiId?: number;
  }): Promise<{ success: boolean; message: string; data: RegisteredSite }> {
    const response = await fetch(`${SITE_BASE}/register`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mendaftarkan website');
    return response.json();
  },

  /** Generate ulang API key (key lama mati). */
  async regenerateKey(id: number): Promise<{ success: boolean; message: string; data: RegisteredSite }> {
    const response = await fetch(`${SITE_BASE}/clients/${id}/regenerate`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal regenerate API key');
    return response.json();
  },

  /** Aktifkan / nonaktifkan akses website. */
  async setStatus(id: number, aktif: boolean): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${SITE_BASE}/clients/${id}/status`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify({ aktif }),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mengubah status');
    return response.json();
  },

  /** Hapus klien website. */
  async deleteClient(id: number): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${SITE_BASE}/clients/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal menghapus klien');
    return response.json();
  },
};
