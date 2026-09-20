import React from 'react';
import {
  Users,
  Calendar,
  DollarSign,
  CheckSquare,
  Square,
  FileText,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function AdminCommissionPanel({
  sellers = [],
  selectedSellerId = '',
  setSelectedSellerId,
  pendingData = { sales: [], totalProductsAmount: 0, totalShippingExcluded: 0, totalCommission: 0 },
  selectedSaleIds = [],
  toggleSaleSelection,
  selectAllSales,
  clearSaleSelection,
  isAllSelected = false,
  calculatedSelection = { count: 0, baseAmount: 0, commissionAmount: 0 },
  startDate = '',
  setStartDate,
  endDate = '',
  setEndDate,
  onEmitClick,
  isLoading = false,
}) {
  const sales = pendingData.sales || [];

  return (
    <div className="space-y-6">
      {/* 1. Barra de Filtros: Selector de Vendedor y Fechas */}
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 text-white space-y-4 shadow-xl">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-800">
          <Users className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm uppercase tracking-wider text-white">
            Auditoría de Comisiones por Vendedor
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Selector de Vendedor */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1.5">
              Vendedor de Redes:
            </label>
            <select
              value={selectedSellerId}
              onChange={(e) => {
                if (setSelectedSellerId) setSelectedSellerId(e.target.value);
                if (clearSaleSelection) clearSaleSelection();
              }}
              className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-700/90 rounded-xl text-white text-xs focus:outline-none focus:border-emerald-500 cursor-pointer"
            >
              {sellers.length === 0 ? (
                <option value="">Cargando vendedores...</option>
              ) : (
                sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.email})
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Fecha Inicio */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1.5">
              Fecha Desde:
            </label>
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate && setStartDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-700/90 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Fecha Hasta */}
          <div>
            <label className="block text-xs text-neutral-400 font-medium mb-1.5">
              Fecha Hasta:
            </label>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate && setEndDate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-700/90 rounded-xl text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tarjeta de Cálculo Reactivo de Selección y Botón de Emisión */}
      <div className="bg-[#121212] border border-emerald-500/40 rounded-[32px] p-5 sm:p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <DollarSign className="w-4 h-4" />
            <span>Cálculo Reactivo de Liquidación</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs font-mono text-neutral-300">
            <span>
              Seleccionadas:{' '}
              <strong className="text-white text-sm">{calculatedSelection.count}</strong> de {sales.length}
            </span>
            <span>•</span>
            <span>
              Base Prod:{' '}
              <strong className="text-white">Q {calculatedSelection.baseAmount.toFixed(2)}</strong>
            </span>
            <span>•</span>
            <span>
              Monto 20%:{' '}
              <strong className="text-emerald-400 text-base font-bold">
                Q {calculatedSelection.commissionAmount.toFixed(2)}
              </strong>
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={onEmitClick}
          disabled={calculatedSelection.count === 0 || isLoading}
          className="min-h-[44px] px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <FileText className="w-4 h-4" />
          <span>💼 Emitir Liquidación Oficial</span>
        </button>
      </div>

      {/* 3. Tabla de Auditoría con Selección Individual y Masiva */}
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 text-white space-y-4 shadow-xl">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-white">
              Ventas Elegibles Participantes
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Auditoría previa a la emisión de correlativo oficial LIQ-...
            </p>
          </div>

          {sales.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={isAllSelected ? clearSaleSelection : selectAllSales}
                className="min-h-[44px] px-3.5 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                {isAllSelected ? <CheckSquare className="w-4 h-4 text-emerald-400" /> : <Square className="w-4 h-4" />}
                <span>{isAllSelected ? 'Deseleccionar Todas' : 'Seleccionar Todas'}</span>
              </button>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs font-mono">Consultando ventas elegibles del vendedor...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-2 text-center">
            <CheckCircle2 className="w-10 h-10 text-neutral-600 mb-1" />
            <p className="text-sm font-semibold text-neutral-300">
              No hay ventas pendientes para este vendedor
            </p>
            <p className="text-xs text-neutral-500 max-w-sm">
              No se encontraron ventas completadas con saldo Q 0.00 pendientes de liquidar en el período seleccionado.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3 text-center w-12">Sel.</th>
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 text-right">Base Prod.</th>
                  <th className="py-2.5 px-3 text-right">Flete</th>
                  <th className="py-2.5 px-3 text-right">Comisión (20%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {sales.map((sale) => {
                  const isSelected = selectedSaleIds.includes(sale.id);
                  const base = sale.baseProductos ?? 0;
                  const comm = sale.commissionAmount ?? Number((base * 0.20).toFixed(2));

                  return (
                    <tr
                      key={sale.id}
                      onClick={() => toggleSaleSelection && toggleSaleSelection(sale.id)}
                      className={`hover:bg-neutral-900/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-950/20' : ''
                      }`}
                    >
                      {/* Checkbox con target táctil >= 44x44px */}
                      <td className="py-2 px-3 text-center">
                        <div className="min-h-[44px] min-w-[44px] flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}} // el onClick en la fila ya lo gestiona
                            className="w-4 h-4 rounded text-emerald-500 cursor-pointer accent-emerald-500"
                          />
                        </div>
                      </td>
                      <td className="py-2 px-3 font-bold text-white">#{sale.saleNumber}</td>
                      <td className="py-2 px-3 text-neutral-400 text-[11px]">
                        {new Date(sale.createdAt).toLocaleDateString('es-GT')}
                      </td>
                      <td className="py-2 px-3 text-right text-white">Q {base.toFixed(2)}</td>
                      <td className="py-2 px-3 text-right">
                        <span className="inline-block px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px]">
                          Q {(sale.shippingCost ?? 0).toFixed(2)} sin comisión
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-400 text-sm">
                        Q {comm.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
