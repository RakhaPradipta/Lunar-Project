import { useState, useEffect, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  TreePine, UserPlus, Mail, Lock, User, Building2, ArrowLeft,
  CheckCircle2, AlertCircle, Eye, EyeOff, ShieldCheck, Check,
} from 'lucide-react';
import { auth } from '../utils/auth';
import { organisasiApi } from '../api/organisasiApi';
import type { Organisasi } from '../types/desawisata';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  namaLengkap?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  organisasiId?: string;
}

/** Gate: halaman ini khusus SuperAdmin yang sudah login. */
export default function RegisterAdminPage() {
  if (!auth.isLoggedIn()) {
    return <Navigate to={`/login?redirect=${encodeURIComponent('/register-admin')}`} replace />;
  }
  if (!auth.isSuperAdmin()) {
    return <Navigate to="/admin" replace />;
  }
  return <RegisterAdminForm />;
}

function RegisterAdminForm() {
  const navigate = useNavigate();
  const [namaLengkap, setNamaLengkap] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [organisasiId, setOrganisasiId] = useState('');
  const [organisasiList, setOrganisasiList] = useState<Organisasi[]>([]);
  const [orgLoading, setOrgLoading] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');

  // Muat daftar organisasi untuk dropdown
  useEffect(() => {
    let cancelled = false;
    organisasiApi
      .getAll()
      .then((res) => {
        if (!cancelled && res.success) setOrganisasiList(res.data.filter((o) => o.aktif));
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat daftar organisasi. Klik "Daftarkan Admin" untuk mencoba lagi.');
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const clearFieldError = (key: keyof FieldErrors) => {
    if (fieldErrors[key]) setFieldErrors((p) => ({ ...p, [key]: undefined }));
    setError('');
  };

  const validate = (): boolean => {
    const errs: FieldErrors = {};
    if (!namaLengkap.trim()) errs.namaLengkap = 'Nama lengkap wajib diisi';
    if (!email.trim()) errs.email = 'Email wajib diisi';
    else if (!EMAIL_RE.test(email.trim())) errs.email = 'Format email tidak valid';
    if (!password) errs.password = 'Password wajib diisi';
    else if (password.length < 6) errs.password = 'Password minimal 6 karakter';
    if (!confirmPassword) errs.confirmPassword = 'Konfirmasi password wajib diisi';
    else if (confirmPassword !== password) errs.confirmPassword = 'Konfirmasi password tidak cocok';
    if (!organisasiId) errs.organisasiId = 'Pilih organisasi untuk admin ini';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setError('');
    // Jika daftar organisasi gagal dimuat sebelumnya, coba lagi saat submit
    if (!orgLoading && organisasiList.length === 0) {
      setOrgLoading(true);
      try {
        const res = await organisasiApi.getAll();
        if (res.success) {
          setOrganisasiList(res.data.filter((o) => o.aktif));
          setError('');
        }
      } catch { /* biarkan validasi di bawah yang menampilkan pesan */ } finally {
        setOrgLoading(false);
      }
      if (organisasiList.length === 0) {
        setError('Daftar organisasi belum tersedia. Periksa koneksi ke server lalu coba lagi.');
        return;
      }
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await organisasiApi.createUser({
        email: email.trim(),
        password,
        namaLengkap: namaLengkap.trim(),
        role: 'Admin',
        organisasiId: Number(organisasiId),
      });
      const created = res.data?.email ?? email.trim();
      const orgNama = organisasiList.find((o) => String(o.id) === organisasiId)?.namaOrganisasi ?? '';
      setSuccess(`Akun admin ${created} berhasil dibuat untuk organisasi ${orgNama}.`);
      // Reset form agar bisa langsung mendaftarkan admin berikutnya
      setNamaLengkap(''); setEmail(''); setPassword(''); setConfirmPassword('');
      setOrganisasiId(''); setFieldErrors({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun admin');
    } finally {
      setLoading(false);
    }
  };

  const strength = (() => {
    let s = 0;
    if (password.length >= 6) s += 1;
    if (password.length >= 10) s += 1;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) s += 1;
    if (/\d/.test(password)) s += 1;
    if (/[^A-Za-z0-9]/.test(password)) s += 1;
    return s; // 0..5
  })();
  const strengthLabels = ['Sangat lemah', 'Lemah', 'Cukup', 'Baik', 'Kuat', 'Sangat kuat'];

  const passwordRules = [
    { ok: password.length >= 6, label: 'Minimal 6 karakter' },
    { ok: /[A-Z]/.test(password) && /[a-z]/.test(password), label: 'Ada huruf besar & kecil' },
    { ok: /\d/.test(password), label: 'Ada angka' },
  ];

  return (
    <div className="login-page">
      {/* Panel branding (kiri) — konsisten dengan halaman login */}
      <aside className="login-brand">
        <div className="login-brand-circle c1" />
        <div className="login-brand-circle c2" />

        <div className="login-brand-logo">
          <div className="login-brand-logo-icon"><TreePine size={24} /></div>
          <div>
            <div className="login-brand-logo-name">DesaWisata</div>
            <div className="login-brand-logo-sub">Nusantara</div>
          </div>
        </div>

        <div className="login-brand-main">
          <h1 className="login-brand-title">
            Daftarkan <span>Admin</span> Organisasi
          </h1>
          <p className="login-brand-desc">
            Buat akun admin baru untuk mengelola desa wisata milik sebuah organisasi.
            Hanya SuperAdmin yang dapat melakukan pendaftaran ini.
          </p>
          <div className="login-brand-features">
            <div className="login-brand-feature">
              <div className="login-brand-feature-icon"><Building2 size={20} /></div>
              <div>
                <strong>Satu Organisasi, Banyak Admin</strong>
                <p>Setiap admin terikat pada organisasinya dan hanya bisa mengelola desa miliknya.</p>
              </div>
            </div>
            <div className="login-brand-feature">
              <div className="login-brand-feature-icon"><ShieldCheck size={20} /></div>
              <div>
                <strong>Akses Terkontrol</strong>
                <p>Admin organisasi tidak dapat melihat data organisasi lain (multi-tenant).</p>
              </div>
            </div>
          </div>
        </div>

        <div className="login-brand-footer">
          © 2026 DesaWisata Nusantara — Panel Admin
        </div>
      </aside>

      {/* Panel form (kanan) */}
      <main className="login-form-panel">
        <button className="login-back-link" onClick={() => navigate('/admin')}>
          <ArrowLeft size={15} />
          Kembali ke Dashboard
        </button>

        <div className="login-form-card">
          <div className="login-form-head">
            <div className="login-form-head-icon">
              <UserPlus size={22} />
            </div>
            <h1>Register Admin Organisasi</h1>
            <p>Akun akan dibuat dengan role Admin dan terikat pada organisasi yang dipilih.</p>
          </div>

          {success && (
            <div className="login-alert login-alert-success" role="status">
              <CheckCircle2 size={16} />
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="login-alert login-alert-error" role="alert">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className={`login-field ${fieldErrors.namaLengkap ? 'has-error' : ''}`}>
              <label htmlFor="reg-nama">Nama Lengkap</label>
              <div className="login-input-wrap">
                <User size={18} className="login-input-icon" />
                <input
                  id="reg-nama"
                  type="text"
                  placeholder="mis. Budi Santoso"
                  value={namaLengkap}
                  onChange={(e) => { setNamaLengkap(e.target.value); clearFieldError('namaLengkap'); }}
                  disabled={loading}
                />
              </div>
              {fieldErrors.namaLengkap && (
                <span className="login-field-error"><AlertCircle size={13} />{fieldErrors.namaLengkap}</span>
              )}
            </div>

            <div className={`login-field ${fieldErrors.email ? 'has-error' : ''}`}>
              <label htmlFor="reg-email">Email Admin</label>
              <div className="login-input-wrap">
                <Mail size={18} className="login-input-icon" />
                <input
                  id="reg-email"
                  type="email"
                  autoComplete="username"
                  placeholder="admin@organisasi.go.id"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); clearFieldError('email'); }}
                  disabled={loading}
                />
              </div>
              {fieldErrors.email && (
                <span className="login-field-error"><AlertCircle size={13} />{fieldErrors.email}</span>
              )}
            </div>

            <div className={`login-field ${fieldErrors.password ? 'has-error' : ''}`}>
              <label htmlFor="reg-password">Password</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input
                  id="reg-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Min. 6 karakter"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); clearFieldError('password'); }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Strength meter + rules (hanya tampil saat mengetik) */}
              {password && (
                <div className="reg-password-meter">
                  <div className="reg-password-bars">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <span key={i} className={`reg-bar${i <= strength ? ` s${strength} on` : ''}`} />
                    ))}
                  </div>
                  <span className={`reg-password-label l${strength}`}>{strengthLabels[strength]}</span>
                </div>
              )}
              {password && (
                <div className="reg-password-rules">
                  {passwordRules.map((r) => (
                    <span key={r.label} className={`reg-rule ${r.ok ? 'ok' : ''}`}>
                      <Check size={11} strokeWidth={3.5} />
                      {r.label}
                    </span>
                  ))}
                </div>
              )}
              {fieldErrors.password && (
                <span className="login-field-error"><AlertCircle size={13} />{fieldErrors.password}</span>
              )}
            </div>

            <div className={`login-field ${fieldErrors.confirmPassword ? 'has-error' : ''}`}>
              <label htmlFor="reg-confirm">Konfirmasi Password</label>
              <div className="login-input-wrap">
                <Lock size={18} className="login-input-icon" />
                <input
                  id="reg-confirm"
                  type={showConfirm ? 'text' : 'password'}
                  autoComplete="new-password"
                  placeholder="Ulangi password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); clearFieldError('confirmPassword'); }}
                  disabled={loading}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? 'Sembunyikan konfirmasi password' : 'Tampilkan konfirmasi password'}
                >
                  {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {confirmPassword && confirmPassword === password && (
                <span className="login-match-hint">
                  <CheckCircle2 size={13} /> Password cocok
                </span>
              )}
              {fieldErrors.confirmPassword && (
                <span className="login-field-error"><AlertCircle size={13} />{fieldErrors.confirmPassword}</span>
              )}
            </div>

            <div className={`login-field ${fieldErrors.organisasiId ? 'has-error' : ''}`}>
              <label htmlFor="reg-organisasi">Organisasi</label>
              <div className="login-input-wrap login-select-wrap">
                <Building2 size={18} className="login-input-icon" />
                <select
                  id="reg-organisasi"
                  value={organisasiId}
                  onChange={(e) => { setOrganisasiId(e.target.value); clearFieldError('organisasiId'); }}
                  disabled={loading || orgLoading}
                >
                  <option value="">{orgLoading ? 'Memuat organisasi...' : '-- Pilih organisasi --'}</option>
                  {organisasiList.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.namaOrganisasi}{o.jumlahDesa > 0 ? ` • ${o.jumlahDesa} desa` : ''}
                    </option>
                  ))}
                </select>
              </div>
              {fieldErrors.organisasiId && (
                <span className="login-field-error"><AlertCircle size={13} />{fieldErrors.organisasiId}</span>
              )}
            </div>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? (
                <>
                  <span className="login-spinner" />
                  Mendaftarkan...
                </>
              ) : (
                <>
                  <UserPlus size={18} />
                  Daftarkan Admin
                </>
              )}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
