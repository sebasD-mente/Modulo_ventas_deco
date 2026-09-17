import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

describe('🔒 Milestone 2: Hardening P0 & Multitenancy Independent Verification', () => {
  // P0-1: catalogCacheService.js
  describe('1. P0-1: Resiliencia de Caché Offline (catalogCacheService.js)', () => {
    const servicePath = path.join(projectRoot, 'src/services/catalogCacheService.js');
    const content = fs.readFileSync(servicePath, 'utf8');

    it('1.1 Define MAX_LOCAL_CATALOG_ITEMS en 300', () => {
      assert.match(content, /MAX_LOCAL_CATALOG_ITEMS\s*=\s*300/, 'Debe definir tope en 300');
    });

    it('1.2 Utiliza Map para fusión acumulativa indexada por id', () => {
      assert.match(content, /new Map\(\)/, 'Debe instanciar Map para indexar por id');
      assert.match(content, /existingMap\.set\(sanitized\.id,\s*sanitized\)/, 'Debe acumular obras en el Map');
    });

    it('1.3 Aplica recorte FIFO de los últimos 300 elementos', () => {
      assert.match(content, /slice\(-MAX_LOCAL_CATALOG_ITEMS\)/, 'Debe recortar a los últimos 300 elementos');
    });
  });

  // P0-2: AuthContext.jsx & App.jsx
  describe('2. P0-2: Persistencia Offline de Sesión y Venta Manual (AuthContext & App)', () => {
    const authPath = path.join(projectRoot, 'src/context/AuthContext.jsx');
    const authContent = fs.readFileSync(authPath, 'utf8');
    const appPath = path.join(projectRoot, 'src/App.jsx');
    const appContent = fs.readFileSync(appPath, 'utf8');

    it('2.1 AuthContext inicializa user desde localStorage (deko_auth_user)', () => {
      assert.match(authContent, /localStorage\.getItem\(['"]deko_auth_user['"]\)/, 'Debe leer deko_auth_user al inicializar');
    });

    it('2.2 AuthContext persiste user en localStorage al autenticar y en checkSession', () => {
      assert.match(authContent, /localStorage\.setItem\(['"]deko_auth_user['"],\s*JSON\.stringify\(data\.user\)\)/, 'Debe guardar deko_auth_user');
    });

    it('2.3 AuthContext elimina deko_auth_user y deko_active_event al cerrar sesión', () => {
      assert.match(authContent, /localStorage\.removeItem\(['"]deko_auth_user['"]\)/, 'Debe limpiar deko_auth_user');
      assert.match(authContent, /localStorage\.removeItem\(['"]deko_active_event['"]\)/, 'Debe limpiar deko_active_event');
    });

    it('2.4 AuthContext preserva el array exacto de dependencias en useMemo de value', () => {
      const match = authContent.match(/const value = useMemo\(\(\) => \(\{[\s\S]*?\}\),\s*\[([\s\S]*?)\]\);/);
      assert.ok(match, 'useMemo de value debe estar presente');
      const deps = match[1].split(',').map(d => d.trim()).filter(Boolean);
      const expected = [
        'user', 'token', 'isLoading', 'error', 'loginWithGoogle', 'logout', 'authFetch',
        'userRoles', 'hasRole', 'isSuperAdmin', 'isVendedor', 'isOperario1', 'isOperario2',
        'isProduccion', 'checkSession'
      ];
      assert.deepEqual(deps, expected, 'Dependencias de useMemo deben coincidir exactamente');
    });

    it('2.5 App.jsx persiste activeEvent y no bloquea al usuario si hay caché', () => {
      assert.match(appContent, /localStorage\.getItem\(['"]deko_active_event['"]\)/, 'Debe leer deko_active_event');
      assert.match(appContent, /if\s*\(isAuthLoading\s*&&\s*!user\)/, 'Debe condicionar loader a no tener usuario en caché');
    });
  });

  // P0-3: useAiVoiceRecorder.js
  describe('3. P0-3: VAD y Hard Timeout ante Ruido (useAiVoiceRecorder.js)', () => {
    const hookPath = path.join(projectRoot, 'src/components/ai-chat/hooks/useAiVoiceRecorder.js');
    const content = fs.readFileSync(hookPath, 'utf8');
    const lines = content.split('\n').length;

    it('3.1 Implementa hard timeout de voz (15 segundos)', () => {
      assert.match(content, /hardTimeoutRef/, 'Debe tener ref para hard timeout');
      assert.match(content, /setTimeout\(\(\)\s*=>\s*stopRecording\(\),\s*(7000|15000)\)/, 'Debe configurar timeout de 15000ms o 7000ms');
    });

    it('3.2 Calibra piso de ruido dinámicamente en los primeros 400ms', () => {
      assert.match(content, /elapsed\s*<\s*400/, 'Debe muestrear en los primeros 400ms');
      assert.match(content, /noiseFloor\s*=\s*Math\.max\(0\.006/, 'Debe fijar noiseFloor con piso mínimo de 0.006');
    });

    it('3.3 Cumple estrictamente con el techo de < 140 líneas', () => {
      assert.ok(lines < 140, `useAiVoiceRecorder.js debe tener < 140 líneas (actualmente ${lines})`);
    });
  });

  // P0-4: aiMediaService.js
  describe('4. P0-4: Rotación ante 429 en Medios (aiMediaService.js)', () => {
    const mediaPath = path.join(projectRoot, 'server/services/ai/aiMediaService.js');
    const content = fs.readFileSync(mediaPath, 'utf8');
    const lines = content.split('\n').length;

    it('4.1 Importa executeWithModelFallback desde geminiPoolService.js', () => {
      assert.match(content, /import\s*\{[^}]*executeWithModelFallback[^}]*\}\s*from\s*['"]\.\.\/geminiPoolService\.js['"]/, 'Debe importar executeWithModelFallback');
    });

    it('4.2 Envuelta cada función en executeWithModelFallback', () => {
      const occurrences = (content.match(/executeWithModelFallback\(/g) || []).length;
      assert.equal(occurrences, 4, 'Las 4 funciones de medios deben usar executeWithModelFallback');
    });

    it('4.3 Cumple estrictamente con el techo de <= 200 líneas', () => {
      assert.ok(lines <= 200, `aiMediaService.js debe tener <= 200 líneas (actualmente ${lines})`);
    });
  });

  // P0-6 & P0-7: Aislamiento de Rutas y Multitenancy
  describe('5. P0-6 & P0-7: Aislamiento de Rutas y Multitenancy', () => {
    const routesPath = path.join(projectRoot, 'server/routes/apiRoutes.js');
    const routesContent = fs.readFileSync(routesPath, 'utf8');
    const userCtrlPath = path.join(projectRoot, 'server/controllers/userController.js');
    const userCtrlContent = fs.readFileSync(userCtrlPath, 'utf8');

    it('5.1 PATCH /sales/:id incluye middleware requireEventAccess', () => {
      const match = routesContent.match(/router\.patch\(\s*['"]\/sales\/:id['"][\s\S]*?updateSale\s*\);/);
      assert.ok(match, 'Ruta PATCH /sales/:id debe existir');
      assert.match(match[0], /requireEventAccess/, 'PATCH /sales/:id debe incluir requireEventAccess');
    });

    it('5.2 userController filtra por tenantId en todas las mutaciones', () => {
      assert.match(userCtrlContent, /where:\s*\{\s*id,\s*tenantId:\s*req\.tenantId\s*\}/, 'Mutaciones deben filtrar por tenantId');
      assert.doesNotMatch(userCtrlContent, /tenantId:\s*req\.tenantId\s*\|\|\s*['"]tenant-deco-vintage['"]/, 'No debe existir fallback hardcodeado de tenant en createUser');
    });
  });

  // P0-8: /health/ai
  describe('6. P0-8: Verificación Estática en /health/ai sin Quema de Tokens', () => {
    const indexPath = path.join(projectRoot, 'server/index.js');
    const indexContent = fs.readFileSync(indexPath, 'utf8');

    it('6.1 /health/ai es una función síncrona sin llamadas a generateContent ni stream', () => {
      const match = indexContent.match(/app\.get\(['"]\/health\/ai['"],\s*\((req,\s*res)\)\s*=>\s*\{[\s\S]*?\}\);/);
      assert.ok(match, 'Endpoint /health/ai debe existir como handler síncrono');
      assert.doesNotMatch(match[0], /generateContent/, 'No debe llamar a generateContent');
      assert.doesNotMatch(match[0], /streamChatWithSalesAssistant/, 'No debe iniciar streams');
      assert.doesNotMatch(match[0], /keyPrefix/, 'No debe filtrar prefijos de claves de API');
    });
  });
});
