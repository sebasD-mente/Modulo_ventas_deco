import { z } from 'zod';

export const SETTLEMENT_STATUS = {
  PENDIENTE_PAGO: 'PENDIENTE_PAGO',
  PAGADO: 'PAGADO',
  RECHAZADO: 'RECHAZADO',
};

export const COMMISSION_RATE = 0.20;

/**
 * Esquema de validación para liquidar comisiones de ventas
 */
export const settleCommissionSchema = z.object({
  sellerId: z.string({ required_error: 'sellerId es requerido' }).uuid('sellerId debe ser un UUID válido'),
  saleIds: z.array(z.string().uuid('Cada saleId debe ser un UUID válido')).optional(),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional().nullable(),
});

/**
 * Esquema de validación para marcar una liquidación como pagada (desembolso)
 */
export const paySettlementSchema = z.object({
  paymentReference: z
    .string({ required_error: 'Referencia bancaria requerida' })
    .trim()
    .min(3, 'Referencia bancaria requerida')
    .max(100, 'La referencia bancaria no puede exceder 100 caracteres'),
  notes: z.string().max(500, 'Las notas no pueden exceder 500 caracteres').optional().nullable(),
});
