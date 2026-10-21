import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('⚔️ SURGERY-060: SELECTOR DE STANDS EN CABECERA, DIVISIÓN DE DESCUENTO & SUPRESIÓN DE TÍTULO DE CATÁLOGO', () => {

  // =========================================================================
  // SUITE 1: HEADER.JSX STAND SELECTOR & ONLINE POS ISOLATION
  // =========================================================================
  describe('1. Header.jsx Stand Selector & Online POS Absolute Isolation', () => {
    const headerPath = path.join(rootDir, 'src/components/Header.jsx');
    const content = fs.readFileSync(headerPath, 'utf-8');

    it('1.1 Header.jsx implements isOnlinePointOfSale helper to detect digital point of sale', () => {
      assert.ok(
        content.includes('const isOnlinePointOfSale = (ev) => Boolean('),
        'Header.jsx must declare isOnlinePointOfSale helper'
      );
      assert.ok(
        content.includes("ev.id === 'evt-ventas-redes-online'"),
        'isOnlinePointOfSale must check evt-ventas-redes-online'
      );
      assert.ok(
        content.includes("ev.name?.toLowerCase().includes('redes')"),
        'isOnlinePointOfSale must check for redes in name'
      );
    });

    it('1.2 Header.jsx strictly confines online badge to exclusive vendedor de redes', () => {
      assert.ok(
        content.includes('isVendedorRedes && !isSuperAdmin && !isVendedor ? ('),
        'Only exclusive vendedor redes can see the online pos badge'
      );
      assert.ok(
        content.includes('data-testid="header-online-pos-badge"'),
        'Must contain header-online-pos-badge testid'
      );
    });

    it('1.3 Header.jsx stand selector menu filters out online digital points of sale', () => {
      assert.ok(
        content.includes('const ferialStandsList = activeEventsList.filter((ev) => !isOnlinePointOfSale(ev));'),
        'ferialStandsList must exclude digital POS'
      );
      assert.ok(
        content.includes('{isSuperAdmin && ferialStandsList.length > 1 ? ('),
        'Selector dropdown only triggers if there are > 1 ferial stands'
      );
      assert.ok(
        content.includes('Stands ({ferialStandsList.length})'),
        'Menu title displays ferial stands count'
      );
      assert.ok(
        content.includes('ferialStandsList.map((ev) => ('),
        'Menu iterates strictly over ferial stands'
      );
    });

    it('1.4 Header.jsx drawer uses isOnlinePointOfSale to prevent false stand labeling', () => {
      assert.ok(
        content.includes('(activeEvent && !isOnlinePointOfSale(activeEvent)) ? ('),
        'Drawer only labels activeEvent as Stand if it is NOT an online POS'
      );
    });
  });

  // =========================================================================
  // SUITE 2: APP.JSX EVENT SYNCHRONIZATION & STATE RESILIENCE
  // =========================================================================
  describe('2. App.jsx Stand Event Synchronization & Digital POS Filtering', () => {
    const appPath = path.join(rootDir, 'src/App.jsx');
    const content = fs.readFileSync(appPath, 'utf-8');

    it('2.1 App.jsx defines isOnlinePointOfSale discriminator', () => {
      assert.ok(
        content.includes('const isOnlinePointOfSale = (ev) => Boolean('),
        'App.jsx must declare isOnlinePointOfSale discriminator'
      );
    });

    it('2.2 App.jsx filters activeEventsList to exclude online POS', () => {
      assert.ok(
        content.includes("isOnlinePointOfSale(e)") && content.includes("e.id !== 'evt-ventas-redes-online'"),
        'activeEventsList must exclude online point of sale with isOnlinePointOfSale and evt-ventas-redes-online'
      );
    });

    it('2.3 App.jsx discards digital POS for non-exclusive-redes users', () => {
      assert.ok(
        content.includes('if (!isExclusiveVendedorRedes && isOnlinePointOfSale(selectedEvent)) {'),
        'Must discard digital POS for non-redes users'
      );
      assert.ok(
        content.includes('selectedEvent = allActive[0] || null;'),
        'Fallback to first ferial stand or null when digital POS was selected'
      );
    });

    it('2.4 App.jsx protects localStorage from storing digital event as admin selected stand', () => {
      assert.ok(
        content.includes("if (isSuperAdmin && !isOnlinePointOfSale(selectedEvent)) {"),
        'Never store online POS as admin selected stand in localStorage'
      );
    });
  });

  // =========================================================================
  // SUITE 3: PAYMENTSUMMARYBAR.JSX DISCOUNT SECTION SPLIT
  // =========================================================================
  describe('3. PaymentSummaryBar.jsx Dual Discount Fields & Ergonomics', () => {
    const summaryPath = path.join(rootDir, 'src/components/manual-sale/PaymentSummaryBar.jsx');
    const content = fs.readFileSync(summaryPath, 'utf-8');

    it('3.1 PaymentSummaryBar accepts notes and setNotes props', () => {
      assert.ok(
        content.includes("notes = '',") && content.includes('setNotes,'),
        'PaymentSummaryBar signature must accept notes and setNotes'
      );
    });

    it('3.2 Section label is renamed to "Descuento" (without "Ferial")', () => {
      // Must include Descuento label
      assert.ok(
        content.includes('<DollarSign className="w-3.5 h-3.5 text-amber-400" />\n            Descuento\n          </span>') ||
        content.includes('Descuento\n          </span>'),
        'Label must be Descuento'
      );
      assert.ok(
        !content.includes('Descuento Ferial'),
        'Must NOT contain "Descuento Ferial"'
      );
    });

    it('3.3 Contains dual tactile inputs for discount amount and notes/authorization', () => {
      assert.ok(
        content.includes('grid grid-cols-1 sm:grid-cols-2 gap-2'),
        'Must use 2-column responsive grid for discount inputs'
      );
      assert.ok(
        content.includes('placeholder="Monto de descuento (ej. 10)"'),
        'Must have discount amount input with correct placeholder'
      );
      assert.ok(
        content.includes('placeholder="Motivo / Autorización"'),
        'Must have reason/authorization input with correct placeholder'
      );
      assert.ok(
        content.includes('value={notes || \'\'}'),
        'Notes input must bind to notes prop'
      );
      assert.ok(
        content.includes('onChange={(e) => setNotes && setNotes(e.target.value)}'),
        'Notes input must invoke setNotes on change'
      );
    });

    it('3.4 Both discount inputs enforce tactile ergonomics (min-h-[44px])', () => {
      const minH44Count = (content.match(/min-h-\[44px\]/g) || []).length;
      assert.ok(
        minH44Count >= 3,
        'Must enforce min-h-[44px] on payment methods and both discount fields'
      );
    });
  });

  // =========================================================================
  // SUITE 4: FASTMANUALSALEFORM.JSX CATALOG HEADER CLEANUP & PROPS CONTRACT
  // =========================================================================
  describe('4. FastManualSaleForm.jsx Catalog Header Suppression & Props Wiring', () => {
    const formPath = path.join(rootDir, 'src/components/FastManualSaleForm.jsx');
    const content = fs.readFileSync(formPath, 'utf-8');

    it('4.1 FastManualSaleForm suppresses "Catálogo Ferial" label', () => {
      assert.ok(
        !content.includes('Catálogo Ferial'),
        'FastManualSaleForm must NOT contain "Catálogo Ferial" label'
      );
    });

    it('4.2 FastManualSaleForm aligns sync control to the right', () => {
      assert.ok(
        content.includes('flex items-center justify-end gap-2'),
        'Sync control must be right-aligned in header container'
      );
      assert.ok(
        content.includes("{renderSyncControl('Sincronizar catálogo')}"),
        'Must preserve renderSyncControl'
      );
    });

    it('4.3 FastManualSaleForm wires notes and setNotes to PaymentSummaryBar', () => {
      assert.ok(
        content.includes('notes={cart.notes}'),
        'PaymentSummaryBar must receive notes={cart.notes}'
      );
      assert.ok(
        content.includes('setNotes={cart.setNotes}'),
        'PaymentSummaryBar must receive setNotes={cart.setNotes}'
      );
    });
  });

  // =========================================================================
  // SUITE 5: EVENTCONTROLLER.JS GETACTIVEEVENT LOGIC & NO ONLINE FALLBACK
  // =========================================================================
  describe('5. eventController.js getActiveEvent Strict Ferial Exclusion', () => {
    const controllerPath = path.join(rootDir, 'server/controllers/eventController.js');
    const content = fs.readFileSync(controllerPath, 'utf-8');

    it('5.1 getActiveEvent excludes evt-ventas-redes-online and redes from active stand query', () => {
      assert.ok(
        content.includes("id: { not: 'evt-ventas-redes-online' }"),
        'Must exclude evt-ventas-redes-online from ferial lookup'
      );
      assert.ok(
        content.includes("{ name: { contains: 'redes', mode: 'insensitive' } }"),
        'Must exclude events with redes in name from ferial lookup'
      );
    });

    it('5.2 getActiveEvent does NOT fall back blindly to online POS when no ferial stand is found', () => {
      const getActiveEventFunc = content.slice(
        content.indexOf('export async function getActiveEvent'),
        content.indexOf('export async function getEventsList')
      );
      // Extraer la rama ferial (else)
      const ferialBranch = getActiveEventFunc.slice(getActiveEventFunc.lastIndexOf('} else {'));
      assert.ok(
        !ferialBranch.includes("where: { tenantId, status: 'ACTIVO' }"),
        'Ferial branch must not contain blind fallback to any active event including online POS'
      );
      assert.ok(
        !ferialBranch.includes("where: { tenantId }"),
        'Ferial branch must not contain blind fallback to any event by tenantId'
      );
      assert.ok(
        getActiveEventFunc.includes("return res.json({ success: true, data: null, message: 'No hay stands feriales activos configurados.' });"),
        'Returns data: null when no ferial event is active'
      );
    });
  });

});
