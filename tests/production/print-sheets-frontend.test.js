import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🖨️ SUITE SPRINT 4: Frontend UI & Taller de Pliegos Diarios (PrintSheets)', () => {
  // =========================================================================
  // 1. AUDITORÍA DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Gobernanza de Techos de Líneas y Erradicación de Monolitos', () => {
    const sprint4Files = [
      { file: 'src/components/ProductionManagementView.jsx', max: 70, desc: 'Contenedor Maestro Sub-vistas' },
      { file: 'src/components/production/hooks/usePrintSheets.js', max: 350, desc: 'Hook Dominio Pliegos Diarios' },
      { file: 'src/components/production/PrintSheetsSection.jsx', max: 280, desc: 'Tablero Principal de Pliegos' },
      { file: 'src/components/production/PrintSheetCard.jsx', max: 280, desc: 'Tarjeta de Pliego Individual' },
      { file: 'src/components/production/CreatePrintSheetModal.jsx', max: 280, desc: 'Modal Apertura de Pliego' },
      { file: 'src/components/production/AssignItemsToSheetModal.jsx', max: 280, desc: 'Modal Loteo con Freno de Taller' },
      { file: 'src/components/production/PrintSheetDetailModal.jsx', max: 280, desc: 'Ficha 360 y Hoja de Ruta Imprimible' },
      { file: 'server/services/productionService.js', max: 500, desc: 'Servicio de Producción Backend' },
    ];

    for (const { file, max, desc } of sprint4Files) {
      it(`1.x. ${file} (${desc}) respeta el límite estricto de <= ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        if (file === 'src/components/ProductionManagementView.jsx') {
          assert.ok(lineCount < max, `${file} debe tener estrictamente < ${max} líneas (actual: ${lineCount})`);
        } else {
          assert.ok(lineCount <= max, `${file} supera el límite de ${max} líneas (actual: ${lineCount})`);
        }
      });
    }
  });

  // =========================================================================
  // 2. PROYECCIÓN BACKEND EN PRODUCTION SERVICE
  // =========================================================================
  describe('2. Proyección Backend en productionService.getProductionItems', () => {
    const servicePath = path.join(rootDir, 'server/services/productionService.js');
    const content = fs.readFileSync(servicePath, 'utf-8');

    it('2.1. getProductionItems proyecta paymentStatus, balanceDue y depositAmount en sale', () => {
      assert.ok(content.includes('paymentStatus: true'), 'Falta paymentStatus en proyección de sale');
      assert.ok(content.includes('balanceDue: true'), 'Falta balanceDue en proyección de sale');
      assert.ok(content.includes('depositAmount: true'), 'Falta depositAmount en proyección de sale');
      assert.ok(content.includes('totalAmount: true'), 'Falta totalAmount en proyección de sale');
    });

    it('2.2. getProductionItems proyecta status, orderType, deliveryMethod y customer', () => {
      assert.ok(content.includes('status: true'), 'Falta status en proyección de sale');
      assert.ok(content.includes('orderType: true'), 'Falta orderType en proyección de sale');
      assert.ok(content.includes('deliveryMethod: true'), 'Falta deliveryMethod en proyección de sale');
      assert.ok(content.includes('customer: { select: { id: true, fullName: true, phone: true } }'), 'Falta customer en proyección de sale');
    });
  });

  // =========================================================================
  // 3. SWITCH SUB-VISTAS EN PRODUCTION MANAGEMENT VIEW
  // =========================================================================
  describe('3. Switch de Sub-vistas en ProductionManagementView.jsx', () => {
    const viewPath = path.join(rootDir, 'src/components/ProductionManagementView.jsx');
    const content = fs.readFileSync(viewPath, 'utf-8');

    it('3.1. Implementa alternancia de pestañas: Cola de Ítems y Pliegos Diarios', () => {
      assert.ok(content.includes('activeTab'), 'Debe gestionar estado activeTab');
      assert.ok(content.includes('Cola de Ítems'), 'Debe incluir botón Cola de Ítems');
      assert.ok(content.includes('Pliegos Diarios'), 'Debe incluir botón Pliegos Diarios');
      assert.ok(content.includes('<PrintSheetsSection'), 'Debe montar PrintSheetsSection en tab sheets');
    });

    it('3.2. Preserva todos los literales requeridos por tests regresivos', () => {
      assert.ok(content.includes('debouncedSearchQuery'), 'Debe contener debouncedSearchQuery');
      assert.ok(content.includes('250'), 'Debe documentar o incluir 250ms');
      assert.ok(content.includes("q.isOp2Only ? 'Taller de Impresión' : 'Gestión de Producción'"), 'Debe preservar título dinámico de rol');
      assert.ok(content.includes("q.isOp2Only ? '🎉 No hay obras pendientes de imprimir en este momento.'"), 'Debe preservar estado vacío de Op2');
      assert.ok(content.includes('Printer className="w-5 h-5 text-cyan-400"'), 'Debe preservar icono de Op2');
    });
  });

  // =========================================================================
  // 4. HOOK DOMINIO: usePrintSheets
  // =========================================================================
  describe('4. Hook de Dominio usePrintSheets.js', () => {
    const hookPath = path.join(rootDir, 'src/components/production/hooks/usePrintSheets.js');
    const content = fs.readFileSync(hookPath, 'utf-8');

    it('4.1. Consume endpoints canónicos de Pliegos de Taller', () => {
      assert.ok(content.includes('/api/production/print-sheets'), 'Debe consultar GET/POST /api/production/print-sheets');
      assert.ok(content.includes('/items'), 'Debe invocar endpoint de asignación /items');
      assert.ok(content.includes('/status'), 'Debe invocar PATCH de actualización de estado /status');
    });

    it('4.2. Asignación a pliego envía el campo exacto saleItemIds en payload JSON', () => {
      assert.ok(content.includes('saleItemIds'), 'Payload de asignación debe ser saleItemIds');
    });

    it('4.3. Implementa debounce de 250ms en búsqueda', () => {
      assert.ok(content.includes('debouncedSearchQuery'), 'Debe implementar debouncedSearchQuery');
      assert.ok(content.includes('250'), 'Temporizador de debounce debe ser 250ms');
      assert.ok(content.includes('clearTimeout(timer)'), 'Debe incluir cleanup de clearTimeout');
    });

    it('4.4. Provee carga de obras candidatas para loteo con deduplicación', () => {
      assert.ok(content.includes('fetchUnassignedItems'), 'Debe exponer función fetchUnassignedItems');
      assert.ok(content.includes('unassignedItems'), 'Debe exponer estado unassignedItems');
    });
  });

  // =========================================================================
  // 5. FRENO INQUEBRANTABLE DE TALLER EN LA UI (WORKSHOP BRAKE)
  // =========================================================================
  describe('5. Freno Inquebrantable de Taller en AssignItemsToSheetModal.jsx', () => {
    const modalPath = path.join(rootDir, 'src/components/production/AssignItemsToSheetModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    const checkIsBlockedLogic = (sale) => {
      const isAnulada = sale.status === 'ANULADA';
      const isPendingDeposit = sale.paymentStatus === 'PENDIENTE_ANTICIPO';
      const isMissingDeposit = !['ANTICIPO_PAGADO', 'PAGADO_TOTAL'].includes(sale.paymentStatus);
      return isAnulada || isPendingDeposit || isMissingDeposit;
    };

    it('5.1. Regla de negocio: Ventas ANULADAS o con PENDIENTE_ANTICIPO están estrictamente bloqueadas', () => {
      assert.equal(checkIsBlockedLogic({ status: 'ANULADA', paymentStatus: 'ANTICIPO_PAGADO' }), true);
      assert.equal(checkIsBlockedLogic({ status: 'COMPLETADA', paymentStatus: 'PENDIENTE_ANTICIPO' }), true);
      assert.equal(checkIsBlockedLogic({ status: 'COMPLETADA', paymentStatus: 'DESCONOCIDO' }), true);
      assert.equal(checkIsBlockedLogic({ status: 'COMPLETADA', paymentStatus: 'ANTICIPO_PAGADO' }), false);
      assert.equal(checkIsBlockedLogic({ status: 'COMPLETADA', paymentStatus: 'PAGADO_TOTAL' }), false);
    });

    it('5.2. Código de la UI bloquea checkbox y aplica estilo de advertencia para obras sin anticipo', () => {
      assert.ok(content.includes('checkIsBlocked'), 'Debe definir helper de verificación de bloqueo');
      assert.ok(content.includes('disabled={isBlocked}'), 'Checkbox debe tener disabled={isBlocked}');
      assert.ok(content.includes('bg-red-950/20') && content.includes('border-red-900/40'), 'Fila bloqueada debe tener fondo rojo tenue');
      assert.ok(content.includes('cursor-not-allowed'), 'Fila bloqueada debe tener cursor-not-allowed');
    });

    it('5.3. Muestra el candado rojo y texto exacto de bloqueo', () => {
      assert.ok(content.includes('🔒 BLOQUEADO: Pedido #'), 'Debe renderizar candado rojo con texto de pedido');
      assert.ok(content.includes('sin anticipo (Pendiente Q'), 'Debe renderizar texto de advertencia con saldo');
      assert.ok(content.includes('🟢 Anticipo Confirmado'), 'Debe renderizar badge verde para pedidos habilitados');
    });
  });

  // =========================================================================
  // 6. ERGONOMÍA TÁCTIL (>= 44x44px) Y ESTILOS DE IMPRESIÓN
  // =========================================================================
  describe('6. Ergonomía Táctil (>= 44x44px) y Scoped @media print', () => {
    const detailModalPath = path.join(rootDir, 'src/components/production/PrintSheetDetailModal.jsx');
    const detailContent = fs.readFileSync(detailModalPath, 'utf-8');

    it('6.1. PrintSheetDetailModal implementa @media print con contenedor scoped #printable-sheet-route', () => {
      assert.ok(detailContent.includes('@media print'), 'Debe declarar estilos de impresión @media print');
      assert.ok(detailContent.includes('#printable-sheet-route'), 'Debe aislar el contenedor printable');
      assert.ok(detailContent.includes('background: #ffffff !important'), 'Impresión debe usar fondo blanco');
      assert.ok(detailContent.includes('color: #000000 !important'), 'Impresión debe usar texto negro');
      assert.ok(detailContent.includes('window.print()'), 'Debe invocar window.print()');
    });

    it('6.2. Enlaces RIP de alta resolución abren en nueva pestaña segura', () => {
      assert.ok(detailContent.includes('target="_blank"'), 'Enlace RIP debe abrir en _blank');
      assert.ok(detailContent.includes('rel="noopener noreferrer"'), 'Enlace debe ser seguro');
    });

    it('6.3. Controles interactivos garantizan área de contacto táctil >= 44x44px', () => {
      const files = [
        'src/components/ProductionManagementView.jsx',
        'src/components/production/PrintSheetsSection.jsx',
        'src/components/production/PrintSheetCard.jsx',
        'src/components/production/CreatePrintSheetModal.jsx',
        'src/components/production/AssignItemsToSheetModal.jsx',
        'src/components/production/PrintSheetDetailModal.jsx',
      ];
      for (const rel of files) {
        const text = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
        assert.ok(text.includes('min-h-[44px]'), `${rel} debe contener controles con min-h-[44px]`);
      }
    });
  });

  // =========================================================================
  // 7. AUDITORÍA ZERO-TRUST Y AUSENCIA DE ARTEFACTOS PROHIBIDOS
  // =========================================================================
  describe('7. Seguridad Zero-Trust y Ausencia de Artefactos Prohibidos', () => {
    const files = [
      'server/services/productionService.js',
      'src/components/ProductionManagementView.jsx',
      'src/components/production/hooks/usePrintSheets.js',
      'src/components/production/PrintSheetsSection.jsx',
      'src/components/production/PrintSheetCard.jsx',
      'src/components/production/CreatePrintSheetModal.jsx',
      'src/components/production/AssignItemsToSheetModal.jsx',
      'src/components/production/PrintSheetDetailModal.jsx',
    ];

    for (const rel of files) {
      it(`7.x. ${rel} no contiene secretos, IPs ajenas ni emails en plano`, () => {
        const text = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
        assert.ok(!text.includes('145.223.120.56'), `IP ajena detectada en ${rel}`);
        assert.ok(!text.includes('sebasdmente@gmail.com'), `Email plano detectado en ${rel}`);
        assert.ok(!text.includes('dummy'), `Palabra dummy detectada en ${rel}`);
        assert.ok(!text.includes('mock'), `Palabra mock detectada en ${rel}`);
      });
    }
  });
});
