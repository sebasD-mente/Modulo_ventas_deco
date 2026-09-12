import React from 'react';
import { MapPin, User, Mail, Play, Eye, Archive, RotateCcw, Trash2 } from 'lucide-react';

export default function EventCard({ event, statusType, onActivate, onViewSales, onArchive, onUnarchive, onDelete }) {
  const type = statusType || event.status;

  if (type === 'ACTIVO') {
    return (
      <div className="p-4 sm:p-5 rounded-2xl bg-black border-2 border-emerald-500/70 shadow-xl space-y-4 relative overflow-hidden flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full border border-emerald-500 bg-white text-emerald-600 font-extrabold text-[10px] uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> EN CURSO
            </span>
            <span className="text-[11px] text-neutral-400 font-medium">
              {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
            </span>
          </div>
          <div>
            <h4 className="font-bold text-base text-white">{event.name}</h4>
            <div className="flex items-center gap-1.5 text-xs text-neutral-400 mt-1">
              <MapPin className="w-3.5 h-3.5 text-neutral-400 shrink-0" /> <span className="truncate">{event.location}</span>
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[#181818] border border-neutral-800 space-y-1 text-xs">
            <div className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider">Encargado del evento:</div>
            <div className="flex items-center justify-between">
              <div className="font-semibold text-neutral-200 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-white" /> <span>{event.assignedSellerName || 'Vendedor Stand'}</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-neutral-300 font-mono">
                <Mail className="w-3 h-3 text-neutral-400" /> <span>{event.assignedSellerEmail || 'Sin correo asignado'}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="p-2.5 rounded-xl bg-[#181818] border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Total Vendido</span>
              <span className="text-lg font-black text-emerald-400 font-mono">Q {Number(event.totalSold || 0).toFixed(2)}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-[#181818] border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Transacciones</span>
              <span className="text-lg font-black text-white font-mono">{event.salesCount || 0}</span>
            </div>
          </div>
        </div>
        <div className="pt-2 flex items-center gap-2">
          <button type="button" onClick={() => onViewSales?.(event)} className="flex-1 py-2.5 px-4 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer shadow-md">
            <Eye className="w-4 h-4" /> <span>Ver ventas ({event.salesCount || 0})</span>
          </button>
          <button type="button" onClick={() => onArchive?.(event)} className="py-2.5 px-3 rounded-xl bg-[#1a1a1a] hover:bg-neutral-800 text-neutral-300 hover:text-amber-400 border border-neutral-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer" title="Archivar evento cuando concluya">
            <Archive className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Archivar</span>
          </button>
        </div>
      </div>
    );
  }

  if (type === 'ARCHIVADO') {
    return (
      <div className="p-4 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1">
              <Archive className="w-2.5 h-2.5" /> ARCHIVADO
            </span>
            <span className="text-[10px] text-neutral-400 font-mono">
              {new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}
            </span>
          </div>
          <h4 className="font-bold text-sm text-neutral-200">{event.name}</h4>
          <p className="text-xs text-neutral-400 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-neutral-500 shrink-0" /> <span className="truncate">{event.location}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 text-center">
            <div className="p-2 rounded-xl bg-[#161616] border border-neutral-800">
              <span className="text-[9px] text-neutral-500 block font-semibold uppercase">Total Facturado</span>
              <span className="text-sm font-black text-emerald-400 font-mono">Q {Number(event.totalSold || 0).toFixed(2)}</span>
            </div>
            <div className="p-2 rounded-xl bg-[#161616] border border-neutral-800">
              <span className="text-[9px] text-neutral-500 block font-semibold uppercase">Transacciones</span>
              <span className="text-sm font-black text-white font-mono">{event.salesCount || 0}</span>
            </div>
          </div>
        </div>
        <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2">
          <button type="button" onClick={() => onViewSales?.(event)} className="flex-1 py-2 px-3 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer">
            <Eye className="w-3.5 h-3.5" /> <span>Ver ventas ({event.salesCount || 0})</span>
          </button>
          <button type="button" onClick={() => onUnarchive?.(event)} className="py-2 px-3 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer" title="Restaurar evento a lista de confirmados">
            <RotateCcw className="w-3.5 h-3.5" /> <span>Restaurar</span>
          </button>
          <button type="button" onClick={() => onDelete?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-500 hover:text-red-400 border border-neutral-800 cursor-pointer" title={event.salesCount > 0 ? 'No se puede eliminar: tiene ventas registradas' : 'Eliminar evento'}><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 transition-all flex flex-col justify-between space-y-3">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="px-2.5 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 font-bold text-[10px] uppercase tracking-wider">
            CONFIRMADO
          </span>
          <span className="text-[10px] text-neutral-400">{new Date(event.startDate).toLocaleDateString()}</span>
        </div>
        <h4 className="font-bold text-sm text-white">{event.name}</h4>
        <p className="text-xs text-neutral-400 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-neutral-400 shrink-0" /> <span className="truncate">{event.location}</span>
        </p>
        <div className="text-xs text-neutral-400 pt-2 border-t border-neutral-800/80 flex items-center justify-between">
          <span className="text-[10px] text-neutral-500 uppercase font-semibold">Encargado:</span>
          <span className="font-semibold text-neutral-300 text-[11px] truncate max-w-[200px]">
            {event.assignedSellerEmail || 'Sin asignar'}
          </span>
        </div>
      </div>
      <div className="pt-2 border-t border-neutral-800/80 flex items-center gap-2">
        <button type="button" onClick={() => onActivate?.(event)} className="flex-1 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer">
          <Play className="w-3.5 h-3.5 fill-current" /> <span>Activar / En curso</span>
        </button>
        <button type="button" onClick={() => onViewSales?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:text-white cursor-pointer" title="Ver historial de ventas"><Eye className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => onArchive?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-400 hover:text-amber-400 border border-neutral-800 cursor-pointer" title="Archivar evento"><Archive className="w-3.5 h-3.5" /></button>
        <button type="button" onClick={() => onDelete?.(event)} className="p-2 rounded-xl bg-[#181818] hover:bg-neutral-800 text-neutral-400 hover:text-red-400 border border-neutral-800 cursor-pointer" title="Eliminar evento (creado por error o cancelado)"><Trash2 className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
