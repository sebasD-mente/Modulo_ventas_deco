import React, { useState, useMemo } from 'react';
import { Target, TrendingUp, Receipt, AlertCircle, Sparkles, Plus, Clock } from 'lucide-react';

export default function EventFinancialRadar({
  eventDetails = [],
  globalFinancials = null,
  isSuperAdmin = false,
  onOpenExpenseModal,
}) {
  const physicalEvents = useMemo(() => {
    return eventDetails.filter((e) => e.eventId !== 'evt-ventas-redes-online');
  }, [eventDetails]);

  const [selectedStandId, setSelectedStandId] = useState(() => {
    return physicalEvents[0]?.eventId || 'GLOBAL';
  });

  const activeEvent = useMemo(() => {
    if (selectedStandId === 'GLOBAL') return null;
    return physicalEvents.find((e) => e.eventId === selectedStandId) || physicalEvents[0] || null;
  }, [selectedStandId, physicalEvents]);

  const fin = useMemo(() => {
    if (activeEvent) return activeEvent.financials || {};
    return globalFinancials || physicalEvents[0]?.financials || {};
  }, [activeEvent, globalFinancials, physicalEvents]);

  const totalExpenses = Number(fin.totalExpenses || 0);
  const standRentCost = Number(fin.standRentCost || 0);
  const otherOperationalCost = Number(fin.otherOperationalCost || 0);
  const cumulativeSold = Number(fin.cumulativeSold || 0);
  const dailySold = Number(fin.dailySold || 0);
  const preProductionBalance = Number(fin.preProductionBalance || 0);
  const healthySalesTarget20Pct = Number(fin.healthySalesTarget20Pct || 0);
  const standRentRatioPct = Number(fin.standRentRatioPct || 0);
  const healthPhase = fin.healthPhase || 'SIN_GASTOS';
  const totalEventDays = Number(fin.totalEventDays || 1);
  const requiredDailyRunRate = Number(fin.requiredDailyRunRate || 0);
  const requiredDailyMediumPosters = Number(fin.requiredDailyMediumPosters || 0);
  const healthyTargetProgress = Number(fin.healthyTargetProgress || 0);

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

  const handleOpenExpenses = () => {
    if (onOpenExpenseModal) {
      const target = activeEvent ? { id: activeEvent.eventId, name: activeEvent.name, financials: fin } : (physicalEvents[0] ? { id: physicalEvents[0].eventId, name: physicalEvents[0].name } : null);
      if (target) onOpenExpenseModal(target);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-4 shadow-xl">
      {/* Cabecera del Radar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Target className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <span>Radar Financiero Ferial (Regla del 20%)</span>
            </h3>
            <p className="text-[11px] text-neutral-400">
              {activeEvent ? activeEvent.name : 'Consolidado Global de Stands Concurrentes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-lg border uppercase tracking-wider ${phaseConfig.color}`}>
            {phaseConfig.label}
          </span>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenExpenses}
              className="py-1.5 px-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer min-h-[36px]"
              title="Registrar o editar gastos del evento"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Gasto</span>
            </button>
          )}
        </div>
      </div>

      {/* Selector de Stand (Mejora 1 — Multi-Evento) */}
      {physicalEvents.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {physicalEvents.map((ev) => (
            <button
              key={ev.eventId}
              type="button"
              onClick={() => setSelectedStandId(ev.eventId)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] shrink-0 border ${
                selectedStandId === ev.eventId
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
              }`}
            >
              🎪 {ev.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedStandId('GLOBAL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] shrink-0 border ${
              selectedStandId === 'GLOBAL'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-white'
            }`}
          >
            🌐 Consolidado ({physicalEvents.length})
          </button>
        </div>
      )}

      {/* Estado Honesto: 0 Gastos Registrados */}
      {totalExpenses === 0 ? (
        <div className="p-4 rounded-xl bg-neutral-900/90 border border-dashed border-neutral-800 text-center space-y-2.5">
          <div className="flex items-center justify-center gap-2 text-amber-400">
            <AlertCircle className="w-5 h-5" />
            <span className="text-xs font-bold">Sin gastos operativos registrados</span>
          </div>
          <p className="text-xs text-neutral-400 max-w-md mx-auto leading-relaxed">
            Aún no se han ingresado los gastos reales (arriendo del stand, viáticos, sueldos de turno o transporte) para este evento.
          </p>
          {isSuperAdmin && (
            <button
              type="button"
              onClick={handleOpenExpenses}
              className="py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs inline-flex items-center gap-2 transition-transform active:scale-95 shadow-md shadow-amber-500/10 min-h-[44px] cursor-pointer"
            >
              <Receipt className="w-4 h-4" />
              <span>💸 Registrar Gastos del Stand</span>
            </button>
          )}
        </div>
      ) : (
        <>
          {/* 4 Tarjetas Contables Reales */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center">
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Venta Acumulada</span>
              <span className="text-sm sm:text-base font-black font-mono text-white">Q {cumulativeSold.toFixed(2)}</span>
              <span className="text-[10px] text-neutral-500 block mt-0.5 font-mono">Hoy: Q {dailySold.toFixed(2)}</span>
            </div>
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Gastos Operativos</span>
              <span className="text-sm sm:text-base font-black font-mono text-red-400">Q {totalExpenses.toFixed(2)}</span>
              <span className="text-[10px] text-neutral-500 block mt-0.5 truncate" title={`Stand: Q${standRentCost} • Otros: Q${otherOperationalCost}`}>
                Stand: Q{standRentCost.toFixed(0)} • Otros: Q{otherOperationalCost.toFixed(0)}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Balance Pre-Prod</span>
              <span className={`text-sm sm:text-base font-black font-mono ${preProductionBalance >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {preProductionBalance >= 0 ? `+Q ${preProductionBalance.toFixed(2)}` : `-Q ${Math.abs(preProductionBalance).toFixed(2)}`}
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5">Post-stand (sin taller)</span>
            </div>
            <div className="p-3 rounded-xl bg-black border border-neutral-800">
              <span className="text-[10px] text-neutral-400 block font-semibold uppercase">Peso Arriendo (≤20%)</span>
              <span className={`text-sm sm:text-base font-black font-mono ${standRentRatioPct <= 20 && standRentCost > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {standRentCost > 0 ? `${standRentRatioPct}%` : 'N/A'}
              </span>
              <span className="text-[10px] text-neutral-500 block mt-0.5 font-mono">Meta: Q {healthySalesTarget20Pct.toFixed(0)}</span>
            </div>
          </div>

          {/* Barra de Progreso Hacia la Meta 20% */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400 font-medium">
                Progreso Meta 20% (5x Arriendo): <strong className="text-white font-mono">{healthyTargetProgress}%</strong>
              </span>
              <span className="text-neutral-400 font-mono text-[10px]">
                {cumulativeSold >= healthySalesTarget20Pct ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Stand en zona de alta rentabilidad
                  </span>
                ) : (
                  <span>Faltan Q {Math.max(0, healthySalesTarget20Pct - cumulativeSold).toFixed(2)}</span>
                )}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-neutral-900 overflow-hidden border border-neutral-800 relative">
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

          {/* Cinta de Run-Rate Diario Ferial (Mejora 2) */}
          {requiredDailyRunRate > 0 && (
            <div className="p-2.5 rounded-xl bg-black/60 border border-neutral-800 text-[11px] text-neutral-300 flex items-center justify-between flex-wrap gap-2">
              <span className="flex items-center gap-1.5 text-neutral-400">
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Duración evento: <strong className="text-white">{totalEventDays} día(s)</strong></span>
              </span>
              <span className="font-medium text-right">
                Ritmo necesario meta 20%: <strong className="text-amber-300 font-mono">Q {requiredDailyRunRate.toFixed(2)}/día</strong>{' '}
                <span className="text-neutral-500 font-normal">(~{requiredDailyMediumPosters} cuadros M/día)</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
