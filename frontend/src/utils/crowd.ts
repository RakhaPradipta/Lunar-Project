export type CrowdStatus = 'sepi' | 'lumayan' | 'rame';

export interface CrowdInfo {
  status: CrowdStatus;
  color: string;
  label: string;
  emoji: string;
  /** Persentase pengunjungHariIni / batasPengunjung (0-100+, dipotong untuk bar). */
  percentage: number;
}

interface CrowdSource {
  pengunjungHariIni: number;
  batasPengunjung: number;
  thresholdPeringatan: number;
  overtourism: boolean;
}

export const CROWD_COLORS: Record<CrowdStatus, string> = {
  sepi: '#22c55e',
  lumayan: '#f59e0b',
  rame: '#dc2626',
};

export const CROWD_LABELS: Record<CrowdStatus, string> = {
  sepi: 'Sepi',
  lumayan: 'Lumayan Rame',
  rame: 'Rame',
};

export const CROWD_EMOJIS: Record<CrowdStatus, string> = {
  sepi: '🟢',
  lumayan: '🟡',
  rame: '🔴',
};

/**
 * Zona keramaian setiap tempat wisata:
 * - 🟢 Hijau  = Sepi          (< ambang peringatan)
 * - 🟡 Kuning = Lumayan Rame  (>= ambang peringatan, belum penuh)
 * - 🔴 Merah  = Rame          (penuh / overtourism)
 */
export function getCrowdInfo(source: CrowdSource): CrowdInfo {
  const threshold = source.thresholdPeringatan || 80;
  const percentage = source.batasPengunjung > 0
    ? Math.round((source.pengunjungHariIni / source.batasPengunjung) * 100)
    : 0;

  let status: CrowdStatus;
  if (source.overtourism || percentage >= 100) status = 'rame';
  else if (percentage >= threshold) status = 'lumayan';
  else status = 'sepi';

  return {
    status,
    color: CROWD_COLORS[status],
    label: CROWD_LABELS[status],
    emoji: CROWD_EMOJIS[status],
    percentage,
  };
}