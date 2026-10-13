import { useEffect } from 'react';

interface PageMeta {
  title: string;
  description?: string;
  /** Jalrel kanonikal relatif, mis. "/desa/22" (opsional). */
  path?: string;
  /** URL gambar untuk preview share (Open Graph). */
  image?: string;
}

const DEFAULT_DESCRIPTION =
  'Jelajahi desa wisata terbaik di Indonesia: info harga tiket & pajak, jam buka, zona keramaian real-time, dan booking kunjungan.';

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/**
 * usePageMeta — SEO per halaman untuk SPA.
 *
 * Dulu hanya ada <title> statis di index.html; setiap halaman dan setiap desa
 * berbagi judul + deskripsi yang sama di hasil pencarian & share link.
 * Sekarang tiap halaman menyetel title, meta description, canonical,
 * dan Open Graph (judul/deskripsi/gambar) sesuai kontennya.
 */
export function usePageMeta({ title, description, path, image }: PageMeta): void {
  useEffect(() => {
    document.title = title;

    const desc = description?.trim() || DEFAULT_DESCRIPTION;
    upsertMeta('name', 'description', desc);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', desc);
    upsertMeta('property', 'og:type', 'website');
    upsertMeta('property', 'og:site_name', 'DesaWisata Nusantara');
    if (image) upsertMeta('property', 'og:image', image);

    if (path) {
      const url = `${window.location.origin}${path}`;
      let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.rel = 'canonical';
        document.head.appendChild(link);
      }
      link.href = url;
      upsertMeta('property', 'og:url', url);
    }
  }, [title, description, path, image]);
}
