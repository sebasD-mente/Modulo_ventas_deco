import React from 'react';
import { Truck, Store, MapPin, PackageCheck } from 'lucide-react';

const COURIERS = [
  { id: 'GUATEX', label: 'Guatex' },
  { id: 'FORZA', label: 'Forza Delivery' },
  { id: 'MENSAJERIA_LOCAL', label: 'Mensajería Local' },
  { id: 'OTRO', label: 'Otro Courier' },
];

const SHIPPING_PRESETS = [
  { label: 'Q35 (Capital / Mixco)', amount: 35 },
  { label: 'Q40 (Departamental)', amount: 40 },
  { label: 'Q0 (Envío Gratis)', amount: 0 },
];

export default function DeliveryMethodSelector({
  deliveryMethod,
  setDeliveryMethod,
  shippingCost,
  setShippingCost,
  shippingCourier,
  setShippingCourier,
  shippingTrackingNumber,
  setShippingTrackingNumber,
  pickupEventId,
  setPickupEventId,
  availablePickupEvents = [],
}) {
  return (
    <div className="space-y-3 p-4 rounded-2xl bg-black border border-neutral-800 text-xs">
      <label className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
        <Truck className="w-3.5 h-3.5 text-cyan-400" />
        <span>2. Método de Entrega & Logística</span>
      </label>

      {/* Grid de Métodos de Entrega */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => {
            setDeliveryMethod('ENVIO_COURIER');
            if (shippingCost === 0) setShippingCost(35);
          }}
          className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            deliveryMethod === 'ENVIO_COURIER'
              ? 'bg-cyan-500 text-black shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span>Envío por Courier</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDeliveryMethod('RETIRO_EVENTO');
            setShippingCost(0);
          }}
          className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            deliveryMethod === 'RETIRO_EVENTO'
              ? 'bg-amber-400 text-black shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <Store className="w-4 h-4 shrink-0" />
          <span>Retiro en Stand</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDeliveryMethod('PUNTO_VENTA');
            setShippingCost(0);
          }}
          className={`min-h-[48px] px-3 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
            deliveryMethod === 'PUNTO_VENTA'
              ? 'bg-purple-500 text-white shadow-md'
              : 'bg-neutral-900 text-neutral-400 hover:text-white border border-neutral-800'
          }`}
        >
          <PackageCheck className="w-4 h-4 shrink-0" />
          <span>Punto de Venta</span>
        </button>
      </div>

      {/* Opciones según método */}
      {deliveryMethod === 'ENVIO_COURIER' && (
        <div className="p-3 rounded-xl bg-neutral-900/90 border border-neutral-800 space-y-3">
          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">Tarifas de Flete Sugeridas</label>
            <div className="flex flex-wrap gap-1.5">
              {SHIPPING_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => setShippingCost(preset.amount)}
                  className={`min-h-[44px] px-3 py-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    Number(shippingCost) === preset.amount
                      ? 'bg-white text-black'
                      : 'bg-black text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Costo Flete Personalizado (Q)</label>
              <input
                type="number"
                min="0"
                step="5"
                value={shippingCost}
                onChange={(e) => setShippingCost(Number(e.target.value) || 0)}
                className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Empresa de Courier</label>
              <select
                value={shippingCourier}
                onChange={(e) => setShippingCourier(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                {COURIERS.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Número de Guía / Tracking (Opcional)</label>
            <input
              type="text"
              value={shippingTrackingNumber}
              onChange={(e) => setShippingTrackingNumber(e.target.value)}
              placeholder="Ej. GT-987654321"
              className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
      )}

      {deliveryMethod === 'RETIRO_EVENTO' && (
        <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 space-y-2">
          <span className="font-semibold block flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>Retiro en Stand Ferial (Flete Q0.00)</span>
          </span>
          <p className="text-[11px] text-amber-300/80">
            El cliente recogerá su pedido en el stand del evento asignado:
          </p>
          <div>
            <select
              value={pickupEventId}
              onChange={(e) => setPickupEventId(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 bg-black border border-amber-500/30 rounded-xl text-white focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="">-- Selecciona el evento ferial de retiro --</option>
              {availablePickupEvents.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} ({evt.location || 'Feria'})
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {deliveryMethod === 'PUNTO_VENTA' && (
        <div className="p-3 rounded-xl bg-neutral-900/60 border border-neutral-800 text-neutral-400 text-[11px]">
          <span>Entrega física directa sin cargo de envío. Total de flete: <strong>Q 0.00</strong>.</span>
        </div>
      )}
    </div>
  );
}
