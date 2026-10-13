import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TreePine, MapPin, Compass, ArrowRight, AlertTriangle, Map, Lock,
  Leaf, Users, Ticket, Play, Search, ArrowUpDown, LayoutGrid, List,
  Sparkles, Mountain, Waves, UtensilsCrossed, Landmark, Sun, Check,
  ShieldCheck, Camera, HeartHandshake,
} from 'lucide-react';
import { desaWisataApi } from '../api/desawisataApi';
import type { DesaWisata, Stats, VisitorActivity } from '../types/desawisata';
import { auth } from '../utils/auth';
import { usePolling } from '../utils/usePolling';
import { usePageMeta } from '../utils/usePageMeta';
import DesaCard from '../components/DesaCard';
import DetailModal from '../components/DetailModal';
import DesaMap from '../components/DesaMap';
import Toast from '../components/Toast';
import Footer from '../components/Footer';
import { LeafCluster, PalmLeaf } from '../components/LeafOrnament';

const HERO_IMG = 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1600&q=80';
const HERO_FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600&q=80';
const HERO_CARD_1 = 'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=400&q=80';
const HERO_CARD_2 = 'https://images.unsplash.com/photo-1512100356356-de1b84283e18?w=400&q=80';

const CAT_META: Record<string, { img: string; desc: string; icon: React.ReactNode }> = {
  Alam: { img: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80', desc: 'Gunung & sawah', icon: <Mountain size={18} /> },
  Budaya: { img: 'https://images.unsplash.com/photo-1528164344705-47542687000d?w=600&q=80', desc: 'Adat & tradisi', icon: <Landmark size={18} /> },
  Pantai: { img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80', desc: 'Pasir & ombak', icon: <Waves size={18} /> },
  Kuliner: { img: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&q=80', desc: 'Rasa nusantara', icon: <UtensilsCrossed size={18} /> },
  Religi: { img: 'https://images.unsplash.com/photo-1564769625905-50e93615e769?w=600&q=80', desc: 'Wisata spiritual', icon: <Sparkles size={18} /> },
};

const MARQUEE = ['Bali', 'Yogyakarta', 'Lombok', 'Labuan Bajo', 'Tana Toraja', 'Dieng', 'Bunaken', 'Raja Ampat', 'Bromo', 'Ubud'];

export default function LandingPage() {
  const navigate = useNavigate();

  usePageMeta({
    title: 'DesaWisata Nusantara — Pesona Wonderful Indonesia',
    description:
      'Direktori desa wisata Indonesia: harga tiket & pajak, jam operasional, zona keramaian real-time, radar cuaca, dan booking kunjungan langsung dari web.',
    path: '/',
  });

  const [desaList, setDesaList] = useState<DesaWisata[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [search, setSearch] = useState('');
  const [kategoriFilter, setKategoriFilter] = useState('');
  const [provinsiFilter, setProvinsiFilter] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [zoneFilter, setZoneFilter] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [loading, setLoading] = useState(true);
  const [selectedDesa, setSelectedDesa] = useState<DesaWisata | null>(null);
  const [error, setError] = useState('');

  const [activityToasts, setActivityToasts] = useState<
    { key: string; message: string; type: 'success' | 'error' | 'info' }[]
  >([]);
  const seenActivityRef = useRef<Record<string, string>>({});
  const hasActivityBaselineRef = useRef(false);
  const retryCountRef = useRef(0);

  const removeActivityToast = (key: string) =>
    setActivityToasts((prev) => prev.filter((t) => t.key !== key));

  const loadActivity = async () => {
    try {
      const res = await desaWisataApi.getGlobalVisitorActivity();
      if (!res.success) return;
      const seen = seenActivityRef.current;
      if (Object.keys(seen).length > 500) {
        seenActivityRef.current = {};
        hasActivityBaselineRef.current = false;
        return;
      }
      const incoming: { key: string; message: string; type: 'success' | 'error' | 'info' }[] = [];
      const baselineReady = hasActivityBaselineRef.current;
      (res.data as VisitorActivity[]).forEach((p) => {
        const inKey = `in-${p.id}`;
        const outKey = `out-${p.id}`;
        const nowOut = p.checkOutAt ?? '';
        if (seen[inKey] === undefined && baselineReady) {
          incoming.push({ key: inKey, message: `${p.namaWisatawan} masuk di ${p.namaDesa} • 🎫 ${p.nomorKarcis}`, type: 'success' });
        }
        const prevOut = seen[outKey];
        if (prevOut !== undefined && prevOut === '' && nowOut !== '' && baselineReady) {
          incoming.push({ key: outKey, message: `${p.namaWisatawan} keluar dari ${p.namaDesa} • 🎫 ${p.nomorKarcis}`, type: 'info' });
        }
        seen[inKey] = p.checkInAt;
        seen[outKey] = nowOut;
      });
      hasActivityBaselineRef.current = true;
      if (incoming.length > 0) setActivityToasts((prev) => [...prev, ...incoming].slice(-5));
    } catch { /* abaikan refresh background */ }
  };

  const isLoggedIn = auth.isLoggedIn();

  const loadData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await desaWisataApi.getAll({
        kategori: kategoriFilter || undefined,
        provinsi: provinsiFilter || undefined,
        search: search || undefined,
      });
      if (response.success) {
        setDesaList(response.data);
        setError('');
        retryCountRef.current = 0;
        setSelectedDesa((current) => {
          if (!current) return current;
          return response.data.find((d) => d.id === current.id) ?? current;
        });
      }
    } catch (err) {
      console.error('Error loading data:', err);
      if (!silent) {
        setError('Gagal memuat data. Sedang mencoba lagi otomatis…');
        const attempt = ++retryCountRef.current;
        if (attempt <= 30) window.setTimeout(() => { void loadData(true); }, Math.min(attempt * 2000, 10000));
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await desaWisataApi.getStats();
      if (response.success) setStats(response.data);
    } catch (err) { console.error('Error loading stats:', err); }
  };

  usePolling(() => { void loadData(true); void loadStats(); void loadActivity(); });

  useEffect(() => { loadData(); loadStats(); loadActivity(); }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadData(); }, 300);
    return () => clearTimeout(timer);
  }, [kategoriFilter, provinsiFilter]);

  const zoneOf = (d: DesaWisata): 'sepi' | 'lumayan' | 'rame' => {
    const pct = d.batasPengunjung > 0 ? Math.round((d.pengunjungHariIni / d.batasPengunjung) * 100) : 0;
    const threshold = d.thresholdPeringatan || 80;
    if (d.overtourism || pct >= 100) return 'rame';
    if (pct >= threshold) return 'lumayan';
    return 'sepi';
  };

  const sortedDesaList = useMemo(() => {
    const filtered = zoneFilter ? desaList.filter((d) => zoneOf(d) === zoneFilter) : desaList;
    return [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'wisatawan': return b.jumlahWisatawan - a.jumlahWisatawan;
        case 'nama': return a.namaDesa.localeCompare(b.namaDesa, 'id');
        case 'harga': return a.hargaTiketLokal - b.hargaTiketLokal;
        default:
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.jumlahWisatawan - a.jumlahWisatawan;
      }
    });
  }, [desaList, sortBy, zoneFilter]);

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); loadData(); };

  const kategoriList = ['Alam', 'Budaya', 'Pantai', 'Kuliner', 'Religi'];
  const provinsiList = [
    'Jawa Timur', 'Bali', 'Jawa Tengah', 'Jawa Barat',
    'Daerah Istimewa Yogyakarta', 'Nusa Tenggara Timur',
    'Nusa Tenggara Barat', 'Sulawesi Selatan', 'Kalimantan Barat',
    'Sumatera Utara', 'Sumatera Barat'
  ];

  const zoneStatuses = useMemo(() => {
    const counts = { sepi: 0, lumayan: 0, rame: 0 };
    desaList.forEach((d) => { counts[zoneOf(d)] += 1; });
    return counts;
  }, [desaList]);

  return (
    <div className="app-container">
      {/* ================= HERO WONDERFUL INDONESIA ================= */}
      <section className="wi-hero">
        <div className="wi-hero-bg">
          <img
            src={HERO_IMG} alt="Pesona desa wisata Indonesia"
            onError={(e) => { (e.target as HTMLImageElement).src = HERO_FALLBACK; }}
          />
        </div>
        <div className="wi-hero-veil" />
        <div className="wi-hero-grain" />
        {/* daun-daun berjatuhan */}
        {[
          { left: '6%', size: 44, dur: '11s', delay: '0s', tone: 'fresh' as const },
          { left: '22%', size: 30, dur: '14s', delay: '-5s', tone: 'lime' as const },
          { left: '48%', size: 38, dur: '12s', delay: '-8s', tone: 'deep' as const },
          { left: '71%', size: 28, dur: '15s', delay: '-3s', tone: 'gold' as const },
          { left: '88%', size: 46, dur: '13s', delay: '-6s', tone: 'fresh' as const },
        ].map((f, i) => (
          <span key={i} className="wi-falling" style={{ left: f.left, width: f.size, height: f.size, animationDuration: f.dur, animationDelay: f.delay }}>
            <PalmLeaf tone={f.tone} style={{ position: 'static', width: '100%', height: '100%' }} />
          </span>
        ))}

        <div className="wi-hero-inner">
          <div>
            <span className="wi-eyebrow">
              <span className="wi-eyebrow-flag">🇮🇩 Pesona Indonesia</span>
              <span className="wi-eyebrow-dot" />
              Wonderful • Alam • Budaya
            </span>
            <h1 className="wi-title">
              Jelajahi <span className="wi-script">Desa Wisata</span><br />
              <span className="wi-outline">Nusantara</span> yang Memukau
            </h1>
            <p className="wi-desc">
              Dari sawah terasering Ubud hingga pantai eksotis Lombok —
              temukan desa wisata autentik dengan info tiket real-time,
              zona keramaian, dan booking langsung.
            </p>
            <div className="wi-actions">
              <a href="#wisata" className="wi-btn wi-btn-sun">
                <Compass size={17} /> Jelajahi Sekarang <ArrowRight size={16} />
              </a>
              <a href="#peta" className="wi-btn wi-btn-glass">
                <span className="wi-btn-play"><Play size={13} /></span> Lihat Peta
              </a>
            </div>
            <div className="wi-mini-meta">
              <span><ShieldCheck size={15} /> Data live terverifikasi</span>
              <span><Camera size={15} /> {desaList.length} destinasi aktif</span>
              <span><Sun size={15} /> Cuaca & keramaian real-time</span>
            </div>
          </div>

          <div className="wi-collage">
            <div className="wi-collage-main">
              <img src={HERO_IMG} alt="Sawah terasering" onError={(e) => { (e.target as HTMLImageElement).src = HERO_FALLBACK; }} />
            </div>
            <span className="wi-collage-eco"><Leaf size={14} /> 100% Wisata Hijau</span>
            <div className="wi-collage-card c1">
              <img src={HERO_CARD_1} alt="Pantai" onError={(e) => { (e.target as HTMLImageElement).src = HERO_FALLBACK; }} />
              <div><strong>Desa Pantai Pink</strong><small><MapPin size={11} /> Lombok, NTB</small></div>
            </div>
            <div className="wi-collage-card c2">
              <img src={HERO_CARD_2} alt="Candi" onError={(e) => { (e.target as HTMLImageElement).src = HERO_FALLBACK; }} />
              <div><strong>Desa Budaya Jawa</strong><small><MapPin size={11} /> Yogyakarta</small></div>
            </div>
            <span className="wi-collage-rating">★ 4.9 · 2,4 jt wisatawan puas</span>
          </div>
        </div>

        {stats && (
          <div className="wi-stats">
            <div className="wi-stat"><span className="wi-stat-icon"><Leaf size={19} /></span><div><strong>{stats.totalDesa}</strong><small>Desa Wisata</small></div></div>
            <div className="wi-stat"><span className="wi-stat-icon"><Map size={19} /></span><div><strong>{stats.provinsiCounts.length}</strong><small>Provinsi</small></div></div>
            <div className="wi-stat"><span className="wi-stat-icon"><Users size={19} /></span><div><strong>{(stats.totalWisatawan / 1000000).toFixed(1)}M+</strong><small>Total Wisatawan</small></div></div>
            <div className="wi-stat"><span className="wi-stat-icon"><Ticket size={19} /></span><div><strong>{stats.totalPengunjungHariIni.toLocaleString('id-ID')}</strong><small>Pengunjung Hari Ini</small></div></div>
          </div>
        )}

        <div className="wi-marquee" aria-hidden="true">
          <div className="wi-marquee-track">
            {[...MARQUEE, ...MARQUEE].map((m, i) => <span key={i}>{m}</span>)}
          </div>
        </div>
        <div className="wi-hero-curve" aria-hidden="true">
          <svg viewBox="0 0 1440 72" preserveAspectRatio="none"><path d="M0,40 C240,80 480,0 720,24 C960,48 1200,80 1440,32 L1440,72 L0,72 Z" fill="#fffdf3" /></svg>
        </div>
      </section>

      {/* ================= DESTINASI ================= */}
      <section className="wi-section alt" id="wisata">
        <LeafCluster position="both" />
        <div className="wi-container">
          <div className="wi-head">
            <div className="wi-head-left">
              <span className="wi-kicker"><Sparkles size={13} /> Pilihan Terbaik · Wonderful Indonesia</span>
              <h2 className="wi-h2">Destinasi <em>Populer</em> Nusantara</h2>
              <p className="wi-sub">Temukan desa wisata terbaik dengan pengalaman unik dan autentik — dari pegunungan hijau hingga pesisir tropis.</p>
            </div>
            <span className="live-badge"><span className="live-badge-dot" /> Live</span>
          </div>

          {/* Kartu kategori bergambar */}
          <div className="wi-cat-grid">
            <button type="button" className={`wi-cat ${kategoriFilter === '' ? 'active' : ''}`} onClick={() => setKategoriFilter('')}>
              <img src={HERO_IMG} alt="Semua" />
              <span className="wi-cat-check"><Check size={14} /></span>
              <span className="wi-cat-body"><span className="wi-cat-emoji">✨</span><strong>Semua Pesona</strong><small>{desaList.length} destinasi</small></span>
            </button>
            {kategoriList.map((k) => (
              <button key={k} type="button" className={`wi-cat ${kategoriFilter === k ? 'active' : ''}`}
                onClick={() => setKategoriFilter(kategoriFilter === k ? '' : k)}>
                <img src={CAT_META[k].img} alt={k} loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).src = HERO_FALLBACK; }} />
                <span className="wi-cat-check"><Check size={14} /></span>
                <span className="wi-cat-body">
                  <span className="wi-cat-emoji">{CAT_META[k].icon}</span>
                  <strong>{k}</strong>
                  <small>{CAT_META[k].desc}</small>
                </span>
              </button>
            ))}
          </div>

          {/* Filter */}
          <form className="wi-filter-card" onSubmit={handleSearch}>
            <div className="wi-search">
              <Search size={17} />
              <input type="text" placeholder="Cari desa wisata, mis. Penglipuran…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select value={kategoriFilter} onChange={(e) => setKategoriFilter(e.target.value)}>
              <option value="">🌿 Semua Kategori</option>
              {kategoriList.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <select value={provinsiFilter} onChange={(e) => setProvinsiFilter(e.target.value)}>
              <option value="">📍 Semua Provinsi</option>
              {provinsiList.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <button type="submit" className="wi-filter-go"><Search size={15} /> Cari</button>
          </form>

          {/* Toolbar */}
          <div className="wi-toolbar">
            <span className="wi-count">Menampilkan <strong>{sortedDesaList.length}</strong> dari {desaList.length} destinasi
              {zoneFilter && ` · Zona ${zoneFilter === 'sepi' ? 'Sepi' : zoneFilter === 'lumayan' ? 'Lumayan Rame' : 'Rame'}`}
            </span>
            <div className="wi-toolbar-controls">
              <div className="wi-zone">
                <button type="button" className={zoneFilter === '' ? 'on-all' : ''} onClick={() => setZoneFilter('')}>Semua</button>
                <button type="button" className={zoneFilter === 'sepi' ? 'on-sepi' : ''} onClick={() => setZoneFilter(zoneFilter === 'sepi' ? '' : 'sepi')}>🟢 Sepi</button>
                <button type="button" className={zoneFilter === 'lumayan' ? 'on-lumayan' : ''} onClick={() => setZoneFilter(zoneFilter === 'lumayan' ? '' : 'lumayan')}>🟡 Lumayan</button>
                <button type="button" className={zoneFilter === 'rame' ? 'on-rame' : ''} onClick={() => setZoneFilter(zoneFilter === 'rame' ? '' : 'rame')}>🔴 Rame</button>
              </div>
              <div className="wi-sort">
                <ArrowUpDown size={14} />
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Urutkan destinasi">
                  <option value="rating">Rating Tertinggi</option>
                  <option value="wisatawan">Terpopuler</option>
                  <option value="nama">Nama A–Z</option>
                  <option value="harga">Harga Termurah</option>
                </select>
              </div>
              <div className="wi-view" role="group" aria-label="Mode tampilan">
                <button type="button" className={viewMode === 'grid' ? 'active' : ''} onClick={() => setViewMode('grid')} title="Grid" aria-label="Grid"><LayoutGrid size={15} /></button>
                <button type="button" className={viewMode === 'list' ? 'active' : ''} onClick={() => setViewMode('list')} title="List" aria-label="List"><List size={15} /></button>
              </div>
            </div>
          </div>

          {error && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 18, background: '#fef2f2', borderRadius: 16, color: '#dc2626', marginBottom: 24, fontFamily: "'DM Sans', sans-serif", fontSize: '0.92rem' }}>
              <AlertTriangle size={20} /><span>{error}</span>
              <button onClick={() => loadData()} style={{ padding: '8px 20px', borderRadius: 100, border: '1px solid #fca5a5', background: 'white', color: '#dc2626', cursor: 'pointer', fontWeight: 700 }}>Coba Lagi</button>
            </div>
          )}

          {loading ? (
            <div className="wi-skeleton-grid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div className="wi-skeleton" key={i}>
                  <div className="wi-skeleton-img" />
                  <div className="wi-skeleton-body">
                    <div className="wi-skeleton-line" style={{ width: '60%' }} />
                    <div className="wi-skeleton-line" style={{ width: '90%' }} />
                    <div className="wi-skeleton-line" style={{ width: '75%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedDesaList.length === 0 ? (
            <div className="wi-empty">
              <div className="wi-empty-icon"><MapPin size={34} /></div>
              <h3 style={{ fontFamily: "'Playfair Display', serif", color: 'var(--wi-ink)', margin: '0 0 8px' }}>Tidak Ada Destinasi Ditemukan</h3>
              <p style={{ color: '#68786c', fontFamily: "'DM Sans', sans-serif", margin: 0 }}>Coba ubah kata kunci atau reset filter zona & kategori.</p>
            </div>
          ) : (
            <div className={`wi-grid ${viewMode === 'list' ? 'is-list' : ''}`}>
              {sortedDesaList.map((desa, i) => (
                <DesaCard key={desa.id} desa={desa} viewMode={viewMode} rank={i + 1}
                  onClick={() => setSelectedDesa(desa)} imgLoading={i >= 6 ? 'lazy' : 'eager'} />
              ))}
            </div>
          )}

          {/* Pita pengisi ruang kosong */}
          <div className="wi-ribbon">
            {[
              { icon: <ShieldCheck size={20} />, bg: '#dcfce7', fg: '#15803d', t: 'Zona Aman Terpantau', d: 'Kapasitas & keramaian live setiap detik.' },
              { icon: <Ticket size={20} />, bg: '#fef9c3', fg: '#b45309', t: 'Tiket Transparan', d: 'Harga lokal & manca jelas sejak awal.' },
              { icon: <HeartHandshake size={20} />, bg: '#ede9fe', fg: '#6d28d9', t: 'Berdaya untuk Desa', d: 'Kunjunganmu menggerakkan ekonomi lokal.' },
              { icon: <Camera size={20} />, bg: '#e0f2fe', fg: '#0369a1', t: 'Spot Foto Ikonik', d: 'Sawah, pantai & budaya yang instagramable.' },
            ].map((r, i) => (
              <div className="wi-ribbon-item" key={i}>
                <span className="wi-ribbon-icon" style={{ background: r.bg, color: r.fg }}>{r.icon}</span>
                <strong>{r.t}</strong><p>{r.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CTA ================= */}
      <section className="wi-section" style={{ paddingTop: 8 }}>
        <div className="wi-container">
          <div className="wi-cta">
            <PalmLeaf tone="fresh" opacity={0.22} rotate={-20} scale={2} style={{ left: '-30px', top: '-20px' }} />
            <PalmLeaf tone="gold" opacity={0.2} rotate={24} scale={1.8} style={{ right: '-24px', bottom: '-16px' }} />
            <span className="wi-kicker" style={{ background: 'rgba(251,191,36,0.14)', borderColor: 'rgba(251,191,36,0.35)', color: '#fde68a' }}>
              <TreePine size={13} /> Panel Admin
            </span>
            <h2>Kelola Data <em>Desa Wisata</em> Nusantara</h2>
            <p>{isLoggedIn
              ? 'Anda telah terautentikasi sebagai Admin. Akses dashboard untuk mengelola seluruh data desa wisata.'
              : 'Gunakan akun admin untuk mengelola data desa wisata. Silakan login terlebih dahulu untuk mengakses dashboard admin.'}</p>
            {isLoggedIn
              ? <a href="/admin" className="wi-btn wi-btn-sun"><TreePine size={17} /> Buka Dashboard Admin <ArrowRight size={16} /></a>
              : <a href="/login" className="wi-btn wi-btn-sun"><Lock size={16} /> Login Admin <ArrowRight size={16} /></a>}
          </div>
        </div>
      </section>

      {/* ================= PETA ================= */}
      <section className="wi-section" id="peta" style={{ background: '#f3f9ef', paddingTop: 20 }}>
        <LeafCluster position="right" />
        <div className="wi-container">
          <div className="wi-head">
            <div className="wi-head-left">
              <span className="wi-kicker"><Map size={13} /> Peta Interaktif</span>
              <h2 className="wi-h2">Peta Desa <em>Wisata</em></h2>
              <p className="wi-sub">Jelajahi lokasi desa wisata di seluruh Indonesia melalui peta interaktif.</p>
            </div>
            <span className="wi-live"><span className="live-badge-dot" /> Zona live terpantau</span>
          </div>
          <div className="wi-legend">
            <b>Zona Keramaian (Live):</b>
            <span><span className="wi-dot" style={{ background: '#22c55e' }} /> Hijau · Sepi ({zoneStatuses.sepi})</span>
            <span><span className="wi-dot" style={{ background: '#f59e0b' }} /> Kuning · Lumayan ({zoneStatuses.lumayan})</span>
            <span><span className="wi-dot" style={{ background: '#dc2626' }} /> Merah · Rame ({zoneStatuses.rame})</span>
          </div>
          <div className="wi-map-frame">
            <div className="map-wrapper">
              <DesaMap data={desaList} height="500px" onMarkerClick={(desa) => navigate(`/desa/${desa.id}`)} />
            </div>
          </div>
        </div>
      </section>

      <Footer />

      {selectedDesa && <DetailModal desa={selectedDesa} onClose={() => setSelectedDesa(null)} />}

      {activityToasts.length > 0 && (
        <div className="toast-container">
          {activityToasts.map((t) => (
            <Toast key={t.key} message={t.message} type={t.type} onClose={() => removeActivityToast(t.key)} />
          ))}
        </div>
      )}
    </div>
  );
}
