import React from 'react';

const ACTIVE_SUBTABS = [
  { id: 'COLA_ACTIVA', label: 'Todos Activos', getCount: (m) => (m.pending ?? 0) + (m.inProduction ?? 0) },
  { id: 'PENDIENTE', label: 'Pendientes (Stock)', getCount: (m) => m.pending ?? 0 },
  { id: 'A_PRODUCCION', label: 'Por Imprimir (Taller)', getCount: (m) => m.inProduction ?? 0 },
];

const ARCHIVE_SUBTABS = [
  { id: 'ARCHIVO_OP1', label: 'Todos Resueltos', getCount: (m) => (m.separated ?? 0) + (m.inProduction ?? 0) + (m.printed ?? 0) },
  { id: 'SEPARADO', label: 'Separados (Stock)', getCount: (m) => m.separated ?? 0 },
  { id: 'A_PRODUCCION', label: 'Enviados a Impresión', getCount: (m) => m.inProduction ?? 0 },
  { id: 'IMPRESO', label: 'Impresos (Taller)', getCount: (m) => m.printed ?? 0 },
];

export default function ProductionFilterTabs({
  statusFilter,
  setStatusFilter,
  metrics = {},
  isOp2Only,
  isOp1Only = false,
  queueBucket = 'ACTIVE',
}) {
  if (isOp2Only) return null;
  if (isOp1Only && queueBucket === 'ACTIVE') return null;

  const tabs = queueBucket === 'ARCHIVE' ? ARCHIVE_SUBTABS : ACTIVE_SUBTABS;

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
      {tabs.map((tab) => {
        const active = statusFilter === tab.id;
        const count = tab.getCount(metrics);
        const label = `${tab.label} (${count})`;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            aria-pressed={active}
            className={`min-h-[44px] px-4 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center justify-center shrink-0 ${
              active
                ? 'bg-white text-black shadow-sm'
                : 'bg-black border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
