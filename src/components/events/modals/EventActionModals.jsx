import React from 'react';
import { Archive, Trash2, X, MapPin, AlertTriangle, Loader2 } from 'lucide-react';

export default function EventActionModals({
  eventToArchive, onCloseArchive, onConfirmArchive, isSubmittingArchive, isArchiving,
  eventToDelete, onCloseDelete, onConfirmDelete, isSubmittingDelete, isDeleting, deleteErrorMsg,
}) {
  const archiving = isArchiving || isSubmittingArchive;
  const deleting = isDeleting || isSubmittingDelete;

  return (
    <>
      {eventToArchive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <Archive className="w-4 h-4" /> Archivar evento
              </h3>
              <button type="button" onClick={onCloseArchive} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
              <span className="font-bold text-white text-sm block">{eventToArchive.name}</span>
              <span className="text-neutral-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {eventToArchive.location}</span>
              <div className="pt-2 border-t border-neutral-800 text-[11px] text-neutral-400">
                Ventas acumuladas: <strong className="text-emerald-400 font-mono">Q {Number(eventToArchive.totalSold || 0).toFixed(2)}</strong> ({eventToArchive.salesCount || 0} tickets)
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed">
              ¿Deseas archivar este evento? Pasará a la sección de <strong>Eventos Archivados</strong> en la parte inferior, liberando el mostrador pero preservando todas sus ventas y métricas para consultas futuras.
            </p>
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button type="button" onClick={onCloseArchive} className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={onConfirmArchive} disabled={archiving} className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95">
                {archiving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Archivando...</span></> : <><Archive className="w-3.5 h-3.5" /><span>Confirmar y archivar</span></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {eventToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-[#141414] border border-red-500/30 rounded-[32px] w-full max-w-md p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
              <h3 className="text-sm font-bold text-red-400 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Eliminar evento
              </h3>
              <button type="button" onClick={onCloseDelete} className="text-neutral-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3.5 rounded-2xl bg-black border border-neutral-800 text-xs text-neutral-300 space-y-1.5">
              <span className="font-bold text-white text-sm block">{eventToDelete.name}</span>
              <span className="text-neutral-400 flex items-center gap-1"><MapPin className="w-3 h-3" /> {eventToDelete.location}</span>
            </div>
            {deleteErrorMsg ? (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{deleteErrorMsg}</span>
              </div>
            ) : (
              <p className="text-xs text-neutral-400 leading-relaxed">
                Esta acción es permanente y eliminará el evento. Úsala únicamente si el evento fue <strong>creado por error</strong> o <strong>cancelado</strong>.
              </p>
            )}
            <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2">
              <button type="button" onClick={onCloseDelete} className="px-4 py-2 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={onConfirmDelete} disabled={deleting} className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs flex items-center gap-1.5 shadow-lg shadow-red-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95">
                {deleting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /><span>Eliminando...</span></> : <><Trash2 className="w-3.5 h-3.5" /><span>Eliminar definitivamente</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
