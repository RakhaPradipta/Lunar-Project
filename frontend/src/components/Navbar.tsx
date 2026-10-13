import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { TreePine, Lock, LogOut, LayoutDashboard, Menu, X, Home, MapPin, Map } from 'lucide-react';
import { auth } from '../utils/auth';

/** Hash section di landing page yang punya item navbar. */
type SectionHash = 'wisata' | 'peta';

const SECTION_HASHES: SectionHash[] = ['wisata', 'peta'];

function smoothScrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Navbar gaya floating pill (seperti referensi):
 * bar putih rounded-full melayang, item aktif dapat pelleton hijau muda
 * dengan badge lingkaran gelap berisi ikon di kanan label.
 *
 * Pelleton aktif mengikuti konteks:
 * - Beranda  : aktif saat di landing page tanpa section terpilih
 * - Destinasi: aktif saat melihat section #wisata (klik -> smooth scroll)
 * - Peta     : aktif saat melihat section #peta (klik -> smooth scroll)
 * - Dashboard: aktif saat di /admin
 */
export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggedIn, setIsLoggedIn] = useState(auth.isLoggedIn());
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState<SectionHash | null>(null);

  const isLanding = location.pathname === '/';
  const isDashboard = location.pathname.startsWith('/admin');
  const isLogin = location.pathname === '/login';

  useEffect(() => {
    setIsLoggedIn(auth.isLoggedIn());
    setMenuOpen(false); // tutup menu mobile setiap pindah halaman

    // Sinkronkan pelleton dengan section yang sedang dituju
    const stateScroll = (location.state as { scrollTo?: string } | null)?.scrollTo;
    const hash = location.hash.replace('#', '') || stateScroll || '';
    if (isLanding && SECTION_HASHES.includes(hash as SectionHash)) {
      setActiveHash(hash as SectionHash);
      // Beri waktu render halaman landing sebelum menggulir
      const t = window.setTimeout(() => smoothScrollTo(hash), 60);
      return () => window.clearTimeout(t);
    }
    setActiveHash(null);
  }, [location, isLanding]);

  const handleLogout = () => {
    void auth.logout().then(() => {
      setIsLoggedIn(false);
      navigate('/');
    });
  };

  /** Klik Destinasi/Peta: smooth scroll jika sudah di landing, otherwise pindah dulu ke landing. */
  const handleSectionClick = (hash: SectionHash) => (e: React.MouseEvent) => {
    setMenuOpen(false);
    if (location.pathname !== '/') {
      navigate('/', { state: { scrollTo: hash } });
      return;
    }
    e.preventDefault();
    setActiveHash(hash);
    smoothScrollTo(hash);
  };

  return (
    <nav className="nav2">
      <div className="nav2-inner">
        <Link to="/" className="nav2-logo">
          <span className="nav2-logo-icon">
            <TreePine size={18} />
          </span>
          <span className="nav2-logo-text">
            <strong>DesaWisata <span className="wi-nav-flag">🇮🇩 Wonderful</span></strong>
            <small>Pesona Nusantara • Alam • Budaya</small>
          </span>
        </Link>

        <button
          className={`nav2-toggle ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className={`nav2-links ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)}>
          <Link to="/" className={`nav2-link ${isLanding && !activeHash ? 'active' : ''}`}>
            <span className="nav2-link-label">Beranda</span>
            <span className="nav2-badge"><Home size={12} /></span>
          </Link>
          <Link
            to={{ pathname: '/', hash: '#wisata' }}
            onClick={handleSectionClick('wisata')}
            className={`nav2-link ${activeHash === 'wisata' ? 'active' : ''}`}
          >
            <span className="nav2-link-label">Destinasi</span>
            <span className="nav2-badge"><MapPin size={12} /></span>
          </Link>
          <Link
            to={{ pathname: '/', hash: '#peta' }}
            onClick={handleSectionClick('peta')}
            className={`nav2-link ${activeHash === 'peta' ? 'active' : ''}`}
          >
            <span className="nav2-link-label">Peta</span>
            <span className="nav2-badge"><Map size={12} /></span>
          </Link>
          {isLoggedIn && (
            <Link to="/admin" className={`nav2-link ${isDashboard ? 'active' : ''}`}>
              <span className="nav2-link-label">Dashboard</span>
              <span className="nav2-badge"><LayoutDashboard size={12} /></span>
            </Link>
          )}

          {/* CTA (login/logout) hanya tampil di panel menu mobile */}
          <div className="nav2-mobile-cta">
            {isLoggedIn ? (
              <button onClick={handleLogout} className="nav2-cta-btn nav2-cta-ghost">
                <LogOut size={15} />
                Logout
              </button>
            ) : (
              <Link to="/login" className="nav2-cta-btn">
                <Lock size={14} />
                Login Admin
                <span className="nav2-cta-arrow">→</span>
              </Link>
            )}
          </div>
        </div>

        <div className="nav2-cta">
          {isLoggedIn ? (
            <button
              onClick={handleLogout}
              className="nav2-cta-btn nav2-cta-ghost"
              title="Keluar dari akun admin"
            >
              <LogOut size={15} />
              Logout
            </button>
          ) : (
            <Link
              to="/login"
              className={`nav2-cta-btn ${isLogin ? 'is-current' : ''}`}
            >
              <Lock size={14} />
              Login Admin
              <span className="nav2-cta-arrow">→</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
