import { useEffect } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import LoginForm from './LoginForm';

interface LoginModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  // Tutup dengan tombol ESC + kunci scroll body selama modal terbuka
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="login-modal-overlay" onClick={onClose}>
      <div
        className="login-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Login Admin"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="login-modal-header">
          <button className="login-modal-close" onClick={onClose} aria-label="Tutup form login">
            <X size={17} />
          </button>
          <div className="login-modal-header-inner">
            <div className="login-modal-icon">
              <ShieldCheck size={26} />
            </div>
            <h2>Login Admin</h2>
            <p>Masuk dengan akun SuperAdmin atau Admin Organisasi</p>
          </div>
        </div>
        <div className="login-modal-body">
          <LoginForm onSuccess={onSuccess} />
        </div>
      </div>
    </div>
  );
}
