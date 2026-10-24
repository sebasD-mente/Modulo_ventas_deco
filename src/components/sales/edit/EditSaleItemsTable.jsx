import React, { useState, useEffect } from 'react';
import { Plus, Minus, Trash2, Image as ImageIcon, RefreshCw, Search, X, Loader2 } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { searchPostersWithFallback } from '../../../services/catalogCacheService';

export default function EditSaleItemsTable({ items, onUpdateQuantity, onRemoveItem, onReplaceItem }) {
  const { authFetch } = useAuth();
  const [swappingIdx, setSwappingIdx] = useState(null);
  const [swapQuery, setSwapQuery] = useState('');
  const [swapResults, setSwapResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (swappingIdx === null || !swapQuery.trim()) { setSwapResults([]); setIsSearching(false); return; }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const q = swapQuery.trim();
        const resList = await searchPostersWithFallback(
          async (signal) => {
            const r = await authFetch(`/api/catalog/web-posters?q=${encodeURIComponent(q)}&limit=20`, { signal });
            const j = await r.json();
            return j.success ? (j.data || []) : [];
          },
          q, 20
        );
        setSwapResults(resList || []);
      } catch (_) { setSwapResults([]); } finally { setIsSearching(false); }
    }, 150);
    return () => clearTimeout(timer);
  }, [swapQuery, swappingIdx]);

  return (
    <div>
      <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">2. Pósters en la venta ({items.length})</label>
      <div className="space-y-2.5 max-h-72 overflow-y-auto no-scrollbar">
        {items.map((it, idx) => {
          const img = it.customImageUrl || it.product?.imageUrl || it.imageUrl || it.thumbUrl;
          const isSwapping = swappingIdx === idx;
          return (
            <div key={it.id || idx} className="p-3 rounded-2xl bg-black border border-neutral-800 flex flex-col gap-2.5 text-xs">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {img ? (
                    <img src={img} alt={it.description} className="w-11 h-14 rounded-lg object-cover bg-neutral-900 border border-neutral-800 shrink-0" />
                  ) : (
                    <div className="w-11 h-14 rounded-lg bg-neutral-900 border border-neutral-800 shrink-0 flex items-center justify-center text-neutral-600"><ImageIcon className="w-4 h-4" /></div>
                  )}
                  <div className="min-w-0 flex-1 space-y-1">
                    <span className="font-bold text-white block leading-snug break-words">{it.description}</span>
                    <span className="text-[11px] text-neutral-400 font-mono block whitespace-nowrap">Precio unitario: Q {Number(it.unitPrice).toFixed(2)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => onRemoveItem(idx)} className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-500 hover:text-red-400 p-2 rounded-xl hover:bg-red-950/30 transition-colors cursor-pointer shrink-0" title="Eliminar este ítem"><Trash2 className="w-4 h-4" /></button>
              </div>

              {isSwapping && (
                <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-700 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input type="text" value={swapQuery} onChange={(e) => setSwapQuery(e.target.value)} placeholder="Buscar nuevo diseño en catálogo..." autoFocus className="w-full min-h-[44px] bg-black border border-neutral-700 rounded-xl pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-white" />
                    </div>
                    <button type="button" onClick={() => { setSwappingIdx(null); setSwapQuery(''); }} className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-neutral-900 text-neutral-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                  {isSearching && <div className="text-[11px] text-neutral-400 flex items-center gap-1.5 px-1"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...</div>}
                  {swapResults.length > 0 && (
                    <div className="max-h-44 overflow-y-auto space-y-1 no-scrollbar">
                      {swapResults.map((p) => (
                        <button key={p.id} type="button" onClick={() => { onReplaceItem && onReplaceItem(idx, p); setSwappingIdx(null); setSwapQuery(''); }} className="w-full p-2 rounded-xl bg-black hover:bg-neutral-900 border border-neutral-800 flex items-center gap-2.5 text-left cursor-pointer transition-colors">
                          <img src={p.thumbUrl || p.imageUrl} alt="" className="w-8 h-10 object-cover rounded border border-neutral-700 shrink-0 bg-neutral-900" />
                          <div className="min-w-0 flex-1 truncate">
                            <span className="text-[9px] font-bold text-neutral-400 uppercase block">{p.categoria || 'ARTE'}</span>
                            <span className="font-bold text-xs text-white block truncate">{p.titulo}</span>
                            {p.subtitulo && <span className="text-[10px] text-neutral-400 block truncate">{p.subtitulo}</span>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-neutral-900 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-[#181818] p-1 rounded-xl border border-neutral-800 shrink-0">
                    <button type="button" onClick={() => onUpdateQuantity(idx, -1)} className="min-w-[44px] min-h-[44px] rounded-lg bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-base cursor-pointer active:scale-95 transition-all" title="Disminuir cantidad"><Minus className="w-4 h-4" /></button>
                    <span className="w-6 text-center font-bold text-sm text-white">{it.quantity}</span>
                    <button type="button" onClick={() => onUpdateQuantity(idx, 1)} className="min-w-[44px] min-h-[44px] rounded-lg bg-neutral-900 border border-neutral-700 hover:bg-neutral-800 text-white flex items-center justify-center font-bold text-base cursor-pointer active:scale-95 transition-all" title="Aumentar cantidad"><Plus className="w-4 h-4" /></button>
                  </div>
                  <button type="button" onClick={() => { setSwappingIdx(isSwapping ? null : idx); setSwapQuery(''); }} className="min-h-[44px] px-3 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors">
                    <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" /><span>Cambiar diseño</span>
                  </button>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] text-neutral-400 block">Subtotal</span>
                  <span className="font-mono font-bold text-emerald-400 block text-sm whitespace-nowrap">Q {(it.quantity * it.unitPrice).toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
