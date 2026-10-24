import React from 'react';
import { MapPin, User, Mail, Play, Eye, Archive, RotateCcw, Trash2, Pencil, Users, Receipt } from 'lucide-react';

function SellersSection({ event }) {
  const hasRelationalArray = Array.isArray(event.assignedSellers);
  const sellers = hasRelationalArray ? event.assignedSellers : [];
  if (sellers.length > 0) {
    return (
      <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800/90 flex items-center justify-between gap-2 text-xs">
        <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
          <Users className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Vendedores ({sellers.length}):</span>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1 max-h-16 overflow-y-auto no-scrollbar">
          {sellers.map((s) => (
            <div
              key={s.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-black border border-neutral-800 text-[11px] font-semibold text-neutral-200"
              title={`${s.fullName} (${s.email})`}
            >
              {s.avatarUrl ? (
                <img src={s.avatarUrl} alt={s.fullName} className="w-3.5 h-3.5 rounded-full object-cover shrink-0" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-neutral-800 text-[8px] font-black text-white flex items-center justify-center shrink-0">
                  {s.fullName?.[0] || 'U'}
                </span>
              )}
              <span className="truncate max-w-[100px]">{s.fullName?.split(' ')[0] || s.fullName}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hasRelationalArray && (event.assignedSellerName || event.assignedSellerEmail)) {
    return (
      <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800/90 flex items-center justify-between gap-2 text-xs">
        <div className="font-semibold text-neutral-200 flex items-center gap-1.5 truncate">
          <User className="w-3 h-3 text-white shrink-0" />
          <span className="truncate">{event.assignedSellerName || 'Vendedor Stand'}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-neutral-400 font-mono truncate">
          <Mail className="w-3 h-3 text-neutral-500 shrink-0" />
          <span className="truncate">{event.assignedSellerEmail}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2.5 py-1 rounded-xl bg-[#161616] border border-neutral-800/80 text-[11px] text-neutral-500 italic">
      Sin vendedores asignados
    </div>
  );
}

function RentHealthPill({ financials }) {
  if (!financials || !(financials.standRentCost > 0)) return null;
  const isHealthy = financials.standRentRatioPct > 0 && financials.standRentRatioPct <= 20;
  const isCovered = financials.preProductionBalance >= 0;

  return (
    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold text-center border truncate ${
      isHealthy
        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        : isCovered
          ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          : 'bg-red-500/10 border-red-500/30 text-red-400'
    }`}>
      {isHealthy
        ? `🟢 Arriendo: ${financials.standRentRatioPct}% (≤20% Saludable)`
        : isCovered
          ? `🟡 Arriendo: ${financials.standRentRatioPct}% (Meta: Q${financials.healthySalesTarget20Pct})`
          : `🔴 Recuperando gastos (Faltan Q${financials.remainingForExpenseRecovery})`}
    </div>
  );
}

function UnifiedMetricsStrip({ event, soldLabel = 'Total Vendido' }) {
  const totalSold = Number(event.totalSold || 0);
  const salesCount = Number(event.salesCount || 0);
  const financials = event.financials;
  const hasFinancials = Boolean(financials && (financials.totalExpenses > 0 || financials.cumulativeSold > 0 || totalSold > 0));
  const totalExpenses = Number(financials?.totalExpenses || 0);
  const preProdBalance = financials?.preProductionBalance !== undefined
    ? Number(financials.preProductionBalance)
    : totalSold - totalExpenses;

  return (
    <div className="space-y-1.5">
      <div className={`grid ${hasFinancials ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'} gap-1.5 text-center`}>
        <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800 flex flex-col justify-center">
          <span className="text-[9px] text-neutral-400 font-semibold uppercase truncate">{soldLabel}</span>
          <span className="text-xs sm:text-sm font-black text-emerald-400 font-mono whitespace-nowrap">Q {totalSold.toFixed(2)}</span>
        </div>
        <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800 flex flex-col justify-center">
          <span className="text-[9px] text-neutral-400 font-semibold uppercase truncate">Transacciones</span>
          <span className="text-xs sm:text-sm font-black text-white font-mono whitespace-nowrap">{salesCount}</span>
        </div>
        {hasFinancials && (
          <>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800 flex flex-col justify-center">
              <span className="text-[9px] text-neutral-400 font-semibold uppercase truncate">Gastos Stand</span>
              <span className="text-xs sm:text-sm font-bold text-red-400 font-mono whitespace-nowrap">Q {totalExpenses.toFixed(2)}</span>
            </div>
            <div className="px-2.5 py-1.5 rounded-xl bg-[#161616] border border-neutral-800 flex flex-col justify-center">
              <span className="text-[9px] text-neutral-400 font-semibold uppercase truncate">Balance Pre-Prod</span>
              <span className={`text-xs sm:text-sm font-bold font-mono whitespace-nowrap ${preProdBalance >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {preProdBalance >= 0 ? '+Q ' : '-Q '}
                {Math.abs(preProdBalance).toFixed(2)}
              </span>
            </div>
          </>
        )}
      </div>
      <RentHealthPill financials={financials} />
    </div>
  );
}

export const formatEventDate = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-GT', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function EventCard({
  event,
  statusType,
  onActivate,
  onViewSales,
  onArchive,
  onUnarchive,
  onDelete,
  onEdit,
  onManageExpenses,
}) {
  const type = statusType || event.status;

  if (type === 'ACTIVO') {
    return (
      <div className="p-3.5 rounded-2xl bg-black border-2 border-emerald-500/70 shadow-lg space-y-2.5 relative overflow-hidden">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm sm:text-base text-white truncate">{event.name}</h4>
              <span className="px-2 py-0.5 rounded-full border border-emerald-500 bg-white text-emerald-700 font-extrabold text-[9px] uppercase tracking-wider inline-flex items-center gap-1 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> EN CURSO
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
              <MapPin className="w-3 h-3 text-neutral-400 shrink-0" /> <span className="truncate">{event.location}</span>
            </div>
          </div>
          <span className="text-[10px] sm:text-[11px] text-neutral-400 font-mono whitespace-nowrap shrink-0">
            {formatEventDate(event.startDate)} - {formatEventDate(event.endDate)}
          </span>
        </div>

        <SellersSection event={event} />
        <UnifiedMetricsStrip event={event} soldLabel="Total Vendido" />

        <div className="pt-1 flex items-center gap-1.5">
          <button type="button" onClick={() => onViewSales?.(event)} className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-1.5 transition-transform active:scale-95 cursor-pointer shadow-sm min-h-[44px]">
            <Eye className="w-4 h-4 shrink-0" /> <span>Ventas ({event.salesCount || 0})</span>
          </button>
          {onManageExpenses && (
            <button type="button" onClick={() => onManageExpenses(event)} className="py-2 px-3 rounded-xl bg-[#1a1a1a] hover:bg-neutral-800 text-amber-300 hover:text-amber-200 border border-amber-500/30 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer min-h-[44px]" title="Gestionar gastos del stand">
              <Receipt className="w-3.5 h-3.5 text-amber-400 shrink-0" /> <span className="hidden sm:inline">Gastos</span>
            </button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(event)} className="p-2 rounded-xl bg-[#1a1a1a] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]" title="Editar evento">
              <Pencil className="w-3.5 h-3.5 text-amber-400" />
            </button>
          )}
          <button type="button" onClick={() => onArchive?.(event)} className="p-2 rounded-xl bg-[#1a1a1a] hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 border border-neutral-800 flex items-center justify-center transition-colors cursor-pointer min-h-[44px] min-w-[44px]" title="Archivar evento">
            <Archive className="w-3.5 h-3.5" />
          </button>
          {onDelete && (
            <button type="button" onClick={() => onDelete?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 cursor-pointer transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" title="Eliminar evento">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (type === 'ARCHIVADO') {
    return (
      <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-sm text-neutral-200 truncate">{event.name}</h4>
              <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] uppercase tracking-wider inline-flex items-center gap-1 shrink-0">
                <Archive className="w-2.5 h-2.5" /> ARCHIVADO
              </span>
            </div>
            <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-neutral-500 shrink-0" /> <span className="truncate">{event.location}</span>
            </p>
          </div>
          <span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap shrink-0">
            {formatEventDate(event.startDate)} - {formatEventDate(event.endDate)}
          </span>
        </div>

        <SellersSection event={event} />
        <UnifiedMetricsStrip event={event} soldLabel="Total Facturado" />

        <div className="pt-1.5 border-t border-neutral-800/80 flex items-center gap-1.5">
          <button type="button" onClick={() => onViewSales?.(event)} className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer min-h-[44px]">
            <Eye className="w-3.5 h-3.5 shrink-0" /> <span>Ventas ({event.salesCount || 0})</span>
          </button>
          {onManageExpenses && (
            <button type="button" onClick={() => onManageExpenses(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-amber-400 border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Historial de gastos"><Receipt className="w-3.5 h-3.5" /></button>
          )}
          {onEdit && (
            <button type="button" onClick={() => onEdit(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Editar evento"><Pencil className="w-3.5 h-3.5 text-amber-400" /></button>
          )}
          <button type="button" onClick={() => onUnarchive?.(event)} className="py-2 px-3 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer min-h-[44px]" title="Restaurar a confirmados">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" /> <span className="hidden sm:inline">Restaurar</span>
          </button>
          <button type="button" onClick={() => onDelete?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-500 hover:text-red-400 border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-bold text-sm text-white truncate">{event.name}</h4>
            <span className="px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-[9px] uppercase tracking-wider shrink-0">
              CONFIRMADO
            </span>
          </div>
          <p className="text-xs text-neutral-400 flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-neutral-400 shrink-0" /> <span className="truncate">{event.location}</span>
          </p>
        </div>
        <span className="text-[10px] text-neutral-400 font-mono whitespace-nowrap shrink-0">{formatEventDate(event.startDate)}</span>
      </div>

      <SellersSection event={event} />
      {event.financials && (event.financials.totalExpenses > 0 || event.financials.cumulativeSold > 0) && (
        <UnifiedMetricsStrip event={event} soldLabel="Total Vendido" />
      )}

      <div className="pt-1.5 border-t border-neutral-800/80 flex items-center gap-1.5">
        <button type="button" onClick={() => onActivate?.(event)} className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer min-h-[44px]">
          <Play className="w-3.5 h-3.5 fill-current shrink-0" /> <span>Activar</span>
        </button>
        {onManageExpenses && (
          <button type="button" onClick={() => onManageExpenses(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-amber-400 border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Presupuesto y gastos"><Receipt className="w-3.5 h-3.5" /></button>
        )}
        {onEdit && (
          <button type="button" onClick={() => onEdit(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center transition-colors" title="Editar evento">
            <Pencil className="w-3.5 h-3.5 text-amber-400" />
          </button>
        )}
        <button type="button" onClick={() => onViewSales?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Historial"><Eye className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => onArchive?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Archivar"><Archive className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => onDelete?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
