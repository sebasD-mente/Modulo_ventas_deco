import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('🚨 [STAND IA ErrorBoundary] Excepción no controlada:', error, errorInfo);

    const isChunkError =
      error?.message?.includes('Failed to fetch dynamically imported module') ||
      error?.message?.includes('is not valid JavaScript') ||
      error?.message?.includes('Loading chunk');

    if (isChunkError && typeof window !== 'undefined') {
      try {
        if (!sessionStorage.getItem('deko_chunk_reloaded')) {
          sessionStorage.setItem('deko_chunk_reloaded', '1');
          window.location.reload();
          return;
        }
      } catch (_) {}
    }
  }

  handleResetAndReload = () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('deko_chunk_reloaded');
      }
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'Error inesperado de ejecución en cliente.';

      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none font-sans">
          <div className="max-w-md w-full bg-neutral-950 border border-neutral-800 rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-5 text-amber-400">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              STAND {'{IA}'} • Recuperación del Sistema
            </h1>

            <p className="text-sm text-neutral-400 mb-6 leading-relaxed">
              Se detectó una actualización en los módulos de la aplicación o una interrupción visual en tu navegador.
            </p>

            <div className="w-full bg-black/60 border border-neutral-900 rounded-lg p-3 mb-6 text-left overflow-hidden">
              <p className="text-xs font-mono text-neutral-500 truncate" title={errorMessage}>
                {errorMessage}
              </p>
            </div>

            <button
              type="button"
              onClick={this.handleResetAndReload}
              className="w-full min-h-[44px] h-12 px-6 rounded-xl bg-white text-black font-semibold text-sm hover:bg-neutral-200 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg"
            >
              <RefreshCw className="w-4 h-4" />
              Reiniciar Sesión y Recargar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
