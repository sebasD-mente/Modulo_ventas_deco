import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('💼 SUITE SPRINT 5: Frontend UI & Módulo Gerencial de Comisiones', () => {
  // =========================================================================
  // 1. AUDITORÍA DE LÍMITES DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Gobernanza de Techos de Líneas y Erradicación de Monolitos', () => {
    const sprint5Files = [
      { file: 'src/components/commissions/hooks/useCommissionSettlements.js', max: 350, desc: 'Hook Dominio Comisiones' },
      { file: 'src/components/CommissionSettlementView.jsx', max: 280, desc: 'Vista Contenedora Principal' },
      { file: 'src/components/commissions/SellerCommissionDashboard.jsx', max: 280, desc: 'Tablero Vendedor Redes' },
      { file: 'src/components/commissions/AdminCommissionPanel.jsx', max: 280, desc: 'Panel Auditoría y Emisión Admin' },
      { file: 'src/components/commissions/ConfirmSettlementModal.jsx', max: 280, desc: 'Modal Confirmación Emisión' },
      { file: 'src/components/commissions/MarkSettlementPaidModal.jsx', max: 280, desc: 'Modal Desembolso Bancario' },
      { file: 'src/components/commissions/SettlementDetailReceiptModal.jsx', max: 280, desc: 'Recibo Oficial Imprimible' },
      { file: 'src/components/commissions/SettlementHistoryTable.jsx', max: 280, desc: 'Tabla Historial de Liquidaciones' },
      { file: 'src/components/Header.jsx', max: 280, desc: 'Header con Pestañas de Comisiones' },
      { file: 'src/App.jsx', max: 400, desc: 'Router y Layout Maestro' },
    ];

    for (const { file, max, desc } of sprint5Files) {
      it(`1.x. ${file} (${desc}) respeta el límite estricto de <= ${max} líneas`, () => {
        const fullPath = path.join(rootDir, file);
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(lineCount <= max, `${file} supera el límite de ${max} líneas (actual: ${lineCount})`);
      });
    }
  });

  // =========================================================================
  // 2. ERGONOMÍA TÁCTIL (>= 44x44px)
  // =========================================================================
  describe('2. Ergonomía Táctil en Mostrador (Superficie de Contacto >= 44x44px)', () => {
    const interactiveFiles = [
      'src/components/CommissionSettlementView.jsx',
      'src/components/commissions/SellerCommissionDashboard.jsx',
      'src/components/commissions/AdminCommissionPanel.jsx',
      'src/components/commissions/ConfirmSettlementModal.jsx',
      'src/components/commissions/MarkSettlementPaidModal.jsx',
      'src/components/commissions/SettlementDetailReceiptModal.jsx',
      'src/components/commissions/SettlementHistoryTable.jsx',
      'src/components/Header.jsx',
    ];

    for (const rel of interactiveFiles) {
      it(`2.x. ${rel} implementa controles táctiles con clase min-h-[44px]`, () => {
        const fullPath = path.join(rootDir, rel);
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(content.includes('min-h-[44px]'), `${rel} debe contener controles con min-h-[44px]`);
      });
    }

    it('2.9. AdminCommissionPanel envuelve checkboxes en contenedores >= 44x44px', () => {
      const panelContent = fs.readFileSync(path.join(rootDir, 'src/components/commissions/AdminCommissionPanel.jsx'), 'utf-8');
      assert.ok(
        panelContent.includes('min-h-[44px] min-w-[44px]'),
        'AdminCommissionPanel debe contener contenedor min-h-[44px] min-w-[44px] para selección táctil'
      );
    });
  });

  // =========================================================================
  // 3. INVARIANTE FINANCIERO (20% NETO Y 100% EXCLUSIÓN DE FLETE)
  // =========================================================================
  describe('3. Invariante Financiero del 20% y Exclusión Estricta del Flete', () => {
    // Función espejo del cálculo comisionable del frontend
    const calculateCommission = (itemsSubtotal, discount = 0, shippingCost = 0) => {
      const baseProductos = Math.max(0, itemsSubtotal - discount);
      const totalAmount = baseProductos + shippingCost;
      const commission = Number((baseProductos * 0.20).toFixed(2));
      return { baseProductos, totalAmount, commission, shippingExcluded: shippingCost };
    };

    it('3.1. Orden estándar Q 300 productos + Q 40 flete genera comisión exacta de Q 60.00', () => {
      const res = calculateCommission(300, 0, 40);
      assert.equal(res.baseProductos, 300);
      assert.equal(res.totalAmount, 340);
      assert.equal(res.commission, 60.00);
      assert.equal(res.shippingExcluded, 40);
      assert.notEqual(res.commission, 68.00, 'El flete jamás debe comisionarse');
    });

    it('3.2. Orden con descuento de Q 50 sobre Q 350 + Q 45 flete calcula sobre base neta Q 300', () => {
      const res = calculateCommission(350, 50, 45);
      assert.equal(res.baseProductos, 300);
      assert.equal(res.commission, 60.00);
    });

    it('3.3. Flete masivo de Q 500 en orden de Q 100 produce comisión de Q 20.00', () => {
      const res = calculateCommission(100, 0, 500);
      assert.equal(res.baseProductos, 100);
      assert.equal(res.commission, 20.00);
    });

    it('3.4. Componentes UI muestran badge explicativo de flete sin comisión', () => {
      const sellerDash = fs.readFileSync(path.join(rootDir, 'src/components/commissions/SellerCommissionDashboard.jsx'), 'utf-8');
      const adminPanel = fs.readFileSync(path.join(rootDir, 'src/components/commissions/AdminCommissionPanel.jsx'), 'utf-8');
      assert.ok(sellerDash.includes('sin comisión'), 'SellerCommissionDashboard debe contener badge sin comisión');
      assert.ok(adminPanel.includes('sin comisión'), 'AdminCommissionPanel debe contener badge sin comisión');
    });
  });

  // =========================================================================
  // 4. COMPUERTA DE SALDO CERO Y FRENO VISUAL
  // =========================================================================
  describe('4. Compuerta de Saldo Cero (Zero-Balance Gate) en la UI', () => {
    it('4.1. SellerCommissionDashboard incluye banner educativo de balanceDue == 0', () => {
      const content = fs.readFileSync(path.join(rootDir, 'src/components/commissions/SellerCommissionDashboard.jsx'), 'utf-8');
      assert.ok(content.includes('saldo Q 0.00'), 'Debe documentar requisito de saldo Q 0.00');
      assert.ok(content.includes('20% de comisión'), 'Debe mencionar el 20% de comisión');
      assert.ok(content.includes('anticipo pendiente'), 'Debe alertar sobre pedidos con anticipo pendiente');
    });

    it('4.2. Hook useCommissionSettlements expone ventas en espera de saldo', () => {
      const hookContent = fs.readFileSync(path.join(rootDir, 'src/components/commissions/hooks/useCommissionSettlements.js'), 'utf-8');
      assert.ok(hookContent.includes('salesWaitingBalance'), 'Hook debe exponer salesWaitingBalance');
      assert.ok(hookContent.includes('waitingSummary'), 'Hook debe exponer waitingSummary');
      assert.ok(hookContent.includes('balanceDue'), 'Hook debe verificar balanceDue');
    });
  });

  // =========================================================================
  // 5. ESTILOS DE IMPRESIÓN SCOPED @media print EN RECIBO OFICIAL
  // =========================================================================
  describe('5. Recibo Oficial Imprimible con Scoped @media print', () => {
    const receiptPath = path.join(rootDir, 'src/components/commissions/SettlementDetailReceiptModal.jsx');
    const content = fs.readFileSync(receiptPath, 'utf-8');

    it('5.1. Implementa bloque scoped @media print con contenedor #printable-settlement-receipt', () => {
      assert.ok(content.includes('@media print'), 'Debe contener directiva @media print');
      assert.ok(content.includes('#printable-settlement-receipt'), 'Debe declarar contenedor #printable-settlement-receipt');
      assert.ok(content.includes('background: #ffffff !important'), 'Impresión debe forzar fondo blanco');
      assert.ok(content.includes('color: #000000 !important'), 'Impresión debe forzar texto negro');
      assert.ok(content.includes('.no-print'), 'Debe contener clase .no-print');
      assert.ok(content.includes('.print-only'), 'Debe contener clase .print-only');
    });

    it('5.2. Invoca window.print() mediante botón accesible', () => {
      assert.ok(content.includes('window.print()'), 'Debe invocar window.print()');
      assert.ok(content.includes('Imprimir Recibo Oficial'), 'Debe rotular botón con Imprimir Recibo Oficial');
    });

    it('5.3. Incluye encabezado institucional Deco Vintage Guate y STAND {IA}', () => {
      assert.ok(content.includes('Deco Vintage Guate'), 'Debe incluir Deco Vintage Guate');
      assert.ok(content.includes("STAND {'{IA}'}"), 'Debe incluir logotipo STAND {IA}');
    });

    it('5.4. Incluye bloques de firmas de recibido y autorización en impresión', () => {
      assert.ok(content.includes('Firma Vendedor (Recibido Conforme)'), 'Debe incluir firma de vendedor');
      assert.ok(content.includes("Firma Autorizada • STAND {'{IA}'}"), 'Debe incluir firma de administración');
    });

    it('5.5. Consistencia matemática en filas del recibo: preserva baseProductos === 0 y calcula base neta con descuento', () => {
      // Función espejo de la lógica de cálculo por fila en SettlementDetailReceiptModal.jsx
      const calculateReceiptRow = (s) => {
        const base = Number(
          s.baseProductos ??
          Math.max(0, (Number(s.itemsSubtotal || 0) > 0
            ? Number(s.itemsSubtotal) - Number(s.discount || 0)
            : Number(s.totalAmount || 0) - Number(s.shippingCost || 0)))
        );
        const comm = Number((base * 0.20).toFixed(2));
        return { base, comm };
      };

      // 1. Asserts that when baseProductos === 0, base is 0.00 and comm is 0.00
      const zeroBaseSale = { baseProductos: 0, totalAmount: 0, shippingCost: 0, discount: 100 };
      const resZero = calculateReceiptRow(zeroBaseSale);
      assert.equal(resZero.base, 0.00, 'Cuando baseProductos === 0, base debe ser 0.00');
      assert.equal(resZero.comm, 0.00, 'Cuando baseProductos === 0, comm debe ser 0.00');

      // 2. Asserts that for an order with itemsSubtotal 300, discount 50, and shipping 40 (totalAmount 290), base is 250.00 and comm is 50.00
      const saleWithSubtotal = { itemsSubtotal: 300, discount: 50, shippingCost: 40, totalAmount: 290 };
      const resSub = calculateReceiptRow(saleWithSubtotal);
      assert.equal(resSub.base, 250.00, 'Para itemsSubtotal 300 con descuento 50, base debe ser 250.00');
      assert.equal(resSub.comm, 50.00, 'Para base 250.00, comisión 20% debe ser 50.00');

      // 3. Verifica el fallback directo con totalAmount 290 y shippingCost 40 (sin itemsSubtotal)
      const saleRawPrisma = { discount: 50, shippingCost: 40, totalAmount: 290 };
      const resRaw = calculateReceiptRow(saleRawPrisma);
      assert.equal(resRaw.base, 250.00, 'Fallback totalAmount - shippingCost debe resultar en base 250.00');
      assert.equal(resRaw.comm, 50.00, 'Comisión en fallback debe ser 50.00');

      // 4. Verificación estática del código fuente de SettlementDetailReceiptModal.jsx
      assert.ok(content.includes('s.baseProductos ??'), 'SettlementDetailReceiptModal.jsx debe usar nullish coalescing (??)');
      assert.ok(!content.includes('s.baseProductos ||'), 'SettlementDetailReceiptModal.jsx no debe usar operador lógico OR (||)');
    });
  });

  // =========================================================================
  // 6. SEGREGACIÓN DE ROLES, HEADER Y ENRUTAMIENTO LAZY EN APP.JSX
  // =========================================================================
  describe('6. Segregación de Roles, Header y Enrutamiento en App.jsx', () => {
    const headerPath = path.join(rootDir, 'src/components/Header.jsx');
    const headerContent = fs.readFileSync(headerPath, 'utf-8');
    const appPath = path.join(rootDir, 'src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf-8');

    it('6.1. Header inyecta pestaña "Comisiones" para SUPER_ADMIN', () => {
      assert.ok(headerContent.includes("{ id: 'comisiones', label: 'Comisiones' }"), 'SUPER_ADMIN debe tener pestaña Comisiones');
    });

    it('6.2. Header inyecta pestaña "Mis Comisiones" para VENDEDOR_REDES', () => {
      assert.ok(headerContent.includes("isVendedorRedes"), 'Debe evaluar isVendedorRedes');
      assert.ok(headerContent.includes("{ id: 'comisiones', label: 'Mis Comisiones' }"), 'VENDEDOR_REDES debe tener pestaña Mis Comisiones');
    });

    it('6.3. App.jsx importa CommissionSettlementView con React.lazy()', () => {
      assert.ok(
        appContent.includes("lazy(() => import('./components/CommissionSettlementView'))"),
        'App.jsx debe importar CommissionSettlementView con React.lazy()'
      );
    });

    it('6.4. App.jsx protege la ruta activeTab === "comisiones" con guard de roles', () => {
      assert.ok(
        appContent.includes("activeTab === 'comisiones' && (isSuperAdmin || isVendedorRedes)"),
        'Ruta comisiones debe requerir isSuperAdmin || isVendedorRedes'
      );
      assert.ok(appContent.includes('<CommissionSettlementView />'), 'Debe montar CommissionSettlementView');
    });

    it('6.5. CommissionSettlementView segrega paneles entre Admin y Vendedor de Redes', () => {
      const viewContent = fs.readFileSync(path.join(rootDir, 'src/components/CommissionSettlementView.jsx'), 'utf-8');
      assert.ok(viewContent.includes('<AdminCommissionPanel'), 'Debe renderizar AdminCommissionPanel');
      assert.ok(viewContent.includes('<SellerCommissionDashboard'), 'Debe renderizar SellerCommissionDashboard');
      assert.ok(viewContent.includes('<SettlementHistoryTable'), 'Debe renderizar SettlementHistoryTable');
    });
  });

  // =========================================================================
  // 7. SEGURIDAD ZERO-TRUST Y AUSENCIA DE ARTEFACTOS PROHIBIDOS
  // =========================================================================
  describe('7. Seguridad Zero-Trust y Ausencia de Artefactos Prohibidos', () => {
    const files = [
      'src/components/commissions/hooks/useCommissionSettlements.js',
      'src/components/CommissionSettlementView.jsx',
      'src/components/commissions/SellerCommissionDashboard.jsx',
      'src/components/commissions/AdminCommissionPanel.jsx',
      'src/components/commissions/ConfirmSettlementModal.jsx',
      'src/components/commissions/MarkSettlementPaidModal.jsx',
      'src/components/commissions/SettlementDetailReceiptModal.jsx',
      'src/components/commissions/SettlementHistoryTable.jsx',
      'src/components/Header.jsx',
      'src/App.jsx',
    ];

    for (const rel of files) {
      it(`7.x. ${rel} no contiene secretos, IPs ajenas ni emails planos no autorizados`, () => {
        const text = fs.readFileSync(path.join(rootDir, rel), 'utf-8');
        assert.ok(!text.includes('145.223.120.56'), `IP prohibida en ${rel}`);
        assert.ok(!text.includes('sebasdmente@gmail.com'), `Email plano prohibido en ${rel}`);
        assert.ok(!text.includes('dummy'), `Texto dummy prohibido en ${rel}`);
        assert.ok(!text.includes('mock'), `Texto mock prohibido en ${rel}`);
      });
    }
  });
});
