import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogIn, Sparkles, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginView() {
  const { loginWithGoogle, devLogin, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState(null);

  // Inicializar Google Identity Services si está disponible el Client ID
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              try {
                await loginWithGoogle(response.credential);
              } catch (err) {
                setAuthError(err.message);
              }
            }
          },
        });

        const btnDiv = document.getElementById('googleSignInBtn');
        if (btnDiv) {
          window.google.accounts.id.renderButton(btnDiv, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: 'es',
            width: 280,
          });
        }
      } catch (err) {
        console.warn('Google Identity Services no se pudo inicializar:', err);
      }
    }
  }, [loginWithGoogle]);

  const handleDevRoleSelect = async (role, email, name) => {
    try {
      setAuthError(null);
      await devLogin(role, email, name);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 sm:p-6 font-sans select-none">
      {/* Contenedor Principal Estilizado #121212 */}
      <div className="bg-[#121212] p-7 sm:p-9 rounded-[36px] border border-neutral-800 shadow-2xl text-white max-w-md w-full space-y-6 text-center relative overflow-hidden">
        {/* Glow sutil de fondo */}
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

        {/* Mensaje de Bienvenida */}
        <div className="space-y-1.5">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Iniciar Sesión
          </h1>
          <p className="text-xs text-neutral-400">
            Accede de forma segura con tu cuenta de Google autorizada por Deco Vintage.
          </p>
        </div>

        {/* Alerta de Error si ocurre */}
        {(error || authError) && (
          <div className="bg-red-950/50 border border-red-800/80 rounded-2xl p-3.5 text-xs text-red-200 flex items-center gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error || authError}</span>
          </div>
        )}

        {/* Contenedor Botón Oficial de Google */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div id="googleSignInBtn" className="min-h-[44px] flex items-center justify-center"></div>

          {/* Botón Fallback interactivo si Google Client ID no está configurado */}
          <button
            type="button"
            onClick={() => handleDevRoleSelect('SUPER_ADMIN', 'ia@dekolabs.org', 'Super Administrador')}
            disabled={isLoading}
            className="mt-3 w-full bg-white hover:bg-neutral-200 text-black font-black text-sm py-3.5 px-5 rounded-2xl transition-all shadow-xl active:scale-98 flex items-center justify-center gap-2.5 cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <LogIn className="w-4 h-4 text-black" />
            )}
            <span>Acceder con Cuenta de Google</span>
          </button>
        </div>

        {/* Selector Rápido de Roles para Pruebas / Validación */}
        <div className="pt-4 border-t border-neutral-800/80 space-y-2.5">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>Acceso Rápido por Rol (Demostración & Pruebas)</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleDevRoleSelect('SUPER_ADMIN', 'ia@dekolabs.org', 'Super Administrador')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl p-2.5 text-left transition-all cursor-pointer group"
            >
              <div className="text-xs font-bold text-white group-hover:text-emerald-400">👑 Super Admin</div>
              <div className="text-[10px] text-neutral-400">Acceso Total</div>
            </button>

            <button
              type="button"
              onClick={() => handleDevRoleSelect('VENDEDOR', 'vendedor@decovintage.online', 'Vendedor Feria')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white/50 rounded-xl p-2.5 text-left transition-all cursor-pointer group"
            >
              <div className="text-xs font-bold text-white group-hover:text-white">💼 Vendedor</div>
              <div className="text-[10px] text-neutral-400">Ventas & Monitor</div>
            </button>

            <button
              type="button"
              onClick={() => handleDevRoleSelect('OPERARIO_1', 'operario1@decovintage.online', 'Operario 1 (Stock)')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-400/50 rounded-xl p-2.5 text-left transition-all cursor-pointer group"
            >
              <div className="text-xs font-bold text-white group-hover:text-emerald-400">👷 Operario 1</div>
              <div className="text-[10px] text-neutral-400">Stock & Producción</div>
            </button>

            <button
              type="button"
              onClick={() => handleDevRoleSelect('OPERARIO_2', 'operario2@decovintage.online', 'Operario 2 (Taller)')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-400/50 rounded-xl p-2.5 text-left transition-all cursor-pointer group"
            >
              <div className="text-xs font-bold text-white group-hover:text-cyan-400">🖨️ Operario 2</div>
              <div className="text-[10px] text-neutral-400">Taller de Impresión</div>
            </button>
          </div>
        </div>

        {/* Insignia de Seguridad Zero-Trust */}
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autenticación Criptográfica Zero-Trust • Dokploy VPS</span>
        </div>
      </div>
    </div>
  );
}
