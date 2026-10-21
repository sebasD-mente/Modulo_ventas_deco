import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LogOut, Menu, X, ShoppingBag, Calendar, Activity,
  Package, Clock, Wallet, Users, Percent, ChevronRight,
  AlertCircle, Mail, ChevronDown, Check,
} from 'lucide-react';

const TAB_ICONS = {
  venta: ShoppingBag, eventos: Calendar, monitor: Activity, produccion: Package,
  seguimiento: Clock, cierre: Wallet, usuarios: Users, comisiones: Percent,
};

export default function Header({
  activeEvent, activeEventsList = [], onSelectEvent, activeTab, setActiveTab,
}) {
  const { user, logout, isSuperAdmin, isVendedor, isVendedorRedes, isOperario1, isOperario2 } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isStandSelectorOpen, setIsStandSelectorOpen] = useState(false);
  const standSelectorRef = useRef(null);

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsStandSelectorOpen(false);
      }
    };
    const handleClickOutside = (e) => {
      if (standSelectorRef.current && !standSelectorRef.current.contains(e.target)) {
        setIsStandSelectorOpen(false);
      }
    };
    if (isMenuOpen || isStandSelectorOpen) window.addEventListener('keydown', handleKeyDown);
    if (isStandSelectorOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen, isStandSelectorOpen]);

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
    if (isOperario1 && isOperario2) tabMap.set('produccion', { id: 'produccion', label: 'Producción' });
    else if (isOperario1) tabMap.set('produccion', { id: 'produccion', label: 'Producción & Stock' });
    else if (isOperario2) tabMap.set('produccion', { id: 'produccion', label: 'Taller de Impresión' });
    tabMap.set('seguimiento', { id: 'seguimiento', label: 'Seguimiento' });
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
    return list.length === 0 ? [user?.role || 'VENDEDOR'] : list;
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

  const isOnlinePointOfSale = (ev) => Boolean(
    !ev ||
    ev.id === 'evt-ventas-redes-online' ||
    ev.name?.toLowerCase().includes('redes') ||
    ev.name?.toLowerCase().includes('ventas en línea')
  );

  const ferialStandsList = activeEventsList.filter((ev) => !isOnlinePointOfSale(ev));

  return (
    <header className="bg-white border-b border-neutral-200 text-black sticky top-0 z-40 px-3 py-2 sm:py-2.5 sm:px-6 select-none shadow-sm">
      <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
        <button
          type="button" onClick={() => setIsMenuOpen((prev) => !prev)} aria-label="Abrir menú"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black cursor-pointer transition-colors shrink-0"
        >
          {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <div className="flex flex-col items-center justify-center shrink-0">
          <img src="/brand/logo-header.png" alt="STAND {IA}" className="h-6 sm:h-7 object-contain" />
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest leading-tight mt-0.5">{currentTab.label}</span>
        </div>

        <div className="flex items-center gap-2">
          {isVendedorRedes && !isSuperAdmin && !isVendedor ? (
            <div
              data-testid="header-online-pos-badge"
              className="min-h-[44px] px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 text-xs font-bold flex items-center gap-1.5"
              title="Punto de Venta Digital Permanente"
            >
              <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse shrink-0" />
              <span className="truncate">📱 Redes / Online</span>
            </div>
          ) : (activeEvent && !isOnlinePointOfSale(activeEvent)) ? (
            <div className="relative" ref={standSelectorRef}>
              {isSuperAdmin && ferialStandsList.length > 1 ? (
                <div>
                  <button
                    type="button"
                    data-testid="header-stand-selector-btn"
                    onClick={() => setIsStandSelectorOpen((p) => !p)}
                    className="min-h-[44px] px-2.5 py-1 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-300 text-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer max-w-[130px] sm:max-w-[180px]"
                    title="Cambiar stand activo"
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                    <span className="truncate">{activeEvent.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                  </button>
                  {isStandSelectorOpen && (
                    <div
                      data-testid="header-stand-selector-menu"
                      className="absolute right-0 mt-1 w-56 bg-white border border-neutral-200 rounded-2xl shadow-2xl p-1.5 z-50 animate-in fade-in duration-150"
                    >
                      <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider px-2 py-1 block">Stands ({ferialStandsList.length})</span>
                      <div className="space-y-1">
                        {ferialStandsList.map((ev) => (
                          <button
                            key={ev.id} type="button"
                            onClick={() => { onSelectEvent?.(ev); setIsStandSelectorOpen(false); }}
                            className={`w-full min-h-[40px] px-2.5 py-1.5 rounded-xl text-xs font-bold text-left flex items-center justify-between transition-colors ${activeEvent.id === ev.id ? 'bg-black text-white' : 'hover:bg-neutral-100 text-neutral-800'}`}
                          >
                            <span className="truncate">{ev.name}</span>
                            {activeEvent.id === ev.id && <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="min-h-[44px] px-2.5 py-1 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-800 text-xs font-semibold flex items-center gap-1.5 max-w-[120px] sm:max-w-[160px]" title={activeEvent.name}>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="truncate">{activeEvent.name}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="min-w-[44px] min-h-[44px]" />
          )}
        </div>
      </div>

      {isMenuOpen && (
        <div>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setIsMenuOpen(false)} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 w-full max-w-xs sm:max-w-sm bg-white text-black shadow-2xl flex flex-col p-4 animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 shrink-0">
              <img src="/brand/logo-header.png" alt="STAND {IA}" className="h-6 object-contain" />
              <button type="button" onClick={() => setIsMenuOpen(false)} aria-label="Cerrar menú" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-neutral-100 text-neutral-600 hover:text-black cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="my-3 shrink-0">
              {isVendedorRedes && !isSuperAdmin && !isVendedor ? (
                <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 flex items-center gap-2 text-xs font-semibold text-purple-900">
                  <span className="shrink-0 text-sm">📱</span>
                  <span className="truncate">Punto de Venta: <strong className="font-bold">Redes / Online</strong></span>
                </div>
              ) : (activeEvent && !isOnlinePointOfSale(activeEvent)) ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-xs font-semibold text-emerald-900">
                  <span className="shrink-0 text-sm">📍</span>
                  <span className="truncate">Stand: <strong className="font-bold">{activeEvent.name}</strong></span>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 flex items-center justify-between text-xs text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold"><AlertCircle className="w-4 h-4 text-amber-600 shrink-0" /><span>Sin stand activo</span></div>
                  <button type="button" onClick={() => { setActiveTab('eventos'); setIsMenuOpen(false); }} className="min-h-[36px] px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs cursor-pointer flex items-center justify-center">Activar</button>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-1.5 py-1">
              {navTabs.map((tab) => {
                const isActive = activeTab === tab.id, TabIcon = TAB_ICONS[tab.id] || ShoppingBag;
                return (
                  <button
                    key={tab.id} type="button" onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                    className={`min-h-[44px] w-full rounded-xl flex items-center justify-between px-3 text-sm font-bold transition-all cursor-pointer ${isActive ? 'bg-black text-white shadow-sm' : 'text-neutral-700 hover:bg-neutral-100'}`}
                  >
                    <div className="flex items-center gap-3"><TabIcon className="w-5 h-5 shrink-0" /><span>{tab.label}</span></div>
                    <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-white/70' : 'text-neutral-400'}`} />
                  </button>
                );
              })}
            </div>

            {user && (
              <div className="pt-3 border-t border-neutral-200 mt-auto space-y-3 shrink-0">
                <div className="flex items-center gap-3">
                  {renderAvatar('w-10 h-10', 'text-sm')}
                  <div className="flex flex-col items-start leading-tight min-w-0">
                    <span className="text-sm font-bold text-neutral-900 truncate max-w-[200px]">{user.fullName}</span>
                    <span className="text-[11px] text-neutral-500 font-mono truncate max-w-[200px] mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3 text-neutral-400 shrink-0" />{user.email}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {getRoleBadges().map((roleLabel) => (
                    <span key={roleLabel} className="bg-black text-white text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md border border-neutral-800 leading-none">{roleLabel}</span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setIsMenuOpen(false); logout(); }}
                  aria-label="Cerrar Sesión"
                  title="Cerrar Sesión"
                  className="min-h-[44px] min-w-[44px] w-full flex items-center justify-center gap-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors cursor-pointer"
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
