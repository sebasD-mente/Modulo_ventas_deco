import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertCircle, Loader2, KeyRound } from 'lucide-react';

export default function LoginView() {
  const { loginWithGoogle, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState(null);
  const [hasGoogleConfig, setHasGoogleConfig] = useState(true);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (!googleClientId) {
      setHasGoogleConfig(false);
      return;
    }

    setHasGoogleConfig(true);

    const initGsi = () => {
      if (window.google && googleClientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: googleClientId,
            auto_select: false,
            callback: async (response) => {
              if (response.credential) {
                try {
                  setAuthError(null);
                  await loginWithGoogle(response.credential);
                } catch (err) {
                  setAuthError(err.message);
                }
              }
            },
          });

          const btnDiv = document.getElementById('googleSignInBtn');
          if (btnDiv) {
            btnDiv.innerHTML = '';
            window.google.accounts.id.renderButton(btnDiv, {
              type: 'standard',
              theme: 'filled_black',
              size: 'large',
              shape: 'pill',
              text: 'signin_with',
              locale: 'es',
              width: 300,
            });
          }
        } catch (err) {
          console.warn('Google Identity Services no se pudo inicializar:', err);
        }
      }
    };

    if (window.google) {
      initGsi();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initGsi();
        }
      }, 300);
      return () => clearInterval(interval);
    }
  }, [loginWithGoogle]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none">
      <div className="bg-[#121212] p-6 sm:p-9 rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-md w-full space-y-6 text-center relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        {/* Logotipo Oficial */}
        <div className="flex flex-col items-center justify-center gap-2">
          <img
            src="/brand/logo-header.png"
            alt="STAND {IA}"
            className="h-8 sm:h-9 object-contain"
          />
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest mt-1">
            Sistema de Ventas & Taller de Producción
          </div>
        </div>

        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Acceso al Sistema
          </h1>
          <p className="text-xs text-neutral-400">
            Inicia sesión con tu cuenta de Google para verificar tu identidad y permisos de acceso.
          </p>
        </div>

        {/* Mensaje de Error */}
        {(error || authError) && (
          <div className="bg-red-950/50 border border-red-800/80 rounded-2xl p-3.5 text-xs text-red-200 flex items-center gap-2.5 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error || authError}</span>
          </div>
        )}

        {/* Advertencia si falta Client ID */}
        {!hasGoogleConfig && (
          <div className="bg-amber-950/40 border border-amber-800/80 rounded-2xl p-4 text-xs text-amber-200 text-left space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <KeyRound className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Google OAuth 2.0 Requerido</span>
            </div>
            <p className="text-[11px] text-neutral-300 leading-relaxed">
              Para garantizar seguridad Zero-Trust y evitar accesos no autorizados, debes ingresar tu <strong>VITE_GOOGLE_CLIENT_ID</strong> en las variables de entorno de Dokploy o en tu archivo <code>.env</code>.
            </p>
          </div>
        )}

        {/* Botón Oficial Google Identity Services */}
        <div className="py-3 flex flex-col items-center justify-center min-h-[50px]">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
              <span>Verificando credenciales criptográficas con Google...</span>
            </div>
          ) : (
            <div id="googleSignInBtn" className="flex items-center justify-center"></div>
          )}
        </div>

        {/* Badge de Seguridad Zero-Trust */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autenticación Criptográfica Zero-Trust • Google Identity</span>
        </div>
      </div>
    </div>
  );
}
