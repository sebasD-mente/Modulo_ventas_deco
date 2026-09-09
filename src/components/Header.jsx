import React from 'react';
import { Sparkles, Calendar, TrendingUp, DollarSign, Store, ShoppingBag, PieChart, ShieldCheck, Tv } from 'lucide-react';

export default function Header({ activeEvent, activeTab, setActiveTab, liveMetrics }) {
  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-slate-800/80 px-4 py-3 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logotipo y Título de Negocio */}
        <div className="flex items-center justify-between w-full md:w-auto gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-600 via-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ShoppingBag className="w-5 h-5 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-widest text-amber-500 uppercase">Deko Labs • SaaS</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">v1.0 Pro</span>
              </div>
              <h1 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                {activeEvent?.tenant?.name || 'Deco Vintage Guate'}
              </h1>
            </div>
          </div>

          {/* Badge En Vivo y Total Vendido en Móvil */}
          <div className="flex md:hidden items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              <span className="live-indicator"></span>
              <span>EN VIVO</span>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-400 uppercase font-semibold">Ventas Hoy</div>
              <div className="text-sm font-bold text-emerald-400">Q {liveMetrics?.totalAmount ? liveMetrics.totalAmount.toFixed(2) : '0.00'}</div>
            </div>
          </div>
        </div>

        {/* Info Evento Activo y Métricas en Desktop */}
        <div className="hidden md:flex items-center gap-4 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-xl">
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span className="font-semibold text-slate-200">{activeEvent?.name || 'Cargando Evento...'}</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="live-indicator"></span>
            <span>EN VIVO</span>
          </div>
          <div className="h-4 w-px bg-slate-700"></div>
          <div className="text-sm">
            <span className="text-slate-400 mr-1.5">Acumulado:</span>
            <span className="font-bold text-emerald-400">Q {liveMetrics?.totalAmount ? liveMetrics.totalAmount.toFixed(2) : '0.00'}</span>
            <span className="text-slate-500 text-xs ml-1">({liveMetrics?.totalTransactions || 0} ventas)</span>
          </div>
        </div>

        {/* Selector de Pestañas de Navegación Principal */}
        <nav className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 w-full md:w-auto overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('venta')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'venta'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Nueva Venta</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('eventos')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'eventos'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Eventos</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('monitor')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'monitor'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Monitor</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('cierre')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'cierre'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Cierre de Caja</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
