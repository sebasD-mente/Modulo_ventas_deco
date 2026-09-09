import React from 'react';
import { Calendar } from 'lucide-react';

export default function Header({ activeEvent, activeTab, setActiveTab, liveMetrics }) {
  const navTabs = [
    { id: 'venta', label: 'Nueva venta' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'monitor', label: 'Monitor' },
    { id: 'cierre', label: 'Cierre de caja' },
  ];

  return (
    <header className="bg-white border-b border-neutral-200 text-black sticky top-0 z-40 px-4 pt-4 pb-3 sm:px-8 select-none shadow-sm">
      <div className="max-w-5xl mx-auto flex flex-col items-center gap-3">
        {/* Logotipo Superior STAND {IA} Centrado */}
        <div className="flex items-center justify-center">
          <img
            src="/brand/logo-header.png"
            alt="STAND {IA}"
            className="h-9 sm:h-11 object-contain"
          />
        </div>

        {/* Fila de Navegación de Pestañas y Estado */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3 pt-0.5">
          {/* Tabs estilo mockup */}
          <nav className="flex items-center justify-center gap-2 sm:gap-3 flex-wrap">
            {navTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? 'bg-black text-white px-5 py-2 rounded-full shadow-sm'
                      : 'text-black hover:opacity-60 px-3 py-2'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* Estado del Evento y Total Acumulado */}
          <div className="flex items-center gap-2.5 text-xs">
            <div className="hidden sm:flex items-center gap-1.5 text-neutral-600 bg-neutral-100 px-3 py-1.5 rounded-full border border-neutral-200">
              <Calendar className="w-3.5 h-3.5 text-neutral-700" />
              <span className="font-semibold truncate max-w-[150px]">{activeEvent?.name || 'Evento Stand'}</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-900 font-bold">
              <span className="live-indicator"></span>
              <span>Q {liveMetrics?.totalAmount ? liveMetrics.totalAmount.toFixed(2) : '0.00'}</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
