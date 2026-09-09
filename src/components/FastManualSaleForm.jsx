import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  CreditCard,
  Banknote,
  Smartphone,
  Tag,
  Loader2,
  Sparkles,
  ShoppingBag,
  X,
  Store,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const DEFAULT_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
];

export default function FastManualSaleForm({ eventId, onSaleRegistered, initialDraft = null }) {
  // Estado de búsqueda de pósters en la web
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Póster seleccionado actualmente para agregar
  const [selectedPoster, setSelectedPoster] = useState(null);
  const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZES[2]); // Default: Mediano
  const [itemQuantity, setItemQuantity] = useState(1);

  // Ticket / Carrito de venta
  const [cartItems, setCartItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const searchInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Cargar borrador si viene de la IA
  useEffect(() => {
    if (initialDraft && initialDraft.items?.length > 0) {
      setCartItems(
        initialDraft.items.map((it, idx) => ({
          id: `draft-${idx}-${Date.now()}`,
          productId: it.productId || null,
          description: it.description,
          unitPrice: Number(it.unitPrice),
          quantity: it.quantity || 1,
          subtotal: Number(it.quantity || 1) * Number(it.unitPrice),
          thumbUrl: it.thumbUrl || it.imageUrl || null,
          availableSizes: it.availableSizes || DEFAULT_SIZES,
        }))
      );
      if (initialDraft.paymentMethod) setPaymentMethod(initialDraft.paymentMethod);
      if (initialDraft.notes) setNotes(initialDraft.notes);
    }
  }, [initialDraft]);

  // Búsqueda reactiva en el catálogo web con debounce de 200ms
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/catalog/web-posters?q=${encodeURIComponent(searchQuery.trim())}&limit=8`);
        const json = await res.json();
        if (json.success) {
          setSearchResults(json.data || []);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('Error buscando pósters:', err);
      } finally {
        setIsSearching(false);
      }
    }, 120);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQuery]);

  // Al seleccionar un póster de la lista desplegable
  const handleSelectPoster = (poster) => {
    setSelectedPoster(poster);
    // Por defecto seleccionar MEDIANO o el primer tamaño disponible
    const defaultSz = poster.sizes?.find((s) => s.sizeId === 'MEDIANO') || poster.sizes?.[0] || DEFAULT_SIZES[2];
    setSelectedSize(defaultSz);
    setItemQuantity(1);
    const displayName = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo;
    setSearchQuery(displayName);
    setShowDropdown(false);
  };

  // Agregar el póster seleccionado al ticket de venta
  const handleAddItemToTicket = () => {
    if (!selectedPoster || !selectedSize) return;

    const posterTitle = selectedPoster.subtitulo
      ? `${selectedPoster.titulo} - ${selectedPoster.subtitulo}`
      : selectedPoster.titulo;

    const newItem = {
      id: `${selectedPoster.id}-${selectedSize.sizeId}-${Date.now()}`,
      productId: selectedPoster.id,
      posterId: selectedPoster.id,
      description: `Póster ${posterTitle} (${selectedSize.nombre || selectedSize.sizeId})`,
      unitPrice: Number(selectedSize.precio),
      quantity: Number(itemQuantity),
      subtotal: Number(itemQuantity) * Number(selectedSize.precio),
      thumbUrl: selectedPoster.thumbUrl || selectedPoster.imageUrl,
      imageUrl: selectedPoster.imageUrl,
      availableSizes: selectedPoster.sizes || DEFAULT_SIZES,
      selectedSizeId: selectedSize.sizeId,
    };

    setCartItems((prev) => [...prev, newItem]);

    // Limpiar selección para el siguiente póster
    setSelectedPoster(null);
    setSearchQuery('');
    setItemQuantity(1);
    searchInputRef.current?.focus();
  };

  // Ajustar cantidad en el ticket
  const updateTicketQty = (id, delta) => {
    setCartItems((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = it.quantity + delta;
            return newQty > 0
              ? { ...it, quantity: newQty, subtotal: Number((newQty * it.unitPrice).toFixed(2)) }
              : null;
          }
          return it;
        })
        .filter(Boolean)
    );
  };

  // Cambiar tamaño de un ítem ya en el ticket
  const changeTicketItemSize = (id, sz) => {
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const cleanDesc = it.description.replace(/\s*\((MINI|PEQUEÑO|PEQUENO|MEDIANO|GRANDE|GIGANTE)\)/gi, '').trim();
          const newPrice = Number(sz.precio);
          return {
            ...it,
            description: `${cleanDesc} (${sz.nombre || sz.sizeId})`,
            unitPrice: newPrice,
            selectedSizeId: sz.sizeId,
            subtotal: Number((it.quantity * newPrice).toFixed(2)),
          };
        }
        return it;
      })
    );
  };

  // Eliminar ítem del ticket
  const removeTicketItem = (id) => {
    setCartItems((prev) => prev.filter((it) => it.id !== id));
  };

  // Totales
  const subtotal = cartItems.reduce((acc, it) => acc + it.subtotal, 0);
  const grandTotal = Math.max(0, subtotal - discount);

  // Registrar venta directa en PostgreSQL
  const handleSubmitSale = async () => {
    if (cartItems.length === 0) {
      setErrorMsg('Debes agregar al menos un póster a la venta.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const salePayload = {
      eventId,
      items: cartItems.map((i) => ({
        productId: i.productId || null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
      })),
      payments: [
        {
          method: paymentMethod,
          amount: grandTotal,
          reference: notes || null,
        },
      ],
      discount: Number(discount),
      notes: notes || null,
      inputChannel: 'MANUAL_RAPIDA',
    };

    try {
      const res = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(salePayload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error registrando la venta en la base de datos');
      }

      // Celebración visual
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#F59E0B', '#10B981', '#3B82F6'],
        });
      } catch (e) {}

      // Limpiar formulario para la siguiente venta inmediata
      setCartItems([]);
      setSelectedPoster(null);
      setSearchQuery('');
      setDiscount(0);
      setNotes('');
      if (onSaleRegistered) onSaleRegistered(json.data);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-[#121212] p-5 sm:p-7 rounded-[32px] sm:rounded-[36px] border border-neutral-800 shadow-2xl space-y-6 text-white max-w-2xl mx-auto">
      {/* Cabecera del Formulario Manual */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800">
        <div>
          <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-white" />
            Registro de Venta Manual Rápida
          </h3>
          <p className="text-xs text-neutral-400">
            Llama cualquier póster del catálogo web oficial, selecciona tamaño y cobra en segundos
          </p>
        </div>
        <span className="text-xs font-bold px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300">
          Stand POS
        </span>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold">
          ⚠️ {errorMsg}
        </div>
      )}

      {/* SECCIÓN 1: CAMPO ÚNICO DE BÚSQUEDA Y LLAMADA DE PÓSTERS */}
      <div className="relative">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block mb-1.5 flex items-center justify-between">
          <span>1. Llamar Póster del Catálogo Web (233 Obras)</span>
          {isSearching && (
            <span className="text-[10px] text-neutral-400 font-normal flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-white" /> Buscando...
            </span>
          )}
        </label>

        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Escribe el nombre o personaje... (ej. Chainsaw, Spider-Man, Batman, Van Gogh)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            className="w-full bg-black border border-neutral-700/90 rounded-full pl-11 pr-11 py-3 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white font-medium shadow-inner"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedPoster(null);
                setShowDropdown(false);
              }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Desplegable de Resultados de Búsqueda */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1.5 bg-black border border-neutral-800 rounded-2xl shadow-2xl max-h-64 overflow-y-auto no-scrollbar">
            {searchResults.map((p) => (
              <div
                key={p.id}
                onClick={() => handleSelectPoster(p)}
                className="p-2.5 hover:bg-neutral-900 flex items-center justify-between gap-3 cursor-pointer border-b border-neutral-800/60 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={p.thumbUrl || p.imageUrl}
                    alt=""
                    className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900"
                  />
                  <div className="truncate">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                      {p.categoria || 'ARTE'}
                    </span>
                    <span className="font-bold text-xs text-white block truncate">{p.titulo}</span>
                    <span className="text-[10px] text-neutral-400 block truncate">{p.subtitulo || ''}</span>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] text-neutral-400 block">Desde</span>
                  <span className="text-xs font-black text-emerald-400">Q{p.precioMinimo}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 2: SELECTOR DE TAMAÑO Y CANTIDAD DEL PÓSTER SELECCIONADO */}
      {selectedPoster && (
        <div className="p-4 rounded-2xl bg-black border border-neutral-700 space-y-3.5 animate-fadeIn">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <img
                src={selectedPoster.thumbUrl || selectedPoster.imageUrl}
                alt=""
                className="w-12 h-16 object-cover rounded-lg border border-neutral-700 shadow-md shrink-0 bg-neutral-900"
              />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  {selectedPoster.categoria}
                </span>
                <h4 className="font-bold text-sm text-white">{selectedPoster.titulo}</h4>
                <p className="text-xs text-neutral-400">{selectedPoster.subtitulo}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedPoster(null)}
              className="text-neutral-400 hover:text-white p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Desplegar / Seleccionar Tamaño */}
          <div>
            <label className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider block mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-white" /> Desplegar Tamaño y Precio:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(selectedPoster.sizes || DEFAULT_SIZES).map((sz) => {
                const isSelected = selectedSize?.sizeId === sz.sizeId;
                return (
                  <button
                    key={sz.sizeId}
                    type="button"
                    onClick={() => setSelectedSize(sz)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-md font-black'
                        : 'bg-[#181818] border-neutral-800 text-neutral-300 hover:border-neutral-600'
                    }`}
                  >
                    <span className="text-xs font-bold block">{sz.nombre || sz.sizeId}</span>
                    <span
                      className={`text-xs ${
                        isSelected ? 'text-black font-black' : 'text-emerald-400 font-extrabold'
                      }`}
                    >
                      Q {Number(sz.precio).toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cantidad y Botón de Agregar */}
          <div className="flex items-center justify-between pt-2 border-t border-neutral-800">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-neutral-400">Cantidad:</span>
              <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-700">
                <button
                  type="button"
                  onClick={() => setItemQuantity(Math.max(1, itemQuantity - 1))}
                  className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-6 text-center font-bold text-sm text-white">{itemQuantity}</span>
                <button
                  type="button"
                  onClick={() => setItemQuantity(itemQuantity + 1)}
                  className="text-neutral-400 hover:text-white p-0.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddItemToTicket}
              className="px-5 py-2.5 rounded-xl bg-white hover:bg-neutral-200 text-black font-black text-xs flex items-center gap-1.5 shadow-md cursor-pointer transition-transform active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar al Ticket (Q {(itemQuantity * (selectedSize?.precio || 0)).toFixed(2)})</span>
            </button>
          </div>
        </div>
      )}

      {/* SECCIÓN 3: TICKET DE LA VENTA EN CURSO */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center justify-between">
          <span>2. Pósters en la Venta ({cartItems.length})</span>
          {cartItems.length > 0 && (
            <button
              type="button"
              onClick={() => setCartItems([])}
              className="text-[11px] text-neutral-500 hover:text-red-400 transition-colors cursor-pointer"
            >
              Limpiar Venta
            </button>
          )}
        </label>

        {cartItems.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-neutral-800 text-center text-xs text-neutral-500">
            No has agregado pósters aún. Llama una obra arriba para agregarla a esta venta.
          </div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="p-3 rounded-2xl bg-black border border-neutral-800 flex items-center justify-between gap-3 text-xs"
              >
                {item.thumbUrl && (
                  <img
                    src={item.thumbUrl}
                    alt=""
                    className="w-9 h-12 object-cover rounded-lg border border-neutral-700 shrink-0 bg-neutral-900"
                  />
                )}

                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white block truncate">{item.description}</span>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    {(item.availableSizes || DEFAULT_SIZES).map((sz) => {
                      const isSel = item.selectedSizeId === sz.sizeId || item.unitPrice === sz.precio;
                      return (
                        <button
                          key={sz.sizeId}
                          type="button"
                          onClick={() => changeTicketItemSize(item.id, sz)}
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer transition-colors ${
                            isSel
                              ? 'bg-white text-black'
                              : 'bg-[#181818] text-neutral-400 hover:text-white'
                          }`}
                        >
                          {sz.nombre || sz.sizeId} (Q{sz.precio})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Cantidad */}
                <div className="flex items-center gap-1 bg-[#181818] px-2 py-1 rounded-lg border border-neutral-800 shrink-0">
                  <button
                    type="button"
                    onClick={() => updateTicketQty(item.id, -1)}
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-4 text-center font-bold text-white">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => updateTicketQty(item.id, 1)}
                    className="text-neutral-400 hover:text-white cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>

                <div className="text-right shrink-0 pl-1">
                  <span className="font-bold text-emerald-400 block">Q {item.subtotal.toFixed(2)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => removeTicketItem(item.id)}
                  className="text-neutral-500 hover:text-red-400 p-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECCIÓN 4: DESPLEGAR MÉTODO DE PAGO */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-neutral-300 uppercase tracking-wider block">
          3. Desplegar Método de Pago (1 Toque)
        </label>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('EFECTIVO')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
              paymentMethod === 'EFECTIVO'
                ? 'bg-white text-black border-white shadow-md font-black'
                : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
            }`}
          >
            <Banknote className="w-4 h-4" />
            <span>💵 Efectivo</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('TARJETA')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
              paymentMethod === 'TARJETA'
                ? 'bg-white text-black border-white shadow-md font-black'
                : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>💳 Tarjeta</span>
          </button>

          <button
            type="button"
            onClick={() => setPaymentMethod('TRANSFERENCIA')}
            className={`flex items-center justify-center gap-2 p-3 rounded-2xl border font-bold text-xs transition-all cursor-pointer ${
              paymentMethod === 'TRANSFERENCIA'
                ? 'bg-white text-black border-white shadow-md font-black'
                : 'bg-black border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-600'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>📲 Transfer</span>
          </button>
        </div>
      </div>

      {/* SECCIÓN 5: DESCUENTO, NOTAS Y TOTAL FINAL */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-neutral-800">
        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Descuento Opcional (Q)
          </label>
          <input
            type="number"
            min="0"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
            className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
          />
        </div>

        <div>
          <label className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
            Nota / Cliente
          </label>
          <input
            type="text"
            placeholder="Ej. Promoción 2x1, amigo..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full bg-black border border-neutral-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-white"
          />
        </div>
      </div>

      {/* TOTAL Y BOTÓN DE ASENTAR VENTA */}
      <div className="p-5 rounded-2xl bg-black border border-neutral-800 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-neutral-400 font-medium block">Total a Cobrar:</span>
          <span className="text-2xl sm:text-3xl font-black text-emerald-400">
            Q {grandTotal.toFixed(2)}
          </span>
        </div>

        <button
          type="button"
          onClick={handleSubmitSale}
          disabled={isSubmitting || cartItems.length === 0}
          className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 disabled:opacity-40 transition-all cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Asentando en Postgres...</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>Registrar Venta (Q {grandTotal.toFixed(2)})</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
