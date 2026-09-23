import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut } from 'lucide-react';

export default function Header({ activeEvent, activeTab, setActiveTab }) {
  const { user, logout, isSuperAdmin, isVendedor, isVendedorRedes, isOperario1, isOperario2 } = useAuth();

  // Configuración de pestañas permitidas por roles aditivos
  let navTabs = [];

  if (isSuperAdmin) {
    navTabs = [
      { id: 'venta', label: 'Nueva venta' },
      { id: 'eventos', label: 'Eventos' },
      { id: 'monitor', label: 'Monitor' },
      { id: 'produccion', label: 'Producción' },
      { id: 'seguimiento', label: 'Seguimiento' },
      { id: 'cierre', label: 'Cierre' },
      { id: 'usuarios', label: 'Usuarios' },
      { id: 'comisiones', label: 'Comisiones' },
    ];
  } else {
    const tabMap = new Map();

    if (isVendedorRedes && !isVendedor) {
      tabMap.set('venta', { id: 'venta', label: 'Pedidos / Venta' });
      tabMap.set('eventos', { id: 'eventos', label: 'Punto de Venta' });
      if (!isOperario1 && !isOperario2) {
        tabMap.set('produccion', { id: 'produccion', label: 'Mis Pedidos' });
      }
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

    if (isVendedor) {
      tabMap.set('cierre', { id: 'cierre', label: 'Cierre de caja' });
    }

    navTabs = Array.from(tabMap.values());
    if (navTabs.length === 0) {
      navTabs = [{ id: 'venta', label: 'Terminal de Ventas' }];
    }
  }

  const getRoleBadgeConfig = () => {
    if (isSuperAdmin) {
      return { label: '👑 Super Admin', className: 'bg-amber-950/80 text-amber-300 border-amber-600/60' };
    }
    if (isVendedorRedes && !isVendedor) {
      return { label: '📱 Ventas Redes', className: 'bg-cyan-950/80 text-cyan-300 border-cyan-700/60' };
    }
    if (isVendedor) {
      return { label: '💼 Mostrador', className: 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60' };
    }
    if (isOperario1 && isOperario2) {
      return { label: '👷 Producción Total', className: 'bg-neutral-900 text-neutral-200 border-neutral-700' };
    }
    if (isOperario1) {
      return { label: '📦 Stock Taller', className: 'bg-amber-950/80 text-amber-300 border-amber-700/60' };
    }
    if (isOperario2) {
      return { label: '🖨️ Impresión', className: 'bg-blue-950/80 text-blue-300 border-blue-700/60' };
    }
    return { label: user?.role || 'VENDEDOR', className: 'bg-neutral-900 text-neutral-300 border-neutral-700' };
  };
  const roleBadge = getRoleBadgeConfig();

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

          {/* Perfil de Usuario y Logout Discreto */}
          <div className="flex items-center gap-1">
            {user && (
              <div className="flex items-center gap-2 py-1 px-2.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 shadow-xs">
                {/* Avatar */}
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={user.fullName}
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover shrink-0 ring-1 ring-neutral-300"
                  />
                ) : (
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black text-white text-xs font-black flex items-center justify-center shrink-0">
                    {user.fullName?.[0] || 'U'}
                  </div>
                )}
                {/* Nombre y Badge de Rol */}
                <div className="flex flex-col items-start leading-none min-w-0">
                  <span className="text-xs font-bold text-neutral-900 truncate max-w-[100px] sm:max-w-[130px]">
                    {user.fullName?.trim().split(' ')[0] || user.fullName}
                  </span>
                  <span className={`inline-flex items-center mt-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shadow-xs ${roleBadge.className}`}>
                    {roleBadge.label}
                  </span>
                </div>
                {/* Botón Logout */}
                <button
                  type="button"
                  onClick={logout}
                  title="Cerrar Sesión"
                  aria-label="Cerrar Sesión"
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-200 transition-colors p-2 text-neutral-400 hover:text-black cursor-pointer shrink-0 ml-1"
                >
                  <LogOut className="w-4 h-4" />
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
                className={`min-h-[44px] flex items-center justify-center px-4 py-2 text-xs sm:text-sm font-bold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-black text-white shadow-sm'
                    : 'text-black hover:opacity-60'
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
