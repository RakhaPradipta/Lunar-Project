import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { TreePine, ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { auth } from '../utils/auth';
import { consumeSessionExpiredMessage } from '../utils/apiError';
import LoginForm from '../components/LoginForm';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Pesan "sesi berakhir" dibaca sekali (di-set oleh penanganan 401 global)
  const [expiredMsg] = useState(() => consumeSessionExpiredMessage());

  // Sudah login? Langsung ke dashboard.
  if (auth.isLoggedIn()) {
    return <Navigate to="/admin" replace />;
  }

  // Hanya izinkan redirect ke path internal
  const rawRedirect = searchParams.get('redirect') || '/admin';
  const redirect =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/admin';

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Sisi kiri: form */}
        <section className="auth-left">
          <Link to="/" className="login-back-link">
            <ArrowLeft size={15} />
            Kembali ke Beranda
          </Link>

          <div className="auth-left-inner">
            <div className="auth-welcome-icon">
              <TreePine size={26} />
            </div>
            <h1 className="auth-title">Selamat Datang</h1>
            <p className="auth-subtitle">
              Masukkan email dan password admin Anda untuk melanjutkan.
            </p>

            {expiredMsg && (
              <div className="login-alert login-alert-info" role="status">
                <span>{expiredMsg}</span>
              </div>
            )}

            <LoginForm onSuccess={() => navigate(redirect)} showForgot />
          </div>
        </section>

        {/* Sisi kanan: panel artwork gradasi */}
        <aside className="auth-right">
          <div className="auth-aurora a1" />
          <div className="auth-aurora a2" />
          <div className="auth-aurora a3" />
          <div className="auth-art-badge">
            <TreePine size={15} />
            DesaWisata Nusantara
          </div>
        </aside>
      </div>
    </div>
  );
}
