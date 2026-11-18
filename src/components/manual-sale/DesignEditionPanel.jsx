import React from 'react';
import { PenTool } from 'lucide-react';

export default function DesignEditionPanel({
  editionDescription = '',
  setEditionDescription,
  editionCost = '',
  setEditionCost,
  effectiveEditionCost = 0,
}) {
  const needsDescriptionHint = effectiveEditionCost > 0 && !String(editionDescription || '').trim();

  return (
    <div
      data-testid="design-edition-panel"
      className="p-4 rounded-2xl bg-black border border-neutral-800 text-xs space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="design-edition-description"
          className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5"
        >
          <PenTool className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          <span>Edición de Diseño (Opcional)</span>
        </label>

        {effectiveEditionCost > 0 && (
          <span
            data-testid="edition-cost-badge"
            className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono font-bold text-[11px] shrink-0"
          >
            + Q {effectiveEditionCost.toFixed(2)}
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <div className="sm:col-span-2">
          <label
            htmlFor="design-edition-description"
            className="block text-[11px] font-semibold text-neutral-400 mb-1"
          >
            Descripción de la edición
          </label>
          <input
            id="design-edition-description"
            data-testid="edition-description-input"
            type="text"
            maxLength={300}
            value={editionDescription}
            onChange={(e) => setEditionDescription && setEditionDescription(e.target.value)}
            placeholder="Ej. Se agregaron letras en la esquina inferior"
            className="w-full min-h-[44px] px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white text-xs focus:outline-none focus:border-white"
          />
        </div>

        <div>
          <label
            htmlFor="design-edition-cost"
            className="block text-[11px] font-semibold text-neutral-400 mb-1"
          >
            Costo de la edición (Q)
          </label>
          <input
            id="design-edition-cost"
            data-testid="edition-cost-input"
            type="number"
            min="0"
            step="any"
            value={editionCost}
            onChange={(e) => setEditionCost && setEditionCost(e.target.value)}
            placeholder="0.00"
            className="w-full min-h-[44px] px-3.5 py-2 bg-neutral-950 border border-neutral-800 rounded-xl text-white font-mono font-bold text-xs focus:outline-none focus:border-white"
          />
        </div>
      </div>

      {needsDescriptionHint && (
        <p className="text-[11px] text-cyan-300">
          Describe brevemente la edición solicitada para que Taller la aplique al diseño.
        </p>
      )}
    </div>
  );
}
