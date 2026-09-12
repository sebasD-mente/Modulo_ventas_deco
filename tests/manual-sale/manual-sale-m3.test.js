import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🛡️ SUITE DE PRUEBAS MODULARES M3: PaymentSummaryBar & Master Container FastManualSaleForm', () => {
  const paymentBarPath = path.join(rootDir, 'src/components/manual-sale/PaymentSummaryBar.jsx');
  const masterFormPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');

  const files = [
    {
      file: 'src/components/manual-sale/PaymentSummaryBar.jsx',
      fullPath: paymentBarPath,
      ceiling: 110,
      desc: 'Barra de métodos de pago, descuentos y liquidación final',
    },
    {
      file: 'src/components/FastManualSaleForm.jsx',
      fullPath: masterFormPath,
      ceiling: 70,
      desc: 'Contenedor maestro canónico desacoplado y orquestador',
    },
  ];

  // =========================================================================
  // 1. AUDITORÍA ESTRICTA DE TECHOS DE LÍNEAS (LINE CEILINGS)
  // =========================================================================
  describe('1. Cumplimiento Estricto de Techos de Líneas', () => {
    for (const { file, fullPath, ceiling, desc } of files) {
      it(`1.x. ${file} (${desc}) existe y cumple estrictamente el techo de < ${ceiling} líneas`, () => {
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

    it('1.3. FastManualSaleForm.jsx reduce drásticamente su tamaño desde 750 líneas originales', () => {
      const content = fs.readFileSync(masterFormPath, 'utf-8');
      const lines = content.split('\n').length;
      assert.ok(lines < 70, `Esperado < 70 líneas, recibido: ${lines}`);
      assert.ok(lines > 40, `El archivo debe contener lógica genuina, líneas: ${lines}`);
    });
  });

  // =========================================================================
  // 2. AUDITORÍA FORENSE DE INTEGRIDAD ZERO-TRUST Y CERO MOCKS/STUBS
  // =========================================================================
  describe('2. Auditoría Forense: Cero Mocks, Stubs o Fugas en Producción', () => {
    it('2.1. Ningún archivo contiene comentarios TODO, FIXME, STUB, MOCK o marcadores dummy', () => {
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
  // 3. ESTRUCTURA Y CONTRATOS DE PAYMENT SUMMARY BAR
  // =========================================================================
  describe('3. PaymentSummaryBar.jsx: Contrato de Props y Elementos Visuales', () => {
    it('3.1. Exporta por defecto un componente funcional con la firma de props requerida', () => {
      const code = fs.readFileSync(paymentBarPath, 'utf-8');
      assert.match(code, /export\s+default\s+function\s+PaymentSummaryBar\s*\(/);
      const requiredProps = [
        'paymentMethod',
        'setPaymentMethod',
        'discount',
        'setDiscount',
        'notes',
        'setNotes',
        'grandTotal',
        'isSubmitting',
        'disabled',
        'onConfirmSale',
      ];
      for (const prop of requiredProps) {
        assert.ok(code.includes(prop), `PaymentSummaryBar debe recibir y utilizar: ${prop}`);
      }
    });

    it('3.2. Importa iconos Lucide obligatorios: Banknote, CreditCard, Smartphone, Tag, CheckCircle2, Loader2', () => {
      const code = fs.readFileSync(paymentBarPath, 'utf-8');
      const icons = ['Banknote', 'CreditCard', 'Smartphone', 'Tag', 'CheckCircle2', 'Loader2'];
      for (const icon of icons) {
        assert.match(
          code,
          new RegExp(`import\\s+{[^}]*\\b${icon}\\b[^}]*}\\s+from\\s+['"]lucide-react['"]`),
          `Falta icono ${icon}`
        );
      }
    });

    it('3.3. Implementa los 3 métodos de pago con highlight ámbar en activo', () => {
      const code = fs.readFileSync(paymentBarPath, 'utf-8');
      assert.ok(code.includes('EFECTIVO'), 'Debe contemplar método EFECTIVO');
      assert.ok(code.includes('TARJETA'), 'Debe contemplar método TARJETA');
      assert.ok(code.includes('TRANSFERENCIA'), 'Debe contemplar método TRANSFERENCIA');
      assert.ok(code.includes('amber'), 'Debe aplicar resaltado ámbar al método activo');
      assert.ok(code.includes('3. Desplegar Método de Pago (1 Toque)'), 'Debe incluir label canónico');
    });

    it('3.4. Implementa fila de descuento y notas con placeholder e icono Tag', () => {
      const code = fs.readFileSync(paymentBarPath, 'utf-8');
      assert.ok(code.includes('placeholder="0.00"'), 'Input de descuento debe tener placeholder 0.00');
      assert.ok(
        code.includes('placeholder="Ej. Cliente frecuente..."'),
        'Input de notas debe tener placeholder canónico'
      );
      assert.ok(code.includes('<Tag'), 'Debe renderizar icono Tag en la fila de descuento');
    });

    it('3.5. Renderiza total a cobrar y botón de asentar venta con estados normal y enviando', () => {
      const code = fs.readFileSync(paymentBarPath, 'utf-8');
      assert.ok(code.includes('Total a Cobrar:'), 'Debe mostrar texto Total a Cobrar:');
      assert.ok(code.includes('Asentando en Postgres...'), 'Debe contemplar texto de carga');
      assert.ok(code.includes('Registrar Venta'), 'Debe contemplar texto de confirmación');
      assert.ok(code.includes('disabled={disabled || isSubmitting}'), 'Debe respetar disabled');
    });
  });

  // =========================================================================
  // 4. ESTRUCTURA Y CONTRATOS DE MASTER CONTAINER FASTMANUALSALEFORM
  // =========================================================================
  describe('4. FastManualSaleForm.jsx: Orquestador Maestro y Contrato Público', () => {
    it('4.1. Preserva el contrato público canónico { eventId, onSaleRegistered, initialDraft = null }', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.match(
        code,
        /export\s+default\s+function\s+FastManualSaleForm\s*\(\s*{\s*eventId,\s*onSaleRegistered,\s*initialDraft\s*=\s*null\s*}\s*\)/
      );
    });

    it('4.2. Integra los hooks reactivos useCatalogSearch y useManualSaleCart', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.match(code, /import\s+useCatalogSearch\s+from\s+['"]\.\/manual-sale\/hooks\/useCatalogSearch['"]/);
      assert.match(code, /import\s+useManualSaleCart\s+from\s+['"]\.\/manual-sale\/hooks\/useManualSaleCart['"]/);
      assert.ok(code.includes('const search = useCatalogSearch()'));
      assert.ok(code.includes('const cart = useManualSaleCart({ eventId, onSaleRegistered, initialDraft })'));
    });

    it('4.3. Importa DEFAULT_SIZES y los 4 submódulos UI atómicos', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.match(code, /import\s+{[^}]*DEFAULT_SIZES[^}]*}\s+from\s+['"]\.\/manual-sale\/manualSaleConstants['"]/);
      assert.match(code, /import\s+CatalogSearchInput\s+from\s+['"]\.\/manual-sale\/CatalogSearchInput['"]/);
      assert.match(code, /import\s+PosterConfigurator\s+from\s+['"]\.\/manual-sale\/PosterConfigurator['"]/);
      assert.match(code, /import\s+SaleCartList\s+from\s+['"]\.\/manual-sale\/SaleCartList['"]/);
      assert.match(code, /import\s+PaymentSummaryBar\s+from\s+['"]\.\/manual-sale\/PaymentSummaryBar['"]/);
    });

    it('4.4. Mantiene estado local escenificado para selectedPoster, selectedSize e itemQuantity', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.ok(code.includes('const [selectedPoster, setSelectedPoster] = useState(null)'));
      assert.ok(code.includes('const [selectedSize, setSelectedSize] = useState(DEFAULT_SIZES[2])'));
      assert.ok(code.includes('const [itemQuantity, setItemQuantity] = useState(1)'));
    });

    it('4.5. Implementa manejadores handleSelectPoster y handleAddToCart genuinos', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.ok(code.includes('handleSelectPoster'));
      assert.ok(code.includes('search.selectPoster(poster)'));
      assert.ok(code.includes('handleAddToCart'));
      assert.ok(code.includes('cart.addItemFromPoster(selectedPoster, selectedSize, itemQuantity)'));
      assert.ok(code.includes('search.clearSearch()'));
    });

    it('4.6. Renderiza tarjeta maestra, cabecera con ShoppingBag, alerta de error y subcomponentes', () => {
      const code = fs.readFileSync(masterFormPath, 'utf-8');
      assert.ok(code.includes('bg-[#121212]'), 'Debe tener fondo #121212');
      assert.ok(code.includes('ShoppingBag'), 'Debe incluir icono ShoppingBag');
      assert.ok(code.includes('Venta manual'), 'Debe incluir título Venta manual');
      assert.ok(code.includes('cart.errorMsg'), 'Debe renderizar condicionalmente cart.errorMsg');
      assert.ok(code.includes('<CatalogSearchInput'), 'Debe renderizar CatalogSearchInput');
      assert.ok(code.includes('<PosterConfigurator'), 'Debe renderizar PosterConfigurator condicional');
      assert.ok(code.includes('<SaleCartList'), 'Debe renderizar SaleCartList');
      assert.ok(code.includes('<PaymentSummaryBar'), 'Debe renderizar PaymentSummaryBar');
    });
  });

  // =========================================================================
  // 5. AUDITORÍA DE DEUDA MONOLÍTICA (16 -> 15 ARCHIVOS)
  // =========================================================================
  describe('5. Auditoría de Deuda Monolítica', () => {
    it('5.1. FastManualSaleForm.jsx ya no figura como archivo monolítico excedido en audit-monoliths', () => {
      const dirsToScan = ['src/components', 'server/services', 'server/controllers'];
      const oversizedFiles = [];

      for (const dir of dirsToScan) {
        const fullDir = path.join(rootDir, dir);
        if (!fs.existsSync(fullDir)) continue;
        const files = fs.readdirSync(fullDir).filter((f) => /\.(js|jsx)$/i.test(f));
        for (const file of files) {
          const filePath = path.join(fullDir, file);
          const lineCount = fs.readFileSync(filePath, 'utf-8').split('\n').length;
          if (lineCount > 200) {
            oversizedFiles.push(`${dir}/${file}`);
          }
        }
      }

      assert.ok(
        !oversizedFiles.includes('src/components/FastManualSaleForm.jsx'),
        'FastManualSaleForm.jsx no debe estar en la lista de monolitos excedidos'
      );
      assert.equal(
        oversizedFiles.length,
        15,
        `La cantidad de monolitos debe ser exactamente 15 (recibido: ${oversizedFiles.length})`
      );
    });
  });
});
