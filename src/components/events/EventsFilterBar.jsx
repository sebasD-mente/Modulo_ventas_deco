import React from 'react';
import { Calendar, Plus, Search } from 'lucide-react';

export default function EventsFilterBar({
  onOpenCreateModal, searchQuery, onSearchChange, activeTab, onTabChange, counts,
}) {
  const tabs = [
    { id: 'ALL', label: 'Todos', count: counts?.all },
    { id: 'ACTIVO', label: 'En curso', count: counts?.active },
    { id: 'CONFIRMADO', label: 'Próximos', count: counts?.confirmed },
    { id: 'ARCHIVADO', label: 'Archivados', count: counts?.archived },
  ];

  return (
    <div className="space-y-3 pb-3 border-b border-neutral-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-white" /> Gestión de eventos
          </h3>
          <p className="text-xs text-neutral-400">Control de eventos activos, confirmados, archivados y asignación de vendedores</p>
        </div>
        <button
          type="button" onClick={onOpenCreateModal}
          className="min-h-[44px] px-5 py-2.5 rounded-full bg-white hover:bg-neutral-200 text-black font-black text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-transform active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> <span>Nuevo evento</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
        {onSearchChange && (
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text" placeholder="Buscar por nombre, lugar o vendedor..."
              value={searchQuery || ''} onChange={(e) => onSearchChange(e.target.value)}
              className="w-full min-h-[44px] bg-[#161616] border border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white shadow-inner"
            />
          </div>
        )}
        {onTabChange && (
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t.id} type="button" onClick={() => onTabChange(t.id)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center ${
                  activeTab === t.id ? 'bg-white text-black shadow-sm' : 'bg-[#181818] text-neutral-400 hover:text-white border border-neutral-800'
                }`}
              >
                {t.label} {t.count !== undefined ? `(${t.count})` : ''}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
