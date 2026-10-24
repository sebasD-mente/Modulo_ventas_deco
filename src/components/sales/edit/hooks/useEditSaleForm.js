import { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';

export default function useEditSaleForm({ sale, onClose, onSaved, onSaleUpdated }) {
  const { authFetch } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState(sale?.payments?.[0]?.method || 'EFECTIVO');
  const [items, setItems] = useState(
    (sale?.items || []).map((it) => ({
      id: it.id, productId: it.productId || null, description: it.description,
      quantity: Number(it.quantity) || 1, unitPrice: Number(it.unitPrice) || 0, subtotal: Number(it.subtotal) || 0,
      product: it.product || null, imageUrl: it.customImageUrl || it.imageUrl || it.product?.imageUrl || null, thumbUrl: it.thumbUrl || null,
      customImageUrl: it.customImageUrl || null,
    }))
  );
  const [discount, setDiscount] = useState(Number(sale?.discount || 0));
  const [notes, setNotes] = useState(sale?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleUpdateQuantity = (idx, delta) => {
    setItems((prevItems) => {
      const current = prevItems[idx];
      if (!current) return prevItems;
      const newQty = Math.max(1, current.quantity + delta);
      const updated = [...prevItems];
      updated[idx] = { ...current, quantity: newQty, subtotal: Number((newQty * current.unitPrice).toFixed(2)) };
      return updated;
    });
  };

  const handleReplaceItem = (idx, newPoster) => {
    if (!newPoster) return;
    setItems((prevItems) => {
      const current = prevItems[idx];
      if (!current) return prevItems;
      const parenMatch = current.description?.match(/\(([^)]+)\)\s*$/);
      let sizeLabel = parenMatch ? parenMatch[1] : null;
      let nextUnitPrice = Number(current.unitPrice) || 65;

      if (Array.isArray(newPoster.sizes) && newPoster.sizes.length > 0) {
        const matchedSize = sizeLabel
          ? newPoster.sizes.find((s) => (s.nombre || s.sizeId || '').toLowerCase() === sizeLabel.toLowerCase())
          : newPoster.sizes.find((s) => Math.abs(Number(s.precio || s.price) - nextUnitPrice) < 0.01);
        if (matchedSize) {
          sizeLabel = matchedSize.nombre || matchedSize.sizeId;
          nextUnitPrice = Number(matchedSize.precio || matchedSize.price) || nextUnitPrice;
        } else if (newPoster.sizes.length === 1) {
          sizeLabel = newPoster.sizes[0].nombre || newPoster.sizes[0].sizeId;
          nextUnitPrice = Number(newPoster.sizes[0].precio || newPoster.sizes[0].price) || nextUnitPrice;
        }
      }

      const baseTitle = newPoster.subtitulo ? `${newPoster.titulo} - ${newPoster.subtitulo}` : newPoster.titulo;
      const nextDescription = sizeLabel ? `Póster ${baseTitle} (${sizeLabel})` : `Póster ${baseTitle}`;
      const nextImg = newPoster.imageUrl || newPoster.thumbUrl || null;
      const isUuid = typeof newPoster.id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(newPoster.id);

      const updated = [...prevItems];
      updated[idx] = {
        ...current, productId: isUuid ? newPoster.id : null, posterId: newPoster.id || null,
        description: nextDescription, unitPrice: nextUnitPrice, subtotal: Number((current.quantity * nextUnitPrice).toFixed(2)),
        imageUrl: nextImg, thumbUrl: newPoster.thumbUrl || nextImg, customImageUrl: nextImg,
        product: nextImg ? { ...(current.product || {}), id: isUuid ? newPoster.id : null, name: baseTitle, imageUrl: nextImg } : null,
      };
      return updated;
    });
  };

  const handleRemoveItem = (idx) => {
    setItems((prevItems) => {
      if (prevItems.length <= 1) { alert('La venta debe conservar al menos un póster.'); return prevItems; }
      return prevItems.filter((_, i) => i !== idx);
    });
  };

  const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));

  const handleSaveChanges = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (items.length === 0) { setErrorMsg('Debes incluir al menos un producto.'); return; }
    setIsSaving(true); setErrorMsg(null);
    try {
      const originalPaymentsSum = (sale?.payments || []).reduce((acc, p) => acc + Number(p.amount || 0), 0);
      const isMultiPayment = Array.isArray(sale?.payments) && sale.payments.length > 1;
      const paymentMethodUnchanged = isMultiPayment && sale.payments[0]?.method === paymentMethod;
      const totalUnchanged = Math.abs(originalPaymentsSum - grandTotal) <= 0.01;
      const paymentsPayload = (isMultiPayment && paymentMethodUnchanged && totalUnchanged)
        ? sale.payments.map((p) => ({ method: p.method, amount: Number(p.amount), reference: p.reference || notes || null, receiptUrl: p.receiptUrl || null }))
        : [{ method: paymentMethod, amount: Number(grandTotal.toFixed(2)), reference: notes || null }];

      const payload = {
        items: items.map((it) => ({
          id: it.id || null, productId: it.productId || null, description: it.description, quantity: it.quantity,
          unitPrice: Number(it.unitPrice), customImageUrl: it.customImageUrl || null, productionNotes: it.productionNotes || null,
          isCustom: Boolean(it.isCustom), material: it.material || null, customDimensions: it.customDimensions || null,
        })),
        payments: paymentsPayload, discount: Number(discount || 0), notes: notes || null,
      };
      const res = await authFetch(`/api/sales/${sale.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al guardar los cambios.');
      const callback = onSaved || onSaleUpdated;
      if (callback) callback(json.data);
      if (onClose) onClose();
    } catch (err) { setErrorMsg(err.message); } finally { setIsSaving(false); }
  };

  const handleCancelSale = async () => {
    setIsSaving(true); setErrorMsg(null);
    try {
      const res = await authFetch(`/api/sales/${sale.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ANULADA', notes: notes || 'Venta anulada en mostrador' }) });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Error al anular la venta.');
      const callback = onSaved || onSaleUpdated;
      if (callback) callback(json.data);
      if (onClose) onClose();
    } catch (err) { setErrorMsg(err.message); } finally { setIsSaving(false); }
  };

  return {
    paymentMethod, setPaymentMethod, items, discount, setDiscount, notes, setNotes,
    isSaving, errorMsg, grandTotal, handleUpdateQuantity, handleReplaceItem, handleRemoveItem, handleSaveChanges, handleCancelSale,
  };
}
