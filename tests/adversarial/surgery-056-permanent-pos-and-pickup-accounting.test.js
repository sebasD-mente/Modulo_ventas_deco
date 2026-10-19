import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

// Set dummy envs so server modules can be imported safely
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

import {
  constructDraftPayload,
  executeSearchCatalog,
  isItemOutsideBusinessDomain,
  NON_CATALOG_MERCH_REGEX,
} from '../../server/services/ai/aiToolsService.js';
import { processVoiceSaleAudio } from '../../server/services/ai/aiMediaService.js';

describe('⚔️ CIRUGÍA [DEKO-STANDIA-056-v3.0]: Punto de Venta Digital Permanente, Logística Multi-Rol y Aislamiento Contable', () => {

  // ==========================================================================
  // BLOQUE 1: Pilar 1 y 2 - Punto de Venta Digital Permanente (24/7) y Segregación de Selectores
  // ==========================================================================
  describe('1. Pilar 1 & 2: Segregación Estricta de Stands Feriales y POS Digital Permanente', () => {

    it('1.1. Header.jsx: El badge permanente de Redes/Online solo se renderiza para VENDEDOR_REDES', () => {
      const headerContent = fs.readFileSync(path.join(ROOT, 'src/components/Header.jsx'), 'utf-8');
      assert.ok(headerContent.includes('header-online-pos-badge'), 'Debe existir el data-testid del badge online');
      assert.ok(headerContent.includes('isVendedorRedes'), 'El badge debe estar condicionado a isVendedorRedes');
      assert.ok(headerContent.includes('📱 Redes / Online'), 'Debe mostrar el texto identificador 📱 Redes / Online');
    });

    it('1.2. App.jsx: Excluye evt-ventas-redes-online de la lista de stands feriales del selector', () => {
      const appContent = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
      assert.ok(appContent.includes("id !== 'evt-ventas-redes-online'"), 'App.jsx debe filtrar el evento digital de activeEventsList');
    });

    it('1.3. useEventsManager.js y EventsManagementView.jsx: Separan el POS Digital en tarjeta permanente 24/7 sin controles destructivos', () => {
      const hookContent = fs.readFileSync(path.join(ROOT, 'src/components/events/hooks/useEventsManager.js'), 'utf-8');
      assert.ok(hookContent.includes("id === 'evt-ventas-redes-online'"), 'El hook debe aislar digitalPos');
      assert.ok(hookContent.includes("id !== 'evt-ventas-redes-online'"), 'El hook debe excluir digitalPos de eventos feriales');

      const viewContent = fs.readFileSync(path.join(ROOT, 'src/components/EventsManagementView.jsx'), 'utf-8');
      assert.ok(viewContent.includes('permanent-digital-pos-card'), 'Debe existir la tarjeta permanente con testid');
      assert.ok(viewContent.includes('Punto de Venta Permanente (Activo 24/7)'), 'Debe tener título de POS permanente');
    });

    it('1.4. eventController.js: Oculta evt-ventas-redes-online en getEventsList para roles feriales y operarios', () => {
      const eventCtrlContent = fs.readFileSync(path.join(ROOT, 'server/controllers/eventController.js'), 'utf-8');
      assert.ok(eventCtrlContent.includes("not: 'evt-ventas-redes-online'"), 'Debe aplicar filtro NOT al evento de redes');
      assert.ok(eventCtrlContent.includes('isVendedorRedes'), 'Debe discernir isVendedorRedes');
    });

    it('1.5. useRemoteSaleForm.js: Forzar eventId a evt-ventas-redes-online y aislar pickupEventId', () => {
      const remoteFormContent = fs.readFileSync(path.join(ROOT, 'src/components/manual-sale/hooks/useRemoteSaleForm.js'), 'utf-8');
      assert.ok(remoteFormContent.includes("eventId: 'evt-ventas-redes-online'"), 'Toda venta remota debe nacer en evt-ventas-redes-online');
      assert.ok(remoteFormContent.includes("e.id !== 'evt-ventas-redes-online'"), 'Los eventos de retiro físico deben excluir el evento digital');
    });
  });

  // ==========================================================================
  // BLOQUE 2: Pilar 3 - Seguimiento de Pedidos Abierto a los 5 Roles
  // ==========================================================================
  describe('2. Pilar 3: Logística de Pedidos Abierta a los 5 Roles de la Organización', () => {

    it('2.1. apiRoutes.js: Permite a los 5 roles consultar tracking, registrar entrega, cobro de saldo y subir arte', () => {
      const routesContent = fs.readFileSync(path.join(ROOT, 'server/routes/apiRoutes.js'), 'utf-8');
      const expectedRoles = "['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES', 'OPERARIO_1', 'OPERARIO_2']";
      
      assert.ok(routesContent.includes('/sales/orders/tracking') && routesContent.includes(expectedRoles), 'Tracking debe autorizar a los 5 roles');
      assert.ok(routesContent.includes('/sales/:id/delivery') && routesContent.includes(expectedRoles), 'Delivery debe autorizar a los 5 roles');
      assert.ok(routesContent.includes('/sales/:id/balance-payment') && routesContent.includes(expectedRoles), 'Cobro de saldo debe autorizar a los 5 roles');
      assert.ok(routesContent.includes('/sales/upload-art') && routesContent.includes(expectedRoles), 'Subida de comprobante debe autorizar a los 5 roles');
    });

    it('2.2. Header.jsx y App.jsx: Pestaña Seguimiento visible para los 5 roles', () => {
      const headerContent = fs.readFileSync(path.join(ROOT, 'src/components/Header.jsx'), 'utf-8');
      assert.ok(headerContent.includes("id: 'seguimiento'"), 'Pestaña seguimiento debe estar en navTabs');
      
      const appContent = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
      assert.ok(appContent.includes("activeTab === 'seguimiento'"), 'App.jsx debe renderizar OrderTrackingView en tab seguimiento');
      assert.ok(appContent.includes('<OrderTrackingView'), 'Debe instanciar OrderTrackingView');
    });
  });

  // ==========================================================================
  // BLOQUE 3: Pilar 4 - Trazabilidad Forense de Saldo, Entrega y Recibo
  // ==========================================================================
  describe('3. Pilar 4: Trazabilidad Forense de Quién Cobró y Quién Entregó con Comprobante', () => {

    it('3.1. remoteSaleService.js: Estampa en sale.notes y AuditLog el nombre y rol de quien cobró el saldo', () => {
      const remoteServiceContent = fs.readFileSync(path.join(ROOT, 'server/services/sales/remoteSaleService.js'), 'utf-8');
      assert.ok(remoteServiceContent.includes('[Saldo Q'), 'Debe incluir formato de nota [Saldo Q...');
      assert.ok(remoteServiceContent.includes('cobrado por:'), 'Debe estampar cobrado por:');
      assert.ok(remoteServiceContent.includes('collectorName'), 'Debe capturar el nombre del cobrador');
      assert.ok(remoteServiceContent.includes('collectorRole'), 'Debe capturar el rol del cobrador');
      assert.ok(remoteServiceContent.includes('SALDO_VENTA_COBRADO'), 'Debe auditar la acción SALDO_VENTA_COBRADO');
    });

    it('3.2. saleController.js: updateOrderDelivery registra entrega, transportadora, nota y comprobante', () => {
      const saleCtrlContent = fs.readFileSync(path.join(ROOT, 'server/controllers/saleController.js'), 'utf-8');
      assert.ok(saleCtrlContent.includes('updateOrderDelivery'), 'Debe existir la función updateOrderDelivery');
      assert.ok(saleCtrlContent.includes('deliveryReceiptUrl'), 'Debe soportar deliveryReceiptUrl');
      assert.ok(saleCtrlContent.includes('PEDIDO_ENTREGADO'), 'Debe auditar la acción PEDIDO_ENTREGADO en AuditLog');
    });

    it('3.3. OrderDeliveryModal.jsx: Contiene opciones de entrega en taller, en stand y subida de foto de recibo', () => {
      const modalContent = fs.readFileSync(path.join(ROOT, 'src/components/orders/OrderDeliveryModal.jsx'), 'utf-8');
      assert.ok(modalContent.includes('Entrega en Taller'), 'Debe ofrecer Entrega en Taller');
      assert.ok(modalContent.includes('Entrega en Stand'), 'Debe ofrecer Entrega en Stand');
      assert.ok(modalContent.includes('/api/sales/upload-art'), 'Debe permitir subir foto a /api/sales/upload-art');
      assert.ok(modalContent.includes('deliveryReceiptUrl'), 'Debe enviar deliveryReceiptUrl');
    });
  });

  // ==========================================================================
  // BLOQUE 4: Pilar 5 - Aislamiento Contable Exacto de Retiros en Stand (pickupEventId)
  // ==========================================================================
  describe('4. Pilar 5: Aislamiento Contable de Retiros en Stand Ferial', () => {

    it('4.1. saleKpiService.js: getEventKPIs no suma anticipo de redes a la caja del stand mientras haya saldo pendiente', () => {
      const kpiServiceContent = fs.readFileSync(path.join(ROOT, 'server/services/sales/saleKpiService.js'), 'utf-8');
      assert.ok(kpiServiceContent.includes("pickupEventId: eventId"), 'Debe contemplar pickupEventId en filtros de pagos');
      assert.ok(kpiServiceContent.includes("contains: '[SALDO]'"), 'Los pagos de órdenes foráneas deben sellarse estrictamente con [SALDO]');
    });

    it('4.2. saleKpiService.js: getEventSalesList incluye en stand pedidos con pickupEventId y balanceDue > 0', () => {
      const kpiServiceContent = fs.readFileSync(path.join(ROOT, 'server/services/sales/saleKpiService.js'), 'utf-8');
      assert.ok(kpiServiceContent.includes("pickupEventId: eventId, balanceDue: { gt: 0 }"), 'Debe traer pedidos con saldo para pestaña Con Saldo');
    });

    it('4.3. authMiddleware.js: requireEventAccess autoriza acceso al vendedor del stand si sale.pickupEventId coincide', () => {
      const authMiddlewareContent = fs.readFileSync(path.join(ROOT, 'server/middleware/authMiddleware.js'), 'utf-8');
      assert.ok(authMiddlewareContent.includes('sale.pickupEventId === req.user.assignedEventId'), 'Debe validar pickupEventId');
    });
  });

  // ==========================================================================
  // BLOQUE 5: Hallazgos H1 a H5 de Valkyria
  // ==========================================================================
  describe('5. Hallazgos H1 a H5 de Valkyria', () => {

    it('5.1. H1: NON_CATALOG_MERCH_REGEX detecta mercancía ajena al giro', () => {
      assert.strictEqual(isItemOutsideBusinessDomain('playera de Batman'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('taza de Spiderman'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('gorra de Star Wars'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('llavero de Taylor Swift'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('funko pop de Goku'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('comida para llevar'), true);
      assert.strictEqual(isItemOutsideBusinessDomain('camisa de lino'), true);
      
      // Artículos válidos del catálogo no deben disparar
      assert.strictEqual(isItemOutsideBusinessDomain('póster de Batman mediano'), false);
      assert.strictEqual(isItemOutsideBusinessDomain('cuadro de Spiderman grande'), false);
      assert.strictEqual(isItemOutsideBusinessDomain('portada de Taylor Swift 30x30'), false);
      assert.strictEqual(isItemOutsideBusinessDomain('Pink Floyd The Wall'), false);
    });

    it('5.2. H1: constructDraftPayload segrega ítems ajenos a unmatchedItems y produce total 0 e items vacíos', async () => {
      const payload = {
        items: [
          { productName: 'playera de Batman', quantity: 1 },
          { productName: 'taza de Spiderman', quantity: 2 }
        ],
        notes: 'Cliente pide ropa y taza'
      };

      const result = await constructDraftPayload('tenant-test', payload, 'playera de Batman y taza de Spiderman');
      assert.strictEqual(result.items.length, 0, 'No debe montar ítems en el borrador');
      assert.strictEqual(result.total, 0, 'Total debe ser 0.00');
      assert.strictEqual(result.unmatchedItems.length, 2, 'Debe segregar ambos ítems a unmatchedItems');
      assert.strictEqual(result.unmatchedItems[0].outOfDomain, true, 'Debe marcar outOfDomain: true');
      assert.ok(result.unmatchedItems[0].unavailableReason.includes('exclusivamente en pósters'), 'Debe explicar la especialización del catálogo');
    });

    it('5.3. H1: executeSearchCatalog retorna lista vacía si la búsqueda es de mercancía fuera del catálogo', async () => {
      const matches = await executeSearchCatalog('tenant-test', 'playera de anime');
      assert.deepStrictEqual(matches, [], 'Búsqueda de playera debe retornar [] inmediatamente');
    });

    it('5.4. H2: App.jsx refreshMetrics resuelve sale.eventId sin confundirlo con sale.id', () => {
      const appContent = fs.readFileSync(path.join(ROOT, 'src/App.jsx'), 'utf-8');
      assert.ok(appContent.includes('override.eventId || (override.location !== undefined ? override.id : activeEvent?.id)'), 'Debe resolver eventId correctamente');
    });

    it('5.5. H3: SaleCartList.jsx cuenta con botones táctiles de medida >= 44x44px', () => {
      const cartContent = fs.readFileSync(path.join(ROOT, 'src/components/manual-sale/SaleCartList.jsx'), 'utf-8');
      assert.ok(cartContent.includes('min-h-[44px] min-w-[44px]'), 'Botones de tamaño deben medir al menos 44x44px');
    });

    it('5.6. H4: aiMediaService responde pidiendo precisar el álbum musical ante dictados genéricos de portada', async () => {
      const mockAudio = Buffer.from('mock-audio-data');
      const fakeClient = {
        models: {
          generateContent: async () => ({
            text: JSON.stringify({
              transcription: 'portada de álbum de a 55 en efectivo',
              isSaleDetected: false,
              intent: 'CONSULTA_CATALOGO',
              items: []
            })
          })
        }
      };

      const res = await processVoiceSaleAudio({
        audioBuffer: mockAudio,
        mimeType: 'audio/webm',
        tenantId: 'tenant-voice-test',
        geminiClient: fakeClient
      });

      assert.strictEqual(res.isSaleDetected, false, 'No debe disparar venta inmediata para portada genérica');
      assert.strictEqual(res.intent, 'CONSULTA_CATALOGO', 'Debe clasificar como consulta de catálogo');
      assert.ok(res.message.includes('portadas de álbum musicales en formato 30×30 cm a Q55.00'), 'Debe indicar catálogo musical disponible');
    });

    it('5.7. H5: RecentSaleRow.jsx sanitiza descripciones y previene el texto literal "undefined"', () => {
      const rowContent = fs.readFileSync(path.join(ROOT, 'src/components/sales/RecentSaleRow.jsx'), 'utf-8');
      assert.ok(rowContent.includes("replace(/\\bundefined\\b/gi, '')"), 'Debe limpiar la palabra undefined');
      assert.ok(rowContent.includes("rawDesc = it.description || it.product?.name || 'Póster'"), 'Debe tener fallback robusto');
    });
  });

});
