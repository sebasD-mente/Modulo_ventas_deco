import { z } from 'zod';

// Esquema para apertura/creación de un nuevo pliego de taller
export const createPrintSheetSchema = z.object({
  material: z.enum(['PVC_5MM', 'MDF_5_5MM', 'VINILO_SOLO', 'MIXTO'], {
    errorMap: () => ({ message: 'Material debe ser PVC_5MM, MDF_5_5MM, VINILO_SOLO o MIXTO' }),
  }),
  notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional().nullable(),
});

// Esquema para asignación de ítems de órdenes a un pliego
export const assignItemsToSheetSchema = z.object({
  saleItemIds: z
    .array(z.string().uuid('Cada ID de ítem debe ser un UUID válido'))
    .min(1, 'Debe especificarse al menos un ítem para asignar al pliego'),
});

// Esquema para actualización de estado del pliego de taller
export const updateSheetStatusSchema = z.object({
  status: z.enum(['ABIERTO', 'EN_PRODUCCION', 'IMPRESO', 'TERMINADO'], {
    errorMap: () => ({ message: 'Estado debe ser ABIERTO, EN_PRODUCCION, IMPRESO o TERMINADO' }),
  }),
  notes: z.string().max(1000, 'Las notas no pueden exceder 1000 caracteres').optional().nullable(),
});
