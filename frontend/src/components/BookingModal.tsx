import { useState } from 'react';
import { X, CalendarCheck, Ticket, Info, CheckCircle, UserCheck } from 'lucide-react';
import type { DesaWisata, Pemesanan } from '../types/desawisata';
import { desaWisataApi } from '../api/desawisataApi';
import ImageUpload from './ImageUpload';

interface BookingModalProps {
  desa: DesaWisata;
  onClose: () => void;
}

export default function BookingModal({ desa, onClose }: BookingModalProps) {
  const [namaWisatawan, setNamaWisatawan] = useState('');
  const [kategoriTiket, setKategoriTiket] = useState<'Lokal' | 'Mancanegara'>('Lokal');
  const [tanggalKunjungan, setTanggalKunjungan] = useState('');
  const [urlFoto, setUrlFoto] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<Pemesanan | null>(null);

  const tutupSementara = desa.statusOperasional === 'Tutup Sementara';
  const todayIso = new Date().toISOString().slice(0, 10);
  const hargaTiket = kategoriTiket === 'Lokal' ? desa.hargaTiketLokal : desa.hargaTiketMancanegara;
  const pajakPersen = desa.persenPajakDaerah ?? 10;
  const totalBayar = Math.round(hargaTiket * (1 + pajakPersen / 100));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const nama = namaWisatawan.trim();
    if (!nama) {
      setError('Masukkan nama wisatawan terlebih dahulu');
      return;
    }
    if (!tanggalKunjungan) {
      setError('Pilih tanggal kunjungan terlebih dahulu');
      return;
    }

    try {
      setLoading(true);
      const res = await desaWisataApi.createPemesanan(desa.id, {
        namaWisatawan: nama,
        kategoriTiket,
        tanggalKunjungan,
        urlFoto,
      });
      if (res.success) {
        setSuccess(res.data);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat booking. Pastikan backend berjalan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
        <div className="modal-header">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ticket size={20} color="var(--green-700)" />
            Booking Tiket Kunjungan
          </h2>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {success ? (
          <div className="modal-body">
            <div style={{
              textAlign: 'center', padding: '28px 20px',
              background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '0 auto 12px',
                background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <CheckCircle size={28} color="#16a34a" />
              </div>
              <h3 style={{ margin: '0 0 6px', color: '#14532d' }}>Booking Berhasil! 🎉</h3>
              <p style={{ margin: '0 0 16px', fontSize: '0.88rem', color: '#166534' }}>
                Booking untuk <strong>{success.namaWisatawan}</strong> di{' '}
                <strong>{desa.namaDesa}</strong> telah tercatat.
              </p>

              <div style={{
                display: 'inline-block', padding: '12px 22px', background: 'white',
                border: '2px dashed #16a34a', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                  KODE BOOKING
                </div>
                <div style={{
                  fontSize: '1.5rem', fontWeight: 800, color: '#0f172a',
                  fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.02em',
                }}>
                  {success.nomorBooking}
                </div>
              </div>

              <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: 1.7, textAlign: 'left', background: 'white', border: '1px solid #e2e8f0', borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: '#64748b' }}>Tanggal kunjungan:</span>
                  <strong>
                    {new Date(success.tanggalKunjungan).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 6 }}>
                  <span style={{ color: '#64748b' }}>Status saat ini:</span>
                  <strong style={{ color: '#d97706' }}>🕐 Tertunda (belum ada di lokasi)</strong>
                </div>
              </div>

              <p style={{ margin: '16px 0 0', fontSize: '0.82rem', color: '#64748b', lineHeight: 1.6 }}>
                <Info size={14} style={{ verticalAlign: '-2px', marginRight: 4 }} />
                Booking ini <strong>belum dihitung</strong> sebagai wisatawan. Saat tiba di lokasi,
                tunjukkan kode booking di atas kepada petugas — petugas akan check-in
                (konfirmasi kedatangan) dan menerbitkan karcis Anda.
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-primary" onClick={onClose}>
                Selesai
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              <div style={{
                display: 'flex', gap: 10, padding: '12px 14px', marginBottom: 16,
                background: tutupSementara ? '#fef2f2' : '#fffbeb',
                border: `1px solid ${tutupSementara ? '#fecaca' : '#fde68a'}`,
                borderRadius: 10, fontSize: '0.82rem', lineHeight: 1.6,
                color: tutupSementara ? '#b91c1c' : '#92400e',
              }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  {tutupSementara
                    ? `Desa ${desa.namaDesa} sedang tutup sementara dan belum bisa menerima booking.`
                    : 'Booking dicatat sebagai tertunda dan belum dihitung sebagai wisatawan. '
                      + 'Wisatawan baru dihitung setelah tiba di lokasi dan di-check-in oleh petugas desa.'}
                </span>
              </div>

              <div className="form-grid">
                <div className="form-group full-width">
                  <label>Nama Wisatawan *</label>
                  <input
                    type="text"
                    placeholder="Contoh: Budi Santoso"
                    value={namaWisatawan}
                    onChange={(e) => setNamaWisatawan(e.target.value)}
                    maxLength={150}
                  />
                </div>
                <div className="form-group full-width">
                  <label>Kategori Tiket</label>
                  <select
                    value={kategoriTiket}
                    onChange={(e) => setKategoriTiket(e.target.value as 'Lokal' | 'Mancanegara')}
                  >
                    <option value="Lokal">Lokal (Rp {desa.hargaTiketLokal.toLocaleString('id-ID')})</option>
                    <option value="Mancanegara">Mancanegara (Rp {desa.hargaTiketMancanegara.toLocaleString('id-ID')})</option>
                  </select>
                </div>
                <div className="form-group full-width">
                  <label>Tanggal Kunjungan *</label>
                  <input
                    type="date"
                    min={todayIso}
                    required
                    value={tanggalKunjungan}
                    onChange={(e) => setTanggalKunjungan(e.target.value)}
                  />
                  <small style={{ color: '#64748b' }}>
                    Pilih tanggal/hari/tahun Anda berencana berkunjung ke {desa.namaDesa}.
                  </small>
                </div>
                <div className="form-group full-width">
                  <label>Foto Wisatawan (Opsional)</label>
                  <ImageUpload
                    currentUrl={urlFoto}
                    onUpload={(url) => setUrlFoto(url)}
                    onRemove={() => setUrlFoto('')}
                  />
                  <small style={{ color: '#64748b' }}>
                    Lampirkan foto wisatawan agar memudahkan petugas mengenali Anda saat tiba.
                  </small>
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop: 8, padding: '10px 14px', borderRadius: 8,
                  background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
                  fontSize: '0.85rem', fontWeight: 600,
                }}>
                  {error}
                </div>
              )}

              <div style={{
                marginTop: 16, padding: '12px 16px',
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: '0.95rem', fontWeight: 700, color: '#0f172a',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CalendarCheck size={16} color="var(--green-700)" />
                  Estimasi tiket
                </span>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", textAlign: 'right' }}>
                  Rp {totalBayar.toLocaleString('id-ID')}
                  <small style={{ display: 'block', fontFamily: "'DM Sans', sans-serif", fontSize: '0.68rem', fontWeight: 600, color: '#64748b' }}>
                    tiket Rp {hargaTiket.toLocaleString('id-ID')} + pajak daerah {pajakPersen}%
                  </small>
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>Batal</button>
              <button type="submit" className="btn btn-primary btn-sm" disabled={loading || tutupSementara}>
                <UserCheck size={16} />
                {loading ? 'Memproses...' : 'Booking Sekarang'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
