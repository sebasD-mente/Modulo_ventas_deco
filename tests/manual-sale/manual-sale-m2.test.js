import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE DE PRUEBAS MODULARES M2: UI Submodules (Search, Configurator & Cart)', () => {
  const searchInputPath = path.join(rootDir, 'src/components/manual-sale/CatalogSearchInput.jsx');
  const configuratorPath = path.join(rootDir, 'src/components/manual-sale/PosterConfigurator.jsx');
  const cartListPath = path.join(rootDir, 'src/components/manual-sale/SaleCartList.jsx');

  const files = [
    { file: 'src/components/manual-sale/CatalogSearchInput.jsx', fullPath: searchInputPath, ceiling: 100, desc: 'Buscador de pósters y dropdown' },
    { file: 'src/components/manual-sale/PosterConfigurator.jsx', fullPath: configuratorPath, ceiling: 120, desc: 'Configurador de tamaños y cantidad' },
    { file: 'src/components/manual-sale/SaleCartList.jsx', fullPath: cartListPath, ceiling: 120, desc: 'Lista de ítems en carrito y drafts' },
  ];

  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE TECHOS DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Techos de Líneas', () => {
    for (const { file, fullPath, ceiling, desc } of files) {
      it(`1.x. ${file} (${desc}) existe y cumple el techo de < ${ceiling} líneas`, () => {
        assert.ok(fs.existsSync(fullPath), `El archivo ${file} debe existir`);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lineCount = content.split('\n').length;
        assert.ok(
          lineCount < ceiling,
          `Violación de techo: ${file} tiene ${lineCount} líneas (máximo permitido < ${ceiling})`
        );
        assert.ok(
          lineCount <= 200,
          `Violación de límite de monolito: ${file} supera las 200 líneas`
        );
      });
    }
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE DE INTEGRIDAD ZERO-TRUST Y CERO MOCKS/STUBS
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Fugas en Producción', () => {
    it('2.1. Ningún submódulo contiene comentarios TODO, FIXME, STUB, MOCK o marcadores dummy', () => {
      const suspiciousPattern =
        /(\/\/\s*(TODO|FIXME|STUB|MOCK|PLACEHOLDER)|\/\*[\s\S]*?(TODO|FIXME|STUB|MOCK|PLACEHOLDER)[\s\S]*?\*\/|const\s+mock|let\s+mock|function\s+mock|lorem\s+ipsum)/i;
      for (const { file, fullPath } of files) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const match = content.match(suspiciousPattern);
        assert.ok(
          !match,
          `Detectado marcador residual o stub prohibido en ${file}: "${match?.[0]}"`
        );
      }
    });

    it('2.2. Ningún archivo hardcodea correos de vendedores ni IPs ajenas', () => {
      for (const { file, fullPath } of files) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        assert.ok(!content.includes('145.223.120.56'), `IP ajena detectada en ${file}`);
        assert.ok(!content.includes('@gmail.com'), `Correo hardcodeado en ${file}`);
      }
    });
  });

  // =========================================================================
  // 3. ESTRUCTURA Y CONTRATOS DE CATALOG SEARCH INPUT
  // =========================================================================
  describe('3. CatalogSearchInput.jsx: Contrato de Props y Elementos Visuales', () => {
    it('3.1. Exporta por defecto un componente funcional con la firma de props requerida', () => {
      const code = fs.readFileSync(searchInputPath, 'utf-8');
      assert.match(code, /export\s+default\s+function\s+CatalogSearchInput\s*\(/);
      const requiredProps = [
        'searchQuery',
        'setSearchQuery',
        'searchResults',
        'isSearching',
        'showDropdown',
        'setShowDropdown',
        'searchInputRef',
        'searchContainerRef',
        'onSelectPoster',
        'onClearSearch',
        'hasSelectedPoster',
      ];
      for (const prop of requiredProps) {
        assert.ok(code.includes(prop), `CatalogSearchInput debe recibir y utilizar la prop: ${prop}`);
      }
    });

    it('3.2. Incluye iconos Lucide obligatorios: Search, X, Loader2', () => {
      const code = fs.readFileSync(searchInputPath, 'utf-8');
      assert.match(code, /import\s+{[^}]*Search[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*X[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*Loader2[^}]*}\s+from\s+['"]lucide-react['"]/);
    });

    it('3.3. Renders label, search input con refs, botón de limpiar y dropdown de catálogo', () => {
      const code = fs.readFileSync(searchInputPath, 'utf-8');
      assert.ok(code.includes('1. Buscar póster en catálogo'), 'Debe incluir label canónico');
      assert.ok(code.includes('ref={searchContainerRef}'), 'Debe vincular searchContainerRef');
      assert.ok(code.includes('ref={searchInputRef}'), 'Debe vincular searchInputRef');
      assert.ok(code.includes('onClearSearch'), 'Debe invocar onClearSearch al hacer click en X');
      assert.ok(code.includes('onSelectPoster'), 'Debe invocar onSelectPoster al seleccionar póster');
      assert.ok(code.includes('precioMinimo'), 'Debe mostrar badge de precio mínimo');
    });
  });

  // =========================================================================
  // 4. ESTRUCTURA Y CONTRATOS DE POSTER CONFIGURATOR
  // =========================================================================
  describe('4. PosterConfigurator.jsx: Contrato de Props y Elementos Visuales', () => {
    it('4.1. Exporta por defecto un componente funcional con la firma de props requerida', () => {
      const code = fs.readFileSync(configuratorPath, 'utf-8');
      assert.match(code, /export\s+default\s+function\s+PosterConfigurator\s*\(/);
      const requiredProps = [
        'selectedPoster',
        'selectedSize',
        'setSelectedSize',
        'itemQuantity',
        'setItemQuantity',
        'onAddToCart',
        'onCancel',
      ];
      for (const prop of requiredProps) {
        assert.ok(code.includes(prop), `PosterConfigurator debe recibir y utilizar la prop: ${prop}`);
      }
    });

    it('4.2. Importa DEFAULT_SIZES e iconos Lucide requeridos (X, Plus, Minus, ShoppingBag)', () => {
      const code = fs.readFileSync(configuratorPath, 'utf-8');
      assert.match(code, /import\s+{[^}]*DEFAULT_SIZES[^}]*}\s+from\s+['"]\.\/manualSaleConstants['"]/);
      assert.match(code, /import\s+{[^}]*X[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*Plus[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*Minus[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*ShoppingBag[^}]*}\s+from\s+['"]lucide-react['"]/);
    });

    it('4.3. Implementa guard de selectedPoster y renderiza controles de tamaño y cantidad', () => {
      const code = fs.readFileSync(configuratorPath, 'utf-8');
      assert.ok(code.includes('if (!selectedPoster) return null'), 'Debe retornar null si no hay póster');
      assert.ok(code.includes('onCancel'), 'Botón X debe llamar a onCancel');
      assert.ok(code.includes('setSelectedSize'), 'Pills de tamaño deben llamar a setSelectedSize');
      assert.ok(code.includes('setItemQuantity'), 'Botones +/- deben llamar a setItemQuantity');
      assert.ok(code.includes('onAddToCart'), 'Botón maestro debe llamar a onAddToCart');
      assert.ok(code.includes('Agregar al Ticket'), 'Texto del botón de adición al ticket');
    });
  });

  // =========================================================================
  // 5. ESTRUCTURA Y CONTRATOS DE SALE CART LIST
  // =========================================================================
  describe('5. SaleCartList.jsx: Contrato de Props y Elementos Visuales', () => {
    it('5.1. Exporta por defecto un componente funcional con la firma de props requerida', () => {
      const code = fs.readFileSync(cartListPath, 'utf-8');
      assert.match(code, /export\s+default\s+function\s+SaleCartList\s*\(/);
      const requiredProps = [
        'cartItems',
        'attachments',
        'inputChannel',
        'onUnlinkAttachments',
        'onUpdateQty',
        'onChangeSize',
        'onRemoveItem',
        'onClearCart',
      ];
      for (const prop of requiredProps) {
        assert.ok(code.includes(prop), `SaleCartList debe recibir y utilizar la prop: ${prop}`);
      }
    });

    it('5.2. Importa DEFAULT_SIZES e iconos Lucide requeridos (ShoppingBag, Plus, Minus, Trash2, X)', () => {
      const code = fs.readFileSync(cartListPath, 'utf-8');
      assert.match(code, /import\s+{[^}]*DEFAULT_SIZES[^}]*}\s+from\s+['"]\.\/manualSaleConstants['"]/);
      assert.match(code, /import\s+{[^}]*Trash2[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*Plus[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*Minus[^}]*}\s+from\s+['"]lucide-react['"]/);
      assert.match(code, /import\s+{[^}]*X[^}]*}\s+from\s+['"]lucide-react['"]/);
    });

    it('5.3. Renderiza banner de drafts transferidos, estado vacío y lista de ítems interactiva', () => {
      const code = fs.readFileSync(cartListPath, 'utf-8');
      assert.ok(code.includes('Borrador transferido desde'), 'Debe renderizar alerta de transferido');
      assert.ok(code.includes('onUnlinkAttachments'), 'Botón desvincular debe llamar onUnlinkAttachments');
      assert.ok(code.includes('2. Pósters en la Venta'), 'Header de sección con conteo');
      assert.ok(code.includes('Limpiar Venta'), 'Botón limpiar venta');
      assert.ok(code.includes('onClearCart'), 'Debe llamar onClearCart al limpiar venta');
      assert.ok(code.includes('No hay pósters agregados todavía'), 'Banner amigable de estado vacío');
      assert.ok(code.includes('onUpdateQty'), 'Botones +/- deben invocar onUpdateQty');
      assert.ok(code.includes('onChangeSize'), 'Botones de tallas deben invocar onChangeSize');
      assert.ok(code.includes('onRemoveItem'), 'Botón papelera debe invocar onRemoveItem');
    });
  });
});
