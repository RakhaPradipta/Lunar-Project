import type { ApiResponse, AuditLog } from '../types/desawisata';
import { auth } from '../utils/auth';
import { throwApiError } from '../utils/apiError';
import { API_URL } from './config';

const API_BASE = `${API_URL}/api/AuditLog`;

function authHeaders(): Record<string, string> {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const auditLogApi = {
  // GET daftar audit log (hanya SuperAdmin)
  async getAll(params?: { aksi?: string; entitas?: string; email?: string; limit?: number }): Promise<ApiResponse<AuditLog[]>> {
    const qs = new URLSearchParams();
    if (params?.aksi) qs.set('aksi', params.aksi);
    if (params?.entitas) qs.set('entitas', params.entitas);
    if (params?.email) qs.set('email', params.email);
    if (params?.limit) qs.set('limit', String(params.limit));
    const response = await fetch(`${API_BASE}?${qs.toString()}`, {
      headers: authHeaders(),
    });
    if (!response.ok) await throwApiError(response, 'Gagal mengambil audit log');
    return response.json();
  },
};
