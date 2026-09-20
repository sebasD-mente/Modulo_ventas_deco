import React, { useState } from 'react';
import { X, Layers, AlertCircle, Loader2 } from 'lucide-react';

const MATERIALS = [
  { id: 'PVC_5MM', label: 'PVC 5mm', sub: 'Sintra rígido de alta densidad 5mm' },
  { id: 'MDF_5_5MM', label: 'MDF 5.5mm', sub: 'Fibra de madera compacta 5.5mm' },
  { id: 'VINILO_SOLO', label: 'Vinilo Solo', sub: 'Vinilo adhesivo laminado sin sustrato' },
  { id: 'MIXTO', label: 'Mixto', sub: 'Combinación de varios soportes' },
];

export default function CreatePrintSheetModal({ isOpen, onClose, onCreate, isSubmitting }) {
  const [material, setMaterial] = useState('PVC_5MM');
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    if (!material) {
      setLocalError('Debes seleccionar un material para el pliego.');
      return;
    }

    try {
      await onCreate({ material, notes: notes.trim() });
      setNotes('');
      setMaterial('PVC_5MM');
      onClose();
    } catch (err) {
      setLocalError(err.message || 'Error al crear el pliego de impresión.');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-6 max-w-md w-full shadow-2xl text-white space-y-5 animate-fadeIn">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-black border border-neutral-800 flex items-center justify-center text-cyan-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Nuevo Pliego Diario</h3>
              <p className="text-xs text-neutral-400">Apertura de lote para taller de impresión</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {localError && (
          <div className="bg-red-950/40 border border-red-800/80 rounded-2xl p-3 text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{localError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Material */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Material del Pliego <span className="text-cyan-400">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MATERIALS.map((m) => {
                const isSelected = material === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMaterial(m.id)}
                    className={`min-h-[44px] p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-center ${
                      isSelected
                        ? 'bg-cyan-950/40 border-cyan-400 text-white shadow-sm'
                        : 'bg-black border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
                    }`}
                  >
                    <span className={`text-xs font-bold ${isSelected ? 'text-cyan-400' : 'text-neutral-200'}`}>
                      {m.label}
                    </span>
                    <span className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                      {m.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notas de Taller */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-neutral-300 uppercase tracking-wider">
              Notas de Taller (Opcional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Pliego matutino para plotter Roland, calibración 1440dpi..."
              rows={3}
              maxLength={500}
              className="w-full bg-black border border-neutral-800 rounded-2xl p-3 text-xs text-white placeholder:text-neutral-500 focus:outline-none focus:border-cyan-400 resize-none shadow-inner"
            />
          </div>

          {/* Botones de Acción */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-neutral-900 border border-neutral-800 text-xs font-bold text-neutral-300 hover:bg-neutral-800 hover:text-white transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2.5 rounded-2xl bg-cyan-400 hover:bg-cyan-300 text-black text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-950/50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-black" />
                  <span>Creando...</span>
                </>
              ) : (
                <span>Crear Pliego</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
