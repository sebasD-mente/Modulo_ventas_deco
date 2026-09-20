import React, { useState } from 'react';
import { Layers, Eye, Plus, Factory, CheckCircle2, Check, Clock, Loader2 } from 'lucide-react';

const STATUS_CONFIG = {
  ABIERTO: {
    label: 'Abierto',
    bg: 'bg-amber-950/60',
    border: 'border-amber-800',
    text: 'text-amber-400',
  },
  EN_PRODUCCION: {
    label: 'En Producción',
    bg: 'bg-cyan-950/60',
    border: 'border-cyan-800',
    text: 'text-cyan-400',
  },
  IMPRESO: {
    label: 'Impreso',
    bg: 'bg-emerald-950/60',
    border: 'border-emerald-800',
    text: 'text-emerald-400',
  },
  TERMINADO: {
    label: 'Terminado',
    bg: 'bg-neutral-900',
    border: 'border-neutral-700',
    text: 'text-neutral-400',
  },
};

const MATERIAL_LABELS = {
  PVC_5MM: 'PVC 5mm',
  MDF_5_5MM: 'MDF 5.5mm',
  VINILO_SOLO: 'Vinilo Solo',
  MIXTO: 'Mixto',
};

export default function PrintSheetCard({
  sheet,
  onOpenDetail,
  onOpenAssign,
  onUpdateStatus,
  isUpdating = false,
}) {
  const [confirmingStatus, setConfirmingStatus] = useState(null);

  const statusStyle = STATUS_CONFIG[sheet.status] || STATUS_CONFIG.ABIERTO;
  const itemCount = sheet._count?.items ?? (Array.isArray(sheet.items) ? sheet.items.length : 0);
  const formattedDate = sheet.createdAt
    ? new Date(sheet.createdAt).toLocaleDateString('es-GT', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const handleStatusChange = async (newStatus) => {
    try {
      await onUpdateStatus(sheet.id, newStatus);
      setConfirmingStatus(null);
    } catch (err) {
      console.error('Error updating status from card:', err);
    }
  };

  const canAssign = sheet.status === 'ABIERTO' || sheet.status === 'EN_PRODUCCION';

  return (
    <div className="bg-black border border-neutral-800 hover:border-neutral-700 rounded-3xl p-4 sm:p-5 transition-all space-y-3.5 shadow-md">
      {/* Top row: SheetCode, Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <span className="font-mono font-bold text-sm sm:text-base text-white tracking-tight">
              {sheet.sheetCode}
            </span>
            <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-0.5">
              <Clock className="w-3 h-3 text-neutral-500" />
              <span>{formattedDate}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
            {MATERIAL_LABELS[sheet.material] || sheet.material}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${statusStyle.bg} ${statusStyle.border} ${statusStyle.text}`}>
            {statusStyle.label}
          </span>
        </div>
      </div>

      {/* Middle row: Stats and Notes preview */}
      <div className="flex items-center justify-between gap-3 text-xs border-y border-neutral-800/80 py-2.5 px-1">
        <div className="flex items-center gap-2 text-neutral-300">
          <span className="text-neutral-400">Obras Loteadas:</span>
          <span className="font-bold text-white text-sm bg-neutral-900 px-2 py-0.5 rounded-lg border border-neutral-800">
            {itemCount}
          </span>
        </div>
        {sheet.notes && (
          <p className="text-[11px] text-neutral-400 italic truncate max-w-[240px] sm:max-w-xs" title={sheet.notes}>
            "{sheet.notes}"
          </p>
        )}
      </div>

      {/* Action buttons: >= 44x44px touch targets */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={() => onOpenDetail(sheet.id)}
          className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Eye className="w-4 h-4 text-cyan-400" />
          <span>Ver Detalle</span>
        </button>

        <div className="flex items-center gap-2">
          {canAssign && (
            <button
              type="button"
              onClick={() => onOpenAssign(sheet)}
              className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-black hover:bg-neutral-900 border border-neutral-800 hover:border-cyan-400/50 text-cyan-400 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Asignar Obras</span>
            </button>
          )}

          {/* Quick status transition */}
          {confirmingStatus ? (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-700 p-1 rounded-2xl">
              <span className="text-[11px] text-neutral-300 px-1 font-bold">¿Confirmar?</span>
              <button
                type="button"
                onClick={() => handleStatusChange(confirmingStatus)}
                disabled={isUpdating}
                className="min-h-[44px] px-3 py-1.5 rounded-xl bg-cyan-400 text-black text-xs font-black cursor-pointer"
              >
                {isUpdating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Sí'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingStatus(null)}
                disabled={isUpdating}
                className="min-h-[44px] px-2.5 py-1.5 rounded-xl bg-black text-neutral-400 text-xs cursor-pointer"
              >
                No
              </button>
            </div>
          ) : (
            <>
              {sheet.status === 'ABIERTO' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('EN_PRODUCCION')}
                  disabled={isUpdating}
                  className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-cyan-950/60 hover:bg-cyan-900/80 border border-cyan-800 text-cyan-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Factory className="w-4 h-4" />
                  <span>A Producción</span>
                </button>
              )}

              {sheet.status === 'EN_PRODUCCION' && (
                <button
                  type="button"
                  onClick={() => setConfirmingStatus('IMPRESO')}
                  disabled={isUpdating}
                  className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-800 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Marcar Impreso</span>
                </button>
              )}

              {sheet.status === 'IMPRESO' && (
                <button
                  type="button"
                  onClick={() => handleStatusChange('TERMINADO')}
                  disabled={isUpdating}
                  className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Terminar</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
