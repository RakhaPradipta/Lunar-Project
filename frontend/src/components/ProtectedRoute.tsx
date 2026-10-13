import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { auth } from '../utils/auth';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();

  if (auth.isLoggedIn()) {
    return children;
  }

  // Belum login: lempar ke halaman /login, simpan tujuan awal agar bisa kembali setelah login.
  const redirectPath = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?redirect=${encodeURIComponent(redirectPath)}`} replace />;
}
