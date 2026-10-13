import { useEffect, useRef } from 'react';
import {
  MapPin, Star, Users, AlertTriangle, Globe, Image as ImageIcon,
  Video, Ticket, ArrowRight, Clock, Crown,
} from 'lucide-react';
import type { DesaWisata } from '../types/desawisata';

interface CardProps {
  desa: DesaWisata;
  onClick?: () => void;
  viewMode?: 'grid' | 'list';
  imgLoading?: 'eager' | 'lazy';
  /** peringkat (1,2,3...) — diisi dari urutan rating agar Top 3 dapat mahkota */
  rank?: number;
}

const FALLBACK = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';

export default function DesaCard({ desa, onClick, viewMode = 'grid', imgLoading = 'lazy', rank }: CardProps) {
  const formatCompact = (num: number) => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };
  const formatRupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

  const hasCapacity = desa.batasPengunjung > 0;
  const pct = hasCapacity ? Math.round((desa.pengunjungHariIni / desa.batasPengunjung) * 100) : 0;
  const threshold = desa.thresholdPeringatan || 80;
  const isFull = pct >= 100 || desa.overtourism;
  const isWarn = pct >= threshold && !isFull;

  const statusClass = !desa.aktif ? 'off' : isFull ? 'full' : isWarn ? 'warn' : 'ok';
  const statusLabel = !desa.aktif ? 'Nonaktif' : isFull ? 'Penuh' : isWarn ? 'Hampir Penuh' : 'Sepi · Nyaman';
  const statusDot = !desa.aktif ? '⚪' : isFull ? '🔴' : isWarn ? '🟡' : '🟢';

  const opsClosed = desa.statusOperasional === 'Tutup Sementara';
  const opsIcon = desa.statusOperasional === 'Buka' ? '🟢' : opsClosed ? '🔴' : '🟡';
  const showWarning = desa.aktif && isFull;
  const hasLinks = !!(desa.urlWebsite || desa.urlFoto || desa.urlVideo);

  const cardRef = useRef<HTMLDivElement>(null);
  const prevLiveRef = useRef('');
  useEffect(() => {
    const liveKey = `${desa.pengunjungHariIni}|${desa.jumlahWisatawan}|${desa.overtourism}|${desa.statusOperasional}|${desa.aktif}`;
    if (prevLiveRef.current && liveKey !== prevLiveRef.current) {
      const el = cardRef.current;
      if (el) {
        el.classList.remove('card-flash');
        void el.offsetWidth;
        el.classList.add('card-flash');
      }
    }
    prevLiveRef.current = liveKey;
  }, [desa]);

  return (
    <article
      ref={cardRef}
      className={`wi-card ${viewMode === 'list' ? 'is-list-card' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default', animationDelay: `${Math.min((rank ?? 1) * 60, 480)}ms` }}
      aria-label={desa.namaDesa}
    >
      <div className="wi-card-media">
        <img
          src={desa.urlGambar || FALLBACK}
          alt={desa.namaDesa}
          loading={imgLoading}
          decoding="async"
          onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK; }}
        />
        <div className="wi-card-top">
          <span className="wi-chip-cat">🏷️ {desa.kategori}</span>
          <span className="wi-chip-rating">
            <Star size={13} fill="#fbbf24" color="#fbbf24" />
            {Number(desa.rating).toFixed(1)}
          </span>
        </div>
        {rank !== undefined && rank <= 3 && (
          <span className="wi-chip-rank">
            <Crown size={13} /> #{rank} Terpopuler
          </span>
        )}
        <span className={`wi-chip-ops ${opsClosed ? 'is-closed' : ''}`}>
          {opsIcon} {desa.statusOperasional}
        </span>
        <span className="wi-chip-price">
          <Ticket size={13} /> {formatRupiah(desa.hargaTiketLokal)}
        </span>
        <span className="wi-card-hover-cta">
          Jelajahi Desa <ArrowRight size={15} />
        </span>
      </div>

      <div className="wi-card-body">
        <span className="wi-card-prov">
          <MapPin size={12} /> {desa.provinsi}
        </span>
        <h3 className="wi-card-title">{desa.namaDesa}</h3>
        <div className="wi-card-loc">
          <MapPin size={14} />
          <span>{desa.kecamatan}, {desa.kabupaten}</span>
        </div>
        <p className="wi-card-desc">{desa.deskripsi}</p>

        <div className="wi-card-meta">
          <span className="wi-meta-pill" title="Total wisatawan">
            <Users size={13} /> {formatCompact(desa.jumlahWisatawan)} wisatawan
          </span>
          {desa.jamBuka && (
            <span className="wi-meta-pill" title="Jam operasional">
              <Clock size={13} /> {desa.jamBuka}–{desa.jamTutup}
            </span>
          )}
        </div>

        {hasLinks && (
          <div className="wi-card-links" onClick={(e) => e.stopPropagation()}>
            {desa.urlWebsite && (
              <a href={desa.urlWebsite} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                <Globe size={12} /> Website
              </a>
            )}
            {desa.urlFoto && (
              <a href={desa.urlFoto} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fefce8', color: '#a16207', border: '1px solid #fde68a' }}>
                <ImageIcon size={12} /> Foto
              </a>
            )}
            {desa.urlVideo && (
              <a href={desa.urlVideo} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                style={{ background: '#fdf2f8', color: '#be185d', border: '1px solid #fbcfe8' }}>
                <Video size={12} /> Video
              </a>
            )}
          </div>
        )}

        <div className={`wi-cap ${showWarning ? 'has-warning' : ''}`}>
          <div className="wi-cap-head">
            <span className="wi-cap-label"><span className="live-dot-small" /> Pengunjung hari ini</span>
            <span className={`wi-cap-val is-${statusClass}`}>
              {hasCapacity
                ? `${desa.pengunjungHariIni.toLocaleString('id-ID')} / ${desa.batasPengunjung.toLocaleString('id-ID')} · ${pct}%`
                : `${desa.pengunjungHariIni.toLocaleString('id-ID')} orang`}
            </span>
          </div>
          {hasCapacity && (
            <div className="wi-cap-track">
              <div className={`wi-cap-fill is-${statusClass}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          )}
          {showWarning && (
            <div className="wi-cap-warn">
              <AlertTriangle size={14} />
              <span>{desa.pesanPeringatan || 'Kapasitas desa telah mencapai batas maksimal.'}</span>
            </div>
          )}
        </div>
      </div>

      <div className="wi-card-foot">
        <span className="wi-foot-vis">
          <span className="wi-foot-vis-icon"><Users size={15} /></span>
          <span><strong>{formatCompact(desa.jumlahWisatawan)}</strong> wisatawan</span>
        </span>
        <span className={`wi-status is-${statusClass}`}>{statusDot} {statusLabel}</span>
      </div>
    </article>
  );
}
