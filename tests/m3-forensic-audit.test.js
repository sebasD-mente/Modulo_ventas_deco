import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Set dummy envs so server modules can be imported safely
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.JWT_SECRET = 'super_secure_forensic_auditor_secret_key_2026';
process.env.GOOGLE_CLIENT_ID = 'test-client-id.apps.googleusercontent.com';
process.env.SUPER_ADMIN_EMAILS = 'superadmin@dekolabs.org';

describe('🔬 AUDITORÍA FORENSE M3: Verificación de Integridad y Cero Fraude', () => {

  // --------------------------------------------------------------------------
  // 1. C-08: UnifiedAiChat.jsx - Negociación de Audio iOS y Cleanup
  // --------------------------------------------------------------------------
  describe('1. C-08: UnifiedAiChat.jsx - Audio Cross-Browser & Resource Cleanup', () => {
    const filePath = path.join(ROOT, 'src/components/UnifiedAiChat.jsx');
    const content = fs.readFileSync(filePath, 'utf-8');

    it('1.1 Debe implementar getSupportedAudioMimeType con orden preferencial de codecs', () => {
      assert.ok(content.includes('getSupportedAudioMimeType'), 'Falta getSupportedAudioMimeType');
      assert.ok(content.includes('audio/webm;codecs=opus'), 'Falta audio/webm;codecs=opus');
      assert.ok(content.includes('audio/mp4'), 'Falta soporte para audio/mp4 (Safari/iOS)');
      assert.ok(content.includes('audio/aac'), 'Falta soporte para audio/aac');
    });

    it('1.2 getUserMedia debe solicitar directivas WebRTC de cancelación de ruido', () => {
      assert.ok(content.includes('echoCancellation: true'), 'Falta echoCancellation');
      assert.ok(content.includes('noiseSuppression: true'), 'Falta noiseSuppression');
      assert.ok(content.includes('autoGainControl: true'), 'Falta autoGainControl');
    });

    it('1.3 Debe gestionar streamRef y detener todas las pistas de audio en cleanup', () => {
      assert.ok(content.includes('streamRef = useRef(null)'), 'Falta declaración de streamRef');
      assert.ok(content.includes('streamRef.current?.getTracks()') || content.includes('streamRef.current.getTracks()'), 'Falta parada de tracks en streamRef');
      assert.ok(content.includes('useEffect(() => {'), 'Falta hook de limpieza al desmontar');
      assert.ok(content.includes('clearInterval(recordingTimerRef.current)'), 'Falta parada del timer de grabación');
    });

    it('1.4 Debe asignar extensión de archivo dinámica (.mp4, .aac, .webm) según el tipo de blob real', () => {
      assert.ok(content.includes("audioBlob.type.includes('mp4') ? 'mp4'"), 'Falta detección de extensión mp4');
      assert.ok(content.includes('voice-sale.${ext}') || content.includes('`voice-sale.${ext}`'), 'Falta nombre dinámico en FormData');
    });

    it('1.5 Debe propagar pendingDraft en la consulta de texto para edición conversacional', () => {
      assert.ok(content.includes('pendingDraft: pendingDraft || null'), 'Falta envío de pendingDraft en handleSendText');
    });
  });

  // --------------------------------------------------------------------------
  // 2. M-01 & A-02: aiController.js y Unificación Gemini
  // --------------------------------------------------------------------------
  describe('2. M-01 & A-02: aiController.js - Conversational Draft & Model Alignment', () => {
    const controllerPath = path.join(ROOT, 'server/controllers/aiController.js');
    const content = fs.readFileSync(controllerPath, 'utf-8');

    it('2.1 handleChatQuery debe extraer y propagar pendingDraft', () => {
      assert.ok(content.includes('pendingDraft'), 'aiController no maneja pendingDraft');
      assert.ok(content.includes('pendingDraft: pendingDraft || null'), 'pendingDraft no es pasado a chatWithSalesAssistant');
    });

    it('2.2 Referencias a Gemini deben especificar Gemini 2.5 Flash', () => {
      assert.ok(!content.includes('Gemini 3.8 Flash'), 'Aún existen referencias a Gemini 3.8 Flash en aiController');
      assert.ok(content.includes('Gemini 2.5 Flash'), 'Debe documentar Gemini 2.5 Flash');
    });
  });

  // --------------------------------------------------------------------------
  // 3. M-04 & M-01: aiMultimodalService.js - Normalización de Medidas y Borrador
  // --------------------------------------------------------------------------
  describe('3. M-04 & M-01: aiMultimodalService.js - Size Normalization & Draft Grounding', async () => {
    const { normalizeCatalogSizeId } = await import('../server/services/aiMultimodalService.js');
    const servicePath = path.join(ROOT, 'server/services/aiMultimodalService.js');
    const content = fs.readFileSync(servicePath, 'utf-8');

    it('3.1 Mapeo estricto de medidas en pulgadas a GRANDE (Q125)', () => {
      const inputs = [
        '18x24', '18 x 24', '18*24', '18 por 24', '18 x 24 pulgadas',
        '18x24"', '18x24 pulg', '24x18', '45x60', '45 x 60 cm', '60x45'
      ];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'GRANDE', `Fallo mapeando "${val}" a GRANDE`);
      }
    });

    it('3.2 Mapeo estricto de medidas en pulgadas a GIGANTE (Q180)', () => {
      const inputs = [
        '24x36', '24 x 36', '24*36', '24 por 36', '24 x 36 pulgadas',
        '24x36"', '36x24', '60x90', '60 x 90 cm', '90x60'
      ];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'GIGANTE', `Fallo mapeando "${val}" a GIGANTE`);
      }
    });

    it('3.3 Mapeo estricto de medidas en pulgadas a MEDIANO (Q65)', () => {
      const inputs = [
        '12x18', '12 x 18', '12*18', '12 por 18', '12 x 18 pulgadas',
        '18x12', '30x45', '45x30'
      ];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'MEDIANO', `Fallo mapeando "${val}" a MEDIANO`);
      }
    });

    it('3.4 Mapeo estricto de medidas en pulgadas a PEQUENO (Q35)', () => {
      const inputs = [
        '8.5x11', '8.5 x 11', '8x10', '8 x 10', '21x27', '27x21'
      ];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'PEQUENO', `Fallo mapeando "${val}" a PEQUENO`);
      }
    });

    it('3.5 Mapeo estricto de medidas a MINI (Q25)', () => {
      const inputs = ['5x7', '7x5', '6x8', '8x6', '14x21', '21x14'];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'MINI', `Fallo mapeando "${val}" a MINI`);
      }
    });

    it('3.6 Mapeo estricto de medidas a PORTADA_ALBUM (Q55)', () => {
      const inputs = ['30x30', '12x12', 'vinilo', 'álbum', 'album'];
      for (const val of inputs) {
        assert.equal(normalizeCatalogSizeId(val), 'PORTADA_ALBUM', `Fallo mapeando "${val}" a PORTADA_ALBUM`);
      }
    });

    it('3.7 Resiliencia ante valores vacíos, nulos o genéricos', () => {
      assert.equal(normalizeCatalogSizeId(null), 'MEDIANO');
      assert.equal(normalizeCatalogSizeId(undefined), 'MEDIANO');
      assert.equal(normalizeCatalogSizeId(''), 'MEDIANO');
      assert.equal(normalizeCatalogSizeId('desconocido_otro'), 'DESCONOCIDO_OTRO');
    });

    it('3.8 chatWithSalesAssistant debe inyectar el borrador activo en el prompt de sistema', () => {
      assert.ok(content.includes('BORRADOR DE VENTA ACTUAL EN PANTALLA'), 'Falta draftContext en el prompt de Jarvis');
      assert.ok(content.includes('INSTRUCCIONES PARA MODIFICACIÓN DEL BORRADOR'), 'Faltan instrucciones para edición de borrador');
    });
  });

  // --------------------------------------------------------------------------
  // 4. A-02: .env.example y README.md
  // --------------------------------------------------------------------------
  describe('4. A-02: Unificación a gemini-2.5-flash en Configuración y Documentación', () => {
    const envPath = path.join(ROOT, '.env.example');
    const readmePath = path.join(ROOT, 'README.md');
    const envContent = fs.readFileSync(envPath, 'utf-8');
    const readmeContent = fs.readFileSync(readmePath, 'utf-8');

    it('.env.example debe declarar GEMINI_MODEL=gemini-2.5-flash y CERO 3.8', () => {
      assert.ok(envContent.includes('GEMINI_MODEL=gemini-2.5-flash'), '.env.example debe tener gemini-2.5-flash');
      assert.ok(!envContent.includes('gemini-3.8-flash'), '.env.example no debe contener gemini-3.8-flash');
    });

    it('README.md debe documentar gemini-2.5-flash y CERO 3.8', () => {
      assert.ok(readmeContent.includes('gemini-2.5-flash'), 'README.md debe listar gemini-2.5-flash');
      assert.ok(!readmeContent.includes('gemini-3.8-flash'), 'README.md no debe contener gemini-3.8-flash');
    });
  });

  // --------------------------------------------------------------------------
  // 5. A-05: EditSaleModal.jsx - Inmutabilidad Estricta
  // --------------------------------------------------------------------------
  describe('5. A-05: EditSaleModal.jsx - Pureza e Inmutabilidad de Estado React', () => {
    const modalPath = path.join(ROOT, 'src/components/EditSaleModal.jsx');
    const content = fs.readFileSync(modalPath, 'utf-8');

    it('5.1 No debe mutar directamente propiedades en el objeto del array', () => {
      assert.ok(!content.includes('current.quantity = newQty;'), 'Mutación directa de objeto detectada');
    });

    it('5.2 Debe usar functional setter setItems(prevItems => ...) clonando el ítem modificado', () => {
      assert.ok(content.includes('setItems((prevItems) => {'), 'Falta functional updater en setItems');
      assert.ok(content.includes('updated[idx] = {'), 'Falta clonación inmutable del ítem');
      assert.ok(content.includes('...current'), 'Falta spread de current');
    });

    it('5.3 handleRemoveItem debe usar functional setter preservando inmutabilidad', () => {
      assert.ok(content.includes('prevItems.filter('), 'handleRemoveItem debe filtrar sobre prevItems');
    });
  });

  // --------------------------------------------------------------------------
  // 6. A-06: AuthContext.jsx - Memoización de Contexto y Callbacks
  // --------------------------------------------------------------------------
  describe('6. A-06: AuthContext.jsx - Memoización y Erradicación de Ciclos de Render', () => {
    const authPath = path.join(ROOT, 'src/context/AuthContext.jsx');
    const content = fs.readFileSync(authPath, 'utf-8');

    it('6.1 useMemo debe estar importado de React', () => {
      assert.ok(content.includes('useMemo'), 'Falta import de useMemo');
    });

    it('6.2 logout y loginWithGoogle deben estar envueltos en useCallback', () => {
      assert.ok(content.includes('const logout = useCallback('), 'logout no está en useCallback');
      assert.ok(content.includes('const loginWithGoogle = useCallback('), 'loginWithGoogle no está en useCallback');
    });

    it('6.3 Los roles y banderas de permisos deben estar memoizados con useMemo', () => {
      assert.ok(content.includes('const userRoles = useMemo('), 'userRoles no está memoizado');
      assert.ok(content.includes('const isSuperAdmin = useMemo('), 'isSuperAdmin no está memoizado');
      assert.ok(content.includes('const isVendedor = useMemo('), 'isVendedor no está memoizado');
      assert.ok(content.includes('const isProduccion = useMemo('), 'isProduccion no está memoizado');
    });

    it('6.4 El objeto value entregado al Provider debe estar memoizado con useMemo', () => {
      assert.ok(content.includes('const value = useMemo('), 'El objeto value del Provider no está memoizado');
    });
  });

  // --------------------------------------------------------------------------
  // 7. A-07: CashClosingView.jsx - Modal de Confirmación Contable
  // --------------------------------------------------------------------------
  describe('7. A-07: CashClosingView.jsx - Modal de Confirmación de Arqueo', () => {
    const closingPath = path.join(ROOT, 'src/components/CashClosingView.jsx');
    const content = fs.readFileSync(closingPath, 'utf-8');

    it('7.1 Debe declarar estado showConfirmModal y validar antes de abrir', () => {
      assert.ok(content.includes('showConfirmModal'), 'Falta estado showConfirmModal');
      assert.ok(content.includes('handleOpenConfirmation'), 'Falta handler de apertura handleOpenConfirmation');
    });

    it('7.2 El envío de formulario onSubmit debe invocar handleOpenConfirmation y no enviar directo', () => {
      assert.ok(content.includes('onSubmit={handleOpenConfirmation}'), 'El form debe apuntar a handleOpenConfirmation');
    });

    it('7.3 El modal debe renderizar advertencia de inmutabilidad contable y desglose de efectivo', () => {
      assert.ok(content.includes('¿Confirmar Asiento de Cierre?'), 'Falta título de confirmación');
      assert.ok(content.includes('Efectivo Esperado (Sistema):'), 'Falta display de efectivo esperado');
      assert.ok(content.includes('Efectivo Físico Contado:'), 'Falta display de efectivo físico');
      assert.ok(content.includes('Balance / Diferencia:'), 'Falta display de balance');
      assert.ok(content.includes('handleConfirmClosing'), 'Falta handler definitivo handleConfirmClosing');
    });
  });

  // --------------------------------------------------------------------------
  // 8. A-08: ProductionManagementView.jsx - Debounce de 250ms en Búsqueda
  // --------------------------------------------------------------------------
  describe('8. A-08: ProductionManagementView.jsx - Debounce de 250ms en Búsqueda', () => {
    const prodPath = path.join(ROOT, 'src/components/ProductionManagementView.jsx');
    const content = fs.readFileSync(prodPath, 'utf-8');

    it('8.1 Debe declarar estado debouncedSearchQuery', () => {
      assert.ok(content.includes('debouncedSearchQuery'), 'Falta debouncedSearchQuery');
    });

    it('8.2 Debe tener un useEffect con timer de 250ms y clearTimeout en cleanup', () => {
      assert.ok(content.includes('setTimeout(() => {'), 'Falta setTimeout en debounce');
      assert.ok(content.includes('250'), 'El timer de debounce debe ser de 250ms');
      assert.ok(content.includes('clearTimeout(timer)'), 'Falta clearTimeout en cleanup de debounce');
    });

    it('8.3 fetchItems debe depender de debouncedSearchQuery y no de searchQuery directo', () => {
      assert.ok(content.includes('debouncedSearchQuery.trim()'), 'fetchItems debe usar debouncedSearchQuery');
      assert.ok(content.includes('[authFetch, selectedEventId, statusFilter, debouncedSearchQuery]'), 'Array de dependencias de fetchItems debe incluir debouncedSearchQuery');
    });
  });

  // --------------------------------------------------------------------------
  // 9. M-05: tests/e2e/test-helpers.js - Roles Vigentes (SUPER_ADMIN, VENDEDOR)
  // --------------------------------------------------------------------------
  describe('9. M-05: tests/e2e/test-helpers.js - Roles Vigentes (SUPER_ADMIN, VENDEDOR)', () => {
    const helpersPath = path.join(ROOT, 'tests/e2e/test-helpers.js');
    const content = fs.readFileSync(helpersPath, 'utf-8');

    it('9.1 No debe contener roles legacy ADMIN_EMPRESA ni ENCARGADO_STAND', () => {
      assert.ok(!content.includes("'ADMIN_EMPRESA'"), 'Rol legacy ADMIN_EMPRESA detectado');
      assert.ok(!content.includes("'ENCARGADO_STAND'"), 'Rol legacy ENCARGADO_STAND detectado');
    });

    it('9.2 Debe generar tokens con roles canónicos SUPER_ADMIN y VENDEDOR', () => {
      assert.ok(content.includes("role: 'SUPER_ADMIN'"), 'Falta role SUPER_ADMIN');
      assert.ok(content.includes("roles: ['SUPER_ADMIN']"), 'Falta array roles SUPER_ADMIN');
      assert.ok(content.includes("role: 'VENDEDOR'"), 'Falta role VENDEDOR');
      assert.ok(content.includes("roles: ['VENDEDOR']"), 'Falta array roles VENDEDOR');
    });
  });

  // --------------------------------------------------------------------------
  // 10. PROTOCOLO ZERO-TRUST & AISLAMIENTO ESTRICTO
  // --------------------------------------------------------------------------
  describe('10. Protocolo Zero-Trust & Aislamiento Estricto en Código Modificado', () => {
    const targetFiles = [
      'src/components/UnifiedAiChat.jsx',
      'server/controllers/aiController.js',
      'server/services/aiMultimodalService.js',
      'src/components/EditSaleModal.jsx',
      'src/context/AuthContext.jsx',
      'src/components/CashClosingView.jsx',
      'src/components/ProductionManagementView.jsx',
      'tests/e2e/test-helpers.js'
    ];

    it('10.1 Ninguno de los archivos modificados de código debe contener IPs foráneas (145.223.120.56)', () => {
      for (const rel of targetFiles) {
        const c = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
        assert.ok(!c.includes('145.223.120.56'), `IP foránea 145.223.120.56 encontrada en ${rel}`);
      }
    });

    it('10.2 Ninguno de los archivos de código debe tener correos personales hardcodeados', () => {
      for (const rel of targetFiles) {
        const c = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
        const match = c.match(/[a-zA-Z0-9._%+-]+@gmail\.com/);
        assert.ok(!match, `Correo @gmail.com detectado en ${rel}: ${match?.[0]}`);
      }
    });

    it('10.3 Cero implementaciones fachada (dummy/fake) en los archivos modificados', () => {
      for (const rel of targetFiles) {
        const c = fs.readFileSync(path.join(ROOT, rel), 'utf-8');
        assert.ok(!c.includes('return true; // bypass'), `Bypass detectado en ${rel}`);
        assert.ok(!c.includes('// TODO: implement later'), `TODO de fachada detectado en ${rel}`);
        assert.ok(!c.includes('return "TODO"'), `Placeholder detectado en ${rel}`);
      }
    });
  });

});
