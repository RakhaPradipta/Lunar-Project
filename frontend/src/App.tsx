import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import AiChatWidget from './components/AiChatWidget';
import MusicPlayer from './components/MusicPlayer';
import ErrorBoundary from './components/ErrorBoundary';

// ===== Code-splitting per route =====
// Dulu seluruh halaman (termasuk AdminDashboard 1.500+ baris + Leaflet) ikut di
// bundle awal yang dimuat oleh SEMUA pengunjung publik. Dengan React.lazy,
// setiap halaman hanya diunduh saat rutenya dibuka — bundle awal jauh lebih ringan.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const DesaProfilePage = lazy(() => import('./pages/DesaProfilePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterAdminPage = lazy(() => import('./pages/RegisterAdminPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function RouteFallback() {
  return (
    <div className="loading-spinner" style={{ padding: '120px 0' }}>
      <div className="spinner"></div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={
              <>
                <Navbar />
                <LandingPage />
                <MusicPlayer />
                <AiChatWidget />
              </>
            } />
            <Route path="/desa/:id" element={
              <>
                <Navbar />
                <DesaProfilePage />
                <MusicPlayer />
                <AiChatWidget />
              </>
            } />
            <Route path="/login" element={
              <LoginPage />
            } />
            <Route path="/register-admin" element={
              <RegisterAdminPage />
            } />
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            } />
          </Routes>
        </Suspense>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
