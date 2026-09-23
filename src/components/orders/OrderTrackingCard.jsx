import React, { useState } from 'react';
import {
  Clock,
  User,
  Phone,
  MapPin,
  Package,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Truck,
  DollarSign,
  CheckCircle2,
} from 'lucide-react';

export default function OrderTrackingCard({ order, onOpenPayment, onOpenDelivery }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const balanceDue = Number(order.balanceDue || 0);
  const totalAmount = Number(order.totalAmount || 0);
  const depositAmount = Number(order.depositAmount || 0);

  // 1. Badge Financiero
  let finBadge = { label: '🟢 PAGADO TOTAL', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
  if (order.paymentStatus === 'PENDIENTE_PAGO' || balanceDue >= totalAmount) {
    finBadge = { label: '🔴 PENDIENTE PAGO', color: 'bg-rose-950/80 text-rose-300 border-rose-800' };
  } else if (balanceDue > 0) {
    finBadge = { label: `🟡 ANTICIPO (Saldo Q ${balanceDue.toFixed(2)})`, color: 'bg-amber-950/80 text-amber-300 border-amber-800' };
  }

  // 2. Badge Taller (derivado de los ítems)
  const items = order.items || [];
  const allPrinted = items.length > 0 && items.every((it) => it.productionStatus === 'IMPRESO');
  const anyInProduction = items.some((it) => it.productionStatus === 'A_PRODUCCION');
  let workshopBadge = { label: '⏳ PENDIENTE TALLER', color: 'bg-neutral-900 text-neutral-400 border-neutral-800' };
  if (allPrinted) {
    workshopBadge = { label: '✅ IMPRESO EN TALLER', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
  } else if (anyInProduction) {
    workshopBadge = { label: '🖨️ EN PRODUCCIÓN', color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800' };
  }

  // 3. Badge Logística
  let logBadge = { label: '📦 EN PREPARACIÓN', color: 'bg-neutral-900 text-neutral-400 border-neutral-800' };
  if (order.status === 'ENTREGADO') {
    logBadge = { label: '✅ ENTREGADO', color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800' };
  } else if (order.shippingTrackingNumber) {
    logBadge = {
      label: `🚚 EN RUTA (${order.shippingCourier || 'Guía'}: #${order.shippingTrackingNumber})`,
      color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800',
    };
  }

  // WhatsApp Link Generador
  const rawPhone = (order.customer?.phone || '').replace(/\D/g, '');
  const waPhone = rawPhone.length === 8 ? `502${rawPhone}` : rawPhone;
  const customerName = order.customer?.fullName || 'estimado cliente';
  const waMessage = `¡Hola ${customerName}! Te saludamos de Deco Vintage Guate para darte seguimiento a tu pedido #${order.saleNumber}. ${
    order.status === 'ENTREGADO'
      ? 'Nos alegra informarte que tu pedido ya fue entregado. ¡Esperamos que lo disfrutes mucho!'
      : order.shippingTrackingNumber
      ? `Tu paquete va en camino mediante ${order.shippingCourier || 'transportadora'} con guía #${order.shippingTrackingNumber}.${balanceDue > 0 ? ` Recuerda que tienes un saldo pendiente de Q ${balanceDue.toFixed(2)} contra entrega.` : ''}`
      : allPrinted
      ? 'Tus obras ya fueron impresas en nuestro taller y están listas para empaque y despacho.'
      : 'Tus obras personalizadas están actualmente en proceso de impresión en nuestro taller.'
  }`;
  const waUrl = waPhone ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}` : null;

  const dateStr = order.createdAt ? new Date(order.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }) : '';
  const timeStr = order.createdAt ? new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div className="bg-black border border-neutral-800 rounded-2xl p-4 space-y-3.5 shadow-md hover:border-neutral-700 transition-all">
      {/* Header: Ticket, Vendedor, Fecha */}
      <div className="flex items-center justify-between border-b border-neutral-900 pb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-black text-white bg-neutral-900 border border-neutral-800 px-2.5 py-0.5 rounded-lg">
            #{order.saleNumber}
          </span>
          <span className="text-xs text-neutral-400">
            Vendedor: <strong className="text-neutral-200">{order.seller?.fullName || 'Vendedor'}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 font-mono">
          <Clock className="w-3.5 h-3.5" />
          <span>{dateStr} {timeStr}</span>
        </div>
      </div>

      {/* Badges de Estado en 3 Columnas/Píldoras */}
      <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-black uppercase tracking-wider">
        <span className={`px-2.5 py-1 rounded-lg border ${finBadge.color}`}>{finBadge.label}</span>
        <span className={`px-2.5 py-1 rounded-lg border ${workshopBadge.color}`}>{workshopBadge.label}</span>
        <span className={`px-2.5 py-1 rounded-lg border ${logBadge.color}`}>{logBadge.label}</span>
      </div>

      {/* Datos del Cliente y Envío */}
      <div className="bg-neutral-950 border border-neutral-900 rounded-xl p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-white font-bold">
            <User className="w-3.5 h-3.5 text-neutral-400" />
            <span className="truncate">{customerName}</span>
          </div>
          {order.customer?.phone && (
            <div className="flex items-center gap-1.5 text-neutral-400">
              <Phone className="w-3.5 h-3.5 text-neutral-500" />
              <span>{order.customer.phone}</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-start gap-1.5 text-neutral-300">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
            <span className="leading-snug">
              {order.deliveryMethod === 'PUNTO_VENTA'
                ? `Retiro en feria: ${order.pickupEvent?.name || 'Stand'}`
                : `${order.customer?.deliveryAddress || 'Dirección no indicada'}, ${order.customer?.municipality || ''} ${order.customer?.department || ''}`}
            </span>
          </div>
        </div>
      </div>

      {/* Resumen Financiero y Botón de Desglose de Obras */}
      <div className="flex items-center justify-between text-xs pt-1">
        <div className="flex items-center gap-3">
          <div>Total: <strong className="text-white font-mono">Q {totalAmount.toFixed(2)}</strong></div>
          <div>Anticipo: <strong className="text-emerald-400 font-mono">Q {depositAmount.toFixed(2)}</strong></div>
          {balanceDue > 0 ? (
            <div>Saldo: <strong className="text-amber-400 font-mono font-bold">Q {balanceDue.toFixed(2)}</strong></div>
          ) : (
            <div className="text-emerald-400 font-bold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Solventado</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-xs text-neutral-400 hover:text-white flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-neutral-900 transition-colors cursor-pointer"
        >
          <span>{items.length} {items.length === 1 ? 'obra' : 'obras'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Lista Desplegable de Obras del Pedido */}
      {isExpanded && (
        <div className="space-y-2 pt-2 border-t border-neutral-900">
          {items.map((it) => (
            <div key={it.id} className="flex items-center justify-between gap-2 p-2 bg-neutral-950 rounded-xl border border-neutral-900 text-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-neutral-900 border border-neutral-800 overflow-hidden shrink-0 flex items-center justify-center">
                  {it.customImageUrl ? (
                    <img src={it.customImageUrl} alt={it.description} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-4 h-4 text-neutral-600" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-white truncate">{it.description}</div>
                  <div className="text-[11px] text-neutral-400">
                    Cant: {it.quantity} • {it.customDimensions || it.material || 'Estándar'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-300 shrink-0">
                {it.productionStatus}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Fila de Acciones Rápidas Táctiles (>= 44px) */}
      <div className="pt-2 border-t border-neutral-900 flex items-center justify-end gap-2 flex-wrap">
        {balanceDue > 0 && (
          <button
            type="button"
            onClick={() => onOpenPayment(order)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
          >
            <DollarSign className="w-3.5 h-3.5 text-black" />
            <span>Cobrar Saldo (Q {balanceDue.toFixed(2)})</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => onOpenDelivery(order)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer"
        >
          <Truck className="w-3.5 h-3.5 text-cyan-400" />
          <span>Guía / Despacho</span>
        </button>

        {waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95"
            title="Enviar mensaje de seguimiento por WhatsApp"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>WhatsApp</span>
          </a>
        )}
      </div>
    </div>
  );
}
