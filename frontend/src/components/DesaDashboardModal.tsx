import { useState, useEffect, useCallback } from 'react';
import {
  X, AlertTriangle, CheckCircle, Clock, ShieldAlert,
  Users, UserCheck, UserMinus, RotateCcw, Settings,
  DollarSign, Phone, Layers, Save, Sliders, Check, Ticket,
  CalendarClock, Hourglass, Image as ImageIcon
} from 'lucide-react';
import type { DesaWisata, Pengunjung, Pemesanan } from '../types/desawisata';
import { desaWisataApi } from '../api/desawisataApi';
import { usePolling } from '../utils/usePolling';

interface DesaDashboardModalProps {
  desa: DesaWisata;
  onClose: () => void;
  onUpdate: () => void;
}

export default function DesaDashboardModal({ desa: initialDesa, onClose, onUpdate }: DesaDashboardModalProps) {
  const [desa, setDesa] = useState<DesaWisata>(initialDesa);
  const [activeSubTab, setActiveSubTab] = useState<'overtourism' | 'operational' | 'pricing' | 'contact' | 'facilities'>('overtourism');
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Visitor / karcis states
  const [visitors, setVisitors] = useState<Pengunjung[]>([]);
  const [namaWisatawan, setNamaWisatawan] = useState('');
  const [kategoriTiket, setKategoriTiket] = useState<'Lokal' | 'Mancanegara'>('Lokal');
  const [karcisCheckout, setKarcisCheckout] = useState('');
  const [nomorBookingCheckin, setNomorBookingCheckin] = useState('');
  const [issuedTicket, setIssuedTicket] = useState<Pengunjung | null>(null);

  // Booking tertunda: sudah memesan online, BELUM ada di lokasi (tidak dihitung)
  const [pendings, setPendings] = useState<Pemesanan[]>([]);

  // Form states for settings
  const [settingsForm, setSettingsForm] = useState({
    // Overtourism
    batasPengunjung: initialDesa.batasPengunjung,
    thresholdPeringatan: initialDesa.thresholdPeringatan || 80,
    autoLockOvertourism: initialDesa.autoLockOvertourism ?? true,
    pesanPeringatan: initialDesa.pesanPeringatan || 'Kapasitas desa telah mencapai batas maksimal.',
    overtourism: initialDesa.overtourism,

    // Operational
    statusOperasional: initialDesa.statusOperasional || 'Buka',
    jamBuka: initialDesa.jamBuka || '08:00',
    jamTutup: initialDesa.jamTutup || '17:00',
    hariOperasional: initialDesa.hariOperasional || 'Senin - Minggu',

    // Contact
    kontakPengelola: initialDesa.kontakPengelola || '',
    emailPengelola: initialDesa.emailPengelola || '',
    socialMedia: initialDesa.socialMedia || '',

    // Pricing
    hargaTiketLokal: initialDesa.hargaTiketLokal || 10000,
    hargaTiketMancanegara: initialDesa.hargaTiketMancanegara || 50000,
    hargaParkirMotor: initialDesa.hargaParkirMotor || 3000,
    hargaParkirMobil: initialDesa.hargaParkirMobil || 10000,

    // Facilities
    fasilitas: initialDesa.fasilitas || 'Toilet, Area Parkir, Musholla, Homestay, WiFi',
  });

  useEffect(() => {
    setDesa(initialDesa);
    setSettingsForm({
      batasPengunjung: initialDesa.batasPengunjung,
      thresholdPeringatan: initialDesa.thresholdPeringatan || 80,
      autoLockOvertourism: initialDesa.autoLockOvertourism ?? true,
      pesanPeringatan: initialDesa.pesanPeringatan || 'Kapasitas desa telah mencapai batas maksimal.',
      overtourism: initialDesa.overtourism,

      statusOperasional: initialDesa.statusOperasional || 'Buka',
      jamBuka: initialDesa.jamBuka || '08:00',
      jamTutup: initialDesa.jamTutup || '17:00',
      hariOperasional: initialDesa.hariOperasional || 'Senin - Minggu',

      kontakPengelola: initialDesa.kontakPengelola || '',
      emailPengelola: initialDesa.emailPengelola || '',
      socialMedia: initialDesa.socialMedia || '',

      hargaTiketLokal: initialDesa.hargaTiketLokal || 10000,
      hargaTiketMancanegara: initialDesa.hargaTiketMancanegara || 50000,
      hargaParkirMotor: initialDesa.hargaParkirMotor || 3000,
      hargaParkirMobil: initialDesa.hargaParkirMobil || 10000,

      fasilitas: initialDesa.fasilitas || 'Toilet, Area Parkir, Musholla, Homestay, WiFi',
    });
  }, [initialDesa]);

  const loadVisitors = useCallback(async () => {
    try {
      const res = await desaWisataApi.getActiveVisitors(desa.id);
      if (res.success) setVisitors(res.data);
    } catch {
      // Ignore background refresh errors; the next tick will retry
    }
  }, [desa.id]);

  const loadPendings = useCallback(async () => {
    try {
      const res = await desaWisataApi.getPemesanan(desa.id, 'Tertunda');
      if (res.success) setPendings(res.data);
    } catch {
      // Ignore background refresh errors; the next tick will retry
    }
  }, [desa.id]);

  useEffect(() => {
    void loadVisitors();
    void loadPendings();
  }, [loadVisitors, loadPendings]);

  // Keep the visitor counters + active visitor list live while this dashboard is open
  usePolling(() => {
    desaWisataApi
      .getById(desa.id)
      .then((res) => {
        if (res.success) setDesa(res.data);
      })
      .catch(() => {
        // Ignore background refresh errors; the next tick will retry
      });
    void loadVisitors();
    void loadPendings();
  });

  const showNotification = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const formatJam = (iso: string) =>
    new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Format tanggal lengkap dengan hari: Kamis, 4 September 2026
  const formatTanggalLengkap = (iso: string) =>
    new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const isKunjunganTerlewat = (p: Pemesanan) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(p.tanggalKunjungan).getTime() < today.getTime();
  };

  const performCheckIn = async (opts: {
    nama?: string;
    kategori?: 'Lokal' | 'Mancanegara';
    nomorBooking?: string;
  }) => {
    const nama = (opts.nama ?? '').trim();
    const viaBooking = Boolean(opts.nomorBooking && opts.nomorBooking.trim());
    if (!nama && !viaBooking) {
      showNotification('Masukkan nama wisatawan atau nomor booking terlebih dahulu', 'error');
      return;
    }
    if (!viaBooking && settingsForm.autoLockOvertourism && isFull) {
      showNotification(desa.pesanPeringatan || 'Kapasitas penuh, check-in dikunci otomatis.', 'error');
      return;
    }
    try {
      setLoading(true);
      const res = await desaWisataApi.checkIn(desa.id, {
        namaWisatawan: nama,
        kategoriTiket: opts.kategori ?? kategoriTiket,
        nomorBooking: viaBooking ? opts.nomorBooking?.trim() : '',
      });
      if (res.success) {
        setDesa(res.data.desa);
        setIssuedTicket(res.data.pengunjung);
        setNamaWisatawan('');
        setNomorBookingCheckin('');
        showNotification(res.message, res.data.desa.overtourism && !viaBooking ? 'error' : 'success');
        onUpdate();
        void loadVisitors();
        void loadPendings();
      }
    } catch (err: any) {
      showNotification(err.message || 'Gagal check-in', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckIn = async (e?: React.FormEvent) => {
    e?.preventDefault();
    await performCheckIn({
      nama: namaWisatawan,
      kategori: kategoriTiket,
      nomorBooking: nomorBookingCheckin,
    });
  };

  // Konfirmasi kedatangan: wisatawan booking (tertunda) benar-benar tiba di lokasi.
  // Ini memakai endpoint check-in yang sama -> baru di sini wisatawan dihitung.
  const handleConfirmArrival = async (p: Pemesanan) => {
    if (!confirm(
      `Konfirmasi kedatangan "${p.namaWisatawan}" (booking ${p.nomorBooking}) di ${desa.namaDesa}?\n`
      + 'Wisatawan akan di-check-in, menerima karcis, dan mulai dihitung sebagai wisatawan di dalam desa.'
    )) return;
    await performCheckIn({ nomorBooking: p.nomorBooking });
  };

  const handleCheckOut = async (e?: React.FormEvent, nomorKarcis?: string) => {
    e?.preventDefault();
    const nomor = (nomorKarcis ?? karcisCheckout).trim();
    if (!nomor) {
      showNotification('Masukkan nomor karcis / nomor wisatawan', 'error');
      return;
    }
    if (desa.pengunjungHariIni <= 0) return;
    try {
      setLoading(true);
      const res = await desaWisataApi.checkOut(desa.id, nomor);
      if (res.success) {
        setDesa(res.data.desa);
        setKarcisCheckout('');
        showNotification(res.message, 'success');
        onUpdate();
        void loadVisitors();
        void loadPendings();
      }
    } catch (err: any) {
      showNotification(err.message || 'Gagal check-out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCheckOut = async (karcis: string, nama: string) => {
    if (!confirm(`Check-out wisatawan "${nama}" (karcis ${karcis})?`)) return;
    try {
      setLoading(true);
      const res = await desaWisataApi.checkOut(desa.id, karcis);
      if (res.success) {
        setDesa(res.data.desa);
        showNotification(res.message, 'success');
        onUpdate();
        void loadVisitors();
        void loadPendings();
      }
    } catch (err: any) {
      showNotification(err.message || 'Gagal check-out', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetVisitors = async () => {
    if (!confirm(`Reset pengunjung hari ini untuk ${desa.namaDesa}? Semua karcis aktif akan ditutup.`)) return;
    try {
      setLoading(true);
      const res = await desaWisataApi.resetVisitors(desa.id);
      if (res.success) {
        setDesa(res.data);
        setIssuedTicket(null);
        setKarcisCheckout('');
        showNotification(res.message, 'success');
        onUpdate();
        void loadVisitors();
        void loadPendings();
      }
    } catch {
      showNotification('Gagal reset pengunjung', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const res = await desaWisataApi.update(desa.id, settingsForm);
      if (res.success) {
        setDesa(res.data);
        showNotification(`Pengaturan untuk ${desa.namaDesa} berhasil disimpan!`);
        onUpdate();
      }
    } catch {
      showNotification('Gagal menyimpan pengaturan desa', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Calculations
  const percentage = desa.batasPengunjung > 0
    ? Math.round((desa.pengunjungHariIni / desa.batasPengunjung) * 100)
    : 0;
  const isWarning = percentage >= (settingsForm.thresholdPeringatan || 80) && percentage < 100;
  const isFull = percentage >= 100 || desa.overtourism;
  const estimatedRevenue = (desa.pengunjungHariIni * settingsForm.hargaTiketLokal).toLocaleString('id-ID');

  const facilityOptions = [
    'Toilet', 'Area Parkir', 'Musholla', 'Homestay',
    'WiFi', 'Restoran', 'Tour Guide', 'Pusat Oleh-oleh',
    'Spot Foto', 'Penyewaan Alat', 'Pusat Informasi'
  ];

  const currentFacilities = settingsForm.fasilitas.split(',').map(f => f.trim());

  const toggleFacility = (facility: string) => {
    let updated: string[];
    if (currentFacilities.includes(facility)) {
      updated = currentFacilities.filter(f => f !== facility);
    } else {
      updated = [...currentFacilities, facility];
    }
    setSettingsForm({ ...settingsForm, fasilitas: updated.join(', ') });
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 900, width: '95%', maxHeight: '92vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, var(--green-800), var(--green-900))',
          padding: '24px 32px', color: 'white', position: 'relative'
        }}>
          <button
            onClick={onClose}
            style={{
              position: 'absolute', right: 20, top: 20, background: 'rgba(255,255,255,0.15)',
              border: 'none', color: 'white', borderRadius: '50%', width: 34, height: 34,
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
            }}
          >
            <X size={20} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <span style={{
              padding: '4px 12px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700,
              background: desa.aktif ? '#22c55e' : '#6b7280', color: 'white'
            }}>
              {desa.aktif ? '● Desa Aktif' : '○ Nonaktif'}
            </span>
            <span style={{
              padding: '4px 12px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700,
              background: isFull ? '#dc2626' : isWarning ? '#f59e0b' : '#16a34a', color: 'white'
            }}>
              {isFull ? '🔴 Overtourism / Penuh' : isWarning ? '🟡 Hampir Penuh' : '🟢 Kapasitas Normal'}
            </span>
            <span style={{
              padding: '4px 12px', borderRadius: 100, fontSize: '0.75rem', fontWeight: 700,
              background: 'rgba(255,255,255,0.2)', color: 'white'
            }}>
              Jam Operasional: {settingsForm.jamBuka} - {settingsForm.jamTutup}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: '1.6rem', color: 'white', fontWeight: 800 }}>
            📊 Dashboard Desa: {desa.namaDesa}
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.9rem', color: 'var(--green-200)' }}>
            📍 {desa.kecamatan}, {desa.kabupaten}, {desa.provinsi} • Kategori: {desa.kategori}
          </p>
        </div>

        {/* Notification Toast inside modal */}
        {toastMessage && (
          <div style={{
            margin: '12px 24px 0', padding: '10px 16px', borderRadius: 8,
            background: toastType === 'error' ? '#fef2f2' : '#f0fdf4',
            border: `1px solid ${toastType === 'error' ? '#fca5a5' : '#bbf7d0'}`,
            color: toastType === 'error' ? '#dc2626' : '#15803d',
            fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8
          }}>
            {toastType === 'error' ? <AlertTriangle size={18} /> : <CheckCircle size={18} />}
            {toastMessage}
          </div>
        )}

        {/* Main Dashboard Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
          {/* Quick Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 28 }}>
            {/* Capacity & Visitor Gauge */}
            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} color="#3b82f6" />
                Pengunjung Hari Ini
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
                {desa.pengunjungHariIni} <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 500 }}>/ {desa.batasPengunjung} kuota</span>
              </div>
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${Math.min(percentage, 100)}%`, height: '100%',
                    background: isFull ? '#dc2626' : isWarning ? '#f59e0b' : '#22c55e',
                    transition: 'width 0.4s ease'
                  }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.75rem', fontWeight: 700 }}>
                  <span style={{ color: isFull ? '#dc2626' : isWarning ? '#d97706' : '#16a34a' }}>{percentage}% Kapasitas</span>
                  <span style={{ color: '#64748b' }}>Ambang: {settingsForm.thresholdPeringatan}%</span>
                </div>
              </div>
            </div>

            {/* Total Wisatawan */}
            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <UserCheck size={16} color="#16a34a" />
                Total Wisatawan Cumulatif
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f172a' }}>
                {desa.jumlahWisatawan.toLocaleString('id-ID')}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                ⭐ Rating Desa: {desa.rating}/5.0
              </div>
            </div>

            {/* Estimasi Pendapatan Tiket Hari Ini */}
            <div style={{ background: '#f8fafc', padding: 18, borderRadius: 14, border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <DollarSign size={16} color="#8b5cf6" />
                Estimasi Omset Tiket Hari Ini
              </div>
              <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                Rp {estimatedRevenue}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 8 }}>
                Tiket Lokal: Rp {settingsForm.hargaTiketLokal.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Quick Visitor Controls (karcis) */}
          <div className="visitor-controls">
            <div className="visitor-controls-title">
              <Sliders size={18} />
              Kontrol Check-In / Check-Out Desa {desa.namaDesa}
            </div>

            <div className="visitor-columns">
              {/* CHECK-IN */}
              <div className="visitor-box visitor-box--checkin">
                <div className="visitor-box-label">
                  <UserCheck size={16} /> Check-In & Terbitkan Karcis
                </div>
                <form onSubmit={handleCheckIn}>
                  <div className="form-group">
                    <label>Nama Wisatawan {nomorBookingCheckin.trim() ? '(otomatis dari booking)' : '*'}</label>
                    <input
                      type="text"
                      placeholder="Contoh: Budi Santoso"
                      value={namaWisatawan}
                      onChange={(e) => setNamaWisatawan(e.target.value)}
                      maxLength={150}
                    />
                  </div>
                  <div className="form-group">
                    <label>Kategori Tiket</label>
                    <select
                      value={kategoriTiket}
                      onChange={(e) => setKategoriTiket(e.target.value as 'Lokal' | 'Mancanegara')}
                    >
                      <option value="Lokal">Lokal (Rp {settingsForm.hargaTiketLokal.toLocaleString('id-ID')})</option>
                      <option value="Mancanegara">Mancanegara (Rp {settingsForm.hargaTiketMancanegara.toLocaleString('id-ID')})</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Nomor Booking (opsional)</label>
                    <input
                      type="text"
                      placeholder="Contoh: B-001-20260904-0001"
                      value={nomorBookingCheckin}
                      onChange={(e) => setNomorBookingCheckin(e.target.value)}
                      maxLength={30}
                    />
                    <small className="visitor-hint">
                      Diisi saat wisatawan sudah booking online & baru tiba di lokasi → konfirmasi kedatangan.
                    </small>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn btn-primary btn-sm visitor-submit"
                  >
                    <UserCheck size={16} />
                    {loading ? 'Memproses...' : 'Check-In + Terbitkan Karcis'}
                  </button>
                </form>

                {issuedTicket && (
                  <div className="ticket-issued">
                    <Ticket size={22} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <small>
                        Karcis diterbitkan untuk <strong>{issuedTicket.namaWisatawan}</strong>
                      </small>
                      <div className="ticket-issued-no">{issuedTicket.nomorKarcis}</div>
                      <span className="ticket-issued-note">
                        Berikan karcis ini ke wisatawan. Saat keluar cukup sebutkan nomor karcisnya.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* CHECK-OUT */}
              <div className="visitor-box visitor-box--checkout">
                <div className="visitor-box-label">
                  <UserMinus size={16} /> Check-Out Wisatawan
                </div>
                <form onSubmit={handleCheckOut}>
                  <div className="form-group">
                    <label>Nomor Karcis / Nomor Wisatawan</label>
                    <input
                      type="text"
                      placeholder="Contoh: T-001-20260903-0001"
                      value={karcisCheckout}
                      onChange={(e) => setKarcisCheckout(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || desa.pengunjungHariIni <= 0}
                    className="btn btn-secondary btn-sm visitor-submit"
                    style={{ color: '#1e40af', borderColor: '#a5b4fc' }}
                  >
                    <UserMinus size={16} />
                    {loading ? 'Memproses...' : 'Check-Out (Tukar Karcis)'}
                  </button>
                  <small className="visitor-hint">
                    Wisatawan menunjukkan karcisnya saat keluar, lalu admin memasukkan nomor karcis di sini.
                  </small>
                </form>
              </div>
            </div>

            {/* Active visitors inside the village */}
            <div className="visitor-list">
              <div className="visitor-list-head">
                <span className="visitor-list-title">
                  <Users size={16} /> Wisatawan di Dalam Desa ({visitors.length})
                </span>
                <span className="visitor-list-note">Ter-update otomatis</span>
              </div>

              {visitors.length === 0 ? (
                <div className="visitor-empty">
                  Tidak ada wisatawan yang sedang berada di dalam desa saat ini.
                </div>
              ) : (
                <div className="visitor-rows">
                  {visitors.map((v) => (
                    <div key={v.id} className="visitor-row">
                      <div className="visitor-row-main">
                        <div className="visitor-name">
                          {v.namaWisatawan}
                          <span className={`tiket-badge ${v.kategoriTiket === 'Mancanegara' ? 'manca' : 'lokal'}`}>
                            {v.kategoriTiket}
                          </span>
                        </div>
                        <div className="visitor-meta">
                          🎫 {v.nomorKarcis} • Masuk pukul {formatJam(v.checkInAt)}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleQuickCheckOut(v.nomorKarcis, v.namaWisatawan)}
                        disabled={loading}
                        style={{ padding: '6px 12px', fontSize: '0.78rem', color: '#dc2626', borderColor: '#fca5a5', flexShrink: 0 }}
                      >
                        <UserMinus size={14} /> Check-Out
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booked-but-not-arrived visitors: sudah booking, BELUM di lokasi -> tidak dihitung */}
            <div style={{
              marginTop: 16,
              background: '#fffbeb',
              border: '1px solid #fde68a',
              borderRadius: 14,
              padding: '14px 16px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, flexWrap: 'wrap', marginBottom: 12,
              }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontWeight: 800, fontSize: '0.92rem', color: '#78350f' }}>
                  <Hourglass size={16} color="#d97706" />
                  Wisatawan Tertunda - Booking Belum Hadir ({pendings.length})
                </span>
                <span style={{ fontSize: '0.72rem', color: '#a16207' }}>Ter-update otomatis</span>
              </div>

              {pendings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '18px 12px', background: '#fff7ed', borderRadius: 10, fontSize: '0.85rem', color: '#b45309' }}>
                  Tidak ada booking tertunda. Wisatawan yang sudah booking online akan tampil di sini
                  (belum dihitung) sampai mereka tiba & di-check-in di lokasi.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendings.map((p) => {
                    const terlewat = isKunjunganTerlewat(p);
                    return (
                      <div
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', background: '#fff',
                          border: `1px solid ${terlewat ? '#fca5a5' : '#fde68a'}`,
                          borderRadius: 10, flexWrap: 'wrap',
                        }}
                      >
                        {p.urlFoto ? (
                          <img
                            src={p.urlFoto}
                            alt={p.namaWisatawan}
                            style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.visibility = 'hidden';
                            }}
                          />
                        ) : (
                          <span style={{
                            width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: '#fef3c7', color: '#b45309',
                          }}>
                            <ImageIcon size={18} />
                          </span>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {p.namaWisatawan}
                            <span className={`tiket-badge ${p.kategoriTiket === 'Mancanegara' ? 'manca' : 'lokal'}`}>
                              {p.kategoriTiket}
                            </span>
                            {terlewat && (
                              <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '1px 8px', borderRadius: 100, background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                                Hari kunjungan terlewat
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>
                            <span style={{ fontWeight: 700, color: '#b45309' }}>🕐 {p.nomorBooking}</span>{' '}
                            • Booking: {formatTanggalLengkap(p.tanggalBooking)}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                            <CalendarClock size={13} style={{ flexShrink: 0 }} />
                            Rencana kunjungan: <strong>{formatTanggalLengkap(p.tanggalKunjungan)}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleConfirmArrival(p)}
                          disabled={loading}
                          style={{ padding: '6px 12px', fontSize: '0.76rem', flexShrink: 0 }}
                        >
                          <UserCheck size={14} />
                          Konfirmasi Kedatangan & Terbitkan Karcis
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ margin: '12px 0 0', fontSize: '0.74rem', color: '#92400e', lineHeight: 1.5 }}>
                Wisatawan yang sudah memesan tapi belum ada di lokasi <strong>belum dihitung</strong> di
                dashboard per-desa maupun global. Saat mereka tiba, klik tombol konfirmasi kedatangan di atas
                (atau isi nomor booking di form check-in) → baru dihitung & karcis diterbitkan.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button
                type="button"
                onClick={handleResetVisitors}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', color: '#dc2626', borderColor: '#fca5a5' }}
              >
                <RotateCcw size={15} />
                Reset Pengunjung Hari Ini
              </button>
            </div>
          </div>

          {/* Settings Section Title */}
          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 20, marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={20} color="var(--green-700)" />
              Pengaturan Khusus Desa {desa.namaDesa}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
              Kelola batas overtourism, jam buka, harga tiket, kontak, dan fasilitas khusus untuk desa ini.
            </p>
          </div>

          {/* Settings Sub-Tabs Navigation */}
          <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('overtourism')}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.88rem',
                color: activeSubTab === 'overtourism' ? 'var(--green-800)' : '#64748b',
                borderBottom: activeSubTab === 'overtourism' ? '3px solid var(--green-800)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <ShieldAlert size={16} />
              Overtourism & Kapasitas
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('operational')}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.88rem',
                color: activeSubTab === 'operational' ? 'var(--green-800)' : '#64748b',
                borderBottom: activeSubTab === 'operational' ? '3px solid var(--green-800)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Clock size={16} />
              Jam & Operasional
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('pricing')}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.88rem',
                color: activeSubTab === 'pricing' ? 'var(--green-800)' : '#64748b',
                borderBottom: activeSubTab === 'pricing' ? '3px solid var(--green-800)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <DollarSign size={16} />
              Harga Tiket & Parkir
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('contact')}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.88rem',
                color: activeSubTab === 'contact' ? 'var(--green-800)' : '#64748b',
                borderBottom: activeSubTab === 'contact' ? '3px solid var(--green-800)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Phone size={16} />
              Kontak & Pengelola
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('facilities')}
              style={{
                padding: '8px 16px', border: 'none', background: 'none', cursor: 'pointer',
                fontWeight: 700, fontSize: '0.88rem',
                color: activeSubTab === 'facilities' ? 'var(--green-800)' : '#64748b',
                borderBottom: activeSubTab === 'facilities' ? '3px solid var(--green-800)' : '3px solid transparent',
                display: 'flex', alignItems: 'center', gap: 6
              }}
            >
              <Layers size={16} />
              Fasilitas Desa
            </button>
          </div>

          {/* Settings Form */}
          <form onSubmit={handleSaveSettings}>
            {/* SUBTAB 1: OVERTOURISM */}
            {activeSubTab === 'overtourism' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Batas Kapasitas Pengunjung Harian *</label>
                  <input
                    type="number"
                    min={10}
                    required
                    value={settingsForm.batasPengunjung}
                    onChange={(e) => setSettingsForm({ ...settingsForm, batasPengunjung: parseInt(e.target.value) || 0 })}
                  />
                  <small style={{ color: '#64748b' }}>Jumlah maksimal pengunjung per hari untuk desa ini.</small>
                </div>

                <div className="form-group">
                  <label>Ambang Peringatan Overtourism (%)</label>
                  <input
                    type="number"
                    min={50}
                    max={99}
                    value={settingsForm.thresholdPeringatan}
                    onChange={(e) => setSettingsForm({ ...settingsForm, thresholdPeringatan: parseInt(e.target.value) || 80 })}
                  />
                  <small style={{ color: '#64748b' }}>Status akan menjadi "Hampir Penuh" jika mencapai persentase ini.</small>
                </div>

                <div className="form-group">
                  <label>Auto-Lock Check-In Saat Penuh</label>
                  <select
                    value={settingsForm.autoLockOvertourism ? 'true' : 'false'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, autoLockOvertourism: e.target.value === 'true' })}
                  >
                    <option value="true">Aktif (Tolak Check-In Baru Saat Penuh)</option>
                    <option value="false">Non-Aktif (Hanya Tampilkan Peringatan)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Status Manual Overtourism</label>
                  <select
                    value={settingsForm.overtourism ? 'true' : 'false'}
                    onChange={(e) => setSettingsForm({ ...settingsForm, overtourism: e.target.value === 'true' })}
                  >
                    <option value="false">Normal (Sesuai Kuota Harian)</option>
                    <option value="true">Paksa Kunci (Aktifkan Mode Penuh Darurat)</option>
                  </select>
                </div>

                <div className="form-group full-width">
                  <label>Pesan Peringatan Overtourism (Tampil Saat Penuh)</label>
                  <textarea
                    rows={2}
                    value={settingsForm.pesanPeringatan}
                    onChange={(e) => setSettingsForm({ ...settingsForm, pesanPeringatan: e.target.value })}
                    placeholder="Pesan yang ditampilkan kepada wisatawan saat desa penuh..."
                  />
                </div>
              </div>
            )}

            {/* SUBTAB 2: OPERATIONAL */}
            {activeSubTab === 'operational' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Status Operasional Desa</label>
                  <select
                    value={settingsForm.statusOperasional}
                    onChange={(e) => setSettingsForm({ ...settingsForm, statusOperasional: e.target.value })}
                  >
                    <option value="Buka">🟢 Buka Setiap Hari</option>
                    <option value="Tutup Sementara">🔴 Tutup Sementara (Pemeliharaan/Acara Adat)</option>
                    <option value="Khusus Reservasi">🟡 Khusus Reservasi Terlebih Dahulu</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Hari Operasional</label>
                  <input
                    type="text"
                    placeholder="Senin - Minggu"
                    value={settingsForm.hariOperasional}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hariOperasional: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Jam Buka</label>
                  <input
                    type="text"
                    placeholder="08:00"
                    value={settingsForm.jamBuka}
                    onChange={(e) => setSettingsForm({ ...settingsForm, jamBuka: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Jam Tutup</label>
                  <input
                    type="text"
                    placeholder="17:00"
                    value={settingsForm.jamTutup}
                    onChange={(e) => setSettingsForm({ ...settingsForm, jamTutup: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* SUBTAB 3: PRICING */}
            {activeSubTab === 'pricing' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Harga Tiket Wisatawan Lokal (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.hargaTiketLokal}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hargaTiketLokal: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>Harga Tiket Wisatawan Mancanegara (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.hargaTiketMancanegara}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hargaTiketMancanegara: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>Tarif Parkir Motor (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.hargaParkirMotor}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hargaParkirMotor: parseInt(e.target.value) || 0 })}
                  />
                </div>

                <div className="form-group">
                  <label>Tarif Parkir Mobil (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    value={settingsForm.hargaParkirMobil}
                    onChange={(e) => setSettingsForm({ ...settingsForm, hargaParkirMobil: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            {/* SUBTAB 4: CONTACT */}
            {activeSubTab === 'contact' && (
              <div className="form-grid">
                <div className="form-group">
                  <label>Kontak / WhatsApp Pengelola</label>
                  <input
                    type="text"
                    placeholder="+62 812-3456-7890"
                    value={settingsForm.kontakPengelola}
                    onChange={(e) => setSettingsForm({ ...settingsForm, kontakPengelola: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email Pengelola Desa</label>
                  <input
                    type="email"
                    placeholder="pengelola@desawisata.id"
                    value={settingsForm.emailPengelola}
                    onChange={(e) => setSettingsForm({ ...settingsForm, emailPengelola: e.target.value })}
                  />
                </div>

                <div className="form-group full-width">
                  <label>Social Media / Website</label>
                  <input
                    type="text"
                    placeholder="@desawisata_official / www.desawisata.id"
                    value={settingsForm.socialMedia}
                    onChange={(e) => setSettingsForm({ ...settingsForm, socialMedia: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* SUBTAB 5: FACILITIES */}
            {activeSubTab === 'facilities' && (
              <div>
                <label style={{ display: 'block', fontWeight: 700, marginBottom: 12, color: '#0f172a' }}>
                  Pilih Fasilitas & Layanan yang Tersedia di Desa Wisata {desa.namaDesa}:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginBottom: 20 }}>
                  {facilityOptions.map((facility) => {
                    const isSelected = currentFacilities.includes(facility);
                    return (
                      <button
                        type="button"
                        key={facility}
                        onClick={() => toggleFacility(facility)}
                        style={{
                          padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${isSelected ? 'var(--green-700)' : '#cbd5e1'}`,
                          background: isSelected ? '#f0fdf4' : 'white',
                          color: isSelected ? 'var(--green-900)' : '#475569',
                          fontWeight: isSelected ? 700 : 500, fontSize: '0.85rem',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          cursor: 'pointer', textAlign: 'left'
                        }}
                      >
                        <span>{facility}</span>
                        {isSelected && <Check size={16} color="var(--green-700)" />}
                      </button>
                    );
                  })}
                </div>
                <div className="form-group">
                  <label>Fasilitas Lainnya (Ketik Manual / Pisahkan dengan Koma)</label>
                  <input
                    type="text"
                    value={settingsForm.fasilitas}
                    onChange={(e) => setSettingsForm({ ...settingsForm, fasilitas: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* Save Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', fontSize: '0.95rem' }}
              >
                <Save size={18} />
                {loading ? 'Menyimpan...' : `Simpan Pengaturan ${desa.namaDesa}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
