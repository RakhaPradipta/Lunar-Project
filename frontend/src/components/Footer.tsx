import { TreePine, MapPin, Phone, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { auth } from '../utils/auth';
import { PalmLeaf } from './LeafOrnament';

export default function Footer() {
  const isLoggedIn = auth.isLoggedIn();

  return (
    <footer className="wi-footer">
      <div className="wi-footer-batik" />
      <PalmLeaf tone="deep" opacity={0.16} rotate={-18} scale={2.4} style={{ left: '-50px', bottom: '6%' }} />
      <PalmLeaf tone="fresh" opacity={0.12} rotate={22} scale={1.8} style={{ right: '-30px', top: '12%' }} />
      <div className="wi-container">
        <div className="wi-footer-grid">
          <div className="wi-footer-brand">
            <span className="wi-footer-badge">🇮🇩 Wonderful Indonesia</span>
            <h3 style={{ marginTop: 14 }}>
              <TreePine size={24} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#4ade80' }} />
              DesaWisata <em>Nusantara</em>
            </h3>
            <p>
              Platform informasi dan promosi desa wisata di seluruh Indonesia.
              Dari hijau sawah hingga biru pantai — temukan keindahan alam,
              budaya, dan keramahan desa nusantara.
            </p>
          </div>
          <div>
            <h4>Navigasi</h4>
            <ul>
              <li><Link to="/">Beranda</Link></li>
              <li><a href="/#wisata">Destinasi Populer</a></li>
              <li><a href="/#peta">Peta Desa Wisata</a></li>
              {isLoggedIn && <li><Link to="/admin">Dashboard Admin</Link></li>}
            </ul>
          </div>
          <div>
            <h4>Kategori Pesona</h4>
            <ul>
              <li><Link to="/">⛰️ Wisata Alam</Link></li>
              <li><Link to="/">🎭 Wisata Budaya</Link></li>
              <li><Link to="/">🏖️ Wisata Pantai</Link></li>
              <li><Link to="/">🍲 Wisata Kuliner</Link></li>
              <li><Link to="/">🕌 Wisata Religi</Link></li>
            </ul>
          </div>
          <div>
            <h4>Hubungi Kami</h4>
            <ul>
              <li><a href="#"><MapPin size={13} style={{ display: 'inline', marginRight: 6 }} /> Jakarta, Indonesia</a></li>
              <li><a href="#"><Phone size={13} style={{ display: 'inline', marginRight: 6 }} /> +62 21 000 0000</a></li>
              <li><a href="#"><Mail size={13} style={{ display: 'inline', marginRight: 6 }} /> halo@desawisata.id</a></li>
            </ul>
          </div>
        </div>
        <div className="wi-footer-bottom">
          <span>© 2026 DesaWisata Nusantara · Pesona Wonderful Indonesia 🌿</span>
          <span>Alam · Budaya · Pantai · Kuliner · Religi</span>
        </div>
      </div>
    </footer>
  );
}
