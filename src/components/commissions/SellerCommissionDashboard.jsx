import React from 'react';
import {
  DollarSign,
  Package,
  Clock,
  RefreshCw,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

export default function SellerCommissionDashboard({
  pendingData = {
    totalProductsAmount: 0,
    totalShippingExcluded: 0,
    totalCommission: 0,
    salesCount: 0,
    commissionRate: 0.20,
    sales: [],
  },
  waitingSummary = { count: 0, totalBalance: 0 },
  settlements = [],
  isLoading = false,
  onRefresh,
}) {
  const sales = pendingData.sales || [];

  const latestSettlement = Array.isArray(settlements) && settlements.length > 0
    ? [...settlements].sort(
        (a, b) =>
          new Date(b.paidAt || b.createdAt || 0).getTime() -
          new Date(a.paidAt || a.createdAt || 0).getTime()
      )[0]
    : null;
  const lastSettlementDateLabel =
    latestSettlement && (latestSettlement.paidAt || latestSettlement.createdAt)
      ? new Date(latestSettlement.paidAt || latestSettlement.createdAt).toLocaleDateString('es-GT')
      : 'Sin registros';

  return (
    <div className="space-y-6">
      {/* 1. Tarjetas de Resumen KPI en Tiempo Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1: Comisiones Listas al 20% */}
        <div className="bg-[#121212] border border-emerald-500/30 rounded-[28px] p-4 text-white shadow-lg relative overflow-hidden flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Comisiones Listas
            </span>
            <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
          </div>
          <div>
            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400 tracking-tight">
              Q {pendingData.totalCommission.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-400 font-sans mt-0.5">
              20% neto comisionable
            </div>
          </div>
        </div>

        {/* KPI 2: Ventas Completadas (Base Productos) */}
        <div className="bg-[#121212] border border-neutral-800 rounded-[28px] p-4 text-white shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
              Base Productos
            </span>
            <Package className="w-4 h-4 text-neutral-400 shrink-0" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold font-mono text-white">
              Q {pendingData.totalProductsAmount.toFixed(2)}
            </div>
            <div className="text-[10px] text-neutral-400 font-sans mt-0.5">
              {pendingData.salesCount} {pendingData.salesCount === 1 ? 'orden liquidable' : 'órdenes liquidables'}
            </div>
          </div>
        </div>

        {/* KPI 3: Ventas en Espera de Saldo */}
        <div className="bg-[#121212] border border-neutral-800 rounded-[28px] p-4 text-white shadow-lg flex flex-col justify-between min-h-[110px]">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-300">
              En Espera de Saldo
            </span>
            <Clock className="w-4 h-4 text-neutral-400 shrink-0" />
          </div>
          <div>
            <div className="text-lg sm:text-xl font-bold font-mono text-white">
              {waitingSummary.count} {waitingSummary.count === 1 ? 'orden' : 'órdenes'}
            </div>
            <div className="text-[10px] text-neutral-400 font-sans mt-0.5">
              Q {waitingSummary.totalBalance.toFixed(2)} saldo pendiente
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tabla de Ventas Elegibles */}
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-5 sm:p-6 text-white space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
          <div>
            <h3 className="font-bold text-sm uppercase tracking-wider text-white">
              Ventas Elegibles para Liquidar
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Órdenes completadas con saldo Q 0.00 pendientes de corte oficial.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <span
              data-testid="last-settlement-badge"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-300 text-xs font-medium"
            >
              <span className="text-neutral-400">Última liquidación:</span>
              <span className="font-mono font-semibold text-white">{lastSettlementDateLabel}</span>
            </span>
            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                disabled={isLoading}
                title="Actualizar datos"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-all cursor-pointer"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-3">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <p className="text-xs font-mono">Calculando comisiones en vivo...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-neutral-400 space-y-2 text-center">
            <CheckCircle2 className="w-10 h-10 text-neutral-600 mb-1" />
            <p className="text-sm font-semibold text-neutral-300">
              No hay comisiones pendientes de corte
            </p>
            <p className="text-xs text-neutral-500 max-w-sm">
              Todas tus ventas elegibles ya han sido liquidadas o están pendientes de cobro contra entrega.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-800 text-neutral-400 text-[11px] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Ticket</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3 font-sans">Canal / Entrega</th>
                  <th className="py-2.5 px-3 text-right">Subtotal Prod.</th>
                  <th className="py-2.5 px-3 text-right">Flete</th>
                  <th className="py-2.5 px-3 text-right">Comisión (20%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-neutral-900/40 transition-colors">
                    <td className="py-3 px-3 font-bold text-white">#{sale.saleNumber}</td>
                    <td className="py-3 px-3 text-neutral-400 text-[11px]">
                      {new Date(sale.createdAt).toLocaleDateString('es-GT')}
                    </td>
                    <td className="py-3 px-3 font-sans text-neutral-300">
                      <div className="truncate max-w-[150px]">
                        {sale.deliveryMethod === 'ENVIO_COURIER'
                          ? `🚚 ${sale.shippingCourier || 'Courier'}`
                          : '🏬 Retiro / POS'}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-white">
                      Q {(sale.baseProductos ?? 0).toFixed(2)}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-block px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 text-[10px]">
                        Q {(sale.shippingCost ?? 0).toFixed(2)} sin comisión
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-emerald-400 text-sm">
                      Q {(sale.commissionAmount ?? 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
