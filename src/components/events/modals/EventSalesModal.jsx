import React, { useState, useMemo } from 'react';
import { Eye, X, Loader2 } from 'lucide-react';
import EventDayCard from '../daily/EventDayCard.jsx';

const getGuatemalaDateStr = (dateInput) => {
  if (!dateInput) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date(dateInput));
};

const formatSpanishDate = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const formatted = dateObj.toLocaleDateString('es-GT', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

export default function EventSalesModal({ event, salesList, closingsList = [], sales, isLoading, onClose }) {
  if (!event) return null;
  const list = salesList || sales || [];
  const [expandedDate, setExpandedDate] = useState(null);

  const groupedDays = useMemo(() => {
    const todayStr = getGuatemalaDateStr(new Date());
    const groups = new Map();

    list.forEach((sale) => {
      const dateStr = getGuatemalaDateStr(sale.createdAt);
      if (!groups.has(dateStr)) groups.set(dateStr, []);
      groups.get(dateStr).push(sale);
    });

    const sortedDates = Array.from(groups.keys()).sort((a, b) => b.localeCompare(a));
    return sortedDates.map((dateStr) => {
      const daySales = groups.get(dateStr) || [];
      const totalSold = daySales.reduce((acc, s) => acc + Number(s.totalAmount || 0), 0);
      const paymentTotals = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0 };
      daySales.forEach((s) => {
        (s.payments || []).forEach((p) => {
          const m = p.method || 'EFECTIVO';
          if (paymentTotals[m] !== undefined) paymentTotals[m] += Number(p.amount || 0);
        });
      });

      const matchedClosing = (closingsList || []).find((c) => getGuatemalaDateStr(c.closingDate) === dateStr);
      return {
        dateStr, formattedDate: formatSpanishDate(dateStr), totalSold, salesCount: daySales.length,
        paymentTotals, closing: matchedClosing || null, isToday: dateStr === todayStr, sales: daySales,
      };
    });
  }, [list, closingsList]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Eye className="w-4 h-4 text-white" />
              Ventas registradas: {event.name}
            </h3>
            <span className="text-xs text-neutral-400">
              Total Acumulado: <strong className="text-emerald-400 font-mono">Q {Number(event.totalSold || 0).toFixed(2)}</strong> ({list.length} transacciones)
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1 no-scrollbar text-xs">
          {isLoading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
              <span className="text-neutral-400">Cargando ventas...</span>
            </div>
          ) : groupedDays.length === 0 ? (
            <div className="p-8 text-center text-neutral-500">
              No hay ventas registradas todavía para este evento.
            </div>
          ) : (
            groupedDays.map((day, idx) => (
              <EventDayCard
                key={day.dateStr}
                dayData={day}
                isExpanded={expandedDate === day.dateStr || (expandedDate === null && idx === 0)}
                onToggleExpand={() => setExpandedDate(expandedDate === day.dateStr ? 'NONE' : day.dateStr)}
              />
            ))
          )}
        </div>

        <div className="px-6 py-3.5 bg-[#181818] border-t border-neutral-800 flex justify-end">
          <button
            type="button" onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs cursor-pointer shadow-md transition-transform active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
