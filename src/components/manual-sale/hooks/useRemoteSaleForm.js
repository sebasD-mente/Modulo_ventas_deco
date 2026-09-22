import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';

const GUATEMALA_DEPARTMENTS = [
  'Alta Verapaz', 'Baja Verapaz', 'Chimaltenango', 'Chiquimula', 'El Progreso',
  'Escuintla', 'Guatemala', 'Huehuetenango', 'Izabal', 'Jalapa',
  'Jutiapa', 'Petén', 'Quetzaltenango', 'Quiché', 'Retalhuleu',
  'Sacatepéquez', 'San Marcos', 'Santa Rosa', 'Sololá', 'Suchitepéquez',
  'Totonicapán', 'Zacapa'
];

export function useRemoteSaleForm({ eventId, onSaleRegistered, cart }) {
  const { authFetch } = useAuth();
  const { cartItems, setCartItems, discount, clearCart } = cart;

  // CRM & Cliente
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isInlineCreation, setIsInlineCreation] = useState(false);
  const [customerData, setCustomerData] = useState({
    fullName: '',
    phone: '',
    email: '',
    deliveryAddress: '',
    department: 'Guatemala',
    municipality: 'Guatemala',
    sourceChannel: 'WHATSAPP',
    notes: '',
  });

  // Logística y Flete
  const [deliveryMethod, setDeliveryMethod] = useState('ENVIO_COURIER');
  const [shippingCost, setShippingCost] = useState(35);
  const [shippingCourier, setShippingCourier] = useState('GUATEX');
  const [shippingTrackingNumber, setShippingTrackingNumber] = useState('');
  const [pickupEventId, setPickupEventId] = useState(eventId || '');
  const [availablePickupEvents, setAvailablePickupEvents] = useState([]);

  // Anticipo, Comprobante y Pagos
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
          const list = Array.isArray(json.data) ? json.data : (json.data?.customers || []);
          setCustomerResults(list);
        }
      } catch (err) {
        console.error('Error buscando clientes:', err);
      } finally {
        setIsSearchingCustomer(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [customerQuery, authFetch]);

  // Cargar eventos para retiro si el método es RETIRO_EVENTO
  useEffect(() => {
    let isMounted = true;
    async function loadEvents() {
      try {
        const res = await authFetch('/api/events');
        const json = await res.json();
        if (isMounted && json.success && Array.isArray(json.data)) {
          setAvailablePickupEvents(json.data.filter((e) => e.status === 'ACTIVO' || e.id === eventId));
        }
      } catch (_) {}
    }
    loadEvents();
    return () => { isMounted = false; };
  }, [authFetch, eventId]);

  // Aritmética financiera reactiva
  const productsSubtotal = cartItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
  const productsAmount = Math.max(0, Number((productsSubtotal - (Number(discount) || 0)).toFixed(2)));
  const effectiveShippingCost = deliveryMethod === 'ENVIO_COURIER' ? Number(shippingCost || 0) : 0;
  const totalAmount = Number((productsAmount + effectiveShippingCost).toFixed(2));
  const minDeposit = Number((totalAmount * 0.50).toFixed(2));

  // Sincronizar anticipo por defecto si el usuario aún no ingresó uno manual
  useEffect(() => {
    if (totalAmount > 0 && (!depositInput || Number(depositInput) === 0)) {
      setDepositInput(minDeposit.toString());
    }
  }, [totalAmount, minDeposit]);

  const numericDeposit = Number(depositInput) || 0;
  const balanceDue = Math.max(0, Number((totalAmount - numericDeposit).toFixed(2)));
  const isDepositValid = totalAmount > 0 && numericDeposit >= minDeposit;

  // Selección de cliente autocompletado
  const selectCustomer = (cust) => {
    setSelectedCustomer(cust);
    setCustomerQuery('');
    setCustomerResults([]);
    setIsInlineCreation(false);
    setCustomerData({
      fullName: cust.fullName || '',
      phone: cust.phone || '',
      email: cust.email || '',
      deliveryAddress: cust.deliveryAddress || '',
      department: cust.department || 'Guatemala',
      municipality: cust.municipality || 'Guatemala',
      sourceChannel: cust.sourceChannel || 'WHATSAPP',
      notes: cust.notes || '',
    });
  };

  const clearSelectedCustomer = () => {
    setSelectedCustomer(null);
    setCustomerData({
      fullName: '',
      phone: '',
      email: '',
      deliveryAddress: '',
      department: 'Guatemala',
      municipality: 'Guatemala',
      sourceChannel: 'WHATSAPP',
      notes: '',
    });
  };

  // Inyección de ítem personalizado al carrito
  const addCustomItem = ({ description, unitPrice, quantity = 1, material = 'MDF_5_5MM', customDimensions = '30x40 cm', customImageUrl = null }) => {
    const qty = Number(quantity) || 1;
    const price = Number(unitPrice) || 0;
    const newItem = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      productId: null,
      description: `Personalizado: ${description.trim()} (${material}, ${customDimensions})`,
      unitPrice: price,
      quantity: qty,
      subtotal: Number((qty * price).toFixed(2)),
      isCustom: true,
      material,
      customDimensions,
      customImageUrl,
      availableSizes: [{ sizeId: 'CUSTOM', nombre: customDimensions || 'Personalizado', precio: price }],
      selectedSizeId: 'CUSTOM',
    };
    setCartItems((prev) => [...prev, newItem]);
  };

  // Despacho de la orden remota a POST /api/sales/remote
  const confirmRemoteSale = async () => {
    if (cartItems.length === 0) {
      setSubmitError('Debes agregar al menos un producto a la orden.');
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
    if (numericDeposit < minDeposit) {
      setSubmitError(`Anticipo insuficiente: Para iniciar producción se requiere un abono mínimo de Q ${minDeposit.toFixed(2)} (50%).`);
      return false;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const clientUuid = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `sale-rem-${Date.now()}`;
    const payload = {
      eventId: eventId || 'evt-ventas-redes-online',
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
      payments: [
        {
          method: depositPaymentMethod,
          amount: numericDeposit,
          reference: depositReference?.trim() || null,
          receiptUrl: depositReceiptUrl || null,
        },
      ],
      discount: Number(discount) || 0,
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
    deliveryMethod, setDeliveryMethod, shippingCost, setShippingCost,
    shippingCourier, setShippingCourier, shippingTrackingNumber, setShippingTrackingNumber,
    pickupEventId, setPickupEventId, availablePickupEvents,
    productsSubtotal, productsAmount, effectiveShippingCost, totalAmount, minDeposit,
    depositInput, setDepositInput, numericDeposit, balanceDue, isDepositValid,
    depositPaymentMethod, setDepositPaymentMethod, depositReference, setDepositReference,
    depositReceiptUrl, setDepositReceiptUrl, isUploadingReceipt, receiptUploadError, handleReceiptUpload,
    remoteSaleNotes, setRemoteSaleNotes, isSubmitting, submitError, setSubmitError,
    completedSale, showShareModal, setShowShareModal,
    addCustomItem, confirmRemoteSale,
  };
}

export default useRemoteSaleForm;
