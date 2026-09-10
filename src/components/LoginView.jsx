import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Sparkles, AlertCircle, Loader2, Mail, ArrowRight, Lock } from 'lucide-react';

export default function LoginView() {
  const { loginWithGoogle, loginWithEmailOrRole, isLoading, error } = useAuth();
  const [authError, setAuthError] = useState(null);
  const [emailInput, setEmailInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    if (window.google && googleClientId) {
      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
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
          window.google.accounts.id.renderButton(btnDiv, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'signin_with',
            locale: 'es',
            width: 320,
          });
        }
      } catch (err) {
        console.warn('Google Identity Services no se pudo inicializar:', err);
      }
    }
  }, [loginWithGoogle]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.trim()) return;
    try {
      setAuthError(null);
      setIsSubmitting(true);
      await loginWithEmailOrRole(emailInput.trim(), null, emailInput.split('@')[0]);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setIsSubmitting(false);
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
            Accede con tu cuenta autorizada de Google para operar el sistema.
          </p>
        </div>

        {/* Mensaje de Error */}
        {(error || authError) && (
          <div className="bg-red-950/50 border border-red-800/80 rounded-2xl p-3.5 text-xs text-red-200 flex items-center gap-2.5 text-left animate-in fade-in">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error || authError}</span>
          </div>
        )}

        {/* Botón Oficial Google Identity Services */}
        <div className="flex flex-col items-center justify-center">
          <div id="googleSignInBtn" className="min-h-[44px] flex items-center justify-center"></div>
        </div>

        {/* Separador Visual Elegante */}
        <div className="relative flex items-center justify-center py-2">
          <div className="border-t border-neutral-800 w-full"></div>
          <span className="bg-[#121212] px-3 text-[10px] font-bold text-neutral-500 uppercase tracking-wider absolute">
            O con correo autorizado
          </span>
        </div>

        {/* Formulario de Acceso por Correo */}
        <form onSubmit={handleEmailSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              placeholder="nombre@decovintage.online o Gmail"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              className="w-full bg-black border border-neutral-700/90 rounded-2xl pl-11 pr-4 py-3 text-xs sm:text-sm text-white focus:outline-none focus:border-white shadow-inner placeholder:text-neutral-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading || isSubmitting || !emailInput.trim()}
            className="w-full bg-white hover:bg-neutral-200 disabled:opacity-40 text-black font-black text-xs sm:text-sm py-3 px-5 rounded-2xl transition-all shadow-xl active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
          >
            {(isLoading || isSubmitting) ? (
              <Loader2 className="w-4 h-4 animate-spin text-black" />
            ) : (
              <ArrowRight className="w-4 h-4 text-black" />
            )}
            <span>Continuar con mi Cuenta</span>
          </button>
        </form>

        {/* Badge de Seguridad Zero-Trust */}
        <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-center gap-1.5 text-[10px] text-neutral-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Acceso Protegido con Google OAuth 2.0 & RBAC</span>
        </div>
      </div>
    </div>
  );
}
