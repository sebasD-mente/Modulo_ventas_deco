import React from 'react';
import { X, CheckCircle2, AlertCircle, Banknote, CreditCard, Smartphone, Loader2, FileEdit } from 'lucide-react';
import useEditSaleForm from './sales/edit/hooks/useEditSaleForm';
import EditSaleItemsTable from './sales/edit/EditSaleItemsTable';
// Immutability: setItems((prevItems) => { updated[idx] = { ...current, }; return prevItems.filter(

const METHODS = [{ id: 'EFECTIVO', label: '💵 Efectivo', icon: Banknote }, { id: 'TARJETA', label: '💳 Tarjeta', icon: CreditCard }, { id: 'TRANSFERENCIA', label: '📲 Transfer', icon: Smartphone }];

export default function EditSaleModal({ sale, onClose, onSaved, onSaleUpdated }) {
  if (!sale) return null;
  const { paymentMethod, setPaymentMethod, items, discount, setDiscount, notes, setNotes,
    isSaving, errorMsg, grandTotal, handleUpdateQuantity, handleRemoveItem, handleSaveChanges } = useEditSaleForm({ sale, onClose, onSaved, onSaleUpdated });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-[#141414] border border-neutral-800 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-white">
        <div className="px-6 py-4 bg-[#181818] border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-white" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">Editar venta <span className="font-mono text-white">{sale.saleNumber}</span></h3>
              <p className="text-[11px] text-neutral-400">Ajusta método de pago, cantidades o notas de esta transacción</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white p-1 rounded-lg cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSaveChanges} className="p-5 overflow-y-auto space-y-4 no-scrollbar text-xs">
          {errorMsg && <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMsg}</span></div>}
          <div>
            <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5">1. Desplegar método de pago (1 Toque)</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" onClick={() => setPaymentMethod(id)}
                  className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs cursor-pointer ${
                    paymentMethod === id ? 'bg-white text-black border-white shadow-md font-black' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
                  }`}><Icon className="w-4 h-4" /><span>{label}</span></button>
              ))}
            </div>
          </div>
          <EditSaleItemsTable items={items} onUpdateQuantity={handleUpdateQuantity} onRemoveItem={handleRemoveItem} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Descuento Opcional (Q)</label>
              <input type="number" min="0" step="5" value={discount} onChange={(e) => setDiscount(Math.max(0, Number(e.target.value) || 0))} className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white font-mono" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">Nota / Referencia</label>
              <input type="text" placeholder="Ej. No. autorización, cliente..." value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-white" />
            </div>
          </div>
          <div className="pt-3 border-t border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div><span className="text-[10px] text-neutral-400 block">Total Recalculado:</span><span className="text-2xl font-black text-emerald-400 font-mono">Q {grandTotal.toFixed(2)}</span></div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2.5 rounded-xl border border-neutral-800 text-neutral-400 text-xs font-bold hover:text-white hover:border-neutral-700 cursor-pointer">Cancelar</button>
              <button type="submit" disabled={isSaving || items.length === 0} className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50 cursor-pointer transition-transform active:scale-95">
                {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Guardando...</span></> : <><CheckCircle2 className="w-4 h-4" /><span>Guardar cambios</span></>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
