import React, { useState, useEffect, useCallback } from 'react';
import { Palette, X, Plus, Ruler, Sparkles, Scissors } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { OFFICIAL_SIZES, CUSTOM_CM2_RATE, WOOD_CUSTOM_CUT_SURCHARGE, PVC_SURCHARGE, VINYL_DISCOUNT_FACTOR } from './manualSaleConstants';
import { getLocalCatalog } from '../../services/catalogCacheService';
import CustomArtUploader, { revokeArtPreviewUrls } from './CustomArtUploader';

const MATERIALS = [
  { id: 'MDF_5_5MM', label: 'MDF 5.5mm', desc: 'Madera oficial' },
  { id: 'PVC_5MM', label: 'PVC 5mm', desc: 'Anti-humedad (+Q15)' },
  { id: 'VINILO_SOLO', label: 'Vinilo Solo', desc: 'Sin cuadro (-50%)' },
];

export function createInitialCustomModalState() {
  return {
    mode: 'STANDARD', material: 'MDF_5_5MM', selectedSize: null,
    customWidth: '', customHeight: '', unitPrice: '', quantity: 1,
    description: '', uploadedArts: [], customImageUrl: '',
    isUploading: false, uploadError: '', showUrlInput: false, errorMsg: '',
  };
}

export function buildCustomItemPayloads({
  description = '', material = 'MDF_5_5MM', customDimensions = '',
  unitPrice = 0, quantity = 1, uploadedArts = [], customImageUrl = '',
}) {
  const baseDesc = String(description || '').trim();
  const priceNum = Number(unitPrice) || 0;
  const qtyNum = Math.max(1, Number(quantity) || 1);
  const artUrls = [];
  if (Array.isArray(uploadedArts)) {
    for (const art of uploadedArts) {
      const cleanUrl = typeof art?.url === 'string' ? art.url.trim() : '';
      if (cleanUrl) artUrls.push(cleanUrl);
    }
  }
  const manualUrl = typeof customImageUrl === 'string' ? customImageUrl.trim() : '';
  if (manualUrl && !artUrls.includes(manualUrl)) artUrls.push(manualUrl);

  if (artUrls.length <= 1) {
    return [{ description: baseDesc, material, customDimensions, unitPrice: priceNum, quantity: qtyNum, customImageUrl: artUrls[0] || null }];
  }
  return artUrls.map((url, idx) => ({
    description: `${baseDesc} — Diseño ${idx + 1}/${artUrls.length}`,
    material, customDimensions, unitPrice: priceNum, quantity: qtyNum, customImageUrl: url,
  }));
}

export default function CustomItemModal({ isOpen, onClose, onAddCustomItem }) {
  const { authFetch } = useAuth();
  const availableSizes = React.useMemo(() => {
    try {
      const cat = getLocalCatalog();
      const ref = Array.isArray(cat) ? cat.find((p) => Array.isArray(p.sizes) && p.sizes.length >= 5 && p.categoria !== 'MUSICA') : null;
      if (ref?.sizes?.length) {
        return OFFICIAL_SIZES.map((off) => {
          const m = ref.sizes.find((s) => (s.sizeId || s.id) === off.sizeId);
          return m ? { ...off, precio: Number(m.precio || m.price) || off.precio, dimensiones: m.dimensiones || m.dimensions || off.dimensiones } : off;
        });
      }
    } catch (_) {}
    return OFFICIAL_SIZES;
  }, []);

  const [mode, setMode] = useState('STANDARD');
  const [material, setMaterial] = useState('MDF_5_5MM');
  const [selectedSize, setSelectedSize] = useState(null);
  const [customWidth, setCustomWidth] = useState('');
  const [customHeight, setCustomHeight] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [description, setDescription] = useState('');
  const [uploadedArts, setUploadedArts] = useState([]);
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const resetModalState = useCallback(() => {
    const initial = createInitialCustomModalState();
    setMode(initial.mode); setMaterial(initial.material); setSelectedSize(initial.selectedSize);
    setCustomWidth(initial.customWidth); setCustomHeight(initial.customHeight);
    setUnitPrice(initial.unitPrice); setQuantity(initial.quantity); setDescription(initial.description);
    setUploadedArts((prev) => { revokeArtPreviewUrls(prev); return []; });
    setCustomImageUrl(initial.customImageUrl); setIsUploading(initial.isUploading);
    setUploadError(initial.uploadError); setShowUrlInput(initial.showUrlInput); setErrorMsg(initial.errorMsg);
  }, []);

  useEffect(() => {
    if (isOpen) resetModalState();
  }, [isOpen, resetModalState]);

  useEffect(() => {
    let price = 0;
    if (mode === 'STANDARD') {
      if (selectedSize) {
        const base = selectedSize.precio || 0;
        price = material === 'PVC_5MM' ? base + PVC_SURCHARGE : material === 'VINILO_SOLO' ? base * VINYL_DISCOUNT_FACTOR : base;
      }
    } else {
      const w = Number(customWidth) || 0, h = Number(customHeight) || 0;
      if (w > 0 && h > 0) {
        const basePrint = w * h * CUSTOM_CM2_RATE;
        price = material === 'PVC_5MM' ? basePrint + PVC_SURCHARGE : material === 'VINILO_SOLO' ? basePrint * VINYL_DISCOUNT_FACTOR : basePrint + WOOD_CUSTOM_CUT_SURCHARGE;
      }
    }
    if (price > 0) setUnitPrice(String(Number(price.toFixed(2))));
  }, [mode, material, selectedSize, customWidth, customHeight]);

  if (!isOpen) return null;

  const handleClose = () => {
    resetModalState();
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isUploading) return setErrorMsg('Espera a que termine de subir la imagen a la nube.');
    if (!description.trim()) return setErrorMsg('Ingresa una descripción para el diseño.');
    if (mode === 'CUSTOM' && (!Number(customWidth) || !Number(customHeight))) {
      return setErrorMsg('Ingresa un ancho y alto válidos en centímetros.');
    }
    if (mode === 'STANDARD' && !selectedSize) {
      return setErrorMsg('Selecciona una medida estándar para el cuadro o cambia a Medida Especial.');
    }
    const priceNum = Number(unitPrice);
    if (isNaN(priceNum) || priceNum <= 0) return setErrorMsg('Ingresa un precio acordado válido mayor a Q 0.');

    const dims = mode === 'STANDARD'
      ? `Estándar: ${selectedSize?.nombre || 'Personalizado'} (${selectedSize?.dimensiones || 'N/A'})`
      : `Especial: ${customWidth.trim()} x ${customHeight.trim()} cm (Corte Taller)`;

    const payloads = buildCustomItemPayloads({
      description, material, customDimensions: dims, unitPrice: priceNum,
      quantity: Number(quantity) || 1, uploadedArts, customImageUrl,
    });
    for (const itemPayload of payloads) onAddCustomItem(itemPayload);
    resetModalState();
    onClose();
  };

  const widthNum = Number(customWidth) || 0;
  const heightNum = Number(customHeight) || 0;
  const area = widthNum * heightNum;
  const basePrint = area * CUSTOM_CM2_RATE;
  const totalArtsCount = uploadedArts.length + (customImageUrl.trim() && !uploadedArts.some((a) => a.url === customImageUrl.trim()) ? 1 : 0);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 overflow-y-auto">
      <div className="bg-[#121212] border border-neutral-800 rounded-[28px] p-5 max-w-lg w-full shadow-2xl text-white space-y-3.5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between pb-2.5 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-white" />
            <h3 className="font-bold text-sm uppercase tracking-wider">Cotizador de Pedido Personalizado</h3>
          </div>
          <button type="button" onClick={handleClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold">{errorMsg}</div>}

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Descripción del Cuadro / Obra *</label>
            <input type="text" value={description} onChange={(e) => { setDescription(e.target.value); setErrorMsg(''); }} placeholder="Ej. Retrato Anime Personalizado, Foto de Boda..." className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white focus:border-white text-xs focus:outline-none" />
          </div>

          <div>
            <label className="block text-neutral-400 font-semibold mb-1">Material de Fabricación</label>
            <div className="grid grid-cols-3 gap-1.5">
              {MATERIALS.map((m) => (
                <button key={m.id} type="button" onClick={() => setMaterial(m.id)} className={`min-h-[44px] p-2 rounded-xl text-left border transition-colors cursor-pointer ${material === m.id ? 'bg-white text-black border-white font-bold shadow-sm' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'}`}>
                  <span className="block font-bold text-xs">{m.label}</span>
                  <span className={`text-[10px] block truncate ${material === m.id ? 'text-neutral-700' : 'text-neutral-500'}`}>{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex bg-neutral-900 p-1 rounded-xl border border-neutral-800 mb-2">
              <button type="button" onClick={() => setMode('STANDARD')} className={`flex-1 min-h-[44px] rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'STANDARD' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'}`}><Sparkles className="w-3.5 h-3.5" /><span>Medidas Oficiales</span></button>
              <button type="button" onClick={() => setMode('CUSTOM')} className={`flex-1 min-h-[44px] rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${mode === 'CUSTOM' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'}`}><Ruler className="w-3.5 h-3.5" /><span>Medida Especial (cm²)</span></button>
            </div>

            {mode === 'STANDARD' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto pr-1">
                {availableSizes.map((sz) => {
                  const isSel = selectedSize?.sizeId === sz.sizeId;
                  const price = material === 'PVC_5MM' ? sz.precio + PVC_SURCHARGE : material === 'VINILO_SOLO' ? sz.precio * VINYL_DISCOUNT_FACTOR : sz.precio;
                  return (
                    <button key={sz.sizeId} type="button" onClick={() => setSelectedSize(sz)} className={`p-2 rounded-xl border text-left transition-all min-h-[44px] cursor-pointer ${isSel ? 'border-white bg-white/10 text-white font-bold ring-1 ring-white' : 'border-neutral-800 bg-black text-neutral-300 hover:border-neutral-700'}`}>
                      <div className="flex justify-between items-center"><span className="font-bold">{sz.nombre}</span><span className="font-mono text-emerald-400 font-black">Q{price}</span></div>
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
                    <input type="number" min="5" max="300" placeholder="Ej. 48" value={customWidth} onChange={(e) => setCustomWidth(e.target.value)} className="w-full min-h-[44px] px-3 bg-black border border-neutral-800 rounded-xl font-mono text-white focus:border-white focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-[11px] text-neutral-400 block mb-1">Alto (cm) *</label>
                    <input type="number" min="5" max="300" placeholder="Ej. 68" value={customHeight} onChange={(e) => setCustomHeight(e.target.value)} className="w-full min-h-[44px] px-3 bg-black border border-neutral-800 rounded-xl font-mono text-white focus:border-white focus:outline-none" />
                  </div>
                </div>
                {area > 0 && (
                  <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-between text-[11px]">
                    <span className="text-neutral-400">Área: <strong className="text-white font-mono">{area.toLocaleString()} cm²</strong></span>
                    {material === 'MDF_5_5MM' && <span className="text-neutral-300 flex items-center gap-1 font-semibold"><Scissors className="w-3.5 h-3.5 text-cyan-400" />Base Q{basePrint.toFixed(2)} + Q25 corte taller</span>}
                    {material === 'PVC_5MM' && <span className="text-sky-400 font-semibold">Base Q{basePrint.toFixed(2)} + Q15 PVC</span>}
                    {material === 'VINILO_SOLO' && <span className="text-emerald-400 font-semibold">Base Q{basePrint.toFixed(2)} x 50% lámina</span>}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Precio Unitario Acordado (Q) *</label>
              <input type="number" min="1" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:border-white focus:outline-none" />
            </div>
            <div>
              <label className="block text-neutral-400 font-semibold mb-1">Cantidad por Diseño</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full min-h-[44px] px-3.5 bg-black border border-neutral-800 rounded-xl text-white font-mono font-bold focus:border-white focus:outline-none" />
            </div>
          </div>

          <CustomArtUploader
            authFetch={authFetch} uploadedArts={uploadedArts} setUploadedArts={setUploadedArts}
            customImageUrl={customImageUrl} setCustomImageUrl={setCustomImageUrl}
            showUrlInput={showUrlInput} setShowUrlInput={setShowUrlInput}
            isUploading={isUploading} setIsUploading={setIsUploading}
            uploadError={uploadError} setUploadError={setUploadError}
          />

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-neutral-800">
            <button type="button" onClick={handleClose} className="min-h-[44px] px-4 rounded-xl text-neutral-400 hover:text-white font-semibold cursor-pointer">Cancelar</button>
            <button type="submit" disabled={isUploading} className="min-h-[44px] px-5 rounded-xl justify-center text-center bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed">
              <Plus className="w-4 h-4 shrink-0" />
              <span>{totalArtsCount > 1 ? `Agregar ${totalArtsCount} Diseños al Pedido` : 'Agregar al Pedido'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
