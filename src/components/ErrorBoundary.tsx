import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
            background: 'hsl(222, 47%, 6%)',
            color: 'hsl(210, 40%, 96%)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              maxWidth: '400px',
              width: '100%',
              padding: '2rem',
              borderRadius: '1rem',
              background: 'hsl(222, 47%, 9%)',
              border: '1px solid hsl(217, 33%, 17%)',
            }}
          >
            <p style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>😵</p>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              Terjadi Kesalahan
            </h1>
            <p style={{ fontSize: '0.875rem', color: 'hsl(215, 20%, 65%)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              Maaf, terjadi masalah yang tidak terduga. Data transaksi Anda tetap aman di perangkat ini.
            </p>
            {this.state.error && (
              <p
                style={{
                  fontSize: '0.7rem',
                  fontFamily: 'monospace',
                  color: 'hsl(0, 84%, 70%)',
                  background: 'hsl(0, 50%, 10%)',
                  padding: '0.75rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem',
                  wordBreak: 'break-word',
                  textAlign: 'left',
                  maxHeight: '6rem',
                  overflowY: 'auto',
                }}
              >
                {this.state.error.message}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button
                onClick={this.handleReload}
                style={{
                  padding: '0.75rem 1.5rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: '0.5rem',
                  border: 'none',
                  background: 'hsl(25, 95%, 53%)',
                  color: 'white',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.9')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Muat Ulang Aplikasi
              </button>
              <button
                onClick={this.handleReset}
                style={{
                  padding: '0.5rem 1rem',
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  borderRadius: '0.5rem',
                  border: '1px solid hsl(217, 33%, 17%)',
                  background: 'transparent',
                  color: 'hsl(215, 20%, 65%)',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseOut={(e) => (e.currentTarget.style.opacity = '1')}
              >
                Coba Lanjutkan
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
