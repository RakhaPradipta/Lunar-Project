import { useState, useRef, useEffect } from 'react';
import { Upload, X, Image as ImageIcon, CheckCircle, AlertCircle, Loader2, ExternalLink, Video, Link2 } from 'lucide-react';
import { desaWisataApi } from '../api/desawisataApi';
import { detectVideoPlatform, platformLabel } from '../utils/video';
import { API_URL } from '../api/config';

export interface GaleriFotoItem {
  /** Foto yang sudah tersimpan di server memiliki id > 0 */
  id?: number;
  url: string;
  judul: string;
  /** "foto" (default) atau "video" (tautan YouTube/TikTok/Instagram) */
  tipe?: 'foto' | 'video' | string;
}

interface GalleryUploadProps {
  /**
   * ID desa (opsional, disediakan agar komponen dapat mengetahui konteksnya;
   * sinkronisasi ke server tetap dilakukan oleh form saat Simpan).
   */
  desaId?: number;
  fotos: GaleriFotoItem[];
  onChange: (fotos: GaleriFotoItem[]) => void;
  onError?: (message: string) => void;
}

const FALLBACK_IMG = 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
const MAX_ITEMS = 12;

/**
 * Pengelola galeri multi-foto per desa: unggah banyak file sekaligus,
 * tambah via URL, tempel tautan video YouTube/TikTok/Instagram,
 * atur urutan, hapus. Foto desa baru ditunda hingga desa tersimpan
 * (dipanggil syncPendingPhotos oleh pemilik form).
 */
export default function GalleryUpload({ fotos, onChange, onError }: GalleryUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [busyCount, setBusyCount] = useState(0);
  const [urlInput, setUrlInput] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!successMsg) return;
    const t = setTimeout(() => setSuccessMsg(''), 3000);
    return () => clearTimeout(t);
  }, [successMsg]);

  const flashError = (msg: string) => {
    setErrorMsg(msg);
    onError?.(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;

    const sisaSlot = MAX_ITEMS - fotos.length;
    if (sisaSlot <= 0) {
      flashError(`Maksimal ${MAX_ITEMS} item galeri per desa.`);
      return;
    }
    if (list.length > sisaSlot) {
      flashError(`Hanya ${sisaSlot} slot tersisa (maksimal ${MAX_ITEMS} item).`);
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const toUpload = list.slice(0, sisaSlot);
    const newItems: GaleriFotoItem[] = [];

    setBusyCount((c) => c + toUpload.length);
    for (const file of toUpload) {
      try {
        if (!allowedTypes.includes(file.type)) {
          flashError(`${file.name}: format tidak didukung (JPG, PNG, GIF, WebP).`);
          continue;
        }
        if (file.size > 5 * 1024 * 1024) {
          flashError(`${file.name}: ukuran maksimal 5MB.`);
          continue;
        }

        const res = await desaWisataApi.uploadImage(file);
        if (!res.success) throw new Error(res.message || 'Gagal mengunggah');

        newItems.push({ id: 0, url: `${API_URL}${res.data.url}`, judul: '', tipe: 'foto' });
      } catch (err) {
        flashError(err instanceof Error ? err.message : `${file.name}: gagal diunggah.`);
      } finally {
        setBusyCount((c) => c - 1);
      }
    }

    if (newItems.length > 0) {
      onChange([...fotos, ...newItems]);
      setSuccessMsg(`${newItems.length} foto ditambahkan — jangan lupa simpan perubahan desa.`);
    }
  };

  /** Tambah item dari URL eksternal: otomatis deteksi foto atau video (YouTube/TikTok/Instagram). */
  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      flashError('URL harus dimulai dengan http:// atau https://');
      return;
    }
    if (fotos.length >= MAX_ITEMS) {
      flashError(`Maksimal ${MAX_ITEMS} item galeri per desa.`);
      return;
    }

    const platform = detectVideoPlatform(url);
    if (platform) {
      onChange([...fotos, { id: 0, url, judul: '', tipe: 'video' }]);
      setSuccessMsg(`Video ${platformLabel(platform)} ditambahkan — jangan lupa simpan perubahan desa.`);
    } else {
      onChange([...fotos, { id: 0, url, judul: '', tipe: 'foto' }]);
      setSuccessMsg('Foto dari URL ditambahkan — jangan lupa simpan perubahan desa.');
    }
    setUrlInput('');
  };

  const removeAt = (idx: number) => {
    onChange(fotos.filter((_, i) => i !== idx));
  };

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= fotos.length) return;
    const next = [...fotos];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const setJudul = (idx: number, judul: string) => {
    const next = [...fotos];
    next[idx] = { ...next[idx], judul };
    onChange(next);
  };

  return (
    <div className="gallery-upload">
      {/* Dropzone multi-file */}
      <div
        className={`image-upload-dropzone gallery-dropzone ${isDragging ? 'dragging' : ''} ${busyCount > 0 ? 'uploading' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        {busyCount > 0 ? (
          <div className="image-upload-loading">
            <Loader2 size={26} className="gallery-spin" />
            <span>Mengunggah {busyCount} foto...</span>
          </div>
        ) : (
          <>
            <div className="image-upload-icon"><Upload size={26} /></div>
            <span className="image-upload-text">Seret & lepas beberapa foto sekaligus</span>
            <span className="image-upload-subtext">atau klik untuk memilih file • maksimal {MAX_ITEMS} item galeri</span>
            <span className="image-upload-formats">JPG, PNG, GIF, WebP • Maks 5MB per foto</span>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) void uploadFiles(e.target.files);
            e.target.value = '';
          }}
          style={{ display: 'none' }}
        />
      </div>

      {/* Tambah via URL eksternal: foto atau tautan video */}
      <div className="gallery-url-row">
        <Link2 size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
        <input
          type="url"
          placeholder="atau tempel URL foto / video YouTube • TikTok • Instagram"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addUrl(); } }}
          style={{ paddingLeft: 36 }}
        />
        <button type="button" className="btn btn-secondary btn-sm" onClick={addUrl}>
          <ExternalLink size={14} /> Tambah
        </button>
      </div>
      <div className="gallery-url-hint">
        💡 Tautan video otomatis dikenali: <strong>youtube.com/watch…</strong>, <strong>youtu.be/…</strong>,
        <strong> tiktok.com/…/video/…</strong>, <strong>instagram.com/reel/…</strong>
      </div>

      {errorMsg && (
        <div className="image-upload-error"><AlertCircle size={14} /> {errorMsg}</div>
      )}
      {successMsg && (
        <div className="image-upload-success"><CheckCircle size={14} /> {successMsg}</div>
      )}

      {/* Daftar item galeri (foto + video) */}
      {fotos.length === 0 && busyCount === 0 ? (
        <div className="gallery-empty">
          <ImageIcon size={20} /> Belum ada foto galeri.
        </div>
      ) : (
        <div className="gallery-thumbs">
          {fotos.map((foto, idx) => {
            const isVideo = foto.tipe === 'video';
            const platform = isVideo ? detectVideoPlatform(foto.url) : null;
            return (
              <div key={`${foto.url}-${idx}`} className={`gallery-thumb ${isVideo ? 'is-video' : ''}`}>
                {isVideo ? (
                  <div className="gallery-thumb-video">
                    <Video size={22} />
                    <span className="gallery-thumb-platform">{platform ? platformLabel(platform) : 'Video'}</span>
                  </div>
                ) : (
                  <img
                    src={foto.url || FALLBACK_IMG}
                    alt={foto.judul || `Foto ${idx + 1}`}
                    onError={(e) => { (e.target as HTMLImageElement).src = FALLBACK_IMG; }}
                  />
                )}
                {idx === 0 && !isVideo && <span className="gallery-thumb-cover">Cover</span>}
                <input
                  className="gallery-thumb-judul"
                  type="text"
                  placeholder={isVideo ? 'Judul video (opsional)' : 'Judul (opsional)'}
                  value={foto.judul}
                  onChange={(e) => setJudul(idx, e.target.value)}
                />
                <div className="gallery-thumb-actions">
                  <button type="button" title="Geser ke kiri" disabled={idx === 0} onClick={() => move(idx, -1)}>←</button>
                  <button type="button" title="Geser ke kanan" disabled={idx === fotos.length - 1} onClick={() => move(idx, 1)}>→</button>
                  <button type="button" className="danger" title={isVideo ? 'Hapus video' : 'Hapus foto'} onClick={() => removeAt(idx)}>
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
