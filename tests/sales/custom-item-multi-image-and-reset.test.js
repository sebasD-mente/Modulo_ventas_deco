import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_custom_art_feat018_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { createRemoteSaleSchema } from '../../server/validators/remoteSaleValidators.js';
import { prisma } from '../../server/config/prisma.js';
import { createRemoteSaleTransaction } from '../../server/services/sales/remoteSaleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

/**
 * Carga los helpers exportados reales desde módulos frontend (.jsx / .js con imports Vite)
 * truncando únicamente el componente/hook React por defecto para ejecutarlos nativamente en Node ESM.
 */
async function loadModuleHeaderExports(relPath, splitMarker) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const splitIdx = source.indexOf(splitMarker);
  assert.ok(splitIdx > 0, `${relPath} debe contener "${splitMarker}"`);
  const headerOnly =
    'const compressImage = async (f) => f;\n' +
    source.slice(0, splitIdx).replace(/^import\s+[^\n]*from\s+['"][^'"]+['"];?\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

const uploaderHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/CustomArtUploader.jsx',
  'export default function CustomArtUploader'
);
const modalHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/CustomItemModal.jsx',
  'export default function CustomItemModal'
);
const remoteHookHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/hooks/useRemoteSaleForm.js',
  'export function useRemoteSaleForm'
);

function extractOpeningTags(content) {
  const tags = [];
  const regex = /<(button|input|select)\b/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const startPos = match.index;
    const tagName = match[1];
    let i = startPos + match[0].length;
    let inBraces = 0;
    let inQuote = null;
    let tagContent = '';
    while (i < content.length) {
      const ch = content[i];
      if (inQuote) {
        if (ch === '\\') { i += 2; continue; }
        if (ch === inQuote) inQuote = null;
      } else if (ch === '"' || ch === "'" || ch === '`') {
        inQuote = ch;
      } else if (ch === '{') {
        inBraces++;
      } else if (ch === '}') {
        inBraces--;
      } else if (ch === '>' && inBraces === 0) {
        tagContent = content.slice(startPos, i + 1);
        break;
      }
      i++;
    }
    tags.push({ tagName, tagContent, startPos });
  }
  return tags;
}

describe('feat-018: Desbloqueo de Múltiples Diseños e Imágenes en Pedidos Personalizados (Reinicio Limpio + multiple + 1-a-1 SaleItem)', () => {
  const modalPath = path.join(ROOT, 'src/components/manual-sale/CustomItemModal.jsx');
  const uploaderPath = path.join(ROOT, 'src/components/manual-sale/CustomArtUploader.jsx');
  const hookPath = path.join(ROOT, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');

  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const uploaderContent = fs.readFileSync(uploaderPath, 'utf8');
  const hookContent = fs.readFileSync(hookPath, 'utf8');

  describe('1. Reinicio Limpio del Modal (Solución al bloqueo del 2.º diseño en adelante)', () => {
    it('1.1 createInitialCustomModalState devuelve estado 100% limpio y CustomItemModal ejecuta resetModalState al abrir, cerrar y confirmar', () => {
      const initial = modalHelpers.createInitialCustomModalState();
      assert.deepEqual(initial, {
        mode: 'STANDARD',
        material: 'MDF_5_5MM',
        selectedSize: null,
        customWidth: '',
        customHeight: '',
        unitPrice: '',
        quantity: 1,
        description: '',
        uploadedArts: [],
        customImageUrl: '',
        isUploading: false,
        uploadError: '',
        showUrlInput: false,
        errorMsg: '',
      });

      // Debe reiniciar al abrir (useEffect sobre isOpen), al cerrar (handleClose) y al confirmar (handleSubmit)
      assert.ok(
        /useEffect\(\(\)\s*=>\s*\{\s*if\s*\(isOpen\)\s*resetModalState\(\);?\s*\}/.test(modalContent),
        'CustomItemModal debe reiniciar el estado cada vez que isOpen pasa a true'
      );
      assert.ok(
        modalContent.includes('const handleClose = () => {\n    resetModalState();\n    onClose();\n  };'),
        'handleClose debe limpiar el estado antes de invocar onClose()'
      );
      assert.ok(
        modalContent.includes('for (const itemPayload of payloads) onAddCustomItem(itemPayload);\n    resetModalState();\n    onClose();'),
        'handleSubmit debe limpiar el estado tras inyectar los diseños al carrito'
      );
      assert.ok(
        modalContent.includes('revokeArtPreviewUrls(prev)'),
        'resetModalState debe revocar cualquier blob: URL previo para evitar fugas de memoria'
      );
    });

    it('1.2 Elimina por completo el bloqueo uploadSuccess y mantiene siempre activo el input multiple + limpieza de e.target.value', () => {
      assert.ok(
        !modalContent.includes('uploadSuccess') && !uploaderContent.includes('uploadSuccess'),
        'El flag bloqueante uploadSuccess no debe existir ni ocultar el selector de archivos'
      );
      assert.ok(
        uploaderContent.includes('type="file"') && uploaderContent.includes('multiple'),
        'CustomArtUploader debe incluir <input type="file" multiple>'
      );
      assert.ok(
        uploaderContent.includes("e.target.value = '';"),
        'handleInputChange debe limpiar e.target.value para permitir volver a elegir el mismo archivo'
      );
      assert.ok(
        uploaderContent.includes('+ Agregar más imágenes a este lote'),
        'Cuando ya hay imágenes subidas, el botón para agregar más imágenes permanece siempre disponible'
      );
    });

    it('1.3 Simulación multi-apertura: agregar 3 tandas consecutivas en un mismo pedido nunca arrastra imágenes ni precios previos', () => {
      const cart = [];
      const addCustomItem = (payload) => {
        cart.push(remoteHookHelpers.createCartCustomItem(payload));
      };

      // Apertura #1: 1 retrato mediano con 1 foto
      let state1 = modalHelpers.createInitialCustomModalState();
      state1 = {
        ...state1,
        description: 'Retrato Mascota',
        material: 'MDF_5_5MM',
        unitPrice: '65',
        quantity: 1,
        uploadedArts: [{ id: 'a1', url: 'https://storage.googleapis.com/deko/mascota-1.jpg' }],
      };
      for (const p of modalHelpers.buildCustomItemPayloads({ ...state1, customDimensions: 'Estándar: Mediano (30x45 cm)' })) {
        addCustomItem(p);
      }

      // Apertura #2 (tras resetModalState): el estado vuelve limpio y sube 2 fotos distintas en lote
      const cleanAfterFirst = modalHelpers.createInitialCustomModalState();
      assert.equal(cleanAfterFirst.uploadedArts.length, 0);
      assert.equal(cleanAfterFirst.customImageUrl, '');
      assert.equal(cleanAfterFirst.description, '');
      assert.equal(cleanAfterFirst.unitPrice, '');

      const state2 = {
        ...cleanAfterFirst,
        description: 'Collage Familiar',
        material: 'PVC_5MM',
        unitPrice: '140',
        quantity: 1,
        uploadedArts: [
          { id: 'b1', url: 'https://storage.googleapis.com/deko/familia-1.jpg' },
          { id: 'b2', url: 'https://storage.googleapis.com/deko/familia-2.jpg' },
        ],
      };
      for (const p of modalHelpers.buildCustomItemPayloads({ ...state2, customDimensions: 'Estándar: Grande (45x60 cm)' })) {
        addCustomItem(p);
      }

      // Apertura #3 (tras resetModalState): agrega un 4.º diseño por URL externa
      const state3 = {
        ...modalHelpers.createInitialCustomModalState(),
        description: 'Póster Anime Especial',
        material: 'VINILO_SOLO',
        unitPrice: '45',
        quantity: 2,
        customImageUrl: 'https://drive.google.com/file/d/anime-hd',
      };
      for (const p of modalHelpers.buildCustomItemPayloads({ ...state3, customDimensions: 'Especial: 40 x 50 cm (Corte Taller)' })) {
        addCustomItem(p);
      }

      assert.equal(cart.length, 4, 'El carrito debe acumular los 4 diseños personalizados independientes');
      assert.equal(cart[0].customImageUrl, 'https://storage.googleapis.com/deko/mascota-1.jpg');
      assert.equal(cart[1].customImageUrl, 'https://storage.googleapis.com/deko/familia-1.jpg');
      assert.equal(cart[2].customImageUrl, 'https://storage.googleapis.com/deko/familia-2.jpg');
      assert.equal(cart[3].customImageUrl, 'https://drive.google.com/file/d/anime-hd');
      assert.equal(new Set(cart.map((c) => c.id)).size, 4, 'Los 4 ítems deben tener IDs únicos');
    });
  });

  describe('2. Carga Múltiple en Lote, Validación y Remoción Individual en CustomArtUploader.jsx', () => {
    it('2.1 validateArtFile acepta JPEG/PNG/WebP/HEIC (incluido mime vacío móvil) y rechaza formatos inválidos o > 15MB', () => {
      assert.equal(uploaderHelpers.validateArtFile({ name: 'foto1.jpg', type: 'image/jpeg', size: 500_000 }).valid, true);
      assert.equal(uploaderHelpers.validateArtFile({ name: 'foto2.png', type: 'image/png', size: 2_000_000 }).valid, true);
      assert.equal(uploaderHelpers.validateArtFile({ name: 'foto3.webp', type: 'image/webp', size: 1_000_000 }).valid, true);
      assert.equal(uploaderHelpers.validateArtFile({ name: 'iphone.HEIC', type: '', size: 3_000_000 }).valid, true);

      const badFormat = uploaderHelpers.validateArtFile({ name: 'virus.exe', type: 'application/octet-stream', size: 1024 });
      assert.equal(badFormat.valid, false);
      assert.match(badFormat.error, /Formato inválido/);

      const tooLarge = uploaderHelpers.validateArtFile({ name: 'gigante.png', type: 'image/png', size: 16 * 1024 * 1024 });
      assert.equal(tooLarge.valid, false);
      assert.match(tooLarge.error, /15MB/);
    });

    it('2.2 uploadArtFilesBatch sube múltiples imágenes en una sola selección, conserva las exitosas y limpia blob URL si alguna falla', async () => {
      const revokedUrls = [];
      const origRevoke = globalThis.URL.revokeObjectURL;
      globalThis.URL.revokeObjectURL = (u) => revokedUrls.push(u);

      try {
        let callIdx = 0;
        const mockAuthFetch = async (url, opts) => {
          assert.equal(url, '/api/sales/upload-art');
          assert.equal(opts.method, 'POST');
          callIdx += 1;
          if (callIdx === 2) {
            return { ok: false, json: async () => ({ success: false, error: 'Archivo corrupto en #2.' }) };
          }
          return {
            ok: true,
            json: async () => ({
              success: true,
              url: `https://storage.googleapis.com/deko/batch-${callIdx}.jpg`,
            }),
          };
        };

        const files = [
          new File([new Uint8Array([1, 2, 3])], 'diseno-a.jpg', { type: 'image/jpeg' }),
          new File([new Uint8Array([4, 5, 6])], 'diseno-corrupto.jpg', { type: 'image/jpeg' }),
          new File([new Uint8Array([7, 8, 9])], 'diseno-c.png', { type: 'image/png' }),
        ];

        let previewIdx = 0;
        const { uploaded, errors } = await uploaderHelpers.uploadArtFilesBatch({
          files,
          authFetch: mockAuthFetch,
          compressFn: async (f) => f,
          createPreviewUrl: () => `blob:https://ventas.decovintage.online/mock-${++previewIdx}`,
        });

        assert.equal(uploaded.length, 2, 'Debe conservar las 2 imágenes exitosas del lote');
        assert.equal(uploaded[0].url, 'https://storage.googleapis.com/deko/batch-1.jpg');
        assert.equal(uploaded[0].name, 'diseno-a.jpg');
        assert.equal(uploaded[1].url, 'https://storage.googleapis.com/deko/batch-3.jpg');
        assert.equal(uploaded[1].name, 'diseno-c.png');
        assert.notEqual(uploaded[0].id, uploaded[1].id, 'Cada miniatura subida debe recibir un ID único');

        assert.equal(errors.length, 1);
        assert.match(errors[0], /Archivo corrupto en #2/);
        assert.deepEqual(revokedUrls, ['blob:https://ventas.decovintage.online/mock-2']);
      } finally {
        globalThis.URL.revokeObjectURL = origRevoke;
      }
    });

    it('2.3 Quitar una miniatura individual revoca su blob: URL y permite seguir sumando nuevas imágenes al lote', () => {
      const revoked = [];
      const origRevoke = globalThis.URL.revokeObjectURL;
      globalThis.URL.revokeObjectURL = (u) => revoked.push(u);

      try {
        let arts = [
          { id: 'art-1', url: 'https://storage.googleapis.com/deko/1.jpg', previewUrl: 'blob:mock-1', name: '1.jpg' },
          { id: 'art-2', url: 'https://storage.googleapis.com/deko/2.jpg', previewUrl: 'blob:mock-2', name: '2.jpg' },
          { id: 'art-3', url: 'https://storage.googleapis.com/deko/3.jpg', previewUrl: 'blob:mock-3', name: '3.jpg' },
        ];

        // El vendedor se equivocó con la imagen 2 y la quita
        const target = arts.find((a) => a.id === 'art-2');
        uploaderHelpers.revokeArtPreviewUrls([target]);
        arts = arts.filter((a) => a.id !== 'art-2');

        assert.equal(arts.length, 2);
        assert.deepEqual(arts.map((a) => a.id), ['art-1', 'art-3']);
        assert.deepEqual(revoked, ['blob:mock-2']);

        // Luego agrega una 4.ª imagen corregida al lote
        arts = [...arts, { id: 'art-4', url: 'https://storage.googleapis.com/deko/4.jpg', previewUrl: 'blob:mock-4', name: '4.jpg' }];
        assert.equal(arts.length, 3);
        assert.deepEqual(arts.map((a) => a.url), [
          'https://storage.googleapis.com/deko/1.jpg',
          'https://storage.googleapis.com/deko/3.jpg',
          'https://storage.googleapis.com/deko/4.jpg',
        ]);
      } finally {
        globalThis.URL.revokeObjectURL = origRevoke;
      }
    });
  });

  describe('3. Inyección 1-a-1 al Carrito, Cero Colisión de IDs y Persistencia Transaccional (Zod + Backend)', () => {
    it('3.1 Caso 0 o 1 imagen: buildCustomItemPayloads genera exactamente 1 ítem sin sufijo de lote', () => {
      const noArt = modalHelpers.buildCustomItemPayloads({
        description: 'Cuadro Minimalista',
        material: 'MDF_5_5MM',
        customDimensions: 'Estándar: Mediano (30x45 cm)',
        unitPrice: 65,
        quantity: 2,
        uploadedArts: [],
        customImageUrl: '',
      });
      assert.equal(noArt.length, 1);
      assert.equal(noArt[0].description, 'Cuadro Minimalista');
      assert.equal(noArt[0].quantity, 2);
      assert.equal(noArt[0].customImageUrl, null);

      const singleArt = modalHelpers.buildCustomItemPayloads({
        description: 'Cuadro Minimalista',
        material: 'MDF_5_5MM',
        customDimensions: 'Estándar: Mediano (30x45 cm)',
        unitPrice: 65,
        quantity: 2,
        uploadedArts: [{ id: 'a1', url: 'https://storage.googleapis.com/deko/unico.jpg' }],
        customImageUrl: '',
      });
      assert.equal(singleArt.length, 1);
      assert.equal(singleArt[0].description, 'Cuadro Minimalista');
      assert.equal(singleArt[0].customImageUrl, 'https://storage.googleapis.com/deko/unico.jpg');
    });

    it('3.2 Caso N > 1 imágenes: genera N ítems independientes etiquetados Diseño 1/N..N/N y deduplica URL repetida', () => {
      const batchPayloads = modalHelpers.buildCustomItemPayloads({
        description: 'Set Anime Personalizado',
        material: 'PVC_5MM',
        customDimensions: 'Estándar: Mediano (30x45 cm)',
        unitPrice: 80,
        quantity: 1,
        uploadedArts: [
          { id: '1', url: 'https://storage.googleapis.com/deko/goku.jpg' },
          { id: '2', url: 'https://storage.googleapis.com/deko/vegeta.jpg' },
          { id: '3', url: 'https://storage.googleapis.com/deko/broly.jpg' },
        ],
        // URL repetida no debe duplicar ítem, pero si fuera nueva se suma
        customImageUrl: 'https://storage.googleapis.com/deko/goku.jpg',
      });

      assert.equal(batchPayloads.length, 3);
      assert.equal(batchPayloads[0].description, 'Set Anime Personalizado — Diseño 1/3');
      assert.equal(batchPayloads[0].customImageUrl, 'https://storage.googleapis.com/deko/goku.jpg');
      assert.equal(batchPayloads[1].description, 'Set Anime Personalizado — Diseño 2/3');
      assert.equal(batchPayloads[1].customImageUrl, 'https://storage.googleapis.com/deko/vegeta.jpg');
      assert.equal(batchPayloads[2].description, 'Set Anime Personalizado — Diseño 3/3');
      assert.equal(batchPayloads[2].customImageUrl, 'https://storage.googleapis.com/deko/broly.jpg');
    });

    it('3.3 Ráfaga síncrona de 15 ítems en createCartCustomItem produce 15 IDs únicos, valida en createRemoteSaleSchema y crea 3 SaleItems en A_PRODUCCION', async () => {
      const burstItems = Array.from({ length: 15 }, (_, i) =>
        remoteHookHelpers.createCartCustomItem({
          description: `Obra Lote — Diseño ${i + 1}/15`,
          material: 'MDF_5_5MM',
          customDimensions: 'Estándar: Mediano (30x45 cm)',
          unitPrice: 65,
          quantity: 1,
          customImageUrl: `https://storage.googleapis.com/deko/lote-${i + 1}.jpg`,
        })
      );
      assert.equal(new Set(burstItems.map((it) => it.id)).size, 15, 'Cero colisión de IDs en ráfagas síncronas');

      const threeItemsForOrder = burstItems.slice(0, 3).map((it) => ({
        productId: it.productId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        isCustom: it.isCustom,
        material: it.material,
        customDimensions: it.customDimensions,
        customImageUrl: it.customImageUrl,
      }));

      const remotePayload = {
        eventId: 'evt-ventas-redes-online',
        customer: {
          fullName: 'Lucía Fernández',
          phone: '50255443322',
          deliveryAddress: 'Diagonal 6 12-42 Zona 10',
          department: 'Guatemala',
          municipality: 'Guatemala',
          sourceChannel: 'INSTAGRAM',
        },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
        shippingCourier: 'GUATEX',
        items: threeItemsForOrder,
        payments: [{ method: 'TRANSFERENCIA', amount: 50, reference: 'BOL-MULTI-018' }],
        discount: 0,
      };

      const parsed = createRemoteSaleSchema.parse(remotePayload);
      assert.equal(parsed.items.length, 3);

      let capturedSaleCreate = null;
      const mockTx = {
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => {
            capturedSaleCreate = data;
            return { id: 'sale-multi-018', ...data, items: data.items.create, payments: data.payments.create };
          },
        },
        customer: {
          findUnique: async () => null,
          findFirst: async () => null,
          create: async ({ data }) => ({ id: 'cust-lucia', ...data }),
          update: async ({ data }) => ({ id: 'cust-lucia', ...data }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 18 }),
        },
        auditLog: { create: async () => ({}) },
      };

      const origTx = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);
      try {
        const sale = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes-01',
          data: parsed,
        });

        assert.ok(sale);
        assert.equal(capturedSaleCreate.totalAmount, 230); // 3 * 65 + 35 flete
        assert.equal(capturedSaleCreate.depositAmount, 50);
        assert.equal(capturedSaleCreate.balanceDue, 180);
        assert.equal(capturedSaleCreate.items.create.length, 3, 'Cada imagen sube como su propio SaleItem independiente para Taller');
        assert.deepEqual(
          capturedSaleCreate.items.create.map((i) => i.customImageUrl),
          [
            'https://storage.googleapis.com/deko/lote-1.jpg',
            'https://storage.googleapis.com/deko/lote-2.jpg',
            'https://storage.googleapis.com/deko/lote-3.jpg',
          ]
        );
        assert.ok(capturedSaleCreate.items.create.every((i) => i.productionStatus === 'A_PRODUCCION'));
      } finally {
        prisma.$transaction = origTx;
      }
    });
  });

  describe('4. Guardarraíles de Ergonomía Táctil (>= 44px), Líneas y Paleta Libre de Naranja', () => {
    it('4.1 Todos los botones e inputs en CustomItemModal.jsx y CustomArtUploader.jsx cumplen min-h-[44px] / min-h-[48px]', () => {
      for (const [label, content] of [
        ['CustomItemModal.jsx', modalContent],
        ['CustomArtUploader.jsx', uploaderContent],
      ]) {
        const tags = extractOpeningTags(content);
        assert.ok(tags.length > 0, `${label} debe contener controles interactivos`);
        for (const [idx, { tagName, tagContent }] of tags.entries()) {
          if (tagContent.includes('type="hidden"')) continue;
          const okHeight =
            tagContent.includes('min-h-[44px]') ||
            tagContent.includes('min-h-[48px]') ||
            tagContent.includes('min-h-[50px]') ||
            tagContent.includes('h-11') ||
            tagContent.includes('h-12');
          assert.ok(okHeight, `En ${label}, <${tagName}> #${idx + 1} carece de min-h-[44px]: ${tagContent}`);

          if (tagName === 'button' && tagContent.includes('rounded-full') && !tagContent.includes('w-full')) {
            assert.ok(
              tagContent.includes('min-w-[44px]'),
              `En ${label}, botón circular #${idx + 1} requiere min-w-[44px]: ${tagContent}`
            );
          }
        }
      }
    });

    it('4.2 Respeta techos de líneas (<= 280 / <= 350), cero colores naranja/ámbar y cero CRLF', () => {
      assert.ok(modalContent.split('\n').length <= 280, `CustomItemModal.jsx excede 280 líneas`);
      assert.ok(uploaderContent.split('\n').length <= 280, `CustomArtUploader.jsx excede 280 líneas`);
      assert.ok(hookContent.split('\n').length <= 350, `useRemoteSaleForm.js excede 350 líneas`);

      assert.ok(!/amber-|orange-/.test(modalContent), 'CustomItemModal.jsx no debe usar clases amber/orange');
      assert.ok(!/amber-|orange-/.test(uploaderContent), 'CustomArtUploader.jsx no debe usar clases amber/orange');

      assert.equal(modalContent.includes('\r\n'), false, 'CustomItemModal.jsx debe tener 0 CRLF');
      assert.equal(uploaderContent.includes('\r\n'), false, 'CustomArtUploader.jsx debe tener 0 CRLF');
      assert.equal(hookContent.includes('\r\n'), false, 'useRemoteSaleForm.js debe tener 0 CRLF');
    });
  });
});
