import React from 'react';
import {
  Receipt,
  CreditCard,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';

export default function SettlementHistoryTable({
  settlements = [],
  pagination = {},
  page = 1,
  setPage,
  statusFilter = 'ALL',
  setStatusFilter,
  isSuperAdmin = false,
  onViewReceipt,
  onMarkPaid,
  isLoading = false,
}) {
  const filterOptions = [
    { id: 'ALL', label: 'Todas' },
    { id: 'PENDIENTE_PAGO', label: 'Pendientes de Pago' },
    { id: 'PAGADO', label: 'Pagadas' },
  ];

  return (
    <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 text-white space-y-4 shadow-xl">
      {/* Barra Superior con Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-white">
            Historial de Liquidaciones
          </h3>
        </div>

        {/* Píldoras de Filtro de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {filterOptions.map((opt) => {
            const isActive = statusFilter === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setStatusFilter(opt.id);
                  if (setPage) setPage(1);
                }}
                className={`min-h-[44px] px-3.5 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-white text-black shadow-md font-bold'
                    : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido / Tabla */}
      {isLoading ? (
        <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-3">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-xs font-mono">Cargando liquidaciones históricas...</p>
        </div>
      ) : settlements.length === 0 ? (
        <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-2 text-center">
          <FileText className="w-10 h-10 text-neutral-600 mb-1" />
          <p className="text-sm font-semibold text-neutral-300">No se encontraron liquidaciones</p>
          <p className="text-xs text-neutral-500 max-w-sm">
            {statusFilter !== 'ALL'
              ? 'No hay liquidaciones que coincidan con el filtro seleccionado.'
              : 'Aún no se han emitido liquidaciones oficiales en el sistema.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="border-b border-neutral-800 text-neutral-400 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Correlativo</th>
                <th className="py-2.5 px-3 font-sans">Vendedor</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3 text-center">Órdenes</th>
                <th className="py-2.5 px-3 text-right">Base Prod.</th>
                <th className="py-2.5 px-3 text-right">Comisión (20%)</th>
                <th className="py-2.5 px-3 text-center">Estado</th>
                <th className="py-2.5 px-3 text-right font-sans">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {settlements.map((item) => {
                const isPaid = item.status === 'PAGADO';
                const totalProd = Number(item.totalProductsAmount || 0);
                const totalComm = Number(item.totalCommission || 0);

                return (
                  <tr key={item.id} className="hover:bg-neutral-900/40 transition-colors">
                    {/* Correlativo */}
                    <td className="py-3 px-3 font-bold text-white">
                      <button
                        type="button"
                        onClick={() => onViewReceipt && onViewReceipt(item.id)}
                        className="text-emerald-400 hover:text-emerald-300 hover:underline transition-colors flex items-center gap-1 cursor-pointer"
                        title="Ver Recibo Oficial"
                      >
                        <span>{item.settlementNumber}</span>
                      </button>
                    </td>

                    {/* Vendedor */}
                    <td className="py-3 px-3 font-sans text-neutral-200">
                      <span className="font-semibold">{item.seller?.fullName || '—'}</span>
                    </td>

                    {/* Fecha */}
                    <td className="py-3 px-3 text-neutral-400 text-[11px]">
                      {new Date(item.createdAt).toLocaleDateString('es-GT')}
                    </td>

                    {/* Conteo de Órdenes */}
                    <td className="py-3 px-3 text-center text-neutral-300">
                      {item.salesCount || (item.sales?.length ?? 0)}
                    </td>

                    {/* Base Imponible */}
                    <td className="py-3 px-3 text-right text-neutral-300">
                      Q {totalProd.toFixed(2)}
                    </td>

                    {/* Comisión 20% */}
                    <td className="py-3 px-3 text-right font-bold text-emerald-400">
                      Q {totalComm.toFixed(2)}
                    </td>

                    {/* Badge de Estado */}
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          isPaid
                            ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-400'
                            : 'bg-amber-950/60 border border-amber-800/80 text-amber-400'
                        }`}
                      >
                        {isPaid ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        <span>{isPaid ? 'PAGADO' : 'PENDIENTE'}</span>
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onViewReceipt && onViewReceipt(item.id)}
                          title="Ver Recibo"
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
                        >
                          <Receipt className="w-4 h-4" />
                        </button>
                        {isSuperAdmin && !isPaid && (
                          <button
                            type="button"
                            onClick={() => onMarkPaid && onMarkPaid(item)}
                            title="Registrar Pago Bancario"
                            className="min-h-[44px] px-3 py-1.5 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all cursor-pointer shadow-sm"
                          >
                            <CreditCard className="w-3.5 h-3.5" />
                            <span>Pagar</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Paginación */}
      {pagination?.totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-neutral-800 text-xs text-neutral-400 font-mono">
          <span>
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} registros)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!pagination.hasPrev || isLoading}
              onClick={() => setPage && setPage((p) => Math.max(1, p - 1))}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Página Anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              disabled={!pagination.hasNext || isLoading}
              onClick={() => setPage && setPage((p) => p + 1)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
              title="Página Siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
