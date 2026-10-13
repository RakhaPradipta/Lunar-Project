import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TreePine, LayoutDashboard, Database, Plus, Edit, Trash2,
  Search, BarChart3, Users, MapPin, Eye, X, LayoutGrid,
  Settings, Bell, ChevronDown, TrendingUp,
  ArrowUpRight, Calendar, Globe, Tag, AlertCircle, Home,
  Menu, PanelLeftClose, PanelLeftOpen, Sun, Moon, Map as MapIcon, LogOut, Sliders,
  Hourglass, ScrollText, Music2, List, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { desaWisataApi } from '../api/desawisataApi';
import { organisasiApi } from '../api/organisasiApi';
import type { DesaWisata, CreateDesaWisataRequest, Stats, Organisasi } from '../types/desawisata';
import { auth } from '../utils/auth';
import { usePolling } from '../utils/usePolling';
import { handleUnauthorized, isUnauthorizedError } from '../utils/apiError';
import Toast from '../components/Toast';
import ImageUpload from '../components/ImageUpload';
import GalleryUpload, { type GaleriFotoItem } from '../components/GalleryUpload';
import DesaMap from '../components/DesaMap';
import DesaDashboardModal from '../components/DesaDashboardModal';
import OrganisasiTab from '../components/OrganisasiTab';
import SiteTerhubungTab from '../components/SiteTerhubungTab';
import AuditLogTab from '../components/AuditLogTab';
import MusicSettingsTab from '../components/MusicSettingsTab';

type Tab = 'dashboard' | 'desadashboard' | 'data' | 'visitors' | 'map' | 'organisasi' | 'sites' | 'audit' | 'music' | 'settings';

export default function AdminDashboard() {
  const navigate = useNavigate();
  // Dibaca saat render (bukan module scope) supaya sesi login baru langsung dikenali tanpa reload
  const currentUser = auth.getUser();
  const isSuperAdmin = currentUser?.role === 'SuperAdmin';
  const [tab, setTab] = useState<Tab>('dashboard');
  const [desaList, setDesaList] = useState<DesaWisata[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState<DesaWisata | null>(null);
  const [editingDesa, setEditingDesa] = useState<DesaWisata | null>(null);
  const [toasts, setToasts] = useState<{ message: string; type: 'success' | 'error' }[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [filterKategori, setFilterKategori] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedDesaDashboard, setSelectedDesaDashboard] = useState<DesaWisata | null>(null);
  const [selectedDesaIdForTab, setSelectedDesaIdForTab] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try { return localStorage.getItem('dw_admin_theme') === 'dark'; } catch { return false; }
  });
  const [organisasiList, setOrganisasiList] = useState<Organisasi[]>([]);
  // Upgrade tab Data: view mode tabel/grid + pagination
  const [dataView, setDataView] = useState<'table' | 'grid'>('table');
  const [page, setPage] = useState(1);
  const pageSize = 8;

  // ===== Tema gelap/terang panel admin (dulu tombol matahari hanya dekorasi) =====
  useEffect(() => {
    document.documentElement.setAttribute('data-admin-theme', darkMode ? 'dark' : 'light');
    try { localStorage.setItem('dw_admin_theme', darkMode ? 'dark' : 'light'); } catch { /* private mode */ }
  }, [darkMode]);

  // ===== Notifikasi real (dulu panel kosong + dot merah statis):
  // booking tertunda yang harus dikonfirmasi & desa yang mendekati/melebihi kapasitas =====
  const notifications = useMemo(() => {
    const items: { id: string; emoji: string; text: string; tone: 'warn' | 'info' }[] = [];
    desaList.forEach((d) => {
      const pct = d.batasPengunjung > 0 ? Math.round((d.pengunjungHariIni / d.batasPengunjung) * 100) : 0;
      if (d.overtourism || pct >= 100) {
        items.push({ id: `ot-${d.id}`, emoji: '🔴', text: `${d.namaDesa} PENUH (${d.pengunjungHariIni}/${d.batasPengunjung}) — check-in otomatis terkunci.`, tone: 'warn' });
      } else if (pct >= (d.thresholdPeringatan || 80)) {
        items.push({ id: `wr-${d.id}`, emoji: '🟠', text: `${d.namaDesa} hampir penuh (${pct}%).`, tone: 'warn' });
      }
    });
    const tertunda = stats?.totalPemesananTertunda ?? 0;
    if (tertunda > 0) {
      items.push({ id: 'bk-total', emoji: '🕐', text: `${tertunda.toLocaleString('id-ID')} booking menunggu konfirmasi kedatangan.`, tone: 'info' });
    }
    return items;
  }, [desaList, stats]);

  const handleLogout = () => {
    void auth.logout().then(() => navigate('/'));
  };

  const getDefaultFormData = (desa?: DesaWisata): CreateDesaWisataRequest => ({
    namaDesa: desa?.namaDesa || '',
    kecamatan: desa?.kecamatan || '',
    kabupaten: desa?.kabupaten || '',
    provinsi: desa?.provinsi || '',
    deskripsi: desa?.deskripsi || '',
    lokasi: desa?.lokasi || '',
    urlGambar: desa?.urlGambar || '',
    urlWebsite: desa?.urlWebsite || '',
    urlFoto: desa?.urlFoto || '',
    urlVideo: desa?.urlVideo || '',
    rating: desa?.rating ?? 5,
    jumlahWisatawan: desa?.jumlahWisatawan ?? 0,
    kategori: desa?.kategori || 'Alam',
    aktif: desa?.aktif ?? true,
    latitude: desa?.latitude ?? 0,
    longitude: desa?.longitude ?? 0,
    batasPengunjung: desa?.batasPengunjung ?? 500,
    pengunjungHariIni: desa?.pengunjungHariIni ?? 0,
    overtourism: desa?.overtourism ?? false,
    thresholdPeringatan: desa?.thresholdPeringatan ?? 80,
    autoLockOvertourism: desa?.autoLockOvertourism ?? true,
    pesanPeringatan: desa?.pesanPeringatan || 'Kapasitas desa telah mencapai batas maksimal.',
    statusOperasional: desa?.statusOperasional || 'Buka',
    jamBuka: desa?.jamBuka || '08:00',
    jamTutup: desa?.jamTutup || '17:00',
    hariOperasional: desa?.hariOperasional || 'Senin - Minggu',
    kontakPengelola: desa?.kontakPengelola || '',
    emailPengelola: desa?.emailPengelola || '',
    socialMedia: desa?.socialMedia || '',
    hargaTiketLokal: desa?.hargaTiketLokal ?? 10000,
    hargaTiketMancanegara: desa?.hargaTiketMancanegara ?? 50000,
    hargaParkirMotor: desa?.hargaParkirMotor ?? 3000,
    hargaParkirMobil: desa?.hargaParkirMobil ?? 10000,
    persenPajakDaerah: desa?.persenPajakDaerah ?? 10,
    fasilitas: desa?.fasilitas || 'Toilet, Area Parkir, Musholla, Homestay, WiFi',
    organisasiId: desa?.organisasiId,
  });

  const [formData, setFormData] = useState<CreateDesaWisataRequest>(getDefaultFormData());
  const [galeriFotos, setGaleriFotos] = useState<GaleriFotoItem[]>([]);

  const addToast = (message: string, type: 'success' | 'error') => {
    setToasts((prev) => [...prev, { message, type }]);
  };

  const loadData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // Tenant scoping: admin organisasi hanya melihat desa milik organisasinya
      const [desaResponse, statsResponse] = await Promise.all([
        desaWisataApi.getAll({ search: search || undefined, mine: !isSuperAdmin }),
        desaWisataApi.getStats(!isSuperAdmin),
      ]);
      if (desaResponse.success) setDesaList(desaResponse.data);
      if (statsResponse.success) setStats(statsResponse.data);
      if (desaResponse.success || statsResponse.success) setLastUpdated(new Date());
      // Dashboard admin: tidak ada banner error persisten, tapi pastikan juga pulih
      // dari kegagalan sementara (toast sudah cukup untuk kasus non-silent).
    } catch (err) {
      console.error('Error loading data:', err);
      // 401 = sesi login berakhir (bukan backend mati): bersihkan sesi & arahkan ke login.
      // Berlaku juga saat polling senyap agar user tetap diarahkan walau sedang tidak melihat layar.
      if (isUnauthorizedError(err)) {
        handleUnauthorized();
        return;
      }
      if (!silent) {
        addToast(
          err instanceof Error ? err.message : 'Gagal memuat data. Pastikan backend berjalan.',
          'error',
        );
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [search]);

  useEffect(() => { loadData(); }, [loadData]);

  // Muat daftar organisasi untuk dropdown pemilik desa (SuperAdmin)
  useEffect(() => {
    if (!isSuperAdmin) return;
    organisasiApi.getAll()
      .then((res) => { if (res.success) setOrganisasiList(res.data); })
      .catch(() => {/* abaikan; dropdown fallback kosong */});
  }, []);

  // Auto-refresh in the background so stat cards, tables and per-desa dashboards stay live
  usePolling(() => {
    void loadData(true);
  });

  const resetForm = () => {
    setFormData(getDefaultFormData());
    setEditingDesa(null);
    setGaleriFotos([]);
  };

  const openCreateModal = () => { resetForm(); setShowModal(true); };

  const openEditModal = (desa: DesaWisata) => {
    setEditingDesa(desa);
    setFormData(getDefaultFormData(desa));
    setGaleriFotos((desa.galeriFoto ?? []).map((f) => ({ id: f.id, url: f.url, judul: f.judul, tipe: f.tipe })));
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let desaId: number;
      if (editingDesa) {
        await desaWisataApi.update(editingDesa.id, formData);
        desaId = editingDesa.id;
      } else {
        const res = await desaWisataApi.create(formData);
        if (!res.success || !res.data?.id) throw new Error('Gagal menambahkan data');
        desaId = res.data.id;
      }

      // Sinkronkan galeri multi-foto dengan server
      const fotoErrors: string[] = [];
      if (editingDesa) {
        const keptIds = new Set(
          galeriFotos.filter((f) => f.id && f.id > 0).map((f) => f.id as number)
        );
        // Hapus foto yang dibuang admin dari daftar
        for (const f of editingDesa.galeriFoto ?? []) {
          if (!keptIds.has(f.id)) {
            try { await desaWisataApi.deleteGaleriFoto(desaId, f.id); }
            catch { fotoErrors.push(`hapus foto #${f.id}`); }
          }
        }
      }
      // Tambah foto baru & perbarui urutan/judul sesuai daftar terkini
      for (let i = 0; i < galeriFotos.length; i++) {
        const f = galeriFotos[i];
        try {
          if (f.id && f.id > 0) {
            await desaWisataApi.updateGaleriFoto(desaId, f.id, { url: f.url, judul: f.judul, tipe: f.tipe ?? 'foto', urutan: i });
          } else {
            await desaWisataApi.addGaleriFoto(desaId, { url: f.url, judul: f.judul, tipe: f.tipe ?? 'foto', urutan: i });
          }
        } catch { fotoErrors.push(`simpan foto #${i + 1}`); }
      }

      addToast(
        fotoErrors.length > 0
          ? `Data desa tersimpan, namun ${fotoErrors.length} foto gagal diproses.`
          : editingDesa ? 'Data berhasil diperbarui!' : 'Data berhasil ditambahkan!',
        fotoErrors.length > 0 ? 'error' : 'success'
      );
      setShowModal(false); resetForm(); loadData();
    } catch { addToast('Gagal menyimpan data', 'error'); }
  };

  const handleDelete = async (id: number, nama: string) => {
    if (!confirm(`Yakin ingin menghapus "${nama}"?`)) return;
    try { await desaWisataApi.delete(id); addToast('Data berhasil dihapus!', 'success'); loadData(); }
    catch { addToast('Gagal menghapus data', 'error'); }
  };

  const formatNumber = (num: number) => num.toLocaleString('id-ID');

  const formatLastUpdated = (date: Date) =>
    date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  const filteredDesaList = desaList.filter((d) => {
    if (filterKategori && d.kategori !== filterKategori) return false;
    if (filterStatus === 'aktif' && !d.aktif) return false;
    if (filterStatus === 'nonaktif' && d.aktif) return false;
    return true;
  });

  // Reset ke halaman 1 saat filter/daftar berubah drastis
  const totalPages = Math.max(1, Math.ceil(filteredDesaList.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);
  const pagedDesaList = filteredDesaList.slice((page - 1) * pageSize, page * pageSize);

  // Calculate top desa by visitors
  const topDesa = [...desaList].sort((a, b) => b.jumlahWisatawan - a.jumlahWisatawan).slice(0, 5);

  return (
    <div className="admin-layout">
      {/* ===== SIDEBAR ===== */}
      {/* Overlay diletakkan DI LUAR <aside>: di mobile aside di-transform, dan elemen dengan transform
          menjadi containing-block untuk position:fixed — sehingga overlay di dalamnya tidak bisa menutupi
          viewport. Di luar, overlay bisa fade mulus dan tap-to-close bekerja di seluruh layar. */}
      <div
        className={`admin-sidebar-overlay ${mobileSidebarOpen ? 'visible' : ''}`}
        onClick={() => setMobileSidebarOpen(false)}
        aria-hidden="true"
      />
      <aside className={`admin-sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
        <div className="admin-sidebar-inner">
          {/* Logo */}
          <div className="admin-sidebar-header">
            <Link to="/" className="admin-sidebar-logo">
              <div className="admin-sidebar-logo-icon">
                <TreePine size={22} color="white" />
              </div>
              {!sidebarCollapsed && (
                <div className="admin-sidebar-brand">
                  <h3>DesaWisata</h3>
                  <span>Admin Panel</span>
                </div>
              )}
            </Link>
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
            </button>
          </div>

          {/* Main Navigation */}
          <div className="admin-sidebar-section">
            <span className="sidebar-section-label">Menu Utama</span>
            <nav className="admin-nav" onClick={() => setMobileSidebarOpen(false)}>
              <button
                className={`admin-nav-link ${tab === 'dashboard' ? 'active' : ''}`}
                onClick={() => setTab('dashboard')}
              >
                <LayoutDashboard size={20} />
                {!sidebarCollapsed && <span>Dashboard Global</span>}
              </button>
              <button
                className={`admin-nav-link ${tab === 'desadashboard' ? 'active' : ''}`}
                onClick={() => setTab('desadashboard')}
              >
                <Sliders size={20} />
                {!sidebarCollapsed && <span>Dashboard Per-Desa</span>}
              </button>
              <button
                className={`admin-nav-link ${tab === 'data' ? 'active' : ''}`}
                onClick={() => setTab('data')}
              >
                <Database size={20} />
                {!sidebarCollapsed && <span>Data Desa Wisata</span>}
                {!sidebarCollapsed && desaList.length > 0 && (
                  <span className="sidebar-badge">{desaList.length}</span>
                )}
              </button>
              <button
                className={`admin-nav-link ${tab === 'visitors' ? 'active' : ''}`}
                onClick={() => setTab('visitors')}
              >
                <Users size={20} />
                {!sidebarCollapsed && <span>Pengunjung</span>}
                {!sidebarCollapsed && stats && stats.desaOvertourism > 0 && (
                  <span className="sidebar-badge" style={{ background: '#dc2626' }}>{stats.desaOvertourism}</span>
                )}
              </button>
              <button
                className={`admin-nav-link ${tab === 'map' ? 'active' : ''}`}
                onClick={() => setTab('map')}
              >
                <MapIcon size={20} />
                {!sidebarCollapsed && <span>Peta</span>}
              </button>
              {isSuperAdmin && (
                <button
                  className={`admin-nav-link ${tab === 'organisasi' ? 'active' : ''}`}
                  onClick={() => setTab('organisasi')}
                >
                  <Globe size={20} />
                  {!sidebarCollapsed && <span>Organisasi</span>}
                </button>
              )}
              {isSuperAdmin && (
                <button
                  className={`admin-nav-link ${tab === 'sites' ? 'active' : ''}`}
                  onClick={() => setTab('sites')}
                >
                  <Globe size={20} />
                  {!sidebarCollapsed && <span>Website Terhubung</span>}
                </button>
              )}
              {isSuperAdmin && (
                <button
                  className={`admin-nav-link ${tab === 'audit' ? 'active' : ''}`}
                  onClick={() => setTab('audit')}
                >
                  <ScrollText size={20} />
                  {!sidebarCollapsed && <span>Audit Log</span>}
                </button>
              )}
              <button
                className={`admin-nav-link ${tab === 'music' ? 'active' : ''}`}
                onClick={() => setTab('music')}
              >
                <Music2 size={20} />
                {!sidebarCollapsed && <span>Musik Latar</span>}
              </button>
              <button
                className={`admin-nav-link ${tab === 'settings' ? 'active' : ''}`}
                onClick={() => setTab('settings')}
              >
                <Settings size={20} />
                {!sidebarCollapsed && <span>Pengaturan</span>}
              </button>
            </nav>
          </div>

          {/* Quick Links */}
          <div className="admin-sidebar-section">
            <span className="sidebar-section-label">Navigasi</span>
            <nav className="admin-nav" onClick={() => setMobileSidebarOpen(false)}>
              <Link to="/" className="admin-nav-link">
                <Home size={20} />
                {!sidebarCollapsed && <span>Landing Page</span>}
              </Link>
            </nav>
          </div>

          {/* Sidebar Footer - User Profile */}
          <div className="admin-sidebar-footer">
            <div className="sidebar-user">
              <div className="sidebar-user-avatar">
                <span>{(currentUser?.namaLengkap || 'AD').slice(0, 2).toUpperCase()}</span>
              </div>
              {!sidebarCollapsed && (
                <div className="sidebar-user-info">
                  <span className="sidebar-user-name">{auth.getDisplayName()}</span>
                  <span className="sidebar-user-role">
                    {isSuperAdmin ? 'Super Admin' : currentUser?.organisasiNama || 'Admin Organisasi'}
                  </span>
                </div>
              )}
              {!sidebarCollapsed && (
                <button className="sidebar-user-menu" title="Menu pengguna">
                  <ChevronDown size={16} />
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* ===== MAIN CONTENT ===== */}
      <main className={`admin-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Bar */}
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <button
              className={`admin-topbar-menu-btn mobile-only ${mobileSidebarOpen ? 'open' : ''}`}
              onClick={() => setMobileSidebarOpen((v) => !v)}
              aria-label={mobileSidebarOpen ? 'Tutup menu sidebar' : 'Buka menu sidebar'}
              aria-expanded={mobileSidebarOpen}
            >
              {mobileSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="admin-breadcrumb">
              <span className="breadcrumb-item">Admin</span>
              <span className="breadcrumb-sep">/</span>
              <span className="breadcrumb-item active">
                {tab === 'dashboard' && 'Dashboard Global'}
                {tab === 'desadashboard' && 'Dashboard & Pengaturan Per-Desa'}
                {tab === 'data' && 'Data Desa Wisata'}
                {tab === 'visitors' && 'Manajemen Pengunjung'}
                {tab === 'map' && 'Peta'}
                {tab === 'organisasi' && 'Manajemen Organisasi'}
                {tab === 'sites' && 'Website Terhubung'}
                {tab === 'audit' && 'Audit Log'}
                {tab === 'music' && 'Musik Latar'}
                {tab === 'settings' && 'Pengaturan'}
              </span>
            </div>
          </div>
          <div className="admin-topbar-right">
            <button
              className="topbar-icon-btn"
              onClick={() => setDarkMode((v) => !v)}
              title={darkMode ? 'Mode terang' : 'Mode gelap'}
              aria-pressed={darkMode}
            >
              {darkMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button
              className="topbar-icon-btn notif-btn"
              onClick={() => setShowNotifPanel(!showNotifPanel)}
              title="Notifikasi"
              aria-expanded={showNotifPanel}
            >
              <Bell size={18} />
              {notifications.length > 0 && <span className="notif-dot"></span>}
            </button>
            {showNotifPanel && (
              <div style={{
                position: 'absolute', right: 120, top: 64, width: 320, maxHeight: 380, overflow: 'auto',
                background: 'white', border: '1px solid var(--gray-200)', borderRadius: 14,
                boxShadow: '0 16px 40px rgba(0,0,0,0.14)', padding: 12, zIndex: 200,
              }} role="dialog" aria-label="Panel notifikasi">
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0f172a', padding: '4px 6px 10px', borderBottom: '1px solid var(--gray-100)' }}>
                  🔔 Notifikasi ({notifications.length})
                </div>
                {notifications.length === 0 ? (
                  <div style={{ padding: '18px 8px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                    ✅ Semua aman! Tidak ada peringatan kapasitas atau booking tertunda.
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} style={{
                      display: 'flex', gap: 10, padding: '10px 8px', borderRadius: 10,
                      background: n.tone === 'warn' ? '#fff7ed' : '#f0fdf4', marginBottom: 6,
                      fontSize: '0.84rem', color: n.tone === 'warn' ? '#9a3412' : '#166534', lineHeight: 1.5,
                    }}>
                      <span style={{ flexShrink: 0 }}>{n.emoji}</span>
                      <span>{n.text}</span>
                    </div>
                  ))
                )}
              </div>
            )}
            <div className="topbar-divider"></div>
            <div style={{ position: 'relative' }}>
              <button
                className="topbar-profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="topbar-avatar">
                  <span>{(currentUser?.namaLengkap || 'AD').slice(0, 2).toUpperCase()}</span>
                </div>
                <span className="topbar-profile-name">{isSuperAdmin ? 'Super Admin' : 'Admin'}</span>
                <ChevronDown size={14} />
              </button>
              {showProfileMenu && (
                <div style={{
                  position: 'absolute', right: 0, top: '100%', marginTop: 8,
                  background: 'white', border: '1px solid var(--gray-200)',
                  borderRadius: 12, boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                  padding: 8, minWidth: 180, zIndex: 100
                }}>
                  <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gray-100)', marginBottom: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-color)' }}>{auth.getDisplayName()}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{auth.getEmail()}</div>
                    {!isSuperAdmin && currentUser?.organisasiNama && (
                      <div style={{ fontSize: '0.72rem', color: 'var(--green-700)', fontWeight: 600, marginTop: 2 }}>
                        🏢 {currentUser.organisasiNama}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: 'none', background: 'none',
                      borderRadius: 8, color: '#dc2626', fontSize: '0.85rem',
                      fontWeight: 600, cursor: 'pointer', textAlign: 'left'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#fef2f2')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={16} />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Toast Container */}
        <div className="toast-container">
          {toasts.map((toast, index) => (
            <Toast
              key={index}
              message={toast.message}
              type={toast.type}
              onClose={() => setToasts((prev) => prev.filter((_, i) => i !== index))}
            />
          ))}
        </div>

        {/* ===== DASHBOARD TAB ===== */}
        {tab === 'dashboard' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">Dashboard Overview</h1>
                <p className="admin-page-subtitle">
                  {isSuperAdmin
                    ? 'Selamat datang di panel admin DesaWisata Nusantara'
                    : `Selamat datang, ${currentUser?.organisasiNama || 'Admin Organisasi'}`}
                </p>
              </div>
              <div className="admin-page-actions">
                <span
                  title="Waktu terakhir data berhasil dimuat dari server (termasuk refresh otomatis)"
                  style={{
                    fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)',
                    display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap'
                  }}
                >
                  🕒 Terakhir diperbarui: {lastUpdated ? formatLastUpdated(lastUpdated) : 'menunggu...'}
                </span>
                <button className="btn btn-secondary btn-sm" onClick={() => loadData()}>
                  <TrendingUp size={16} />
                  Refresh
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => { setTab('data'); openCreateModal(); }}>
                  <Plus size={16} />
                  Tambah Baru
                </button>
              </div>
            </div>

            {stats && (
              <>
                {/* Stat Cards */}
                <div className="stat-grid">
                  <div className="stat-card stat-card-total">
                    <div className="stat-card-header">
                      <div className="stat-card-icon green"><TreePine size={24} /></div>
                      <span className="stat-card-trend up">
                        <ArrowUpRight size={14} /> 12%
                      </span>
                    </div>
                    <div className="stat-card-body">
                      <h3>{stats.totalDesa}</h3>
                      <p>Total Desa Wisata</p>
                    </div>
                    <div className="stat-card-footer">
                      <span>Dari {stats.provinsiCounts.length} provinsi</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-active">
                    <div className="stat-card-header">
                      <div className="stat-card-icon blue"><LayoutGrid size={24} /></div>
                      <span className="stat-card-trend up">
                        <ArrowUpRight size={14} /> 8%
                      </span>
                    </div>
                    <div className="stat-card-body">
                      <h3>{stats.desaAktif}</h3>
                      <p>Desa Aktif</p>
                    </div>
                    <div className="stat-card-footer">
                      <span>{stats.totalDesa - stats.desaAktif} nonaktif</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-visitors">
                    <div className="stat-card-header">
                      <div className="stat-card-icon purple"><Users size={24} /></div>
                      <span className="stat-card-trend up">
                        <ArrowUpRight size={14} /> 24%
                      </span>
                    </div>
                    <div className="stat-card-body">
                      <h3>{(stats.totalWisatawan / 1000).toFixed(0)}K+</h3>
                      <p>Total Wisatawan</p>
                    </div>
                    <div className="stat-card-footer">
                      <span>Rata-rata {Math.round(stats.totalWisatawan / stats.totalDesa).toLocaleString('id-ID')}/desa</span>
                    </div>
                  </div>
                  <div className="stat-card stat-card-categories">
                    <div className="stat-card-header">
                      <div className="stat-card-icon amber"><Tag size={24} /></div>
                    </div>
                    <div className="stat-card-body">
                      <h3>{stats.kategoriCounts.length}</h3>
                      <p>Kategori Wisata</p>
                    </div>
                    <div className="stat-card-footer">
                      <span>{stats.kategoriCounts.map(k => k.kategori).join(', ')}</span>
                    </div>
                  </div>
                </div>

                {/* Charts Row */}
                <div className="admin-charts-row">
                  {/* Bar Chart - Kategori */}
                  <div className="admin-chart-card">
                    <div className="admin-chart-header">
                      <h3>📊 Distribusi Kategori</h3>
                    </div>
                    <div className="admin-chart-body">
                      {stats.kategoriCounts.map((item) => {
                        const maxCount = Math.max(...stats.kategoriCounts.map(k => k.jumlah));
                        const percentage = (item.jumlah / maxCount) * 100;
                        return (
                          <div key={item.kategori} className="chart-bar-row">
                            <span className="chart-bar-label">{item.kategori}</span>
                            <div className="chart-bar-track">
                              <div
                                className="chart-bar-fill"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="chart-bar-value">{item.jumlah}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Bar Chart - Provinsi */}
                  <div className="admin-chart-card">
                    <div className="admin-chart-header">
                      <h3>🗺️ Distribusi Provinsi</h3>
                    </div>
                    <div className="admin-chart-body">
                      {stats.provinsiCounts.sort((a, b) => b.jumlah - a.jumlah).map((item) => {
                        const maxCount = Math.max(...stats.provinsiCounts.map(p => p.jumlah));
                        const percentage = (item.jumlah / maxCount) * 100;
                        return (
                          <div key={item.provinsi} className="chart-bar-row">
                            <span className="chart-bar-label">{item.provinsi.length > 20 ? item.provinsi.substring(0, 20) + '...' : item.provinsi}</span>
                            <div className="chart-bar-track">
                              <div
                                className="chart-bar-fill blue"
                                style={{ width: `${percentage}%` }}
                              ></div>
                            </div>
                            <span className="chart-bar-value">{item.jumlah}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Top Desa & Recent Activity */}
                <div className="admin-bottom-row">
                  {/* Top Desa by Visitors */}
                  <div className="table-container">
                    <div className="table-header">
                      <h2><TrendingUp size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Top 5 Wisatawan</h2>
                    </div>
                    <table>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Nama Desa</th>
                          <th>Wisatawan</th>
                          <th>Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {topDesa.map((desa, idx) => (
                          <tr key={desa.id}>
                            <td>
                              <span className={`top-rank top-rank-${idx + 1}`}>
                                {idx + 1}
                              </span>
                            </td>
                            <td><strong>{desa.namaDesa}</strong></td>
                            <td><strong>{formatNumber(desa.jumlahWisatawan)}</strong></td>
                            <td>⭐ {desa.rating}/5</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Recent Activity */}
                  <div className="table-container">
                    <div className="table-header">
                      <h2><Calendar size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Aktivitas Terbaru</h2>
                    </div>
                    <div className="activity-list">
                      {desaList.slice(0, 6).map((desa) => (
                        <div key={desa.id} className="activity-item">
                          <div className="activity-icon">
                            <Globe size={16} />
                          </div>
                          <div className="activity-content">
                            <span className="activity-text">
                              <strong>{desa.namaDesa}</strong> tercatat dengan {formatNumber(desa.jumlahWisatawan)} wisatawan
                            </span>
                            <span className="activity-time">{desa.kategori} • {desa.provinsi}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ===== PER-DESA DASHBOARD TAB ===== */}
        {tab === 'desadashboard' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">📊 Dashboard & Pengaturan Per-Desa</h1>
                <p className="admin-page-subtitle">Setiap desa wisata memiliki dashboard dan sistem pengaturan overtourism tersendiri</p>
              </div>
            </div>

            <div style={{ padding: '0 32px 24px' }}>
              <div style={{
                background: 'linear-gradient(135deg, #f0fdf4, #e6f4ea)',
                border: '1px solid #bbf7d0', borderRadius: 16, padding: 24, marginBottom: 28
              }}>
                <label style={{ display: 'block', fontWeight: 800, color: 'var(--green-900)', fontSize: '1.1rem', marginBottom: 8 }}>
                  🎯 Pilih Desa Wisata Untuk Dikelola:
                </label>
                <select
                  value={selectedDesaIdForTab || ''}
                  onChange={(e) => {
                    const id = parseInt(e.target.value);
                    const found = desaList.find(d => d.id === id);
                    if (found) {
                      setSelectedDesaIdForTab(found.id);
                      setSelectedDesaDashboard(found);
                    }
                  }}
                  style={{
                    width: '100%', maxWidth: 500, padding: '12px 16px', borderRadius: 10,
                    border: '1.5px solid var(--green-700)', fontSize: '1rem', fontWeight: 600,
                    background: 'white', outline: 'none'
                  }}
                >
                  <option value="">-- Klik untuk memilih desa wisata --</option>
                  {desaList.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.namaDesa} ({d.kabupaten}, {d.provinsi}) - {d.pengunjungHariIni}/{d.batasPengunjung} Pengunjung
                    </option>
                  ))}
                </select>
              </div>

              {/* Grid of all village dashboard cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                {desaList.map((desa) => {
                  const pct = desa.batasPengunjung > 0 ? Math.round((desa.pengunjungHariIni / desa.batasPengunjung) * 100) : 0;
                  const isFull = pct >= 100 || desa.overtourism;
                  const isWarn = pct >= (desa.thresholdPeringatan || 80) && !isFull;
                  return (
                    <div
                      key={desa.id}
                      style={{
                        background: 'white', borderRadius: 16, border: '1px solid var(--gray-200)',
                        overflow: 'hidden', boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                        display: 'flex', flexDirection: 'column'
                      }}
                    >
                      <div style={{ position: 'relative', height: 140 }}>
                        <img
                          src={desa.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'}
                          alt={desa.namaDesa}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <span style={{
                          position: 'absolute', top: 12, right: 12, padding: '4px 10px',
                          borderRadius: 100, fontSize: '0.75rem', fontWeight: 700, color: 'white',
                          background: isFull ? '#dc2626' : isWarn ? '#f59e0b' : '#16a34a'
                        }}>
                          {isFull ? '🔴 Overtourism' : isWarn ? '🟡 Hampir Penuh' : '🟢 Normal'}
                        </span>
                      </div>
                      <div style={{ padding: 18, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
                            {desa.namaDesa}
                          </h4>
                          <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>
                            📍 {desa.kabupaten}, {desa.provinsi}
                          </p>

                          <div style={{ marginTop: 12, padding: '10px 12px', background: '#f8fafc', borderRadius: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 700, marginBottom: 4 }}>
                              <span>Kapasitas Hari Ini:</span>
                              <span style={{ color: isFull ? '#dc2626' : isWarn ? '#d97706' : '#16a34a' }}>
                                {desa.pengunjungHariIni}/{desa.batasPengunjung} ({pct}%)
                              </span>
                            </div>
                            <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{
                                width: `${Math.min(pct, 100)}%`, height: '100%',
                                background: isFull ? '#dc2626' : isWarn ? '#f59e0b' : '#22c55e'
                              }}></div>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDesaIdForTab(desa.id);
                            setSelectedDesaDashboard(desa);
                          }}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 16, width: '100%', justifyContent: 'center', gap: 6 }}
                        >
                          <Sliders size={16} />
                          Buka Dashboard {desa.namaDesa}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ===== DATA TAB ===== */}
        {tab === 'data' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">Data Desa Wisata</h1>
                <p className="admin-page-subtitle">Kelola seluruh data desa wisata Indonesia</p>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
                <Plus size={16} />
                Tambah Baru
              </button>
            </div>

            <div className="table-container">
              <div className="table-header">
                <div className="table-header-left">
                  <h2>Seluruh Data</h2>
                  <div className="table-filters">
                    <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)}>
                      <option value="">Semua Kategori</option>
                      {['Alam', 'Budaya', 'Pantai', 'Kuliner', 'Religi'].map((k) => (
                        <option key={k} value={k}>{k}</option>
                      ))}
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                      <option value="">Semua Status</option>
                      <option value="aktif">Aktif</option>
                      <option value="nonaktif">Nonaktif</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="destinasi-view-toggle">
                    <button
                      type="button"
                      className={dataView === 'table' ? 'active' : ''}
                      onClick={() => setDataView('table')}
                      title="Tampilan tabel"
                      aria-label="Tampilan tabel"
                    >
                      <List size={16} />
                    </button>
                    <button
                      type="button"
                      className={dataView === 'grid' ? 'active' : ''}
                      onClick={() => setDataView('grid')}
                      title="Tampilan kartu"
                      aria-label="Tampilan kartu"
                    >
                      <LayoutGrid size={16} />
                    </button>
                  </div>
                  <div className="table-search">
                    <Search size={18} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Cari desa wisata..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
              ) : filteredDesaList.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon"><Database size={36} /></div>
                  <h3>Tidak Ada Data</h3>
                  <p>{search ? 'Tidak ditemukan hasil pencarian.' : 'Mulai tambahkan data desa wisata baru.'}</p>
                  {!search && (
                    <button className="btn btn-primary" onClick={openCreateModal}>
                      <Plus size={18} /> Tambah Data Pertama
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {dataView === 'table' ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Gambar</th>
                          <th>Nama Desa</th>
                          <th>Lokasi</th>
                          <th>Kategori</th>
                          <th>Rating</th>
                          <th>Wisatawan</th>
                          <th>Status</th>
                          <th>Aksi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedDesaList.map((desa) => (
                          <tr key={desa.id}>
                            <td>
                              <img
                                src={desa.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'}
                                alt={desa.namaDesa}
                                className="table-image"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
                                }}
                              />
                            </td>
                            <td><strong>{desa.namaDesa}</strong></td>
                            <td>{desa.kabupaten}, {desa.provinsi}</td>
                            <td><span className="table-badge category">{desa.kategori}</span></td>
                            <td>⭐ {desa.rating}/5</td>
                            <td>{formatNumber(desa.jumlahWisatawan)}</td>
                            <td>
                              <span className={`table-badge ${desa.aktif ? 'active' : 'inactive'}`}>
                                {desa.aktif ? 'Aktif' : 'Nonaktif'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button className="edit" title="Buka Dashboard & Pengaturan Desa" onClick={() => setSelectedDesaDashboard(desa)} style={{ background: '#f0fdf4', color: 'var(--green-800)', borderColor: '#bbf7d0' }}>
                                  <Sliders size={16} />
                                </button>
                                <button className="edit" title="Lihat Detail" onClick={() => setShowDetail(desa)}>
                                  <Eye size={16} />
                                </button>
                                <button className="edit" title="Edit" onClick={() => openEditModal(desa)}>
                                  <Edit size={16} />
                                </button>
                                <button className="delete" title="Hapus" onClick={() => handleDelete(desa.id, desa.namaDesa)}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="admin-data-grid">
                      {pagedDesaList.map((desa) => (
                        <div key={desa.id} className="admin-data-card">
                          <div className="admin-data-card-img">
                            <img
                              src={desa.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'}
                              alt={desa.namaDesa}
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
                              }}
                            />
                            <span className={`table-badge ${desa.aktif ? 'active' : 'inactive'}`}>
                              {desa.aktif ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </div>
                          <div className="admin-data-card-body">
                            <h4>{desa.namaDesa}</h4>
                            <p>📍 {desa.kabupaten}, {desa.provinsi}</p>
                            <div className="admin-data-card-meta">
                              <span className="table-badge category">{desa.kategori}</span>
                              <span>⭐ {desa.rating}/5</span>
                              <span>👥 {formatNumber(desa.jumlahWisatawan)}</span>
                            </div>
                            <div className="table-actions">
                              <button className="edit" title="Buka Dashboard & Pengaturan Desa" onClick={() => setSelectedDesaDashboard(desa)} style={{ background: '#f0fdf4', color: 'var(--green-800)', borderColor: '#bbf7d0' }}>
                                <Sliders size={16} />
                              </button>
                              <button className="edit" title="Lihat Detail" onClick={() => setShowDetail(desa)}>
                                <Eye size={16} />
                              </button>
                              <button className="edit" title="Edit" onClick={() => openEditModal(desa)}>
                                <Edit size={16} />
                              </button>
                              <button className="delete" title="Hapus" onClick={() => handleDelete(desa.id, desa.namaDesa)}>
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="table-pagination">
                    <span>
                      Menampilkan {pagedDesaList.length} dari {filteredDesaList.length} data
                      {filteredDesaList.length !== desaList.length && ` (total ${desaList.length})`}
                    </span>
                    {totalPages > 1 && (
                      <div className="pagination-controls">
                        <button
                          type="button"
                          disabled={page === 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          aria-label="Halaman sebelumnya"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                          .map((p, idx, arr) => (
                            <span key={p} style={{ display: 'contents' }}>
                              {idx > 0 && p - arr[idx - 1] > 1 && <span className="pagination-ellipsis">…</span>}
                              <button
                                type="button"
                                className={p === page ? 'active' : ''}
                                onClick={() => setPage(p)}
                              >
                                {p}
                              </button>
                            </span>
                          ))}
                        <button
                          type="button"
                          disabled={page === totalPages}
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          aria-label="Halaman berikutnya"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ===== VISITOR MANAGEMENT TAB ===== */}
        {tab === 'visitors' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">👤 Manajemen Pengunjung</h1>
                <p className="admin-page-subtitle">Monitor dan atur kapasitas pengunjung untuk mencegah overtourism</p>
              </div>
            </div>

            {/* Overtourism Stats */}
            {stats && (
              <div className="stat-grid" style={{ marginBottom: 28 }}>
                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon green"><Users size={24} /></div>
                  </div>
                  <div className="stat-card-body">
                    <h3>{stats.totalPengunjungHariIni}</h3>
                    <p>Pengunjung Hari Ini</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon amber"><AlertCircle size={24} /></div>
                  </div>
                  <div className="stat-card-body">
                    <h3 style={{ color: stats.desaOvertourism > 0 ? '#dc2626' : undefined }}>{stats.desaOvertourism}</h3>
                    <p>Desa Overtourism</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon blue"><LayoutGrid size={24} /></div>
                  </div>
                  <div className="stat-card-body">
                    <h3>{stats.totalDesa - stats.desaOvertourism}</h3>
                    <p>Desa Tersedia</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-card-header">
                    <div className="stat-card-icon amber"><Hourglass size={24} /></div>
                  </div>
                  <div className="stat-card-body">
                    <h3 style={{ color: '#d97706' }}>{(stats.totalPemesananTertunda ?? 0).toLocaleString('id-ID')}</h3>
                    <p>Booking Tertunda (Belum Hadir)</p>
                  </div>
                  <div className="stat-card-footer">
                    <span>Sudah booking, belum dihitung</span>
                  </div>
                </div>
              </div>
            )}

            {/* Visitor Table */}
            <div className="table-container">
              <div className="table-header">
                <h2>Kapasitas Pengunjung</h2>
              </div>
              {loading ? (
                <div className="loading-spinner"><div className="spinner"></div></div>
              ) : (
                <>
                  <table>
                    <thead>
                      <tr>
                        <th>Nama Desa</th>
                        <th>Lokasi</th>
                        <th>Kapasitas</th>
                        <th>Hari Ini</th>
                        <th>Persentase</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {desaList.map((desa) => {
                        const persentase = desa.batasPengunjung > 0 ? Math.round((desa.pengunjungHariIni / desa.batasPengunjung) * 100) : 0;
                        const status = persentase >= 100 ? 'penuh' : persentase >= 80 ? 'hampir_penuh' : 'tersedia';
                        return (
                          <tr key={desa.id}>
                            <td><strong>{desa.namaDesa}</strong></td>
                            <td>{desa.kabupaten}, {desa.provinsi}</td>
                            <td>{formatNumber(desa.batasPengunjung)}</td>
                            <td><strong>{formatNumber(desa.pengunjungHariIni)}</strong></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ flex: 1, height: 8, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden', minWidth: 60 }}>
                                  <div style={{
                                    width: `${Math.min(persentase, 100)}%`,
                                    height: '100%',
                                    background: status === 'penuh' ? '#dc2626' : status === 'hampir_penuh' ? '#f59e0b' : '#22c55e',
                                    borderRadius: 4,
                                    transition: 'width 0.3s'
                                  }}></div>
                                </div>
                                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: status === 'penuh' ? '#dc2626' : status === 'hampir_penuh' ? '#d97706' : '#16a34a', minWidth: 40 }}>{persentase}%</span>
                              </div>
                            </td>
                            <td>
                              <span className={`table-badge ${status === 'penuh' ? 'inactive' : status === 'hampir_penuh' ? 'category' : 'active'}`}>
                                {status === 'penuh' ? '🔴 Penuh' : status === 'hampir_penuh' ? '🟡 Hampir Penuh' : '🟢 Tersedia'}
                              </span>
                            </td>
                            <td>
                              <div className="table-actions">
                                <button className="edit" title="Buka Dashboard Desa (Check-In / Check-Out Wisatawan)"
                                  onClick={() => setSelectedDesaDashboard(desa)}
                                  style={{ background: '#f0fdf4', color: 'var(--green-800)', borderColor: '#bbf7d0' }}>
                                  <Sliders size={16} />
                                </button>
                                <button className="delete" title="Reset Pengunjung"
                                  onClick={async () => {
                                    if (!confirm(`Reset pengunjung hari ini untuk "${desa.namaDesa}"?`)) return;
                                    try {
                                      const res = await desaWisataApi.resetVisitors(desa.id);
                                      if (res.success) {
                                        addToast('Pengunjung direset', 'success');
                                        loadData();
                                      }
                                    } catch {
                                      addToast('Gagal reset', 'error');
                                    }
                                  }}>
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="table-pagination">
                    <span>Total: {desaList.length} desa</span>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ===== MAP TAB ===== */}
        {tab === 'map' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">Peta Desa Wisata</h1>
                <p className="admin-page-subtitle">Lihat lokasi seluruh desa wisata di Indonesia</p>
              </div>
            </div>
            <div className="map-legend">
              <span className="map-legend-title">Zona Keramaian (Live):</span>
              <div className="map-legend-item">
                <span className="map-legend-dot" style={{ background: '#22c55e' }}></span>
                Hijau • Sepi
              </div>
              <div className="map-legend-item">
                <span className="map-legend-dot" style={{ background: '#f59e0b' }}></span>
                Kuning • Lumayan Rame
              </div>
              <div className="map-legend-item">
                <span className="map-legend-dot" style={{ background: '#dc2626' }}></span>
                Merah • Rame
              </div>
            </div>
            <div className="map-wrapper" style={{ margin: '0 32px 32px' }}>
              <DesaMap
                data={desaList}
                height="calc(100vh - 220px)"
                onMarkerClick={(desa) => setShowDetail(desa)}
              />
            </div>
          </>
        )}

        {/* ===== ORGANISASI TAB (SuperAdmin saja) ===== */}
        {tab === 'organisasi' && isSuperAdmin && (
          <OrganisasiTab />
        )}

        {/* ===== WEBSITE TERHUBUNG TAB (SuperAdmin saja) ===== */}
        {tab === 'sites' && isSuperAdmin && (
          <div className="admin-page-header" style={{ paddingBottom: 0 }}>
            <div style={{ flex: 1 }}>
              <h1 className="admin-page-title">🌐 Website Terhubung</h1>
              <p className="admin-page-subtitle">Integrasi website eksternal via API — tenant & API key otomatis</p>
            </div>
          </div>
        )}
        {tab === 'sites' && isSuperAdmin && (
          <SiteTerhubungTab addToast={addToast} />
        )}

        {/* ===== AUDIT LOG TAB (SuperAdmin) ===== */}
        {tab === 'audit' && isSuperAdmin && (
          <>
            <div className="admin-page-header" style={{ paddingBottom: 0 }}>
              <div style={{ flex: 1 }}>
                <h1 className="admin-page-title">📜 Audit Log</h1>
                <p className="admin-page-subtitle">Jejak semua aksi penting: login, perubahan data, penghapusan — hanya bisa dilihat SuperAdmin</p>
              </div>
            </div>
            <AuditLogTab addToast={addToast} />
          </>
        )}

        {/* ===== MUSIC TAB ===== */}
        {tab === 'music' && (
          <MusicSettingsTab addToast={addToast} />
        )}

        {/* ===== SETTINGS TAB ===== */}
        {tab === 'settings' && (
          <>
            <div className="admin-page-header">
              <div>
                <h1 className="admin-page-title">Pengaturan</h1>
                <p className="admin-page-subtitle">Konfigurasi panel admin</p>
              </div>
            </div>
            <div className="table-container">
              <div className="settings-content">
                <div className="settings-section">
                  <h3><Globe size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Informasi Aplikasi</h3>
                  <div className="settings-grid">
                    <div className="settings-item">
                      <span className="settings-label">Nama Aplikasi</span>
                      <span className="settings-value">DesaWisata Nusantara</span>
                    </div>
                    <div className="settings-item">
                      <span className="settings-label">Versi</span>
                      <span className="settings-value">1.0.0</span>
                    </div>
                    <div className="settings-item">
                      <span className="settings-label">Backend</span>
                      <span className="settings-value">ASP.NET Core + SQLite</span>
                    </div>
                    <div className="settings-item">
                      <span className="settings-label">Frontend</span>
                      <span className="settings-value">React + TypeScript + Vite</span>
                    </div>
                  </div>
                </div>
                <div className="settings-section">
                  <h3><AlertCircle size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> API Endpoints</h3>
                  <div className="api-endpoint-list">
                    <div className="api-endpoint">
                      <span className="api-method get">GET</span>
                      <code>/api/DesaWisata</code>
                      <span className="api-desc">Ambil semua data</span>
                    </div>
                    <div className="api-endpoint">
                      <span className="api-method get">GET</span>
                      <code>/api/DesaWisata/{'{id}'}</code>
                      <span className="api-desc">Detail data</span>
                    </div>
                    <div className="api-endpoint">
                      <span className="api-method post">POST</span>
                      <code>/api/DesaWisata</code>
                      <span className="api-desc">Tambah data</span>
                    </div>
                    <div className="api-endpoint">
                      <span className="api-method put">PUT</span>
                      <code>/api/DesaWisata/{'{id}'}</code>
                      <span className="api-desc">Update data</span>
                    </div>
                    <div className="api-endpoint">
                      <span className="api-method delete">DEL</span>
                      <code>/api/DesaWisata/{'{id}'}</code>
                      <span className="api-desc">Hapus data</span>
                    </div>
                    <div className="api-endpoint">
                      <span className="api-method get">GET</span>
                      <code>/api/DesaWisata/stats</code>
                      <span className="api-desc">Statistik</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ===== CREATE/EDIT MODAL ===== */}
        {showModal && (
          <div className="modal-overlay" onClick={() => setShowModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{editingDesa ? '✏️ Edit Desa Wisata' : '➕ Tambah Desa Wisata'}</h2>
                <button className="modal-close" onClick={() => setShowModal(false)}><X size={18} /></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="form-grid">
                    <div className="form-group full-width">
                      <label>Nama Desa *</label>
                      <input type="text" required placeholder="Masukkan nama desa wisata"
                        value={formData.namaDesa}
                        onChange={(e) => setFormData({ ...formData, namaDesa: e.target.value })} />
                    </div>
                    {isSuperAdmin && (
                      <div className="form-group full-width">
                        <label>Organisasi Pemilik</label>
                        <select
                          value={formData.organisasiId ?? ''}
                          onChange={(e) => setFormData({ ...formData, organisasiId: e.target.value ? parseInt(e.target.value) : undefined })}
                        >
                          <option value="">-- Pilih organisasi --</option>
                          {organisasiList.map((o) => (
                            <option key={o.id} value={o.id}>{o.namaOrganisasi}</option>
                          ))}
                        </select>
                        <small style={{ color: '#64748b' }}>
                          Desa yang dibuat tanpa organisasi otomatis masuk ke organisasi pusat.
                        </small>
                      </div>
                    )}
                    <div className="form-group">
                      <label>Kecamatan</label>
                      <input type="text" placeholder="Kecamatan"
                        value={formData.kecamatan}
                        onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Kabupaten</label>
                      <input type="text" placeholder="Kabupaten"
                        value={formData.kabupaten}
                        onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Provinsi</label>
                      <input type="text" placeholder="Provinsi"
                        value={formData.provinsi}
                        onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Kategori</label>
                      <select value={formData.kategori}
                        onChange={(e) => setFormData({ ...formData, kategori: e.target.value })}>
                        <option value="Alam">Alam</option>
                        <option value="Budaya">Budaya</option>
                        <option value="Pantai">Pantai</option>
                        <option value="Kuliner">Kuliner</option>
                        <option value="Religi">Religi</option>
                      </select>
                    </div>
                    <div className="form-group full-width">
                      <label>Lokasi / Alamat</label>
                      <input type="text" placeholder="Alamat lengkap"
                        value={formData.lokasi}
                        onChange={(e) => setFormData({ ...formData, lokasi: e.target.value })} />
                    </div>
                    <div className="form-group full-width">
                      <label>Gambar Desa Wisata</label>
                      <ImageUpload
                        currentUrl={formData.urlGambar}
                        onUpload={(url) => setFormData({ ...formData, urlGambar: url })}
                        onRemove={() => setFormData({ ...formData, urlGambar: '' })}
                      />
                    </div>
                    <div className="form-group full-width">
                      <label>Galeri Foto (Bisa Banyak Foto)</label>
                      <GalleryUpload
                        desaId={editingDesa?.id}
                        fotos={galeriFotos}
                        onChange={setGaleriFotos}
                      />
                      <small style={{ color: '#64748b' }}>
                        Foto pertama menjadi cover galeri. Urutan dapat diatur dengan tombol panah.
                      </small>
                    </div>
                    <div className="form-group full-width">
                      <label>Deskripsi *</label>
                      <textarea required placeholder="Deskripsi tentang desa wisata ini..."
                        value={formData.deskripsi}
                        onChange={(e) => setFormData({ ...formData, deskripsi: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label>Rating (1-5)</label>
                      <input type="number" min={1} max={5} value={formData.rating}
                        onChange={(e) => setFormData({ ...formData, rating: parseInt(e.target.value) || 1 })} />
                    </div>
                    <div className="form-group">
                      <label>Jumlah Wisatawan</label>
                      <input type="number" min={0} value={formData.jumlahWisatawan}
                        onChange={(e) => setFormData({ ...formData, jumlahWisatawan: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label>Status</label>
                      <select value={formData.aktif ? 'true' : 'false'}
                        onChange={(e) => setFormData({ ...formData, aktif: e.target.value === 'true' })}>
                        <option value="true">Aktif</option>
                        <option value="false">Nonaktif</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Latitude</label>
                      <input type="number" step="any" placeholder="-7.8673"
                        value={formData.latitude || ''}
                        onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label>Longitude</label>
                      <input type="number" step="any" placeholder="112.5239"
                        value={formData.longitude || ''}
                        onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label>Batas Pengunjung/Hari</label>
                      <input type="number" min={0} placeholder="500"
                        value={formData.batasPengunjung || ''}
                        onChange={(e) => setFormData({ ...formData, batasPengunjung: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label>Pengunjung Hari Ini</label>
                      <input type="number" min={0} placeholder="0"
                        value={formData.pengunjungHariIni || ''}
                        onChange={(e) => setFormData({ ...formData, pengunjungHariIni: parseInt(e.target.value) || 0 })} />
                    </div>
                    <div className="form-group">
                      <label>Pajak Daerah (%)</label>
                      <input type="number" min={0} max={100} step="0.5" placeholder="10"
                        value={formData.persenPajakDaerah ?? 10}
                        onChange={(e) => setFormData({ ...formData, persenPajakDaerah: parseFloat(e.target.value) || 0 })} />
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Batal</button>
                  <button type="submit" className="btn btn-primary btn-sm">
                    {editingDesa ? 'Simpan Perubahan' : 'Tambah Data'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== DETAIL MODAL ===== */}
        {showDetail && (
          <div className="modal-overlay" onClick={() => setShowDetail(null)}>
            <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{showDetail.namaDesa}</h2>
                <button className="modal-close" onClick={() => setShowDetail(null)}><X size={18} /></button>
              </div>
              <div className="modal-body">
                <img
                  src={showDetail.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'}
                  alt={showDetail.namaDesa}
                  className="detail-hero-image"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
                  }}
                />
                <div className="detail-info">
                  <div className="detail-info-item">
                    <MapPin size={20} />
                    <div><small>Lokasi</small><span>{showDetail.lokasi}</span></div>
                  </div>
                  <div className="detail-info-item">
                    <BarChart3 size={20} />
                    <div><small>Rating</small><span>{showDetail.rating}/5</span></div>
                  </div>
                  <div className="detail-info-item">
                    <Users size={20} />
                    <div><small>Jumlah Wisatawan</small><span>{formatNumber(showDetail.jumlahWisatawan)} orang</span></div>
                  </div>
                  <div className="detail-info-item">
                    <LayoutGrid size={20} />
                    <div><small>Kategori</small><span>{showDetail.kategori}</span></div>
                  </div>
                </div>
                <div className="detail-description">
                  <strong style={{ display: 'block', marginBottom: 8, color: 'var(--green-800)' }}>Deskripsi</strong>
                  {showDetail.deskripsi}
                </div>
                <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => { const target = showDetail; setShowDetail(null); openEditModal(target); }}>
                    <Edit size={14} /> Edit
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => { const target = showDetail; setShowDetail(null); setSelectedDesaDashboard(target); }}>
                    <Sliders size={14} /> Buka Dashboard Desa
                  </button>
                  <button className="btn btn-danger btn-sm" onClick={() => { const target = showDetail; setShowDetail(null); handleDelete(target.id, target.namaDesa); }}>
                    <Trash2 size={14} /> Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== DESA DASHBOARD & SETTINGS MODAL ===== */}
        {selectedDesaDashboard && (
          <DesaDashboardModal
            key={selectedDesaDashboard.id}
            desa={selectedDesaDashboard}
            onClose={() => setSelectedDesaDashboard(null)}
            onUpdate={() => {
              loadData();
            }}
          />
        )}
      </main>
    </div>
  );
}
