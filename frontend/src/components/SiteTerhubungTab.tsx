import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, RefreshCw, Trash2, Power, Copy, Check,
  AlertCircle, ExternalLink, KeyRound, X, Activity,
} from 'lucide-react';
import { siteApi, type ApiClientItem } from '../api/siteApi';
import type { Organisasi } from '../types/desawisata';
import { organisasiApi } from '../api/organisasiApi';

interface Props {
  addToast: (message: string, type: 'success' | 'error') => void;
}

/** Kunci yang baru dibuat — ditampilkan sekali, bisa dicopy. */
interface FreshKey {
  namaWebsite: string;
  apiKey: string;
}

export default function SiteTerhubungTab({ addToast }: Props) {
  const [clients, setClients] = useState<ApiClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [organisasiList, setOrganisasiList] = useState<Organisasi[]>([]);
  const [freshKey, setFreshKey] = useState<FreshKey | null>(null);
  const [copied, setCopied] = useState(false);

  // form state
  const [nama, setNama] = useState('');
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [orgId, setOrgId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await siteApi.getClients();
      if (res.success) setClients(res.data);
    } catch {
      if (!silent) addToast('Gagal memuat daftar website terhubung', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    organisasiApi.getAll()
      .then((res) => { if (res.success) setOrganisasiList(res.data); })
      .catch(() => { /* dropdown fallback kosong */ });
  }, []);

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast('Gagal menyalin. Salin manual dari kotak.', 'error');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) return;
    setSubmitting(true);
    try {
      const res = await siteApi.register({
        namaWebsite: nama.trim(),
        urlWebsite: url.trim() || undefined,
        emailKontak: email.trim() || undefined,
        organisasiId: orgId ? parseInt(orgId) : undefined,
      });
      if (res.success && res.data.apiKey) {
        setFreshKey({ namaWebsite: res.data.namaWebsite, apiKey: res.data.apiKey });
        addToast(`Website "${res.data.namaWebsite}" terdaftar — simpan API key-nya!`, 'success');
        setShowRegister(false);
        setNama(''); setUrl(''); setEmail(''); setOrgId('');
        void load(true);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mendaftarkan website', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegenerate = async (c: ApiClientItem) => {
    if (!confirm(`Regenerate API key untuk "${c.namaWebsite}"? Key lama langsung tidak berlaku.`)) return;
    try {
      const res = await siteApi.regenerateKey(c.id);
      if (res.success && res.data.apiKey) {
        setFreshKey({ namaWebsite: res.data.namaWebsite, apiKey: res.data.apiKey });
        void load(true);
      }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal regenerate key', 'error');
    }
  };

  const handleToggle = async (c: ApiClientItem) => {
    try {
      const res = await siteApi.setStatus(c.id, !c.aktif);
      if (res.success) { addToast(res.message, 'success'); void load(true); }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (c: ApiClientItem) => {
    if (!confirm(`Hapus permanen klien "${c.namaWebsite}"? Website-nya tidak akan bisa akses API lagi.`)) return;
    try {
      const res = await siteApi.deleteClient(c.id);
      if (res.success) { addToast(res.message, 'success'); void load(true); }
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus klien', 'error');
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div style={{ padding: '0 32px 32px' }}>
      {/* Modal API key baru (sekali lihat) */}
      {freshKey && (
        <div className="modal-overlay" onClick={() => setFreshKey(null)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <KeyRound size={22} color="#16a34a" /> API Key Dibuat
              </h2>
              <button className="modal-close" onClick={() => setFreshKey(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 14, color: 'var(--text-secondary)', fontSize: '0.92rem' }}>
                API key untuk <strong>{freshKey.namaWebsite}</strong> berhasil dibuat.
                Key ini <strong style={{ color: '#dc2626' }}>hanya ditampilkan sekali</strong> —
                salin dan simpan sekarang sebelum menutup dialog ini.
              </p>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--gray-50)', border: '1.5px dashed var(--green-400)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <code style={{ flex: 1, fontSize: '0.86rem', wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--green-800)' }}>
                  {freshKey.apiKey}
                </code>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => void copyKey(freshKey.apiKey)}
                  style={{ flexShrink: 0 }}
                >
                  {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  {copied ? 'Tersalin' : 'Copy'}
                </button>
              </div>
              <p style={{ marginTop: 12, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Website klien mengirim key ini pada header: <code>X-Api-Key</code>
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary btn-sm" onClick={() => setFreshKey(null)}>
                Saya Sudah Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header + tombol daftar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '1.3rem', color: 'var(--green-900)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Globe size={22} /> Website Terhubung
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Website eksternal yang terdaftar ke API. Setiap website punya tenant & API key sendiri —
            data desa otomatis ter-scope ke organisasinya.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => void load()}><RefreshCw size={15} /> Refresh</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowRegister(true)}>
            <Plus size={15} /> Daftarkan Website
          </button>
        </div>
      </div>

      {/* Tabel klien */}
      <div className="table-container" style={{ margin: 0 }}>
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : clients.length === 0 ? (
          <div className="empty-state" style={{ padding: '48px 24px' }}>
            <div className="empty-state-icon"><Globe size={32} /></div>
            <h3>Belum Ada Website Terhubung</h3>
            <p>Daftarkan website eksternal pertama — tenant & API key dibuat otomatis.</p>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRegister(true)}>
              <Plus size={16} /> Daftarkan Website
            </button>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Website</th>
                <th>Tenant (Organisasi)</th>
                <th>API Key</th>
                <th>Request</th>
                <th>Terdaftar</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong>{c.namaWebsite}</strong>
                    {c.urlWebsite && (
                      <a href={c.urlWebsite} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#2563eb', marginTop: 2 }}>
                        <ExternalLink size={11} /> {c.urlWebsite.replace(/^https?:\/\//, '').slice(0, 30)}
                      </a>
                    )}
                    {c.emailKontak && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{c.emailKontak}</div>}
                  </td>
                  <td><span className="table-badge category">{c.organisasiNama || `Org #${c.organisasiId}`}</span></td>
                  <td><code style={{ fontSize: '0.75rem', background: 'var(--gray-50)', padding: '2px 8px', borderRadius: 6 }}>{c.keyPreview}</code></td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.82rem' }}>
                      <Activity size={13} color="#16a34a" /> {c.jumlahRequest.toLocaleString('id-ID')}
                    </span>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>terakhir: {formatDate(c.lastUsedAt)}</div>
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{formatDate(c.createdAt)}</td>
                  <td>
                    <span className={`table-badge ${c.aktif ? 'active' : 'inactive'}`}>
                      {c.aktif ? '🟢 Aktif' : '⚫ Nonaktif'}
                    </span>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button className="edit" title="Regenerate API key" onClick={() => void handleRegenerate(c)}>
                        <RefreshCw size={15} />
                      </button>
                      <button
                        className="edit"
                        title={c.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                        onClick={() => void handleToggle(c)}
                        style={c.aktif ? {} : { background: '#fef9c3', color: '#a16207' }}
                      >
                        <Power size={15} />
                      </button>
                      <button className="delete" title="Hapus permanen" onClick={() => void handleDelete(c)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal registrasi */}
      {showRegister && (
        <div className="modal-overlay" onClick={() => setShowRegister(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>🌐 Daftarkan Website Baru</h2>
              <button className="modal-close" onClick={() => setShowRegister(false)}><X size={18} /></button>
            </div>
            <form onSubmit={handleRegister}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{
                  display: 'flex', gap: 10, padding: '12px 16px', borderRadius: 12,
                  background: '#f0fdf4', border: '1px solid #bbf7d0', fontSize: '0.82rem', color: '#166534',
                  alignItems: 'flex-start',
                }}>
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>
                    Tenant (organisasi) dan API key akan <strong>digenerate otomatis</strong>.
                    API key hanya ditampilkan <strong>satu kali</strong> setelah pendaftaran.
                  </span>
                </div>
                <div className="form-group">
                  <label>Nama Website *</label>
                  <input
                    type="text" required
                    placeholder="mis. Portal Wisata Jawa Timur"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>URL Website</label>
                  <input
                    type="url"
                    placeholder="https://contoh.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Email Kontak</label>
                  <input
                    type="email"
                    placeholder="kontak@contoh.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Organisasi (opsional)</label>
                  <select value={orgId} onChange={(e) => setOrgId(e.target.value)}>
                    <option value="">— Auto-generate organisasi baru —</option>
                    {organisasiList.map((o) => (
                      <option key={o.id} value={o.id}>{o.namaOrganisasi}</option>
                    ))}
                  </select>
                  <small style={{ color: '#64748b' }}>
                    Jika dipilih, website hanya bisa melihat desa milik organisasi tersebut.
                  </small>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRegister(false)}>Batal</button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                  {submitting ? 'Mendaftarkan…' : 'Daftarkan & Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
