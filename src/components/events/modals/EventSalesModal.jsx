import React, { useState, useMemo } from 'react';
import { Eye, X, Loader2, Target, AlertCircle, Sparkles, Clock, Banknote, CreditCard, Smartphone, CheckCircle2 } from 'lucide-react';
import EventDayCard from '../daily/EventDayCard.jsx';
import { useModalBackHandler } from '../../../hooks/useSpaBackNavigation';

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
  useModalBackHandler(Boolean(event), onClose);
  const [expandedDate, setExpandedDate] = useState(null);
  const list = useMemo(() => salesList || sales || [], [salesList, sales]);

  const overallPaymentTotals = useMemo(() => {
    const totals = { EFECTIVO: 0, TARJETA: 0, TRANSFERENCIA: 0, OTRO: 0 };
    list.forEach((sale) => {
      (sale.payments || []).forEach((p) => {
        const m = totals[p.method] !== undefined ? p.method : 'OTRO';
        totals[m] = Number((totals[m] + Number(p.amount || 0)).toFixed(2));
      });
    });
    return totals;
  }, [list]);

  const closingsSummary = useMemo(() => {
    let reconciled = 0;
    let autoMidnight = 0;
    (closingsList || []).forEach((c) => {
      if (c.closingType === 'DIARIO') reconciled += 1;
      else if (c.closingType === 'AUTOMATICO_MEDIANOCHE') autoMidnight += 1;
    });
    return { total: (closingsList || []).length, reconciled, autoMidnight };
  }, [closingsList]);

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

  if (!event) return null;

  const fin = event.financials || {};
  const totalExpenses = Number(fin.totalExpenses || 0);
  const standRentCost = Number(fin.standRentCost || 0);
  const otherOperationalCost = Number(fin.otherOperationalCost || 0);
  const cumulativeSold = Number(fin.cumulativeSold !== undefined ? fin.cumulativeSold : (event.totalSold || 0));
  const preProductionBalance = Number(
    fin.preProductionBalance !== undefined
      ? fin.preProductionBalance
      : (cumulativeSold - totalExpenses)
  );
  const healthySalesTarget20Pct = Number(fin.healthySalesTarget20Pct || 0);
  const standRentRatioPct = Number(
    fin.standRentRatioPct !== undefined
      ? fin.standRentRatioPct
      : (standRentCost > 0 && cumulativeSold > 0 ? ((standRentCost / cumulativeSold) * 100).toFixed(1) : 0)
  );
  const healthPhase = fin.healthPhase || (
    totalExpenses === 0
      ? 'SIN_GASTOS'
      : (preProductionBalance < 0
        ? 'EN_RECUPERACION'
        : (standRentCost > 0 && standRentRatioPct <= 20
          ? 'EVENTO_SALUDABLE_20PCT'
          : 'GASTOS_CUBIERTOS_RUMBO_20'))
  );
  const totalEventDays = Number(fin.totalEventDays || 1);
  const requiredDailyRunRate = Number(fin.requiredDailyRunRate || 0);
  const requiredDailyMediumPosters = Number(fin.requiredDailyMediumPosters || 0);
  const healthyTargetProgress = Number(
    fin.healthyTargetProgress !== undefined
      ? fin.healthyTargetProgress
      : (healthySalesTarget20Pct > 0 ? Math.min(100, Math.round((cumulativeSold / healthySalesTarget20Pct) * 100)) : 0)
  );

  const phaseConfig = {
    SIN_GASTOS: {
      color: 'text-slate-400 bg-slate-900 border-slate-700',
      label: '⚪ SIN GASTOS REGISTRADOS',
    },
    EN_RECUPERACION: {
      color: 'text-red-400 bg-red-950/60 border-red-800',
      label: '🔴 FASE 1: RECUPERANDO GASTOS DE FERIA',
    },
    GASTOS_CUBIERTOS_RUMBO_20: {
      color: 'text-amber-400 bg-amber-950/60 border-amber-800',
      label: '🟡 FASE 2: GASTOS CUBIERTOS • RUMBO AL ≤20%',
    },
    EVENTO_SALUDABLE_20PCT: {
      color: 'text-emerald-400 bg-emerald-950/60 border-emerald-800',
      label: '🟢 FASE 3: STAND SALUDABLE (ARRIENDO ≤ 20%)',
    },
  }[healthPhase] || {
    color: 'text-slate-400 bg-slate-900 border-slate-700',
    label: '⚪ EVALUANDO',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] text-white">
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Eye className="w-4 h-4 text-white" />
                Ventas registradas: {event.name}
              </h3>
              {event.status === 'ACTIVO' && (
                <span className="px-2 py-0.5 rounded-full border border-emerald-500/50 bg-emerald-500/10 text-emerald-400 font-extrabold text-[9px] uppercase tracking-wider inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> EN CURSO
                </span>
              )}
              {event.status === 'ARCHIVADO' && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[9px] uppercase tracking-wider">
                  📦 ARCHIVADO
                </span>
              )}
            </div>
            <span className="text-xs text-neutral-400 block mt-0.5">
              Total Acumulado: <strong className="text-emerald-400 font-mono">Q {Number(event.totalSold || 0).toFixed(2)}</strong> ({list.length} transacciones)
            </span>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 no-scrollbar text-xs">
          {/* RADAR FINANCIERO FERIAL (REGLA DEL 20%) */}
          <div className="p-4 rounded-2xl bg-black border border-neutral-800 space-y-3 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-neutral-800 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs uppercase tracking-wider text-amber-300">
                    Radar Financiero Ferial (Regla del 20%)
                  </h4>
                  <p className="text-[10px] text-neutral-400">
                    {event.location ? `${event.name} • ${event.location}` : event.name}
                  </p>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider self-start sm:self-center ${phaseConfig.color}`}>
                {phaseConfig.label}
              </span>
            </div>

            {totalExpenses === 0 ? (
              <div className="p-3 rounded-xl bg-neutral-900/60 border border-dashed border-neutral-800 text-center space-y-1">
                <div className="flex items-center justify-center gap-1.5 text-amber-400">
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-[11px] font-bold">Sin gastos operativos registrados</span>
                </div>
                <p className="text-[11px] text-neutral-400 max-w-sm mx-auto">
                  Este stand no tiene gastos registrados todavía (arriendo, viáticos o transporte).
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Venta Acumulada</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-white">Q {cumulativeSold.toFixed(2)}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Gastos Stand</span>
                    <span className="text-xs sm:text-sm font-black font-mono text-red-400">Q {totalExpenses.toFixed(2)}</span>
                    <span className="text-[9px] text-neutral-500 block truncate" title={`Stand: Q${standRentCost} • Otros: Q${otherOperationalCost}`}>
                      Stand: Q{standRentCost.toFixed(0)} • Otros: Q{otherOperationalCost.toFixed(0)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Balance Pre-Prod</span>
                    <span className={`text-xs sm:text-sm font-black font-mono ${preProductionBalance >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {preProductionBalance >= 0 ? `+Q ${preProductionBalance.toFixed(2)}` : `-Q ${Math.abs(preProductionBalance).toFixed(2)}`}
                    </span>
                    <span className="text-[9px] text-neutral-500 block">Post-stand</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800">
                    <span className="text-[9px] text-neutral-400 block font-semibold uppercase">Peso Arriendo</span>
                    <span className={`text-xs sm:text-sm font-black font-mono ${standRentRatioPct <= 20 && standRentCost > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {standRentCost > 0 ? `${standRentRatioPct}%` : 'N/A'}
                    </span>
                    <span className="text-[9px] text-neutral-500 block font-mono">Meta: Q {healthySalesTarget20Pct.toFixed(0)}</span>
                  </div>
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-neutral-400 font-medium">
                      Progreso Meta 20% (5x Arriendo): <strong className="text-white font-mono">{healthyTargetProgress}%</strong>
                    </span>
                    <span className="text-neutral-400 font-mono">
                      {cumulativeSold >= healthySalesTarget20Pct ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Stand en zona de alta rentabilidad
                        </span>
                      ) : (
                        <span>Faltan Q {Math.max(0, healthySalesTarget20Pct - cumulativeSold).toFixed(2)}</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800">
                    <div
                      className={`h-full transition-all duration-500 ${
                        healthPhase === 'EVENTO_SALUDABLE_20PCT'
                          ? 'bg-emerald-400'
                          : healthPhase === 'GASTOS_CUBIERTOS_RUMBO_20'
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                      }`}
                      style={{ width: `${Math.min(100, healthyTargetProgress)}%` }}
                    />
                  </div>
                </div>

                {requiredDailyRunRate > 0 && (
                  <div className="p-2 rounded-lg bg-neutral-950 border border-neutral-800 text-[10px] text-neutral-300 flex items-center justify-between flex-wrap gap-1.5">
                    <span className="flex items-center gap-1 text-neutral-400">
                      <Clock className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Duración: <strong className="text-white">{totalEventDays} día(s)</strong></span>
                    </span>
                    <span className="font-medium text-right">
                      Ritmo diario meta 20%: <strong className="text-amber-300 font-mono">Q {requiredDailyRunRate.toFixed(2)}/día</strong>{' '}
                      <span className="text-neutral-500">(~{requiredDailyMediumPosters} cuadros M/día)</span>
                    </span>
                  </div>
                )}
              </>
            )}

            {/* Resumen de Formas de Pago y Cierres de Caja */}
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800/90 flex flex-wrap items-center justify-between gap-2 text-[10px]">
              <div className="flex items-center gap-2 flex-wrap text-neutral-300">
                <span className="font-semibold text-neutral-400 uppercase tracking-wider">Recaudación:</span>
                <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                  <Banknote className="w-3 h-3 text-emerald-400" /> Q {overallPaymentTotals.EFECTIVO.toFixed(2)}
                </span>
                <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                  <CreditCard className="w-3 h-3 text-blue-400" /> Q {overallPaymentTotals.TARJETA.toFixed(2)}
                </span>
                <span className="flex items-center gap-1 bg-black/60 px-2 py-0.5 rounded border border-neutral-800">
                  <Smartphone className="w-3 h-3 text-purple-400" /> Q {overallPaymentTotals.TRANSFERENCIA.toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-1 text-neutral-400">
                <CheckCircle2 className="w-3 h-3 text-amber-400" />
                <span>Cortes de caja: <strong className="text-white font-mono">{closingsSummary.total}</strong> ({closingsSummary.reconciled} conciliados)</span>
              </div>
            </div>
          </div>

          <div className="pt-1 flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Movimientos por Jornada ({groupedDays.length} días)
            </h4>
            <span className="text-[10px] text-neutral-500 font-mono">
              {list.length} {list.length === 1 ? 'transacción' : 'transacciones'} registradas
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 text-center flex flex-col items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin mb-2" />
              <span className="text-neutral-400">Cargando ventas y movimientos...</span>
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
