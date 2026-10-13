import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, MapPin, Star, Users, Phone, Mail, Globe, Clock,
  Calendar, Tag, Ticket, Bike, Car, AlertTriangle, Radio, Home,
  CheckCircle2, Image as ImageIcon, Video, ExternalLink, X, Navigation,
  Share2, Check, Compass,
} from 'lucide-react';
import { desaWisataApi } from '../api/desawisataApi';
import type { DesaWisata, Pengunjung, ForecastHari } from '../types/desawisata';
import { getCrowdInfo } from '../utils/crowd';
import { usePolling } from '../utils/usePolling';
import { usePageMeta } from '../utils/usePageMeta';
import { detectVideoPlatform, getVideoEmbed, getYouTubeId, platformLabel, type EmbedInfo } from '../utils/video';
import DesaMap from '../components/DesaMap';
import WeatherRadar from '../components/WeatherRadar';
import BookingModal from '../components/BookingModal';
import DesaCard from '../components/DesaCard';

interface FeedItem {
  key: string;
  tipe: 'masuk' | 'keluar';
  nama: string;
  karcis: string;
  waktu: string;
}

export default function DesaProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const desaId = Number(id);

  const [desa, setDesa] = useState<DesaWisata | null>(null);
  const [aktivitas, setAktivitas] = useState<Pengunjung[]>([]);
  const [forecast, setForecast] = useState<ForecastHari[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBooking, setShowBooking] = useState(false);
  const [relatedDesa, setRelatedDesa] = useState<DesaWisata[]>([]);
  const [copied, setCopied] = useState(false);

  // Deep link dari WisataBot (?booking=1) → langsung buka modal booking
  useEffect(() => {
    if (searchParams.get('booking') === '1') {
      setShowBooking(true);
      setSearchParams({}, { replace: true }); // bersihkan URL
    }
  }, [searchParams, setSearchParams]);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [showStickyCta, setShowStickyCta] = useState(false);

  const load = async (silent = false) => {
    if (!desaId) return;
    try {
      if (!silent) setLoading(true);
      // Forecast cukup diambil sekali per kunjungan halaman (perubahan antar hari, bukan antar detik)
      const needsForecast = forecast.length === 0;
      const [desaRes, aktivitasRes, forecastRes] = await Promise.all([
        desaWisataApi.getById(desaId),
        desaWisataApi.getVisitorActivity(desaId),
        needsForecast ? desaWisataApi.getForecast(desaId).catch(() => null) : Promise.resolve(null),
      ]);
      if (desaRes.success) setDesa(desaRes.data);
      if (aktivitasRes.success) setAktivitas(aktivitasRes.data);
      if (forecastRes?.success) setForecast(forecastRes.data);

      // PULIH DARI ERROR: sukses (termasuk polling senyap) -> hapus pesan error lama
      if (desaRes.success) setError('');

      // Destinasi lainnya (sekali per kunjungan halaman):
      // prioritas kategori sama, lalu provinsi sama, diambil 3 teratas per rating
      if (relatedDesa.length === 0 && desaRes.success) {
        try {
          const allRes = await desaWisataApi.getAll({});
          if (allRes.success) {
            const others = allRes.data.filter((d) => d.id !== desaId);
            const sameCategory = others.filter((d) => d.kategori === desaRes.data.kategori);
            const sameProvince = others.filter(
              (d) => d.kategori !== desaRes.data.kategori && d.provinsi === desaRes.data.provinsi
            );
            const rest = others.filter(
              (d) => d.kategori !== desaRes.data.kategori && d.provinsi !== desaRes.data.provinsi
            );
            const byRating = (a: DesaWisata, b: DesaWisata) => b.rating - a.rating;
            setRelatedDesa([
              ...sameCategory.sort(byRating),
              ...sameProvince.sort(byRating),
              ...rest.sort(byRating),
            ].slice(0, 3));
          }
        } catch {
          // Destinasi lainnya bersifat opsional; abaikan bila gagal
        }
      }
    } catch {
      if (!silent) setError('Gagal memuat profil desa wisata. Pastikan backend berjalan.');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    setDesa(null);
    setAktivitas([]);
    setError('');
    setLightboxIdx(null);
    void load();
    window.scrollTo({ top: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desaId]);

  // Real-time: masuk/keluar wisatawan diperbarui otomatis
  usePolling(() => {
    void load(true);
  });

  // Tampilkan CTA menempel di bawah setelah hero (dengan CTA utamanya) lewat scroll
  useEffect(() => {
    const target = ctaRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => setShowStickyCta(!entries[0].isIntersecting),
      { threshold: 0 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [desa]);

  const crowd = useMemo(() => (desa ? getCrowdInfo(desa) : null), [desa]);

  // SEO per desa: judul & deskripsi mengikuti desa yang dibuka (penting utk share & pencarian)
  usePageMeta({
    title: desa ? `${desa.namaDesa} — Desa Wisata Nusantara` : 'Desa Wisata Nusantara',
    description: desa?.deskripsi?.slice(0, 155),
    path: desa ? `/desa/${desa.id}` : undefined,
    image: desa?.urlGambar || undefined,
  });

  // Item galeri (foto + video) tersimpan per desa; fallback ke gambar utama bila galeri kosong
  const galeriPhotos = useMemo(() => {
    if (!desa) return [] as { key: string; src: string; label: string; video: EmbedInfo | null; videoUrl: string | null }[];
    const items = (desa.galeriFoto ?? []).map((f) => {
      const isVideo = f.tipe === 'video' || detectVideoPlatform(f.url) !== null;
      return {
        key: `g-${f.id}`,
        src: isVideo ? '' : f.url,
        label: f.judul || (isVideo ? 'Video Galeri' : 'Foto Galeri'),
        video: isVideo ? getVideoEmbed(f.url) : null,
        videoUrl: isVideo ? f.url : null,
      };
    });
    if (items.length === 0 && desa.urlGambar) {
      items.push({ key: 'utama', src: desa.urlGambar, label: 'Foto Utama', video: null, videoUrl: null });
    }
    return items;
  }, [desa]);

  // Navigasi lightbox dengan keyboard (panah kiri/kanan & Escape)
  useEffect(() => {
    if (lightboxIdx === null || galeriPhotos.length === 0) return;
    const n = galeriPhotos.length;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (e.key === 'ArrowLeft') setLightboxIdx((i) => (i === null ? null : (i - 1 + n) % n));
      if (e.key === 'ArrowRight') setLightboxIdx((i) => (i === null ? null : (i + 1) % n));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx, galeriPhotos]);

  // Gabungkan semua event masuk (check-in) dan keluar (check-out), paling baru dulu
  const feed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];
    aktivitas.forEach((p) => {
      items.push({
        key: `in-${p.id}`,
        tipe: 'masuk',
        nama: p.namaWisatawan,
        karcis: p.nomorKarcis,
        waktu: p.checkInAt,
      });
      if (p.checkOutAt) {
        items.push({
          key: `out-${p.id}`,
          tipe: 'keluar',
          nama: p.namaWisatawan,
          karcis: p.nomorKarcis,
          waktu: p.checkOutAt,
        });
      }
    });
    return items
      .sort((a, b) => new Date(b.waktu).getTime() - new Date(a.waktu).getTime())
      .slice(0, 15);
  }, [aktivitas]);

  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;
  const formatWaktu = (iso: string) =>
    new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const formatTanggal = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

  // Share: Web Share API bila tersedia, fallback salin tautan ke clipboard
  const handleShare = async () => {
    const url = window.location.href;
    const title = desa ? `${desa.namaDesa} — Desa Wisata Nusantara` : 'Desa Wisata Nusantara';
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Dibatalkan user / clipboard tidak tersedia — abaikan
    }
  };

  const waNumber = desa?.kontakPengelola?.replace(/[^0-9]/g, '') || '';
  // Anti-XSS: href HANYA http(s) — javascript:/data: dan skema aneh lain dibuang
  const isHttp = (u: string | undefined | null) => /^https?:\/\//i.test(u || '');
  const socialRaw = desa?.socialMedia ?? '';
  const socialHref = isHttp(socialRaw)
    ? socialRaw
    : socialRaw.startsWith('@')
      ? `https://instagram.com/${encodeURIComponent(socialRaw.slice(1))}`
      : '';
  const websiteHref = isHttp(desa?.urlWebsite) ? (desa?.urlWebsite as string) : '';

  if (loading && !desa) {
    return (
      <div className="app-container">
        <div className="loading-spinner" style={{ padding: '120px 0' }}>
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (!desa) {
    return (
      <div className="app-container">
        <div className="empty-state" style={{ padding: '120px 24px' }}>
          <div className="empty-state-icon"><MapPin size={36} /></div>
          <h3>Profil Tidak Ditemukan</h3>
          <p>{error || 'Desa wisata yang dicari tidak ditemukan.'}</p>
          <Link to="/" className="btn btn-primary">
            <Home size={18} /> Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  const isFull = crowd!.status === 'rame';
  const barColor = crowd!.color;
  const heroImage = desa.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600';
  const videoUrl = desa.urlVideo?.trim();
  // href aman hanya http(s) — dipindah ke sini karena butuh videoUrl
  const heroWebsiteHref = isHttp(desa.urlWebsite) ? desa.urlWebsite : '';
  const heroFotoHref = isHttp(desa.urlFoto) ? desa.urlFoto : '';
  const heroVideoHref = isHttp(videoUrl) ? videoUrl : '';
  const ytId = videoUrl ? getYouTubeId(videoUrl) : null;
  const hasGallery = galeriPhotos.length > 0 || !!videoUrl;
  const closed = desa.statusOperasional === 'Tutup Sementara';
  const videoThumb = ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : heroImage;

  const statusIconOperasional =
    desa.statusOperasional === 'Buka' ? '🟢' : desa.statusOperasional === 'Tutup Sementara' ? '🔴' : '🟡';

  return (
    <div className="app-container">
      {/* ===== HERO ===== */}
      <section className="desa-hero">
        <img
          src={heroImage}
          alt={desa.namaDesa}
          className="desa-hero-img"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1600';
          }}
        />
        <div className="desa-hero-overlay" />
        <div className="container desa-hero-inner">
          <div className="desa-hero-top">
            <Link to="/#peta" className="desa-hero-chip">
              <ArrowLeft size={16} /> Kembali ke Peta
            </Link>
            <div className="desa-hero-actions-right">
              {heroWebsiteHref && (
                <a className="desa-hero-chip" href={heroWebsiteHref} target="_blank" rel="noreferrer noopener">
                  <Globe size={14} /> Website
                </a>
              )}
              {heroFotoHref && (
                <a className="desa-hero-chip" href={heroFotoHref} target="_blank" rel="noreferrer noopener">
                  <ImageIcon size={14} /> Foto
                </a>
              )}
              {heroVideoHref && (
                <a className="desa-hero-chip" href={heroVideoHref} target="_blank" rel="noreferrer noopener">
                  <Video size={14} /> Video
                </a>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span className="desa-hero-chip chip-zone" style={{ '--zone-color': barColor } as CSSProperties}>
              {crowd!.emoji} Zona {crowd!.label}
            </span>
            <span className="desa-hero-chip">🏷️ {desa.kategori}</span>
            <span className="desa-hero-chip">{statusIconOperasional} {desa.statusOperasional}</span>
          </div>

          <h1 className="desa-hero-title">{desa.namaDesa}</h1>
          <p className="desa-hero-location">
            <MapPin size={16} />
            {desa.kecamatan}, {desa.kabupaten}, {desa.provinsi}
            <span className="desa-hero-rating">
              <Star size={15} fill="#fbbf24" color="#fbbf24" /> {desa.rating}.0
            </span>
          </p>
          <p className="desa-hero-desc">{desa.deskripsi}</p>

          <div className="desa-hero-stats">
            <div className="desa-hero-stat">
              <div className="desa-hero-stat-icon"><Users size={18} /></div>
              <div>
                <div className="desa-hero-stat-value">{desa.jumlahWisatawan.toLocaleString('id-ID')}</div>
                <div className="desa-hero-stat-label">Total Wisatawan</div>
              </div>
            </div>
            <div className="desa-hero-stat">
              <div className="desa-hero-stat-icon"><Radio size={18} /></div>
              <div>
                <div className="desa-hero-stat-value">{desa.pengunjungHariIni}</div>
                <div className="desa-hero-stat-label">Di Lokasi Sekarang</div>
              </div>
            </div>
            <div className="desa-hero-stat">
              <div className="desa-hero-stat-icon"><Clock size={18} /></div>
              <div>
                <div className="desa-hero-stat-value">{desa.jamBuka}–{desa.jamTutup}</div>
                <div className="desa-hero-stat-label">WIB • {desa.hariOperasional}</div>
              </div>
            </div>
            <div className="desa-hero-stat">
              <div className="desa-hero-stat-icon"><Ticket size={18} /></div>
              <div>
                <div className="desa-hero-stat-value">{formatRupiah(desa.hargaTiketLokal)}</div>
                <div className="desa-hero-stat-label">Tiket Lokal</div>
              </div>
            </div>
            <div className="desa-hero-stat">
              <div className="desa-hero-stat-icon"><Tag size={18} /></div>
              <div>
                <div className="desa-hero-stat-value">{formatRupiah(desa.hargaTiketMancanegara)}</div>
                <div className="desa-hero-stat-label">Tiket Mancanegara</div>
              </div>
            </div>
          </div>

          <div className="desa-hero-actions" ref={ctaRef}>
            <button
              className="desa-hero-cta"
              onClick={() => setShowBooking(true)}
              disabled={closed}
            >
              <Ticket size={19} />
              {desa.statusOperasional === 'Khusus Reservasi'
                ? 'Reservasi Kunjungan (Wajib)'
                : 'Pesan Tiket / Booking Kunjungan'}
            </button>
            {closed && (
              <span className="desa-hero-closed-note">
                <AlertTriangle size={15} /> Tutup Sementara — booking ditutup
              </span>
            )}
            {waNumber && (
              <a className="desa-hero-chip" href={`https://wa.me/${waNumber}`} target="_blank" rel="noreferrer noopener">
                <Phone size={14} /> Hubungi Pengelola
              </a>
            )}
            <button
              className="desa-hero-chip desa-hero-share"
              type="button"
              onClick={() => void handleShare()}
              title="Bagikan halaman ini"
            >
              {copied ? <Check size={14} /> : <Share2 size={14} />}
              {copied ? 'Tautan Disalin!' : 'Bagikan'}
            </button>
          </div>
        </div>
      </section>

      {/* ===== LIVE REAL-TIME PANEL ===== */}
      <section className="container" style={{ marginTop: -44, position: 'relative', zIndex: 2 }}>
        <div className="desa-card desa-live-panel profile-live-grid">
          {/* Kapasitas & zona */}
          <div>
            <div className="desa-live-head">
              <span style={{
                width: 10, height: 10, borderRadius: '50%', background: barColor,
                boxShadow: `0 0 0 4px ${barColor}22`, animation: 'pulse-dot 1.6s infinite',
              }}></span>
              <strong className="desa-live-title">Wisatawan di TKP (Real-Time)</strong>
              <span className="desa-live-hint">otomatis tiap 5 detik</span>
            </div>
            <div className="desa-live-count">
              {desa.pengunjungHariIni}
              <small> / {desa.batasPengunjung} pengunjung</small>
            </div>
            <div className="desa-live-bar">
              <div
                className="desa-live-bar-fill"
                style={{ width: `${Math.min(crowd!.percentage, 100)}%`, background: barColor }}
              ></div>
            </div>
            <div className="desa-live-bar-meta">
              <span style={{ color: barColor }}>{crowd!.percentage}% kapasitas</span>
              <span style={{ color: '#64748b' }}>Ambang: {desa.thresholdPeringatan}%</span>
            </div>
            <p className="desa-live-note">
              Hanya wisatawan yang sudah tiba dan di-check-in oleh petugas (sedang berada di lokasi) yang dihitung.
              Wisatawan yang sudah booking online tapi <strong>belum tiba</strong> tercatat sebagai{' '}
              <em>tertunda</em> dan belum dihitung. Saat keluar, wisatawan di-check-out menggunakan nomor karcisnya.
            </p>
            {isFull && (
              <div className="desa-live-warning">
                <AlertTriangle size={16} />
                <span>{desa.pesanPeringatan || 'Kapasitas desa telah mencapai batas maksimal.'}</span>
              </div>
            )}
          </div>

          {/* Feed masuk/keluar */}
          <div>
            <div className="desa-live-head">
              <Radio size={16} color="var(--green-700)" />
              <strong className="desa-live-title">Aktivitas Masuk / Keluar</strong>
              <span style={{
                marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 10px',
                borderRadius: 100, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0',
              }}>LIVE</span>
            </div>
            {feed.length === 0 ? (
              <div className="desa-feed-empty">
                Belum ada wisatawan yang masuk hari ini.
              </div>
            ) : (
              <div className="desa-feed">
                {feed.map((item) => (
                  <div key={item.key} className={`desa-feed-item ${item.tipe}`}>
                    <span className="desa-feed-avatar">
                      {item.tipe === 'masuk' ? '⬇️' : '⬆️'}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="desa-feed-name">{item.nama}</div>
                      <div className="desa-feed-meta">
                        {item.tipe === 'masuk' ? 'Masuk' : 'Keluar'} • 🎫 {item.karcis}
                      </div>
                    </div>
                    <div className="desa-feed-time">
                      <div className="desa-feed-clock">{formatWaktu(item.waktu)}</div>
                      <div className="desa-feed-date">{formatTanggal(item.waktu)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ===== INFORMASI UMUM (strip) ===== */}
      <section className="container" style={{ marginTop: 44 }}>
        <h2 className="desa-section-title">🏛️ Informasi Desa Wisata</h2>
        <div className="desa-info-strip">
          {[
            { icon: <MapPin size={18} />, label: 'Lokasi', value: desa.lokasi || `${desa.kecamatan}, ${desa.kabupaten}` },
            { icon: <Navigation size={18} />, label: 'Alamat Lengkap', value: `${desa.kecamatan}, ${desa.kabupaten}, ${desa.provinsi}` },
            { icon: <Tag size={18} />, label: 'Kategori', value: desa.kategori },
            { icon: <Star size={18} />, label: 'Rating', value: `${desa.rating}/5` },
            { icon: <Clock size={18} />, label: 'Jam Operasional', value: `${desa.jamBuka} - ${desa.jamTutup} WIB` },
            { icon: <Calendar size={18} />, label: 'Hari Operasional', value: desa.hariOperasional },
          ].map((item, i) => (
            <div key={i} className="desa-info-item">
              <div className="desa-info-icon">{item.icon}</div>
              <div style={{ minWidth: 0 }}>
                <div className="desa-info-label">{item.label}</div>
                <div className="desa-info-value">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== TENTANG ===== */}
      <section className="container" style={{ marginTop: 44 }}>
        <h2 className="desa-section-title">🌿 Tentang {desa.namaDesa}</h2>
        <div className="desa-about-card">
          <p className="desa-about-lead">{desa.deskripsi}</p>
          {desa.organisasiNama && (
            <span className="desa-org-chip">🤝 Dikelola oleh {desa.organisasiNama}</span>
          )}
        </div>
      </section>

      {/* ===== GALERI & VIDEO ===== */}
      {hasGallery && (
        <section className="container" style={{ marginTop: 44 }}>
          <h2 className="desa-section-title">📸 Galeri & Video</h2>

          {galeriPhotos.length > 0 && (
            <div className="desa-gallery-grid">
              {galeriPhotos.map((g, i) => (
                <button
                  key={g.key}
                  type="button"
                  className={`desa-gallery-item ${g.video ? 'is-video' : ''}`}
                  onClick={() => setLightboxIdx(i)}
                  style={{ border: '1px solid var(--border)', padding: 0, background: 'none', cursor: 'zoom-in' }}
                >
                  {/* lazy load: galeri bisa berisi puluhan foto — jangan semua diunduh sekaligus */}
                  {g.video ? (
                    <VideoTile embed={g.video} fallbackSrc={heroImage} label={g.label} />
                  ) : (
                    <img src={g.src} alt={g.label} loading="lazy" />
                  )}
                  <span className="desa-gallery-label">
                    {g.video ? <><Video size={13} /> {g.label}</> : <><ImageIcon size={13} /> {g.label}</>}
                  </span>
                  {g.video && (
                    <span className="desa-gallery-platform">
                      {g.video.platform === 'youtube' ? '▶ YouTube' : g.video.platform === 'tiktok' ? '♪ TikTok' : '◉ Instagram'}
                    </span>
                  )}
                </button>
              ))}
              {heroVideoHref && !ytId && (
                <a
                  className="desa-gallery-item is-video"
                  href={heroVideoHref}
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <img src={videoThumb} alt="Video Profil" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <span className="desa-gallery-label"><Video size={13} /> Video Profil</span>
                  <span className="video-badge"><Video size={24} /></span>
                </a>
              )}
            </div>
          )}

          {/* Embed video utama (field urlVideo desa) langsung di halaman */}
          {ytId && (
            <div className="desa-video-wrap" style={{ marginTop: 16 }}>
              <iframe
                src={`https://www.youtube.com/embed/${ytId}`}
                title={`Video ${desa.namaDesa}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          )}
        </section>
      )}

      {/* ===== HARGA TIKET & PARKIR (+ PAJAK DAERAH) ===== */}
      <section className="container" style={{ marginTop: 44 }}>
        <h2 className="desa-section-title">🎟️ Harga Tiket & Parkir</h2>
        <div className="desa-price-grid">
          <div className="desa-price-card top">
            <div className="desa-price-icon"><Ticket size={20} /></div>
            <div className="desa-price-label">Tiket Lokal</div>
            <div className="desa-price-value">{formatRupiah(desa.hargaTiketLokal)}</div>
            <div className="desa-price-unit">per orang • WNI</div>
            <div className="desa-price-tax">
              + pajak daerah {desa.persenPajakDaerah}% = <strong>{formatRupiah(Math.round(desa.hargaTiketLokal * (1 + desa.persenPajakDaerah / 100)))}</strong>
            </div>
          </div>
          <div className="desa-price-card">
            <div className="desa-price-icon"><Globe size={20} /></div>
            <div className="desa-price-label">Tiket Mancanegara</div>
            <div className="desa-price-value">{formatRupiah(desa.hargaTiketMancanegara)}</div>
            <div className="desa-price-unit">per orang • WNA</div>
            <div className="desa-price-tax">
              + pajak daerah {desa.persenPajakDaerah}% = <strong>{formatRupiah(Math.round(desa.hargaTiketMancanegara * (1 + desa.persenPajakDaerah / 100)))}</strong>
            </div>
          </div>
          <div className="desa-price-card">
            <div className="desa-price-icon"><Bike size={20} /></div>
            <div className="desa-price-label">Parkir Motor</div>
            <div className="desa-price-value">{formatRupiah(desa.hargaParkirMotor)}</div>
            <div className="desa-price-unit">per kendaraan</div>
          </div>
          <div className="desa-price-card">
            <div className="desa-price-icon"><Car size={20} /></div>
            <div className="desa-price-label">Parkir Mobil</div>
            <div className="desa-price-value">{formatRupiah(desa.hargaParkirMobil)}</div>
            <div className="desa-price-unit">per kendaraan</div>
          </div>
        </div>
        <div className="desa-price-note">
          🧾 Harga sudah termasuk perhitungan <strong>pajak daerah {desa.persenPajakDaerah}%</strong> (setempat
          kabupaten/kota {desa.kabupaten}) pada tiket masuk — ditampilkan terpisah agar transparan. Parkir dikecualikan.
          Harga dapat berubah sewaktu-waktu; untuk rombongan (bus) atau paket khusus hubungi pengelola.
        </div>
      </section>

      {/* ===== PRAKIRAAN KERAMAIAN 7 HARI ===== */}
      {forecast.length > 0 && (
        <section className="container" style={{ marginTop: 44 }}>
          <h2 className="desa-section-title">📈 Perkiraan Ramai / Sepi (7 Hari)</h2>
          <div className="desa-forecast-card">
            <p className="desa-forecast-sub">
              Perkiraan tingkat keterisian pengunjung berdasarkan pola kunjungan & hari ini. Hari ini memakai data real-time.
              <strong style={{ color: '#94a3b8' }}> Estimasi saja</strong> — pola aktual bisa berbeda (cuaca, event, liburan).
            </p>
            <div className="desa-forecast-grid">
              {forecast.map((f, i) => {
                const color = f.persen >= 100 ? '#dc2626' : f.persen >= 80 ? '#f59e0b' : f.persen >= 45 ? '#16a34a' : '#0ea5e9';
                const emoji = f.persen >= 100 ? '🔴' : f.persen >= 80 ? '🟠' : f.persen >= 45 ? '🟢' : '🔵';
                return (
                  <div key={f.tanggal} className={`desa-forecast-day ${i === 0 ? 'today' : ''}`} style={{ '--fc': color } as CSSProperties}>
                    <div className="desa-forecast-hari">
                      {i === 0 ? 'Hari ini' : new Date(f.tanggal).toLocaleDateString('id-ID', { weekday: 'long' })}
                    </div>
                    <div className="desa-forecast-tgl">
                      {new Date(f.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </div>
                    <div className="desa-forecast-bar">
                      <div className="desa-forecast-bar-fill" style={{ width: `${Math.min(f.persen, 100)}%`, background: color }} />
                    </div>
                    <div className="desa-forecast-persen" style={{ color }}>{f.persen}%</div>
                    <div className="desa-forecast-status">{emoji} {f.status}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ===== RADAR CUACA REAL-TIME ===== */}
      <section className="container" style={{ marginTop: 44 }}>
        <h2 className="desa-section-title">🌧️ Radar Cuaca Real-Time</h2>
        <WeatherRadar desa={desa} height="360px" />
        <p className="desa-radar-note">
          Radar menampilkan gerakan hujan ~90 menit terakhir di sekitar {desa.namaDesa} (animasi otomatis).
          Sumber: RainViewer + OpenStreetMap. Periksa radar sebelum berangkat agar kunjungan tetap nyaman.
        </p>
      </section>

      {/* ===== FASILITAS ===== */}
      {desa.fasilitas && (
        <section className="container" style={{ marginTop: 44 }}>
          <h2 className="desa-section-title">🛎️ Fasilitas & Layanan</h2>
          <div className="desa-facility-grid">
            {desa.fasilitas.split(',').map((f) => f.trim()).filter(Boolean).map((f, i) => (
              <div key={i} className="desa-facility">
                <CheckCircle2 size={17} /> {f}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ===== KONTAK PENGELOLA ===== */}
      <section className="container" style={{ marginTop: 44 }}>
        <h2 className="desa-section-title">📞 Kontak Pengelola Desa</h2>
        <div className="desa-contact-grid">
          <a
            className="desa-contact-card"
            href={waNumber ? `https://wa.me/${waNumber}` : undefined}
            target="_blank"
            rel="noreferrer"
          >
            <div className="desa-contact-head">
              <span className="desa-contact-icon wa"><Phone size={17} /></span>
              <span className="desa-contact-label">WhatsApp / Telepon</span>
            </div>
            <div className="desa-contact-value">{desa.kontakPengelola || '-'}</div>
            {waNumber && <div className="desa-contact-hint">Klik untuk chat WhatsApp →</div>}
          </a>
          <a
            className="desa-contact-card"
            href={desa.emailPengelola ? `mailto:${desa.emailPengelola}` : undefined}
          >
            <div className="desa-contact-head">
              <span className="desa-contact-icon mail"><Mail size={17} /></span>
              <span className="desa-contact-label">Email</span>
            </div>
            <div className="desa-contact-value">{desa.emailPengelola || '-'}</div>
            {desa.emailPengelola && <div className="desa-contact-hint">Klik untuk kirim email →</div>}
          </a>
          <a
            className="desa-contact-card"
            href={websiteHref || socialHref || undefined}
            target="_blank"
            rel="noreferrer noopener"
          >
            <div className="desa-contact-head">
              <span className="desa-contact-icon web"><Globe size={17} /></span>
              <span className="desa-contact-label">Social Media / Website</span>
            </div>
            <div className="desa-contact-value">{desa.urlWebsite || desa.socialMedia || '-'}</div>
            {(websiteHref || socialHref) && (
              <div className="desa-contact-hint">Klik untuk kunjungi <ExternalLink size={11} /></div>
            )}
          </a>
        </div>
      </section>

      {/* ===== DESTINASI LAINNYA ===== */}
      {relatedDesa.length > 0 && (
        <section className="container" style={{ marginTop: 44 }}>
          <div className="sec2-head">
            <div className="sec2-head-left">
              <span className="sec2-eyebrow">
                <Compass size={13} />
                Rekomendasi Untukmu
              </span>
              <h2 className="desa-section-title" style={{ marginBottom: 6 }}>
                Destinasi Lainnya di Sekitar
              </h2>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                Jelajahi desa wisata lain dengan kategori atau lokasi serupa.
              </p>
            </div>
          </div>
          <div className="card-grid destinasi-related-grid">
            {relatedDesa.map((d) => (
              <DesaCard key={d.id} desa={d} onClick={() => navigate(`/desa/${d.id}`)} />
            ))}
          </div>
        </section>
      )}

      {/* ===== MINI MAP + ZONA ===== */}
      <section className="container" style={{ marginTop: 44, paddingBottom: 64 }}>
        <h2 className="desa-section-title">🗺️ Lokasi & Zona Keramaian</h2>
        <DesaMap data={[desa]} height="380px" showZones showPopup={false} />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          <span style={{
            padding: '6px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
            background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0',
          }}>🟢 Sepi</span>
          <span style={{
            padding: '6px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
            background: '#fffbeb', color: '#d97706', border: '1px solid #fde68a',
          }}>🟡 Lumayan Rame</span>
          <span style={{
            padding: '6px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
            background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca',
          }}>🔴 Rame</span>
        </div>
      </section>

      {/* ===== STICKY CTA (muncul setelah hero terlewati) ===== */}
      {showStickyCta && (
        <div className="desa-sticky-cta">
          <div className="container desa-sticky-cta-inner">
            <div className="desa-sticky-cta-info">
              <img className="desa-sticky-cta-thumb" src={heroImage} alt={desa.namaDesa} />
              <div style={{ minWidth: 0 }}>
                <div className="desa-sticky-cta-name">{desa.namaDesa}</div>
                <div className="desa-sticky-cta-meta">
                  {crowd!.emoji} {crowd!.label} • {desa.pengunjungHariIni}/{desa.batasPengunjung} pengunjung
                </div>
              </div>
            </div>
            <div className="desa-sticky-cta-price">
              <small>Tiket Lokal</small>
              {formatRupiah(desa.hargaTiketLokal)}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowBooking(true)}
              disabled={closed}
            >
              <Ticket size={17} /> {closed ? 'Booking Ditutup' : 'Pesan Tiket'}
            </button>
          </div>
        </div>
      )}

      {/* ===== LIGHTBOX GALERI (dengan navigasi; video tampil sebagai embed) ===== */}
      {lightboxIdx !== null && galeriPhotos[lightboxIdx] && (() => {
        const item = galeriPhotos[lightboxIdx];
        return (
          <div className="desa-lightbox" onClick={() => setLightboxIdx(null)}>
            <button className="desa-lightbox-close" aria-label="Tutup galeri">
              <X size={20} />
            </button>
            {galeriPhotos.length > 1 && (
              <>
                <button
                  className="desa-lightbox-nav prev"
                  aria-label="Item sebelumnya"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIdx((lightboxIdx - 1 + galeriPhotos.length) % galeriPhotos.length);
                  }}
                >‹</button>
                <button
                  className="desa-lightbox-nav next"
                  aria-label="Item berikutnya"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxIdx((lightboxIdx + 1) % galeriPhotos.length);
                  }}
                >›</button>
                <span className="desa-lightbox-counter">{lightboxIdx + 1} / {galeriPhotos.length}</span>
              </>
            )}
            <figure onClick={(e) => e.stopPropagation()} className={item.video ? 'is-video' : ''}>
              {item.video ? (
                <iframe
                  src={item.video.embedUrl}
                  title={item.label}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <img src={item.src} alt={item.label} />
              )}
              {item.label && (
                <figcaption>
                  {item.videoUrl && (
                    <a href={item.videoUrl} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
                      Buka di {item.video ? platformLabel(item.video.platform) : 'aplikasi'} ↗
                    </a>
                  )}
                  {item.label}
                </figcaption>
              )}
            </figure>
          </div>
        );
      })()}

      {/* ===== BOOKING MODAL (publik) ===== */}
      {showBooking && desa && (
        <BookingModal desa={desa} onClose={() => setShowBooking(false)} />
      )}
    </div>
  );
}

/** Tile video di grid galeri: thumbnail bila tersedia (YouTube), else panel gradient platform. */
function VideoTile({ embed, fallbackSrc, label }: { embed: EmbedInfo; fallbackSrc: string; label: string }) {
  return (
    <div className="desa-gallery-video-tile">
      {embed.thumbUrl ? (
        <img
          src={embed.thumbUrl}
          alt={label}
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = fallbackSrc;
          }}
        />
      ) : (
        <div className="desa-gallery-video-nothumb">
          <Video size={30} />
          <span>{embed.platform === 'tiktok' ? 'TikTok' : 'Instagram'}</span>
        </div>
      )}
      <span className="video-badge"><Video size={24} /></span>
    </div>
  );
}
