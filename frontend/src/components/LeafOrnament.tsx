/**
 * Ornamen daun tropis (SVG) untuk mengisi ruang kosong ala Wonderful Indonesia.
 * Ringan, tanpa gambar eksternal, bisa diputar / diwarnai via props.
 */
import { useId } from 'react';

interface LeafProps {
  className?: string;
  style?: React.CSSProperties;
  opacity?: number;
  rotate?: number;
  scale?: number;
  tone?: 'deep' | 'fresh' | 'lime' | 'gold';
}

const TONES: Record<string, { from: string; to: string }> = {
  deep: { from: '#14532d', to: '#166534' },
  fresh: { from: '#16a34a', to: '#4ade80' },
  lime: { from: '#65a30d', to: '#a3e635' },
  gold: { from: '#d97706', to: '#fbbf24' },
};

function LeafShape({ tone = 'fresh', ...rest }: { tone?: LeafProps['tone'] } & React.SVGProps<SVGSVGElement>) {
  const c = TONES[tone ?? 'fresh'];
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = `wg-${tone}-${uid}`;
  return (
    <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" {...rest}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="200" y2="200" gradientUnits="userSpaceOnUse">
          <stop stopColor={c.from} />
          <stop offset="1" stopColor={c.to} />
        </linearGradient>
      </defs>
      {/* helai monstera sederhana */}
      <path
        d="M100 8C150 30 178 80 172 130C166 172 130 192 100 192C70 192 34 172 28 130C22 80 50 30 100 8Z"
        fill={`url(#${id})`}
        fillOpacity="0.92"
      />
      <path
        d="M100 20V180"
        stroke="rgba(255,255,255,0.55)"
        strokeWidth="3"
        strokeLinecap="round"
      />
      {[45, 75, 105, 135].map((y) => (
        <g key={y} stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
          <path d={`M100 ${y}C80 ${y} 62 ${y - 8} 50 ${y - 22}`} />
          <path d={`M100 ${y}C120 ${y} 138 ${y - 8} 150 ${y - 22}`} />
        </g>
      ))}
      {/* lubang monstera */}
      <ellipse cx="72" cy="95" rx="7" ry="14" fill="rgba(255,255,255,0.28)" transform="rotate(-18 72 95)" />
      <ellipse cx="128" cy="95" rx="7" ry="14" fill="rgba(255,255,255,0.28)" transform="rotate(18 128 95)" />
      <ellipse cx="74" cy="130" rx="6" ry="11" fill="rgba(255,255,255,0.22)" transform="rotate(-14 74 130)" />
      <ellipse cx="126" cy="130" rx="6" ry="11" fill="rgba(255,255,255,0.22)" transform="rotate(14 126 130)" />
    </svg>
  );
}

export function PalmLeaf({ className = '', style, opacity = 1, rotate = 0, scale = 1, tone = 'fresh' }: LeafProps) {
  return (
    <span
      className={`wi-leaf-float ${className}`}
      aria-hidden="true"
      style={{
        ...style,
        opacity,
        transform: `rotate(${rotate}deg) scale(${scale})`,
      }}
    >
      <LeafShape tone={tone} style={{ width: '100%', height: '100%', display: 'block' }} />
    </span>
  );
}

/** Grup daun untuk sudut section — dipanggil sekali per section */
export function LeafCluster({ position = 'both' }: { position?: 'left' | 'right' | 'both' }) {
  return (
    <>
      {(position === 'left' || position === 'both') && (
        <>
          <PalmLeaf
            className="wi-leaf-ambient"
            tone="deep"
            opacity={0.1}
            rotate={-24}
            scale={2.2}
            style={{ left: '-56px', top: '8%' }}
          />
          <PalmLeaf
            className="wi-leaf-ambient wi-leaf-sway"
            tone="fresh"
            opacity={0.14}
            rotate={18}
            scale={1.3}
            style={{ left: '2%', bottom: '6%' }}
          />
        </>
      )}
      {(position === 'right' || position === 'both') && (
        <>
          <PalmLeaf
            className="wi-leaf-ambient"
            tone="lime"
            opacity={0.1}
            rotate={26}
            scale={2.4}
            style={{ right: '-60px', top: '22%' }}
          />
          <PalmLeaf
            className="wi-leaf-ambient wi-leaf-sway"
            tone="gold"
            opacity={0.12}
            rotate={-14}
            scale={1.1}
            style={{ right: '3%', top: '6%' }}
          />
        </>
      )}
    </>
  );
}

export default PalmLeaf;
