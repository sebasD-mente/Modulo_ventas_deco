import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { DEFAULT_SIZES, SIZE_CLEANUP_REGEX } from '../manualSaleConstants';

const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val);

export function useManualSaleCart({ eventId, onSaleRegistered, initialDraft = null }) {
  const { authFetch } = useAuth();
  const [cartItems, setCartItems] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('EFECTIVO');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [inputChannel, setInputChannel] = useState('MANUAL_RAPIDA');
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (!initialDraft || !initialDraft.items?.length) return;
    setCartItems(
      initialDraft.items.map((it, idx) => {
        const resolvedSizeId = it.selectedSizeId || it.sizeId || null;
        let sizes = it.availableSizes?.length ? it.availableSizes : DEFAULT_SIZES;
        if (resolvedSizeId && !sizes.some((s) => s.sizeId === resolvedSizeId)) {
          const match = DEFAULT_SIZES.find((s) => s.sizeId === resolvedSizeId);
          if (match) sizes = [...sizes, match];
        }
        const unitPrice = Number(it.unitPrice) || 0;
        const qty = Number(it.quantity) || 1;
        return {
          id: `draft-${idx}-${Date.now()}`,
          productId: isUuid(it.productId) ? it.productId : null, posterId: it.posterId || it.productId || null,
          description: it.description, unitPrice, quantity: qty,
          subtotal: Number((qty * unitPrice).toFixed(2)),
          thumbUrl: it.thumbUrl || it.imageUrl || null, imageUrl: it.imageUrl || it.thumbUrl || null,
          availableSizes: sizes, selectedSizeId: resolvedSizeId,
        };
      })
    );
    if (initialDraft.paymentMethod) setPaymentMethod(initialDraft.paymentMethod);
    if (initialDraft.notes) setNotes(initialDraft.notes);
    setInputChannel(initialDraft.inputChannel || 'MANUAL_RAPIDA');

    const incoming = Array.isArray(initialDraft.attachments) && initialDraft.attachments.length
      ? initialDraft.attachments
      : initialDraft.audioUrl
      ? [{ fileUrl: initialDraft.audioUrl, fileType: 'AUDIO_VOZ', transcription: initialDraft.transcription || null }]
      : initialDraft.imageUrl
      ? [{ fileUrl: initialDraft.imageUrl, fileType: initialDraft.inputChannel === 'IA_IMAGEN_QR' ? 'FOTO_QR' : 'FOTO_ARTE' }]
      : [];
    setAttachments(incoming);
  }, [initialDraft]);

  const subtotal = cartItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
  const grandTotal = Math.max(0, subtotal - (Number(discount) || 0));

  const addItemFromPoster = (poster, size, quantity = 1) => {
    if (!poster || !size) return;
    const title = poster.subtitulo ? `${poster.titulo} - ${poster.subtitulo}` : poster.titulo;
    const unitPrice = Number(size.precio) || 0;
    const qty = Number(quantity) || 1;
    const newItem = {
      id: `${poster.id}-${size.sizeId}-${Date.now()}`,
      productId: isUuid(poster.id) ? poster.id : null, posterId: poster.id,
      description: `Póster ${title} (${size.nombre || size.sizeId})`,
      unitPrice, quantity: qty, subtotal: Number((qty * unitPrice).toFixed(2)),
      thumbUrl: poster.thumbUrl || poster.imageUrl || null,
      imageUrl: poster.imageUrl || poster.thumbUrl || null,
      availableSizes: poster.sizes || DEFAULT_SIZES,
      selectedSizeId: size.sizeId,
    };
    setCartItems((prev) => [...prev, newItem]);
  };

  const updateItemQty = (id, delta) => {
    setCartItems((prev) =>
      prev.map((it) => (it.id === id ? (it.quantity + delta > 0 ? { ...it, quantity: it.quantity + delta, subtotal: Number(((it.quantity + delta) * it.unitPrice).toFixed(2)) } : null) : it)).filter(Boolean)
    );
  };

  const changeItemSize = (id, newSize) => {
    setCartItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const clean = it.description.replace(SIZE_CLEANUP_REGEX, '').trim();
        const price = Number(newSize.precio) || 0;
        return { ...it, description: `${clean} (${newSize.nombre || newSize.sizeId})`, unitPrice: price, selectedSizeId: newSize.sizeId, subtotal: Number((it.quantity * price).toFixed(2)) };
      })
    );
  };

  const removeItem = (id) => setCartItems((prev) => prev.filter((it) => it.id !== id));
  const unlinkAttachments = () => { setAttachments([]); setInputChannel('MANUAL_RAPIDA'); };
  const clearCart = () => { setCartItems([]); setDiscount(0); setNotes(''); setAttachments([]); setInputChannel('MANUAL_RAPIDA'); setErrorMsg(null); };

  const confirmSale = async () => {
    if (cartItems.length === 0) { setErrorMsg('Debes agregar al menos un póster a la venta.'); return false; }
    if (!eventId) { setErrorMsg('No hay un evento activo seleccionado.'); return false; }
    setIsSubmitting(true);
    setErrorMsg(null);
    const salePayload = {
      eventId,
      items: cartItems.map((i) => ({ productId: isUuid(i.productId) ? i.productId : null, description: i.description, quantity: i.quantity, unitPrice: Number(i.unitPrice) })),
      payments: [{ method: paymentMethod, amount: grandTotal, reference: notes || null }],
      discount: Number(discount) || 0,
      notes: notes || null,
      inputChannel: inputChannel || 'MANUAL_RAPIDA',
      attachments: attachments?.length ? attachments : [],
    };

    try {
      const res = await authFetch('/api/sales', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(salePayload) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error registrando la venta en la base de datos');
      try { confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors: ['#F59E0B', '#10B981', '#3B82F6'] }); } catch (e) {}
      clearCart();
      if (onSaleRegistered) onSaleRegistered(json.data);
      return json.data;
    } catch (err) {
      console.error('Error en confirmSale:', err);
      setErrorMsg(err.message || 'Error registrando la venta');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    cartItems, setCartItems, paymentMethod, setPaymentMethod,
    discount, setDiscount, notes, setNotes, inputChannel, setInputChannel,
    attachments, setAttachments, isSubmitting, errorMsg, setErrorMsg,
    subtotal, grandTotal, addItemFromPoster, updateItemQty, changeItemSize,
    removeItem, clearCart, unlinkAttachments, confirmSale,
  };
}

export default useManualSaleCart;
