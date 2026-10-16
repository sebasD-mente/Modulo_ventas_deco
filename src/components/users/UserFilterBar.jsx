import React from 'react';
import { Users, UserPlus, RefreshCw, Search } from 'lucide-react';

export default function UserFilterBar({
  onOpenCreate, onRefresh, isLoading, searchTerm, onSearchChange, roleFilter, onRoleFilterChange, roleDefinitions = [],
}) {
  return (
    <div className="space-y-4 border-b border-neutral-800 pb-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-emerald-400 shadow-inner shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Gestión de Usuarios & Multi-Roles
              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800">SUPER ADMIN</span>
            </h2>
            <p className="text-xs text-neutral-400">Autorización y asignación de permisos para cuentas de Google</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={onOpenCreate} className="min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all cursor-pointer shadow-lg shadow-emerald-500/10 active:scale-95">
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">Registrar Empleado</span>
            <span className="sm:hidden">Nuevo</span>
          </button>
          <button type="button" onClick={onRefresh} title="Refrescar lista" className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-400 hover:text-white transition-all cursor-pointer">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text" placeholder="Buscar por nombre o correo..." value={searchTerm} onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[44px] bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 shadow-inner"
          />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button" onClick={() => onRoleFilterChange('ALL')}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${roleFilter === 'ALL' ? 'bg-white text-black border-white shadow-sm' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
          >
            Todos
          </button>
          {roleDefinitions.map((rd) => (
            <button
              key={rd.key} type="button" onClick={() => onRoleFilterChange(roleFilter === rd.key ? 'ALL' : rd.key)}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap flex items-center justify-center ${roleFilter === rd.key ? rd.activeClass : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:border-neutral-700'}`}
            >
              {rd.label.split(' ')[1] || rd.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}