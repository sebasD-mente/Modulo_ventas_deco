import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Printer, ExternalLink, Check, AlertCircle, Loader2, Layers, CheckCircle2, Factory } from 'lucide-react';

export default function PrintSheetDetailModal({
  sheetId,
  isOpen,
  onClose,
  onUpdateStatus,
  isUpdatingStatus = false,
}) {
  const { authFetch } = useAuth();
  const [sheet, setSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [confirmingStatus, setConfirmingStatus] = useState(null);

  const fetchDetail = useCallback(async () => {
    if (!sheetId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/api/production/print-sheets/${sheetId}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al cargar detalle del pliego.');
      setSheet(json.data);
    } catch (err) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, sheetId]);

  useEffect(() => {
    if (isOpen && sheetId) {
      setConfirmingStatus(null);
      fetchDetail();
    }
  }, [isOpen, sheetId, fetchDetail]);

  if (!isOpen) return null;

  const handleStatusTransition = async (newStatus) => {
    try {
      await onUpdateStatus(sheet.id, newStatus);
      setConfirmingStatus(null);
      await fetchDetail();
    } catch (err) {
      setErrorMsg(err.message || 'Error al actualizar el pliego.');
    }
  };

  const items = sheet?.items || [];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-sheet-route, #printable-sheet-route * { visibility: visible !important; }
          #printable-sheet-route {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 100vw !important; height: auto !important; background: #ffffff !important;
            color: #000000 !important; padding: 24px !important; z-index: 999999 !important;
            overflow: visible !important; display: block !important;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
      <div id="printable-sheet-route" className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 max-w-4xl w-full shadow-2xl text-white space-y-4 max-h-[92vh] flex flex-col animate-fadeIn">
        {/* Screen Header */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-cyan-400">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{sheet?.sheetCode || 'Detalle de Pliego'}</h3>
                {sheet?.status && (
                  <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                    sheet.status === 'ABIERTO' ? 'bg-amber-950 border-amber-800 text-amber-300' :
                    sheet.status === 'EN_PRODUCCION' ? 'bg-cyan-950 border-cyan-800 text-cyan-300' :
                    sheet.status === 'IMPRESO' ? 'bg-emerald-950 border-emerald-800 text-emerald-300' :
                    'bg-neutral-900 border-neutral-700 text-neutral-300'
                  }`}>{sheet.status}</span>
                )}
              </div>
              <p className="text-xs text-neutral-400">Material: <span className="text-neutral-200 font-semibold">{sheet?.material}</span> • {items.length} obras loteadas</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => window.print()} className="min-h-[44px] px-3.5 py-2 rounded-2xl bg-black border border-neutral-800 hover:border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold flex items-center gap-2 transition-all cursor-pointer" title="Imprimir Hoja de Taller">
              <Printer className="w-4 h-4 text-cyan-400" />
              <span className="hidden sm:inline">Imprimir Hoja de Ruta</span>
            </button>
            <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Print Only Header */}
        <div className="hidden print-only mb-4 border-b-2 border-black pb-3">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight">DECO VINTAGE GUATE — HOJA DE RUTA DE TALLER</h1>
              <div className="text-lg font-mono font-black mt-1">PLIEGO: {sheet?.sheetCode}</div>
              <div className="text-sm font-semibold">Material: {sheet?.material} • Fecha: {new Date().toLocaleDateString('es-GT')}</div>
              {sheet?.notes && <div className="text-xs italic mt-1">Notas: {sheet.notes}</div>}
            </div>
            <div className="border border-black p-2 text-xs text-right">
              <div>Total Obras: <strong>{items.length}</strong></div>
              <div>Estado: <strong>{sheet?.status}</strong></div>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 mt-3 pt-2 border-t border-gray-300 text-xs font-bold">
            <div>[  ] 1. RIP Plotter</div><div>[  ] 2. Laminado</div><div>[  ] 3. Corte Sustrato</div><div>[  ] 4. Empacado & Salida</div>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2 no-print">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" /><span>{errorMsg}</span>
          </div>
        )}

        {/* Table */}
        <div className="overflow-y-auto flex-1 max-h-[420px] rounded-2xl border border-neutral-800 bg-black">
          {isLoading ? (
            <div className="py-16 text-center text-neutral-400 text-xs flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-cyan-400" /><span>Cargando obras del pliego...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-neutral-400 text-xs">Este pliego aún no tiene obras asignadas.</div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-neutral-900 border-b border-neutral-800 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                <tr>
                  <th className="p-3">Obra / Arte</th><th className="p-3">Detalles</th><th className="p-3">Orden & Cliente</th><th className="p-3">Estado</th><th className="p-3 text-right no-print">RIP Plotter</th><th className="p-3 text-center hidden print-only">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {items.map((it) => {
                  const artUrl = it.customImageUrl || it.product?.imageUrl;
                  return (
                    <tr key={it.id} className="hover:bg-neutral-900/40 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center text-neutral-500">
                            {artUrl ? <img src={artUrl} alt={it.description} className="w-full h-full object-cover" /> : <Layers className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="font-bold text-white line-clamp-1">{it.description}</div>
                            <div className="text-[10px] text-neutral-400">{it.material || sheet?.material}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-neutral-300">
                        <div>{it.customDimensions || 'Estándar'}</div>
                        <div className="text-[10px] text-neutral-400">Cant: {it.quantity}</div>
                      </td>
                      <td className="p-3 text-neutral-300">
                        <div className="font-semibold text-white">#{it.sale?.saleNumber || 'S/N'}</div>
                        <div className="text-[10px] text-neutral-400 truncate max-w-[140px]">{it.sale?.customer?.fullName || 'Mostrador'}</div>
                      </td>
                      <td className="p-3">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${it.productionStatus === 'IMPRESO' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-cyan-950 text-cyan-400 border border-cyan-800'}`}>
                          {it.productionStatus}
                        </span>
                      </td>
                      <td className="p-3 text-right no-print">
                        {artUrl ? (
                          <a href={artUrl} target="_blank" rel="noopener noreferrer" className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-cyan-400 border border-neutral-800 transition-all cursor-pointer" title="Abrir imagen de alta resolución">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        ) : (<span className="text-[10px] text-neutral-500 italic">Sin arte</span>)}
                      </td>
                      <td className="p-3 text-center hidden print-only text-xs font-mono">[  ] OK</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer Transitions */}
        <div className="pt-2 border-t border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-3 no-print">
          <div className="text-xs text-neutral-400">
            {sheet?.notes && <span>Notas: <strong className="text-neutral-300">{sheet.notes}</strong></span>}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {confirmingStatus ? (
              <div className="flex items-center gap-2 bg-neutral-900 border border-neutral-700 p-1.5 rounded-2xl animate-fadeIn">
                <span className="text-xs font-bold text-white px-2">¿Confirmar {confirmingStatus}?</span>
                <button type="button" onClick={() => handleStatusTransition(confirmingStatus)} disabled={isUpdatingStatus} className="min-h-[44px] px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black cursor-pointer">
                  {isUpdatingStatus ? 'Actualizando...' : 'Sí, confirmar'}
                </button>
                <button type="button" onClick={() => setConfirmingStatus(null)} disabled={isUpdatingStatus} className="min-h-[44px] px-3 py-2 rounded-xl bg-black text-neutral-400 hover:text-white text-xs cursor-pointer">
                  Cancelar
                </button>
              </div>
            ) : (
              <>
                {sheet?.status === 'ABIERTO' && (
                  <button type="button" onClick={() => setConfirmingStatus('EN_PRODUCCION')} className="min-h-[44px] px-4 py-2 rounded-2xl bg-cyan-950 border border-cyan-800 text-cyan-300 hover:bg-cyan-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                    <Factory className="w-4 h-4" /><span>Pasar a Producción</span>
                  </button>
                )}
                {sheet?.status === 'EN_PRODUCCION' && (
                  <button type="button" onClick={() => setConfirmingStatus('IMPRESO')} className="min-h-[44px] px-4 py-2 rounded-2xl bg-emerald-950 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /><span>Marcar Pliego Impreso</span>
                  </button>
                )}
                {sheet?.status === 'IMPRESO' && (
                  <button type="button" onClick={() => setConfirmingStatus('TERMINADO')} className="min-h-[44px] px-4 py-2 rounded-2xl bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5">
                    <Check className="w-4 h-4" /><span>Marcar Terminado</span>
                  </button>
                )}
                <button type="button" onClick={onClose} className="min-h-[44px] px-4 py-2 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-800 cursor-pointer">
                  Cerrar
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
