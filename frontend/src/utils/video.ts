/**
 * Utilitas untuk mengenali & menampilkan video dari platform eksternal
 * (YouTube, TikTok, Instagram) di galeri desa wisata.
 */

export type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | null;

/** Deteksi platform dari URL video. Null bila bukan video yang didukung. */
export function detectVideoPlatform(url: string): VideoPlatform {
  if (!url) return null;
  const u = url.toLowerCase();
  if (u.includes('youtube.com/') || u.includes('youtu.be/')) return 'youtube';
  if (u.includes('tiktok.com/')) return 'tiktok';
  if (u.includes('instagram.com/') || u.includes('instagr.am/')) return 'instagram';
  return null;
}

/** ID video YouTube dari berbagai bentuk URL (watch, youtu.be, shorts, embed). */
export function getYouTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

/** Kode video TikTok dari URL (segment terakhir berbentuk .../video/1234567890). */
export function getTikTokId(url: string): string | null {
  const m = url.match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/** Kode shortcode Instagram dari URL (p, reel, tv). */
export function getInstagramShortcode(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[2] : null;
}

export interface EmbedInfo {
  platform: Exclude<VideoPlatform, null>;
  /** URL untuk iframe embed */
  embedUrl: string;
  /** URL thumbnail poster (bila tersedia; null untuk Instagram) */
  thumbUrl: string | null;
}

/**
 * Ubah URL video menjadi informasi embed.
 * - YouTube  : iframe youtube.com/embed/ID + thumbnail i.ytimg.com
 * - TikTok   : iframe tiktok.com/embed/v2/ID (tanpa thumbnail resmi via URL)
 * - Instagram: iframe instagram.com/p/CODE/embed (tanpa thumbnail)
 */
export function getVideoEmbed(url: string): EmbedInfo | null {
  const platform = detectVideoPlatform(url);
  if (!platform) return null;

  if (platform === 'youtube') {
    const id = getYouTubeId(url);
    if (!id) return null;
    return {
      platform,
      embedUrl: `https://www.youtube.com/embed/${id}?rel=0`,
      thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  if (platform === 'tiktok') {
    const id = getTikTokId(url);
    if (!id) return null;
    return {
      platform,
      embedUrl: `https://www.tiktok.com/embed/v2/${id}`,
      thumbUrl: null,
    };
  }

  // Instagram
  const code = getInstagramShortcode(url);
  if (!code) return null;
  return {
    platform,
    embedUrl: `https://www.instagram.com/p/${code}/embed`,
    thumbUrl: null,
  };
}

/** Nama platform yang rapi untuk ditampilkan sebagai label. */
export function platformLabel(platform: Exclude<VideoPlatform, null>): string {
  switch (platform) {
    case 'youtube': return 'YouTube';
    case 'tiktok': return 'TikTok';
    case 'instagram': return 'Instagram';
  }
}
