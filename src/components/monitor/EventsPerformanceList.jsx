import React from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import MonitorKpiGrid from './MonitorKpiGrid.jsx';
import PaymentMethodsBreakdown from './PaymentMethodsBreakdown.jsx';

export default function EventsPerformanceList({
  eventDetails = [],
  expandedEvents = {},
  onToggleEvent,
  selectedDate,
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
          Detalle por evento ({eventDetails.length})
        </label>
      </div>

      {eventDetails.length === 0 ? (
        <div className="p-6 rounded-2xl bg-black border border-neutral-800 text-center text-xs text-neutral-500">
          No hay eventos con ventas registradas para la fecha seleccionada ({selectedDate}).
        </div>
      ) : (
        <div className="space-y-4">
          {eventDetails.map((ev) => {
            const isExpanded = expandedEvents[ev.eventId] ?? true;

            return (
              <div
                key={ev.eventId}
                className="rounded-2xl bg-black border border-neutral-800 shadow-xl overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => onToggleEvent && onToggleEvent(ev.eventId)}
                  className="w-full px-4 sm:px-5 py-3.5 bg-neutral-900/60 hover:bg-neutral-900 flex items-center justify-between text-left transition-colors cursor-pointer border-b border-neutral-800/80"
                >
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    )}
                    <span>🎪 {ev.name}</span>
                    <span className="text-neutral-400 font-normal font-mono">
                      ({ev.transactions} tx • Q {Number(ev.totalSold || 0).toFixed(2)})
                    </span>
                  </div>

                  {ev.status === 'ACTIVO' && (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-white text-emerald-600 border border-emerald-500 shadow-sm">
                      Stand Activo
                    </span>
                  )}
                </button>

                {isExpanded && (
                  <div className="p-4 sm:p-5 space-y-4">
                    <MonitorKpiGrid
                      mode="event"
                      transactions={ev.transactions}
                      totalSold={ev.totalSold}
                      lastSale={ev.lastSale}
                    />
                    <PaymentMethodsBreakdown
                      payments={ev.payments}
                      chartSize={230}
                      variant="event"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
