import { useState } from 'react';
import { useAuth } from '../../../../context/AuthContext';

export default function useEditSaleForm({ sale, onClose, onSaved, onSaleUpdated }) {
  const { authFetch } = useAuth();
  const [paymentMethod, setPaymentMethod] = useState(sale?.payments?.[0]?.method || 'EFECTIVO');
  const [items, setItems] = useState(
    (sale?.items || []).map((it) => ({
      id: it.id,
      productId: it.productId || null,
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      subtotal: Number(it.subtotal) || 0,
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
      updated[idx] = {
        ...current,
        quantity: newQty,
        subtotal: Number((newQty * current.unitPrice).toFixed(2)),
      };
      return updated;
    });
  };

  const handleRemoveItem = (idx) => {
    setItems((prevItems) => {
      if (prevItems.length <= 1) {
        alert('La venta debe conservar al menos un póster.');
        return prevItems;
      }
      return prevItems.filter((_, i) => i !== idx);
    });
  };

  const itemsTotal = items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0);
  const grandTotal = Math.max(0, itemsTotal - Number(discount || 0));

  const handleSaveChanges = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (items.length === 0) {
      setErrorMsg('Debes incluir al menos un producto.');
      return;
    }
    setIsSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        items: items.map((it) => ({
          productId: it.productId || null,
          description: it.description,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
        })),
        payments: [
          {
            method: paymentMethod,
            amount: Number(grandTotal.toFixed(2)),
            reference: notes || null,
          },
        ],
        discount: Number(discount || 0),
        notes: notes || null,
      };

      const res = await authFetch(`/api/sales/${sale.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error al guardar los cambios.');
      }

      const callback = onSaved || onSaleUpdated;
      if (callback) callback(json.data);
      if (onClose) onClose();
    } catch (err) {
      console.error('Error editando venta:', err);
      setErrorMsg(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    paymentMethod,
    setPaymentMethod,
    items,
    discount,
    setDiscount,
    notes,
    setNotes,
    isSaving,
    errorMsg,
    grandTotal,
    handleUpdateQuantity,
    handleRemoveItem,
    handleSaveChanges,
  };
}
