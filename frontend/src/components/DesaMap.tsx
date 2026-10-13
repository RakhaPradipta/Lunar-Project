import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DesaWisata } from '../types/desawisata';
import { getCrowdInfo, type CrowdInfo } from '../utils/crowd';

// Fix default marker icon issue in Leaflet with bundlers
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface DesaMapProps {
  data: DesaWisata[];
  height?: string;
  onMarkerClick?: (desa: DesaWisata) => void;
  showPopup?: boolean;
  /** Tampilkan zona keramaian (lingkaran berwarna) di setiap tempat wisata. */
  showZones?: boolean;
}

// Warna marker berdasarkan kategori (untuk badge kecil di popup)
function getCategoryColor(kategori: string): string {
  const colors: Record<string, string> = {
    'Alam': '#22c55e',
    'Budaya': '#8b5cf6',
    'Pantai': '#3b82f6',
    'Kuliner': '#f59e0b',
    'Religi': '#ef4444',
  };
  return colors[kategori] || '#6b7280';
}

/**
 * Anti-XSS: escape karakter HTML berbahaya sebelum data user disuntikkan ke
 * template string popup Leaflet (Leaflet merender popup sebagai innerHTML).
 */
function escapeHtml(s: string): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function createCustomIcon(crowd: CrowdInfo) {
  const color = crowd.color;
  return L.divIcon({
    className: 'custom-marker',
    html: `
      <div style="
        width: 32px; height: 42px;
        display: flex; align-items: flex-start; justify-content: center;
        position: relative;
      ">
        <svg width="32" height="42" viewBox="0 0 32 42" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 26 16 26s16-14 16-26C32 7.163 24.837 0 16 0z" fill="${color}" stroke="white" stroke-width="2"/>
          <circle cx="16" cy="16" r="8" fill="white" opacity="0.95"/>
          <circle cx="16" cy="16" r="5" fill="${color}"/>
        </svg>
      </div>
    `,
    iconSize: [32, 42],
    iconAnchor: [16, 42],
    popupAnchor: [0, -42],
  });
}

export default function DesaMap({ data, height = '500px', onMarkerClick, showPopup = true, showZones = true }: DesaMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerKeyRef = useRef('');
  const hadMarkersRef = useRef(false);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Center on Indonesia
    const map = L.map(mapRef.current, {
      center: [-2.5, 118],
      zoom: 5,
      zoomControl: true,
      scrollWheelZoom: true,
    });

    // Add tile layer (OpenStreetMap)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 18,
    }).addTo(map);

    mapInstanceRef.current = map;

    // Force a resize after a small delay to fix rendering issues
    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when data changes (skip when nothing relevant changed,
  // so background auto-refresh never rebuilds markers or re-zooms the map)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || data.length === 0) return;

    const key = JSON.stringify(data.map((d) => [
      d.id, d.latitude, d.longitude, d.kategori, d.namaDesa,
      d.kabupaten, d.provinsi, d.deskripsi, d.urlGambar,
      d.urlWebsite, d.urlFoto, d.urlVideo,
      d.rating, d.jumlahWisatawan, d.pengunjungHariIni,
      d.batasPengunjung, d.thresholdPeringatan, d.overtourism,
      d.aktif, d.statusOperasional,
    ]));
    if (key === markerKeyRef.current) return;
    markerKeyRef.current = key;

    const hadMarkers = hadMarkersRef.current;

    // Clear existing markers & zone circles
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Circle) {
        map.removeLayer(layer);
      }
    });

    // Add markers for each desa
    const bounds: L.LatLngExpression[] = [];

    data.forEach((desa) => {
      if (desa.latitude && desa.longitude) {
        const latLng: L.LatLngExpression = [desa.latitude, desa.longitude];
        bounds.push(latLng);
        const crowd = getCrowdInfo(desa);

        // Zona keramaian: lingkaran berwarna di sekitar tempat wisata
        if (showZones) {
          L.circle(latLng, {
            radius: 15000,
            color: crowd.color,
            weight: 2,
            opacity: 0.55,
            fillColor: crowd.color,
            fillOpacity: 0.14,
          }).addTo(map);
        }

        const marker = L.marker(latLng, {
          icon: createCustomIcon(crowd),
        }).addTo(map);

        if (showPopup) {
          // Anti-XSS: semua data user di-escape sebelum masuk template innerHTML Leaflet
          const nama = escapeHtml(desa.namaDesa);
          const wilayah = escapeHtml(`${desa.kabupaten}, ${desa.provinsi}`);
          const kategori = escapeHtml(desa.kategori);
          const deskripsi = escapeHtml(desa.deskripsi);
          const gambar = /^https?:\/\//i.test(desa.urlGambar || '') || desa.urlGambar?.startsWith('/uploads/')
            ? escapeHtml(desa.urlGambar)
            : 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
          const linkWeb = /^https?:\/\//i.test(desa.urlWebsite || '') ? escapeHtml(desa.urlWebsite) : '';
          const linkFoto = /^https?:\/\//i.test(desa.urlFoto || '') ? escapeHtml(desa.urlFoto) : '';
          const linkVideo = /^https?:\/\//i.test(desa.urlVideo || '') ? escapeHtml(desa.urlVideo) : '';

          const popupContent = `
            <div style="font-family: 'DM Sans', sans-serif; min-width: 240px; max-width: 300px;">
              <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
                <span style="
                  padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700;
                  background: ${crowd.color}1f; color: ${crowd.color};
                  border: 1px solid ${crowd.color}55;
                ">${crowd.emoji} ${crowd.label}</span>
                <span style="font-size: 11px; font-weight: 600; color: #4b5563;">
                  👥 ${desa.pengunjungHariIni}/${desa.batasPengunjung} di TKP (${crowd.percentage}%)
                </span>
              </div>
              <img src="${gambar}"
                   alt="${nama}"
                   style="width: 100%; height: 120px; object-fit: cover; border-radius: 8px; margin-bottom: 10px;"
                   onerror="this.src='https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800'" />
              <div style="padding: 0 4px;">
                <div style="font-weight: 700; font-size: 14px; color: #14532d; margin-bottom: 4px; font-family: 'Playfair Display', serif;">
                  ${nama}
                </div>
                <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
                  📍 ${wilayah}
                </div>
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 8px;">
                  <span style="
                    padding: 2px 8px; border-radius: 100px; font-size: 11px; font-weight: 600;
                    background: ${getCategoryColor(desa.kategori)}20; color: ${getCategoryColor(desa.kategori)};
                  ">${kategori}</span>
                  <span style="font-size: 12px; color: #14532d;">⭐ ${desa.rating}/5</span>
                </div>
                <div style="font-size: 12px; color: #4b5563; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                  ${deskripsi}
                </div>
                <div style="font-size: 11px; color: #9ca3af; margin-top: 6px;">
                  👥 ${desa.jumlahWisatawan.toLocaleString('id-ID')} wisatawan
                </div>
                ${(linkWeb || linkFoto || linkVideo) ? `
                <div style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;">
                  ${linkWeb ? `<a href="${linkWeb}" target="_blank" rel="noreferrer noopener" style="
                    padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 700;
                    background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;
                    text-decoration: none;">🌐 Website</a>` : ''}
                  ${linkFoto ? `<a href="${linkFoto}" target="_blank" rel="noreferrer noopener" style="
                    padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 700;
                    background: #fefce8; color: #a16207; border: 1px solid #fde68a;
                    text-decoration: none;">📷 Foto</a>` : ''}
                  ${linkVideo ? `<a href="${linkVideo}" target="_blank" rel="noreferrer noopener" style="
                    padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 700;
                    background: #fdf2f8; color: #be185d; border: 1px solid #fbcfe8;
                    text-decoration: none;">🎬 Video</a>` : ''}
                </div>` : ''}
                <button id="desa-profile-btn-${desa.id}" style="
                  margin-top: 10px; width: 100%; padding: 9px 12px;
                  background: #15803d; color: white; border: none; border-radius: 8px;
                  font-family: 'DM Sans', sans-serif; font-size: 12px; font-weight: 700;
                  cursor: pointer;
                ">Lihat Profil Desa →</button>
              </div>
            </div>
          `;
          marker.bindPopup(popupContent, {
            maxWidth: 320,
            className: 'desa-popup',
          });
        }

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(desa));
          if (showPopup) {
            // Wire the "Lihat Profil Desa" button inside the popup (fresh DOM every open)
            marker.on('popupopen', () => {
              const btn = document.getElementById(`desa-profile-btn-${desa.id}`);
              if (btn) {
                btn.onclick = (e) => {
                  e.preventDefault();
                  map.closePopup();
                  onMarkerClick(desa);
                };
              }
            });
          }
        }
      }
    });

    // Fit bounds only the first time markers appear, so live updates never move the view
    if (!hadMarkers) {
      if (bounds.length > 1) {
        const latLngBounds = L.latLngBounds(bounds as L.LatLngTuple[]);
        map.fitBounds(latLngBounds, { padding: [50, 50], maxZoom: 10 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0] as L.LatLngTuple, 12);
      }
    }
    hadMarkersRef.current = bounds.length > 0;
  }, [data, showPopup, showZones, onMarkerClick]);

  return (
    <div
      ref={mapRef}
      style={{
        width: '100%',
        height,
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        border: '2px solid var(--border)',
        zIndex: 0,
      }}
    />
  );
}