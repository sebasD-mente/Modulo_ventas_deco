# DISPATCH — worker_m2

## Task: Milestone 2 — Blindaje de Vulnerabilidades Críticas de Feria P0 & Multitenancy (R2)
Working Directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2`
Project Directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Master Requirements: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md`
Explorer Report: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_r2\handoff.md`
Project Plan: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\orchestrator_19\PROJECT.md`

## 🚫 REGLA SAGRADA ANTI-FILE SPRAWL
QUEDA TERMINANTEMENTE PROHIBIDO fragmentar `server/controllers/userController.js` ni ninguno de los archivos medianos. Las mutaciones deben blindarse directamente dentro del archivo existente.

## Instrucciones Específicas de Implementación

### 1. P0-1: Resiliencia de Caché Offline (`src/services/catalogCacheService.js`):
- En `saveCatalogSnapshot(posters)`: Leer la caché existente de `localStorage`, combinar con las nuevas obras en un `Map` indexado por `id`, conservar los datos sanitizados y mantener un tope FIFO de 300 obras para evitar desbordar `localStorage`.
- Eliminar la sobreescritura destructiva para que buscar 2 obras no borre las anteriores 50.

### 2. P0-2: Bloqueo Offline de Terminal (`src/context/AuthContext.jsx` & `src/App.jsx`):
- En `AuthContext.jsx`:
  - Inicializar `user` intentando leer `localStorage.getItem('deko_auth_user')`.
  - Persistir `user` en `localStorage.setItem('deko_auth_user', JSON.stringify(data.user))` al autenticar con Google y en `checkSession`.
  - En `checkSession`: si la red falla (`catch`), mantener el `user` si existe token válido, de modo que el vendedor no quede en `null`.
  - Al hacer `logout`: remover `deko_auth_user` y `deko_active_event`.
  - **CRÍTICO**: Preservar estrictamente la memoización de `value` con `useMemo` y su lista exacta de dependencias auditada por `tests/m3-adversarial-frontend.test.js`: `[user, token, isLoading, error, loginWithGoogle, logout, authFetch, userRoles, hasRole, isSuperAdmin, isVendedor, isOperario1, isOperario2, isProduccion, checkSession]`.
- En `App.jsx`:
  - Permitir que si no hay internet pero hay `user` y `token` en caché, la aplicación renderice las pantallas de venta manual (`FastManualSaleForm`) y permita cobrar sin ser expulsado a Google Login.

### 3. P0-3: VAD de Micrófono ante Ruido de Convención (`src/components/ai-chat/hooks/useAiVoiceRecorder.js`):
- Implementar un hard timeout de seguridad de 7 segundos (`setTimeout`) que garantice el cierre de la grabación.
- Implementar calibración del piso de ruido en los primeros 400ms: calcular el nivel base ambiental y definir dinámicamente el umbral (`Math.max(0.006, noiseFloor * 1.35)`) para que el micrófono no quede eternamente grabando ante los 95dB del salón.
- **LÍMITE ESTRICTO DE LÍNEAS**: Debe mantenerse estrictamente en `< 140` líneas (actualmente 135 líneas). Escribir con máxima concisión sintáctica.

### 4. P0-4: Protección contra Error HTTP 429 en Medios (`server/services/ai/aiMediaService.js`):
- Importar `executeWithModelFallback` desde `../geminiPoolService.js`.
- Envolver las llamadas de audio, fotos y video (`processVoiceSaleAudio`, `recognizePosterArtworkFromImage`, `recognizePostersFromVideo`, `processPostersBatchPhoto`) dentro de `executeWithModelFallback` para aprovechar la rotación automática del pool de claves Gemini ante errores 429.
- **LÍMITE ESTRICTO DE LÍNEAS**: Debe mantenerse estrictamente en `<= 200` líneas (actualmente 173 líneas).

### 5. P0-6 & P0-7: Aislamiento de Rutas y Multitenancy:
- En `server/routes/apiRoutes.js`: añadir el middleware `requireEventAccess` a la ruta `PATCH /sales/:id`.
- En `server/controllers/userController.js`: forzar el filtro por `tenantId: req.tenantId` en todas las mutaciones (`updateUserRole`, `assignUserToEvent`, `toggleUserStatus`, `deleteUser`) para impedir acceso cruzado entre tenants. En `assignUserToEvent`, validar también que `eventId` pertenezca al `tenantId` del solicitante. NO fragmentar el archivo.

### 6. P0-8: Protección de Diagnóstico (`server/index.js`):
- Modificar el endpoint `/health/ai` para que realice una verificación estática de variables de entorno configuradas (`GEMINI_API_KEY`, etc.) sin realizar llamadas activas que consuman tokens ni expongan prefijos de claves en texto plano.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Verificación Requerida:
Ejecutar:
- Tests de catálogo: `node --test tests/catalog/*.test.js`
- Tests de frontend modular: `node --test tests/ai/chat-constants-recorder.test.js tests/ai/m4-frontend-modular-adversarial.test.js tests/m3-adversarial-frontend.test.js`
- Tests de backend y seguridad: `npm run test:security`, `npm run audit:secrets`
- Verificación de límites de líneas: `node scripts/audit-monoliths.js`
- Build de producción: `npm run build`


## 2026-09-13T18:03:21Z
Tu rol es Worker M2 (Blindaje P0 y Multitenancy).
Tu working directory es: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2
El directorio del proyecto es: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Lee los requerimientos originales en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\ORIGINAL_REQUEST.md
Lee el plan en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\orchestrator_19\PROJECT.md
Lee el reporte forense en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\explorer_r2\handoff.md
Lee tu asignación en: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\.agents\worker_m2\DISPATCH.md

Implementa el blindaje de las vulnerabilidades críticas P0 y Multitenancy:
1. P0-1 (`src/services/catalogCacheService.js`): Fusión acumulativa Map indexada por ID (tope 300) sin sobreescritura destructiva.
2. P0-2 (`src/context/AuthContext.jsx` & `src/App.jsx`): Persistencia de usuario en `localStorage` (`deko_auth_user`), inicialización desde caché para operar offline en venta manual sin expulsar al usuario a Google Login. PRESERVAR estrictamente la memoización del array de dependencias en useMemo de AuthContext.
3. P0-3 (`src/components/ai-chat/hooks/useAiVoiceRecorder.js`): Hard timeout de 7 segundos y calibración en primeros 400ms para evitar bloqueo a 95dB. Techo estricto < 140 líneas (actualmente 135).
4. P0-4 (`server/services/ai/aiMediaService.js`): Envolver llamadas de audio, fotos y video en `executeWithModelFallback` para rotación ante 429. Techo estricto <= 200 líneas (actualmente 173).
5. P0-6 & P0-7: Aislamiento de rutas y Multitenancy:
   - `server/routes/apiRoutes.js`: Añadir `requireEventAccess` en `PATCH /sales/:id`.
   - `server/controllers/userController.js`: Forzar `tenantId: req.tenantId` en mutaciones (updateUserRole, assignUserToEvent, toggleUserStatus, deleteUser) SIN fragmentar el archivo (Anti-File Sprawl).
6. P0-8 (`server/index.js`): Convertir `/health/ai` en verificación estática de variables de entorno sin quema de tokens de Gemini ni exposición de prefijos de claves.
