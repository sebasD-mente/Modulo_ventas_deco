import React, { useState, useEffect, useCallback } from 'react';
import { X, Receipt, Plus, Trash2, AlertCircle, MapPin } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { useModalBackHandler } from '../../../hooks/useSpaBackNavigation';

const QUICK_TEMPLATES = [
  { category: 'ARRENDAMIENTO_STAND', label: '🎪 Arriendo Stand', desc: 'Arrendamiento de espacio / stand' },
  { category: 'PAGO_VENDEDOR', label: '👥 Pago Vendedor', desc: 'Pago turno diario de vendedor' },
  { category: 'ALIMENTACION', label: '🍔 Alimentación', desc: 'Almuerzo / Viáticos equipo' },
  { category: 'TRANSPORTE_LOGISTICA', label: '🚚 Transporte', desc: 'Gasolina / Flete / Parqueo' },
  { category: 'PUBLICIDAD_OTROS', label: '📦 Otros / Montaje', desc: 'Materiales / Montaje de stand' },
];

export default function EventExpensesModal({ isOpen, event, onClose, onExpensesUpdated }) {
  const { authFetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [expensesData, setExpensesData] = useState(null);
  const [category, setCategory] = useState('ARRENDAMIENTO_STAND');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState(null);

  const fetchExpenses = useCallback(async () => {
    if (!event?.id) return;
    setLoading(true); setError(null);
    try {
      const res = await authFetch(`/api/events/${event.id}/expenses`);
      const json = await res.json();
      if (json.success && json.data) setExpensesData(json.data);
      else setError(json.error || 'Error cargando gastos.');
    } catch (_) { setError('Error de conexión al cargar gastos.'); }
    finally { setLoading(false); }
  }, [authFetch, event?.id]);

  useEffect(() => {
    if (isOpen && event?.id) {
      fetchExpenses(); setDescription(''); setAmount(''); setError(null);
    }
  }, [isOpen, event?.id, fetchExpenses]);

  useModalBackHandler(Boolean(isOpen && event), onClose);
  if (!isOpen || !event) return null;

  const handleApplyTemplate = (tmpl) => {
    setCategory(tmpl.category); setDescription(tmpl.desc); setError(null);
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) { setError('Ingresa un monto válido mayor a Q 0.00'); return; }
    if (!description.trim()) { setError('La descripción es obligatoria.'); return; }

    setSubmitting(true); setError(null);
    try {
      const res = await authFetch(`/api/events/${event.id}/expenses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, description: description.trim(), amount: numAmount }),
      });
      const json = await res.json();
      if (json.success) {
        setDescription(''); setAmount('');
        await fetchExpenses(); onExpensesUpdated?.();
      } else setError(json.error || 'Error al guardar gasto.');
    } catch (_) { setError('Error al comunicarse con el servidor.'); }
    finally { setSubmitting(false); }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('¿Eliminar este gasto registrado?')) return;
    try {
      const res = await authFetch(`/api/events/${event.id}/expenses/${expenseId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { await fetchExpenses(); onExpensesUpdated?.(); }
      else alert(json.error || 'Error al eliminar.');
    } catch (_) { alert('Error de conexión.'); }
  };

  const fin = expensesData?.financials || event.financials || {};
  const expensesList = expensesData?.expenses || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden my-6">
        <div className="flex items-center justify-between p-4 bg-slate-800/90 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20"><Receipt className="w-6 h-6" /></div>
            <div>
              <h3 className="text-lg font-bold text-white">Gastos Operativos del Stand</h3>
              <p className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                <span className="font-semibold text-slate-200">{event.name}</span><span>•</span>
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 bg-slate-950/60 border-b border-slate-800 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Arriendo Stand</span>
            <span className="text-base font-bold text-amber-400">Q {(fin.standRentCost || 0).toFixed(2)}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Meta 20%: Q {(fin.healthySalesTarget20Pct || 0).toFixed(2)}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Otros Gastos</span>
            <span className="text-base font-bold text-slate-300">Q {(fin.otherOperationalCost || 0).toFixed(2)}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">{expensesList.length} registro(s)</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[11px] font-semibold uppercase text-slate-400 block">Gasto Total Stand</span>
            <span className="text-base font-bold text-red-400">Q {(fin.totalExpenses || 0).toFixed(2)}</span>
            <span className="text-[10px] text-slate-500 block mt-0.5">Piso supervivencia</span>
          </div>
        </div>

        <div className="p-4 border-b border-slate-800">
          <label className="text-xs font-semibold text-slate-300 uppercase block mb-2">Plantillas Rápidas</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {QUICK_TEMPLATES.map((tmpl) => (
              <button
                key={tmpl.category} type="button" onClick={() => handleApplyTemplate(tmpl)}
                className={`px-3 py-2 text-xs font-semibold rounded-lg border min-h-[44px] flex items-center justify-center ${category === tmpl.category ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm' : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700'}`}
              >{tmpl.label}</button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAddExpense} className="p-4 border-b border-slate-800 space-y-3 bg-slate-900/50">
          {error && <div className="p-2.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-4">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Categoría</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white min-h-[44px] focus:ring-1 focus:ring-amber-500">
                <option value="ARRENDAMIENTO_STAND">🎪 Arriendo Stand</option>
                <option value="PAGO_VENDEDOR">👥 Pago Vendedor</option>
                <option value="ALIMENTACION">🍔 Alimentación</option>
                <option value="TRANSPORTE_LOGISTICA">🚚 Transporte</option>
                <option value="PUBLICIDAD_OTROS">📦 Otros / Montaje</option>
              </select>
            </div>
            <div className="sm:col-span-5">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Descripción</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej: Arriendo ferial" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white min-h-[44px]" />
            </div>
            <div className="sm:col-span-3">
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Monto (Q)</label>
              <input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white min-h-[44px] font-mono" />
            </div>
          </div>
          <button type="submit" disabled={submitting} className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-xs min-h-[44px] flex items-center justify-center gap-2 shadow-md">
            <Plus className="w-4 h-4" /><span>{submitting ? 'Registrando...' : 'Registrar Gasto'}</span>
          </button>
        </form>

        <div className="p-4 max-h-60 overflow-y-auto">
          <span className="text-xs font-semibold text-slate-300 uppercase block mb-2">Bitácora de Gastos</span>
          {loading ? <p className="text-xs text-slate-500 text-center py-4">Cargando bitácora...</p> : expensesList.length === 0 ? (
            <div className="text-center py-6 text-slate-500 border border-dashed border-slate-800 rounded-xl">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30 text-amber-400" /><p className="text-xs">No hay gastos registrados para este evento.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {expensesList.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg">
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{exp.category === 'ARRENDAMIENTO_STAND' ? '🎪 ARRIENDO' : exp.category}</span>
                      <span className="text-xs font-medium text-white truncate">{exp.description}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block mt-0.5">{new Date(exp.expenseDate || exp.createdAt).toLocaleDateString('es-GT')}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-bold text-red-400">Q {Number(exp.amount).toFixed(2)}</span>
                    <button type="button" onClick={() => handleDeleteExpense(exp.id)} className="p-1.5 text-slate-500 hover:text-red-400 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
