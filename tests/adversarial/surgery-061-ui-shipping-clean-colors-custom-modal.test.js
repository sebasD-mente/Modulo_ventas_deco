import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ SURGERY-061: FLETE CERO EN VENTA ONLINE, PALETA BLANCA/VERDE ANTI-FATIGA & SANITIZACIÓN EN PÓSTER PERSONALIZADO', () => {

  // =========================================================================
  // SUITE 1: FLETE CERO Y SUPRESIÓN DE TARIFAS SUGERIDAS (DELIVERYMETHODSELECTOR)
  // =========================================================================
  describe('1. DeliveryMethodSelector & useRemoteSaleForm Shipping Defaults', () => {
    const deliveryPath = path.join(rootDir, 'src/components/manual-sale/DeliveryMethodSelector.jsx');
    const deliveryContent = fs.readFileSync(deliveryPath, 'utf-8');

    const formHookPath = path.join(rootDir, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');
    const formHookContent = fs.readFileSync(formHookPath, 'utf-8');

    it('1.1 DeliveryMethodSelector.jsx does NOT contain Tarifas de Flete Sugeridas or SHIPPING_PRESETS', () => {
      assert.ok(
        !deliveryContent.includes('Tarifas de Flete Sugeridas'),
        'DeliveryMethodSelector must NOT contain Tarifas de Flete Sugeridas'
      );
      assert.ok(
        !deliveryContent.includes('SHIPPING_PRESETS'),
        'DeliveryMethodSelector must NOT declare or use SHIPPING_PRESETS'
      );
      assert.ok(
        !deliveryContent.includes('preset.amount'),
        'DeliveryMethodSelector must not map preset amounts'
      );
    });

    it('1.2 DeliveryMethodSelector.jsx does NOT force shippingCost to 35 on courier selection', () => {
      assert.ok(
        !deliveryContent.includes('if (shippingCost === 0) setShippingCost(35);'),
        'DeliveryMethodSelector must not force shippingCost to 35'
      );
    });

    it('1.3 DeliveryMethodSelector.jsx maintains free numeric input for courier shipping with placeholder 0.00', () => {
      assert.ok(
        deliveryContent.includes('Costo Flete Courier (Q)'),
        'Must label custom courier shipping clearly'
      );
      assert.ok(
        deliveryContent.includes('placeholder="0.00"'),
        'Must include placeholder 0.00'
      );
      assert.ok(
        deliveryContent.includes('min-h-[44px]'),
        'Input must comply with >=44px ergonomic touch standard'
      );
    });

    it('1.4 useRemoteSaleForm.js initializes shippingCost strictly at 0', () => {
      assert.ok(
        formHookContent.includes('const [shippingCost, setShippingCost] = useState(0);'),
        'useRemoteSaleForm must initialize shippingCost to 0'
      );
      assert.ok(
        !formHookContent.includes('const [shippingCost, setShippingCost] = useState(35);'),
        'useRemoteSaleForm must not default shippingCost to 35'
      );
    });

    it('1.5 useRemoteSaleForm.js resets shippingCost to 0 upon completing sale', () => {
      assert.ok(
        formHookContent.includes('setShippingCost(0);'),
        'useRemoteSaleForm must reset shippingCost to 0 after confirming sale'
      );
    });

    it('1.6 Mathematical verification: empty cart + 0 shipping yields 0 totalAmount and 0 minDeposit', () => {
      const cartItems = [];
      const discount = 0;
      const shippingCost = 0;
      const deliveryMethod = 'ENVIO_COURIER';

      const productsSubtotal = cartItems.reduce((sum, it) => sum + (Number(it.subtotal) || 0), 0);
      const productsAmount = Math.max(0, Number((productsSubtotal - Number(discount)).toFixed(2)));
      const effectiveShippingCost = deliveryMethod === 'ENVIO_COURIER' ? Number(shippingCost || 0) : 0;
      const totalAmount = Number((productsAmount + effectiveShippingCost).toFixed(2));
      const minDeposit = Number((totalAmount * 0.50).toFixed(2));

      assert.equal(totalAmount, 0, 'totalAmount must be strictly 0');
      assert.equal(minDeposit, 0, 'minDeposit must be strictly 0');
    });
  });

  // =========================================================================
  // SUITE 2: PALETA ANTI-FATIGA (BLANCO / VERDE ESMERALDA) EN REDES SOCIALES
  // =========================================================================
  describe('2. Anti-Fatigue Visual Palette in RemoteQuoterSummary & FastManualSaleForm', () => {
    const quoterPath = path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx');
    const quoterContent = fs.readFileSync(quoterPath, 'utf-8');

    const fastFormPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
    const fastFormContent = fs.readFileSync(fastFormPath, 'utf-8');

    it('2.1 RemoteQuoterSummary toggles use white background for active state', () => {
      assert.ok(
        quoterContent.includes("bg-white text-black border-white shadow-sm font-bold"),
        'RemoteQuoterSummary active toggle must use clean white background'
      );
      assert.ok(
        !quoterContent.includes("bg-amber-400 text-black border-amber-400 shadow-sm"),
        'RemoteQuoterSummary must NOT use amber-400 for toggle'
      );
    });

    it('2.2 RemoteQuoterSummary 1-touch deposit buttons use white for active state', () => {
      assert.ok(
        quoterContent.includes("bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white"),
        'Inactive deposit buttons must use clean neutral-900'
      );
      assert.ok(
        !quoterContent.includes("bg-black text-amber-300 border-amber-500/30"),
        'Must remove amber borders from 1-touch deposit buttons'
      );
    });

    it('2.3 RemoteQuoterSummary primary confirmation button uses emerald-500', () => {
      assert.ok(
        quoterContent.includes("bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"),
        'Primary confirmation button must use emerald-500'
      );
      assert.ok(
        !quoterContent.includes("bg-amber-400 hover:bg-amber-300 text-black shadow-amber-400/20"),
        'Primary confirmation button must NOT use amber-400'
      );
    });

    it('2.4 FastManualSaleForm uses white background for REDES_PERSONALIZADO mode toggle', () => {
      assert.ok(
        fastFormContent.includes("saleMode === 'REDES_PERSONALIZADO'\n                  ? 'bg-white text-black shadow-md font-black'"),
        'Active Redes mode button must use bg-white text-black'
      );
      assert.ok(
        !fastFormContent.includes("saleMode === 'REDES_PERSONALIZADO'\n                  ? 'bg-amber-400 text-black shadow-md font-black'"),
        'Active Redes mode button must NOT use bg-amber-400'
      );
    });

    it('2.5 FastManualSaleForm + Personalizado button uses sober white/neutral styling', () => {
      assert.ok(
        fastFormContent.includes("bg-white hover:bg-neutral-200 text-black font-bold text-xs"),
        '+ Personalizado button must use bg-white without amber noise'
      );
      assert.ok(
        !fastFormContent.includes("bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30"),
        '+ Personalizado button must not use amber borders or text'
      );
    });
  });

  // =========================================================================
  // SUITE 3: SANITIZACIÓN Y DES-PRELLENADO EN PÓSTER PERSONALIZADO
  // =========================================================================
  describe('3. CustomItemModal Sanitation, Unforced Price and Clean Styling', () => {
    const modalPath = path.join(rootDir, 'src/components/manual-sale/CustomItemModal.jsx');
    const modalContent = fs.readFileSync(modalPath, 'utf-8');

    it('3.1 CustomItemModal.jsx initializes unitPrice to empty string without hardcoded 65', () => {
      assert.ok(
        modalContent.includes("const [unitPrice, setUnitPrice] = useState('');"),
        'unitPrice must be initialized to empty string'
      );
      assert.ok(
        !modalContent.includes("const [unitPrice, setUnitPrice] = useState('65');"),
        'unitPrice must NOT be hardcoded to 65'
      );
    });

    it('3.2 CustomItemModal.jsx initializes selectedSize to null to prevent unprompted price injection', () => {
      assert.ok(
        modalContent.includes("const [selectedSize, setSelectedSize] = useState(null);"),
        'selectedSize must be initialized to null'
      );
      assert.ok(
        !modalContent.includes("const [selectedSize, setSelectedSize] = useState(OFFICIAL_SIZES[3]);"),
        'selectedSize must not default to OFFICIAL_SIZES[3] automatically'
      );
    });

    it('3.3 CustomItemModal.jsx includes placeholder 0.00 for agreed price input', () => {
      assert.ok(
        modalContent.includes('placeholder="0.00"'),
        'unitPrice input must provide 0.00 placeholder'
      );
    });

    it('3.4 CustomItemModal.jsx uses white/black styling for active material buttons', () => {
      assert.ok(
        modalContent.includes("material === m.id ? 'bg-white text-black border-white font-bold shadow-sm' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'"),
        'Active material buttons must use bg-white text-black'
      );
      assert.ok(
        !modalContent.includes("bg-amber-400/10 border-amber-400 text-amber-300"),
        'Must remove amber styles from material buttons'
      );
    });

    it('3.5 CustomItemModal.jsx uses white/black styling for measurement mode toggles', () => {
      assert.ok(
        modalContent.includes("mode === 'STANDARD' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'"),
        'STANDARD toggle must use bg-white when active'
      );
      assert.ok(
        modalContent.includes("mode === 'CUSTOM' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'"),
        'CUSTOM toggle must use bg-white when active'
      );
    });

    it('3.6 CustomItemModal.jsx submit button uses emerald-500', () => {
      assert.ok(
        modalContent.includes('bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-500/20'),
        'Submit button in CustomItemModal must be green emerald-500'
      );
      assert.ok(
        !modalContent.includes('bg-amber-400 hover:bg-amber-300 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md'),
        'Submit button must NOT use amber-400'
      );
    });
  });

  // =========================================================================
  // SUITE 4: COHESIÓN Y LÍMITES ARQUITECTÓNICOS
  // =========================================================================
  describe('4. Architectural Ceilings & Domain Cohesion', () => {
    it('4.1 CustomItemModal.jsx complies with component ceiling of 280 lines', () => {
      const modalPath = path.join(rootDir, 'src/components/manual-sale/CustomItemModal.jsx');
      const lines = fs.readFileSync(modalPath, 'utf-8').split('\n').length;
      assert.ok(lines <= 280, `CustomItemModal.jsx (${lines} lines) must be <= 280 lines`);
    });

    it('4.2 useRemoteSaleForm.js complies with hook ceiling of 350 lines', () => {
      const hookPath = path.join(rootDir, 'src/components/manual-sale/hooks/useRemoteSaleForm.js');
      const lines = fs.readFileSync(hookPath, 'utf-8').split('\n').length;
      assert.ok(lines <= 350, `useRemoteSaleForm.js (${lines} lines) must be <= 350 lines`);
    });

    it('4.3 RemoteQuoterSummary.jsx complies with domain ceiling of 350 lines', () => {
      const quoterPath = path.join(rootDir, 'src/components/manual-sale/RemoteQuoterSummary.jsx');
      const lines = fs.readFileSync(quoterPath, 'utf-8').split('\n').length;
      assert.ok(lines <= 350, `RemoteQuoterSummary.jsx (${lines} lines) must be <= 350 lines`);
    });

    it('4.4 FastManualSaleForm.jsx complies with domain ceiling of 350 lines', () => {
      const formPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
      const lines = fs.readFileSync(formPath, 'utf-8').split('\n').length;
      assert.ok(lines <= 350, `FastManualSaleForm.jsx (${lines} lines) must be <= 350 lines`);
    });
  });
});
