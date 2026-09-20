import React, { useState, useEffect } from 'react';
import { X, Printer, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

export default function SettlementDetailReceiptModal({
  isOpen,
  onClose,
  settlementId,
  fetchSettlementDetail,
}) {
  const [settlement, setSettlement] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!isOpen || !settlementId) {
      setSettlement(null);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    setErrorMsg(null);

    fetchSettlementDetail(settlementId)
      .then((data) => {
        if (isMounted) setSettlement(data);
      })
      .catch((err) => {
        if (isMounted) setErrorMsg(err.message || 'Error cargando detalle del recibo');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, settlementId, fetchSettlementDetail]);

  if (!isOpen) return null;

  const isPaid = settlement?.status === 'PAGADO';
  const totalProducts = Number(settlement?.totalProductsAmount || 0);
  const totalComm = Number(settlement?.totalCommission || 0);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-fadeIn">
      {/* Estilo scoped para impresión física en papel o PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #printable-settlement-receipt, #printable-settlement-receipt * { visibility: visible !important; }
          #printable-settlement-receipt {
            position: fixed !important; left: 0 !important; top: 0 !important;
            width: 100vw !important; height: auto !important; background: #ffffff !important;
            color: #000000 !important; padding: 24px !important; z-index: 999999 !important;
            overflow: visible !important; display: block !important;
          }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>

      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 max-w-2xl w-full shadow-2xl text-white max-h-[90vh] flex flex-col">
        {/* Cabecera Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0 no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Recibo Oficial de Liquidación
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Recibo */}
        <div className="flex-1 overflow-y-auto py-3 space-y-4">
          {isLoading && (
            <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-3">
              <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
              <p className="text-xs font-mono">Cargando comprobante oficial...</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/40 border border-red-800 rounded-xl flex items-center gap-2 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {settlement && !isLoading && (
            <div id="printable-settlement-receipt" className="space-y-4 text-xs font-sans text-white print:text-black">
              {/* Encabezado Institucional */}
              <div className="border-b border-neutral-800 print:border-black pb-3 flex justify-between items-start">
                <div>
                  <h2 className="text-base font-black tracking-tight text-white print:text-black uppercase">
                    Deco Vintage Guate • STAND {'{IA}'}
                  </h2>
                  <p className="text-[11px] text-neutral-400 print:text-neutral-600">
                    Comprobante de Liquidación de Comisiones de Venta
                  </p>
                </div>
                <div className="text-right font-mono">
                  <div className="text-sm font-bold text-emerald-400 print:text-black">
                    {settlement.settlementNumber}
                  </div>
                  <div className="text-[10px] text-neutral-400 print:text-neutral-600">
                    {new Date(settlement.createdAt).toLocaleDateString('es-GT', { dateStyle: 'medium' })}
                  </div>
                </div>
              </div>

              {/* Ficha Informativa */}
              <div className="grid grid-cols-2 gap-3 bg-neutral-900/80 print:bg-neutral-100 p-3 rounded-xl font-mono text-[11px] print:text-black">
                <div>
                  <span className="text-neutral-400 print:text-neutral-600 font-sans block text-[10px]">VENDEDOR:</span>
                  <span className="font-bold text-white print:text-black">{settlement.seller?.fullName}</span>
                  <span className="text-neutral-400 print:text-neutral-600 block text-[10px]">{settlement.seller?.email}</span>
                </div>
                <div className="text-right">
                  <span className="text-neutral-400 print:text-neutral-600 font-sans block text-[10px]">ESTADO:</span>
                  <span className={`inline-flex items-center gap-1 font-bold ${isPaid ? 'text-emerald-400 print:text-emerald-800' : 'text-amber-400 print:text-amber-800'}`}>
                    {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                    {isPaid ? 'PAGADO' : 'PENDIENTE DE PAGO'}
                  </span>
                  {isPaid && settlement.paymentReference && (
                    <div className="text-[10px] text-neutral-300 print:text-neutral-700 mt-1">
                      Ref: <span className="font-bold">{settlement.paymentReference}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Desglose de Ventas */}
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 print:border-black text-neutral-400 print:text-neutral-600">
                      <th className="py-1.5 px-2">Ticket</th>
                      <th className="py-1.5 px-2">Fecha</th>
                      <th className="py-1.5 px-2 text-right">Base Prod.</th>
                      <th className="py-1.5 px-2 text-right">Flete</th>
                      <th className="py-1.5 px-2 text-right">Comisión (20%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800/60 print:divide-neutral-200">
                    {(settlement.sales || []).map((s) => {
                      const base = Number(
                        s.baseProductos ??
                        Math.max(0, (Number(s.itemsSubtotal || 0) > 0
                          ? Number(s.itemsSubtotal) - Number(s.discount || 0)
                          : Number(s.totalAmount || 0) - Number(s.shippingCost || 0)))
                      );
                      const comm = Number((base * 0.20).toFixed(2));
                      return (
                        <tr key={s.id} className="hover:bg-neutral-900/40 print:hover:bg-transparent">
                          <td className="py-1.5 px-2 font-bold text-white print:text-black">#{s.saleNumber}</td>
                          <td className="py-1.5 px-2 text-neutral-400 print:text-neutral-600">
                            {new Date(s.createdAt).toLocaleDateString('es-GT')}
                          </td>
                          <td className="py-1.5 px-2 text-right text-white print:text-black">Q {base.toFixed(2)}</td>
                          <td className="py-1.5 px-2 text-right text-neutral-400 print:text-neutral-600">
                            Q {Number(s.shippingCost || 0).toFixed(2)}
                          </td>
                          <td className="py-1.5 px-2 text-right font-bold text-emerald-400 print:text-black">
                            Q {comm.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totales Resumen */}
              <div className="border-t border-neutral-800 print:border-black pt-3 flex justify-end">
                <div className="w-64 space-y-1.5 text-right font-mono text-xs">
                  <div className="flex justify-between text-neutral-400 print:text-neutral-600">
                    <span>Base Imponible:</span>
                    <span className="text-white print:text-black font-bold">Q {totalProducts.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-400 print:text-neutral-600">
                    <span>Tasa de Comisión:</span>
                    <span className="text-emerald-400 print:text-black font-bold">20.00%</span>
                  </div>
                  <div className="flex justify-between text-sm pt-1 border-t border-neutral-800 print:border-black font-bold">
                    <span className="text-white print:text-black font-sans">Total Líquido:</span>
                    <span className="text-emerald-400 print:text-black text-base">Q {totalComm.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Firmas de Autorización solo para Impresión */}
              <div className="hidden print-only pt-14 grid grid-cols-2 gap-10 text-center text-xs font-sans text-black">
                <div className="border-t border-black pt-2">
                  <p className="font-bold">{settlement.seller?.fullName}</p>
                  <p className="text-[10px] text-neutral-600">Firma Vendedor (Recibido Conforme)</p>
                </div>
                <div className="border-t border-black pt-2">
                  <p className="font-bold">{settlement.approvedBy?.fullName || 'Administración'}</p>
                  <p className="text-[10px] text-neutral-600">Firma Autorizada • STAND {'{IA}'}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Barra de Acciones Accesible (>= 44px) */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-neutral-800 shrink-0 no-print">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold rounded-xl transition-all cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!settlement || isLoading}
            className="min-h-[44px] px-5 py-2 bg-white hover:bg-neutral-200 text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Recibo Oficial</span>
          </button>
        </div>
      </div>
    </div>
  );
}
