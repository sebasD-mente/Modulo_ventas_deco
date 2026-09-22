import React, { useState } from 'react';
import { Smartphone, Copy, Check, X, Share2, CheckCircle2 } from 'lucide-react';

export default function WhatsAppQuoteShareModal({
  isOpen,
  onClose,
  sale,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !sale) return null;

  const fullName = sale.customer?.fullName || sale.customerName || 'Estimado(a) Cliente';
  const saleNumber = sale.saleNumber || 'ORDEN';
  const items = sale.items || [];
  const totalAmount = Number(sale.totalAmount || 0).toFixed(2);
  const depositAmount = Number(sale.depositAmount || 0).toFixed(2);
  const balanceDue = Number(sale.balanceDue || 0).toFixed(2);
  const paymentStatus = sale.paymentStatus || (Number(balanceDue) > 0 ? 'ANTICIPO_PAGADO' : 'PAGADO_TOTAL');

  const deliveryDescription = sale.deliveryMethod === 'ENVIO_COURIER'
    ? `${sale.shippingCourier || 'Courier'} a ${sale.customer?.deliveryAddress || 'Dirección de envío'}`
    : sale.deliveryMethod === 'RETIRO_EVENTO'
    ? 'Retiro en Stand de Feria'
    : 'Entrega en Punto de Venta';

  const formattedItems = items
    .map((it) => {
      let line = `• ${it.quantity}x ${it.description} — Q ${Number(it.subtotal || 0).toFixed(2)}`;
      if (it.customImageUrl) {
        line += `\n  🖼️ *Arte / Diseño Aprobado:* ${it.customImageUrl}`;
      }
      return line;
    })
    .join('\n');

  const formattedText = `✨ *DECO VINTAGE GUATE — PEDIDO CONFIRMADO* ✨
Hola *${fullName}*, tu orden *#${saleNumber}* ha sido registrada con éxito:

📦 *Detalle:*
${formattedItems}

🚚 *Entrega:* ${deliveryDescription}
💰 *Total de la Orden:* Q ${totalAmount}
🟢 *Anticipo Registrado:* Q ${depositAmount} (${paymentStatus})
🔴 *Saldo Pendiente contra Entrega:* Q ${balanceDue}

Tu pedido entra hoy mismo a taller de producción. Te compartiremos tu guía de envío en cuanto sea despachado. ¡Gracias por tu preferencia!`;

  // Limpieza de teléfono para WhatsApp API
  const rawPhone = (sale.customer?.phone || '').replace(/[^0-9]/g, '');
  const cleanPhone = rawPhone.length === 8 ? `502${rawPhone}` : rawPhone;
  const waLink = cleanPhone
    ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(formattedText)}`
    : `https://wa.me/?text=${encodeURIComponent(formattedText)}`;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(formattedText);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Error al copiar al portapapeles:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    window.open(waLink, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#121212] border border-neutral-800 rounded-[32px] p-6 max-w-lg w-full shadow-2xl text-white space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-sm text-white uppercase tracking-wider">
              Comprobante / Cotización de WhatsApp
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

        <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>¡Pedido <strong>#{saleNumber}</strong> registrado exitosamente en el sistema!</span>
        </div>

        {/* Vista previa del mensaje */}
        <div>
          <label className="block text-[11px] text-neutral-400 font-semibold mb-1.5">
            Mensaje Formateado para el Cliente:
          </label>
          <pre className="p-3.5 bg-black border border-neutral-800 rounded-2xl text-[11px] text-neutral-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto no-scrollbar selection:bg-emerald-900 leading-relaxed">
            {formattedText}
          </pre>
        </div>

        {/* Botones de Acción */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="w-full min-h-[48px] px-6 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            <Smartphone className="w-5 h-5" />
            <span>📲 Abrir en WhatsApp ({sale.customer?.phone || 'Cliente'})</span>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 hover:text-white font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">¡Copiado! ✅</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>📋 Copiar Texto</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-white font-bold text-xs flex items-center justify-center transition-colors cursor-pointer"
            >
              Cerrar y Continuar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
