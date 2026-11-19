import { useState, useEffect, useCallback, useMemo } from 'react';

export const WEB_ORDER_SOURCE_LABELS = {
  WEB_CART: 'Carrito Web',
  WEB_CUSTOM: 'Personalizado Web',
  WEB_QUICK_POSTER: 'Compra Rápida Web',
};

const WEB_STANDARD_SIZES = [
  { sizeId: 'MINI', nombre: 'Mini', precio: 25 },
  { sizeId: 'PEQUENO', nombre: 'Pequeño', precio: 35 },
  { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', precio: 55 },
  { sizeId: 'MEDIANO', nombre: 'Mediano', precio: 65 },
  { sizeId: 'GRANDE', nombre: 'Grande', precio: 125 },
  { sizeId: 'GIGANTE', nombre: 'Gigante', precio: 210 },
];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let webImportSeq = 0;

export function isValidUuid(val) {
  return typeof val === 'string' && UUID_RE.test(val.trim());
}

export function formatWebOrderSourceLabel(source) {
  const key = String(source || '').trim().toUpperCase();
  return WEB_ORDER_SOURCE_LABELS[key] || 'Pedido Web';
}

export function formatWebMaterialLabel(material) {
  const norm = String(material || 'MDF_5_5MM').trim().toUpperCase();
  if (norm === 'PVC_5MM' || norm === 'PVC') return 'PVC 5mm';
  if (norm === 'VINILO_SOLO' || norm === 'VINYL_ONLY' || norm === 'VINILO') return 'Vinilo Adhesivo';
  return 'Madera MDF 5.5mm';
}

export function mapWebOrderItemToCartItem(rawItem = {}, index = 0) {
  const widthCm = Number(rawItem.customWidth) || 0;
  const heightCm = Number(rawItem.customHeight) || 0;
  const hasCustomDims = widthCm > 0 && heightCm > 0;
  const material = String(rawItem.material || 'MDF_5_5MM').trim().toUpperCase();
  const isCustom = Boolean(
    rawItem.isCustom === true ||
    String(rawItem.sizeMode || '').toLowerCase() === 'custom' ||
    hasCustomDims ||
    material !== 'MDF_5_5MM'
  );

  const quantity = Math.max(1, Math.floor(Number(rawItem.quantity) || 1));
  const unitPrice = Math.max(0, Number((Number(rawItem.unitPrice) || 0).toFixed(2)));
  const subtotal = Number((unitPrice * quantity).toFixed(2));
  const productId = !isCustom && isValidUuid(rawItem.productId) ? rawItem.productId.trim() : null;

  const customDimensions = rawItem.customDimensions
    ? String(rawItem.customDimensions).trim()
    : (hasCustomDims ? `Especial: ${widthCm} x ${heightCm} cm (Corte Taller)` : null);

  const imageUrl = rawItem.imageUrl || rawItem.customImageUrl || rawItem.thumbUrl || null;
  const thumbUrl = rawItem.thumbUrl || rawItem.imageUrl || rawItem.customImageUrl || null;
  const selectedSizeId = isCustom ? 'CUSTOM' : String(rawItem.sizeId || 'MEDIANO').toUpperCase();
  const stdRef = WEB_STANDARD_SIZES.find((s) => s.sizeId === selectedSizeId);
  const needsFallbackArtUrl = isCustom || !productId || !stdRef || Math.abs(stdRef.precio - unitPrice) > 0.01;
  const customImageUrl = rawItem.customImageUrl || (needsFallbackArtUrl ? (imageUrl || thumbUrl) : null);

  const description = String(
    rawItem.description ||
    rawItem.title ||
    (isCustom ? `Personalizado: Póster Web #${index + 1}` : `Póster Web #${index + 1}`)
  ).trim();

  const availableSizes = isCustom
    ? [{ sizeId: 'CUSTOM', nombre: customDimensions || rawItem.sizeLabel || 'Personalizado', precio: unitPrice }]
    : WEB_STANDARD_SIZES.map((s) => (s.sizeId === selectedSizeId ? { ...s, precio: unitPrice } : s));

  return {
    id: `web-item-${Date.now()}-${++webImportSeq}-${index}`,
    productId, posterId: rawItem.posterId || null, description, unitPrice, quantity, subtotal,
    isCustom, material: isCustom ? material : 'MDF_5_5MM', customDimensions,
    imageUrl, thumbUrl, customImageUrl, availableSizes, selectedSizeId,
  };
}

export function buildWebOrderCustomerDraft(order = {}, departments = []) {
  const rawPhone = String(order?.customerPhone || '').trim();
  const cleanDigits = rawPhone.replace(/[^0-9]/g, '');
  const lookupPhone = cleanDigits.length === 11 && cleanDigits.startsWith('502') ? cleanDigits.slice(3) : cleanDigits;
  const rawDept = String(order?.customerDepartment || '').trim();
  const norm = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const matchedDept = (Array.isArray(departments) && rawDept ? departments.find((d) => norm(d) === norm(rawDept)) : null) || (rawDept || 'Guatemala');
  return {
    fullName: String(order?.customerName || '').trim(),
    phone: cleanDigits, lookupPhone, email: '',
    deliveryAddress: String(order?.customerAddress || '').trim(),
    department: matchedDept, municipality: matchedDept, sourceChannel: 'OTRO',
    notes: String(order?.customerNotes || '').trim(),
  };
}

export function filterWebOrdersByQuery(orders = [], rawQuery = '') {
  if (!Array.isArray(orders)) return [];
  const q = String(rawQuery || '').trim().replace(/^#+/, '').toLowerCase();
  if (!q) return orders;
  return orders.filter((o) =>
    String(o?.orderNumber || '').toLowerCase().includes(q) ||
    String(o?.customerName || '').toLowerCase().includes(q) ||
    String(o?.customerPhone || '').toLowerCase().includes(q)
  );
}

export function useWebOrderImport({
  enabled,
  authFetch,
  cart,
  remoteForm,
  setSaleMode,
  incomingWebOrder = null,
  onIncomingWebOrderConsumed = null,
  onPendingCountChange = null,
  refreshKey = 0,
}) {
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isSyncingWeb, setIsSyncingWeb] = useState(false);
  const [modalFeedback, setModalFeedback] = useState(null);

  const fetchPendingOrders = useCallback(async () => {
    if (!enabled || typeof authFetch !== 'function') return;
    setIsLoadingOrders(true);
    try {
      const res = await authFetch('/api/sales/web-orders?status=PENDIENTE&limit=100');
      const json = await res.json();
      if (res.ok && json.success) {
        const list = Array.isArray(json.data) ? json.data : [];
        const nextCount = Number(json.counts?.pending ?? list.length) || 0;
        setPendingOrders(list);
        setPendingCount(nextCount);
        onPendingCountChange?.(nextCount);
      }
    } catch (err) {
      console.warn('[useWebOrderImport] Error consultando pedidos web pendientes:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, [enabled, authFetch, onPendingCountChange]);

  useEffect(() => {
    if (enabled) fetchPendingOrders();
  }, [enabled, refreshKey, fetchPendingOrders]);

  useEffect(() => {
    if (isImportModalOpen && enabled) {
      setModalFeedback(null);
      fetchPendingOrders();
    }
  }, [isImportModalOpen, enabled, fetchPendingOrders]);

  const handleSyncFromWeb = useCallback(async () => {
    if (isSyncingWeb || typeof authFetch !== 'function') return;
    setIsSyncingWeb(true);
    setModalFeedback(null);
    try {
      const res = await authFetch('/api/sales/web-orders/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PENDIENTE', limit: 100 }),
      });
      const json = await res.json().catch(() => ({}));
      setModalFeedback({
        text: json.message || (res.ok && json.synced ? 'Bandeja sincronizada con la Web.' : (json.error || 'No se pudo sincronizar con la Web.')),
        isError: !res.ok || json.synced === false,
      });
      await fetchPendingOrders();
    } catch {
      setModalFeedback({ text: 'Error de red al sincronizar con decovintage.online.', isError: true });
    } finally {
      setIsSyncingWeb(false);
    }
  }, [isSyncingWeb, authFetch, fetchPendingOrders]);

  const importOrderToForm = useCallback(async (order) => {
    if (!order) return;
    setSaleMode?.('REDES_PERSONALIZADO');

    const rawItems = Array.isArray(order.items) ? order.items : [];
    const mappedItems = rawItems.map((it, idx) => mapWebOrderItemToCartItem(it, idx));
    cart.setCartItems(mappedItems);
    cart.setDiscount(0);
    remoteForm.setEditionDescription('');
    remoteForm.setEditionCost('');
    remoteForm.setSubmitError(null);
    remoteForm.setRemoteSaleNotes(order.customerNotes ? String(order.customerNotes).trim() : '');

    const draftCust = buildWebOrderCustomerDraft(order, remoteForm.departments);
    let matchedCrmCustomer = null;

    if (draftCust.lookupPhone && draftCust.lookupPhone.length >= 8 && typeof authFetch === 'function') {
      try {
        const res = await authFetch(`/api/customers?query=${encodeURIComponent(draftCust.lookupPhone)}`);
        const json = await res.json();
        if (res.ok && json.success) {
          const candidates = Array.isArray(json.data) ? json.data : (json.data?.customers || []);
          matchedCrmCustomer = candidates.find((c) => {
            const cDigits = String(c.phone || '').replace(/[^0-9]/g, '');
            return cDigits.endsWith(draftCust.lookupPhone.slice(-8));
          }) || null;
        }
      } catch { /* fallback to inline customer form */ }
    }

    const effectiveAddress = draftCust.deliveryAddress || matchedCrmCustomer?.deliveryAddress || '';
    if (matchedCrmCustomer && effectiveAddress.trim().length >= 5) {
      remoteForm.selectCustomer({
        ...matchedCrmCustomer,
        fullName: draftCust.fullName || matchedCrmCustomer.fullName,
        deliveryAddress: effectiveAddress,
        department: draftCust.department || matchedCrmCustomer.department || 'Guatemala',
        municipality: draftCust.municipality || matchedCrmCustomer.municipality || 'Guatemala',
      });
    } else {
      remoteForm.clearSelectedCustomer();
      remoteForm.setCustomerData({
        fullName: draftCust.fullName || matchedCrmCustomer?.fullName || '',
        phone: draftCust.phone || matchedCrmCustomer?.phone || '',
        email: matchedCrmCustomer?.email || '',
        deliveryAddress: effectiveAddress,
        department: draftCust.department || matchedCrmCustomer?.department || 'Guatemala',
        municipality: draftCust.municipality || matchedCrmCustomer?.municipality || 'Guatemala',
        sourceChannel: matchedCrmCustomer?.sourceChannel || 'OTRO',
        notes: draftCust.notes || matchedCrmCustomer?.notes || '',
      });
      remoteForm.setIsInlineCreation(true);
    }

    remoteForm.setLinkedWebOrder({
      id: order.id,
      orderNumber: order.orderNumber,
      orderSource: order.orderSource,
      customerName: order.customerName,
      quotedTotal: Number(order.quotedTotal || 0),
    });
    setIsImportModalOpen(false);
  }, [authFetch, cart, remoteForm, setSaleMode]);

  useEffect(() => {
    if (!incomingWebOrder) return;
    importOrderToForm(incomingWebOrder);
    onIncomingWebOrderConsumed?.();
  }, [incomingWebOrder, importOrderToForm, onIncomingWebOrderConsumed]);

  const unlinkWebOrder = useCallback(() => {
    remoteForm.setLinkedWebOrder(null);
    cart.clearCart();
    remoteForm.clearSelectedCustomer();
    remoteForm.setIsInlineCreation(false);
    remoteForm.setRemoteSaleNotes('');
    remoteForm.setSubmitError(null);
  }, [cart, remoteForm]);

  const filteredOrders = useMemo(
    () => filterWebOrdersByQuery(pendingOrders, searchQuery),
    [pendingOrders, searchQuery]
  );

  return {
    isImportModalOpen, setIsImportModalOpen, pendingOrders: filteredOrders, pendingCount,
    searchQuery, setSearchQuery, isLoadingOrders, isSyncingWeb, modalFeedback,
    fetchPendingOrders, handleSyncFromWeb, importOrderToForm, unlinkWebOrder,
  };
}

export default useWebOrderImport;
