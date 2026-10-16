import { executeWithModelFallback, MODEL_PRIORITY_POOL } from '../geminiPoolService.js';
import { ENV } from '../../config/env.js';

const getActiveOcrPool = () => [
  ENV.GEMINI_MODEL && !ENV.GEMINI_MODEL.includes('2.5') ? ENV.GEMINI_MODEL : 'gemini-3.8-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  ...MODEL_PRIORITY_POOL,
].filter((v, i, a) => a.indexOf(v) === i);

export const receiptOcrResponseSchema = {
  type: 'object',
  properties: {
    isLegitReceipt: {
      type: 'boolean',
      description: 'True si la imagen corresponde a un comprobante bancario, boleta de depósito o captura de transferencia legítima.',
    },
    bank: {
      type: 'string',
      description: 'Nombre o sigla del banco emisor detectado (ej: BI / Banco Industrial, Banrural, BAC Credomatic, G&T Continental, BAM, etc.) o DESCONOCIDO.',
    },
    referenceNumber: {
      type: 'string',
      description: 'Número de autorización, transacción, transferencia o referencia bancaria impreso en la boleta.',
    },
    detectedAmount: {
      type: 'number',
      description: 'Monto monetario total transferido o depositado en Quetzales (Q) sin símbolos.',
    },
    date: {
      type: 'string',
      description: 'Fecha y/u hora registrada en la transacción (formato YYYY-MM-DD o texto detectado).',
    },
    senderName: {
      type: 'string',
      description: 'Nombre del cuentahabiente o remitente si es visible.',
    },
    notes: {
      type: 'string',
      description: 'Observaciones de auditoría forense sobre legibilidad, sellos o anomalías en la boleta.',
    },
  },
  required: ['isLegitReceipt', 'bank', 'referenceNumber', 'detectedAmount'],
};

export function buildReceiptOcrSystemPrompt() {
  return `Eres un Auditor Bancario Forense de Alta Precisión para Deco Vintage Guate (Guatemala).
Tu misión es inspeccionar minuciosamente la imagen de una boleta, váucher, comprobante electrónico o transferencia bancaria y extraer los metadatos contables exactos.

REGLAS DE AUDITORÍA:
1. Extrae el monto en Quetzales (Q) depositado/transferido con exactitud centesimal.
2. Identifica con certeza el banco emisor guatemalteco (Banco Industrial / BI en Línea, Banrural, BAC, G&T Continental, Promerica, BAM, Interbanco).
3. Extrae el número de referencia / autorización completo sin truncar dígitos.
4. Si la imagen NO es un comprobante bancario legítimo (ej. fotos de pósters, selfies, memes, documentos en blanco), asigna isLegitReceipt: false y detectedAmount: 0.
5. Devuelve la información estrictamente en JSON válido que satisfaga el esquema estructurado.`;
}

async function fetchImageBuffer(imageUrl) {
  if (!imageUrl || typeof imageUrl !== 'string') {
    throw new Error('URL de comprobante inválida o no proporcionada.');
  }

  if (imageUrl.startsWith('data:')) {
    const matches = imageUrl.match(/^data:([a-zA-Z0-9/+-]+);base64,(.+)$/);
    if (matches && matches[2]) {
      return {
        buffer: Buffer.from(matches[2], 'base64'),
        mimeType: matches[1] || 'image/jpeg',
      };
    }
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`No se pudo descargar la imagen del comprobante (HTTP ${response.status}).`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mimeType.split(';')[0].trim().toLowerCase(),
  };
}

/**
 * Servicio de Verificación Real de Comprobantes Bancarios mediante Gemini Vision
 */
export async function verifyDepositReceipt({ imageUrl, expectedAmount = 0, tenantId = null, geminiClient = null }) {
  const numericExpected = Number(Number(expectedAmount || 0).toFixed(2));
  const { buffer: imageBuffer, mimeType } = await fetchImageBuffer(imageUrl);

  const { result: response, usedModel } = await executeWithModelFallback({
    client: geminiClient,
    models: getActiveOcrPool(),
    actionName: 'OCR_VERIFY_RECEIPT',
    tenantId,
    taskFn: async ({ model, client }) => client.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { text: buildReceiptOcrSystemPrompt() },
          { inlineData: { data: imageBuffer.toString('base64'), mimeType } },
        ],
      }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: receiptOcrResponseSchema,
      },
    }),
  });

  let parsed = {};
  try {
    const raw = (response.text?.trim() || '{}').replace(/^```json\s*/i, '').replace(/\s*```$/i, '');
    parsed = JSON.parse(raw);
  } catch (parseErr) {
    throw new Error(`Respuesta no procesable del modelo de visión OCR: ${parseErr.message}`);
  }

  const detectedAmount = Number(Number(parsed.detectedAmount || 0).toFixed(2));
  const referenceNumber = String(parsed.referenceNumber || '').trim();
  const bank = String(parsed.bank || 'DESCONOCIDO').trim();
  const date = String(parsed.date || '').trim();
  const isLegitReceipt = Boolean(parsed.isLegitReceipt);
  const discrepancy = Number(Math.abs(detectedAmount - numericExpected).toFixed(2));
  const isMatch = isLegitReceipt && discrepancy < 0.05;

  let summary = '';
  if (!isLegitReceipt) {
    summary = '⚠️ La imagen adjunta no parece ser un comprobante o boleta bancaria válida.';
  } else if (isMatch) {
    summary = `✓ Boleta válida por Q ${detectedAmount.toFixed(2)} (${bank}) - Coincide con anticipo requerido`;
  } else {
    summary = `⚠️ Discrepancia: Boleta detectada por Q ${detectedAmount.toFixed(2)} (${bank}) vs Anticipo requerido Q ${numericExpected.toFixed(2)} (Diferencia: Q ${discrepancy.toFixed(2)})`;
  }

  return {
    isLegitReceipt,
    bank,
    referenceNumber,
    detectedAmount,
    expectedAmount: numericExpected,
    discrepancy,
    isMatch,
    date,
    senderName: parsed.senderName || null,
    notes: parsed.notes || null,
    summary,
    usedModel: usedModel || 'gemini-3.8-flash',
  };
}
