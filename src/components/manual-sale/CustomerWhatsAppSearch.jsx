import React from 'react';
import { Search, UserPlus, UserCheck, X, Phone, MapPin, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

const CHANNELS = [
  { id: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  { id: 'INSTAGRAM', label: 'Instagram', icon: '📸' },
  { id: 'FACEBOOK', label: 'Facebook', icon: '👍' },
  { id: 'TIKTOK', label: 'TikTok', icon: '🎵' },
  { id: 'OTRO', label: 'Otro', icon: '🌐' },
];

export default function CustomerWhatsAppSearch({
  customerQuery,
  setCustomerQuery,
  customerResults = [],
  isSearchingCustomer,
  selectedCustomer,
  customerData,
  setCustomerData,
  isInlineCreation,
  setIsInlineCreation,
  selectCustomer,
  clearSelectedCustomer,
  departments = [],
}) {
  const handleDataChange = (field, val) => {
    setCustomerData((prev) => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-3 p-4 rounded-2xl bg-black border border-neutral-800 text-xs">
      <div className="flex items-center justify-between">
        <label className="font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5 text-emerald-400" />
          <span>1. Cliente WhatsApp / CRM</span>
        </label>
        {selectedCustomer && (
          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold text-[10px]">
            Cliente Registrado
          </span>
        )}
      </div>

      {/* Caso A: Cliente ya seleccionado */}
      {selectedCustomer ? (
        <div className="p-3.5 rounded-xl bg-neutral-900 border border-emerald-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <UserCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <span className="font-bold text-white text-sm block truncate">{customerData.fullName}</span>
              <span className="text-neutral-400 font-mono block">📱 {customerData.phone}</span>
              {customerData.deliveryAddress && (
                <span className="text-neutral-400 block truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
                  {customerData.deliveryAddress} ({customerData.municipality}, {customerData.department})
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={clearSelectedCustomer}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center px-3 py-1.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer shrink-0 font-semibold"
            title="Cambiar o quitar cliente"
          >
            <X className="w-4 h-4 mr-1" />
            <span>Cambiar</span>
          </button>
        </div>
      ) : (
        /* Caso B: Búsqueda o Creación de Cliente */
        <div className="space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              value={customerQuery}
              onChange={(e) => setCustomerQuery(e.target.value)}
              placeholder="Buscar por teléfono WhatsApp (ej. 55551234) o nombre..."
              className="w-full min-h-[44px] pl-10 pr-10 py-2.5 bg-[#161616] border border-neutral-800 rounded-xl text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {isSearchingCustomer && (
              <Loader2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-400 animate-spin" />
            )}
          </div>

          {/* Resultados de Búsqueda Desplegables */}
          {customerResults.length > 0 && (
            <div className="space-y-1.5 max-h-48 overflow-y-auto no-scrollbar p-1.5 rounded-xl bg-neutral-900 border border-neutral-800">
              <span className="text-[10px] text-neutral-400 px-2 font-semibold uppercase">Resultados ({customerResults.length}):</span>
              {customerResults.map((cust) => (
                <button
                  key={cust.id}
                  type="button"
                  onClick={() => selectCustomer(cust)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-lg bg-[#141414] hover:bg-neutral-800 border border-neutral-800 text-left flex items-center justify-between gap-2 transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-white block truncate">{cust.fullName}</span>
                    <span className="text-neutral-400 text-[11px] font-mono">{cust.phone} • {cust.department || 'Guatemala'}</span>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-semibold shrink-0">Seleccionar →</span>
                </button>
              ))}
            </div>
          )}

          {/* Toggle Acordeón Nuevo Cliente */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setIsInlineCreation(!isInlineCreation)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-neutral-900/80 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 hover:text-white flex items-center justify-between font-semibold transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-emerald-400" />
                <span>{isInlineCreation ? 'Ocultar formulario de cliente' : '+ Registrar / Ingresar Datos de Cliente'}</span>
              </span>
              {isInlineCreation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {isInlineCreation && (
              <div className="mt-2.5 p-3.5 rounded-xl bg-[#141414] border border-neutral-800 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      value={customerData.fullName}
                      onChange={(e) => handleDataChange('fullName', e.target.value)}
                      placeholder="Ej. María Estrada"
                      className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Teléfono WhatsApp (8 dígitos) *</label>
                    <input
                      type="tel"
                      value={customerData.phone}
                      onChange={(e) => handleDataChange('phone', e.target.value.replace(/[^0-9+]/g, ''))}
                      placeholder="Ej. 55551234"
                      className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white font-mono focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Dirección de Entrega</label>
                  <input
                    type="text"
                    value={customerData.deliveryAddress}
                    onChange={(e) => handleDataChange('deliveryAddress', e.target.value)}
                    placeholder="Ej. 15 Av 4-25 Zona 14, Apto 402"
                    className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Departamento</label>
                    <select
                      value={customerData.department}
                      onChange={(e) => handleDataChange('department', e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                    >
                      {departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Municipio</label>
                    <input
                      type="text"
                      value={customerData.municipality}
                      onChange={(e) => handleDataChange('municipality', e.target.value)}
                      placeholder="Municipio"
                      className="w-full min-h-[44px] px-3 py-2 bg-black border border-neutral-800 rounded-xl text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-400 mb-1">Canal de Origen</label>
                  <div className="flex flex-wrap gap-1.5">
                    {CHANNELS.map((ch) => (
                      <button
                        key={ch.id}
                        type="button"
                        onClick={() => handleDataChange('sourceChannel', ch.id)}
                        className={`min-h-[44px] px-3 py-1.5 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer ${
                          customerData.sourceChannel === ch.id
                            ? 'bg-emerald-500 text-black'
                            : 'bg-black text-neutral-400 hover:text-white border border-neutral-800'
                        }`}
                      >
                        <span>{ch.icon}</span>
                        <span>{ch.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
