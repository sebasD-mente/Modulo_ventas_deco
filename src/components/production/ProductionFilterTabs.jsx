import React from 'react';

const TABS = [
  { id: 'ALL', label: 'Todos', countKey: null },
  { id: 'PENDIENTE', label: 'Pendientes', countKey: 'pending' },
  { id: 'SEPARADO', label: 'Separados', countKey: 'separated' },
  { id: 'A_PRODUCCION', label: 'A Producción', countKey: 'inProduction' },
  { id: 'IMPRESO', label: 'Impresos', countKey: 'printed' },
];

export default function ProductionFilterTabs({ statusFilter, setStatusFilter, metrics = {}, isOp2Only }) {
  if (isOp2Only) return null;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
      {TABS.map((tab) => {
        const active = statusFilter === tab.id;
        const count = tab.countKey ? metrics[tab.countKey] ?? 0 : null;
        const label = count !== null ? `${tab.label} (${count})` : tab.label;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              active
                ? 'bg-white text-black shadow-sm'
                : 'bg-black border border-neutral-800 text-neutral-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
