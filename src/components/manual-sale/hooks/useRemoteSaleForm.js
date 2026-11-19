import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';

const GUATEMALA_DEPARTMENTS = [
  'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso', 'Escuintla', 'Guatemala', 'Huehuetenango',
  'Izabal', 'Jalapa', 'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu', 'Sacatepéquez', 'San Marcos',
  'Santa Rosa', 'Sololá', 'Suchitepéquez', 'Totonicapán', 'Zacapa'
];

const INITIAL_CUSTOMER_DATA = {
  fullName: '', phone: '', email: '', deliveryAddress: '',
  department: 'Guatemala', municipality: 'Guatemala', sourceChannel: 'WHATSAPP', notes: '',
};

let customItemSeq = 0;

export function createCartCustomItem({ description, unitPrice, quantity = 1, material = 'MDF_5_5MM', customDimensions = '30x40 cm', customImageUrl = null }) {
  const qty = Number(quantity) || 1, price = Number(unitPrice) || 0;
  return {
    id: `custom-${Date.now()}-${++customItemSeq}-${Math.random().toString(36).slice(2, 6)}`,
    productId: null,
    description: `Personalizado: ${String(description || '').trim()} (${material}, ${customDimensions})`,
    unitPrice: price, quantity: qty, subtotal: Number((qty * price).toFixed(2)),
    isCustom: true, material, customDimensions, customImageUrl: customImageUrl || null,
    availableSizes: [{ sizeId: 'CUSTOM', nombre: customDimensions || 'Personalizado', precio: price }],
    selectedSizeId: 'CUSTOM',
  };
}

export function calculateRemoteOrderTotals({
  cartItems = [], discount = 0, editionCost = 0, deliveryMethod = 'ENVIO_COURIER', shippingCost = 0,
}) {
  const productsSubtotal = Number(cartItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0).toFixed(2));
  const productsAmount = Math.max(0, Number((productsSubtotal - (Number(discount) || 0)).toFixed(2)));
  const effectiveEditionCost = Math.max(0, Number((Number(editionCost) || 0).toFixed(2)));
  const effectiveShippingCost = deliveryMethod === 'ENVIO_COURIER' ? Math.max(0, Number((Number(shippingCost) || 0).toFixed(2))) : 0;
  const totalAmount = Number((productsAmount + effectiveEditionCost + effectiveShippingCost).toFixed(2));
  return { productsSubtotal, productsAmount, effectiveEditionCost, effectiveShippingCost, totalAmount };
}

export function useRemoteSaleForm({ eventId, onSaleRegistered, cart }) {
  const { authFetch } = useAuth();
  const { cartItems, setCartItems, discount, clearCart } = cart;

  // CRM & Cliente
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isInlineCreation, setIsInlineCreation] = useState(false);
  const [customerData, setCustomerData] = useState(INITIAL_CUSTOMER_DATA);

  // Edición de Diseño y Vínculo Opcional con Pedido Web
  const [editionDescription, setEditionDescription] = useState('');
  const [editionCost, setEditionCost] = useState('');
  const [linkedWebOrder, setLinkedWebOrder] = useState(null);

  // Logística y Flete
  const [deliveryMethod, setDeliveryMethod] = useState('ENVIO_COURIER');
  const [shippingCost, setShippingCost] = useState(0);
  const [shippingCourier, setShippingCourier] = useState('GUATEX');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
  const [pickupEventId, setPickupEventId] = useState(
    eventId && eventId !== 'evt-ventas-redes-online' ? eventId : ''
  );
  const [availablePickupEvents, setAvailablePickupEvents] = useState([]);

  // Anticipo, Comprobante y Pagos
  const [isPendingPaymentOnly, setIsPendingPaymentOnly] = useState(false);
  const [depositInput, setDepositInput] = useState('');
  const [depositPaymentMethod, setDepositPaymentMethod] = useState('TRANSFERENCIA');
  const [depositReference, setDepositReference] = useState('');
  const [depositReceiptUrl, setDepositReceiptUrl] = useState(null);
  const [isUploadingReceipt, setIsUploadingReceipt] = useState(false);
  const [receiptUploadError, setReceiptUploadError] = useState(null);
  const [remoteSaleNotes, setRemoteSaleNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleReceiptUpload = async (file) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setReceiptUploadError('El comprobante supera el límite máximo permitido de 15MB.');
      return;
    }
    setReceiptUploadError(null);
    setIsUploadingReceipt(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await authFetch('/api/sales/upload-art', { method: 'POST', body: formData });
      const json = await res.json();
      if (res.ok && json.success && json.url) {
        setDepositReceiptUrl(json.url);
      } else {
        setReceiptUploadError(json.error || 'Error al subir el comprobante de pago.');
      }
    } catch {
      setReceiptUploadError('Error de conexión al transferir comprobante a Cloud Storage.');
    } finally {
      setIsUploadingReceipt(false);
    }
  };

  // Post-Venta: Modal WhatsApp
  const [completedSale, setCompletedSale] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Búsqueda de clientes con debounce (300ms)
  const searchTimeoutRef = useRef(null);
  useEffect(() => {
    if (!customerQuery || customerQuery.trim().length < 2) {
      setCustomerResults([]);
      setIsSearchingCustomer(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setIsSearchingCustomer(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await authFetch(`/api/customers?query=${encodeURIComponent(customerQuery.trim())}`);
        const json = await res.json();
        if (json.success) {
          setCustomerResults(Array.isArray(json.data) ? json.data : (json.data?.customers || []));
        }
      } catch (err) {
        console.error('Error buscando clientes:', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300);
    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [customerQuery, authFetch]);

  // Cargar eventos para retiro si el método es RETIRO_EVENTO (excluyendo el canal digital)
  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      try {
        const res = await authFetch('/api/events?forPickup=true');
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          const pickupStands = json.data.filter((e) => e.status !== 'ARCHIVADO' && e.id !== 'evt-ventas-redes-online');
          setAvailablePickupEvents(pickupStands);
          if (pickupStands.length > 0) {
            setPickupEventId((prev) => {
              if (prev && pickupStands.some((s) => s.id === prev)) return prev;
              const matchCurrent = eventId && eventId !== 'evt-ventas-redes-online' && pickupStands.find((s) => s.id === eventId);
              return matchCurrent ? matchCurrent.id : pickupStands[0].id;
            });
          }
        }
      } catch (err) {
        console.warn('⚠️ Error al cargar eventos para retiro en stand:', err);
      }
    }
    loadEvents();
    return () => { isMounted = false; };
  }, [authFetch, eventId]);

  // Aritmética financiera reactiva (incluye edición de diseño + flete; anticipo libre > 0)
  const {
    productsSubtotal, productsAmount, effectiveEditionCost, effectiveShippingCost, totalAmount,
  } = calculateRemoteOrderTotals({ cartItems, discount, editionCost, deliveryMethod, shippingCost });

  const numericDeposit = isPendingPaymentOnly ? 0 : (Number(depositInput) || 0);
  const balanceDue = Math.max(0, Number((totalAmount - numericDeposit).toFixed(2)));
  const isDepositValid = totalAmount > 0 && (isPendingPaymentOnly || (numericDeposit > 0 && numericDeposit <= totalAmount + 0.01));

  // Selección de cliente autocompletado
  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setCustomerResults([]);
    setIsInlineCreation(false);
    setCustomerData({
      fullName: cust.fullName || '', phone: cust.phone || '', email: cust.email || '',
      deliveryAddress: cust.deliveryAddress || '', department: cust.department || 'Guatemala',
      municipality: cust.municipality || 'Guatemala', sourceChannel: cust.sourceChannel || 'WHATSAPP', notes: cust.notes || '',
    });
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerData({ ...INITIAL_CUSTOMER_DATA });
  };

  // Inyección de ítem personalizado al carrito (soporta ráfagas síncronas multi-imagen sin colisión de ID)
  const addCustomItem = (itemData) => {
    const newItem = createCartCustomItem(itemData);
    setCartItems((prev) => [...prev, newItem]);
  };

  // Despacho de la orden remota a POST /api/sales/remote
  const confirmRemoteSale = async () => {
    if (cartItems.length === 0) {
      setSubmitError('Debes agregar al menos un producto a la orden.');
      return false;
    }
    if (Number(editionCost) < 0) {
      setSubmitError('El costo de la edición no puede ser negativo.');
      return false;
    }
    if (effectiveEditionCost > 0 && !editionDescription.trim()) {
      setSubmitError('Ingresa la descripción de la edición realizada (ej. letras o retoque aplicado).');
      return false;
    }
    if (!customerData.fullName.trim() || customerData.fullName.trim().length < 2) {
      setSubmitError('El nombre del cliente es obligatorio (mínimo 2 caracteres).');
      return false;
    }
    const cleanPhone = customerData.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 8 || cleanPhone.length > 15) {
      setSubmitError('El teléfono de WhatsApp debe tener al menos 8 dígitos.');
      return false;
    }
    if (deliveryMethod === 'ENVIO_COURIER' && (!customerData.deliveryAddress || customerData.deliveryAddress.trim().length < 5)) {
      setSubmitError('Para envío por Courier se requiere una dirección de entrega completa (mínimo 5 caracteres).');
      return false;
    }
    if (deliveryMethod === 'RETIRO_EVENTO' && !pickupEventId) {
      setSubmitError('Debes seleccionar el evento ferial para retiro en stand.');
      return false;
    }
    if (!isPendingPaymentOnly) {
      if (numericDeposit <= 0) {
        setSubmitError('Debes ingresar un valor de anticipo mayor a Q 0.00 o seleccionar Pendiente Pago.');
        return false;
      }
      if (numericDeposit > totalAmount + 0.01) {
        setSubmitError('El anticipo no puede ser mayor al total de la orden.');
        return false;
      }
      if (depositPaymentMethod === 'TRANSFERENCIA' && !depositReference.trim() && !depositReceiptUrl) {
        setSubmitError('Para pagos por Transferencia debes ingresar el No. de Boleta/Referencia o adjuntar foto del comprobante.');
        return false;
      }
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const clientUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sale-rem-${Date.now()}`;
    const payload = {
      eventId: 'evt-ventas-redes-online',
      customerId: selectedCustomer?.id || null,
      customer: selectedCustomer?.id ? null : {
        fullName: customerData.fullName.trim(),
        phone: cleanPhone,
        email: customerData.email?.trim() || null,
        deliveryAddress: customerData.deliveryAddress?.trim() || null,
        department: customerData.department?.trim() || null,
        municipality: customerData.municipality?.trim() || null,
        sourceChannel: customerData.sourceChannel || 'WHATSAPP',
        notes: customerData.notes?.trim() || null,
      },
      deliveryMethod,
      shippingCost: effectiveShippingCost,
      shippingCourier: deliveryMethod === 'ENVIO_COURIER' ? shippingCourier : null,
      shippingTrackingNumber: deliveryMethod === 'ENVIO_COURIER' && shippingTrackingNumber ? shippingTrackingNumber : null,
      pickupEventId: deliveryMethod === 'RETIRO_EVENTO' ? pickupEventId : null,
      items: cartItems.map((it) => ({
        productId: it.productId || null,
        description: it.description,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        isCustom: Boolean(it.isCustom),
        material: it.material || null,
        customDimensions: it.customDimensions || null,
        customImageUrl: it.customImageUrl || null,
      })),
      payments: isPendingPaymentOnly || numericDeposit === 0
        ? []
        : [{ method: depositPaymentMethod, amount: numericDeposit, reference: depositReference?.trim() || null, receiptUrl: depositReceiptUrl || null }],
      discount: Number(discount) || 0,
      editionDescription: editionDescription.trim() || null,
      editionCost: effectiveEditionCost,
      webOrderInboxId: linkedWebOrder?.id || null,
      webOrderNumber: linkedWebOrder?.orderNumber || null,
      notes: remoteSaleNotes?.trim() || null,
      idempotencyKey: clientUuid,
    };

    try {
      const res = await authFetch('/api/sales/remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': clientUuid },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Error registrando venta remota.');
      }

      try { confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 } }); } catch (_) {}
      setCompletedSale(json.data);
      setShowShareModal(true);
      clearCart();
      clearSelectedCustomer();
      setShippingCost(0);
      setEditionDescription('');
      setEditionCost('');
      setLinkedWebOrder(null);
      setIsPendingPaymentOnly(false);
      setDepositInput('');
      setDepositReference('');
      setDepositReceiptUrl(null);
      setReceiptUploadError(null);
      setRemoteSaleNotes('');
      if (onSaleRegistered) onSaleRegistered(json.data);
      return json.data;
    } catch (err) {
      console.error('Error confirmRemoteSale:', err);
      setSubmitError(err.message || 'Error registrando pedido remoto.');
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    customerQuery, setCustomerQuery, customerResults, isSearchingCustomer,
    selectedCustomer, customerData, setCustomerData, isInlineCreation, setIsInlineCreation,
    selectCustomer, clearSelectedCustomer, departments: GUATEMALA_DEPARTMENTS,
    editionDescription, setEditionDescription, editionCost, setEditionCost, effectiveEditionCost,
    linkedWebOrder, setLinkedWebOrder,
    deliveryMethod, setDeliveryMethod, shippingCost, setShippingCost,
    shippingCourier, setShippingCourier, shippingTrackingNumber, setShippingTrackingNumber,
    pickupEventId, setPickupEventId, availablePickupEvents,
    productsSubtotal, productsAmount, effectiveShippingCost, totalAmount,
    depositInput, setDepositInput, numericDeposit, balanceDue, isDepositValid,
    isPendingPaymentOnly, setIsPendingPaymentOnly,
    depositPaymentMethod, setDepositPaymentMethod, depositReference, setDepositReference,
    depositReceiptUrl, setDepositReceiptUrl, isUploadingReceipt, receiptUploadError, handleReceiptUpload,
    remoteSaleNotes, setRemoteSaleNotes, isSubmitting, submitError, setSubmitError,
    completedSale, showShareModal, setShowShareModal,
    addCustomItem, confirmRemoteSale,
  };
}

export default useRemoteSaleForm;
