import { z } from 'zod';

export const saleItemSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  productId: z.string().uuid().optional().nullable(),
  description: z.string().min(1, 'La descripción del ítem es requerida'),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().nonnegative('El precio unitario no puede ser negativo'),
});

export const salePaymentSchema = z.object({
  method: z.enum(['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'OTRO'], {
    errorMap: () => ({ message: 'Método de pago debe ser EFECTIVO, TARJETA, TRANSFERENCIA u OTRO' }),
  }),
  amount: z.number().positive('El monto pagado debe ser mayor a 0'),
  reference: z.string().max(100).optional().nullable(),
  receiptUrl: z.string().url().optional().nullable(),
});

export const saleAttachmentSchema = z.object({
  fileUrl: z.string().url('La URL del archivo adjunto debe ser válida'),
  fileType: z.string().min(1, 'El tipo de archivo es requerido'),
  fileName: z.string().optional().nullable(),
  fileSize: z.number().nonnegative().optional().nullable(),
  transcription: z.string().optional().nullable(),
  aiMetadata: z.any().optional().nullable(),
});

export const createSaleSchema = z.object({
  eventId: z.string().uuid('El ID de evento debe ser un UUID válido'),
  items: z.array(saleItemSchema).min(1, 'La venta debe incluir al menos un producto'),
  payments: z.array(salePaymentSchema).min(1, 'Debe especificarse al menos un método de pago'),
  discount: z.number().nonnegative('El descuento no puede ser negativo').default(0),
  notes: z.string().max(500).optional().nullable(),
  inputChannel: z.enum([
    'MANUAL_POS',
    'MANUAL_RAPIDA',
    'IA_VOZ',
    'IA_IMAGEN_QR',
    'IA_TEXTO',
    'IA_CHAT_TEXTO',
    'IA_FOTO_ARTE',
    'IA_VIDEO_MOSTRADOR',
  ]).default('MANUAL_POS'),
  attachments: z.array(saleAttachmentSchema).optional().default([]),
});

export const cashClosingSchema = z.object({
  eventId: z.string().uuid('El ID de evento debe ser un UUID válido'),
  closingType: z.enum(['DIARIO', 'FINAL_EVENTO']).default('DIARIO'),
  totalCashReported: z.number().nonnegative('El efectivo reportado debe ser mayor o igual a 0'),
  observations: z.string().max(1000).optional().nullable(),
});

export const updateSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, 'La venta debe incluir al menos un producto').optional(),
  payments: z.array(salePaymentSchema).min(1, 'Debe especificarse al menos un método de pago').optional(),
  discount: z.number().nonnegative('El descuento no puede ser negativo').optional(),
  notes: z.string().max(500).optional().nullable(),
  attachments: z.array(saleAttachmentSchema).optional(),
});
