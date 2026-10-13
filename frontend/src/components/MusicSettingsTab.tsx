import { useEffect, useState } from 'react';
import { Music, Save, Volume2, Zap, Info, Headphones, Plus, Pencil, Trash2, Play, Square, X } from 'lucide-react';
import { settingsApi, type Song, type SongInput } from '../api/settingsApi';
import { auth } from '../utils/auth';
import { audioEngine } from '../utils/audioEngine';
import { songEngine } from '../utils/songEngine';
import { MUSIC_TRACKS, type MusicMode, type SongDef } from '../utils/musicTracks';

interface Props {
  addToast: (message: string, type: 'success' | 'error') => void;
}

/** Bentuk lagu untuk UI — berasal dari API atau fallback statis. */
interface SongRow extends SongDef {
  dbId?: number; // ada = dari API (bisa edit/hapus); statis = hanya fallback
  aktif?: boolean;
}

const EMPTY_FORM: SongInput = { judul: '', artis: '', videoId: '', deskripsi: '' };

export default function MusicSettingsTab({ addToast }: Props) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [autoplay, setAutoplay] = useState(true);
  const [mode, setMode] = useState<MusicMode>('youtube');
  const [track, setTrack] = useState<string>('pompeii');
  const [volume, setVolume] = useState(0.35);
  const [meta, setMeta] = useState<{ updatedBy?: string | null; updatedAt?: string | null }>({});

  // Pustaka lagu (dari API, fallback statis)
  const [songs, setSongs] = useState<SongRow[]>([]);
  const [songFormOpen, setSongFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongRow | null>(null);
  const [songForm, setSongForm] = useState<SongInput>(EMPTY_FORM);
  const [songBusy, setSongBusy] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([settingsApi.getMusic(), settingsApi.getSongs().catch(() => [] as Song[])])
      .then(([s, list]) => {
        setEnabled(s.enabled);
        setAutoplay(s.autoplay);
        setMode((s.mode as MusicMode) ?? 'youtube');
        setTrack(s.track ?? 'pompeii');
        setVolume(s.volume);
        setMeta({ updatedBy: s.updatedBy, updatedAt: s.updatedAt });
        if (list.length > 0) {
          setSongs(
            list.map((row) => ({
              id: row.videoId, label: row.judul, artist: row.artis, videoId: row.videoId,
              desc: row.deskripsi, dbId: row.id, aktif: row.aktif,
            })),
          );
        }
      })
      .catch(() => addToast('Gagal memuat pengaturan musik', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const isYouTube = mode === 'youtube';

  const refreshSongs = () => {
    settingsApi.getSongs()
      .then((list) => {
        setSongs(
          list.map((row) => ({
            id: row.videoId, label: row.judul, artist: row.artis, videoId: row.videoId,
            desc: row.deskripsi, dbId: row.id, aktif: row.aktif,
          })),
        );
      })
      .catch(() => { /* biarkan daftar lama */ });
  };

  const preview = (id: string) => {
    audioEngine.setSfxEnabled(true);
    if (isYouTube) {
      songEngine.play(id, volume);
      setPreviewId(id);
    } else {
      audioEngine.play(id as never, volume);
      setPreviewId(id);
    }
  };

  const stopPreview = () => {
    songEngine.stop();
    audioEngine.stop();
    setPreviewId(null);
  };

  const save = async () => {
    setSaving(true);
    stopPreview();
    try {
      const title = isYouTube
        ? (() => {
            const s = songs.find((x) => x.id === track);
            return s ? `${s.label} — ${s.artist}` : undefined;
          })()
        : MUSIC_TRACKS.find((t) => t.id === track)?.label;
      const saved = await settingsApi.updateMusic(
        { enabled, track, volume, autoplay, mode, title },
        auth.getToken(),
      );
      setMeta({ updatedBy: saved.updatedBy, updatedAt: saved.updatedAt });
      addToast('Pengaturan musik tersimpan — berlaku untuk semua pengunjung!', 'success');
    } catch (e) {
      addToast(e instanceof Error ? e.message : 'Gagal menyimpan pengaturan musik', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ===== CRUD lagu =====

  const openCreateSong = () => {
    setEditingSong(null);
    setSongForm(EMPTY_FORM);
    setSongFormOpen(true);
  };

  const openEditSong = (s: SongRow) => {
    setEditingSong(s);
    setSongForm({ judul: s.label, artis: s.artist, videoId: s.videoId, deskripsi: s.desc });
    setSongFormOpen(true);
  };

  const submitSong = async (e: React.FormEvent) => {
    e.preventDefault();
    setSongBusy(true);
    try {
      const token = auth.getToken();
      if (editingSong?.dbId) {
        await settingsApi.updateSong(editingSong.dbId, songForm, token);
        addToast('Lagu berhasil diperbarui', 'success');
      } else {
        await settingsApi.createSong(songForm, token);
        addToast('Lagu berhasil ditambahkan ke pustaka', 'success');
      }
      setSongFormOpen(false);
      setEditingSong(null);
      refreshSongs();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menyimpan lagu', 'error');
    } finally {
      setSongBusy(false);
    }
  };

  const deleteSong = async (s: SongRow) => {
    if (!s.dbId) return;
    if (!confirm(`Hapus lagu "${s.label} — ${s.artist}" dari pustaka?`)) return;
    try {
      await settingsApi.deleteSong(s.dbId, auth.getToken());
      addToast('Lagu dihapus', 'success');
      refreshSongs();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal menghapus lagu', 'error');
    }
  };

  const toggleAktif = async (s: SongRow) => {
    if (!s.dbId) return;
    try {
      await settingsApi.updateSong(s.dbId, { aktif: !s.aktif }, auth.getToken());
      refreshSongs();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Gagal mengubah status lagu', 'error');
    }
  };

  if (loading) {
    return <div className="table-container"><p style={{ padding: 24 }}>Memuat pengaturan…</p></div>;
  }

  return (
    <>
      <div className="admin-page-header" style={{ paddingBottom: 0 }}>
        <div style={{ flex: 1 }}>
          <h1 className="admin-page-title">🎵 Musik Latar</h1>
          <p className="admin-page-subtitle">
            Musik langsung mengalir saat web dibuka. Tambahkan lagu YouTube ke pustaka di bawah —
            pengunjung akan mendengarkan audio tanpa video.
          </p>
        </div>
      </div>

      <div className="table-container">
        <div className="settings-content">
          <div className="settings-section">
            <h3><Music size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Status Musik</h3>
            <div className="settings-grid">
              <div className="settings-item">
                <span className="settings-label">Musik Aktif</span>
                <label className="music-switch">
                  <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                  <span className="music-slider" />
                  <span className="music-switch-text">{enabled ? 'Nyala — semua pengunjung mendengar musik' : 'Mati — web tanpa musik'}</span>
                </label>
              </div>
              <div className="settings-item">
                <span className="settings-label">Putar Otomatis Saat Web Dibuka</span>
                <label className="music-switch">
                  <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
                  <span className="music-slider" />
                  <span className="music-switch-text">{autoplay ? 'Ya — mulai saat kunjungan pertama' : 'Tidak — pengunjung nyalakan sendiri'}</span>
                </label>
              </div>
              <div className="settings-item">
                <span className="settings-label">
                  <Volume2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                  Volume Default: {Math.round(volume * 100)}%
                </span>
                <input
                  type="range" min={0} max={100} value={Math.round(volume * 100)}
                  onChange={(e) => {
                    const v = Number(e.target.value) / 100;
                    setVolume(v);
                    if (isYouTube) songEngine.setVolume(v);
                    else audioEngine.setVolume(v);
                  }}
                  className="music-volume-range"
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Headphones size={20} />
              Lagu (Pustaka YouTube)
              <button
                className="btn btn-primary btn-sm"
                style={{ marginLeft: 'auto' }}
                onClick={openCreateSong}
                type="button"
              >
                <Plus size={15} /> Tambah Lagu
              </button>
            </h3>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: 14 }}>
              Tempel URL atau ID video YouTube — diputar audio-only dari video resmi artis
              (lagunya terdengar, videonya tidak tampil di layar).
            </p>

            {/* Form tambah/edit lagu */}
            {songFormOpen && (
              <form
                onSubmit={submitSong}
                style={{
                  border: '1.5px solid var(--green-200, #bbf7d0)', borderRadius: 14,
                  padding: 16, marginBottom: 16, background: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <strong style={{ color: 'var(--green-900, #14532d)' }}>
                    {editingSong ? `Edit: ${editingSong.label}` : 'Tambah Lagu Baru'}
                  </strong>
                  <button type="button" className="modal-close" onClick={() => setSongFormOpen(false)} style={{ position: 'static' }}>
                    <X size={16} />
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Judul *</label>
                    <input
                      type="text" required placeholder="mis. Pompeii"
                      value={songForm.judul}
                      onChange={(e) => setSongForm({ ...songForm, judul: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Artis</label>
                    <input
                      type="text" placeholder="mis. Bastille"
                      value={songForm.artis}
                      onChange={(e) => setSongForm({ ...songForm, artis: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>URL / ID Video YouTube *</label>
                    <input
                      type="text" required placeholder="https://www.youtube.com/watch?v=F90Cw4l-8NY"
                      value={songForm.videoId}
                      onChange={(e) => setSongForm({ ...songForm, videoId: e.target.value })}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Deskripsi / Nuansa</label>
                    <input
                      type="text" placeholder="mis. Anthem menenangkan"
                      value={songForm.deskripsi}
                      onChange={(e) => setSongForm({ ...songForm, deskripsi: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button className="btn btn-primary btn-sm" type="submit" disabled={songBusy}>
                    <Save size={15} /> {songBusy ? 'Menyimpan…' : editingSong ? 'Simpan Perubahan' : 'Tambahkan'}
                  </button>
                  <button
                    className="btn btn-secondary btn-sm" type="button"
                    onClick={() => preview(songForm.videoId.trim())}
                    disabled={!songForm.videoId.trim()}
                  >
                    <Play size={14} /> Pratinjau
                  </button>
                </div>
              </form>
            )}

            {/* Daftar lagu */}
            <div className="music-track-grid">
              {songs.length === 0 && (
                <p style={{ color: '#64748b', fontSize: 14 }}>
                  Pustaka kosong — klik "Tambah Lagu" untuk memasukkan lagu pertama.
                </p>
              )}
              {songs.map((s) => (
                <div
                  key={s.dbId ?? s.id}
                  className={`music-track-card ${isYouTube && track === s.id ? 'selected' : ''} ${s.aktif === false ? 'music-track-inactive' : ''}`}
                >
                  <span className="music-track-name">{s.label}{s.artist ? ` — ${s.artist}` : ''}</span>
                  <span className="music-track-desc">{s.desc || s.videoId}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      onClick={() => { setMode('youtube'); setTrack(s.id); previewId === s.id ? stopPreview() : preview(s.id); }}
                      style={{ padding: '5px 10px', fontSize: '0.75rem' }}
                    >
                      {previewId === s.id ? <><Square size={12} /> Berhenti</> : <><Play size={12} /> Dengarkan</>}
                    </button>
                    {s.dbId != null && (
                      <>
                        <button
                          className="btn btn-secondary btn-sm" type="button" title="Edit lagu"
                          onClick={() => openEditSong(s)}
                          style={{ padding: '5px 10px' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          className="btn btn-danger btn-sm" type="button" title="Hapus lagu"
                          onClick={() => deleteSong(s)}
                          style={{ padding: '5px 10px' }}
                        >
                          <Trash2 size={13} />
                        </button>
                        <button
                          className="btn btn-secondary btn-sm" type="button"
                          title={s.aktif === false ? 'Tampilkan di player' : 'Sembunyikan dari player'}
                          onClick={() => toggleAktif(s)}
                          style={{ padding: '5px 10px', fontSize: '0.72rem' }}
                        >
                          {s.aktif === false ? 'Nonaktif' : 'Aktif'}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <small style={{ color: '#64748b', display: 'block', marginTop: 8 }}>
              Lagu yang dipilih pengaturan (di bawah) otomatis mengalir di web publik. Bila lagu
              aktif dihapus, player otomatis memutar lagu pertama pada pustaka.
            </small>
          </div>

          <div className="settings-section">
            <h3><Zap size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Nuansa Nusantara (Prosedural)</h3>
            <div className="music-track-grid">
              {MUSIC_TRACKS.map((t) => (
                <button
                  key={t.id}
                  className={`music-track-card ${!isYouTube && track === t.id ? 'selected' : ''}`}
                  onClick={() => { setMode('procedural'); setTrack(t.id); preview(t.id); }}
                  type="button"
                >
                  <span className="music-track-name">{t.label}</span>
                  <span className="music-track-desc">{t.desc}</span>
                  <span
                    className="music-track-preview"
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isYouTube && track === t.id) stopPreview(); else preview(t.id);
                    }}
                  >
                    {!isYouTube && track === t.id ? '■ Berhenti' : '▶ Dengarkan'}
                  </span>
                </button>
              ))}
            </div>
            <small style={{ color: '#64748b', display: 'block', marginTop: 8 }}>
              Nuansa Nusantara disintesis perangkat lunak di browser pengunjung (Web Audio API) —
              tanpa file, bebas royalti, tetap bunyi walau offline.
            </small>
          </div>

          <div className="settings-section">
            <h3><Info size={20} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 8 }} /> Info</h3>
            <div className="settings-grid">
              <div className="settings-item">
                <span className="settings-label">Terakhir Diubah</span>
                <span className="settings-value">
                  {meta.updatedAt ? new Date(meta.updatedAt).toLocaleString('id-ID') : 'Belum pernah (masih default)'}
                </span>
              </div>
              <div className="settings-item">
                <span className="settings-label">Oleh</span>
                <span className="settings-value">{meta.updatedBy || '—'}</span>
              </div>
            </div>
            <small style={{ color: '#64748b', display: 'block', marginTop: 8 }}>
              Lagu YouTube diputar audio-only via IFrame API (video resmi artis, tidak tampil di layar,
              sesuai ketentuan YouTube). Perubahan berlaku untuk seluruh platform.
            </small>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
              <Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={stopPreview} type="button">
              Hentikan Pratinjau
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
