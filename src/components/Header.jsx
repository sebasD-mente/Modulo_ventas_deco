import React from 'react';

export default function Header({ activeEvent, activeTab, setActiveTab }) {
  const navTabs = [
    { id: 'venta', label: 'Nueva venta' },
    { id: 'eventos', label: 'Eventos' },
    { id: 'monitor', label: 'Monitor' },
    { id: 'cierre', label: 'Cierre de caja' },
  ];

  return (
    <header className="bg-white border-b border-neutral-200 text-black sticky top-0 z-40 px-3 py-2 sm:py-2.5 sm:px-6 select-none shadow-sm">
      <div className="max-w-4xl mx-auto flex flex-col items-center gap-1.5 sm:gap-2">
        {/* Logotipo Superior STAND {IA} Centrado y Compacto */}
        <div className="flex items-center justify-center">
          <img
            src="/brand/logo-header.png"
            alt="STAND {IA}"
            className="h-6 sm:h-7 object-contain"
          />
        </div>

        {/* Fila de Navegación de Pestañas Centrada y Adaptable */}
        <nav className="flex items-center justify-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
          {navTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-black text-white px-4 py-1.5 sm:px-5 sm:py-2 rounded-full shadow-sm'
                    : 'text-black hover:opacity-60 px-2.5 py-1.5 sm:px-3.5 sm:py-2'
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
