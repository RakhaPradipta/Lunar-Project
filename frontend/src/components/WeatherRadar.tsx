import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { CloudRain, RefreshCw } from 'lucide-react';
import type { DesaWisata } from '../types/desawisata';

/**
 * Radar cuaca real-time per desa.
 * - Tile radar hujan animasi dari RainViewer (gratis, tanpa API key).
 * - Frame terakhir ~90 menit diambil lalu dianimasikan loop.
 * - Marker desa di atas tile peta OpenStreetMap.
 */

interface RadarFrame {
  time: number; // unix detik
  path: string; // path tile template
}

interface WeatherRadarProps {
  desa: DesaWisata;
  height?: string;
}

const FALLBACK_TILE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export default function WeatherRadar({ desa, height = '360px' }: WeatherRadarProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);
  const framesRef = useRef<RadarFrame[]>([]);
  const frameIdxRef = useRef(0);
  const [frameTime, setFrameTime] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Inisialisasi peta
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const map = L.map(mapRef.current, {
      center: [desa.latitude || -2.5, desa.longitude || 118],
      zoom: 9,
      zoomControl: true,
      scrollWheelZoom: false, // agar scroll halaman tidak "terjebak" di peta
    });

    L.tileLayer(FALLBACK_TILE, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | Radar: <a href="https://www.rainviewer.com">RainViewer</a>',
      maxZoom: 18,
    }).addTo(map);

    // Marker lokasi desa
    L.marker([desa.latitude, desa.longitude]).addTo(map);

    mapInstanceRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
      radarLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ambil daftar frame radar terbaru dari RainViewer lalu mulai animasi
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    const loadFrames = async () => {
      try {
        setLoading(true);
        setFailed(false);
        const res = await fetch('https://api.rainviewer.com/public/weather-maps.json');
        if (!res.ok) throw new Error('radar');
        const json = await res.json();
        const host = json.host ?? 'https://tilecache.rainviewer.com';
        const past: RadarFrame[] = (json.radar?.past ?? []).map((f: { time: number; path: string }) => ({
          time: f.time,
          path: f.path,
        }));
        if (cancelled) return;
        if (past.length === 0) throw new Error('no-frames');

        framesRef.current = past;
        frameIdxRef.current = past.length - 1; // mulai dari frame terbaru

        const showFrame = () => {
          const frames = framesRef.current;
          if (frames.length === 0 || !mapInstanceRef.current) return;
          const frame = frames[frameIdxRef.current];
          const url = `${host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`;

          if (radarLayerRef.current) {
            mapInstanceRef.current.removeLayer(radarLayerRef.current);
          }
          radarLayerRef.current = L.tileLayer(url, { opacity: 0.65, maxZoom: 18 }).addTo(mapInstanceRef.current);
          setFrameTime(new Date(frame.time * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
          frameIdxRef.current = (frameIdxRef.current + 1) % frames.length;
        };

        showFrame();
        timer = setInterval(showFrame, 2200); // ganti frame tiap 2.2 detik
        setLoading(false);
      } catch {
        if (!cancelled) {
          setFailed(true);
          setLoading(false);
        }
      }
    };

    void loadFrames();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="weather-radar">
      <div ref={mapRef} style={{ width: '100%', height, borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '2px solid var(--border)', zIndex: 0 }} />
      <div className="weather-radar-status">
        <span className="weather-radar-live-dot" />
        {loading && <><RefreshCw size={13} className="spin" /> Memuat radar…</>}
        {!loading && !failed && (
          <>
            <CloudRain size={13} /> Radar hujan real-time • frame {frameTime}
          </>
        )}
        {failed && <>Radar tidak tersedia saat ini — peta tetap ditampilkan</>}
      </div>
      <div className="weather-radar-legend">
        <span>💙 Ringan</span>
        <span>💚 Sedang</span>
        <span>💛 Lebat</span>
        <span>❤️ Sangat Lebat</span>
      </div>
    </div>
  );
}
