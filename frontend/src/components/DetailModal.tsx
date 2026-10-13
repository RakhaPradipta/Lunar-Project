import { useNavigate } from 'react-router-dom';
import {
  X, MapPin, Star, Users, Tag, Calendar, Globe, Image, Video,
  Clock, Ticket, ArrowRight,
} from 'lucide-react';
import type { DesaWisata } from '../types/desawisata';

interface DetailModalProps {
  desa: DesaWisata;
  onClose: () => void;
}

export default function DetailModal({ desa, onClose }: DetailModalProps) {
  const navigate = useNavigate();
  const formatNumber = (num: number) => num.toLocaleString('id-ID');
  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const opsIcon =
    desa.statusOperasional === 'Buka' ? '🟢' : desa.statusOperasional === 'Tutup Sementara' ? '🔴' : '🟡';

  const goProfile = () => {
    onClose();
    navigate(`/desa/${desa.id}`);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{desa.namaDesa}</h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <img
            src={desa.urlGambar || 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'}
            alt={desa.namaDesa}
            className="detail-hero-image"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
            }}
          />

          {/* Strip status: operasional + jam + harga tiket */}
          <div className="detail-status-strip">
            <span className="detail-status-chip">
              {opsIcon} {desa.statusOperasional}
            </span>
            <span className="detail-status-chip">
              <Clock size={14} /> {desa.jamBuka}–{desa.jamTutup} WIB
            </span>
            <span className="detail-status-chip is-price">
              <Ticket size={14} /> Tiket {formatRupiah(desa.hargaTiketLokal)}
            </span>
          </div>

          <div className="detail-info">
            <div className="detail-info-item">
              <MapPin size={20} />
              <div>
                <small>Lokasi</small>
                <span>{desa.lokasi}</span>
              </div>
            </div>
            <div className="detail-info-item">
              <Star size={20} />
              <div>
                <small>Rating</small>
                <span>{desa.rating}/5</span>
              </div>
            </div>
            <div className="detail-info-item">
              <Users size={20} />
              <div>
                <small>Jumlah Wisatawan</small>
                <span>{formatNumber(desa.jumlahWisatawan)} orang</span>
              </div>
            </div>
            <div className="detail-info-item">
              <Tag size={20} />
              <div>
                <small>Kategori</small>
                <span>{desa.kategori}</span>
              </div>
            </div>
            <div className="detail-info-item">
              <Calendar size={20} />
              <div>
                <small>Kecamatan</small>
                <span>{desa.kecamatan}, {desa.kabupaten}</span>
              </div>
            </div>
            <div className="detail-info-item">
              <MapPin size={20} />
              <div>
                <small>Provinsi</small>
                <span>{desa.provinsi}</span>
              </div>
            </div>
          </div>
          <div className="detail-description">
            <strong style={{ display: 'block', marginBottom: 8, color: 'var(--green-800)' }}>
              Tentang {desa.namaDesa}
            </strong>
            {desa.deskripsi}
          </div>

          {/* Kapasitas real-time ringkas */}
          {desa.batasPengunjung > 0 && (
            <div className="detail-capacity">
              <div className="detail-capacity-head">
                <span>Pengunjung hari ini</span>
                <strong>
                  {formatNumber(desa.pengunjungHariIni)} / {formatNumber(desa.batasPengunjung)}
                </strong>
              </div>
              <div className="detail-capacity-track">
                <div
                  className="detail-capacity-fill"
                  style={{
                    width: `${Math.min(
                      Math.round((desa.pengunjungHariIni / desa.batasPengunjung) * 100),
                      100
                    )}%`,
                    background: desa.overtourism || desa.pengunjungHariIni >= desa.batasPengunjung
                      ? '#dc2626'
                      : desa.pengunjungHariIni >= (desa.thresholdPeringatan || 80)
                        ? '#f59e0b'
                        : '#16a34a',
                  }}
                />
              </div>
            </div>
          )}

          {(desa.urlWebsite || desa.urlFoto || desa.urlVideo) && (
            <div style={{
              marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap',
              paddingTop: 14, borderTop: '1px solid var(--border)',
            }}>
              {desa.urlWebsite && (
                <a
                  href={desa.urlWebsite}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
                    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                    textDecoration: 'none',
                  }}
                >
                  <Globe size={14} /> Website Resmi
                </a>
              )}
              {desa.urlFoto && (
                <a
                  href={desa.urlFoto}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
                    background: '#fefce8', color: '#a16207', border: '1px solid #fde68a',
                    textDecoration: 'none',
                  }}
                >
                  <Image size={14} /> Galeri Foto
                </a>
              )}
              {desa.urlVideo && (
                <a
                  href={desa.urlVideo}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 100, fontSize: '0.8rem', fontWeight: 700,
                    background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8',
                    textDecoration: 'none',
                  }}
                >
                  <Video size={14} /> Video Profil
                </a>
              )}
            </div>
          )}

          {/* CTA utama: buka halaman profil lengkap (booking, galeri, radar cuaca, dll) */}
          <button type="button" className="detail-cta" onClick={goProfile}>
            Lihat Profil Lengkap & Pesan Tiket
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}
