import { z } from 'zod';

export const WEB_ORDER_STATUSES = ['PENDIENTE', 'IMPORTADO', 'DESCARTADO'];
export const WEB_ORDER_SOURCES = ['WEB_CART', 'WEB_CUSTOM', 'WEB_QUICK_POSTER'];

const optionalTrimmedString = (maxLen = 500) =>
  z.preprocess(
    (val) => (typeof val === 'string' && val.trim() === '' ? null : val),
    z.string().trim().max(maxLen).optional().nullable()
  );

export const webOrderCustomerInputSchema = z.object({
  fullName: optionalTrimmedString(120),
  name: optionalTrimmedString(120),
  phone: optionalTrimmedString(40),
  address: optionalTrimmedString(500),
  deliveryAddress: optionalTrimmedString(500),
  department: optionalTrimmedString(100),
  municipality: optionalTrimmedString(100),
  notes: optionalTrimmedString(500),
}).passthrough();

export const webOrderItemInputSchema = z.object({
  isCustom: z.boolean().optional(),
  posterId: z.union([z.string(), z.number()]).optional().nullable(),
  legacyId: z.union([z.string(), z.number()]).optional().nullable(),
  sku: optionalTrimmedString(120),
  title: optionalTrimmedString(200),
  titulo: optionalTrimmedString(200),
  description: optionalTrimmedString(300),
  sizeMode: optionalTrimmedString(32),
  sizeId: optionalTrimmedString(64),
  sizeLabel: optionalTrimmedString(120),
  selectedStandardSize: z.record(z.unknown()).optional().nullable(),
  customWidth: z.union([z.number(), z.string()]).optional().nullable(),
  customHeight: z.union([z.number(), z.string()]).optional().nullable(),
  customArea: z.union([z.number(), z.string()]).optional().nullable(),
  material: optionalTrimmedString(40),
  baseMaterial: optionalTrimmedString(40),
  quantity: z.coerce.number().int().positive().default(1),
  unitPrice: z.coerce.number().nonnegative().optional(),
  subtotal: z.coerce.number().nonnegative().optional(),
  totalPrice: z.coerce.number().nonnegative().optional(),
  imageUrl: optionalTrimmedString(1000),
  thumbUrl: optionalTrimmedString(1000),
  customImageUrl: optionalTrimmedString(1000),
  customNote: optionalTrimmedString(500),
}).passthrough();

export const webOrderCoreSchema = z.object({
  id: optionalTrimmedString(128),
  externalOrderId: optionalTrimmedString(128),
  orderNumber: z.string().trim().min(1, 'El código de pedido web (orderNumber) es obligatorio').max(64),
  orderSource: z.string().trim().optional().default('WEB_CUSTOM'),
  status: z.string().trim().optional().default('PENDIENTE'),
  customer: webOrderCustomerInputSchema.optional().nullable(),
  customerName: optionalTrimmedString(120),
  customerPhone: optionalTrimmedString(40),
  customerAddress: optionalTrimmedString(500),
  customerDepartment: optionalTrimmedString(100),
  customerNotes: optionalTrimmedString(500),
  totalUnits: z.coerce.number().int().positive().optional(),
  quotedTotal: z.coerce.number().nonnegative().optional(),
  totalPrice: z.coerce.number().nonnegative().optional(),
  createdAt: z.union([z.string(), z.date()]).optional().nullable(),
  items: z.array(webOrderItemInputSchema).min(1, 'El pedido web debe incluir al menos un diseño'),
}).passthrough();

export const webOrderPayloadSchema = z.union([
  z.object({
    event: z.string().trim().optional().default('web_order.created'),
    tenantId: optionalTrimmedString(128),
    order: webOrderCoreSchema,
  }).passthrough(),
  webOrderCoreSchema.extend({
    event: z.string().trim().optional(),
    tenantId: optionalTrimmedString(128),
  }),
]);

export const listWebOrdersQuerySchema = z.object({
  status: z.enum(['PENDIENTE', 'IMPORTADO', 'DESCARTADO', 'TODOS', 'ALL']).optional().default('PENDIENTE'),
  source: z.enum(['WEB_CART', 'WEB_CUSTOM', 'WEB_QUICK_POSTER', 'TODOS', 'ALL']).optional(),
  search: optionalTrimmedString(120),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const syncWebOrdersSchema = z.object({
  status: z.enum(['PENDIENTE', 'IMPORTADO', 'TODOS', 'ALL']).optional().default('PENDIENTE'),
  limit: z.coerce.number().int().min(1).max(200).optional().default(100),
});

export const discardWebOrderSchema = z.object({
  reason: optionalTrimmedString(300),
});
