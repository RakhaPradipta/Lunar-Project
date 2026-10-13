import type { ApiResponse, Organisasi, CreateOrganisasiRequest, UserAkun } from '../types/desawisata';
import { auth } from '../utils/auth';
import { throwApiError } from '../utils/apiError';
import { API_URL } from './config';

const API_BASE = `${API_URL}/api/Organisasi`;

function authHeaders(): HeadersInit {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function handle<T>(response: Response, fallbackError: string): Promise<ApiResponse<T>> {
  if (!response.ok) await throwApiError(response, fallbackError);
  return response.json();
}

export const organisasiApi = {
  async getAll(): Promise<ApiResponse<Organisasi[]>> {
    const response = await fetch(API_BASE, { headers: authHeaders() });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil data organisasi');
    return response.json();
  },

  async create(data: CreateOrganisasiRequest): Promise<ApiResponse<Organisasi>> {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<Organisasi>(response, 'Gagal membuat organisasi');
  },

  async update(id: number, data: Partial<CreateOrganisasiRequest> & { aktif?: boolean }): Promise<ApiResponse<Organisasi>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<Organisasi>(response, 'Gagal memperbarui organisasi');
  },

  async delete(id: number): Promise<ApiResponse<string>> {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handle<string>(response, 'Gagal menghapus organisasi');
  },

  async getUsers(): Promise<ApiResponse<UserAkun[]>> {
    const response = await fetch(`${API_BASE}/users`, { headers: authHeaders() });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil data user');
    return response.json();
  },

  async createUser(data: {
    email: string;
    password: string;
    namaLengkap?: string;
    role: string;
    organisasiId?: number | null;
  }): Promise<ApiResponse<UserAkun>> {
    const response = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(data),
    });
    return handle<UserAkun>(response, 'Gagal membuat user');
  },

  async deleteUser(id: number): Promise<ApiResponse<string>> {
    const response = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return handle<string>(response, 'Gagal menghapus user');
  },
};
