import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'super_secure_web_orders_ui_feat023_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = process.env.SUPER_ADMIN_EMAILS || 'superadmin@dekolabs.org';

import { createRemoteSaleSchema } from '../../server/validators/remoteSaleValidators.js';
import { prisma } from '../../server/config/prisma.js';
import { createRemoteSaleTransaction } from '../../server/services/sales/remoteSaleService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

async function loadModuleHeaderExports(relPath, splitMarker) {
  const fullPath = path.join(ROOT, relPath);
  const source = fs.readFileSync(fullPath, 'utf8');
  const splitIdx = source.indexOf(splitMarker);
  assert.ok(splitIdx > 0, `${relPath} debe contener "${splitMarker}"`);
  const headerOnly = source.slice(0, splitIdx).replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\r?\n/gm, '');
  const dataUrl = `data:text/javascript;base64,${Buffer.from(headerOnly, 'utf8').toString('base64')}`;
  return import(dataUrl);
}

const webImportHelpers = await loadModuleHeaderExports(
  'src/components/manual-sale/hooks/useWebOrderImport.js',
  'export function useWebOrderImport'
);
const { extractPosterSizeInfo } = await loadModuleHeaderExports(
  'src/components/production/ProductionOrderCard.jsx',
  'export default function ProductionOrderCard'
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

describe('feat-023: Vista Bandeja Web y Botón "Importar Pedido Web" con Ventana Flotante y Precarga Limpia', () => {
  const hookPath = path.join(ROOT, 'src/components/manual-sale/hooks/useWebOrderImport.js');
  const bannerPath = path.join(ROOT, 'src/components/manual-sale/WebOrderImportBanner.jsx');
  const modalPath = path.join(ROOT, 'src/components/manual-sale/WebOrdersImportModal.jsx');
  const inboxViewPath = path.join(ROOT, 'src/components/WebOrdersInboxView.jsx');
  const fastFormPath = path.join(ROOT, 'src/components/FastManualSaleForm.jsx');
  const remoteHookPath = path.join(ROOT, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');
  const headerPath = path.join(ROOT, 'src/components/Header.jsx');
  const appPath = path.join(ROOT, 'src/App.jsx');

  const hookContent = fs.readFileSync(hookPath, 'utf8');
  const bannerContent = fs.readFileSync(bannerPath, 'utf8');
  const modalContent = fs.readFileSync(modalPath, 'utf8');
  const inboxViewContent = fs.readFileSync(inboxViewPath, 'utf8');
  const fastFormContent = fs.readFileSync(fastFormPath, 'utf8');
  const remoteHookContent = fs.readFileSync(remoteHookPath, 'utf8');
  const headerContent = fs.readFileSync(headerPath, 'utf8');
  const appContent = fs.readFileSync(appPath, 'utf8');

  describe('1. Mapeo Puro de Pedidos Web hacia Carrito y Borrador CRM (useWebOrderImport.js)', () => {
    it('1.1 mapWebOrderItemToCartItem transforma pósters de catálogo (sincronizados o no) y personalizados con medidas decimales y materiales', () => {
      const syncedCatalogItem = webImportHelpers.mapWebOrderItemToCartItem({
        isCustom: false,
        productId: '11111111-2222-4333-8444-555555555555',
        posterId: '108',
        title: 'Pink Floyd The Wall',
        description: 'Pink Floyd The Wall (Mediano)',
        sizeMode: 'standard',
        sizeId: 'MEDIANO',
        sizeLabel: 'Mediano (30 x 45 cm)',
        material: 'MDF_5_5MM',
        quantity: 2,
        unitPrice: 65,
        imageUrl: 'https://decovintage.online/uploads/wall-hd.jpg',
        thumbUrl: 'https://decovintage.online/uploads/wall-sm.jpg',
      }, 0);

      assert.equal(syncedCatalogItem.isCustom, false);
      assert.equal(syncedCatalogItem.productId, '11111111-2222-4333-8444-555555555555');
      assert.equal(syncedCatalogItem.unitPrice, 65);
      assert.equal(syncedCatalogItem.quantity, 2);
      assert.equal(syncedCatalogItem.subtotal, 130);
      assert.equal(syncedCatalogItem.selectedSizeId, 'MEDIANO');
      assert.equal(syncedCatalogItem.imageUrl, 'https://decovintage.online/uploads/wall-hd.jpg');
      assert.equal(syncedCatalogItem.customImageUrl, null, 'Póster estándar con UUID local usa imageUrl del producto');

      const unsyncedWebCatalogItem = webImportHelpers.mapWebOrderItemToCartItem({
        isCustom: false,
        productId: null,
        posterId: '999',
        description: 'Obra Nueva Web (Grande)',
        sizeId: 'GRANDE',
        material: 'MDF_5_5MM',
        quantity: 1,
        unitPrice: 125,
        imageUrl: 'https://decovintage.online/uploads/nueva-hd.jpg',
      }, 1);

      assert.equal(unsyncedWebCatalogItem.productId, null);
      assert.equal(
        unsyncedWebCatalogItem.customImageUrl,
        'https://decovintage.online/uploads/nueva-hd.jpg',
        'Póster web aún no sincronizado preserva URL HD en customImageUrl para Taller'
      );

      const decimalCustomItem = webImportHelpers.mapWebOrderItemToCartItem({
        isCustom: true,
        sizeMode: 'custom',
        title: 'Retrato Familiar',
        description: 'Personalizado: Retrato Familiar (MDF_5_5MM, Especial: 42.2 x 30 cm (Corte Taller))',
        customDimensions: 'Especial: 42.2 x 30 cm (Corte Taller)',
        customWidth: 42.2,
        customHeight: 30,
        material: 'MDF_5_5MM',
        quantity: 2,
        unitPrice: 85.77,
        customImageUrl: 'https://decovintage.online/uploads/custom/familia-hd.png',
      }, 2);

      assert.equal(decimalCustomItem.isCustom, true);
      assert.equal(decimalCustomItem.productId, null);
      assert.equal(decimalCustomItem.material, 'MDF_5_5MM');
      assert.equal(decimalCustomItem.customDimensions, 'Especial: 42.2 x 30 cm (Corte Taller)');
      assert.equal(decimalCustomItem.unitPrice, 85.77);
      assert.equal(decimalCustomItem.subtotal, 171.54);
      assert.equal(decimalCustomItem.customImageUrl, 'https://decovintage.online/uploads/custom/familia-hd.png');

      const sizeBadge = extractPosterSizeInfo(decimalCustomItem);
      assert.equal(sizeBadge.sizeLabel, 'Especial: 42.2 x 30 cm (Corte Taller)');
    });

    it('1.2 buildWebOrderCustomerDraft y filterWebOrdersByQuery normalizan teléfono +502, departamentos con tilde y búsqueda', () => {
      const depts = ['Guatemala', 'Sacatepéquez', 'Quetzaltenango', 'Petén'];
      const draft = webImportHelpers.buildWebOrderCustomerDraft({
        customerName: '  Sofía Morales  ',
        customerPhone: '+502 5544-3322',
        customerAddress: 'Calle del Arco #12, Antigua',
        customerDepartment: 'Sacatepequez',
        customerNotes: 'Entregar en recepción',
      }, depts);

      assert.equal(draft.fullName, 'Sofía Morales');
      assert.equal(draft.phone, '50255443322');
      assert.equal(draft.lookupPhone, '55443322');
      assert.equal(draft.department, 'Sacatepéquez');
      assert.equal(draft.deliveryAddress, 'Calle del Arco #12, Antigua');
      assert.equal(draft.notes, 'Entregar en recepción');

      const sampleOrders = [
        { id: '1', orderNumber: 'CP-1024', customerName: 'Sofía Morales', customerPhone: '55443322' },
        { id: '2', orderNumber: 'CART-2048', customerName: 'Jorge Castillo', customerPhone: '44110099' },
      ];
      assert.equal(webImportHelpers.filterWebOrdersByQuery(sampleOrders, '#CP-1024').length, 1);
      assert.equal(webImportHelpers.filterWebOrdersByQuery(sampleOrders, 'jorge').length, 1);
      assert.equal(webImportHelpers.filterWebOrdersByQuery(sampleOrders, '4411').length, 1);
      assert.equal(webImportHelpers.filterWebOrdersByQuery(sampleOrders, '').length, 2);
    });
  });

  describe('2. Flujo Completo de Precarga -> Validación Zod -> Cierre Atómico IMPORTADO en Venta Remota', () => {
    it('2.1 Un pedido web precargado se valida en createRemoteSaleSchema y al confirmar marca WebOrderInbox como IMPORTADO con sello [Origen Web: #...]', async () => {
      const inboxOrder = {
        id: 'inbox-uuid-9023',
        tenantId: 'tenant-deko',
        orderNumber: 'CP-9023',
        orderSource: 'WEB_CUSTOM',
        status: 'PENDIENTE',
        customerName: 'Roberto Alvarado',
        customerPhone: '55887766',
        customerAddress: 'Boulevard Los Próceres Zona 10, Edif. Torre 2',
        customerDepartment: 'Guatemala',
        customerNotes: 'Llamar al llegar a garita',
        quotedTotal: 150.77,
        items: [
          {
            isCustom: true,
            sizeMode: 'custom',
            description: 'Personalizado: Mapa Estelar (MDF_5_5MM, Especial: 42.2 x 30 cm (Corte Taller))',
            customDimensions: 'Especial: 42.2 x 30 cm (Corte Taller)',
            customWidth: 42.2,
            customHeight: 30,
            material: 'MDF_5_5MM',
            quantity: 1,
            unitPrice: 85.77,
            customImageUrl: 'https://decovintage.online/uploads/custom/estelar.jpg',
          },
          {
            isCustom: false,
            productId: null,
            description: 'Interstellar Gargantua (Mediano)',
            sizeId: 'MEDIANO',
            material: 'MDF_5_5MM',
            quantity: 1,
            unitPrice: 65,
            imageUrl: 'https://decovintage.online/uploads/posters/interstellar.jpg',
          },
        ],
      };

      const cartItems = inboxOrder.items.map((it, idx) => webImportHelpers.mapWebOrderItemToCartItem(it, idx));
      const custDraft = webImportHelpers.buildWebOrderCustomerDraft(inboxOrder, ['Guatemala']);

      const remotePayload = createRemoteSaleSchema.parse({
        eventId: 'evt-ventas-redes-online',
        customer: {
          fullName: custDraft.fullName,
          phone: custDraft.phone,
          deliveryAddress: custDraft.deliveryAddress,
          department: custDraft.department,
          municipality: custDraft.municipality,
          sourceChannel: custDraft.sourceChannel,
          notes: custDraft.notes,
        },
        deliveryMethod: 'ENVIO_COURIER',
        shippingCost: 35,
        shippingCourier: 'GUATEX',
        items: cartItems.map((it) => ({
          productId: it.productId,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          isCustom: it.isCustom,
          material: it.material,
          customDimensions: it.customDimensions,
          customImageUrl: it.customImageUrl,
        })),
        payments: [{ method: 'TRANSFERENCIA', amount: 80, reference: 'BOL-WEB-9023' }],
        editionDescription: 'Texto de aniversario en blanco',
        editionCost: 20,
        webOrderInboxId: inboxOrder.id,
        webOrderNumber: inboxOrder.orderNumber,
        notes: custDraft.notes,
      });

      let inboxUpdatedData = null;
      let createdSaleData = null;

      const mockTx = {
        webOrderInbox: {
          findFirst: async ({ where }) => (where.id === inboxOrder.id ? { ...inboxOrder } : null),
          updateMany: async ({ data }) => {
            inboxUpdatedData = data;
            return { count: 1 };
          },
        },
        customer: {
          findUnique: async () => null,
          create: async ({ data }) => ({ id: 'cust-roberto', ...data }),
        },
        event: {
          findUnique: async () => ({ id: 'evt-ventas-redes-online', name: 'Ventas en Línea' }),
          update: async () => ({ name: 'REDES', currentSaleSequence: 90 }),
        },
        sale: {
          findFirst: async () => null,
          create: async ({ data }) => {
            createdSaleData = data;
            return {
              id: 'sale-from-web-9023',
              ...data,
              items: data.items.create,
              payments: data.payments.create,
              customer: { id: 'cust-roberto', fullName: 'Roberto Alvarado', phone: '55887766' },
              seller: { id: 'seller-redes', fullName: 'Vendedor Redes', email: 'redes@deko.gt' },
            };
          },
        },
        auditLog: { create: async () => ({}) },
      };

      const origTx = prisma.$transaction;
      prisma.$transaction = async (fn) => fn(mockTx);
      try {
        const result = await createRemoteSaleTransaction({
          tenantId: 'tenant-deko',
          sellerId: 'seller-redes',
          data: remotePayload,
        });

        // 85.77 + 65.00 = 150.77 productos + 20.00 edición + 35.00 flete = 205.77 total; anticipo 80 => saldo 125.77
        assert.equal(result.totalAmount, 205.77);
        assert.equal(result.depositAmount, 80);
        assert.equal(result.balanceDue, 125.77);
        assert.equal(inboxUpdatedData.status, 'IMPORTADO');
        assert.equal(inboxUpdatedData.importedSaleId, 'sale-from-web-9023');
        assert.match(createdSaleData.notes, /\[Origen Web: #CP-9023\]/);
        assert.match(createdSaleData.notes, /\[Edición \(\+Q 20\.00\): Texto de aniversario en blanco\]/);
        assert.equal(createdSaleData.items.create.length, 2);
        assert.equal(createdSaleData.items.create[0].customImageUrl, 'https://decovintage.online/uploads/custom/estelar.jpg');
        assert.equal(createdSaleData.items.create[1].customImageUrl, 'https://decovintage.online/uploads/posters/interstellar.jpg');
      } finally {
        prisma.$transaction = origTx;
      }
    });
  });

  describe('3. Regla de Oro UX: Cero Precarga Sorpresiva + Ventana Flotante + Pestaña Bandeja Web', () => {
    it('3.1 Nunca precarga un pedido automáticamente al montar: el modal inicia cerrado y linkedWebOrder en null', () => {
      assert.ok(
        hookContent.includes('const [isImportModalOpen, setIsImportModalOpen] = useState(false);'),
        'WebOrdersImportModal debe iniciar cerrado por defecto'
      );
      assert.ok(
        remoteHookContent.includes('const [linkedWebOrder, setLinkedWebOrder] = useState(null);'),
        'linkedWebOrder debe iniciar en null sin ningún pedido web pre-cargado'
      );

      // fetchPendingOrders solo actualiza lista y contador; jamás invoca importOrderToForm
      const fetchBlock = hookContent.slice(
        hookContent.indexOf('const fetchPendingOrders = useCallback'),
        hookContent.indexOf('const handleSyncFromWeb = useCallback')
      );
      assert.ok(!fetchBlock.includes('importOrderToForm'), 'fetchPendingOrders jamás debe auto-cargar pedidos en el formulario');
      assert.ok(!fetchBlock.includes('setCartItems'), 'fetchPendingOrders jamás debe tocar el carrito');
    });

    it('3.2 FastManualSaleForm monta WebOrderImportBanner al inicio de REDES_PERSONALIZADO preservando el orden DOM estricto', () => {
      const redesStart = fastFormContent.indexOf("saleMode === 'REDES_PERSONALIZADO'");
      const mostradorStart = fastFormContent.indexOf('MODO MOSTRADOR (FERIA 100%)');
      const redesSection = fastFormContent.slice(redesStart, mostradorStart);
      const mostradorSection = fastFormContent.slice(mostradorStart);

      const bannerIdx = redesSection.indexOf('<WebOrderImportBanner');
      const crmIdx = redesSection.indexOf('<CustomerWhatsAppSearch');
      const cartIdx = redesSection.indexOf('<SaleCartList');
      const editionIdx = redesSection.indexOf('<DesignEditionPanel');
      const deliveryIdx = redesSection.indexOf('<DeliveryMethodSelector');
      const quoterIdx = redesSection.indexOf('<RemoteQuoterSummary');

      assert.ok(bannerIdx !== -1 && bannerIdx < crmIdx, 'WebOrderImportBanner debe ir al inicio antes de CustomerWhatsAppSearch');
      assert.ok(crmIdx < cartIdx && cartIdx < editionIdx && editionIdx < deliveryIdx && deliveryIdx < quoterIdx);
      assert.ok(redesSection.includes('<WebOrdersImportModal'), 'REDES_PERSONALIZADO debe montar WebOrdersImportModal');
      assert.ok(!mostradorSection.includes('<WebOrderImportBanner'), 'POS_FERIA no debe mostrar WebOrderImportBanner');

      assert.ok(bannerContent.includes('Importar Pedido Web'));
      assert.ok(bannerContent.includes('#{linkedWebOrder.orderNumber} cargado'));
      assert.ok(bannerContent.includes('Desvincular'));
      assert.ok(modalContent.includes('useModalBackHandler(isOpen, onClose)'));
      assert.ok(modalContent.includes('Cargar al Formulario'));
      assert.ok(modalContent.includes('Actualizar'));
    });

    it('3.3 Header.jsx y App.jsx exponen la pestaña "Bandeja Web" (bandeja-web) con contador de pendientes y acciones completas', () => {
      assert.ok(headerContent.includes("id: 'bandeja-web', label: 'Bandeja Web', badge: pendingWebOrdersCount"));
      assert.ok(headerContent.includes('nav-badge-${tab.id}'));
      assert.ok(appContent.includes("const WebOrdersInboxView = lazy(() => import('./components/WebOrdersInboxView'));"));
      assert.ok(appContent.includes("activeTab === 'bandeja-web' && (isSuperAdmin || isVendedorRedes)"));
      assert.ok(appContent.includes("setPendingWebOrderImport(order);") && appContent.includes("setActiveTab('venta');"));

      assert.ok(inboxViewContent.includes("label: 'Pendientes'"));
      assert.ok(inboxViewContent.includes("label: 'Importados'"));
      assert.ok(inboxViewContent.includes("label: 'Descartados'"));
      assert.ok(inboxViewContent.includes('Importar a Venta'));
      assert.ok(inboxViewContent.includes('Descartar'));
      assert.ok(inboxViewContent.includes('Restaurar a Pendientes'));
    });
  });

  describe('4. Ergonomía Táctil (>= 44px), Paleta Sin Naranja, Techos de Líneas y 0 CRLF', () => {
    it('4.1 Todos los controles interactivos en Banner, Modal y Bandeja Web cumplen min-h-[44px] y cero tonos amber/orange', () => {
      for (const [name, content] of [
        ['WebOrderImportBanner.jsx', bannerContent],
        ['WebOrdersImportModal.jsx', modalContent],
        ['WebOrdersInboxView.jsx', inboxViewContent],
      ]) {
        const controls = extractOpeningTags(content);
        assert.ok(controls.length > 0, `${name} debe incluir controles interactivos`);
        for (const [idx, ctrl] of controls.entries()) {
          assert.ok(
            ctrl.tagContent.includes('min-h-[44px]') || ctrl.tagContent.includes('min-h-[48px]'),
            `Control <${ctrl.tagName}> #${idx + 1} en ${name} debe tener min-h-[44px]: ${ctrl.tagContent}`
          );
        }
        assert.ok(!/amber-|orange-/.test(content), `${name} no debe contener clases amber-* u orange-*`);
      }
      assert.ok(!/amber-|orange-/.test(headerContent), 'Header.jsx no debe contener clases amber-* u orange-*');
    });

    it('4.2 Todos los archivos requeridos cumplen sus techos estrictos de líneas y mantienen 0 CRLF', () => {
      const ceilings = [
        ['src/components/manual-sale/WebOrderImportBanner.jsx', 120],
        ['src/components/manual-sale/WebOrdersImportModal.jsx', 280],
        ['src/components/WebOrdersInboxView.jsx', 280],
        ['src/components/manual-sale/hooks/useWebOrderImport.js', 280],
        ['src/components/Header.jsx', 280],
        ['src/components/FastManualSaleForm.jsx', 350],
        ['src/components/manual-sale/hooks/useRemoteSaleForm.js', 350],
        ['src/App.jsx', 420],
      ];

      for (const [rel, maxLines] of ceilings) {
        const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        const lines = raw.split('\n').length;
        assert.ok(lines <= maxLines, `${rel} tiene ${lines} líneas (máximo permitido <= ${maxLines})`);
        assert.equal(raw.includes('\r\n'), false, `${rel} debe tener 0 CRLF`);
      }

      for (const rel of ['src/App.jsx', 'tests/sales/web-orders-import-ui.test.js']) {
        const raw = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        assert.equal(raw.includes('\r\n'), false, `${rel} debe tener 0 CRLF`);
      }
    });
  });
});
