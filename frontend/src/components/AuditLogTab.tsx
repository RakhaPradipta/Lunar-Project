import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollText, RefreshCw, ShieldAlert, LogIn, LogInIcon, Pencil, Trash2, Plus, UserPlus, KeyRound, RotateCcw } from 'lucide-react';
import { auditLogApi } from '../api/auditLogApi';
import type { AuditLog } from '../types/desawisata';

interface AuditLogTabProps {
  addToast: (message: string, type: 'success' | 'error') => void;
}

/** Filter aksi yang tersedia (dropdown). */
const AKSI_FILTERS = [
  { value: '', label: 'Semua aksi' },
  { value: 'LoginSuccess', label: 'Login berhasil' },
  { value: 'LoginFailed', label: 'Login gagal' },
  { value: 'PasswordChanged', label: 'Ganti password' },
  { value: 'DesaCreate', label: 'Tambah desa' },
  { value: 'DesaUpdate', label: 'Ubah desa' },
  { value: 'DesaDelete', label: 'Hapus desa' },
  { value: 'FotoAdd', label: 'Tambah foto' },
  { value: 'VideoAdd', label: 'Tambah video' },
  { value: 'FotoDelete', label: 'Hapus foto/video' },
  { value: 'PengunjungCheckIn', label: 'Check-in' },
  { value: 'PengunjungCheckOut', label: 'Check-out' },
  { value: 'ResetVisitors', label: 'Reset pengunjung' },
  { value: 'OrgCreate', label: 'Buat organisasi' },
  { value: 'OrgDelete', label: 'Hapus organisasi' },
  { value: 'UserCreate', label: 'Buat user' },
  { value: 'UserDelete', label: 'Hapus user' },
];

/** Warna & ikon per kategori aksi. */
function aksiStyle(aksi: string): { icon: React.ReactNode; bg: string; color: string; border: string } {
  if (aksi === 'LoginSuccess') return { icon: <LogIn size={13} />, bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0' };
  if (aksi === 'LoginFailed') return { icon: <ShieldAlert size={13} />, bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
  if (aksi === 'PasswordChanged') return { icon: <KeyRound size={13} />, bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' };
  if (aksi.startsWith('DesaUpdate')) return { icon: <Pencil size={13} />, bg: '#fffbeb', color: '#d97706', border: '#fde68a' };
  if (aksi === 'DesaDelete' || aksi === 'OrgDelete' || aksi === 'UserDelete' || aksi.includes('Delete'))
    return { icon: <Trash2 size={13} />, bg: '#fef2f2', color: '#b91c1c', border: '#fecaca' };
  if (aksi.includes('Create')) return { icon: <Plus size={13} />, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
  if (aksi === 'UserCreate') return { icon: <UserPlus size={13} />, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
  if (aksi === 'ResetVisitors') return { icon: <RotateCcw size={13} />, bg: '#fdf4ff', color: '#a21caf', border: '#f5d0fe' };
  if (aksi.startsWith('PengunjungCheckIn')) return { icon: <LogInIcon size={13} />, bg: '#ecfeff', color: '#0e7490', border: '#a5f3fc' };
  return { icon: <ScrollText size={13} />, bg: '#f8fafc', color: '#475569', border: '#e2e8f0' };
}

export default function AuditLogTab({ addToast }: AuditLogTabProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [aksiFilter, setAksiFilter] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [limit, setLimit] = useState(100);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await auditLogApi.getAll({
        aksi: aksiFilter || undefined,
        email: emailFilter || undefined,
        limit,
      });
      if (res.success) setLogs(res.data);
    } catch {
      if (!silent) addToast('Gagal memuat audit log', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aksiFilter, emailFilter, limit]);

  useEffect(() => {
    void load();
  }, [load]);

  const formatWaktu = useMemo(
    () => (iso: string) =>
      new Date(iso).toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit',
      }),
    []
  );

  return (
    <div className="audit-log-tab">
      {/* Toolbar filter */}
      <div className="audit-toolbar">
        <select value={aksiFilter} onChange={(e) => setAksiFilter(e.target.value)} className="audit-filter-select">
          {AKSI_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Filter email…"
          value={emailFilter}
          onChange={(e) => setEmailFilter(e.target.value)}
          className="audit-filter-input"
        />
        <select value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="audit-filter-select">
          <option value={50}>50 terakhir</option>
          <option value={100}>100 terakhir</option>
          <option value={250}>250 terakhir</option>
          <option value={500}>500 terakhir</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={() => void load(true)}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabel log */}
      {loading ? (
        <div className="loading-spinner" style={{ padding: 48 }}><div className="spinner" /></div>
      ) : logs.length === 0 ? (
        <div className="gallery-empty" style={{ padding: 32 }}>
          <ScrollText size={20} /> Belum ada aktivitas tercatat.
        </div>
      ) : (
        <div className="audit-table-wrap">
          <table className="admin-table audit-table">
            <thead>
              <tr>
                <th>Waktu</th>
                <th>Aksi</th>
                <th>Keterangan</th>
                <th>User</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const style = aksiStyle(log.aksi);
                return (
                  <tr key={log.id} className={log.aksi === 'LoginFailed' || log.aksi.includes('Delete') ? 'audit-row-alert' : ''}>
                    <td className="audit-time">{formatWaktu(log.createdAt)}</td>
                    <td>
                      <span className="audit-badge" style={{ background: style.bg, color: style.color, borderColor: style.border }}>
                        {style.icon} {log.aksi}
                      </span>
                    </td>
                    <td className="audit-ket">{log.keterangan}</td>
                    <td className="audit-user">
                      <div>{log.email || '—'}</div>
                      <small>{log.role}</small>
                    </td>
                    <td className="audit-ip">{log.ipAddress || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
