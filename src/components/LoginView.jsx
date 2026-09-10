import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, LogIn, Sparkles, AlertCircle, Loader2, Mail, ArrowRight } from 'lucide-react';

export default function LoginView() {
  const { loginWithGoogle, loginWithEmailOrRole, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState(null);
  const [customEmail, setCustomEmail] = useState('');
  const [activeButtonRole, setActiveButtonRole] = useState(null);

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

  const handleRoleLogin = async (role, email, name) => {
    try {
      setAuthError(null);
      setActiveButtonRole(role);
      await loginWithEmailOrRole(email, role, name);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setActiveButtonRole(null);
    }
  };

  const handleCustomEmailSubmit = async (e) => {
    e.preventDefault();
    if (!customEmail.trim()) return;
    try {
      setAuthError(null);
      setActiveButtonRole('custom');
      await loginWithEmailOrRole(customEmail.trim(), null, customEmail.split('@')[0]);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setActiveButtonRole(null);
    }
  };

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
            Iniciar Sesión
          </h1>
          <p className="text-xs text-neutral-400">
            Ingresa con tu cuenta de Google autorizada o selecciona tu perfil.
          </p>
        </div>

        {/* Mensaje de Error */}
        {(error || authError) && (
          <div className="bg-red-950/50 border border-red-800/80 rounded-2xl p-3.5 text-xs text-red-200 flex items-center gap-2.5 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error || authError}</span>
          </div>
        )}

        {/* Botón Oficial Google (Si GIS está configurado) */}
        <div className="flex flex-col items-center justify-center">
          <div id="googleSignInBtn" className="min-h-[44px] flex items-center justify-center"></div>
        </div>

        {/* Formulario de Correo de Google */}
        <form onSubmit={handleCustomEmailSubmit} className="space-y-2 pt-1">
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="tu-correo@gmail.com"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500"
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || !customEmail.trim()}
            className="w-full bg-white hover:bg-neutral-200 disabled:opacity-40 text-black font-black text-xs sm:text-sm py-3 px-5 rounded-2xl transition-all shadow-xl active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading && activeButtonRole === 'custom' ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <ArrowRight className="w-4 h-4 text-black" />
            )}
            <span>Acceder con este Correo</span>
          </button>
        </form>

        {/* Selector Rápido de Roles y Perfiles */}
        <div className="pt-4 border-t border-neutral-800/80 space-y-2.5">
          <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Sparkles className="w-3 h-3 text-emerald-400" />
            <span>O ingresa con 1-Toque por tu Rol Asignado:</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleLogin('SUPER_ADMIN', 'ia@dekolabs.org', 'Super Administrador')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 rounded-xl p-3 text-left transition-all cursor-pointer group active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white group-hover:text-emerald-400">👑 Super Admin</div>
                {isLoading && activeButtonRole === 'SUPER_ADMIN' && (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400">Acceso Total</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleLogin('VENDEDOR', 'vendedor@decovintage.online', 'Vendedor Feria')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-white/50 rounded-xl p-3 text-left transition-all cursor-pointer group active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white group-hover:text-white">💼 Vendedor</div>
                {isLoading && activeButtonRole === 'VENDEDOR' && (
                  <Loader2 className="w-3 h-3 animate-spin text-white" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400">Ventas & Monitor</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleLogin('OPERARIO_1', 'operario1@decovintage.online', 'Operario 1 (Stock)')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-emerald-400/50 rounded-xl p-3 text-left transition-all cursor-pointer group active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white group-hover:text-emerald-400">👷 Operario 1</div>
                {isLoading && activeButtonRole === 'OPERARIO_1' && (
                  <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400">Stock & Producción</div>
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleRoleLogin('OPERARIO_2', 'operario2@decovintage.online', 'Operario 2 (Taller)')}
              className="bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-400/50 rounded-xl p-3 text-left transition-all cursor-pointer group active:scale-95 disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-white group-hover:text-cyan-400">🖨️ Operario 2</div>
                {isLoading && activeButtonRole === 'OPERARIO_2' && (
                  <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                )}
              </div>
              <div className="text-[10px] text-neutral-400">Taller de Impresión</div>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-1.5 text-[10px] text-neutral-400 pt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Autenticación Criptográfica Zero-Trust • Dokploy VPS</span>
        </div>
      </div>
    </div>
  );
}
