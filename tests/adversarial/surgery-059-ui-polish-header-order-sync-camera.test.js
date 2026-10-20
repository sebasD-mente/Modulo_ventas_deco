import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ SURGERY-059: UI POLISH, HEADER MINIMALISM, REDES ORDER, SYNC SEGREGATION & CAMERA SEPARATION', () => {

  // =========================================================================
  // SUITE 1: HEADER.JSX MINIMALISM & DRAWER INTEGRITY
  // =========================================================================
  describe('1. Header.jsx Minimalist Top Bar & Drawer Integrity', () => {
    const headerPath = path.join(rootDir, 'src/components/Header.jsx');
    const content = fs.readFileSync(headerPath, 'utf-8');

    it('1.1 Header.jsx top bar MUST NOT contain user avatar capsule outside drawer', () => {
      // Top bar ends before {isMenuOpen && (
      const menuSplit = content.indexOf('{isMenuOpen &&');
      assert.ok(menuSplit !== -1, 'Header.jsx must contain drawer conditional {isMenuOpen &&');
      const topBarCode = content.slice(0, menuSplit);

      // Verify renderAvatar is not invoked in the top bar
      assert.ok(
        !topBarCode.includes("renderAvatar('w-8 h-8'"),
        'Top bar must not render the w-8 h-8 avatar capsule'
      );
      assert.ok(
        !topBarCode.includes('title="Cerrar Sesión"'),
        'Top bar must not render redundant logout button'
      );
    });

    it('1.2 Header.jsx drawer must display "Redes / Online" without "(24/7)" suffix', () => {
      assert.ok(
        content.includes('Punto de Venta: <strong className="font-bold">Redes / Online</strong>'),
        'Drawer must display "Punto de Venta: Redes / Online" without (24/7)'
      );
      assert.ok(
        !content.includes('Redes / Online (24/7)'),
        'Must not contain deprecated "(24/7)" suffix in any badge or label'
      );
    });

    it('1.3 Header.jsx drawer retains logout button with min-h-[44px], min-w-[44px] and aria-label', () => {
      const logoutBtnMatch = content.match(/<button[^>]*onClick=\{[^}]*logout[^}]*\}[^>]*>([\s\S]*?)<\/button>/);
      assert.ok(logoutBtnMatch, 'Header.jsx must contain logout button in drawer');

      const logoutBtnCode = logoutBtnMatch[0];
      assert.ok(logoutBtnCode.includes('min-h-[44px]'), 'Logout button must enforce min-h-[44px]');
      assert.ok(logoutBtnCode.includes('min-w-[44px]'), 'Logout button must enforce min-w-[44px]');
      assert.ok(logoutBtnCode.includes('aria-label="Cerrar Sesión"'), 'Logout button must have aria-label="Cerrar Sesión"');
      assert.ok(logoutBtnCode.includes('title="Cerrar Sesión"'), 'Logout button must have title="Cerrar Sesión"');
    });
  });

  // =========================================================================
  // SUITE 2: FASTMANUALSALEFORM.JSX ORDER & SYNC SEGREGATION
  // =========================================================================
  describe('2. FastManualSaleForm.jsx Ergonomic Order & Catalog Sync Segregation', () => {
    const formPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
    const content = fs.readFileSync(formPath, 'utf-8');

    it('2.1 REDES_PERSONALIZADO mode places SaleCartList BEFORE DeliveryMethodSelector', () => {
      const redesSectionStart = content.indexOf("saleMode === 'REDES_PERSONALIZADO'");
      const mostradorSectionStart = content.indexOf('MODO MOSTRADOR (FERIA 100%)');
      assert.ok(redesSectionStart !== -1, 'Must have REDES_PERSONALIZADO branch');
      assert.ok(mostradorSectionStart !== -1, 'Must have MODO MOSTRADOR branch');

      const redesSection = content.slice(redesSectionStart, mostradorSectionStart);

      const cartIdx = redesSection.indexOf('<SaleCartList');
      const deliveryIdx = redesSection.indexOf('<DeliveryMethodSelector');
      const quoterIdx = redesSection.indexOf('<RemoteQuoterSummary');

      assert.ok(cartIdx !== -1, 'REDES section must contain SaleCartList');
      assert.ok(deliveryIdx !== -1, 'REDES section must contain DeliveryMethodSelector');
      assert.ok(quoterIdx !== -1, 'REDES section must contain RemoteQuoterSummary');

      assert.ok(
        cartIdx < deliveryIdx,
        'SaleCartList must be positioned strictly BEFORE DeliveryMethodSelector for instant visual feedback'
      );
      assert.ok(
        deliveryIdx < quoterIdx,
        'DeliveryMethodSelector must be positioned strictly BEFORE RemoteQuoterSummary'
      );
    });

    it('2.2 FastManualSaleForm.jsx removes renderSyncControl from REDES but preserves it in POS_FERIA', () => {
      const redesSectionStart = content.indexOf("saleMode === 'REDES_PERSONALIZADO'");
      const mostradorSectionStart = content.indexOf('MODO MOSTRADOR (FERIA 100%)');
      const redesSection = content.slice(redesSectionStart, mostradorSectionStart);
      const feriaSection = content.slice(mostradorSectionStart);

      assert.ok(
        !redesSection.includes('renderSyncControl'),
        'REDES_PERSONALIZADO section must NOT contain renderSyncControl'
      );
      assert.ok(
        !redesSection.includes('renderSyncFeedback'),
        'REDES_PERSONALIZADO section must NOT contain renderSyncFeedback'
      );

      assert.ok(
        feriaSection.includes("renderSyncControl('Sincronizar catálogo')"),
        'POS_FERIA section MUST retain renderSyncControl'
      );
      assert.ok(
        feriaSection.includes('renderSyncFeedback()'),
        'POS_FERIA section MUST retain renderSyncFeedback'
      );
    });
  });

  // =========================================================================
  // SUITE 3: CATALOGSEARCHINPUT.JSX CAMERA SEPARATION
  // =========================================================================
  describe('3. CatalogSearchInput.jsx Camera Separation & Touch Ergonomics', () => {
    const searchPath = path.join(rootDir, 'src/components/manual-sale/CatalogSearchInput.jsx');
    const content = fs.readFileSync(searchPath, 'utf-8');

    it('3.1 Decouples catalog-camera-btn outside search input into adjacent flex layout', () => {
      assert.ok(
        content.includes('<div className="flex items-center gap-2">'),
        'Search area must be wrapped in flex items-center gap-2'
      );
      assert.ok(
        content.includes('data-testid="catalog-camera-btn"'),
        'Must contain catalog-camera-btn'
      );

      const cameraBtnMatch = content.match(/<button[^>]*data-testid="catalog-camera-btn"[^>]*>([\s\S]*?)<\/button>/);
      assert.ok(cameraBtnMatch, 'Must find camera button markup');
      const cameraBtn = cameraBtnMatch[0];

      assert.ok(cameraBtn.includes('min-h-[44px]'), 'Camera button must have min-h-[44px]');
      assert.ok(cameraBtn.includes('min-w-[44px]'), 'Camera button must have min-w-[44px]');
      assert.ok(cameraBtn.includes('shrink-0'), 'Camera button must have shrink-0 to prevent compression');
      assert.ok(cameraBtn.includes('aria-label="Buscar póster por foto"'), 'Camera button must have aria-label');
    });
  });

  // =========================================================================
  // SUITE 4: DOMAIN CEILINGS & NUMBERING COHERENCE
  // =========================================================================
  describe('4. Anti-Ravioli Ceilings & Step Numbering Coherence', () => {
    it('4.1 Modified files strictly adhere to layer default line ceilings', () => {
      const headerPath = path.join(rootDir, 'src/components/Header.jsx');
      const formPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
      const searchPath = path.join(rootDir, 'src/components/manual-sale/CatalogSearchInput.jsx');
      const deliveryPath = path.join(rootDir, 'src/components/manual-sale/DeliveryMethodSelector.jsx');
      const quoterPath = path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx');

      const headerLines = fs.readFileSync(headerPath, 'utf-8').split('\n').length;
      const formLines = fs.readFileSync(formPath, 'utf-8').split('\n').length;
      const searchLines = fs.readFileSync(searchPath, 'utf-8').split('\n').length;
      const deliveryLines = fs.readFileSync(deliveryPath, 'utf-8').split('\n').length;
      const quoterLines = fs.readFileSync(quoterPath, 'utf-8').split('\n').length;

      assert.ok(headerLines <= 280, `Header.jsx has ${headerLines} lines (ceiling <= 280)`);
      assert.ok(formLines <= 350, `FastManualSaleForm.jsx has ${formLines} lines (critical ceiling <= 350)`);
      assert.ok(searchLines <= 280, `CatalogSearchInput.jsx has ${searchLines} lines (ceiling <= 280)`);
      assert.ok(deliveryLines <= 280, `DeliveryMethodSelector.jsx has ${deliveryLines} lines (ceiling <= 280)`);
      assert.ok(quoterLines <= 350, `RemoteQuoterSummary.jsx has ${quoterLines} lines (ceiling <= 350)`);
    });

    it('4.2 DeliveryMethodSelector and RemoteQuoterSummary have coherent step numbering', () => {
      const deliveryContent = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/DeliveryMethodSelector.jsx'), 'utf-8');
      const quoterContent = fs.readFileSync(path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx'), 'utf-8');

      assert.ok(
        deliveryContent.includes('<span>3. Método de Entrega & Logística</span>'),
        'DeliveryMethodSelector must have step 3 title'
      );
      assert.ok(
        quoterContent.includes('<span>4. Cotizador & Registro de Anticipo</span>'),
        'RemoteQuoterSummary must have step 4 title'
      );
    });
  });
});
