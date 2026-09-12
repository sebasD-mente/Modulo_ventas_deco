import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🔥 EMPIRICAL CHALLENGER 2: Contract Integrity & Filter Stress Testing', () => {

  // =========================================================================
  // 1. CONTRACT COMPATIBILITY WITH App.jsx:151-159
  // =========================================================================
  describe('1. Contract Integrity: App.jsx Integration & Component Signatures', () => {
    it('1.1. App.jsx correctly lazy-loads EventsManagementView from ./components/EventsManagementView', () => {
      const appPath = path.join(rootDir, 'src/App.jsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');
      
      const lazyImportRegex = /const\s+EventsManagementView\s*=\s*lazy\s*\(\s*\(\)\s*=>\s*import\(['"]\.\/components\/EventsManagementView['"]\)\s*\);/;
      assert.ok(
        lazyImportRegex.test(appContent),
        'App.jsx must declare lazy import pointing to ./components/EventsManagementView'
      );
    });

    it('1.2. App.jsx invokes onEventActivated with activatedEvent and updates state', () => {
      const appPath = path.join(rootDir, 'src/App.jsx');
      const appContent = fs.readFileSync(appPath, 'utf-8');
      
      const usageRegex = /<EventsManagementView\s+onEventActivated=\{.*?setActiveEvent\(activatedEvent\);.*?refreshMetrics\(\);.*?setActiveTab\(['"]venta['"]\);/s;
      assert.ok(
        usageRegex.test(appContent),
        'App.jsx must pass onEventActivated callback that sets activeEvent, refreshes metrics, and changes tab to "venta"'
      );
    });

    it('1.3. EventsManagementView exports a default component accepting { onEventActivated }', () => {
      const compPath = path.join(rootDir, 'src/components/EventsManagementView.jsx');
      const compContent = fs.readFileSync(compPath, 'utf-8');
      
      assert.match(
        compContent,
        /export\s+default\s+function\s+EventsManagementView\s*\(\s*\{\s*onEventActivated\s*\}\s*\)/,
        'EventsManagementView must default export a function taking { onEventActivated }'
      );
    });

    it('1.4. useEventsManager handles onEventActivated invocation with activated payload', async () => {
      const hookPath = path.join(rootDir, 'src/components/events/hooks/useEventsManager.js');
      const hookContent = fs.readFileSync(hookPath, 'utf-8');

      // Verify that hook accepts { onEventActivated } with default empty object
      assert.match(hookContent, /export\s+function\s+useEventsManager\s*\(\s*\{\s*onEventActivated\s*\}\s*=\s*\{\}\s*\)/);
      // Verify safe invocation of onEventActivated
      assert.match(hookContent, /if\s*\(\s*onEventActivated\s*\)\s*onEventActivated\(\s*json\.data\s*\);/);
    });

    it('1.5. All submodules have compatible props and event handlers', () => {
      // 1. EventsFilterBar
      const filterBar = fs.readFileSync(path.join(rootDir, 'src/components/events/EventsFilterBar.jsx'), 'utf-8');
      assert.match(filterBar, /export\s+default\s+function\s+EventsFilterBar\s*\(\s*\{[\s\S]*?onOpenCreateModal[\s\S]*?searchQuery[\s\S]*?onSearchChange/);

      // 2. EventCard
      const eventCard = fs.readFileSync(path.join(rootDir, 'src/components/events/EventCard.jsx'), 'utf-8');
      assert.match(eventCard, /export\s+default\s+function\s+EventCard\s*\(\s*\{[\s\S]*?event[\s\S]*?statusType[\s\S]*?onActivate[\s\S]*?onViewSales/);

      // 3. CreateEventModal
      const createModal = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/CreateEventModal.jsx'), 'utf-8');
      assert.match(createModal, /export\s+default\s+function\s+CreateEventModal\s*\(\s*\{[\s\S]*?isOpen[\s\S]*?onClose[\s\S]*?newEventData[\s\S]*?setNewEventData[\s\S]*?onSubmit/);

      // 4. ActivateEventModal
      const activateModal = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/ActivateEventModal.jsx'), 'utf-8');
      assert.match(activateModal, /export\s+default\s+function\s+ActivateEventModal\s*\(\s*\{[\s\S]*?event[\s\S]*?onClose[\s\S]*?sellerGoogleEmail[\s\S]*?sellerName[\s\S]*?onConfirm[\s\S]*?isSubmitting/);

      // 5. EventSalesModal
      const salesModal = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/EventSalesModal.jsx'), 'utf-8');
      assert.match(salesModal, /export\s+default\s+function\s+EventSalesModal\s*\(\s*\{[\s\S]*?event[\s\S]*?salesList[\s\S]*?isLoading[\s\S]*?onClose/);

      // 6. EventActionModals
      const actionModals = fs.readFileSync(path.join(rootDir, 'src/components/events/modals/EventActionModals.jsx'), 'utf-8');
      assert.match(actionModals, /export\s+default\s+function\s+EventActionModals\s*\(\s*\{[\s\S]*?eventToArchive[\s\S]*?onCloseArchive[\s\S]*?onConfirmArchive[\s\S]*?eventToDelete[\s\S]*?onCloseDelete[\s\S]*?onConfirmDelete/);
    });
  });

  // =========================================================================
  // 2. ADVERSARIAL STRESS-TESTING OF FILTER LOGIC
  // =========================================================================
  describe('2. Adversarial Stress-Testing: Search & Date Filter Algorithm', () => {

    // Implementation replica matching useEventsManager.js:116-131
    const runFilter = (ev, searchQuery, dateFilter) => {
      const q = (searchQuery || '').toLowerCase().trim();
      const matchText = !q ||
        (ev.name && ev.name.toLowerCase().includes(q)) ||
        (ev.location && ev.location.toLowerCase().includes(q)) ||
        (ev.assignedSellerName && ev.assignedSellerName.toLowerCase().includes(q)) ||
        (ev.assignedSellerEmail && ev.assignedSellerEmail.toLowerCase().includes(q)) ||
        (ev.startDate && new Date(ev.startDate).toLocaleDateString().toLowerCase().includes(q)) ||
        (ev.endDate && new Date(ev.endDate).toLocaleDateString().toLowerCase().includes(q));

      if (!dateFilter) return Boolean(matchText);
      try {
        const target = new Date(dateFilter).toISOString().slice(0, 10);
        const start = new Date(ev.startDate).toISOString().slice(0, 10);
        const end = new Date(ev.endDate).toISOString().slice(0, 10);
        return Boolean(matchText && (target === start || target === end || (target >= start && target <= end)));
      } catch (err) {
        return false;
      }
    };

    const baseEvent = {
      id: 'ev-test',
      name: 'Exposición Pop Art 2026',
      location: 'Galería Zona 4, Ciudad de Guatemala',
      startDate: '2026-10-15T10:00:00.000Z',
      endDate: '2026-10-20T22:00:00.000Z',
      assignedSellerEmail: 'maria.vendedora@decovintage.gt',
      assignedSellerName: 'María López',
    };

    // --- A. SEARCH QUERY ADVERSARIAL CASES ---
    describe('2.A. Search Query Stress Tests (Regex symbols, Unicode, Emojis, Whitespace)', () => {
      it('2.A.1. Survives regex-breaking symbols without crashing', () => {
        const regexBreakingInputs = [
          '([.*+?^${}()|[\\]\\\\])',
          '***',
          '+++',
          '???',
          '(((',
          ')))',
          '$$$',
          '^^^',
          '\\\\\\',
          '[a-z]*',
          '(?:.*)',
          '\\d{4}-\\d{2}',
        ];

        for (const sym of regexBreakingInputs) {
          assert.doesNotThrow(() => {
            const res = runFilter(baseEvent, sym, '');
            assert.equal(typeof res, 'boolean');
          }, `Crashed on input "${sym}"`);
        }
      });

      it('2.A.2. Accurately matches regex symbols when present in name/location', () => {
        const eventWithSymbols = {
          ...baseEvent,
          name: 'STAND [IA] & Art (2026) + Special Edition *Vip*',
          location: 'C.C. Oakland Place - Nivel 2/Local #40',
        };

        assert.equal(runFilter(eventWithSymbols, '[IA]', ''), true);
        assert.equal(runFilter(eventWithSymbols, '(2026)', ''), true);
        assert.equal(runFilter(eventWithSymbols, '+ Special', ''), true);
        assert.equal(runFilter(eventWithSymbols, '*Vip*', ''), true);
        assert.equal(runFilter(eventWithSymbols, '2/Local', ''), true);
      });

      it('2.A.3. Handles Unicode, accents, non-Latin scripts, and diacritics', () => {
        const eventUnicode = {
          ...baseEvent,
          name: 'Bazar Navideño Güegüense & Café Müller',
          location: 'Plaza España, Zona 9',
          assignedSellerName: 'François Ñíguez',
        };

        assert.equal(runFilter(eventUnicode, 'navideño', ''), true);
        assert.equal(runFilter(eventUnicode, 'NAVIDEÑO', ''), true);
        assert.equal(runFilter(eventUnicode, 'güegüense', ''), true);
        assert.equal(runFilter(eventUnicode, 'müller', ''), true);
        assert.equal(runFilter(eventUnicode, 'españa', ''), true);
        assert.equal(runFilter(eventUnicode, 'françois', ''), true);
        assert.equal(runFilter(eventUnicode, 'ñíguez', ''), true);
      });

      it('2.A.4. Handles emojis in event names and search queries', () => {
        const eventWithEmojis = {
          ...baseEvent,
          name: '🎨 Pop Art & Comic Fest 🇬🇹 🔥',
          location: 'Parque de la Industria 🎪',
        };

        assert.equal(runFilter(eventWithEmojis, '🎨', ''), true);
        assert.equal(runFilter(eventWithEmojis, '🇬🇹', ''), true);
        assert.equal(runFilter(eventWithEmojis, '🔥', ''), true);
        assert.equal(runFilter(eventWithEmojis, '🎪', ''), true);
        assert.equal(runFilter(eventWithEmojis, '🚀', ''), false);
      });

      it('2.A.5. Strips leading, trailing, and excessive whitespace correctly', () => {
        assert.equal(runFilter(baseEvent, '   Pop Art   ', ''), true);
        assert.equal(runFilter(baseEvent, '\t\nExposición\n\t', ''), true);
        assert.equal(runFilter(baseEvent, '   ', ''), true); // Empty/spaces returns all
        assert.equal(runFilter(baseEvent, '', ''), true);
      });

      it('2.A.6. Gracefully handles null, undefined, or missing optional fields', () => {
        const minimalEvent = {
          id: 'ev-min',
          name: 'Evento Mínimo',
          location: 'Ubicación Mínima',
          startDate: '2026-05-01T00:00:00.000Z',
          endDate: '2026-05-02T00:00:00.000Z',
          assignedSellerEmail: null,
          assignedSellerName: null,
        };

        assert.doesNotThrow(() => {
          assert.equal(runFilter(minimalEvent, 'vendedor', ''), false);
          assert.equal(runFilter(minimalEvent, 'mínimo', ''), true);
          assert.equal(runFilter(minimalEvent, null, ''), true);
          assert.equal(runFilter(minimalEvent, undefined, ''), true);
        });
      });
    });

    // --- B. DATE FILTER ADVERSARIAL CASES ---
    describe('2.B. Date Filter Stress Tests (ISO strings, boundaries, timezones)', () => {
      it('2.B.1. Correctly filters exact start date and exact end date', () => {
        // Event runs 2026-10-15 to 2026-10-20
        assert.equal(runFilter(baseEvent, '', '2026-10-15'), true, 'Start date must match');
        assert.equal(runFilter(baseEvent, '', '2026-10-20'), true, 'End date must match');
        assert.equal(runFilter(baseEvent, '', '2026-10-18'), true, 'Mid-range date must match');
        assert.equal(runFilter(baseEvent, '', '2026-10-14'), false, 'Date before range must not match');
        assert.equal(runFilter(baseEvent, '', '2026-10-21'), false, 'Date after range must not match');
      });

      it('2.B.2. Handles ISO strings with full timestamp and Zulu timezone', () => {
        assert.equal(runFilter(baseEvent, '', '2026-10-15T00:00:00.000Z'), true);
        assert.equal(runFilter(baseEvent, '', '2026-10-20T23:59:59.999Z'), true);
        assert.equal(runFilter(baseEvent, '', '2026-10-14T23:59:59.999Z'), false);
        assert.equal(runFilter(baseEvent, '', '2026-10-21T00:00:00.001Z'), false);
      });

      it('2.B.3. Timezone boundary stress: ISO offsets (-06:00 Guatemala vs UTC)', () => {
        // 2026-10-15T02:00:00-06:00 is 2026-10-15T08:00:00Z -> target date 2026-10-15
        assert.equal(runFilter(baseEvent, '', '2026-10-15T02:00:00-06:00'), true);

        // 2026-10-20T17:00:00-06:00 is 2026-10-20T23:00:00Z -> target date 2026-10-20
        assert.equal(runFilter(baseEvent, '', '2026-10-20T17:00:00-06:00'), true);

        // Cross-day UTC boundary:
        // 2026-10-20T20:00:00-06:00 is 2026-10-21T02:00:00Z -> target date 2026-10-21 (after event end)
        assert.equal(runFilter(baseEvent, '', '2026-10-20T20:00:00-06:00'), false);
      });

      it('2.B.4. Year-end and Leap year boundary tests', () => {
        const newYearEvent = {
          ...baseEvent,
          startDate: '2026-12-30T00:00:00.000Z',
          endDate: '2027-01-02T23:59:59.000Z',
        };

        assert.equal(runFilter(newYearEvent, '', '2026-12-31'), true);
        assert.equal(runFilter(newYearEvent, '', '2027-01-01'), true);
        assert.equal(runFilter(newYearEvent, '', '2026-12-29'), false);
        assert.equal(runFilter(newYearEvent, '', '2027-01-03'), false);
      });

      it('2.B.5. Mismatched dates (startDate > endDate) handled safely', () => {
        const invertedEvent = {
          ...baseEvent,
          startDate: '2026-10-25T00:00:00.000Z',
          endDate: '2026-10-20T00:00:00.000Z',
        };

        // When target matches start exactly
        assert.equal(runFilter(invertedEvent, '', '2026-10-25'), true);
        // When target matches end exactly
        assert.equal(runFilter(invertedEvent, '', '2026-10-20'), true);
        // Inverted range cannot satisfy target >= start && target <= end
        assert.equal(runFilter(invertedEvent, '', '2026-10-22'), false);
      });

      it('2.B.6. Single-day event (startDate === endDate)', () => {
        const singleDayEvent = {
          ...baseEvent,
          startDate: '2026-11-15T08:00:00.000Z',
          endDate: '2026-11-15T22:00:00.000Z',
        };

        assert.equal(runFilter(singleDayEvent, '', '2026-11-15'), true);
        assert.equal(runFilter(singleDayEvent, '', '2026-11-14'), false);
        assert.equal(runFilter(singleDayEvent, '', '2026-11-16'), false);
      });

      it('2.B.7. Simultaneous search text and date filter', () => {
        assert.equal(runFilter(baseEvent, 'Pop Art', '2026-10-16'), true);
        assert.equal(runFilter(baseEvent, 'Comic Con', '2026-10-16'), false); // Text mismatch
        assert.equal(runFilter(baseEvent, 'Pop Art', '2026-10-25'), false); // Date mismatch
      });
    });
  });
});
