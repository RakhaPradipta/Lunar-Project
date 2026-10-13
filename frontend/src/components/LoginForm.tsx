import { useState, type FormEvent } from 'react';
import {
  Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound, CheckCircle2, Check, Sparkles,
} from 'lucide-react';
import { auth } from '../utils/auth';
import { authApi } from '../api/authApi';

interface LoginFormProps {
  /** Dipanggil setelah login sukses (sesi sudah tersimpan). */
  onSuccess: () => void;
  /** Tampilkan kotak kredensial demo dengan tombol isi otomatis. */
  showDemo?: boolean;
  /** Tampilkan tautan "Lupa password?" di samping checkbox ingat saya. */
  showForgot?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const DEMO_ACCOUNTS = {
  super: { email: 'superadmin@desawisata.go.id', password: 'super123', label: 'Super Admin' },
  organisasi: { email: 'admin@desawisata.go.id', password: 'admin123', label: 'Admin Organisasi' },
} as const;

export default function LoginForm({
  onSuccess,
  showDemo = true,
  showForgot = false,
}: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const busy = loading || success;

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
    setError('');
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
    setError('');
  };

  const validate = (): boolean => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = 'Email wajib diisi';
    } else if (!EMAIL_RE.test(email.trim())) {
      errs.email = 'Format email tidak valid';
    }
    if (!password) {
      errs.password = 'Password wajib diisi';
    } else if (password.length < 6) {
      errs.password = 'Password minimal 6 karakter';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await authApi.login(email.trim(), password);
      if (res.success && res.data) {
        auth.setSession(res.data, remember);
        setSuccess(true);
        window.setTimeout(onSuccess, 650);
      } else {
        setError(res.message || 'Login gagal. Periksa email dan password Anda.');
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Gagal terhubung ke server. Pastikan backend berjalan.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFillDemo = (role: keyof typeof DEMO_ACCOUNTS) => {
    setEmail(DEMO_ACCOUNTS[role].email);
    setPassword(DEMO_ACCOUNTS[role].password);
    setError('');
    setFieldErrors({});
  };

  return (
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="login-alert login-alert-error" role="alert">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {showDemo && (
        <div className="login-demo">
          <div className="login-demo-head">
            <Sparkles size={14} />
            Kredensial Demo
          </div>
          <div className="login-demo-creds">
            <div><strong>Super Admin:</strong> <code>superadmin@desawisata.go.id / super123</code></div>
            <div><strong>Admin Organisasi:</strong> <code>admin@desawisata.go.id / admin123</code></div>
          </div>
          <div className="login-demo-actions">
            <button type="button" className="login-demo-fill" onClick={() => handleFillDemo('super')}>
              Isi Super Admin
            </button>
            <button type="button" className="login-demo-fill" onClick={() => handleFillDemo('organisasi')}>
              Isi Admin Organisasi
            </button>
          </div>
        </div>
      )}

      <div className={`login-field ${fieldErrors.email ? 'has-error' : ''}`}>
        <label htmlFor="login-email">Email Admin</label>
        <div className="login-input-wrap">
          <Mail size={18} className="login-input-icon" />
          <input
            id="login-email"
            type="email"
            autoComplete="username"
            placeholder="admin@desawisata.go.id"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            disabled={busy}
          />
        </div>
        {fieldErrors.email && (
          <span className="login-field-error">
            <AlertCircle size={13} />
            {fieldErrors.email}
          </span>
        )}
      </div>

      <div className={`login-field ${fieldErrors.password ? 'has-error' : ''}`}>
        <label htmlFor="login-password">Password</label>
        <div className="login-input-wrap">
          <Lock size={18} className="login-input-icon" />
          <input
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => handlePasswordChange(e.target.value)}
            onKeyUp={(e) => setCapsOn(e.getModifierState('CapsLock'))}
            onKeyDown={(e) => setCapsOn(e.getModifierState('CapsLock'))}
            disabled={busy}
          />
          <button
            type="button"
            className="login-password-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
            title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {capsOn && !fieldErrors.password && (
          <span className="login-capslock-hint">⇪ Caps Lock aktif</span>
        )}
        {fieldErrors.password && (
          <span className="login-field-error">
            <AlertCircle size={13} />
            {fieldErrors.password}
          </span>
        )}
      </div>

      <div className="login-remember-row">
        <label className="login-remember">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span className="login-checkbox">
            <Check size={12} strokeWidth={3.5} />
          </span>
          <span>Ingat saya</span>
        </label>
        {showForgot && (
          <button type="button" className="login-forgot">
            Lupa password?
          </button>
        )}
      </div>

      <button
        type="submit"
        className={`login-submit ${success ? 'is-success' : ''}`}
        disabled={busy}
      >
        {loading ? (
          <>
            <span className="login-spinner" />
            Memproses...
          </>
        ) : success ? (
          <>
            <CheckCircle2 size={18} />
            Login Berhasil!
          </>
        ) : (
          <>
            <KeyRound size={18} />
            Masuk
          </>
        )}
      </button>
    </form>
  );
}
