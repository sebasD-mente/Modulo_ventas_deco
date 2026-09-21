import {
  findOrCreateCustomer,
  createCustomer as createCustomerService,
  getCustomersList,
  getCustomerById,
  createRemoteSaleTransaction,
  registerBalancePayment as registerBalancePaymentService,
} from '../services/sales/remoteSaleService.js';
import { uploadBufferToStorage } from '../services/gcsStorageService.js';

/**
 * Consulta paginada y filtrado de clientes en CRM.
 */
export async function getCustomers(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const { query, phone, page, limit } = req.query;
    const result = await getCustomersList({ tenantId, query, phone, page, limit });

    return res.status(200).json({
      success: true,
      data: result.customers,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
    });
  } catch (err) {
    console.error('❌ Error consultando clientes:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error consultando clientes.',
    });
  }
}

/**
 * Registro manual de nuevo cliente en CRM. Rechaza duplicados con 409.
 */
export async function createCustomer(req, res) {
  try {
    const tenantId = req.tenantId;
    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const customer = await createCustomerService({
      tenantId,
      customerData: req.body,
    });

    return res.status(201).json({
      success: true,
      message: 'Cliente registrado exitosamente.',
      data: customer,
    });
  } catch (err) {
    console.error('❌ Error registrando cliente:', err);
    if (err.statusCode === 409 || err.code === 'P2002' || err.message?.includes('Ya existe un cliente')) {
      return res.status(409).json({
        success: false,
        error: err.message || 'Ya existe un cliente registrado con este número de teléfono/WhatsApp.',
      });
    }
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || 'Error registrando cliente.',
    });
  }
}

/**
 * Ficha 360 del Cliente (historial y métricas LTV).
 */
export async function getCustomer360(req, res) {
  try {
    const tenantId = req.tenantId;
    const { id } = req.params;

    if (!tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de empresa no válido.' });
    }

    const result = await getCustomerById({ tenantId, customerId: id });
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error('❌ Error obteniendo ficha 360 de cliente:', err);
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || 'Error obteniendo datos del cliente.',
    });
  }
}

/**
 * Creación de Venta Remota Multicanal con Compuerta 50/50.
 */
export async function createRemoteSale(req, res) {
  try {
    const sellerId = req.user?.id;
    const tenantId = req.tenantId;
    const rawKey = req.headers['idempotency-key'] || req.body.idempotencyKey || null;
    const idempotencyKey = typeof rawKey === 'string' && rawKey.trim() !== '' ? rawKey.trim() : null;

    if (!sellerId || !tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de usuario o empresa no válido.' });
    }

    const sale = await createRemoteSaleTransaction({
      tenantId,
      sellerId,
      data: req.body,
      idempotencyKey,
    });

    if (sale.idempotentReplay) {
      return res.status(200).json({
        success: true,
        idempotentReplay: true,
        message: 'Venta remota previamente registrada (Idempotent Replay).',
        data: sale,
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Venta remota registrada exitosamente.',
      data: sale,
    });
  } catch (err) {
    console.error('❌ Error creando venta remota:', err);
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || 'Error registrando la venta remota.',
    });
  }
}

/**
 * Cobro de saldo pendiente para entrega de orden.
 */
export async function registerBalancePayment(req, res) {
  try {
    const sellerId = req.user?.id;
    const tenantId = req.tenantId;
    const { id } = req.params;
    const { payments, notes } = req.body;

    if (!sellerId || !tenantId) {
      return res.status(400).json({ success: false, error: 'Contexto de usuario o empresa no válido.' });
    }

    const sale = await registerBalancePaymentService({
      saleId: id,
      tenantId,
      sellerId,
      payments,
      notes,
    });

    return res.status(200).json({
      success: true,
      message: 'Saldo liquidado y orden completada exitosamente.',
      data: sale,
    });
  } catch (err) {
    console.error('❌ Error cobrando saldo de venta remota:', err);
    return res.status(err.statusCode || 400).json({
      success: false,
      error: err.message || 'Error registrando el cobro de saldo.',
    });
  }
}

/**
 * Validador estricto de magic bytes para imágenes auténticas JPEG, PNG o WebP.
 */
function isValidImageMagicBytes(buf) {
  if (!buf || buf.length < 12) return false;
  const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  const isPng = buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47;
  const isWebp =
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP';
  return isJpeg || isPng || isWebp;
}

/**
 * Sube arte o foto personalizada a Google Cloud Storage bajo la carpeta 'custom_orders_arts'.
 * Valida presencia de archivo, límite de 15MB y firma binaria (magic bytes).
 */
export async function uploadCustomArt(req, res) {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ningún archivo de imagen para el arte personalizado.',
      });
    }

    const MAX_SIZE_BYTES = 15 * 1024 * 1024; // 15MB
    if (file.buffer.length > MAX_SIZE_BYTES) {
      return res.status(400).json({
        success: false,
        error: 'El archivo supera el límite máximo permitido de 15MB.',
      });
    }

    if (!isValidImageMagicBytes(file.buffer)) {
      return res.status(400).json({
        success: false,
        error: 'Firma binaria inválida. Solo se admiten archivos JPEG, PNG o WebP auténticos.',
      });
    }

    const uploadRes = await uploadBufferToStorage({
      buffer: file.buffer,
      originalname: file.originalname || 'custom-art.png',
      mimetype: file.mimetype || 'image/png',
      folder: 'custom_orders_arts',
    });

    return res.status(201).json({
      success: true,
      message: 'Arte subido a Cloud Storage con éxito.',
      url: uploadRes.url,
      filename: uploadRes.filename,
    });
  } catch (err) {
    console.error('❌ Error subiendo arte personalizado a GCS:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Error al procesar la subida del arte a Cloud Storage.',
    });
  }
}
