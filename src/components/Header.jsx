import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, Shield, User } from 'lucide-react';

export default function Header({ activeEvent, activeTab, setActiveTab }) {
  const { user, logout, isSuperAdmin, isVendedor, isOperario1, isOperario2 } = useAuth();

  // Configuración de pestañas permitidas por roles aditivos
  let navTabs = [];

  if (isSuperAdmin) {
    navTabs = [
      { id: 'venta', label: 'Nueva venta' },
      { id: 'eventos', label: 'Eventos' },
      { id: 'monitor', label: 'Monitor' },
      { id: 'produccion', label: 'Producción' },
      { id: 'cierre', label: 'Cierre' },
      { id: 'usuarios', label: 'Usuarios' },
    ];
  } else {
    const tabMap = new Map();

    if (isVendedor) {
      tabMap.set('venta', { id: 'venta', label: 'Nueva venta' });
      tabMap.set('monitor', { id: 'monitor', label: 'Monitor' });
    }

    if (isOperario1 && isOperario2) {
      tabMap.set('produccion', { id: 'produccion', label: 'Producción' });
    } else if (isOperario1) {
      tabMap.set('produccion', { id: 'produccion', label: 'Producción & Stock' });
    } else if (isOperario2) {
      tabMap.set('produccion', { id: 'produccion', label: 'Taller de Impresión' });
    }

    if (isVendedor) {
      tabMap.set('cierre', { id: 'cierre', label: 'Cierre de caja' });
    }

    navTabs = Array.from(tabMap.values());
    if (navTabs.length === 0) {
      navTabs = [{ id: 'venta', label: 'Terminal de Ventas' }];
    }
  }

  const roleBadgeText = isSuperAdmin
    ? '👑 SUPER ADMIN'
    : (user?.roles && user.roles.length > 0 ? user.roles : [user?.role || 'VENDEDOR'])
        .map((r) => {
          if (r === 'VENDEDOR') return '💼 VENDEDOR';
          if (r === 'OPERARIO_1') return '👷 STOCK';
          if (r === 'OPERARIO_2') return '🖨️ TALLER';
          return r;
        })
        .join(' + ');

  return (
    <header className="bg-white border-b border-neutral-200 text-black sticky top-0 z-40 px-3 py-2 sm:py-2.5 sm:px-6 select-none shadow-sm">
      <div className="max-w-4xl mx-auto flex flex-col gap-1.5 sm:gap-2">
        {/* Barra Superior con Logo y Perfil de Usuario */}
        <div className="flex items-center justify-between">
          {/* Espaciador izquierdo para centrar el logo en desktop */}
          <div className="w-16 sm:w-28 hidden sm:block"></div>

          {/* Logotipo STAND {IA} Centrado */}
          <div className="flex items-center justify-center flex-1 sm:flex-initial">
            <img
              src="/brand/logo-header.png"
              alt="STAND {IA}"
              className="h-6 sm:h-7 object-contain"
            />
          </div>

          {/* Perfil de Usuario y Logout */}
          <div className="flex items-center gap-2">
            {user && (
              <div className="flex items-center gap-2 bg-neutral-100 border border-neutral-300/80 rounded-full py-1 px-2 sm:px-3">
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-5 h-5 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                    {user.fullName?.[0] || 'U'}
                  </div>
                )}
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-[11px] font-bold leading-tight truncate max-w-[100px]">
                    {user.fullName}
                  </span>
                  <span className="text-[9px] font-black text-emerald-700 tracking-wider">
                    {roleBadgeText}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  title="Cerrar Sesión"
                  className="p-1 hover:bg-neutral-200 rounded-full transition-all text-neutral-600 hover:text-black cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Fila de Navegación de Pestañas Centrada y Adaptable */}
        <nav className="flex items-center justify-center gap-1 sm:gap-1.5 overflow-x-auto no-scrollbar max-w-full">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-black text-white px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full shadow-sm'
                    : 'text-black hover:opacity-60 px-2.5 py-1.5 sm:px-3 sm:py-2'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
