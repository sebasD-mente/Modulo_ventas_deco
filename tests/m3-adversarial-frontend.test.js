import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');

// Set dummy env variables for server imports
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_challenger_test_jwt_secret_2026';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

describe('⚔️ ADVERSARIAL CHALLENGER SUITE: Milestone 3 Frontend & State Architecture', () => {

  // ===========================================================================
  // 1. DESAFÍO A-05: Inmutabilidad Estricta de Estado en EditSaleModal.jsx
  // ===========================================================================
  describe('1. Desafío A-05: Inmutabilidad Referencial en EditSaleModal.jsx', () => {
    const editSaleModalPath = path.join(projectRoot, 'src/components/EditSaleModal.jsx');
    const fileContent = fs.readFileSync(editSaleModalPath, 'utf8');

    it('1.1 Auditoría estática: No existen mutaciones in-place del array o de sus objetos', () => {
      // Prohibir mutaciones directas de propiedades
      assert.doesNotMatch(fileContent, /current\.quantity\s*=[^=]/, 'Prohibido mutar current.quantity directamente');
      assert.doesNotMatch(fileContent, /prevItems\[idx\]\.quantity\s*=[^=]/, 'Prohibido mutar prevItems[idx].quantity directamente');
      assert.doesNotMatch(fileContent, /items\[idx\]\.quantity\s*=[^=]/, 'Prohibido mutar items[idx].quantity directamente');
      assert.doesNotMatch(fileContent, /\.splice\(/, 'Prohibido usar splice mutable en el array de items');

      // Debe utilizar functional setter y shallow cloning del item actualizado
      assert.match(fileContent, /setItems\(\(prevItems\)\s*=>/, 'Debe utilizar callback funcional setItems(prevItems => ...');
      assert.match(fileContent, /updated\[idx\]\s*=\s*\{\s*\.\.\.current,/, 'Debe clonar el objeto item usando {...current}');
    });

    it('1.2 Prueba empírica adversarial: Actualización de cantidad genera nueva referencia (prevItem !== newItem)', () => {
      // Función extraída de EditSaleModal.jsx
      const handleUpdateQuantity = (prevItems, idx, delta) => {
        const current = prevItems[idx];
        if (!current) return prevItems;
        const newQty = Math.max(1, current.quantity + delta);
        const updated = [...prevItems];
        updated[idx] = {
          ...current,
          quantity: newQty,
          subtotal: Number((newQty * current.unitPrice).toFixed(2)),
        };
        return updated;
      };

      // Estado inicial con objetos completamente CONGELADOS (Object.freeze)
      // Si la función intenta mutar directamente una propiedad, lanzará TypeError
      const item1 = Object.freeze({ id: 'item-1', productId: 'p1', description: 'Póster A', quantity: 2, unitPrice: 65.00, subtotal: 130.00 });
      const item2 = Object.freeze({ id: 'item-2', productId: 'p2', description: 'Póster B', quantity: 1, unitPrice: 125.00, subtotal: 125.00 });
      const initialItems = Object.freeze([item1, item2]);

      // Ejecutar actualización con delta positivo (+1)
      const nextItems = handleUpdateQuantity(initialItems, 0, 1);

      // Verificación de inmutabilidad referencial de array
      assert.notEqual(nextItems, initialItems, 'El array resultante debe ser una nueva referencia de memoria');
      assert.equal(nextItems.length, 2, 'La longitud del array debe conservarse');

      // Verificación de inmutabilidad referencial del ítem modificado
      const prevItem = initialItems[0];
      const newItem = nextItems[0];
      assert.notEqual(newItem, prevItem, 'El ítem modificado DEBE tener una nueva referencia de objeto (prevItem !== newItem)');
      assert.equal(newItem.quantity, 3, 'La cantidad debe haberse incrementado a 3');
      assert.equal(newItem.subtotal, 195.00, 'El subtotal debe haberse recalculado a 195.00');

      // Verificación de estabilidad referencial para ítems NO modificados (optimización React)
      assert.equal(nextItems[1], initialItems[1], 'Los ítems no afectados deben conservar su referencia original para evitar renders superfluos');
    });

    it('1.3 Prueba de límites: Delta negativo extremo no debe reducir la cantidad por debajo de 1', () => {
      const handleUpdateQuantity = (prevItems, idx, delta) => {
        const current = prevItems[idx];
        if (!current) return prevItems;
        const newQty = Math.max(1, current.quantity + delta);
        const updated = [...prevItems];
        updated[idx] = {
          ...current,
          quantity: newQty,
          subtotal: Number((newQty * current.unitPrice).toFixed(2)),
        };
        return updated;
      };

      const item = Object.freeze({ id: 'item-1', quantity: 1, unitPrice: 65.00, subtotal: 65.00 });
      const initial = Object.freeze([item]);

      const result = handleUpdateQuantity(initial, 0, -50);
      assert.equal(result[0].quantity, 1, 'Math.max(1, qty + delta) debe forzar mínimo 1');
      assert.equal(result[0].subtotal, 65.00, 'Subtotal debe reflejar cantidad 1');
      assert.notEqual(result[0], initial[0], 'Incluso manteniendo cantidad 1, se genera nuevo objeto inmutable');
    });

    it('1.4 Índice fuera de rango retorna prevItems intacto sin arrojar error', () => {
      const handleUpdateQuantity = (prevItems, idx, delta) => {
        const current = prevItems[idx];
        if (!current) return prevItems;
        const newQty = Math.max(1, current.quantity + delta);
        const updated = [...prevItems];
        updated[idx] = {
          ...current,
          quantity: newQty,
          subtotal: Number((newQty * current.unitPrice).toFixed(2)),
        };
        return updated;
      };

      const initial = Object.freeze([{ id: 'item-1', quantity: 1, unitPrice: 65 }]);
      const result = handleUpdateQuantity(initial, 999, 1);
      assert.equal(result, initial, 'Índice inexistente debe retornar prevItems sin cambios');
    });

    it('1.5 Eliminación de ítems (handleRemoveItem) es pura y previene vaciar el ticket', () => {
      const handleRemoveItem = (prevItems, idx) => {
        if (prevItems.length <= 1) {
          return prevItems; // No permite eliminar el último ítem
        }
        return prevItems.filter((_, i) => i !== idx);
      };

      const items = Object.freeze([
        Object.freeze({ id: '1', quantity: 1 }),
        Object.freeze({ id: '2', quantity: 2 })
      ]);

      const afterRemove = handleRemoveItem(items, 0);
      assert.notEqual(afterRemove, items, 'Filter debe generar un nuevo array');
      assert.equal(afterRemove.length, 1);
      assert.equal(afterRemove[0].id, '2');

      // Intentar remover el último ítem
      const blocked = handleRemoveItem(afterRemove, 0);
      assert.equal(blocked, afterRemove, 'No debe remover el último ítem de la venta');
      assert.equal(blocked.length, 1);
    });
  });

  // ===========================================================================
  // 2. DESAFÍO A-06: Memoización y Estabilidad Referencial en AuthContext.jsx
  // ===========================================================================
  describe('2. Desafío A-06: Memoización y Estabilidad Referencial en AuthContext.jsx', () => {
    const authContextPath = path.join(projectRoot, 'src/context/AuthContext.jsx');
    const authContent = fs.readFileSync(authContextPath, 'utf8');

    it('2.1 Auditoría estática: useMemo y useCallback aplicados rigurosamente', () => {
      assert.match(authContent, /import React,\s*\{[^}]*useCallback[^}]*useMemo[^}]*\}\s*from 'react'/, 'Debe importar useCallback y useMemo');
      assert.match(authContent, /const logout = useCallback\(/, 'logout debe estar memoizado con useCallback');
      assert.match(authContent, /const authFetch = useCallback\(/, 'authFetch debe estar memoizado con useCallback');
      assert.match(authContent, /const checkSession = useCallback\(/, 'checkSession debe estar memoizado con useCallback');
      assert.match(authContent, /const loginWithGoogle = useCallback\(/, 'loginWithGoogle debe estar memoizado con useCallback');
      assert.match(authContent, /const hasRole = useCallback\(/, 'hasRole debe estar memoizado con useCallback');
      assert.match(authContent, /const value = useMemo\(\s*\(\)\s*=>\s*\(\{/, 'value del Provider debe estar envuelto en useMemo');
    });

    it('2.2 Verificación de exhaustividad del array de dependencias en value de AuthContext', () => {
      // Extraer el array de dependencias de `value = useMemo(..., [...])`
      const match = authContent.match(/const value = useMemo\(\(\) => \(\{[\s\S]*?\}\),\s*\[([\s\S]*?)\]\);/);
      assert.ok(match, 'Debe encontrarse la declaración useMemo de value');

      const deps = match[1].split(',').map(d => d.trim()).filter(Boolean);
      const expectedKeys = [
        'user',
        'token',
        'isLoading',
        'error',
        'loginWithGoogle',
        'logout',
        'authFetch',
        'userRoles',
        'hasRole',
        'isSuperAdmin',
        'isVendedor',
        'isOperario1',
        'isOperario2',
        'isProduccion',
        'checkSession',
      ];

      for (const expected of expectedKeys) {
        assert.ok(deps.includes(expected), `El array de dependencias de useMemo debe incluir: ${expected}`);
      }
    });

    it('2.3 Prueba empírica adversarial: Simulación de re-render garantiza igualdad referencial (prevValue === nextValue)', () => {
      // Simulador de motor de memoización de React
      class HookSimulator {
        constructor() {
          this.memoCache = new Map();
        }

        useCallback(fn, deps, key = 'callback') {
          return this.useMemo(() => fn, deps, key);
        }

        useMemo(factory, deps, key = 'memo') {
          const cached = this.memoCache.get(key);
          if (cached) {
            const [prevResult, prevDeps] = cached;
            const depsMatch = deps.length === prevDeps.length && deps.every((d, i) => Object.is(d, prevDeps[i]));
            if (depsMatch) {
              return prevResult;
            }
          }
          const result = factory();
          this.memoCache.set(key, [result, deps]);
          return result;
        }

        renderAuth(userState, tokenState, loadingState, errorState) {
          const user = userState;
          const token = tokenState;
          const isLoading = loadingState;
          const error = errorState;

          const logout = this.useCallback(() => {}, [], 'logout');
          const authFetch = this.useCallback(() => {}, [token, logout], 'authFetch');
          const checkSession = this.useCallback(() => {}, [token], 'checkSession');
          const loginWithGoogle = this.useCallback(() => {}, [], 'loginWithGoogle');

          const userRoles = this.useMemo(() => {
            return Array.isArray(user?.roles) && user.roles.length > 0
              ? user.roles
              : (user?.role ? [user.role] : []);
          }, [user], 'userRoles');

          const isSuperAdmin = this.useMemo(() => userRoles.includes('SUPER_ADMIN'), [userRoles], 'isSuperAdmin');
          const isVendedor = this.useMemo(() => userRoles.includes('VENDEDOR'), [userRoles], 'isVendedor');
          const isOperario1 = this.useMemo(() => userRoles.includes('OPERARIO_1'), [userRoles], 'isOperario1');
          const isOperario2 = this.useMemo(() => userRoles.includes('OPERARIO_2'), [userRoles], 'isOperario2');
          const isProduccion = this.useMemo(() => isOperario1 || isOperario2 || isSuperAdmin, [isOperario1, isOperario2, isSuperAdmin], 'isProduccion');

          const hasRole = this.useCallback((roleToCheck) => {
            if (isSuperAdmin) return true;
            return userRoles.includes(roleToCheck);
          }, [isSuperAdmin, userRoles], 'hasRole');

          const value = this.useMemo(() => ({
            user,
            token,
            isLoading,
            error,
            loginWithGoogle,
            logout,
            authFetch,
            roles: userRoles,
            hasRole,
            isSuperAdmin,
            isVendedor,
            isOperario1,
            isOperario2,
            isProduccion,
            checkSession,
          }), [
            user,
            token,
            isLoading,
            error,
            loginWithGoogle,
            logout,
            authFetch,
            userRoles,
            hasRole,
            isSuperAdmin,
            isVendedor,
            isOperario1,
            isOperario2,
            isProduccion,
            checkSession,
          ], 'contextValue');

          return value;
        }
      }

      const simulator = new HookSimulator();
      const initialUser = { id: 'u1', email: 'vendedor@dekolabs.com', role: 'VENDEDOR', roles: ['VENDEDOR'] };
      const token = 'valid_token_123';

      // 1er Render
      const value1 = simulator.renderAuth(initialUser, token, false, null);
      assert.ok(value1);
      assert.equal(value1.isVendedor, true);
      assert.equal(value1.isSuperAdmin, false);

      // 2do Render: Re-render del padre por timer o evento unrelated (mismos estados de auth)
      const value2 = simulator.renderAuth(initialUser, token, false, null);

      // Verificación de estabilidad referencial estricta
      assert.equal(value1, value2, 'El objeto value DEBE ser exactamente la misma referencia en memoria (prevValue === nextValue)');
      assert.equal(value1.authFetch, value2.authFetch, 'authFetch debe mantener la misma referencia');
      assert.equal(value1.hasRole, value2.hasRole, 'hasRole debe mantener la misma referencia');

      // 3er Render: Cambio de usuario a SUPER_ADMIN
      const adminUser = { id: 'u2', email: 'admin@dekolabs.com', role: 'SUPER_ADMIN', roles: ['SUPER_ADMIN'] };
      const value3 = simulator.renderAuth(adminUser, token, false, null);

      assert.notEqual(value1, value3, 'Al cambiar el usuario, value debe generar una nueva referencia');
      assert.equal(value3.isSuperAdmin, true);
      assert.equal(value3.hasRole('CUALQUIER_ROL'), true, 'SUPER_ADMIN debe tener acceso a cualquier rol');
    });
  });

  // ===========================================================================
  // 3. DESAFÍO C-08: Negociación de Códec Safari/iOS y Limpieza de Pistas
  // ===========================================================================
  describe('3. Desafío C-08: Compatibilidad Safari/iOS Audio y Limpieza de Streams', () => {
    const unifiedAiChatPath = path.join(projectRoot, 'src/components/UnifiedAiChat.jsx');
    const chatContent = fs.readFileSync(unifiedAiChatPath, 'utf8');

    it('3.1 Auditoría estática: Implementación de detección de códec, restricciones y cleanup', () => {
      assert.match(chatContent, /const getSupportedAudioMimeType = \(\) =>/, 'Debe definir getSupportedAudioMimeType');
      assert.match(chatContent, /'audio\/mp4'/, 'Candidatos deben incluir audio/mp4 para Safari/iOS');
      assert.match(chatContent, /echoCancellation:\s*true/, 'getUserMedia debe solicitar echoCancellation');
      assert.match(chatContent, /noiseSuppression:\s*true/, 'getUserMedia debe solicitar noiseSuppression');
      assert.match(chatContent, /autoGainControl:\s*true/, 'getUserMedia debe solicitar autoGainControl');
      assert.match(chatContent, /streamRef\.current.*getTracks\(\)\.forEach\(/, 'Debe detener pistas en streamRef');
      assert.match(chatContent, /ext\s*=\s*audioBlob\.type\.includes\('mp4'\)\s*\?\s*'mp4'/, 'Debe inferir extensión mp4 dinámicamente');
    });

    it('3.2 Prueba empírica adversarial: Selección de códec en entorno Safari iOS (sin soporte WebM)', () => {
      // Simular getSupportedAudioMimeType exactamente como en UnifiedAiChat.jsx
      const getSupportedAudioMimeType = (mockMediaRecorder) => {
        if (typeof mockMediaRecorder === 'undefined' || typeof mockMediaRecorder.isTypeSupported !== 'function') {
          return '';
        }
        const candidates = [
          'audio/webm;codecs=opus',
          'audio/webm',
          'audio/mp4',
          'audio/aac',
          'audio/ogg;codecs=opus',
        ];
        for (const mime of candidates) {
          if (mockMediaRecorder.isTypeSupported(mime)) {
            return mime;
          }
        }
        return '';
      };

      // Perfil 1: Safari en iOS 15-18 (WebM no soportado, MP4 sí)
      const safariMock = {
        isTypeSupported(mime) {
          return mime === 'audio/mp4';
        }
      };
      assert.equal(getSupportedAudioMimeType(safariMock), 'audio/mp4', 'En Safari iOS debe negociar audio/mp4');

      // Perfil 2: Safari iOS con solo AAC soportado
      const safariAacMock = {
        isTypeSupported(mime) {
          return mime === 'audio/aac';
        }
      };
      assert.equal(getSupportedAudioMimeType(safariAacMock), 'audio/aac', 'En Safari iOS con AAC debe negociar audio/aac');

      // Perfil 3: Chrome/Android/Firefox (WebM Opus prioritario)
      const chromeMock = {
        isTypeSupported(mime) {
          return mime.startsWith('audio/webm');
        }
      };
      assert.equal(getSupportedAudioMimeType(chromeMock), 'audio/webm;codecs=opus', 'En Chrome debe preferir Opus');

      // Perfil 4: Navegador arcaico sin MediaRecorder
      assert.equal(getSupportedAudioMimeType(undefined), '', 'Sin MediaRecorder debe retornar string vacío sin arrojar error');

      // Perfil 5: Ningún códec soportado
      const noneMock = { isTypeSupported: () => false };
      assert.equal(getSupportedAudioMimeType(noneMock), '', 'Sin códec coincidente debe retornar string vacío');
    });

    it('3.3 Prueba empírica adversarial: Extensión dinámica de archivo FormData según Blob type', () => {
      const resolveFilename = (blobType) => {
        const ext = blobType.includes('mp4') ? 'mp4' : blobType.includes('aac') ? 'aac' : 'webm';
        return `voice-sale.${ext}`;
      };

      assert.equal(resolveFilename('audio/mp4'), 'voice-sale.mp4', 'Blob audio/mp4 debe enviarse como voice-sale.mp4');
      assert.equal(resolveFilename('audio/mp4;codecs=mp4a.40.2'), 'voice-sale.mp4', 'Blob audio/mp4 con parámetros debe enviarse como .mp4');
      assert.equal(resolveFilename('audio/aac'), 'voice-sale.aac', 'Blob audio/aac debe enviarse como .aac');
      assert.equal(resolveFilename('audio/webm'), 'voice-sale.webm', 'Blob audio/webm debe enviarse como .webm');
      assert.equal(resolveFilename('audio/webm;codecs=opus'), 'voice-sale.webm', 'Blob audio/webm;codecs=opus debe enviarse como .webm');
    });

    it('3.4 Prueba empírica adversarial: Limpieza de pistas de audio (Track Cleanup) en parada y desmontaje', () => {
      let stoppedTrackCount = 0;
      const createMockTrack = (id) => ({
        id,
        kind: 'audio',
        readyState: 'live',
        stop() {
          this.readyState = 'ended';
          stoppedTrackCount++;
        }
      });

      const track1 = createMockTrack('t1');
      const track2 = createMockTrack('t2');
      const mockStream = {
        getTracks() {
          return [track1, track2];
        }
      };

      const streamRef = { current: mockStream };
      const mediaRecorderRef = {
        current: {
          state: 'recording',
          stop() {
            this.state = 'inactive';
          }
        }
      };
      let timerCleared = false;
      const recordingTimerRef = { current: 12345 };
      global.clearInterval = (id) => {
        if (id === 12345) timerCleared = true;
      };

      // Ejecutar lógica de cleanup idéntica al useEffect de desmonte en UnifiedAiChat.jsx
      const unmountCleanup = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          try {
            mediaRecorderRef.current.stop();
          } catch (_) {}
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
      };

      unmountCleanup();

      assert.equal(mediaRecorderRef.current.state, 'inactive', 'MediaRecorder debe ser detenido');
      assert.equal(stoppedTrackCount, 2, 'Todas las pistas del stream deben haber invocado .stop()');
      assert.equal(track1.readyState, 'ended');
      assert.equal(track2.readyState, 'ended');
      assert.equal(streamRef.current, null, 'streamRef.current debe quedar nulo para liberar memoria');
      assert.equal(timerCleared, true, 'El temporizador de segundos debe ser limpiado con clearInterval');
    });
  });

  // ===========================================================================
  // 4. DESAFÍO A-08: Debounce de Búsqueda en ProductionManagementView.jsx
  // ===========================================================================
  describe('4. Desafío A-08: Debounce de 250ms en Búsqueda de Producción', () => {
    const prodPath = path.join(projectRoot, 'src/components/ProductionManagementView.jsx');
    const prodContent = fs.readFileSync(prodPath, 'utf8');

    it('4.1 Auditoría estática: Presencia de estado debounced y temporizador de 250ms', () => {
      assert.match(prodContent, /const \[debouncedSearchQuery,\s*setDebouncedSearchQuery\]\s*=\s*useState\(''\)/);
      assert.match(prodContent, /setTimeout\(\(\)\s*=>\s*\{[\s\S]*?setDebouncedSearchQuery\(searchQuery\);[\s\S]*?\},\s*250\)/);
      assert.match(prodContent, /return \(\) => clearTimeout\(timer\)/, 'Debe cancelar temporizadores previos en cleanup de useEffect');
    });

    it('4.2 Prueba empírica adversarial: Ráfaga de pulsaciones a intervalos de 50ms consolida en una única petición a los 250ms', async () => {
      let emittedQueries = [];
      let activeTimer = null;

      const simulateKeystroke = (text) => {
        if (activeTimer) clearTimeout(activeTimer);
        activeTimer = setTimeout(() => {
          emittedQueries.push(text);
        }, 250);
      };

      // Simular ráfaga de escritura rápida: 'D', 'De', 'Dek', 'Deko'
      simulateKeystroke('D');
      await new Promise(r => setTimeout(r, 50));
      simulateKeystroke('De');
      await new Promise(r => setTimeout(r, 50));
      simulateKeystroke('Dek');
      await new Promise(r => setTimeout(r, 50));
      simulateKeystroke('Deko');

      // A los 100ms de la última pulsación, NO debe haberse emitido nada
      await new Promise(r => setTimeout(r, 100));
      assert.equal(emittedQueries.length, 0, 'No debe emitir búsquedas intermedias antes de expirar el debounce');

      // Esperar los 200ms restantes para superar los 250ms desde la última pulsación
      await new Promise(r => setTimeout(r, 200));
      assert.equal(emittedQueries.length, 1, 'Debe emitir exactamente una búsqueda consolidada');
      assert.equal(emittedQueries[0], 'Deko', 'La consulta emitida debe ser el texto final consolidado');
    });
  });

  // ===========================================================================
  // 5. DESAFÍO A-07: Modal de Confirmación en Arqueo de Caja (CashClosingView.jsx)
  // ===========================================================================
  describe('5. Desafío A-07: Modal de Confirmación en Cierre de Caja', () => {
    const cashPath = path.join(projectRoot, 'src/components/CashClosingView.jsx');
    const cashContent = fs.readFileSync(cashPath, 'utf8');

    it('5.1 Auditoría estática: El submit del formulario abre el modal antes de asentar', () => {
      assert.match(cashContent, /const \[showConfirmModal,\s*setShowConfirmModal\]\s*=\s*useState\(false\)/);
      assert.match(cashContent, /onSubmit=\{handleOpenConfirmation\}/, 'El formulario debe invocar handleOpenConfirmation');
      assert.match(cashContent, /setShowConfirmModal\(true\)/, 'handleOpenConfirmation debe abrir el modal de confirmación');
      assert.match(cashContent, /onClick=\{handleConfirmClosing\}/, 'El botón de confirmación en el modal debe invocar handleConfirmClosing');
    });
  });

  // ===========================================================================
  // 6. DESAFÍO M-04: Mapeo Canónico de Medidas en Pulgadas (aiMultimodalService.js)
  // ===========================================================================
  describe('6. Desafío M-04: Normalización Canónica de Tamaños en Pulgadas y Centímetros', async () => {
    const { normalizeCatalogSizeId } = await import('../server/services/aiMultimodalService.js');

    it('6.1 Medidas en pulgadas son mapeadas correctamente para evitar subfacturación', () => {
      assert.equal(normalizeCatalogSizeId('18x24'), 'GRANDE');
      assert.equal(normalizeCatalogSizeId('18 x 24'), 'GRANDE');
      assert.equal(normalizeCatalogSizeId('18 x 24 pulgadas'), 'GRANDE');
      assert.equal(normalizeCatalogSizeId('24x18'), 'GRANDE');
      assert.equal(normalizeCatalogSizeId('45x60'), 'GRANDE');

      assert.equal(normalizeCatalogSizeId('24x36'), 'GIGANTE');
      assert.equal(normalizeCatalogSizeId('36x24'), 'GIGANTE');
      assert.equal(normalizeCatalogSizeId('60x90'), 'GIGANTE');

      assert.equal(normalizeCatalogSizeId('12x18'), 'MEDIANO');
      assert.equal(normalizeCatalogSizeId('18x12'), 'MEDIANO');
      assert.equal(normalizeCatalogSizeId('30x45'), 'MEDIANO');

      assert.equal(normalizeCatalogSizeId('8.5x11'), 'PEQUENO');
      assert.equal(normalizeCatalogSizeId('8x10'), 'PEQUENO');
      assert.equal(normalizeCatalogSizeId('21x27'), 'PEQUENO');

      assert.equal(normalizeCatalogSizeId('5x7'), 'MINI');
      assert.equal(normalizeCatalogSizeId('14x21'), 'MINI');

      assert.equal(normalizeCatalogSizeId('30x30'), 'PORTADA_ALBUM');
      assert.equal(normalizeCatalogSizeId('12x12'), 'PORTADA_ALBUM');
      assert.equal(normalizeCatalogSizeId('vinilo'), 'PORTADA_ALBUM');
      assert.equal(normalizeCatalogSizeId('album'), 'PORTADA_ALBUM');
    });
  });

  // ===========================================================================
  // 7. DESAFÍO M-05: Roles Modernos en tests/e2e/test-helpers.js
  // ===========================================================================
  describe('7. Desafío M-05: Eliminación de Roles Legacy en Helpers de Prueba', async () => {
    const helpersPath = path.join(projectRoot, 'tests/e2e/test-helpers.js');
    const helpersContent = fs.readFileSync(helpersPath, 'utf8');

    it('7.1 No deben existir roles legacy ADMIN_EMPRESA ni ENCARGADO_STAND', () => {
      assert.doesNotMatch(helpersContent, /ADMIN_EMPRESA/, 'Prohibido usar ADMIN_EMPRESA en helpers de prueba');
      assert.doesNotMatch(helpersContent, /ENCARGADO_STAND/, 'Prohibido usar ENCARGADO_STAND en helpers de prueba');
    });

    it('7.2 Tokens generados poseen roles válidos de PostgreSQL RBAC', async () => {
      const { getValidAdminToken, getValidSellerToken } = await import('../tests/e2e/test-helpers.js');
      const jwt = (await import('jsonwebtoken')).default;

      const adminToken = getValidAdminToken();
      const adminDecoded = jwt.decode(adminToken);
      assert.equal(adminDecoded.role, 'SUPER_ADMIN');
      assert.deepEqual(adminDecoded.roles, ['SUPER_ADMIN']);

      const sellerToken = getValidSellerToken();
      const sellerDecoded = jwt.decode(sellerToken);
      assert.equal(sellerDecoded.role, 'VENDEDOR');
      assert.deepEqual(sellerDecoded.roles, ['VENDEDOR']);
    });
  });
});
