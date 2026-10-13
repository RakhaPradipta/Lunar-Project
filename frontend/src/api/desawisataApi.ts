import type { DesaWisata, CreateDesaWisataRequest, ApiResponse, Stats, Pengunjung, VisitorActionResponse, VisitorActivity, Pemesanan, PemesananRequest, DesaFoto, DesaFotoRequest, ForecastHari } from '../types/desawisata';
import { auth } from '../utils/auth';
import { throwApiError } from '../utils/apiError';
import { API_URL } from './config';
import { isDemoMode, demoDelay } from './demoMode';
import {
  demoFilterDesa, demoGetById, demoStats, demoGlobalActivity,
  demoVisitors, demoForecast, demoGallery, demoCreateBooking,
} from './demoData';

function demoOk<T>(data: T, message = 'OK (demo)'): ApiResponse<T> {
  return { success: true, message, data, totalData: Array.isArray(data) ? data.length : 1 };
}

const API_BASE = `${API_URL}/api/DesaWisata`;
const UPLOAD_BASE = `${API_URL}/api/Upload`;

function authHeaders(json = false): HeadersInit {
  const token = auth.getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  return headers;
}

export const desaWisataApi = {
  // GET all — publik; admin yang login bisa kirim mine:true utk data tenant-nya saja
  async getAll(params?: {
    provinsi?: string;
    kategori?: string;
    search?: string;
    aktif?: boolean;
    mine?: boolean;
  }): Promise<ApiResponse<DesaWisata[]>> {
    if (isDemoMode()) {
      await demoDelay();
      return demoOk(demoFilterDesa(params));
    }
    const searchParams = new URLSearchParams();
    if (params?.provinsi) searchParams.append('provinsi', params.provinsi);
    if (params?.kategori) searchParams.append('kategori', params.kategori);
    if (params?.search) searchParams.append('search', params.search);
    if (params?.aktif !== undefined) searchParams.append('aktif', params.aktif.toString());
    if (params?.mine) searchParams.append('mine', 'true');

    const url = `${API_BASE}?${searchParams.toString()}`;
    const response = await fetch(url, { headers: authHeaders() });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil data');
    return response.json();
  },

  // GET by ID
  async getById(id: number): Promise<ApiResponse<DesaWisata>> {
    if (isDemoMode()) {
      await demoDelay();
      const found = demoGetById(id);
      if (!found) throw new Error('Data tidak ditemukan');
      return demoOk(found);
    }
    const response = await fetch(`${API_BASE}/${id}`);
    if (!response.ok) throw new Error('Data tidak ditemukan');
    return response.json();
  },

  // POST create (butuh login)
  async create(data: CreateDesaWisataRequest): Promise<ApiResponse<DesaWisata>> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, 'Gagal menambahkan data');
    return response.json();
  },

  // PUT update (butuh login; hanya desa milik organisasi sendiri)
  async update(id: number, data: Partial<CreateDesaWisataRequest>): Promise<ApiResponse<DesaWisata>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, 'Gagal memperbarui data');
    return response.json();
  },

  // DELETE (butuh login; hanya desa milik organisasi sendiri)
  async delete(id: number): Promise<ApiResponse<string>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal menghapus data');
    return response.json();
  },

  // GET stats — publik; admin login bisa kirim mine:true utk statistik tenant-nya
  async getStats(mine = false): Promise<ApiResponse<Stats>> {
    if (isDemoMode()) {
      await demoDelay(200);
      return demoOk(demoStats());
    }
    const response = await fetch(`${API_BASE}/stats${mine ? '?mine=true' : ''}`, {
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil statistik');
    return response.json();
  },

  // POST upload image (butuh login)
  async uploadImage(file: File): Promise<{ success: boolean; message: string; data: { url: string; fileName: string; originalName: string; size: number } }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(UPLOAD_BASE, {
      method: 'POST',
      headers: authHeaders(),
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Gagal mengunggah gambar');
    }

    return response.json();
  },

  // DELETE uploaded image (butuh login)
  async deleteImage(fileName: string): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${UPLOAD_BASE}/${fileName}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Gagal menghapus gambar');
    return response.json();
  },

  // POST check-in visitor (butuh login; hanya desa milik organisasi sendiri)
  async checkIn(
    id: number,
    data: { namaWisatawan?: string; kategoriTiket?: string; nomorBooking?: string },
  ): Promise<ApiResponse<VisitorActionResponse>> {
    const response = await fetch(`${API_BASE}/${id}/checkin`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        namaWisatawan: data.namaWisatawan || '',
        kategoriTiket: data.kategoriTiket || 'Lokal',
        nomorBooking: data.nomorBooking || '',
      }),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Gagal check-in');
    }
    return response.json();
  },

  // POST create booking (PUBLIK — wisatawan tidak perlu login)
  async createPemesanan(id: number, data: PemesananRequest): Promise<ApiResponse<Pemesanan>> {
    if (isDemoMode()) {
      await demoDelay(500);
      if (!demoGetById(id)) throw new Error('Data tidak ditemukan');
      return demoOk(demoCreateBooking(id, data), 'Booking demo berhasil dibuat');
    }
    const response = await fetch(`${API_BASE}/${id}/pemesanan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Gagal membuat booking');
    }
    return response.json();
  },

  // GET bookings for a desa (butuh login; hanya desa milik organisasi sendiri)
  async getPemesanan(id: number, status?: string): Promise<ApiResponse<Pemesanan[]>> {
    const searchParams = new URLSearchParams();
    if (status) searchParams.append('status', status);
    const response = await fetch(`${API_BASE}/${id}/pemesanan?${searchParams.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil data booking');
    return response.json();
  },

  // POST check-out (butuh login; hanya desa milik organisasi sendiri)
  async checkOut(id: number, nomorKarcis: string): Promise<ApiResponse<VisitorActionResponse>> {
    const response = await fetch(`${API_BASE}/${id}/checkout`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ nomorKarcis }),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Gagal check-out');
    }
    return response.json();
  },

  // GET active visitors (butuh login; hanya desa milik organisasi sendiri)
  async getActiveVisitors(id: number): Promise<ApiResponse<Pengunjung[]>> {
    const response = await fetch(`${API_BASE}/${id}/pengunjung`, {
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil data wisatawan');
    return response.json();
  },

  // GET visitor activity per desa (publik utk profil desa)
  async getVisitorActivity(id: number): Promise<ApiResponse<Pengunjung[]>> {
    if (isDemoMode()) {
      await demoDelay(200);
      return demoOk(demoVisitors(id));
    }
    const response = await fetch(`${API_BASE}/${id}/aktivitas`);
    if (!response.ok) throw new Error('Gagal mengambil riwayat aktivitas wisatawan');
    return response.json();
  },

  // GET global visitor activity — publik; admin bisa kirim mine:true
  async getGlobalVisitorActivity(mine = false): Promise<ApiResponse<VisitorActivity[]>> {
    if (isDemoMode()) {
      await demoDelay(200);
      return demoOk(demoGlobalActivity());
    }
    const response = await fetch(`${API_BASE}/aktivitas${mine ? '?mine=true' : ''}`, {
      headers: authHeaders(),
    });
    if (!response.ok) throw new Error('Gagal mengambil aktivitas wisatawan');
    return response.json();
  },

  // ===== PRAKIRAAN KERAMAIAN (publik) =====

  // GET perkiraan ramai/tidak 7 hari ke depan untuk satu desa
  async getForecast(id: number): Promise<ApiResponse<ForecastHari[]>> {
    if (isDemoMode()) {
      await demoDelay(200);
      return demoOk(demoForecast(id));
    }
    const response = await fetch(`${API_BASE}/${id}/forecast`);
    if (!response.ok) await throwApiError(response, 'Gagal mengambil prakiraan keramaian');
    return response.json();
  },

  // ===== GALERI FOTO (multi-foto per desa) =====

  // GET gallery photos — publik
  async getGaleriFoto(id: number): Promise<ApiResponse<DesaFoto[]>> {
    if (isDemoMode()) {
      await demoDelay(200);
      return demoOk(demoGallery(id));
    }
    const response = await fetch(`${API_BASE}/${id}/fotos`);
    if (!response.ok) await throwApiError(response, 'Gagal mengambil galeri foto');
    return response.json();
  },

  // POST add photo to gallery (butuh login; hanya desa milik organisasi sendiri)
  async addGaleriFoto(id: number, data: DesaFotoRequest): Promise<ApiResponse<DesaFoto>> {
    const response = await fetch(`${API_BASE}/${id}/fotos`, {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ url: data.url, judul: data.judul ?? '', tipe: data.tipe ?? 'foto', ...(data.urutan !== undefined ? { urutan: data.urutan } : {}) }),
    });
    if (!response.ok) await throwApiError(response, 'Gagal menambahkan foto');
    return response.json();
  },

  // PUT update photo caption/order (butuh login)
  async updateGaleriFoto(id: number, fotoId: number, data: DesaFotoRequest): Promise<ApiResponse<DesaFoto>> {
    const response = await fetch(`${API_BASE}/${id}/fotos/${fotoId}`, {
      method: 'PUT',
      headers: authHeaders(true),
      body: JSON.stringify(data),
    });
    if (!response.ok) await throwApiError(response, 'Gagal memperbarui foto');
    return response.json();
  },

  // DELETE remove photo from gallery (butuh login; file fisik ikut dihapus bila unggahan)
  async deleteGaleriFoto(id: number, fotoId: number): Promise<ApiResponse<string>> {
    const response = await fetch(`${API_BASE}/${id}/fotos/${fotoId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal menghapus foto');
    return response.json();
  },

  // POST reset visitors (butuh login; hanya desa milik organisasi sendiri)
  async resetVisitors(id: number): Promise<ApiResponse<DesaWisata>> {
    const response = await fetch(`${API_BASE}/${id}/reset-visitors`, {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal reset pengunjung');
    return response.json();
  },
};
