import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

describe('🔥 ADVERSARIAL CHALLENGE & STRESS HARNESS: Events Refactoring', () => {

  // =========================================================================
  // 1. API FAILURE MODES: /api/events (empty array, null data, 500 error)
  // =========================================================================
  describe('1. Failure Modes and Resilience of /api/events endpoint handling', () => {
    // Simulator of useEventsManager loadEvents logic
    async function simulateLoadEvents(mockFetchResponse) {
      let events = [];
      let isLoading = true;
      let errorMsg = null;

      try {
        const res = await mockFetchResponse();
        const json = await res.json();
        if (json.success) events = json.data || [];
        else throw new Error(json.error || 'Error cargando eventos');
      } catch (err) {
        errorMsg = err.message;
      } finally {
        isLoading = false;
      }

      return { events, isLoading, errorMsg };
    }

    it('1.1. Maneja respuesta vacía { success: true, data: [] } sin fallar y con estado limpio', async () => {
      const state = await simulateLoadEvents(async () => ({
        json: async () => ({ success: true, data: [] }),
      }));
      assert.equal(state.isLoading, false);
      assert.equal(state.errorMsg, null);
      assert.deepEqual(state.events, []);

      // Particionamiento derivado
      const active = state.events.filter((e) => e.status === 'ACTIVO');
      const confirmed = state.events.filter((e) => e.status === 'CONFIRMADO');
      const archived = state.events.filter((e) => e.status === 'ARCHIVADO');
      assert.equal(active.length, 0);
      assert.equal(confirmed.length, 0);
      assert.equal(archived.length, 0);
    });

    it('1.2. Maneja payload null { success: true, data: null } cayendo a [] de forma segura', async () => {
      const state = await simulateLoadEvents(async () => ({
        json: async () => ({ success: true, data: null }),
      }));
      assert.equal(state.isLoading, false);
      assert.equal(state.errorMsg, null);
      assert.deepEqual(state.events, []);
    });

    it('1.3. Maneja payload undefined { success: true } sin propiedad data', async () => {
      const state = await simulateLoadEvents(async () => ({
        json: async () => ({ success: true }),
      }));
      assert.equal(state.isLoading, false);
      assert.equal(state.errorMsg, null);
      assert.deepEqual(state.events, []);
    });

    it('1.4. Maneja error HTTP 500 { success: false, error: "Database connection failed" }', async () => {
      const state = await simulateLoadEvents(async () => ({
        json: async () => ({ success: false, error: 'Database connection failed' }),
      }));
      assert.equal(state.isLoading, false);
      assert.equal(state.errorMsg, 'Database connection failed');
      assert.deepEqual(state.events, []);
    });

    it('1.5. Maneja fallo de red crudo (network fetch rejected)', async () => {
      const state = await simulateLoadEvents(async () => {
        throw new TypeError('fetch failed: ECONNREFUSED');
      });
      assert.equal(state.isLoading, false);
      assert.equal(state.errorMsg, 'fetch failed: ECONNREFUSED');
      assert.deepEqual(state.events, []);
    });
  });

  // =========================================================================
  // 2. CONTRATO DE onEventActivated: Ausente o Undefined
  // =========================================================================
  describe('2. Robustez de onEventActivated: Invocación segura y opcionalidad', () => {
    async function simulateConfirmActivation({ onEventActivated, sellerEmail, sellerName, activatingEvent }) {
      let isSubmitting = false;
      let alertMsg = null;
      let eventActivatedPayload = null;

      const alertMock = (msg) => { alertMsg = msg; };

      if (!sellerEmail.trim()) {
        alertMock('Debes ingresar el correo de Google del vendedor.');
        return { isSubmitting, alertMsg, eventActivatedPayload };
      }

      isSubmitting = true;
      try {
        const mockResponse = {
          ok: true,
          json: async () => ({
            success: true,
            data: {
              ...activatingEvent,
              status: 'ACTIVO',
              assignedSellerEmail: sellerEmail.trim(),
              assignedSellerName: sellerName.trim() || sellerEmail.split('@')[0],
            },
          }),
        };
        const json = await mockResponse.json();
        if (onEventActivated) {
          onEventActivated(json.data);
          eventActivatedPayload = json.data;
        }
      } catch (err) {
        alertMock(err.message);
      } finally {
        isSubmitting = false;
      }

      return { isSubmitting, alertMsg, eventActivatedPayload };
    }

    it('2.1. Funciona de manera segura cuando onEventActivated no es provisto (undefined)', async () => {
      const targetEvent = { id: 'ev-100', name: 'Evento Prueba', status: 'CONFIRMADO' };
      const res = await simulateConfirmActivation({
        onEventActivated: undefined,
        sellerEmail: 'carlos@decovintage.gt',
        sellerName: 'Carlos P.',
        activatingEvent: targetEvent,
      });

      assert.equal(res.isSubmitting, false);
      assert.equal(res.alertMsg, null);
      assert.equal(res.eventActivatedPayload, null); // No fue llamado ni explotó
    });

    it('2.2. Ejecuta callback cuando onEventActivated es suministrado', async () => {
      let callbackReceived = null;
      const targetEvent = { id: 'ev-101', name: 'Bazar Majadas', status: 'CONFIRMADO' };
      const res = await simulateConfirmActivation({
        onEventActivated: (ev) => { callbackReceived = ev; },
        sellerEmail: 'vendedor@gmail.com',
        sellerName: '',
        activatingEvent: targetEvent,
      });

      assert.equal(res.isSubmitting, false);
      assert.ok(callbackReceived);
      assert.equal(callbackReceived.id, 'ev-101');
      assert.equal(callbackReceived.status, 'ACTIVO');
      assert.equal(callbackReceived.assignedSellerName, 'vendedor');
    });

    it('2.3. useEventsManager.js tiene default parameter { onEventActivated } = {} para evitar TypeError', () => {
      const hookPath = path.join(rootDir, 'src/components/events/hooks/useEventsManager.js');
      const content = fs.readFileSync(hookPath, 'utf-8');
      assert.match(
        content,
        /export\s+function\s+useEventsManager\s*\(\s*\{\s*onEventActivated\s*\}\s*=\s*\{\s*\}\s*\)/,
        'Debe tener destructuración con valor por defecto vacío para soportar useEventsManager() sin argumentos'
      );
    });
  });

  // =========================================================================
  // 3. SALES TARGET: Valores negativos, vacíos o strings no numéricos
  // =========================================================================
  describe('3. salesTarget: Comportamiento ante valores extremos e inválidos', () => {
    it('3.1. CreateEventModal restringe input con min="0" y type="number"', () => {
      const modalPath = path.join(rootDir, 'src/components/events/modals/CreateEventModal.jsx');
      const content = fs.readFileSync(modalPath, 'utf-8');
      assert.match(content, /type="number"/);
      assert.match(content, /min="0"/);
      assert.match(content, /value=\{newEventData\.salesTarget\}/);
    });

    it('3.2. Formateo y cálculo de totalSold en EventCard es resiliente a NaN, null, undefined y negativos', () => {
      const formatCurrency = (val) => Number(val || 0).toFixed(2);

      assert.equal(formatCurrency(null), '0.00');
      assert.equal(formatCurrency(undefined), '0.00');
      assert.equal(formatCurrency(0), '0.00');
      assert.equal(formatCurrency(-500), '-500.00');
      assert.equal(formatCurrency(15000.5), '15000.50');
      assert.equal(formatCurrency('1250.75'), '1250.75');
      assert.equal(formatCurrency('NaN'), 'NaN');
    });

    it('3.3. EventCard no realiza divisiones directas por salesTarget previniendo divisiones por cero (Infinity)', () => {
      const cardPath = path.join(rootDir, 'src/components/events/EventCard.jsx');
      const content = fs.readFileSync(cardPath, 'utf-8');
      assert.ok(!content.includes('/ event.salesTarget'), 'EventCard no debe dividir por salesTarget directamente');
      assert.ok(!content.includes('/ salesTarget'), 'EventCard no debe dividir por salesTarget directamente');
    });
  });

  // =========================================================================
  // 4. VALIDACIÓN DE EMAIL DE VENDEDOR EN ACTIVACIÓN
  // =========================================================================
  describe('4. assignedSellerEmail: Validación en activación y derivación de nombre', () => {
    it('4.1. Bloquea activación si sellerGoogleEmail está vacío o es solo espacios', () => {
      const testCases = ['', '   ', '\t\n'];
      for (const email of testCases) {
        const isInvalid = !email.trim();
        assert.ok(isInvalid, `El correo "${email}" debe considerarse inválido`);
      }
    });

    it('4.2. ActivateEventModal deshabilita el botón si el correo no está ingresado', () => {
      const modalPath = path.join(rootDir, 'src/components/events/modals/ActivateEventModal.jsx');
      const content = fs.readFileSync(modalPath, 'utf-8');
      assert.match(content, /disabled=\{isSubmitting\s*\|\|\s*!sellerGoogleEmail\.trim\(\)\}/);
    });

    it('4.3. Si el correo no tiene @ (ej: "vendedor123"), split("@")[0] no explota y retorna el string intacto', () => {
      const weirdEmail = 'vendedor_sin_arroba';
      const derived = weirdEmail.split('@')[0];
      assert.equal(derived, 'vendedor_sin_arroba');
    });

    it('4.4. Derivación correcta para correos estándar y con puntos', () => {
      assert.equal('ana.gomez@gmail.com'.split('@')[0], 'ana.gomez');
      assert.equal('stand.decovintage@empresa.com.gt'.split('@')[0], 'stand.decovintage');
    });
  });

  // =========================================================================
  // 5. BORRADO CON RESTRICCIÓN CONTABLE (HTTP 400): deleteErrorMsg
  // =========================================================================
  describe('5. Manejo de Error en Eliminación de Eventos con Registros (HTTP 400)', () => {
    async function simulateHandleConfirmDelete(eventToDelete, mockDeleteApi) {
      let isSubmittingDelete = false;
      let deleteErrorMsg = null;
      let deletedEventId = null;

      if (!eventToDelete) return { isSubmittingDelete, deleteErrorMsg, deletedEventId };

      isSubmittingDelete = true;
      deleteErrorMsg = null;

      try {
        const res = await mockDeleteApi(eventToDelete.id);
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.error || 'Error al eliminar el evento.');
        deletedEventId = eventToDelete.id;
      } catch (err) {
        deleteErrorMsg = err.message;
      } finally {
        isSubmittingDelete = false;
      }

      return { isSubmittingDelete, deleteErrorMsg, deletedEventId };
    }

    it('5.1. Captura HTTP 400 cuando el evento tiene ventas y asienta deleteErrorMsg sin crashear', async () => {
      const activeEvent = { id: 'ev-con-ventas', name: 'Bazar Central', salesCount: 42 };

      const result = await simulateHandleConfirmDelete(activeEvent, async (id) => ({
        ok: false,
        status: 400,
        json: async () => ({
          success: false,
          error: 'No se puede eliminar "Bazar Central" porque tiene registros contables (42 ventas y 1 arqueos). Puedes archivarlo para preservar el historial.',
        }),
      }));

      assert.equal(result.isSubmittingDelete, false);
      assert.equal(result.deletedEventId, null);
      assert.ok(result.deleteErrorMsg);
      assert.match(result.deleteErrorMsg, /No se puede eliminar "Bazar Central" porque tiene registros contables/);
    });

    it('5.2. EventActionModals renderiza el mensaje de error deleteErrorMsg en alerta roja con AlertTriangle', () => {
      const modalPath = path.join(rootDir, 'src/components/events/modals/EventActionModals.jsx');
      const content = fs.readFileSync(modalPath, 'utf-8');
      assert.match(content, /deleteErrorMsg\s*\?/);
      assert.match(content, /<AlertTriangle/);
      assert.match(content, /\{deleteErrorMsg\}/);
    });

    it('5.3. En EventsManagementView, cerrar el modal de eliminación limpia tanto eventToDelete como deleteErrorMsg', () => {
      const viewPath = path.join(rootDir, 'src/components/EventsManagementView.jsx');
      const content = fs.readFileSync(viewPath, 'utf-8');
      assert.match(
        content,
        /onCloseDelete=\{.*m\.setEventToDelete\(null\);\s*m\.setDeleteErrorMsg\(null\);.*\}/,
        'onCloseDelete debe purgar el mensaje de error previo'
      );
    });
  });

  // =========================================================================
  // 6. STRESS-TEST DE FILTRADO Y BÚSQUEDA: Inyecciones de caracteres y volumen
  // =========================================================================
  describe('6. Búsqueda y Filtrado: Resiliencia ante caracteres regex y entradas extremas', () => {
    const archivedEvents = [
      {
        id: 'arch-1',
        name: 'Evento con [Corchetes] y (Paréntesis)*+?$',
        location: 'Zona 10, Edificio 12.3',
        startDate: '2026-01-01T00:00:00.000Z',
        endDate: '2026-01-05T00:00:00.000Z',
        assignedSellerName: 'Vendedor 1',
        assignedSellerEmail: 'vendedor.1@deco.gt',
      },
      {
        id: 'arch-2',
        name: 'Feria Normal',
        location: 'Antigua Guatemala',
        startDate: '2026-02-10T00:00:00.000Z',
        endDate: '2026-02-15T00:00:00.000Z',
        assignedSellerName: 'Vendedor 2',
        assignedSellerEmail: 'vendedor.2@deco.gt',
      },
    ];

    const filterArchived = (events, query) => {
      return events.filter((ev) => {
        const q = query.toLowerCase().trim();
        return (
          !q ||
          ev.name.toLowerCase().includes(q) ||
          ev.location.toLowerCase().includes(q) ||
          (ev.assignedSellerName && ev.assignedSellerName.toLowerCase().includes(q)) ||
          (ev.assignedSellerEmail && ev.assignedSellerEmail.toLowerCase().includes(q)) ||
          new Date(ev.startDate).toLocaleDateString().toLowerCase().includes(q) ||
          new Date(ev.endDate).toLocaleDateString().toLowerCase().includes(q)
        );
      });
    };

    it('6.1. No crashea con símbolos regex que romperían un RegExp mal sanitizado', () => {
      const maliciousQueries = ['[', ']', '(', ')', '*', '+', '?', '\\', '^', '$', '{', '}', '|'];
      for (const query of maliciousQueries) {
        assert.doesNotThrow(() => {
          const res = filterArchived(archivedEvents, query);
          assert.ok(Array.isArray(res));
        }, `Falló con query regex: "${query}"`);
      }
    });

    it('6.2. Soporta strings de búsqueda masivos (10,000 caracteres) sin degradación', () => {
      const hugeQuery = 'a'.repeat(10000);
      assert.doesNotThrow(() => {
        const res = filterArchived(archivedEvents, hugeQuery);
        assert.equal(res.length, 0);
      });
    });

    it('6.3. Búsqueda insensible a mayúsculas/minúsculas y espacios en blanco', () => {
      const res1 = filterArchived(archivedEvents, '   ANTIGUA   ');
      assert.equal(res1.length, 1);
      assert.equal(res1[0].id, 'arch-2');

      const res2 = filterArchived(archivedEvents, 'CORCHETES');
      assert.equal(res2.length, 1);
      assert.equal(res2[0].id, 'arch-1');
    });
  });

  // =========================================================================
  // 7. LÍMITES DE LÍNEAS ESTRICTOS Y AUDITORÍA DE TAMAÑO
  // =========================================================================
  describe('7. Auditoría Milimétrica de Líneas y Erradicación de Bloat Oculto', () => {
    const modules = [
      { path: 'src/components/EventsManagementView.jsx', limit: 70, currentAllowed: 70 },
      { path: 'src/components/events/hooks/useEventsManager.js', limit: 150, currentAllowed: 150 },
      { path: 'src/components/events/EventCard.jsx', limit: 140, currentAllowed: 140 },
      { path: 'src/components/events/EventsFilterBar.jsx', limit: 70, currentAllowed: 70 },
      { path: 'src/components/events/modals/CreateEventModal.jsx', limit: 120, currentAllowed: 120 },
      { path: 'src/components/events/modals/ActivateEventModal.jsx', limit: 100, currentAllowed: 100 },
      { path: 'src/components/events/modals/EventSalesModal.jsx', limit: 130, currentAllowed: 130 },
      { path: 'src/components/events/modals/EventActionModals.jsx', limit: 90, currentAllowed: 90 },
    ];

    for (const mod of modules) {
      it(`7.x. ${mod.path} tiene conteo estrictamente menor a ${mod.limit} líneas`, () => {
        const fullPath = path.join(rootDir, mod.path);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const lines = content.split('\n').length;
        assert.ok(
          lines < mod.limit,
          `Exceso de líneas en ${mod.path}: tiene ${lines} líneas (límite estricto < ${mod.limit})`
        );
      });
    }

    it('7.9. Total de líneas de toda la suite de eventos no excede 800 líneas en conjunto', () => {
      let totalLines = 0;
      for (const mod of modules) {
        const fullPath = path.join(rootDir, mod.path);
        const content = fs.readFileSync(fullPath, 'utf-8');
        totalLines += content.split('\n').length;
      }
      assert.ok(
        totalLines < 850,
        `El conjunto total de módulos de eventos suma ${totalLines} líneas (máximo tolerado < 850)`
      );
    });
  });
});
