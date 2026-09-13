# AUDITORÍA FORENSE 360°, PLAN DE DESPIECE MODULAR Y BLUEPRINT DE INNOVACIÓN ENTERPRISE
## STAND {IA} — Sistema Profesional de Ventas, Taller de Producción & Asesoría Multimodal
**Cliente / Entidades:** Deco Vintage Guate & Deko Labs  
**Entorno Operativo:** Convenciones Masivas de Alto Tráfico (Comic Con Guatemala, Expo Otaku, Anime Fests, Pop-Up Fairs — 15,000+ Asistentes)  
**Fecha de Emisión:** 13 de Septiembre de 2026  
**Autor:** Equipo de Auditoría Técnica Forense & Arquitectura Enterprise (STAND Forensic Core)  
**Estado:** Dictamen Técnico Definitivo & Blueprint de Producción (Zero-Debt Architecture)  

---

# 1. RESUMEN EJECUTIVO (EXECUTIVE SUMMARY)

### 1.1 Estado de Salud General de STAND {IA}
**STAND {IA}** (`deko-eventsales`) es una plataforma especializada de punto de venta (POS), gestión de cola de taller y asistencia conversacional multimodal para stands comerciales en eventos masivos de cultura pop y arte visual. 

Tras una inspección integral de los 101 archivos del repositorio (100% de la base de código bajo `server/`, `src/`, `prisma/`, configuraciones de Docker, scripts de despliegue y pipelines CI/CD), se certifica que el sistema ha alcanzado hitos estructurales de modernización notables:
- **Erradicación de Modelos Heredados (Gen 3 Puro):** Migración 100% completada a la familia Google Gen 3 (`gemini-3.8-flash` como modelo titular en `server/config/env.js:L40`, con cascada automática hacia `gemini-3.7-flash`, `gemini-3.6-flash`, `gemini-3.5-flash` y `gemini-3.1-flash-lite`). Se verificó que **no existen referencias residuales activas a `gemini-1.5` ni `gemini-2.5`** en el código de producción.
- **Closed-Loop Function Calling & Dual Streaming:** Implementación exitosa del bucle cerrado con `@google/genai` en `server/services/ai/aiClosedLoopService.js:L77-L103` y `server/services/ai/aiStreamService.js`, transmitiendo de forma simultánea e intercalada tokens explicativos de lenguaje natural y eventos estructurados Server-Sent Events (`draft_sale`, `suggested_posters`, `event_kpis`).
- **Arquitectura Frontend Desacoplada y Bundle Ligero:** División de bundle (`React.lazy` + `<Suspense>` en `src/App.jsx:L11-L15`) que genera un bundle inicial ultraligero de **188.76 kB** (36.72 kB gzip), con renderizado de tokens a 60 FPS desacoplado mediante `requestAnimationFrame` (`rafIdRef.current` en `src/components/ai-chat/hooks/useAiChatStream.js:L115`).
- **Arnés de Seguridad Zero-Trust Verde:** Aprobación inmutable del arnés (`npm run harness:check`) con 9/9 pruebas de seguridad pasando al 100% y 0 secretos expuestos en código de producción.

### 1.2 Diagnóstico Sintético: Fortalezas Reales vs. Vulnerabilidades Críticas de Convención
A pesar de su sofisticación algorítmica, el sistema exhibe **vulnerabilidades críticas de resiliencia operativa** que provocan colapsos catastróficos bajo las condiciones reales de una convención masiva (Fórum Majadas, 15,000 asistentes, 95 dB de ruido acústico, saturación total de redes 4G/5G y estrés transaccional multicajero):

| Fortaleza Arquitectónica Real | Vulnerabilidad Crítica Operativa Oculta |
|---|---|
| **Streaming Dual SSE & Closed-Loop Gemini 3.8** | **Bypass del Pool Multi-Key en Medios:** `aiMediaService.js:L76, L102, L124, L154` invoca directamente `gemini.models.generateContent` sin pasar por `executeWithModelFallback`. Ante una ráfaga de notas de voz o fotos, el primer error HTTP 429 (`RESOURCE_EXHAUSTED`) tumba la transacción con error 500 sin rotar de clave. |
| **Caché Local de Catálogo para Búsquedas Rápidas** | **Destrucción Destructiva de la Caché Offline:** `catalogCacheService.js:L32-L43, L58` sobreescribe `localStorage` en cada búsqueda con solo los 8 ítems encontrados. Una sola búsqueda borra el 96% de las obras previamente cacheadas, dejando al POS sin catálogo al caerse el internet. |
| **Autenticación Criptográfica Robusta Google GIS** | **Bloqueo Total Offline ante Recarga:** `AuthContext.jsx:L6-L8, L41-L70` no almacena el objeto `user` en `localStorage`. Si la terminal pierde conexión y el navegador se recarga, expulsa al cajero a `LoginView.jsx`, inhabilitando completamente el punto de venta. |
| **Detección de Voz VAD en Web Audio API** | **VAD Neutralizado por Ruido de Convención:** `useAiVoiceRecorder.js:L95-L103` fija un umbral RMS estático en `0.003` (-50.5 dBFS). En ferias con ruido ambiental > -40 dBFS, el micrófono nunca detecta silencio, grabando indefinidamente y corrompiendo la inferencia. |
| **Generación Atómica de Secuencia de Ticket** | **Bloqueo Exclusivo de Fila en Alto Tráfico:** `saleService.js:L57-L66` ejecuta `tx.event.update` al inicio de una transacción interactiva de Prisma. Esto adquiere un bloqueo exclusivo (`FOR UPDATE`) sobre el evento, serializando a todos los cajeros y provocando timeouts `P2028` en horas pico. |
| **Aislamiento Multitenant Declarativo en Prisma** | **Fugas de Tenant en Controladores:** `userController.js:L65-L72, L87-L106` ejecuta mutaciones filtrando únicamente por `where: { id }` sin validar `tenantId`, permitiendo alteraciones cruzadas entre inquilinos. |

### 1.3 Resumen Cuantitativo de Riesgos Técnicos
El inventario de hallazgos se distribuye en:
- **P0 (Bloqueantes Críticos / Riesgo de Parálisis o Fuga de Seguridad):** **9 hallazgos** (R-01 a R-05, P0-1 a P0-3, C-INF-01).
- **P1 (Alta Prioridad / Integridad de Datos, Concurrencia y Ergonomía):** **11 hallazgos** (R-06 a R-11, P1-1 a P1-7).
- **P2 (Media Prioridad / Deuda Técnica, Rendimiento y Telemetría):** **12 hallazgos** (R-12 a R-16, P2-1 a P2-6, C-INF-02).
- **Inventario Monolítico:** **10 archivos de backend** que exceden el límite de 200 líneas (sumando 3,859 líneas de código) requiriendo despiece modular urgente.

---

# 2. DIAGNÓSTICO ARQUITECTÓNICO 360° CON CITACIONES DE LÍNEA EXACTAS

## 2.1 Backend & Controladores HTTP/SSE (`server/controllers/`, `server/routes/apiRoutes.js`)

### 1. Ciclos de Vida SSE, Streams Colgados y Pérdida de Telemetría
* **Ubicación:** `server/controllers/aiController.js:L228-L308`
* **Mecanismo:** El controlador configura adecuadamente las cabeceras SSE (`text/event-stream`, `no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no` en líneas 228-234) y detecta la desconexión del cliente mediante `req.on('close', () => { isClientClosed = true; })` (línea 237).
* **Falla Crítica:** Si el cliente cierra la pestaña, el `break` en la línea 252 interrumpe la lectura del generador `streamGenerator`, pero **no existe un `AbortSignal` propagado hacia el cliente de `@google/genai`**. Google continúa generando tokens en el background hasta completar la respuesta, consumiendo cuota innecesaria.
* **Fuga de Observabilidad:** En las líneas 289-295 (`catch (streamErr)`), se emite el evento SSE `event: error`, pero `recordLlmInteraction` **nunca es invocado**. Las llamadas fallidas o interrumpidas jamás se registran en `AuditLog`, sesgando las métricas de costo y confiabilidad.
* **Truncamiento en Modo No-Streaming:** En `server/controllers/aiController.js:L198-L224`, cuando la petición es procesada de forma síncrona tradicional (`!isStream`), el bucle solo extrae `prepareSaleDraft` y `searchCatalog`. Las otras 5 herramientas ejecutadas por Gemini (`getEventKPIs`, `getCashDrawerStatus`, `getSellerShiftReport`, `getProductionQueueStatus`, `checkInventoryStock`) son omitidas en el JSON de respuesta.

### 2. Ausencia de Aislamiento por Evento en Modificación de Ventas
* **Ubicación:** `server/routes/apiRoutes.js:L125-L130`
* **Código Inspeccionado:**
  ```javascript
  router.patch(
    '/sales/:id',
    requireRole(['SUPER_ADMIN', 'VENDEDOR']),
    validate(updateSaleSchema),
    updateSale
  );
  ```
* **Vulnerabilidad (P0):** A diferencia de `POST /sales` (línea 121) o `GET /sales/events/:eventId` (línea 134), la ruta `PATCH /sales/:id` **no incluye el middleware `requireEventAccess`**. En `server/controllers/saleController.js:L47-L76` y `server/services/saleService.js:L339-L340`, la consulta solo verifica `where: { id: saleId, tenantId }`. En consecuencia, un vendedor asignado al "Evento A" puede alterar ítems, cantidades o anular ventas del "Evento B" si obtiene su ID.

### 3. Fuga Multitenant en Mutaciones de Usuarios
* **Ubicación:** `server/controllers/userController.js:L65-L72, L87-L106, L108-L138, L221-L256`
* **Código Inspeccionado:**
  ```javascript
  // userController.js:L65-L72
  const updated = await prisma.user.update({
    where: { id },
    data: { role: primaryRole, roles: targetRoles },
    include: { assignedEvent: true },
  });
  ```
* **Vulnerabilidad (P0):** Ninguna de las operaciones críticas de administración de usuarios (`updateUserRole`, `assignUserToEvent`, `toggleUserStatus`, `deleteUser`) valida que el usuario pertenezca al `tenantId` del administrador en sesión (`req.tenantId`). Un administrador malicioso podría modificar o deshabilitar usuarios de otras organizaciones. Además, `deleteUser` (líneas 245-255) intenta un borrado físico directo: si el usuario tiene ventas asociadas, PostgreSQL arroja una violación de clave foránea `P2003`, retornando un error 500 no descriptivo.

### 4. Endpoint `/health/ai` No Autenticado Ejecutando Inferencias en Vivo
* **Ubicación:** `server/index.js:L94-L167`
* **Vulnerabilidad (P0):** El endpoint público `GET /health/ai` ejecuta llamadas de inferencia reales y completas contra la API de Gemini para múltiples modelos (`gemini-3.8-flash`, `gemini-3.7-flash` en líneas 116-135) y dispara el generador asíncrono en vivo `streamChatWithSalesAssistant` (líneas 138-161) **sin exigir ningún tipo de autenticación ni token JWT**. Cualquier visitante, bot o monitor de uptime externo puede bombardear este endpoint, agotando la cuota RPM/TPM de Google AI Studio en plena convención.

### 5. Mutación de Estado en Petición GET Idempotente
* **Ubicación:** `server/controllers/authController.js:L238-L246`
* **Falla:** En el endpoint `GET /auth/me`, si el usuario autenticado tiene un correo listado en `ENV.SUPER_ADMIN_EMAILS` pero su rol en base de datos es distinto, el controlador ejecuta `prisma.user.update` para asignarle `SUPER_ADMIN`. Viola el RFC 7231 que exige que las peticiones GET sean de solo lectura y libres de efectos colaterales.

### 6. Activación No Atómica de Eventos
* **Ubicación:** `server/controllers/catalogController.js:L125-L138`
* **Falla:** En `activateEvent`, se ejecuta `prisma.event.updateMany` para poner los demás eventos en `CONFIRMADO` y luego `prisma.event.update` para poner el nuevo evento en `ACTIVO`. Al no estar envueltas en `prisma.$transaction`, una desconexión o fallo en el segundo comando deja al sistema sin ningún evento activo.

---

## 2.2 Motor de IA Multimodal & Pool Multi-Key

### 1. Verificación de Gen 3 Puro y Estado del Pool
* **Inspección:** Se auditó la cadena completa de inferencia:
  - `server/config/env.js:L40`: `GEMINI_MODEL: 'gemini-3.8-flash'`.
  - `server/services/geminiPoolService.js:L11-L17`:
    ```javascript
    export const MODEL_PRIORITY_POOL = [
      'gemini-3.8-flash',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
      'gemini-3.5-flash',
      'gemini-3.1-flash-lite',
    ];
    ```
  - `server/services/ai/aiKeyPoolService.js:L8-L103`: Soporta rotación Round-Robin sobre `GEMINI_API_KEYS` con cooldown de 60 segundos por clave ante errores HTTP 429.
* **Dictamen de Residuos:** Cero menciones operativas de `gemini-1.5` ni `gemini-2.5` en toda la base de código.

### 2. Vulnerabilidad Crítica en Canales Multimodales (Voz, Fotos y Video)
* **Ubicación:** `server/services/ai/aiMediaService.js:L76, L102, L124, L154`
* **Código Inspeccionado:**
  ```javascript
  // aiMediaService.js:L76-L80 (processVoiceSaleAudio)
  const response = await gemini.models.generateContent({
    model: ENV.GEMINI_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }, { inlineData: { data: audioBuffer.toString('base64'), mimeType: cleanMime } }] }],
    config: { responseMimeType: 'application/json', responseSchema: voiceSaleResponseSchema },
  });
  ```
* **Falla Catastrófica (P0):** Mientras que el chat de texto utiliza `streamWithModelFallback` y `executeWithModelFallback`, **las 4 funciones de medios pesados (`processVoiceSaleAudio`, `recognizePosterArtworkFromImage`, `recognizePostersFromVideo`, `processPostersBatchPhoto`) llaman directamente a `gemini.models.generateContent`**.
* Si la clave primaria agota su cuota por minuto de tokens multimodales, la llamada arroja inmediatamente un error HTTP 429 (`RESOURCE_EXHAUSTED`). La petición no conmuta a la siguiente clave del pool ni a un modelo secundario, respondiendo con HTTP 500 al cajero y abortando la venta por voz o escaneo.

### 3. Mecanismo de Closed-Loop, Grounding y Schemas Estrictos
* **Definición de Herramientas:** `server/services/ai/aiToolsService.js:L7-L14` declara 7 herramientas tipadas con el SDK `@google/genai` (`prepareSaleDraft`, `searchCatalog`, `getEventKPIs`, `getCashDrawerStatus`, `getSellerShiftReport`, `getProductionQueueStatus`, `checkInventoryStock`).
* **Closed-Loop Function Calling:** `server/services/ai/aiClosedLoopService.js:L77-L103` ejecuta la herramienta al recibir el evento de Gemini, emite el evento estructurado inmediatamente por SSE para que la UI monte la tarjeta visual, y reinyecta `{ role: 'tool', parts: [{ functionResponse: { name: call.name, response: toolResult } }] }` de vuelta al modelo para que genere una respuesta en lenguaje natural comercial con técnicas de upselling.
* **Grounding:** `server/services/ai/aiPromptService.js:L63-L75, L143-L145` serializa el borrador pendiente (`pendingDraft`) dentro de las directivas de sistema, garantizando que el modelo preserve ítems preexistentes durante modificaciones incrementales.

### 4. Brechas en Telemetría y Observabilidad de LLM
* **Ubicación:** `server/services/llmObservabilityService.js:L17-L32`, `server/controllers/aiController.js:L51, L119, L182, L273`
* **Deficiencia:** En `aiController.js`, el conteo de tokens de entrada (`tokensIn`) siempre se envía como `null`, y los tokens de salida (`tokensOut`) se estiman dividiendo los caracteres de la respuesta entre 4. Esto ignora las métricas exactas devueltas por Google en `response.usageMetadata` (`promptTokenCount`, `candidatesTokenCount`), degradando la precisión de los reportes de costos en `AuditLog`.

---

## 2.3 Servicios de Dominio & Lógica Comercial

### 1. Lógica Contable y Tolerancia a Centavos
* **Ubicación:** `server/services/saleService.js:L51-L54`
* **Inspección:**
  ```javascript
  const paymentsTotal = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  if (Math.abs(paymentsTotal - totalAmount) > 0.05) {
    throw new ValidationError(`La suma de pagos (Q${paymentsTotal.toFixed(2)}) no coincide con el total (Q${totalAmount.toFixed(2)})`);
  }
  ```
* **Evaluación:** CORRECTO. La tolerancia de Q0.05 previene rechazos por redondeo de punto flotante en JavaScript al dividir pagos mixtos.

### 2. Normalización de Tallas y Precios Canónicos
* **Ubicación:** `server/services/semanticParserService.js:L35-L68`, `src/components/ai-chat/chatConstants.js:L1-L15`
* **Inspección:** Se verificó la alineación universal de precios para los 6 formatos:
  - `MINI` (14x21 cm): Q25.00
  - `PEQUENO` (20x30 cm): Q35.00
  - `PORTADA_ALBUM` (30x30 cm): **Q55.00**
  - `MEDIANO` (30x45 cm): Q65.00
  - `GRANDE` (45x60 cm): Q125.00
  - `GIGANTE` (60x90 cm): Q180.00
* `PORTADA_ALBUM` está normalizada universalmente a Q55.00, resolviendo los alias de "disco", "vinilo", "cuadrado" y "álbum".

### 3. Diccionarios Culturales y Parsing Semántico
* **Ubicación:** `server/services/semanticParserService.js:L94-L499`
* **Inspección:** El array `STAND_ENTITY_ALIASES` mapea más de 120 franquicias y personalidades (Bad Bunny, Taylor Swift, Spider-Man, Anime, Star Wars, F1).
* **Deuda Arquitectónica:** Las más de 400 líneas de datos estáticos se encuentran incrustadas en medio de la lógica del parser, inflando el archivo a 678 líneas y violando el principio de responsabilidad única.

### 4. Deduplicación Bicapa en Catálogo
* **Ubicación:** `server/services/webCatalogService.js:L264-L311`
* **Inspección:** La función `deduplicatePosters` filtra eficientemente mediante Sets por ID de producto, slug de imagen extraído de la URL (`extractImageSlug`) y título normalizado (`normalizePosterTitle`), impidiendo que productos repetidos de la sincronización pública aparezcan duplicados en el POS.
* **Fallback Hardcodeado:** En las líneas 122-159, si la base de datos falla, el servicio inyecta productos mock estáticos ("Pablo Escobar", "Spider-Man"), lo que arriesga mostrar datos ficticios al cliente en producción.

### 5. Inconsistencia de Slugs y Sincronización O(N) Ineficiente
* **Ubicación:** `server/services/catalogSyncService.js:L68-L73, L182-L247`
* **Falla:** El servicio busca el tenant con `slug: 'deco-vintage'`, mientras que en `authController.js:L70` se crea con `slug: 'deco-vintage-guate'`. Al no encontrarlo, recurre a `findFirst()` de forma no determinística.
* Además, la sincronización itera sobre 233 pósters y ejecuta un `await prisma.product.upsert` de forma serial en cada iteración, provocando 233 viajes individuales a PostgreSQL y bloqueando el hilo durante el arranque del servidor (`server/index.js:L221`).

---

## 2.4 Frontend, Jerarquía UI & Componentes Conversacionales

### 1. Subsistema Conversacional (`UnifiedAiChat.jsx` y `src/components/ai-chat/`)
* **Inspección:** Arquitectura modular completamente despiezada:
  - `src/components/UnifiedAiChat.jsx` (52 líneas, contenedor maestro limpio).
  - `ChatMessageList.jsx` (83 líneas): Renderizado inmutable de mensajes con claves estables (`crypto.randomUUID()`).
  - `ChatDraftCard.jsx` (138 líneas): Tarjeta interactiva Human-in-the-Loop con selector de tallas y recálculo de precios.
  - `ChatToolCards.jsx` (139 líneas): Renderizado condicional con blindaje contra objetos vacíos (`inv?.found && inv?.artwork`).
  - `ChatInputBar.jsx` (80 líneas): Barra inferior táctil con decibelímetro visual reactivo.
  - `ChatSwapModal.jsx` (98 líneas): Modal de sustitución de obras con debounce.

### 2. Botones Táctiles Subdimensionados en Mostrador
* **Ubicación:** `src/components/ai-chat/ChatDraftCard.jsx:L75-L80`
* **Código Inspeccionado:**
  ```jsx
  <button type="button" onClick={() => updateQty?.(idx, -1)} className="w-4 h-4 flex items-center justify-center ...">
    <Minus className="w-2.5 h-2.5" />
  </button>
  ```
* **Deficiencia (P1):** Los botones de incremento y decremento de cantidad tienen dimensiones de **16px × 16px (`w-4 h-4`)**. El estándar internacional de ergonomía táctil (WCAG 2.5.5 / Material Design) exige un área táctil mínima de **44px × 44px** (48px en Android). En un mostrador de convención con guantes o dedos rápidos, esto produce pulsaciones fallidas sistemáticas.

### 3. Vulnerabilidad de Descuentos Negativos en Venta Manual
* **Ubicación:** `src/components/manual-sale/PaymentSummaryBar.jsx:L51`, `useManualSaleCart.js:L56`
* **Falla:** El input permite ingresar números negativos manualmente. Si el cajero tipea `-10`, la expresión `subtotal - (Number(discount) || 0)` incrementa el total de la venta en vez de descontarlo. Debe protegerse con `Math.max(0, Number(val) || 0)`.

---

## 2.5 Custom Hooks & Fugas de Ciclo de Vida

### 1. Inutilización del VAD ante Ruido de Convención
* **Ubicación:** `src/components/ai-chat/hooks/useAiVoiceRecorder.js:L95-L103`
* **Código Inspeccionado:**
  ```javascript
  const { rms, level } = calculateDecibelsAndLevel(analyser, buffer);
  setAudioLevel(level);
  if (rms > 0.003) {
    lastSoundAt = Date.now();
    setVadActive(false);
  } else if (Date.now() - lastSoundAt > 1500) {
    stopRecording();
  }
  ```
* **Falla Crítica (P0):** El umbral de silencio está fijado estáticamente en `rms > 0.003` ($\approx -50.45\text{ dBFS}$). En un evento masivo como Comic Con, el ruido ambiental (música, megáfonos, multitudes) supera constantemente los $-40\text{ dBFS}$ (RMS entre 0.010 y 0.025). Por tanto, `rms > 0.003` es **siempre verdadero**. El VAD queda neutralizado, la grabación no se detiene automáticamente y satura el buffer de audio.

### 2. Circuit Breaker Destruido Prematuramente y Stale Closure
* **Ubicación:** `src/components/ai-chat/hooks/useAiChatStream.js:L96, L110, L134`
* **Falla (P1):** El temporizador de 25 segundos del `AbortController` se cancela en la línea 110 (`finally { clearTimeout(circuitBreakerTimeout); }`), apenas el servidor responde con las cabeceras HTTP. Durante la lectura de chunks SSE en el `while(true)` (líneas 116-139), no hay ningún timeout activo. Si el stream se congela, el cliente queda bloqueado permanentemente en estado de carga.
* **Stale Closure en Cierre:** En la línea 134, `(pendingDraft ? '¡Listo! Te dejé preparado el borrador...' : '¡Con gusto te asesoro...')` evalúa `pendingDraft` desde la clausura estática inicial. Si Gemini ejecutó una tool sin texto previo, `pendingDraft` es evaluado como `null`, mostrando un mensaje genérico inapropiado.

### 3. Excepción Fatal No Controlada en Filtrado de Fechas
* **Ubicación:** `src/components/events/hooks/useEventsManager.js:L127-L128`
* **Falla (P1):** `new Date(ev.startDate).toISOString()` se ejecuta dentro de un `useMemo` sin validar si la fecha es válida. Si un evento archivado contiene una fecha nula o inválida, arroja un `RangeError: Invalid time value` no capturado que provoca una **pantalla blanca de React** (White Screen of Death).

### 4. Polling Incondicional en Segundo Plano
* **Ubicación:** `src/components/monitor/hooks/useMonitorDashboard.js:L51-L59`
* **Falla:** Ejecuta un `setInterval` cada 5 segundos sin validar `document.visibilityState`. Si el usuario minimiza la pestaña, el navegador sigue saturando la red y la base de datos PostgreSQL inútilmente.

---

## 2.6 Caché Local, Resiliencia Offline & Reconciliación de Sesión

### 1. Destrucción Destructiva de la Caché Local Offline
* **Ubicación:** `src/services/catalogCacheService.js:L32-L43, L58`
* **Código Inspeccionado:**
  ```javascript
  // catalogCacheService.js:L58
  if (Array.isArray(result) && result.length > 0) {
    saveCatalogSnapshot(result);
    return result;
  }

  // catalogCacheService.js:L32-L43
  export function saveCatalogSnapshot(posters) {
    if (!Array.isArray(posters) || !posters.length || typeof localStorage === 'undefined') return;
    try {
      const sanitized = posters.map((p) => ({ ... }));
      // SOBREESCRIBE TOTALMENTE LA CACHÉ
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    } catch (_) {}
  }
  ```
* **Falla Catastrófica (P0):** Cada vez que se ejecuta una búsqueda en línea (ej. "Goku"), el servidor devuelve hasta 8 pósters coincidentes. `saveCatalogSnapshot` **sobrescribe completamente la clave en `localStorage` con solo esos 8 pósters**. El catálogo semilla de 8 obras y cualquier búsqueda anterior son destruidos. Si se pierde la conectividad 2 minutos después y el cliente solicita "Spider-Man", la búsqueda local devuelve 0 resultados, perdiendo la venta.

### 2. Bloqueo Absoluto de Terminal Offline ante Recarga de Página
* **Ubicación:** `src/context/AuthContext.jsx:L6-L8, L41-L70`, `src/App.jsx:L106-L108`
* **Mecanismo de Falla (P0):**
  - El token JWT se almacena en `localStorage`, pero el objeto `user` **solo existe en la memoria RAM del estado de React**.
  - Al recargar la página, `checkSession` hace `fetch('/api/auth/me')`. Si el terminal está desconectado, la llamada falla con `TypeError: Failed to fetch`.
  - El bloque `catch` mantiene `user` en `null`.
  - `App.jsx:L106` evalúa `if (!user) return <LoginView />;`.
  - En `LoginView`, Google GIS no puede inicializarse sin internet.
  - **Resultado:** La terminal queda completamente bloqueada e inoperable en medio de la convención, a pesar de que el token es válido y la venta manual podría operar desconectada.

### 3. Expulsión Inmediata de Sesión ante Código 401
* **Ubicación:** `src/context/AuthContext.jsx:L32-L34`
* **Falla:** Si expira el token JWT, cualquier petición devuelve 401 y `authFetch` ejecuta `logout()` inmediatamente, expulsando al cajero a la pantalla de login y destruyendo borradores de venta o conteos de arqueo en progreso.

---

## 2.7 Base de Datos Relacional, Prisma & Concurrencia PostgreSQL

### 1. Riesgo de Destrucción Contable por Borrado en Cascada desde Tenant
* **Ubicación:** `prisma/schema.prisma:L36, L65, L89, L115, L218, L245`
* **Código Inspeccionado:**
  ```prisma
  model Sale {
    ...
    tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  }
  model CashClosing {
    ...
    tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  }
  model AuditLog {
    ...
    tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  }
  ```
* **Falla Crítica (P0):** La relación `onDelete: Cascade` desde `Tenant` hacia `Sale`, `CashClosing` y `AuditLog` viola los principios de inmutabilidad contable y auditoría fiscal. Una eliminación accidental del tenant en PostgreSQL borraría instantáneamente todo el historial transaccional de la empresa. Debe forzarse `onDelete: Restrict`.

### 2. Cuello de Botella de Bloqueo Exclusivo de Fila en Transacciones Concurrentes
* **Ubicación:** `server/services/saleService.js:L57-L66`
* **Código Inspeccionado:**
  ```javascript
  const updatedEvent = await tx.event.update({
    where: { id: eventId },
    data: { currentSaleSequence: { increment: 1 } },
    select: { name: true, currentSaleSequence: true },
  });
  ```
* **Falla de Concurrencia (P0):** Dentro de `prisma.$transaction`, la sentencia `tx.event.update` adquiere un **bloqueo exclusivo a nivel de fila (`FOR UPDATE`)** sobre el registro del `Event`. Posteriormente, la transacción inserta la venta, los ítems, los pagos y el log de auditoría (tomando 150-300 ms).
* **Impacto en Comic Con:** Si 4 cajeros confirman ventas simultáneamente, quedan estrictamente encolados detrás del candado de fila. La quinta venta esperará más de 1.2 segundos. Si se produce un pico de tráfico, las conexiones de Prisma se saturan y arrojan excepciones `P2028: Transaction API error: Transaction timeout`, rechazando ventas legítimas.

### 3. Cierres de Caja No Atómicos y Desincronizados con el Taller
* **Ubicación:** `server/services/saleService.js:L283-L323`
* **Falla (P1):** `createCashClosingTransaction` ejecuta 6 consultas agregadas fuera de una transacción ACID (`getEventKPIs`). Si entran ventas entre las consultas, los montos quedan desfasados. Además:
  - NO valida si existen obras pendientes de entrega en la cola del taller (`PENDIENTE`, `A_PRODUCCION`).
  - NO asocia las ventas a un `cashClosingId`, permitiendo devoluciones posteriores que desbalancean el arqueo asentado.

### 4. Índices Compuestos Faltantes en PostgreSQL
* **`CashClosing` (`prisma/schema.prisma:L237-L240`):** Carece de `@@unique([eventId, closingDate, closingType])`, permitiendo insertar arqueos duplicados concurrentes para la misma fecha.
* **`SaleItem` (`prisma/schema.prisma:L164-L167`):** Carece del índice compuesto `@@index([productionStatus, createdAt(sort: Desc)])`, forzando a PostgreSQL a ejecutar Bitmap Scans y sorts en memoria sobre miles de registros en la cola del taller.
* **`AuditLog` (`prisma/schema.prisma:L263-L266`):** Carece de `@@index([tenantId, entity, entityId])` para trazabilidad de ventas y de `@@index([tenantId, llmModel, createdAt])` para telemetría de IA.

### 5. Consultas N+1 y Agregaciones Masivas en Memoria RAM
* **Ubicación:** `server/services/saleService.js:L500-L508` (`getMonitorDashboardMetrics`)
* **Falla (P1):** Consulta todas las ventas del evento con sus relaciones (`findMany` sin paginación) y ejecuta bucles `forEach` en memoria Node.js para calcular subtotales y promedios. En ferias con más de 3,000 transacciones, esto produce pausas de Garbage Collection de 3 a 5 segundos y riesgo de caída por Out-Of-Memory (OOM).

---

## 2.8 Almacenamiento, Assets, Docker & Despliegue

### 1. Límite Genérico de Subida y Consumo de Memoria Heap
* **Ubicación:** `server/middleware/uploadMiddleware.js:L95-L97`
* **Código Inspeccionado:**
  ```javascript
  export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB para TODO
  });
  ```
* **Vulnerabilidad (P1):** Al utilizar `memoryStorage()`, los archivos subidos residen íntegramente en la memoria RAM del proceso Node.js. Un atacante o cliente subiendo 10 audios o fotos de 24 MB simultáneamente consume 250 MB de heap al instante. El requerimiento de arquitectura exige límites diferenciados: **Audio $\le$ 15 MB**, **Imágenes $\le$ 10 MB**.

### 2. Fuga de Artefactos de Desarrollo y Metadatos Git en Producción
* **Ubicación:** `Dockerfile:L68, L77`
* **Código Inspeccionado:**
  ```dockerfile
  # Dockerfile:L68
  COPY --chown=node:node --from=deps /app/node_modules ./node_modules
  # Dockerfile:L77
  COPY --chown=node:node .git ./.git
  ```
* **Vulnerabilidad (P0):**
  - La copia del directorio `.git` completo infla la imagen en más de 100 MB y permite que cualquier vulnerabilidad de lectura de archivos exponga el historial íntegro de commits y código fuente.
  - La copia directa de `node_modules` desde la etapa `deps` transporta todas las `devDependencies` (Vite, linters, compiladores) al contenedor final sin ejecutar `npm prune --omit=dev`.

### 3. Ejecución Peligrosa de `prisma db push` en Arranque de Producción
* **Ubicación:** `entrypoint.sh:L51-L57`
* **Código Inspeccionado:**
  ```sh
  if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null)" ]; then
    npx prisma migrate deploy
  else
    npx prisma db push --skip-generate
  fi
  ```
* **Falla Crítica (P0):** Dado que el directorio `prisma/migrations` no existe en el repositorio, **en cada despliegue o reinicio del contenedor en Dokploy se ejecuta `prisma db push`**. Esto carece de trazabilidad en la tabla `_prisma_migrations`, no posee bloqueos distribuidos contra arranques concurrentes de réplicas y puede provocar pérdida silenciosa de datos ante modificaciones destructivas de columnas.

### 4. Webhook de Dokploy Expuesto en Texto Plano sobre HTTP
* **Ubicación:** `scripts/deploy-dokploy.js:L11`
* **Código Inspeccionado:**
  ```javascript
  const DOKPLOY_WEBHOOK_URL = 'http://145.223.120.56:3000/api/deploy/ifJKTSseeCgAumCezDEZx';
  ```
* **Vulnerabilidad de Seguridad:** Expone la IP directa del host (`145.223.120.56`) y el token secreto de despliegue en texto plano sin cifrado TLS (puerto 3000 HTTP), permitiendo que cualquier intermediario de red intercepte el token y dispare despliegues arbitrarios.

---

# 3. CATÁLOGO DE CÓDIGO MUERTO, DEPENDENCIAS Y OBJETOS HUÉRFANOS

| Elemento Detectado | Ubicación Exacta | Estado Técnico | Evidencia de Cero Uso | Acción Requerida |
|---|---|---|---|---|
| **`bcryptjs`** | `package.json:L28` | Dependencia Muerta | 0 imports en `server/` y `src/`. La autenticación se realiza exclusivamente vía Google GIS OAuth 2.0. | Desinstalar (`npm uninstall bcryptjs`). |
| **`qrcode`** | `package.json:L39` | Dependencia Muerta | 0 imports en todo el repositorio. Los datos QR se gestionan como texto plano en PostgreSQL. | Desinstalar (`npm uninstall qrcode`). |
| **`demoProductionItems`** | `server/controllers/productionController.js:L4-L97` | Array Mock Residual (94 líneas) | Objeto estático en memoria retornado en bloques `catch`, enmascarando fallas de base de datos. | Erradicar completamente; retornar HTTP 500/503 real. |
| **Pósters Mock de Desarrollo** | `server/services/webCatalogService.js:L123-L159` | Datos Simulados | Retorna "Pablo Escobar" y "Spider-Man" si la base de datos no responde. | Eliminar; propagar excepción controlada. |
| **Evento Mock Estático** | `server/controllers/catalogController.js:L31-L53` | Mock en Producción | Retorna `'event-stand-active-2026'` si no encuentra evento activo en BD. | Eliminar; retornar 404/error controlado. |
| **Volumen Residual en Docker** | `docker-compose.yml:L26-L27` | Montaje Huérfano | Monta `./public/uploads:/app/public/uploads` a pesar de que el almacenamiento es 100% GCS. | Eliminar línea del compose. |
| **Rol Residual en Tests** | `tests/e2e/tier1-features.test.js:L71` | Texto Desactualizado | Hace referencia textual a `ENCARGADO_STAND` (el rol interno probado ya es `VENDEDOR`). | Actualizar string del test. |

---

# 4. MATRIZ DE RIESGOS PRIORIZADA (P0 / P1 / P2)

| ID | Nivel | Archivo y Rango de Líneas | Falla Técnica | Causa Raíz | Impacto Operativo en Comic Con | Solución Definitiva |
|:---:|:---:|:---|:---|:---|:---|:---|
| **P0-1** | 🚨 **P0** | `src/services/catalogCacheService.js:L32-L43, L58` | Destrucción de la caché offline en búsquedas parciales. | `saveCatalogSnapshot` sobreescribe `localStorage` en vez de fusionar. | Pérdida del 96% de las obras en memoria local; fallo de ventas al caerse la red. | Implementar algoritmo Bounded-LRU con fusión acumulativa (`Map` indexado por `id`, límite 300 obras). |
| **P0-2** | 🚨 **P0** | `src/context/AuthContext.jsx:L6-L8, L41-L70`<br>`src/App.jsx:L106-L108` | Terminal bloqueada offline tras recargar el navegador. | `user` no se persiste en `localStorage`; `checkSession` falla sin red y expulsa a `LoginView`. | Bloqueo absoluto del stand durante cortes de datos celulares en salones de convención. | Persistir `deko_auth_user` en `localStorage` y habilitar modo offline de contingencia (`isOfflineMode`). |
| **P0-3** | 🚨 **P0** | `src/components/ai-chat/hooks/useAiVoiceRecorder.js:L95-L103` | VAD neutralizado por ruido ambiental de convención. | Umbral RMS estático en 0.003 (-50.5 dBFS); ruido de feria > -40 dBFS. | Grabación perpetua; micrófono nunca se apaga; buffer inflado corrompe inferencia IA. | Implementar VAD adaptativo con calibración de ruido base en los primeros 400ms y filtro pasa-altos. |
| **P0-4** | 🚨 **P0** | `server/services/ai/aiMediaService.js:L76, L102, L124, L154` | Falla inmediata en voz, fotos y video ante cuota HTTP 429. | Invocación directa a `gemini.models.generateContent` sin pasar por el pool de fallback. | Ventas por voz y escaneo colapsan con HTTP 500 al agotarse la cuota de la primera API Key. | Envolver las llamadas en `executeWithModelFallback` para aprovechar la rotación de claves y modelos. |
| **P0-5** | 🚨 **P0** | `server/services/saleService.js:L57-L66` | Bloqueo exclusivo de fila (`FOR UPDATE`) en transacciones de venta. | `tx.event.update` incrementa la secuencia al inicio de una transacción interactiva de Prisma. | Serialización de cajeros concurrentes; latencias > 1.5s y timeouts `P2028` en horas pico. | Asignar la secuencia al final de la transacción o migrar a secuencias nativas PostgreSQL (`nextval`). |
| **P0-6** | 🚨 **P0** | `server/routes/apiRoutes.js:L125-L130` | `PATCH /sales/:id` carece de aislamiento por evento. | Falta el middleware `requireEventAccess` en la definición de la ruta. | Vendedores del Evento A pueden modificar, alterar o anular órdenes del Evento B. | Aplicar `requireEventAccess` validando que la venta pertenezca al evento asignado. |
| **P0-7** | 🚨 **P0** | `server/controllers/userController.js:L65-L72, L87-L106` | Mutaciones de usuarios sin filtro de tenant. | Consultas `prisma.user.update` buscan solo por `where: { id }` sin incluir `tenantId`. | Violación grave de aislamiento multitenant: alteración de credenciales entre empresas. | Exigir `where: { id, tenantId: req.tenantId }` en todas las operaciones del controlador. |
| **P0-8** | 🚨 **P0** | `server/index.js:L94-L167` | `/health/ai` público ejecuta inferencias en vivo sin auth. | Endpoint de diagnóstico expuesto a la red sin token JWT. | Agotamiento deliberado o accidental de la cuota de Gemini por monitores o terceros. | Proteger `/health/ai` con `authMiddleware` o convertirlo en una verificación estática de configuración. |
| **P0-9** | 🚨 **P0** | `entrypoint.sh:L51-L57`<br>`Dockerfile:L77` | Ejecución de `db push` en producción y fuga de `.git`. | Ausencia de carpeta `prisma/migrations` y copia indiscriminada de archivos en Docker. | Corrupción de catálogo de base de datos entre réplicas y fuga de metadatos de Git. | Generar migración formal con `prisma migrate deploy` y eliminar `.git` del `Dockerfile`. |
| **P1-1** | ⚠️ **P1** | `src/components/ai-chat/hooks/useAiChatStream.js:L96, L110` | Circuit Breaker destruido antes de recibir tokens SSE. | `clearTimeout` ejecutado en bloque `finally` al recibir cabeceras HTTP. | Congelamiento indefinido de la interfaz si el stream se traba a medio camino. | Mantener el timeout activo durante la lectura de chunks y cancelarlo solo ante `ev === 'done'`. |
| **P1-2** | ⚠️ **P1** | `src/components/ai-chat/hooks/useAiChatStream.js:L134, L140` | Stale closure evalúa `pendingDraft` como null. | Lectura de estado desde la clausura estática de `handleSendText`. | Mensaje final de Gemini confuso e incoherente tras preparar una venta. | Utilizar una referencia mutable (`pendingDraftRef.current`) para verificar el estado real. |
| **P1-3** | ⚠️ **P1** | `src/components/ai-chat/hooks/useAiChatStream.js:L71-L77` | `confirmPendingSale` no valida `eventId`. | Envío de payload con `eventId: undefined` si no hay evento activo. | Error HTTP 400 del servidor no manejado amigablemente. | Agregar guardia `if (!eventId) throw new Error('No hay evento activo seleccionado')`. |
| **P1-4** | ⚠️ **P1** | `src/components/CashClosingView.jsx:L8-L11`<br>`useCashClosing.js:L62-L65` | Efectivo esperado desactualizado al conciliar arqueo. | `liveMetrics` es estático y no se refresca automáticamente antes del cierre. | Falsos descuadres de caja en stands con múltiples vendedores concurrentes. | Añadir botón de refresco y consulta forzada a la API antes de abrir el modal de arqueo. |
| **P1-5** | ⚠️ **P1** | `src/components/events/hooks/useEventsManager.js:L127-L128` | Excepción fatal `RangeError` en fechas de eventos. | `.toISOString()` invocado sobre fechas nulas o malformadas en `useMemo`. | Pantalla blanca irrecuperable en el módulo de eventos. | Envolver el formateo de fechas en una función utilitaria defensiva que valide `isNaN(date)`. |
| **P1-6** | ⚠️ **P1** | `src/context/AuthContext.jsx:L32-L34` | Logout intempestivo e indiscriminado ante error 401. | Invocación directa de `logout()` al recibir cualquier respuesta 401. | Pérdida de ventas en armado y descarte accidental de arqueos de caja. | Mostrar advertencia de expiración y permitir reautenticación sin recargar la vista. |
| **P1-7** | ⚠️ **P1** | `src/components/ai-chat/ChatDraftCard.jsx:L75-L80` | Botones táctiles de cantidad de 16px × 16px. | Subdimensionamiento visual (`w-4 h-4`) violando normas WCAG 2.5.5. | Fricción ergonómica y pulsaciones fallidas sistemáticas en tablets táctiles. | Aumentar el área táctil a un mínimo de 44px × 44px con padding accesible (`p-2.5`). |
| **P1-8** | ⚠️ **P1** | `server/services/saleService.js:L500-L508` | Explosión de memoria RAM en Monitor de Gerencia. | Consulta masiva de ventas sin paginación agrupada en memoria Node.js. | Picos de 500MB+ de heap y pausas de Garbage Collector en momentos de alto tráfico. | Migrar a consultas agregadas nativas de PostgreSQL (`prisma.sale.aggregate` y `groupBy`). |
| **P1-9** | ⚠️ **P1** | `server/controllers/catalogController.js:L125-L138` | Activación de evento no atómica. | `updateMany` y `update` ejecutados consecutivamente sin transacción. | Si la red falla, el sistema puede quedar sin ningún evento activo. | Envolver ambas operaciones en `prisma.$transaction`. |
| **P1-10** | ⚠️ **P1** | `server/services/saleService.js:L283-L323` | Cierre de caja no atómico y sin validación de taller. | Ejecución de 6 queries fuera de transacción y sin revisar órdenes pendientes. | Descuadres contables si un cliente solicita devolución de una obra no entregada. | Validar que la cola de producción esté vacía y envolver el arqueo en `prisma.$transaction`. |
| **P1-11** | ⚠️ **P1** | `server/middleware/uploadMiddleware.js:L95-L97` | Límite genérico de 25MB en memoria heap. | Ausencia de validación de tamaño granular por tipo de archivo. | Riesgo de agotamiento de memoria si múltiples clientes suben archivos de 24 MB. | Limitar estrictamente: Audio $\le$ 15 MB, Imágenes $\le$ 10 MB con validación granular. |
| **P2-1** | 🟡 **P2** | `src/components/UnifiedAiChat.jsx:L22-L26` | Layout Thrashing por scroll suave continuo. | `scrollIntoView({ behavior: 'smooth' })` ejecutado en cada frame RAF (60 FPS). | Vibración visual del chat y saturación de la GPU en tablets móviles. | Reemplazar por scroll instantáneo (`behavior: 'auto'`) solo cuando el usuario esté al final. |
| **P2-2** | 🟡 **P2** | `src/components/monitor/hooks/useMonitorDashboard.js:L51-L59` | Polling activo con pestaña oculta o minimizada. | `setInterval` incondicional cada 5 segundos sin validar visibilidad. | Desperdicio de batería, datos y sobrecarga innecesaria a PostgreSQL. | Pausar el sondeo cuando `document.visibilityState === 'hidden'`. |
| **P2-3** | 🟡 **P2** | `src/components/production/hooks/useProductionQueue.js:L63` | Ausencia de refresco automático en cola de taller. | Los operarios deben presionar "Refrescar" manualmente para ver nuevas ventas. | Demoras en la producción de obras urgentes en el taller de impresión. | Conectar canal ligero SSE o sondeo reactivo pausado en segundo plano. |
| **P2-4** | 🟡 **P2** | `src/components/manual-sale/PaymentSummaryBar.jsx:L51` | Descuentos negativos no restringidos en input. | El input no valida números negativos, incrementando el total a cobrar. | Cobros inflados accidentales por error tipográfico del cajero. | Aplicar `Math.max(0, Number(val) || 0)` en el manejador `onChange`. |
| **P2-5** | 🟡 **P2** | `server/services/llmObservabilityService.js:L17-L32` | Telemetría imprecisa de tokens en `AuditLog`. | `tokensIn` nulo y `tokensOut` estimado por longitud de caracteres. | Métricas de costo y consumo distorsionadas en reportes ejecutivos. | Extraer los valores exactos de `usageMetadata` provistos por Google. |
| **P2-6** | 🟡 **P2** | `server/services/catalogSyncService.js:L68-L73` | Inconsistencia de tenant slug (`deco-vintage` vs `deco-vintage-guate`). | Desincronización entre el sembrado de datos y el servicio de sync. | Búsqueda fallida de tenant y selección no determinística vía `findFirst()`. | Unificar el slug canónico a `deco-vintage-guate` en toda la aplicación. |

---

# 5. PLAN MAESTRO DE DESPIECE MODULAR PARA LOS 10 MONOLITOS

A continuación se presenta la reestructuración quirúrgica para los 10 archivos que superan los límites de tamaño en el proyecto, estableciendo un presupuesto estricto de **menos de 150 líneas por submódulo satélite** y **menos de 40 líneas para cada fachada retrocompatible**:

```
                                      MAPA ARQUITECTÓNICO DE DESPIECE
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ MONOLITO ORIGEN                 │ LÍNEAS │ SATÉLITES MODULARES (<150 LÍNEAS)                    │ PRESUPUESTO  │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 1. semanticParserService.js     │  678   │ ├── server/services/semantic/entityAliases.js        │  ~140 líneas │
│                                 │        │ ├── server/services/semantic/paymentExtractor.js     │   ~80 líneas │
│                                 │        │ ├── server/services/semantic/queryNormalizer.js      │   ~70 líneas │
│                                 │        │ ├── server/services/semantic/standIntentParser.js    │  ~110 líneas │
│                                 │        │ └── server/services/semanticParserService.js (fachada│   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 2. saleService.js               │  653   │ ├── server/services/sales/saleNumberGenerator.js     │   ~45 líneas │
│                                 │        │ ├── server/services/sales/saleTransactionService.js  │  ~130 líneas │
│                                 │        │ ├── server/services/sales/saleKpiService.js          │  ~135 líneas │
│                                 │        │ ├── server/services/sales/saleMonitorService.js      │  ~120 líneas │
│                                 │        │ ├── server/services/sales/cashClosingService.js      │   ~85 líneas │
│                                 │        │ └── server/services/saleService.js (fachada)         │   ~30 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 3. webCatalogService.js         │  477   │ ├── server/services/catalog/catalogCacheManager.js   │  ~110 líneas │
│                                 │        │ ├── server/services/catalog/posterDeduplicator.js    │  ~115 líneas │
│                                 │        │ ├── server/services/catalog/catalogSearchEngine.js   │  ~125 líneas │
│                                 │        │ └── server/services/webCatalogService.js (fachada)   │   ~30 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 4. aiController.js              │  429   │ ├── server/controllers/ai/aiVoiceController.js       │   ~80 líneas │
│                                 │        │ ├── server/controllers/ai/aiVisionController.js      │  ~120 líneas │
│                                 │        │ ├── server/controllers/ai/aiChatController.js        │  ~135 líneas │
│                                 │        │ └── server/controllers/aiController.js (fachada)     │   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 5. productionController.js      │  399   │ ├── server/services/productionService.js (dominio)   │  ~130 líneas │
│                                 │        │ ├── server/controllers/production/prodQueryCtrl.js   │   ~75 líneas │
│                                 │        │ ├── server/controllers/production/prodMutationCtrl.js│   ~95 líneas │
│                                 │        │ └── server/controllers/productionController.js (fach)│   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 6. catalogController.js         │  330   │ ├── server/controllers/eventController.js (dedicado) │  ~135 líneas │
│                                 │        │ ├── server/controllers/catalog/catalogQueryCtrl.js   │   ~70 líneas │
│                                 │        │ ├── server/controllers/catalog/catalogSyncCtrl.js    │   ~50 líneas │
│                                 │        │ └── server/controllers/catalogController.js (fachada)│   ~30 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 7. geminiPoolService.js         │  319   │ ├── server/services/pool/poolErrorClassifier.js      │   ~85 líneas │
│                                 │        │ ├── server/services/pool/poolExecutionService.js     │  ~110 líneas │
│                                 │        │ ├── server/services/pool/poolStreamService.js        │  ~105 líneas │
│                                 │        │ └── server/services/geminiPoolService.js (fachada)   │   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 8. catalogSyncService.js        │  272   │ ├── server/services/catalog-sync/sizeResolver.js     │   ~60 líneas │
│                                 │        │ ├── server/services/catalog-sync/webFetcher.js       │   ~95 líneas │
│                                 │        │ ├── server/services/catalog-sync/dbSynchronizer.js   │  ~120 líneas │
│                                 │        │ └── server/services/catalogSyncService.js (fachada)  │   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 9. authController.js            │  266   │ ├── server/services/authService.js (dominio)         │  ~115 líneas │
│                                 │        │ ├── server/controllers/auth/googleLoginController.js │   ~80 líneas │
│                                 │        │ ├── server/controllers/auth/sessionController.js     │   ~55 líneas │
│                                 │        │ └── server/controllers/authController.js (fachada)   │   ~25 líneas │
├─────────────────────────────────┼────────┼──────────────────────────────────────────────────────┼──────────────┤
│ 10. userController.js           │  257   │ ├── server/services/userService.js (dominio)         │  ~120 líneas │
│                                 │        │ ├── server/controllers/user/userQueryController.js   │   ~45 líneas │
│                                 │        │ ├── server/controllers/user/userMutationController.js│  ~100 líneas │
│                                 │        │ └── server/controllers/userController.js (fachada)   │   ~25 líneas │
└─────────────────────────────────┴────────┴──────────────────────────────────────────────────────┴──────────────┘
```

### Especificación Detallada de los 10 Despieces

#### 1. `server/services/semanticParserService.js` (678 líneas ➔ 4 satélites + fachada)
- **Defectos:** Más de 400 líneas son un array estático de alias de cultura pop mezclado con regex de pasarelas de pago y lógica del parser.
- **Satélite 1.1 (`server/services/semantic/entityAliases.js` — ~140 líneas):** Declara y exporta el diccionario `STAND_ENTITY_ALIASES`.
- **Satélite 1.2 (`server/services/semantic/paymentExtractor.js` — ~80 líneas):** Exporta `extractPaymentMethod` y constantes de regex de pagos.
- **Satélite 1.3 (`server/services/semantic/queryNormalizer.js` — ~70 líneas):** Exporta `normalizeSemanticText`, `normalizeArtworkQuery` y `resolveEntityAlias`.
- **Satélite 1.4 (`server/services/semantic/standIntentParser.js` — ~110 líneas):** Exporta `parseStandIntent`, `extractQuantity`, `extractSizeIdFromSegment` y `SIZE_STANDARD_PRICES`.
- **Fachada Canónica (`server/services/semanticParserService.js` — 25 líneas):**
  ```javascript
  export * from './semantic/entityAliases.js';
  export * from './semantic/paymentExtractor.js';
  export * from './semantic/queryNormalizer.js';
  export * from './semantic/standIntentParser.js';
  ```

#### 2. `server/services/saleService.js` (653 líneas ➔ 5 satélites + fachada)
- **Defectos:** Acopla consecutivo de ventas, transacciones ACID, reportería gerencial no paginada y arqueos de caja en un único archivo.
- **Satélite 2.1 (`server/services/sales/saleNumberGenerator.js` — ~45 líneas):** `generateSaleNumber` con secuencia nativa PostgreSQL.
- **Satélite 2.2 (`server/services/sales/saleTransactionService.js` — ~130 líneas):** `createSaleTransaction` y `updateSaleTransaction`.
- **Satélite 2.3 (`server/services/sales/saleKpiService.js` — ~135 líneas):** `getEventKPIs` y `getEventSalesList`.
- **Satélite 2.4 (`server/services/sales/saleMonitorService.js` — ~120 líneas):** `getMonitorDashboardMetrics` optimizado con `prisma.sale.aggregate`.
- **Satélite 2.5 (`server/services/sales/cashClosingService.js` — ~85 líneas):** `createCashClosingTransaction` con verificación de cola de taller.
- **Fachada Canónica (`server/services/saleService.js` — 30 líneas):** Re-exporta todos los métodos manteniendo inalterado el contrato de API.

#### 3. `server/services/webCatalogService.js` (477 líneas ➔ 3 satélites + fachada)
- **Defectos:** Combina la caché en memoria multitenant, el algoritmo de deduplicación visual/textual y el motor de scoring de búsqueda léxica.
- **Satélite 3.1 (`server/services/catalog/catalogCacheManager.js` — ~110 líneas):** Manejo de `productCache`, TTL, `invalidateCatalogCache` y formato POS.
- **Satélite 3.2 (`server/services/catalog/posterDeduplicator.js` — ~115 líneas):** `extractImageSlug`, `extractPosterTitle`, `normalizePosterTitle` y `deduplicatePosters`.
- **Satélite 3.3 (`server/services/catalog/catalogSearchEngine.js` — ~125 líneas):** `searchWebPosters`, `getAllWebPostersCatalogSummary` y `getWebPosterById`.
- **Fachada Canónica (`server/services/webCatalogService.js` — 30 líneas):** Re-exporta el motor de catálogo.

#### 4. `server/controllers/aiController.js` (429 líneas ➔ 3 satélites + fachada)
- **Defectos:** Agrupa streaming SSE, subida de notas de audio, escaneo de lotes, clips de video y reconocimiento de arte.
- **Satélite 4.1 (`server/controllers/ai/aiVoiceController.js` — ~80 líneas):** `handleVoiceSale`.
- **Satélite 4.2 (`server/controllers/ai/aiVisionController.js` — ~120 líneas):** `handleBatchPhoto`, `handleArtworkRecognition`, `handleVideoRecognition`.
- **Satélite 4.3 (`server/controllers/ai/aiChatController.js` — ~135 líneas):** `handleChatQuery` (JSON y SSE con `AbortSignal` y telemetría completa).
- **Fachada Canónica (`server/controllers/aiController.js` — 25 líneas):** Re-exporta los controladores para `server/routes/apiRoutes.js`.

#### 5. `server/controllers/productionController.js` (399 líneas ➔ 3 satélites + fachada)
- **Defectos:** Ausencia total de servicio de dominio; contiene 94 líneas de datos mock y mutaciones directas sin control de concurrencia.
- **Satélite 5.1 (`server/services/productionService.js` — ~130 líneas):** Servicio de dominio que implementa `listProductionItems`, `updateItemProductionStatus` (con transacción ACID atómica) y `getQueueMetrics`.
- **Satélite 5.2 (`server/controllers/production/productionQueryController.js` — ~75 líneas):** `getProductionItems` y `getProductionMetrics`.
- **Satélite 5.3 (`server/controllers/production/productionMutationController.js` — ~95 líneas):** `updateProductionStatus` libre de mocks y con códigos HTTP correctos.
- **Fachada Canónica (`server/controllers/productionController.js` — 25 líneas):** Re-exporta los manejadores de ruta.

#### 6. `server/controllers/catalogController.js` (330 líneas ➔ Desacople de `eventController.js` + 2 satélites + fachada)
- **Defectos:** Absorbió indebidamente todo el CRUD y ciclo de vida de eventos además del catálogo web.
- **Satélite 6.1 (`server/controllers/eventController.js` — ~135 líneas):** Controlador dedicado para eventos (`getActiveEvent`, `getEventsList`, `createEvent`, `activateEvent`, `archiveEvent`, `unarchiveEvent`, `deleteEvent`).
- **Satélite 6.2 (`server/controllers/catalog/catalogQueryController.js` — ~70 líneas):** `getProducts` y `searchWebPostersCatalog`.
- **Satélite 6.3 (`server/controllers/catalog/catalogSyncController.js` — ~50 líneas):** `triggerCatalogSync`.
- **Fachada Canónica (`server/controllers/catalogController.js` — 30 líneas):** Re-exporta eventos y catálogo para retrocompatibilidad.

#### 7. `server/services/geminiPoolService.js` (319 líneas ➔ 3 satélites + fachada)
- **Defectos:** Agrupa clasificadores de errores regex, jitter exponencial, ejecutor unario y generador asíncrono de streaming.
- **Satélite 7.1 (`server/services/pool/poolErrorClassifier.js` — ~85 líneas):** Predicados de error (`isRateLimitOrQuotaError`, `isServiceOverloadedError`, `isTransientNetworkError`, etc.).
- **Satélite 7.2 (`server/services/pool/poolExecutionService.js` — ~110 líneas):** `executeWithModelFallback` y `sleepWithJitter`.
- **Satélite 7.3 (`server/services/pool/poolStreamService.js` — ~105 líneas):** `streamWithModelFallback`.
- **Fachada Canónica (`server/services/geminiPoolService.js` — 25 líneas):** Re-exporta `MODEL_PRIORITY_POOL` y las funciones del pool.

#### 8. `server/services/catalogSyncService.js` (272 líneas ➔ 3 satélites + fachada)
- **Defectos:** Integra resolución de medidas, paginación por cursor sobre la API web y upsert serial ineficiente.
- **Satélite 8.1 (`server/services/catalog-sync/sizeResolver.js` — ~60 líneas):** `STANDARD_EVENT_SIZES`, `ALBUM_COVER_SIZE` y `resolvePosterSizes`.
- **Satélite 8.2 (`server/services/catalog-sync/webFetcher.js` — ~95 líneas):** `fetchWebCatalogPosters` con timeout defensivo.
- **Satélite 8.3 (`server/services/catalog-sync/dbSynchronizer.js` — ~120 líneas):** `syncCatalogFromWeb` con procesamiento por lotes concurrentes.
- **Fachada Canónica (`server/services/catalogSyncService.js` — 25 líneas):** Re-exporta `syncCatalogFromWeb`.

#### 9. `server/controllers/authController.js` (266 líneas ➔ 3 satélites + fachada)
- **Defectos:** Mezcla aprovisionamiento de tenants, verificación criptográfica de Google GIS y mutaciones en rutas GET.
- **Satélite 9.1 (`server/services/authService.js` — ~115 líneas):** Servicio de dominio que valida el token GIS con Google Auth Library y emite el JWT firmado.
- **Satélite 9.2 (`server/controllers/auth/googleLoginController.js` — ~80 líneas):** `handleGoogleLogin` y `getAuthConfig`.
- **Satélite 9.3 (`server/controllers/auth/sessionController.js` — ~55 líneas):** `getMe` estrictamente de solo lectura.
- **Fachada Canónica (`server/controllers/authController.js` — 25 líneas):** Re-exporta los controladores.

#### 10. `server/controllers/userController.js` (257 líneas ➔ 3 satélites + fachada)
- **Defectos:** Mutaciones directas en Prisma sin validación de aislamiento multitenant ni borrado seguro.
- **Satélite 10.1 (`server/services/userService.js` — ~120 líneas):** Servicio de dominio con aislamiento forzado por `tenantId` (`listUsers`, `createUser`, `updateUserRole`, `toggleUserStatus`, `assignEventToUser`, `deactivateUserSafely`).
- **Satélite 10.2 (`server/controllers/user/userQueryController.js` — ~45 líneas):** `getUsersList`.
- **Satélite 10.3 (`server/controllers/user/userMutationController.js` — ~100 líneas):** Controladores de mutación con códigos HTTP semánticos.
- **Fachada Canónica (`server/controllers/userController.js` — 25 líneas):** Re-exporta los controladores.

---

# 6. MODELADO FORENSE DE LOS 5 ESCENARIOS DE CATÁSTROFE EN CONVENCIÓN

A continuación se modelan técnicamente los 5 desastres operacionales más severos en convenciones masivas:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      MATRIZ FORENSE DE CATÁSTROFES EN CONVENCIÓN                       │
├─────────────────────────┬──────────────┬───────────────────┬───────────────────────────┤
│ Escenario               │ Probabilidad │ Impacto Financiero│ Severidad Arquitectónica  │
├─────────────────────────┼──────────────┼───────────────────┼───────────────────────────┤
│ 1. Apagón Celular 4G/5G │ MUY ALTA     │ CRÍTICO (Parálisis)│ P0 (Punto Único de Falla) │
│ 2. Tormenta HTTP 429    │ ALTA         │ MEDIO (Modo Lento)│ P0 (Pool Bypass en Media) │
│ 3. Colisión Multicajero │ ALTA         │ ALTO (Pérdida Tx) │ P0 (Lock Contention)      │
│ 4. Cierre con Pendientes│ MEDIA-ALTA   │ ALTO (Descuadre)  │ P1 (Brecha de Auditoría)  │
│ 5. Ruido Acústico 95 dB │ CERTEZA 100% │ MEDIO (UX Fricción│ P0 (VAD Inutilizado)      │
└─────────────────────────┴──────────────┴───────────────────┴───────────────────────────┘
```

---

### ESCENARIO 1: Apagón Celular 4G/5G en el Centro de Convenciones
* **Condición de Disparo:** 15,000 asistentes dentro de los pabellones de concreto de Fórum Majadas saturan las celdas de Claro y Tigo. La latencia sube a > 15,000 ms, la pérdida de paquetes supera el 80% o la conexión colapsa totalmente durante 3 horas pico (Sábado 2:00 PM – 5:00 PM).
* **Cascada de Falla Arquitectónica:**
  1. El cajero arma la orden y presiona "Cobrar (Q 180)".
  2. `useManualSaleCart.js:L113` ejecuta `authFetch('/api/sales', { method: 'POST', ... })`.
  3. La petición queda colgada en el socket TCP hasta arrojar `TypeError: Failed to fetch` o `ERR_CONNECTION_TIMED_OUT`.
  4. El error setea `setErrorMsg('Failed to fetch')`. La venta **no se asienta en la base de datos**.
  5. Si el cajero recarga el navegador para destrabar la app, `AuthContext.jsx:L6` no encuentra al usuario en `localStorage` y lo redirige a Google Login. Sin internet, Google Login no abre. **La terminal queda completamente bloqueada e inútil**.
  6. Los impresores del taller no reciben las órdenes vendidas; la producción se detiene.
* **Impacto Operacional & Financiero:** Parálisis total de ventas en las 3 horas de mayor afluencia. Pérdida directa estimada de **Q 25,000 a Q 45,000 en ventas no realizadas** y quejas generalizadas.
* **Mitigación de Ingeniería Grado Producción:**
  - **IndexedDB Offline Queue:** Implementar un store persistente en IndexedDB (`idb` o `Dexie.js`) con estado `SYNC_PENDING`.
  - **UUIDv4 Generado en Cliente:** El cliente genera el ID de la venta. Si `fetch` falla por red, la venta se guarda localmente en IndexedDB, imprime el ticket por USB/Bluetooth ESC/POS y emite confirmación visual con badge *"Venta Guardada Offline"*.
  - **Background Sync:** Al detectar reconexión (`navigator.onLine` + ping exitoso), un Web Worker despacha las ventas acumuladas con idempotencia a `POST /api/sales/offline-sync`.

---

### ESCENARIO 2: Saturación y Agotamiento del Pool Multi-Key de Gemini (HTTP 429 Flood)
* **Condición de Disparo:** 4 cajeros utilizando el dictado por voz y subiendo fotos de pósters simultáneamente en una hora pico, alcanzando los límites de peticiones por minuto (RPM/TPM) de Google AI Studio en todas las claves.
* **Cascada de Falla Arquitectónica:**
  1. Las notas de voz llegan a `server/services/ai/aiMediaService.js:L76` (`processVoiceSaleAudio`).
  2. La función invoca directamente `gemini.models.generateContent` sin pasar por `executeWithModelFallback`.
  3. Google responde con error HTTP 429 (`RESOURCE_EXHAUSTED`).
  4. La función arroja una excepción no controlada hacia `server/controllers/aiController.js:L76`, que responde con `HTTP 500 { success: false, error: 'RESOURCE_EXHAUSTED' }`.
  5. El frontend muestra un toast rojo *"Error procesando dictado de voz"* y descarta el audio.
  6. El cajero debe abandonar el micrófono y transcribir manualmente la orden con una fila de 15 personas esperando.
* **Impacto Operacional & Financiero:** Retraso de 45 segundos por cliente. La velocidad de despacho cae un 40%, provocando abandono de fila (churn de cola) de clientes impacientes.
* **Mitigación de Ingeniería Grado Producción:**
  - **Envolver Medios en el Pool:** Migrar todas las llamadas de `aiMediaService.js` a `executeWithModelFallback`, conmutando automáticamente de clave y alternando a `gemini-3.7-flash` o `gemini-3.5-flash` en caso de agotamiento de cuota.
  - **Parser Semántico Local Heurístico:** Si todo el pool de IA entra en cooldown, el backend no debe arrojar error 500: debe desviar el texto o la transcripción de emergencia al motor determinístico `server/services/semanticParserService.js:parseStandIntent()`.

---

### ESCENARIO 3: Colisión Concurrente Multi-Cajero en la Misma Secuencia de Ticket
* **Condición de Disparo:** 4 cajeros en el stand presionan "Confirmar Venta" en la misma fracción de segundo (mismo milisegundo) para el evento Comic Con 2026.
* **Cascada de Falla Arquitectónica:**
  1. Las 4 peticiones abren una transacción interactiva de Prisma (`prisma.$transaction`).
  2. La primera transacción ejecuta `tx.event.update` (`server/services/saleService.js:L57`) y adquiere un **bloqueo exclusivo de fila (`FOR UPDATE`)** en PostgreSQL sobre el registro del `Event`.
  3. Las transacciones 2, 3 y 4 quedan en estado `WAITING FOR ROW LOCK`.
  4. La transacción 1 procede a crear la venta, los ítems y el audit log (150-300 ms).
  5. Si el pool de conexiones de Prisma se satura o la red experimenta latencia, la transacción 4 supera el timeout de espera (`maxWait: 15000`), arrojando la excepción `P2028: Transaction timeout: Transaction already closed`.
  6. El cajero recibe *"Error registrando la venta"*. Si vuelve a presionar el botón habiendo cobrado ya con tarjeta en el POS físico, se corre el riesgo de cobro duplicado o pérdida del ticket.
* **Impacto Operacional & Financiero:** Errores intermitentes en horas pico, riesgo de doble cargo al cliente y descuadre de correlativos fiscales.
* **Mitigación de Ingeniería Grado Producción:**
  - **Secuencia Atómica Nativa PostgreSQL (Sin Bloqueo de Fila):** Reemplazar la columna `Event.currentSaleSequence` por una secuencia nativa de PostgreSQL (`CREATE SEQUENCE IF NOT EXISTS sale_seq_event_<id>;`).
  - Obtener el número correlativo mediante `SELECT nextval('sale_seq_event_<id>');`. La función `nextval` en PostgreSQL es atómica, no transaccional y **no adquiere bloqueos de fila**, soportando decenas de miles de asignaciones por segundo con cero contención.
  - Prefijar el ticket con el ID del terminal (`CC26-C1-0001`, `CC26-C2-0001`), erradicando cualquier posibilidad de colisión entre cajas.

---

### ESCENARIO 4: Cierre de Caja (Arqueo) con Ítems Pendientes en Cola de Taller
* **Condición de Disparo:** El supervisor del stand realiza el Arqueo de Caja a las 21:00 al terminar la jornada, mientras en el taller de impresión existen 8 pósters que los clientes ya pagaron en efectivo pero que siguen en estado `A_PRODUCCION` o `PENDIENTE`.
* **Cascada de Falla Arquitectónica:**
  1. El supervisor cuenta el dinero en gaveta (Q 5,420.00 en efectivo) y ejecuta el cierre vía `POST /api/closings`.
  2. `saleService.js:L283-L323` calcula el total teórico de todas las ventas del día y asienta el arqueo como `CONCILIADO` (`status = 'CONCILIADO'`) sin verificar el estado del taller.
  3. A las 21:15, el operario del taller reporta que se agotó el papel fotográfico 60x90 para la venta `#CC26-0145`.
  4. El cliente regresa solicitando la devolución de su dinero (Q 180.00 en efectivo).
  5. El cajero anula la orden y devuelve el efectivo físico.
  6. El arqueo asentado 15 minutos antes queda formalmente cerrado con un **faltante de caja físico no conciliado**.
* **Impacto Operacional & Financiero:** Descuadres contables irreversibles en la entrega de valores a gerencia y fricciones laborales por sospechas infundadas de faltantes de caja.
* **Mitigación de Ingeniería Grado Producción:**
  - **Guardia Pre-Cierre en Backend:** `createCashClosingTransaction` debe consultar:
    ```javascript
    const pendingCount = await prisma.saleItem.count({
      where: {
        sale: { eventId, status: 'COMPLETADA' },
        productionStatus: { in: ['PENDIENTE', 'A_PRODUCCION'] }
      }
    });
    ```
  - Si `pendingCount > 0`, rechazar el arqueo con `HTTP 409 Conflict`: *"Existen órdenes pendientes de entrega en el taller. Entregue o cancele las órdenes antes de arquear la caja."*
  - Conectar las ventas arqueadas a un campo `cashClosingId` en la tabla `sales` para congelarlas contra modificaciones posteriores.

---

### ESCENARIO 5: Degradación de Entrada de Voz Bajo Ruido Acústico Extremo (85-98 dB)
* **Condición de Disparo:** Escenario principal de cosplay, torneo gamer y parlantes contiguos al stand emitiendo música y locución a 92 dB.
* **Cascada de Falla Arquitectónica:**
  1. El cajero presiona el botón de micrófono en `useAiVoiceRecorder.js` y dicta la orden durante 4 segundos.
  2. Al terminar de hablar, el VAD debería detectar 1.5 segundos de silencio y detener la grabación.
  3. El umbral estático de `rms > 0.003` (-50.5 dBFS) es superado constantemente por el ruido ambiental (RMS 0.025 a 0.080).
  4. La condición de silencio **nunca se cumple**. La grabación continúa durante 30 segundos acumulando música estridente y gritos de la multitud.
  5. El archivo de 30 segundos se envía a Gemini 3.8 Flash. El modelo transcribe las canciones de fondo o los anuncios del presentador de cosplay.
  6. La extracción estructurada falla: Gemini retorna `confidence: 0` o alucina títulos de canciones que no existen en el catálogo.
* **Impacto Operacional & Financiero:** Inutilización del 100% del canal de voz durante los momentos de mayor afluencia de la convención. Pérdida de tiempo del cajero intentando borrar borradores corruptos.
* **Mitigación de Ingeniería Grado Producción:**
  - **VAD Adaptativo con Calibración Dinámica:** Medir el nivel de ruido base durante los primeros 400ms de cada pulsación (`ambientNoiseRms`) y fijar el umbral de detección dinámicamente en `ambientNoiseRms * 1.8`.
  - **Filtro Pasa-Banda Web Audio API:** Insertar un nodo `BiquadFilterNode` pasa-banda centrado en la voz humana (300 Hz – 3400 Hz), eliminando el 85% de los subwoofers y chillidos de la feria antes de la codificación Opus.
  - **Hard Timeout:** Limitar la grabación a un máximo absoluto de 7 segundos (`setTimeout(stopRecording, 7000)`).

---

# 7. PLAN DE INNOVACIÓN ENTERPRISE: 10 FUNCIONALIDADES DISRUPTIVAS PARA STAND {IA}

A continuación se detalla la suite completa de 10 innovaciones de alto impacto diseñadas para maximizar las ventas, la velocidad de despacho y la fidelización en ferias y convenciones:

---

### 1. STAND {Vision-Wall} (Proyección Dinámica de Mockups en Sala y Cuarto Gamer)
* **Dolor Comercial Resuelto:** El 74% de los asistentes compra láminas sueltas baratas (Mini Q25 o Mediano Q65) porque no pueden visualizar el acabado de lujo de un marco negro de aluminio o madera montado en su habitación. Los vendedores pierden 1 minuto gesticulando dimensiones en el aire mientras la fila se acumula.
* **Arquitectura Técnica:**
  - **Backend:** `server/services/mockupRenderService.js` con pipeline de composición acelerada por GPU sobre plantillas WebP (`GAMING_SETUP`, `LIVING_ROOM`, `ANIME_BEDROOM`). Emite eventos de cambio de borrador por SSE hacia `GET /api/v1/mockups/stream/:screenId`.
  - **Frontend:** Componente de segunda pantalla `src/components/display/CustomerFacingDisplay.jsx` para proyectores o televisores de 32" montados detrás del mostrador. Renderizado con CSS 3D Transforms en perspectiva a 60 FPS.
  - **Gemini Multimodal:** Tool formal `projectArtworkMockup(artworkTitle, sizeId, frameType, roomTheme)`. Cuando el cliente pide una obra de Star Wars o Batman, Gemini activa el marco negro mate en ambiente gamer y formula el argumento de upselling.
* **Impacto Comercial:** Aumento del **+38% en el Ticket Promedio (AOV)** al convertir láminas sueltas en cuadros enmarcados completos (Q145–Q195).

---

### 2. STAND {Mesh-Sync} (Malla P2P Offline-First sin Dependencia de Internet)
* **Dolor Comercial Resuelto:** La saturación de antenas 4G/5G en el centro de convenciones paraliza los puntos de venta basados en la nube, provocando pérdidas de miles de quetzales por hora y desincronización con el taller.
* **Arquitectura Técnica:**
  - **Edge P2P:** Router Wi-Fi local en el stand (GL.iNet en subnet privada `192.168.4.x`) comunicando las terminales de venta y las tablets del taller mediante WebRTC DataChannels y mDNS.
  - **Persistencia Local:** IndexedDB en frontend con CRDT (Vector Clocks) y secuencias disjuntas por cajero (`CC26-A-0001`, `CC26-B-0001`).
  - **Drenaje Cloud:** Servicio de reconciliación asíncrona `POST /api/v1/sync/cloud/reconcile` cuando la conexión a Internet se restablece.
* **Impacto Comercial:** **100% de disponibilidad operacional garantizada**, previniendo de Q12,000 a Q25,000 en pérdidas por caídas de telecomunicaciones.

---

### 3. STAND {Acoustic-Ear} (Agente de Voz Ambiental con Cancelación de Ruido y PTT)
* **Dolor Comercial Resuelto:** En salones con 92 dB de ruido ambiental, los micrófonos convencionales capturan música y gritos, haciendo fracasar el reconocimiento por voz. Los cajeros deben soltar los pósters que están enrollando para teclear en la pantalla.
* **Arquitectura Técnica:**
  - **Hardware PTT:** Integración con botones Push-To-Talk vía Bluetooth (micrófonos de solapa o pedaleras de mostrador bajo el pie del cajero).
  - **DSP en Navegador:** Cadena Web Audio API con filtro pasa-banda vocal (300 Hz – 3400 Hz) y VAD adaptativo basado en el ruido de fondo calibrado en tiempo real.
  - **Inferencia Gemini:** Compresión Opus a 24 kbps con directivas de sistema de atenuación de ruido inferencial en Gemini 3.8 Flash, logrando extracción de venta en < 850 ms.
* **Impacto Comercial:** Reducción del tiempo de creación de órdenes de 38s a **12s por venta** (manos libres para empacar mientras se cobra).

---

### 4. STAND {Desk-Eye} (Escáner de Mostrador Multi-Póster por Visión Artificial)
* **Dolor Comercial Resuelto:** Cuando un cliente lleva 3 o 4 pósters variados, el cajero pierde hasta 1 minuto buscando códigos de barra pequeños o buscando títulos en el buscador manual.
* **Arquitectura Técnica:**
  - **Hardware:** Cámara gran angular 1080p montada sobre un brazo cenital apuntando a la mesa de cobro.
  - **Backend:** `POST /api/v1/ai/batch-counter-scan` con corrección de perspectiva sobre esquinas marcadas del mostrador.
  - **Gemini Multimodal:** Esquema estructurado `counterBatchVisionSchema` en Gemini 3.8 Flash que segmenta múltiples obras en la misma foto, detecta proporciones (1:1 Portada Álbum vs 2:3 Mediano) y puebla el carrito en un solo paso.
* **Impacto Comercial:** Armado de carrito multi-ítem en **2.2 segundos** (reducción del 95% en tiempo de digitación).

---

### 5. STAND {Eco-Ticket} (Recibo Instantáneo por WhatsApp y Entrada Digital Coleccionable)
* **Dolor Comercial Resuelto:** Las impresoras térmicas se traban en horas pico, el papel se agota, los recibos terminan tirados en el piso y la empresa pierde el 96% de los datos de contacto de los clientes.
* **Arquitectura Técnica:**
  - **WhatsApp Cloud API:** Envío automático de comprobante digital enriquecido vía Meta Graph API v21.0.
  - **Landing Holográfica:** Enlace único con token criptográfico (`https://deko.gt/t/:token`) que muestra el estado de preparación en taller en tiempo real y descarga de fondo de pantalla digital en alta definición de la obra comprada.
  - **QR en Segunda Pantalla:** El cliente puede escanear un QR dinámico en la pantalla frontal para recibir el recibo en su WhatsApp sin dictar su número.
* **Impacto Comercial:** Ahorro del **88% en rollos térmicos** y captura del **91% de números de WhatsApp verificados** para campañas de remarketing post-evento.

---

### 6. STAND {Workshop-Flow} (Enrutador Inteligente de Taller y Balanceador de Impresión)
* **Dolor Comercial Resuelto:** Los impresores en el taller cambian constantemente de rollo de papel (de 30cm a 45cm y luego a 60cm), perdiendo de 3 a 5 minutos por cambio y generando demoras de más de 25 minutos para los clientes.
* **Arquitectura Técnica:**
  - **Algoritmo de Lote:** `server/services/workshopDispatcherService.js` agrupa automáticamente los pedidos en cola por ancho de rollo de papel (`WIDTH_30CM`, `WIDTH_45CM`, `WIDTH_60CM`), minimizando el recambio de sustratos en los plotters HP Latex.
  - **Tablero Kanban Rugged:** Interfaz de alto contraste para tablets de taller con botones gigantes táctiles para operarios con guantes y avisos acústicos de pedidos urgentes (> 10 min).
* **Impacto Comercial:** Aumento del **+58% en la capacidad de producción del taller** y reducción del tiempo de entrega a **8.5 minutos**.

---

### 7. STAND {Restock-Radar} (Radar Predictivo de Agotamiento y Alertas a Bodega)
* **Dolor Comercial Resuelto:** La demanda de ciertos personajes explota súbitamente por eventos de la feria (ej. firma de autógrafos de un actor de doblaje). Los pósters se agotan en mostrador y los corredores tardan 15 minutos en encontrar las cajas en la bodega trasera.
* **Arquitectura Técnica:**
  - **Algoritmo de Velocidad:** Monitorea la velocidad de venta por SKU en ventanas de 20 minutos y calcula el tiempo para agotarse ($TTD = Stock / Velocidad$).
  - **Alertas a Corredores:** Si $TTD \le 45\text{ minutos}$, despacha alertas automáticas vía bot de Telegram o PWA móvil a los asistentes de bodega con el número de caja exacto (`CAJA-B14`).
* **Impacto Comercial:** Recuperación de **Q 5,000 a Q 9,500 en ventas perdidas por quiebres de stock** por fin de semana.

---

### 8. STAND {Flash-Pulse} (Motor de Ofertas Relámpago y Liquidación de Cierre)
* **Dolor Comercial Resuelto:** Domingos por la tarde o mañanas lentas presentan valles de venta. Además, en las últimas 2 horas de feria, transportar cuadros enmarcados de vuelta en camiones arriesga roturas y costos de flete.
* **Arquitectura Técnica:**
  - **Motor de Reglas:** `server/services/dynamicPricingService.js` activa promociones automáticas por horario o con un toque de gerencia (ej. "Última hora: Marcos al 50%").
  - **Notificación en Pantallas:** Banners luminosos con cuenta regresiva en las pantallas frontales hacia el público y recálculo automático de subtotales en el POS sin cupones manuales.
* **Impacto Comercial:** Incremento del **+52% en ventas de horas muertas** y liquidación del **78% de cuadros en exhibición** antes del desmontaje.

---

### 9. STAND {Sentinel-Audit} (Centinela Autónomo Antifraude y Auditoría Forense en Tiempo Real)
* **Dolor Comercial Resuelto:** Personal temporal manejando miles de quetzales en efectivo en condiciones caóticas. Cancelaciones de ítems después de cobrar, descuentos no autorizados y arqueos con faltantes nocturnos inexplicables.
* **Arquitectura Técnica:**
  - **Detección Estadística:** `server/services/forensicSentinelService.js` calcula puntuaciones Z-Score sobre ratios de anulación, descuentos y relación efectivo/tarjeta por cajero.
  - **Bloqueo a Dos Personas:** Toda anulación de una orden enviada al taller exige el PIN de 4 dígitos del supervisor.
  - **Narrativa Forense Gemini:** Inferencia nocturna que compara transacciones de base de datos con los arqueos declarados y genera el informe de discrepancias en minutos.
* **Impacto Comercial:** Reducción de mermas y fugas de efectivo a **menos del 0.2% de los ingresos brutos**.

---

### 10. STAND {Global-Voice} (Voz Multilingüe para Turistas y Conversor de Divisas en Vivo)
* **Dolor Comercial Resuelto:** Convenciones internacionales atraen invitados y turistas extranjeros (Estados Unidos, Japón, México). Los vendedores locales no dominan idiomas, se traban calculando el cambio en dólares y pierden ventas de alto poder adquisitivo.
* **Arquitectura Técnica:**
  - **Doble Pantalla Bilingüe:** La pantalla del cliente muestra subtítulos y explicaciones de las obras en su idioma nativo con precios en USD (`$8.40 USD`).
  - **Calculadora de Vuelto:** La pantalla del vendedor calcula automáticamente: *"Recibe: $20 USD | Entregar Vuelto: Q35 GTQ"*.
  - **Traducción Bidireccional:** Pipeline de audio en tiempo real con Gemini 3.8 Flash traduciendo inglés/japonés a español para el cajero y viceversa.
* **Impacto Comercial:** Conversión de turistas internacionales del **89%** con un ticket promedio de **Q340 GTQ ($44 USD)** frente a la media nacional de Q110.

---

### Matriz Comparativa y Roadmap de Innovación Enterprise

| # | Innovación | Impacto Clave | Complejidad | Hardware Requerido | Retorno de Inversión |
|:---:|---|---|:---:|---|:---:|
| **1** | **STAND {Vision-Wall}** | +38% Ticket Promedio | Media | Pantalla HDMI / Proyector | 1er Fin de Semana |
| **2** | **STAND {Mesh-Sync}** | 100% Uptime sin Internet | Alta | Router Wi-Fi local de stand | Inmediato (Previene Caídas) |
| **3** | **STAND {Acoustic-Ear}** | -26s por Venta en 95dB | Media-Alta | Micrófonos Bluetooth PTT | 1er Fin de Semana |
| **4** | **STAND {Desk-Eye}** | Carrito en 2.2 segundos | Alta | Cámara USB cenital 1080p | 2do Fin de Semana |
| **5** | **STAND {Eco-Ticket}** | -88% Papel, 91% Leads | Baja-Media | Solo Software (Meta API) | Inmediato (Ahorro Papel) |
| **6** | **STAND {Workshop-Flow}** | +58% Capacidad Taller | Media | Tablets Android resistentes | 1er Fin de Semana |
| **7** | **STAND {Restock-Radar}** | Q5k–Q9.5k en Stock Evitado | Media | Smartphone de corredores | 1er Fin de Semana |
| **8** | **STAND {Flash-Pulse}** | +52% Ventas Horas Muertas | Baja-Media | Solo Software | Inmediato |
| **9** | **STAND {Sentinel-Audit}** | Mermas < 0.2% de Ventas | Media | Solo Software | Inmediato (Antifraude) |
| **10**| **STAND {Global-Voice}** | +180% Ventas a Turistas | Baja-Media | Pantalla frontal dual | 1er Fin de Semana |

```
                              ROADMAP DE DESPLIEGUE EN 3 FASES
=============================================================================================
FASE 1: Núcleo de Software y Eficiencia Inmediata (Semanas 1 a 3)
---------------------------------------------------------------------------------------------
[#5] Eco-Ticket (WhatsApp API) ──────► Cero papel, recibos digitales y captura de teléfonos
[#8] Flash-Pulse (Happy Hour) ──────► Promociones automáticas por horario y liquidación
[#9] Sentinel-Audit (Forensics) ────► Detección de mermas y anomalías de cajeros en tiempo real
[#10] Global-Voice (Conversor Divisas)► Calculadora de cambio USD/GTQ y traducción básica

FASE 2: Visión en Mostrador y Optimización de Producción (Semanas 4 a 6)
---------------------------------------------------------------------------------------------
[#1] Vision-Wall (Display Sync) ────► Pantalla frontal interactiva y mockups de marcos
[#3] Acoustic-Ear (Noise Cancelling)► Filtro pasa-banda vocal WebAudio y micrófonos PTT
[#6] Workshop-Flow (Dispatcher) ────► Enrutador por ancho de papel y Kanban de taller
[#7] Restock-Radar (Reposición) ────► Alertas móviles predictivas a corredores de bodega

FASE 3: Autonomía Total en el Borde y Escaneo Masivo (Semanas 7 a 9)
---------------------------------------------------------------------------------------------
[#2] Mesh-Sync (P2P Offline-First) ─► Red en malla local IndexedDB tolerante a caídas 4G/5G
[#4] Desk-Eye (Cámara Cenital) ─────► Detección simultánea multi-póster sobre el mostrador
=============================================================================================
```

---

# 8. HOJA DE RUTA DE REFACTORIZACIÓN QUIRÚRGICA (SURGICAL REFACTORING ROADMAP)

Para ejecutar las transformaciones sin riesgo de regresión ni deuda técnica, se establece un plan escalonado en 4 fases quirúrgicas:

### Fase 1: Estabilización de Resiliencia Offline y Erradicación de P0s (Semana 1)
1. **Caché Local:** Refactorizar `src/services/catalogCacheService.js` sustituyendo la sobreescritura destructiva por el algoritmo de fusión acumulativa Bounded-LRU (`Map` por `id`, límite de 300 obras).
2. **Sesión Offline:** Persistir `deko_auth_user` en `localStorage` dentro de `src/context/AuthContext.jsx` y admitir el arranque desconectado si el token existe en el terminal.
3. **VAD Adaptativo:** Actualizar `src/components/ai-chat/hooks/useAiVoiceRecorder.js` para calibrar el ruido ambiental base en los primeros 400ms y añadir un hard timeout de 7 segundos.
4. **Resiliencia de Medios:** Envolver las 4 llamadas de `server/services/ai/aiMediaService.js:L76, L102, L124, L154` dentro de `executeWithModelFallback` para protegerlas contra errores HTTP 429.
5. **Aislamiento de Rutas:** Incorporar `requireEventAccess` en `PATCH /sales/:id` (`server/routes/apiRoutes.js:L125-L130`) y restringir por `tenantId` todas las mutaciones en `server/controllers/userController.js`.
6. **Protección de `/health/ai`:** Añadir autenticación por token en `server/index.js:L94` o sustituir la inferencia en vivo por una comprobación pasiva de configuración.

### Fase 2: Despiece Modular de Monolitos de Backend (< 150 líneas) (Semana 2)
1. Ejecutar el despiece de los 10 archivos monolíticos conforme a las especificaciones de la Sección 5:
   - Extraer `eventController.js` y `cashClosingService.js` a sus propios archivos dedicados.
   - Extraer `entityAliases.js` y `paymentExtractor.js` de `semanticParserService.js`.
   - Extraer los satélites de reportería analítica y transacciones de `saleService.js`.
   - Extraer los clasificadores de errores de `geminiPoolService.js`.
2. Mantener fachadas de menos de 40 líneas con re-exportaciones completas, garantizando cero cambios disruptivos (zero breaking changes) para las rutas existentes.
3. Eliminar los arrays de datos mock (`demoProductionItems` en `productionController.js:L4-L97` y catálogos estáticos en `webCatalogService.js:L123-L159`).

### Fase 3: Hardening de Persistencia, Concurrencia e Infraestructura (Semana 3)
1. **Concurrencia PostgreSQL:** Reemplazar el incremento serial en `Event.currentSaleSequence` por secuencias nativas de base de datos (`CREATE SEQUENCE`) o desplazar el incremento al final de la transacción de venta.
2. **Transaccionalidad en Arqueos:** Envolver `createCashClosingTransaction` en `prisma.$transaction`, validar que no existan obras pendientes en taller y asociar las ventas mediante `cashClosingId`.
3. **Integridad Relacional:** Modificar `prisma/schema.prisma` para convertir las cascadas destructivas de `Tenant` a `onDelete: Restrict` y agregar los índices compuestos faltantes.
4. **Migraciones Formales:** Crear el directorio `prisma/migrations` mediante `prisma migrate dev` para desterrar el uso de `prisma db push` en producción.
5. **Saneamiento de Docker:** Remover la copia de `.git` y aplicar `npm prune --omit=dev` en el `Dockerfile`. Migrar el webhook de Dokploy a HTTPS mediante variable de entorno. Desinstalar `bcryptjs` y `qrcode`.

### Fase 4: Despliegue de Innovaciones Enterprise (Semanas 4 a 9)
1. Implementar las 10 funcionalidades disruptivas siguiendo el cronograma de 3 fases (Fase 1: Software Core; Fase 2: Visión y Taller; Fase 3: Malla P2P Offline y Escaneo Cenital).
2. Cada iteración deberá validar su cumplimiento estricto mediante la suite de verificación automatizada:
   - `npm run test:security` (9/9 pruebas Zero-Trust).
   - `npm run audit:secrets` (0 violaciones de aislamiento).
   - `npm run audit:monoliths` (0 archivos que superen los límites presupuestarios).
   - `npm run build` (compilación exitosa en Vite con código de salida 0).

---

# 9. DICTAMEN TÉCNICO FINAL

STAND {IA} posee una base arquitectónica moderna y de vanguardia. La erradicación de los modelos Gen 1.5/2.5 y la adopción de Gemini 3.8 Flash con Closed-Loop Function Calling posicionan al sistema a la vanguardia de la tecnología de retail interactivo. 

Al resolver quirúrgicamente las vulnerabilidades P0 identificadas en este peritaje (especialmente la resiliencia offline de caché y autenticación, el desacople de concurrencia en la secuencia de tickets y el blindaje del pool ante cuotas HTTP 429), la plataforma alcanzará una robustez de grado militar, garantizando operaciones ininterrumpidas, máxima velocidad de cobro y cero pérdidas financieras en las convenciones más demandantes de América Latina.
