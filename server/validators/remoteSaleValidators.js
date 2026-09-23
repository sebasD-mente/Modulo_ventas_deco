import { z } from 'zod';

// Esquema de Cliente CRM
export const customerSchema = z.object({
  fullName: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100, 'El nombre no puede exceder 100 caracteres'),
  phone: z.string().trim().regex(/^\+?[0-9]{8,15}$/, 'El teléfono debe contener entre 8 y 15 dígitos numéricos'),
  email: z.string().email('Email inválido').optional().nullable().or(z.literal('')),
  deliveryAddress: z.string().trim().min(5, 'La dirección debe tener al menos 5 caracteres').optional().nullable(),
  department: z.string().trim().max(100).optional().nullable(),
  municipality: z.string().trim().max(100).optional().nullable(),
  sourceChannel: z.enum(['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'OTRO']).default('WHATSAPP'),
  notes: z.string().max(500).optional().nullable(),
});

// Esquema de Ítem Remoto / Personalizado
export const remoteSaleItemSchema = z.object({
  productId: z.string().uuid('El ID de producto debe ser un UUID válido').optional().nullable(),
  description: z.string().trim().min(1, 'La descripción del ítem es requerida'),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0').default(1),
  unitPrice: z.number().nonnegative('El precio unitario no puede ser negativo'),
  isCustom: z.boolean().default(false),
  material: z.enum(['PVC_5MM', 'MDF_5_5MM', 'VINILO_SOLO']).optional().nullable(),
  customDimensions: z.string().trim().max(100).optional().nullable(),
  customImageUrl: z.string().optional().nullable(),
});

// Esquema de Pago / Anticipo
export const remoteSalePaymentSchema = z.object({
  method: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'], {
    errorMap: () => ({ message: 'Método de pago debe ser EFECTIVO, TARJETA, TRANSFERENCIA u OTRO' }),
  }),
  amount: z.number().positive('El monto pagado debe ser mayor a 0'),
  reference: z.string().max(100).optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

// Esquema de Creación de Venta Remota 50/50
export const createRemoteSaleSchema = z.object({
  eventId: z.string().trim().min(1).optional().default('evt-ventas-redes-online'),
  customerId: z.string().uuid('El ID de cliente debe ser un UUID válido').optional().nullable(),
  customer: customerSchema.optional().nullable(),
  deliveryMethod: z.enum(['PUNTO_VENTA', 'ENVIO_COURIER', 'RETIRO_EVENTO']).default('ENVIO_COURIER'),
  shippingCost: z.number().nonnegative('El costo de flete no puede ser negativo').default(0),
  shippingCourier: z.string().trim().max(100).optional().nullable(),
  shippingTrackingNumber: z.string().trim().max(100).optional().nullable(),
  pickupEventId: z.string().trim().min(1).optional().nullable(),
  items: z.array(remoteSaleItemSchema).min(1, 'La orden debe incluir al menos un producto'),
  payments: z.array(remoteSalePaymentSchema).default([]),
  discount: z.number().nonnegative('El descuento no puede ser negativo').default(0),
  notes: z.string().max(500).optional().nullable(),
  idempotencyKey: z.string().max(255).optional().nullable(),
}).refine(
  (data) => Boolean(data.customerId || data.customer),
  { message: 'Debe especificar el cliente mediante customerId o un objeto de cliente (customer)', path: ['customer'] }
).refine(
  (data) => data.deliveryMethod !== 'RETIRO_EVENTO' || (typeof data.pickupEventId === 'string' && data.pickupEventId.trim().length > 0),
  { message: 'Debe especificar el evento de retiro (pickupEventId) cuando el método es RETIRO_EVENTO', path: ['pickupEventId'] }
);

// Esquema de Cobro de Saldo Restante
export const balancePaymentSchema = z.object({
  payments: z.array(remoteSalePaymentSchema).min(1, 'Debe registrar al menos un método de pago para cubrir el saldo'),
  notes: z.string().max(500).optional().nullable(),
});
