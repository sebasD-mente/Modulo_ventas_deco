import React, { useState, useEffect } from 'react';
import { Pencil, X, Users, Check, Loader2 } from 'lucide-react';

export default function EditEventModal({
  isOpen,
  onClose,
  event,
  usersList = [],
  onUpdate,
  isSubmitting = false,
}) {
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    startDate: '',
    endDate: '',
    salesTarget: 15000,
    assignedUserIds: [],
  });

  useEffect(() => {
    if (event) {
      const initialUserIds = Array.isArray(event.assignedSellers)
        ? event.assignedSellers.map((s) => s.id)
        : [];

      const formatDate = (dateStr) => {
        if (!dateStr) return '';
        try {
          return new Date(dateStr).toISOString().slice(0, 10);
        } catch (_) {
          return '';
        }
      };

      setFormData({
        name: event.name || '',
        location: event.location || '',
        startDate: formatDate(event.startDate),
        endDate: formatDate(event.endDate),
        salesTarget: event.salesTarget ? Number(event.salesTarget) : 15000,
        assignedUserIds: initialUserIds,
      });
    }
  }, [event]);

  if (!isOpen || !event) return null;

  const selectedIds = formData.assignedUserIds || [];

  const toggleUser = (userId) => {
    const updated = selectedIds.includes(userId)
      ? selectedIds.filter((id) => id !== userId)
      : [...selectedIds, userId];
    setFormData((prev) => ({ ...prev, assignedUserIds: updated }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.location.trim()) {
      alert('Nombre y ubicación son obligatorios.');
      return;
    }
    onUpdate(event.id, formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <form
        onSubmit={handleSubmit}
        className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-md p-5 sm:p-6 shadow-2xl space-y-4 text-white max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800 shrink-0">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-amber-400" />
            Editar evento y vendedores
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto no-scrollbar pr-1 flex-1">
          <div>
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
              Nombre del evento *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Comic Con Guate 2026"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
              Ubicación / Stand *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Fórum Majadas, Stand 42"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Fecha inicio
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full bg-black border border-neutral-700/90 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                Fecha fin
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full bg-black border border-neutral-700/90 rounded-xl px-2 py-2 text-xs text-white focus:outline-none focus:border-white"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1">
              Meta de ventas (Q)
            </label>
            <input
              type="number"
              min="0"
              value={formData.salesTarget}
              onChange={(e) => setFormData({ ...formData, salesTarget: e.target.value })}
              className="w-full bg-black border border-neutral-700/90 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
            />
          </div>

          {/* Selector Múltiple de Vendedores Asignados */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                Vendedores asignados al stand ({selectedIds.length})
              </label>
              <span className="text-[10px] text-neutral-400 font-medium">1 a N vendedores</span>
            </div>

            <div className="max-h-44 overflow-y-auto no-scrollbar space-y-1.5 p-2 rounded-xl bg-black border border-neutral-700/90">
              {usersList.length === 0 ? (
                <div className="text-[11px] text-neutral-500 text-center py-3">
                  No hay usuarios disponibles en el equipo para asignar
                </div>
              ) : (
                usersList.map((u) => {
                  const isSelected = selectedIds.includes(u.id);
                  return (
                    <div
                      key={u.id}
                      onClick={() => toggleUser(u.id)}
                      className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-neutral-900 border border-neutral-600 shadow-sm'
                          : 'hover:bg-neutral-900/60 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected
                              ? 'bg-white border-white text-black'
                              : 'border-neutral-600 bg-transparent'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        {u.avatarUrl ? (
                          <img
                            src={u.avatarUrl}
                            alt={u.fullName}
                            className="w-6 h-6 rounded-full object-cover shrink-0 ring-1 ring-neutral-700"
                          />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-neutral-800 text-[10px] font-black flex items-center justify-center shrink-0 text-white ring-1 ring-neutral-700">
                            {u.fullName?.[0] || 'U'}
                          </div>
                        )}
                        <div className="min-w-0 text-left">
                          <div className="text-xs font-bold text-white truncate leading-tight">
                            {u.fullName}
                          </div>
                          <div className="text-[10px] text-neutral-400 truncate leading-tight font-mono">
                            {u.email}
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-black text-neutral-300 border border-neutral-800 font-bold uppercase shrink-0 ml-2">
                        {u.role || u.roles?.[0] || 'VENDEDOR'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] px-4 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] px-5 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs shadow-md active:scale-95 transition-all cursor-pointer flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Guardar cambios</span>
          </button>
        </div>
      </form>
    </div>
  );
}
