import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Truck, X, Loader2, CheckCircle2 } from 'lucide-react';

export default function OrderDeliveryModal({ sale, onClose, onSuccess }) {
  const { authFetch } = useAuth();
  const [courier, setCourier] = useState(sale?.shippingCourier || '');
  const [trackingNumber, setTrackingNumber] = useState(sale?.shippingTrackingNumber || '');
  const [isDelivered, setIsDelivered] = useState(sale?.status === 'ENTREGADO');
  const [deliveryReceiptUrl, setDepositReceiptUrl] = useState('');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  if (!sale) return null;

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setReceiptError('El comprobante supera el límite de 15MB.');
      return;
    }
    setReceiptError(null);
    setIsUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch('/api/sales/upload-art', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        setDepositReceiptUrl(json.url);
      } else {
        setReceiptError(json.error || 'Error subiendo comprobante de entrega.');
      }
    } catch {
      setReceiptError('Error de conexión al subir comprobante.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await authFetch(`/api/sales/${sale.id}/delivery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shippingCourier: courier,
          shippingTrackingNumber: trackingNumber,
          isDelivered,
          deliveryReceiptUrl: deliveryReceiptUrl || null,
          deliveryNotes: deliveryNotes?.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al actualizar logística de entrega.');
      }

      onSuccess(data.data);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none animate-fadeIn">
      <div className="bg-neutral-950 border border-neutral-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto no-scrollbar">
        <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/60 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Logística y Envío • #{sale.saleNumber}
              </h3>
              <p className="text-xs text-neutral-400">
                {sale.customer?.fullName || 'Cliente'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-950/40 border border-rose-800/60 rounded-xl text-xs text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Empresa Transportadora / Modalidad
            </label>
            <input
              type="text"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="Ej. Entrega en Taller, Entrega en Stand, Guatex..."
              className="w-full min-h-[44px] bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400"
            />
            <div className="flex gap-2 mt-2.5 flex-wrap">
              {['Entrega en Taller', 'Entrega en Stand', 'Guatex', 'Forzap', 'Cargo Expreso', 'Mensajería Propia'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCourier(c)}
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center ${
                    courier === c
                      ? 'bg-cyan-400 text-black border-cyan-400 font-bold shadow-sm'
                      : 'bg-neutral-900 hover:bg-neutral-800 border-neutral-800 text-neutral-300'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Número de Guía / Rastreo (Opcional)
            </label>
            <input
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Ej. GT-89342918 o Recibido por cliente"
              className="w-full min-h-[44px] bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Comprobante / Recibo de Entrega (Foto)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
              className="w-full min-h-[44px] text-xs text-neutral-300 file:min-h-[44px] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:bg-neutral-900 file:text-white file:font-semibold hover:file:bg-neutral-800 cursor-pointer"
            />
            {isUploadingReceipt && (
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 mt-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Subiendo comprobante de entrega...</span>
              </div>
            )}
            {deliveryReceiptUrl && (
              <div className="text-[11px] text-emerald-400 font-bold mt-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Comprobante adjuntado correctamente</span>
              </div>
            )}
            {receiptError && <p className="text-xs text-rose-400 mt-1">{receiptError}</p>}
          </div>

          <div>
            <label className="block text-xs font-bold text-neutral-400 uppercase tracking-wider mb-1.5">
              Notas de Entrega (Opcional)
            </label>
            <input
              type="text"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              placeholder="Ej. Entregado en mano a cliente con DPI..."
              className="w-full min-h-[44px] bg-black border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-white placeholder:text-neutral-600 focus:outline-none focus:border-cyan-400"
            />
          </div>

          <label className="flex items-center gap-3 p-3 bg-black border border-neutral-800 rounded-xl cursor-pointer hover:border-neutral-700 transition-colors">
            <input
              type="checkbox"
              checked={isDelivered}
              onChange={(e) => setIsDelivered(e.target.checked)}
              className="w-5 h-5 rounded border-neutral-700 bg-neutral-900 text-cyan-400 focus:ring-0 cursor-pointer"
            />
            <div className="text-xs">
              <span className="font-bold text-white block">Marcar como ENTREGADO</span>
              <span className="text-neutral-400 text-[11px]">
                El cliente ya recibió físicamente sus obras y paquetes.
              </span>
            </div>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[44px] bg-neutral-900 hover:bg-neutral-800 text-neutral-300 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploadingReceipt}
              className="flex-1 min-h-[44px] bg-cyan-400 hover:bg-cyan-300 text-black font-black text-xs rounded-xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 text-black" />
                  <span>Guardar Logística</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
