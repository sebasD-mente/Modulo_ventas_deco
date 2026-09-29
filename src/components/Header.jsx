import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Menu, X, ShoppingBag, Calendar, Activity,
  Package, Clock, Wallet, Users, Percent, ChevronRight,
  AlertCircle, Mail,
} from 'lucide-react';

const TAB_ICONS = {
  venta: ShoppingBag, eventos: Calendar, monitor: Activity, produccion: Package,
  seguimiento: Clock, cierre: Wallet, usuarios: Users, comisiones: Percent,
};

export default function Header({ activeEvent, activeTab, setActiveTab, liveMetrics }) {
  const { user, logout, isSuperAdmin, isVendedor, isVendedorRedes, isOperario1, isOperario2 } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Bloquear scroll de la página y escuchar tecla Escape al abrir drawer
  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    if (isMenuOpen) window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  // Configuración de pestañas permitidas por roles aditivos
  let navTabs = [];
  if (isSuperAdmin) {
    navTabs = [
      { id: 'venta', label: 'Nueva venta' }, { id: 'eventos', label: 'Eventos' },
      { id: 'monitor', label: 'Monitor' }, { id: 'produccion', label: 'Producción' },
      { id: 'seguimiento', label: 'Seguimiento' }, { id: 'cierre', label: 'Cierre' },
      { id: 'usuarios', label: 'Usuarios' }, { id: 'comisiones', label: 'Comisiones' },
    ];
  } else {
    const tabMap = new Map();
    if (isVendedorRedes && !isVendedor) {
      tabMap.set('venta', { id: 'venta', label: 'Pedidos / Venta' });
      tabMap.set('eventos', { id: 'eventos', label: 'Punto de Venta' });
      if (!isOperario1 && !isOperario2) tabMap.set('produccion', { id: 'produccion', label: 'Mis Pedidos' });
      tabMap.set('seguimiento', { id: 'seguimiento', label: 'Seguimiento' });
      tabMap.set('comisiones', { id: 'comisiones', label: 'Mis Comisiones' });
    } else {
      if (isVendedor) {
        tabMap.set('venta', { id: 'venta', label: 'Nueva venta' });
        tabMap.set('monitor', { id: 'monitor', label: 'Monitor' });
      }
      if (isVendedorRedes) {
        tabMap.set('eventos', { id: 'eventos', label: 'Punto de Venta' });
        tabMap.set('seguimiento', { id: 'seguimiento', label: 'Seguimiento' });
        tabMap.set('comisiones', { id: 'comisiones', label: 'Mis Comisiones' });
      }
    }

    if (isOperario1 && isOperario2) {
      tabMap.set('produccion', { id: 'produccion', label: 'Producción' });
    } else if (isOperario1) {
      tabMap.set('produccion', { id: 'produccion', label: 'Producción & Stock' });
    } else if (isOperario2) {
      tabMap.set('produccion', { id: 'produccion', label: 'Taller de Impresión' });
    }

    if (isVendedor) tabMap.set('cierre', { id: 'cierre', label: 'Cierre de caja' });
    navTabs = Array.from(tabMap.values());
    if (navTabs.length === 0) navTabs = [{ id: 'venta', label: 'Terminal de Ventas' }];
  }

  const getRoleBadges = () => {
    if (isSuperAdmin) return ['SUPER ADMIN'];
    const list = [];
    if (isVendedor) list.push('MOSTRADOR');
    if (isVendedorRedes) list.push('REDES');
    if (isOperario1) list.push('STOCK');
    if (isOperario2) list.push('IMPRESIÓN');
    if (list.length === 0) list.push(user?.role || 'VENDEDOR');
    return list;
  };

  const currentTab = navTabs.find((t) => t.id === activeTab) || { label: activeTab };

  const renderAvatar = (size = 'w-8 h-8', textSize = 'text-xs') => (
    user?.avatarUrl ? (
      <img src={user.avatarUrl} alt={user.fullName} className={`${size} rounded-full object-cover shrink-0 ring-1 ring-neutral-300`} />
    ) : (
      <div className={`${size} rounded-full bg-black text-white ${textSize} font-black flex items-center justify-center shrink-0 ring-1 ring-neutral-300`}>
        {user?.fullName?.[0] || 'U'}
      </div>
    )
  );

  return (
    <header className="bg-white border-b border-neutral-200 text-black sticky top-0 z-40 px-3 py-2 sm:py-2.5 sm:px-6 select-none shadow-sm">
      <div className="max-w-4xl mx-auto">
        {/* Barra Superior Unificada (Todas las Pantallas) */}
        <div className="flex items-center justify-between">
          {/* Izquierda: Botón de Menú Hamburguesa Universal */}
          <button
            type="button"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black cursor-pointer transition-colors"
          >
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Centro: Logotipo STAND {IA} y Micro-indicador de pestaña activa */}
          <div className="flex flex-col items-center justify-center">
            <img src="/brand/logo-header.png" alt="STAND {IA}" className="h-6 sm:h-7 object-contain" />
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-tight mt-0.5">
              {currentTab.label}
            </span>
          </div>

          {/* Derecha: Perfil Compacto Idéntico en Todas las Pantallas */}
          {user ? (
            <div className="flex items-center gap-1.5 py-1 px-1.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 shadow-xs">
              {renderAvatar('w-8 h-8', 'text-xs')}
              <button
                type="button"
                onClick={logout}
                title="Cerrar Sesión"
                aria-label="Cerrar Sesión"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-200 transition-colors p-2 text-neutral-400 hover:text-black cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="min-w-[44px] min-h-[44px]" />
          )}
        </div>
      </div>

      {/* Drawer Lateral Desplegable (Universal: Móvil, Tablet y Desktop) */}
      {isMenuOpen && (
        <div>
          {/* Backdrop con desenfoque */}
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Panel Lateral Deslizable */}
          <aside
            aria-label="Menú de navegación"
            className="fixed inset-y-0 left-0 z-50 w-full max-w-xs sm:max-w-sm bg-white text-black shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200"
          >
            {/* Cabecera del Drawer */}
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 shrink-0">
              <img src="/brand/logo-header.png" alt="STAND {IA}" className="h-6 object-contain" />
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                aria-label="Cerrar menú"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 text-neutral-600 hover:text-black cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tarjeta de Estado de Evento */}
            <div className="my-3 shrink-0">
              {activeEvent ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <span className="shrink-0 text-sm">📍</span>
                  <span className="truncate">Evento: <strong className="font-bold">{activeEvent.name}</strong></span>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Sin evento activo</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('eventos'); setIsMenuOpen(false); }}
                    className="min-h-[36px] px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors flex items-center justify-center"
                  >
                    Activar
                  </button>
                </div>
              )}
            </div>

            {/* Lista Vertical de Navegación */}
            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 py-1">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id;
                const TabIcon = TAB_ICONS[tab.id] || ShoppingBag;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                    className={`min-h-[48px] w-full rounded-xl flex items-center justify-between px-3 text-sm font-bold transition-all cursor-pointer ${
                      isActive ? 'bg-black text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <TabIcon className="w-5 h-5 shrink-0" />
                      <span>{tab.label}</span>
                    </div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-white/70' : 'text-neutral-400'}`} />
                  </button>
                );
              })}
            </div>

            {/* Pie del Drawer con Detalle de Usuario y Roles */}
            {user && (
              <div className="pt-3 border-t border-neutral-200 mt-auto space-y-3 shrink-0">
                <div className="flex items-center gap-3">
                  {renderAvatar('w-10 h-10', 'text-sm')}
                  <div className="flex flex-col items-start leading-tight min-w-0">
                    <span className="text-sm font-bold text-neutral-900 truncate max-w-[200px]">
                      {user.fullName}
                    </span>
                    <span className="text-[11px] text-neutral-500 font-mono truncate max-w-[200px] mt-0.5 flex items-center gap-1">
                      <Mail className="w-3 h-3 text-neutral-400 shrink-0" />
                      {user.email}
                    </span>
                  </div>
                </div>

                {/* Badges de Roles Asignados */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {getRoleBadges().map((roleLabel) => (
                    <span
                      key={roleLabel}
                      className="bg-black text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-neutral-800 leading-none"
                    >
                      {roleLabel}
                    </span>
                  ))}
                </div>

                {/* Botón Logout */}
                <button
                  type="button"
                  onClick={() => { setIsMenuOpen(false); logout(); }}
                  className="min-h-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Cerrar Sesión</span>
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </header>
  );
}
