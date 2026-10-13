import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * ErrorBoundary global — menangkap error render React yang tidak tertangani.
 *
 * Dulu satu komponen yang melempar error membuat seluruh aplikasi blank putih
 * tanpa pesan apa pun. Sekarang user melihat panel ramah dengan opsi reload /
 * kembali ke beranda, dan detail error tetap tercatat di console untuk debugging.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : 'Terjadi kesalahan tak terduga.',
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleHome = () => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          fontFamily: "'DM Sans', sans-serif",
          background: 'linear-gradient(135deg, #f0fdf4, #ffffff)',
        }}
      >
        <div
          style={{
            maxWidth: 460,
            width: '100%',
            textAlign: 'center',
            background: 'white',
            border: '1px solid #fecaca',
            borderRadius: 20,
            padding: '40px 32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              margin: '0 auto 16px',
              background: '#fef2f2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AlertTriangle size={30} color="#dc2626" />
          </div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
            Ups, terjadi kesalahan 😥
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#64748b', lineHeight: 1.6, margin: '0 0 6px' }}>
            Aplikasi mengalami error yang tidak terduga. Coba muat ulang halaman ini.
          </p>
          <p
            style={{
              fontSize: '0.78rem',
              color: '#94a3b8',
              fontFamily: 'monospace',
              background: '#f8fafc',
              borderRadius: 8,
              padding: '8px 10px',
              wordBreak: 'break-word',
              maxHeight: 80,
              overflow: 'auto',
            }}
          >
            {this.state.message}
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20 }}>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 100,
                border: 'none',
                background: '#16a34a',
                color: 'white',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={15} /> Muat Ulang
            </button>
            <button
              onClick={this.handleHome}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 22px',
                borderRadius: 100,
                border: '1px solid var(--gray-200, #e5e7eb)',
                background: 'white',
                color: '#374151',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
              }}
            >
              <Home size={15} /> Ke Beranda
            </button>
          </div>
        </div>
      </div>
    );
  }
}
