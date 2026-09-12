import React from 'react';
import DonutChart from '../DonutChart.jsx';

export default function PaymentMethodsBreakdown({
  payments = {},
  chartSize = 230,
  variant = 'event',
}) {
  const cardBg = variant === 'general'
    ? 'p-3.5 rounded-2xl bg-black border border-neutral-800'
    : 'p-3.5 rounded-xl bg-[#181818] border border-neutral-800';

  const chartData = [
    {
      key: 'TARJETA', label: 'Tarjeta', icon: '💳', color: '#3B82F6',
      amount: payments?.TARJETA?.amount || 0, percentage: payments?.TARJETA?.percentage || 0,
    },
    {
      key: 'TRANSFERENCIA', label: 'Transferencia', icon: '📲', color: '#A855F7',
      amount: payments?.TRANSFERENCIA?.amount || 0, percentage: payments?.TRANSFERENCIA?.percentage || 0,
    },
    {
      key: 'EFECTIVO', label: 'Efectivo', icon: '💵', color: '#10B981',
      amount: payments?.EFECTIVO?.amount || 0, percentage: payments?.EFECTIVO?.percentage || 0,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className={cardBg}>
          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
            <span>💳</span> Tarjeta
          </span>
          <div className="text-lg font-black text-white font-mono">
            Q {(payments?.TARJETA?.amount || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-blue-400 font-bold block mt-0.5">
            ↑ {payments?.TARJETA?.count || 0} ventas
          </span>
        </div>

        <div className={cardBg}>
          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
            <span>📲</span> Transferencia
          </span>
          <div className="text-lg font-black text-white font-mono">
            Q {(payments?.TRANSFERENCIA?.amount || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-purple-400 font-bold block mt-0.5">
            ↑ {payments?.TRANSFERENCIA?.count || 0} ventas
          </span>
        </div>

        <div className={cardBg}>
          <span className="text-[11px] font-bold text-neutral-300 flex items-center gap-1.5 mb-1">
            <span>💵</span> Efectivo
          </span>
          <div className="text-lg font-black text-white font-mono">
            Q {(payments?.EFECTIVO?.amount || 0).toFixed(2)}
          </div>
          <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
            ↑ {payments?.EFECTIVO?.count || 0} ventas
          </span>
        </div>
      </div>

      <div className="pt-2">
        <DonutChart data={chartData} size={chartSize} />
      </div>
    </div>
  );
}
