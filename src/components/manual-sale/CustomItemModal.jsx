import React, { useState, useEffect } from 'react';
import {
  Palette,
  X,
  Plus,
  Upload,
  CheckCircle2,
  Loader2,
  Ruler,
  Sparkles,
  Scissors,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  OFFICIAL_SIZES,
  CUSTOM_CM2_RATE,
  WOOD_CUSTOM_CUT_SURCHARGE,
  PVC_SURCHARGE,
  VINYL_DISCOUNT_FACTOR,
} from './manualSaleConstants';

const MATERIALS = [
  { id: 'MDF_5_5MM', label: 'MDF 5.5mm', desc: 'Madera oficial' },
  { id: 'PVC_5MM', label: 'PVC 5mm', desc: 'Anti-humedad (+Q15)' },
  { id: 'VINILO_SOLO', label: 'Vinilo Solo', desc: 'Sin cuadro (-50%)' },
];

export default function CustomItemModal({ isOpen, onClose, onAddCustomItem }) {
  const { authFetch } = useAuth();
  const [mode, setMode] = useState('STANDARD');
  const [material, setMaterial] = useState('MDF_5_5MM');
  const [selectedSize, setSelectedSize] = useState(OFFICIAL_SIZES[3]);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [unitPrice, setUnitPrice] = useState('65');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Cálculo paramétrico reactivo del precio sugerido
  useEffect(() => {
    let price = 0;
    if (mode === 'STANDARD') {
      const base = selectedSize?.precio || 65;
      if (material === 'PVC_5MM') price = base + PVC_SURCHARGE;
      else if (material === 'VINILO_SOLO') price = base * VINYL_DISCOUNT_FACTOR;
      else price = base;
    } else {
      const w = Number(customWidth) || 0;
      const h = Number(customHeight) || 0;
      if (w > 0 && h > 0) {
        const areaCm2 = w * h;
        const basePrint = areaCm2 * CUSTOM_CM2_RATE;
        if (material === 'PVC_5MM') price = basePrint + PVC_SURCHARGE;
        else if (material === 'VINILO_SOLO') price = basePrint * VINYL_DISCOUNT_FACTOR;
        else price = basePrint + WOOD_CUSTOM_CUT_SURCHARGE;
      }
    }
    if (price > 0) setUnitPrice(String(Number(price.toFixed(2))));
  }, [mode, material, selectedSize, customWidth, customHeight]);

  if (!isOpen) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Formato inválido. Solo se admiten imágenes JPEG, PNG o WebP.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setUploadError('La imagen supera el límite máximo permitido de 15MB.');
      return;
    }
    setUploadError('');
    setUploadSuccess(false);
    setPreviewUrl(URL.createObjectURL(file));
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch('/api/sales/upload-art', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        setCustomImageUrl(json.url);
        setUploadSuccess(true);
      } else {
        setUploadError(json.error || 'Fallo al subir a Google Storage.');
      }
    } catch {
      setUploadError('Error de conexión al transferir a Cloud Storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!description.trim()) return setErrorMsg('Ingresa una descripción para el diseño.');
    if (mode === 'CUSTOM' && (!Number(customWidth) || !Number(customHeight))) {
      return setErrorMsg('Ingresa un ancho y alto válidos en centímetros.');
    }
    const priceNum = Number(unitPrice);
    if (isNaN(priceNum) || priceNum <= 0) return setErrorMsg('Ingresa un precio válido mayor a Q 0.');

    const dims = mode === 'STANDARD'
      ? `Estándar: ${selectedSize.nombre} (${selectedSize.dimensiones})`
      : `Especial: ${customWidth.trim()} x ${customHeight.trim()} cm (Corte Taller)`;

    onAddCustomItem({
      description: description.trim(),
      material,
      customDimensions: dims,
      unitPrice: priceNum,
      quantity: Number(quantity) || 1,
      customImageUrl: customImageUrl.trim() || null,
    });
    onClose();
  };

  const widthNum = Number(customWidth) || 0;
  const heightNum = Number(customHeight) || 0;
  const area = widthNum * heightNum;
  const basePrint = area * CUSTOM_CM2_RATE;

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-[#121212] border border-neutral-800 rounded-[28px] p-5 max-w-lg w-full shadow-2xl text-white space-y-3.5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-amber-400" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Cotizador de Pedido Personalizado</h3>
          </div>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">⚠️ {errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Descripción del Cuadro / Obra *</label>
            <input type="text" value={description} onChange={(e) => { setDescription(e.target.value); setErrorMsg(''); }} placeholder="Ej. Retrato Anime Personalizado, Foto de Boda..." className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white focus:border-amber-400 text-xs focus:outline-none" />
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Material de Fabricación</label>
            <div className="grid grid-cols-3 gap-1.5">
              {MATERIALS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMaterial(m.id)} className={`min-h-[44px] p-2 rounded-xl text-left border transition-colors cursor-pointer ${material === m.id ? 'bg-amber-400/10 border-amber-400 text-amber-300' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'}`}>
                  <span className="block font-bold text-xs">{m.label}</span>
                  <span className="text-[10px] text-neutral-500 block truncate">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 mb-2">
              <button type="button" onClick={() => setMode('STANDARD')} className={`flex-1 min-h-[44px] rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'STANDARD' ? 'bg-amber-400 text-black shadow' : 'text-neutral-400 hover:text-white'}`}>
                <Sparkles className="w-3.5 h-3.5" /><span>Medidas Oficiales</span>
              </button>
              <button type="button" onClick={() => setMode('CUSTOM')} className={`flex-1 min-h-[44px] rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'CUSTOM' ? 'bg-amber-400 text-black shadow' : 'text-neutral-400 hover:text-white'}`}>
                <Ruler className="w-3.5 h-3.5" /><span>Medida Especial (cm²)</span>
              </button>
            </div>

            {mode === 'STANDARD' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {OFFICIAL_SIZES.map((sz) => {
                  const isSel = selectedSize.sizeId === sz.sizeId;
                  const price = material === 'PVC_5MM' ? sz.precio + PVC_SURCHARGE : material === 'VINILO_SOLO' ? sz.precio * VINYL_DISCOUNT_FACTOR : sz.precio;
                  return (
                    <button key={sz.sizeId} type="button" onClick={() => setSelectedSize(sz)} className={`p-2 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer ${isSel ? 'border-amber-400 bg-amber-400/10 text-white' : 'border-neutral-800 bg-black text-neutral-300 hover:border-neutral-700'}`}>
                      <div className="flex justify-between items-center"><span className="font-bold">{sz.nombre}</span><span className="font-mono text-amber-400 font-black">Q{price}</span></div>
                      <span className="text-[10px] text-neutral-400 block">{sz.dimensiones}</span>
                      <span className="text-[9px] text-neutral-500 block truncate">{sz.badge}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2 p-3 bg-black/60 rounded-xl border border-neutral-800">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Ancho (cm) *</label>
                    <input type="number" min="5" max="300" placeholder="Ej. 48" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full min-h-[44px] px-3 bg-black border border-neutral-800 rounded-xl font-mono text-white focus:border-amber-400 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Alto (cm) *</label>
                    <input type="number" min="5" max="300" placeholder="Ej. 68" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full min-h-[44px] px-3 bg-black border border-neutral-800 rounded-xl font-mono text-white focus:border-amber-400 focus:outline-none" />
                  </div>
                </div>
                {area > 0 && (
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Área: <strong className="text-white font-mono">{area.toLocaleString()} cm²</strong></span>
                    {material === 'MDF_5_5MM' && (
                      <span className="text-amber-400 flex items-center gap-1 font-semibold">
                        <Scissors className="w-3.5 h-3.5" />Base Q{basePrint.toFixed(2)} + Q25 corte taller
                      </span>
                    )}
                    {material === 'PVC_5MM' && <span className="text-sky-400 font-semibold">Base Q{basePrint.toFixed(2)} + Q15 PVC</span>}
                    {material === 'VINILO_SOLO' && <span className="text-emerald-400 font-semibold">Base Q{basePrint.toFixed(2)} x 50% lámina</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Precio Acordado (Q) *</label>
              <input type="number" min="1" step="0.5" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:border-amber-400 focus:outline-none" />
            </div>
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Cantidad</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:border-amber-400 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Arte o Foto para Producción</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer?.files?.[0]); }}
              className={`p-3 rounded-2xl border-2 border-dashed transition-colors flex flex-col items-center justify-center gap-1 text-center min-h-[70px] ${uploadSuccess ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-800 hover:border-neutral-600 bg-black/40'}`}
            >
              {isUploading ? (
                <div className="flex items-center gap-2 text-amber-400 font-semibold"><Loader2 className="w-4 h-4 animate-spin" /><span>Subiendo a Cloud Storage...</span></div>
              ) : uploadSuccess ? (
                <div className="flex items-center gap-2 text-emerald-400 font-bold"><CheckCircle2 className="w-4 h-4" /><span>✓ Arte en la nube listo para taller</span></div>
              ) : (
                <label className="cursor-pointer flex items-center gap-2 text-neutral-400 hover:text-white">
                  <Upload className="w-4 h-4 text-amber-400" />
                  <span className="text-[11px]">Arrastra imagen o haz clic para subir (JPEG, PNG, WebP max 15MB)</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => handleFileUpload(e.target.files?.[0])} className="hidden" />
                </label>
              )}
              {previewUrl && (
                <div className="flex items-center gap-2 mt-1">
                  <img src={previewUrl} alt="Preview" className="w-10 h-10 object-cover rounded-lg border border-neutral-700" />
                  <span className="text-[10px] text-neutral-400 truncate max-w-[200px]">{customImageUrl || 'Previsualización local'}</span>
                </div>
              )}
              {uploadError && <span className="text-[10px] text-red-400 mt-1">⚠️ {uploadError}</span>}
            </div>

            <button type="button" onClick={() => setShowUrlInput(!showUrlInput)} className="text-[10px] text-neutral-500 hover:text-neutral-300 mt-1 underline cursor-pointer">
              {showUrlInput ? 'Ocultar enlace manual' : '+ Ingresar enlace URL externo (Drive, Dropbox...)'}
            </button>

            {showUrlInput && (
              <input type="url" value={customImageUrl} onChange={(e) => setCustomImageUrl(e.target.value)} placeholder="https://storage.googleapis.com/... o enlace de foto" className="w-full min-h-[44px] px-3.5 mt-1 bg-black border border-neutral-800 rounded-xl text-white font-mono text-[11px] focus:border-amber-400 focus:outline-none" />
            )}
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
            <button type="button" onClick={onClose} className="min-h-[44px] px-4 rounded-xl text-neutral-400 hover:text-white font-semibold cursor-pointer">Cancelar</button>
            <button type="submit" className="min-h-[44px] px-5 rounded-xl bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md">
              <Plus className="w-4 h-4" /><span>Agregar al Pedido</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
