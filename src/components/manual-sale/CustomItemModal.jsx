import React, { useState } from 'react';
import { Palette, X, Plus } from 'lucide-react';

const MATERIALS = [
  { id: 'MDF_5_5MM', label: 'MDF 5.5mm', desc: 'Base rígida estándar' },
  { id: 'PVC_5MM', label: 'PVC 5mm', desc: 'Resistente a humedad y ligero' },
  { id: 'VINILO_SOLO', label: 'Vinilo Solo', desc: 'Lámina adhesiva sin cuadro' },
];

const COMMON_DIMENSIONS = ['30x40 cm', '40x60 cm', '50x70 cm', 'A3', '30x30 cm'];

export default function CustomItemModal({ isOpen, onClose, onAddCustomItem }) {
  const [description, setDescription] = useState('');
  const [material, setMaterial] = useState('MDF_5_5MM');
  const [customDimensions, setCustomDimensions] = useState('30x40 cm');
  const [unitPrice, setUnitPrice] = useState('75');
  const [quantity, setQuantity] = useState(1);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('Por favor ingresa una descripción para el diseño.');
      return;
    }
    const priceNum = Number(unitPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setErrorMsg('Ingresa un precio unitario válido mayor a 0.');
      return;
    }

    onAddCustomItem({
      description: description.trim(),
      material,
      customDimensions: customDimensions.trim(),
      unitPrice: priceNum,
      quantity: Number(quantity) || 1,
      customImageUrl: customImageUrl.trim() || null,
    });

    setDescription('');
    setUnitPrice('75');
    setQuantity(1);
    setCustomImageUrl('');
    setErrorMsg('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] p-6 max-w-md w-full shadow-2xl text-white space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Agregar Póster Personalizado
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Descripción del Cuadro / Arte *</label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrorMsg(''); }}
              placeholder="Ej. Retrato Familiar estilo Anime, Foto Boda..."
              className="w-full min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-400 text-xs"
            />
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1.5">Material de Taller</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              {MATERIALS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterial(m.id)}
                  className={`min-h-[44px] p-2 rounded-xl text-left border transition-colors cursor-pointer ${
                    material === m.id
                      ? 'bg-amber-400/10 border-amber-400 text-amber-300 font-bold'
                      : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <span className="block font-bold text-xs">{m.label}</span>
                  <span className="text-[10px] text-neutral-500 block truncate">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Dimensiones / Medida</label>
            <div className="flex flex-wrap gap-1.5 mb-1.5">
              {COMMON_DIMENSIONS.map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setCustomDimensions(dim)}
                  className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                    customDimensions === dim
                      ? 'bg-white text-black'
                      : 'bg-black text-neutral-400 border border-neutral-800 hover:text-white'
                  }`}
                >
                  {dim}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={customDimensions}
              onChange={(e) => setCustomDimensions(e.target.value)}
              placeholder="Medida específica (ej. 45x65 cm)"
              className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Precio Acordado (Q) *</label>
              <input
                type="number"
                min="1"
                step="5"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
              />
            </div>
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Cantidad</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">URL de Imagen de Referencia (Opcional)</label>
            <input
              type="url"
              value={customImageUrl}
              onChange={(e) => setCustomImageUrl(e.target.value)}
              placeholder="https://drive.google.com/... o enlace de foto"
              className="w-full min-h-[44px] px-3.5 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl text-neutral-400 hover:text-white font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar al Pedido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
