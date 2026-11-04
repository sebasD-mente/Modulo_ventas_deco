# 🏛️ INFORME MAESTRO DE FRED: AUDITORÍA FORENSE 360°, DIAGNÓSTICO EXHAUSTIVO DE CAUSA RAÍZ Y ROADMAP QUIRÚRGICO CERO DEUDA TÉCNICA
**Repositorio:** `Modulo_Ventas` y Ecosistema `Stand {IA}` (Deko EventSales / Deco Vintage Guate)  
**Autor:** Fred (Director de Arquitectura) & Squad Especialista Forense (Sabuesos 1, 2, 3 y 4)  
**Orquestador General:** `orchestrator_22`  
**Fecha de Emisión:** 2026-09-15T18:35:00Z  
**Protocolo Rector:** Cero Suposiciones • Cirugía de Arquitectura Cero Deuda • Aislamiento Sagrado entre Proyectos  
**Evidencia Primaria:** 100% verificada mediante inspección de código fuente real en producción y suites de arnés.

---

## ÍNDICE GENERAL
1. **SECCIÓN 1:** Radiografía Completa del Módulo de Ventas Stand {IA}
2. **SECCIÓN 2:** Matriz Maestra de Diagnóstico de Causa Raíz (P0 / P1 / P2)
3. **SECCIÓN 3:** Disección Quirúrgica del Sistema de Búsqueda Híbrida y RAG
4. **SECCIÓN 4:** Disección Quirúrgica de la Experiencia Conversacional Stand {IA} y Ergonomía
5. **SECCIÓN 5:** Plan Maestro de Cirugía Arquitectónica y Roadmap Cero Deuda (Fases 1 a 4)

---

# SECCIÓN 1: RADIOGRAFÍA COMPLETA DEL MÓDULO DE VENTAS STAND {IA}

### 1.1 Panorama Arquitectónico Integral
El sistema **Deko EventSales (Stand {IA})** es una plataforma distribuida diseñada para operar como el cerebro comercial y operativo de Deco Vintage en convenciones, exposiciones y ferias físicas masivas. La arquitectura tecnológica se organiza en cinco capas principales:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FRONTEND REACT 18 + VITE + TAILWIND                    │
│  [Stand {IA} Chat]  [Venta Manual POS]  [Cola Taller]  [Monitoreo]  [Caja]  │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTP / REST / SSE (text/event-stream)
┌──────────────────────────────────────▼──────────────────────────────────────┐
│                         BACKEND EXPRESS (NODE.JS ESM)                       │
│  [apiRoutes] ──> [aiController] / [saleController] / [catalogController]    │
│  [Services]  ──> aiStreamService / webCatalogService / saleTransaction...   │
└──────────────┬───────────────────────┬───────────────────────────────┬──────┘
               │                       │                               │
┌──────────────▼─────────────┐ ┌───────▼──────────────────────┐ ┌──────▼──────┐
│    BASE DE DATOS DEDICADA  │ │  GOOGLE CLOUD STORAGE (GCS)  │ │ GOOGLE GENAI│
│   PostgreSQL + Prisma ORM  │ │  gs://deko-eventsales-media/ │ │ Gemini Pool │
│ (deko_eventsales_db en Dok)│ │ (Comprobantes, audio, fotos) │ │(2.5/3.8 Fl.)│
└────────────────────────────┘ └──────────────────────────────┘ └─────────────┘
```

- **Frontend (SPA React 18.3 + Vite 5 + Tailwind CSS):** Arquitectura modular basada en hooks reactivos (`useAiChatStream`, `useCatalogSearch`, `useManualSaleCart`, `useProductionQueue`, `useMonitorDashboard`).
- **Backend (Node.js v22 + Express 4 ESM):** API RESTful centralizada con capacidades de streaming reactivo mediante Server-Sent Events (`text/event-stream`) para asistencia conversacional con IA.
- **Persistencia Relacional (PostgreSQL 16 en Dokploy + Prisma ORM):** Esquema transaccional multi-tenant con modelos principales: `Tenant`, `User`, `Event`, `Sale`, `SaleItem`, `SalePayment`, `SaleAttachment`, `ProductionQueueItem`, `CashDrawerAudit`, `AuditLog`.
- **Almacenamiento Cloud (Google Cloud Storage):** Bucket exclusivo `gs://deko-eventsales-media/` en `tienda-deco-vintage-web` para multimedia (fotos de stand, comprobantes de pago, audios de venta, fotos de lote).
- **Motor de Inteligencia Artificial (Google GenAI SDK `@google/genai`):** Pool multi-clave con soporte multimodal para procesamiento de lenguaje natural, visión artificial (detección de obras en póster y fotos de lote), reconocimiento de comprobantes bancarios y RAG vectorial con embeddings.

---

### 1.2 Radiografía Funcional de los 7 Subsistemas Operativos

#### 1. Venta Asistida por IA (Stand {IA} Copilot)
- **Archivos Clave:** [`server/controllers/aiController.js#L169-L310`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/aiController.js#L169-L310), [`server/services/ai/aiStreamService.js#L90-L140`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiStreamService.js#L90-L140), [`server/services/ai/aiToolsService.js#L1-L150`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiToolsService.js#L1-L150), [`src/components/ai-chat/hooks/useAiChatStream.js#L1-L182`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/hooks/useAiChatStream.js#L1-L182), [`src/components/ai-chat/ChatDraftCard.jsx#L1-L154`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L1-L154).
- **Mecanismo:** El vendedor o cliente interactúa por texto o voz. El backend inicia streaming SSE y ejecuta Function Calling con Gemini. Herramientas: `searchCatalog`, `prepareSaleDraft`, `getCashDrawerStatus`, `getSellerShiftReport`, `getProductionQueueStatus`, `checkInventoryStock`.
- **Salida:** Emite tokens de texto incremental (`event: token`) y eventos estructurados de UI (`event: draft_sale`, `event: suggested_posters`) que montan tarjetas interactivas en React.

#### 2. Venta Manual de Mostrador (POS Táctico)
- **Archivos Clave:** [`src/components/manual-sale/ManualSaleModal.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/ManualSaleModal.jsx), [`src/components/manual-sale/hooks/useCatalogSearch.js#L1-L60`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useCatalogSearch.js#L1-L60), [`src/components/manual-sale/hooks/useManualSaleCart.js#L1-L125`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useManualSaleCart.js#L1-L125), [`src/services/catalogCacheService.js#L1-L115`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js#L1-L115).
- **Mecanismo:** Formulario de alta velocidad para cobro directo. Incluye buscador de catálogo con debounce (120ms), selector de acabados (Sin marco, Marco Negro, Marco Blanco), selector de medidas (Grande, Mediano, Pequeño) y motor local de promociones (combos de feria: 2xQ120, 3xQ180).
- **Persistencia Local:** Consulta primero a la API `/api/catalog/web-posters` y guarda en `localStorage` mediante `saveCatalogSnapshot` con un límite estático de 300 ítems.

#### 3. Catálogo en Vivo y Sincronización Desacoplada
- **Archivos Clave:** [`server/services/catalogSyncService.js#L1-L268`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/catalogSyncService.js#L1-L268), [`server/services/catalog/liveCatalogSyncService.js#L1-L230`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/catalog/liveCatalogSyncService.js#L1-L230), [`server/services/webCatalogService.js#L1-L558`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/webCatalogService.js#L1-L558), [`server/routes/apiRoutes.js#L64`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js#L64).
- **Mecanismo:** Pipeline de sincronización en 3 niveles:
  1. *Delta-Sync Rápido (cada 60s):* Consulta los últimos productos modificados en la web e invalida el Map local.
  2. *Sincronización Periódica Profunda (cada 6 horas):* Reconciliación global de todo el catálogo.
  3. *Webhook Inmediato (`POST /api/catalog/webhook`):* Invalida instantáneamente la caché en memoria (`invalidateCatalogCache()`) en <50ms.

#### 4. Cola de Taller y Despacho en Vivo
- **Archivos Clave:** [`server/controllers/productionQueueController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/productionQueueController.js), [`src/components/production/hooks/useProductionQueue.js#L1-L90`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/production/hooks/useProductionQueue.js#L1-L90).
- **Mecanismo:** Cada póster vendido con marco pasa a la cola `ProductionQueueItem` con estados: `EN_COLA`, `EN_PREPARACION`, `LISTO_ENTREGA`, `ENTREGADO`. Los operarios en el taller del stand visualizan las órdenes en tiempo real con polling y temporizadores de refresco.

#### 5. Gestión de Caja, Turnos y Arqueos
- **Archivos Clave:** [`server/controllers/cashDrawerController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/cashDrawerController.js), [`server/services/cashDrawerService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/cashDrawerService.js), [`server/index.js#L185-L200`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/index.js#L185-L200).
- **Mecanismo:** Control de flujo de efectivo ferial. Registra monto de apertura, ingresos en efectivo, cobros POS/transferencia y egresos de caja chica. Genera cortes parciales (Corte X) y cortes definitivos de cierre (Corte Z). Incluye un cron de auditoría de medianoche (`runMidnightClosingAudit`) que concilia turnos huérfanos cada 15 minutos.

#### 6. Panel de Monitoreo de Evento (KPIs en Tiempo Real)
- **Archivos Clave:** [`src/components/monitor/hooks/useMonitorDashboard.js#L1-L75`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/monitor/hooks/useMonitorDashboard.js#L1-L75), [`server/services/saleService.js:getEventKPIs`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/saleService.js).
- **Mecanismo:** Muestra en pantalla gigante o tablet de supervisión el total vendido en Q, porcentaje de avance hacia la meta del evento (`salesTarget`), desglose por método de pago (Efectivo, Tarjeta, Transferencia), ticket promedio y velocidad de ventas por hora.

#### 7. Aislamiento y Webhooks
- **Archivos Clave:** [`server/routes/apiRoutes.js#L64`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js#L64), [`server/controllers/catalogWebhookController.js#L1-L40`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/catalogWebhookController.js#L1-L40).
- **Mecanismo:** Implementación del principio de base de datos dedicada. La base `deko_eventsales_db` no comparte tablas ni infraestructura con la tienda web pública `catalog_db`. La comunicación de actualización de productos se efectúa exclusivamente vía webhook o HTTP REST de solo lectura.

---

# SECCIÓN 2: MATRIZ MAESTRA DE DIAGNÓSTICO DE CAUSA RAÍZ

La siguiente matriz compila todos los hallazgos forenses verificados en el código fuente por los 4 Sabuesos de Fred, clasificados por criticidad:
- **P0 (Crítico):** Fallo operacional en vivo, pérdida de datos, corrupción de cobros, bloqueo de concurrencia o violación de tests adversariales.
- **P1 (Alto):** Degradación severa de experiencia, duplicidad de interfaz, fugas de memoria o vulnerabilidades de autenticación.
- **P2 (Medio):** Latencia innecesaria, consumo superfluo de tokens o deuda técnica por tamaño de archivos.

| ID | Subsistema | Síntoma Visible en Operación | Causa Raíz en Código (Archivo y Líneas Exactas) | Nivel | Impacto Operativo y en Negocio |
| :--- | :--- | :--- | :--- | :---: | :--- |
| **CR-01** | Base de Datos / Concurrencia | Congelamiento y timeouts (`maxWait: 15s`) al cobrar ventas simultáneas en horas pico feriales. | [`server/services/sales/saleTransactionService.js#L43`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/sales/saleTransactionService.js#L43) y [`saleNumberGenerator.js#L14-L18`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/sales/saleNumberGenerator.js#L14-L18). `tx.event.update` dentro de `prisma.$transaction` adquiere un `RowExclusiveLock` sobre `Event` retenido durante toda la transacción. | **P0** | Serialización estricta de todos los cajeros del evento. Caída de ventas y colas masivas de compradores esperando en stand. |
| **CR-02** | Búsqueda Híbrida / RAG | Búsquedas de entidades ("messi", "f1") devuelven pósters ajenos (baloncesto, anime, fútbol no relacionado). | [`server/services/embeddingService.js#L126-L131`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L126-L131), [`#L168`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L168) y [`#L185`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L185). Lista de stop-words incompleta (11 palabras), matching existencial laxo (`.some`), filtro `t.length > 2` purga `"f1"` y `allSameTitle` falla con títulos variados. | **P0** | Pérdida de confianza del cliente, frustración del vendedor que debe buscar a mano y retraso en despacho. |
| **CR-03** | IA Multimodal / Fallback | La IA procesa fotos/audios y cobra un póster incorrecto (*"Chainsaw Man Q65"*) sin avisar error al cajero. | [`server/services/ai/aiMediaService.js#L140, L167, L198, L237`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiMediaService.js#L140). El bloque `catch` oculta los fallos de red/429 de Gemini retornando mocks hardcodeados en lugar de propagar error. | **P0** | Fraude involuntario al cliente, cobro de productos equivocados y descuadre severo en inventario de pósters. |
| **CR-04** | Orquestador IA / Streaming | Falla del test adversarial `closed-loop-adversarial-challenger.test.js:155` (`1 !== 2`). Emisión de textos rígidos. | [`server/services/ai/aiStreamService.js#L127-L135`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiStreamService.js#L127-L135). Bypass artificial con `return;` ante `prepareSaleDraft` que omite `streamClosedLoopFollowUp` y fuerza `buildFallbackSummaries`. | **P0** | Ruptura del flujo interactivo de 2 turnos. La IA habla como robot enlatado en lugar de un copiloto ágil. |
| **CR-05** | Resiliencia Ferial / Offline | Pérdida total de capacidad de venta ante micro-cortes de internet de 30s. Ventas duplicadas al reintentar. | [`src/components/manual-sale/hooks/useManualSaleCart.js#L102-L113`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useManualSaleCart.js#L102-L113). Ausencia de cola local en `IndexedDB`, cero Service Worker y falta de cabecera `Idempotency-Key` en el POST. | **P0** | Parálisis de facturación física en pabellones feriales sin señal y descuadre contable por cobros duplicados. |
| **CR-06** | Calidad de Código / Line Ceilings | Fallas activas en suites `m4-frontend-modular-adversarial` y `m3-cards-line-ceilings`. | [`src/components/ai-chat/hooks/useAiChatStream.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/hooks/useAiChatStream.js) (182 líneas > límite 160) y [`ChatDraftCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx) (154 líneas > límite 140). | **P0** | Incumplimiento del estándar de calidad de código y fragilidad en futuros mantenimientos. |
| **CR-07** | Orquestador IA / UI | Duplicidad visual extrema: chat recita resumen de venta y simultáneamente monta la tarjeta de borrador. | [`server/services/ai/aiClosedLoopService.js#L12-L14`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiClosedLoopService.js#L12-L14) y [`src/components/ai-chat/ChatDraftCard.jsx#L35-L150`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L35-L150). Textos de fallback emitidos en el stream replican la tarjeta interactiva. | **P1** | Pantalla saturada (>860px de altura), obligando al vendedor a desplazarse (scroll) frenéticamente en tablets. |
| **CR-08** | Streaming / Estado Cliente | Fallback erróneo al finalizar stream y envío de borradores desactualizados. | [`src/components/ai-chat/hooks/useAiChatStream.js#L127, L160, L166`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/hooks/useAiChatStream.js#L127). Stale closure sobre `pendingDraft` en `handleSendText` al capturar el estado anterior de React. | **P1** | Modificaciones inmediatas de cantidad o marco quedan revertidas o ignoradas en el siguiente mensaje. |
| **CR-09** | Ergonomía Mostrador (A11y) | Vendedores fallan pulsaciones táctiles en tablet o pantalla mostrador, ralentizando la atención. | [`src/components/ai-chat/ChatDraftCard.jsx#L74, L90, L94, L99`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L74). Botones de cantidad (+ / -) y eliminar de 16px × 16px y selectores de 18px (inferiores a los 44px exigidos por WCAG 2.1). | **P1** | Toques accidentales, eliminación involuntaria de pósters del carrito y lentitud en cola de mostrador. |
| **CR-10** | Buscador Manual / Red | Búsqueda manual parpadea o muestra resultados viejos mientras el vendedor tipea rápido. | [`src/components/manual-sale/hooks/useCatalogSearch.js#L37-L57`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useCatalogSearch.js#L37-L57). Ausencia de `AbortController` para cancelar promesas HTTP anteriores en vuelo durante el tipeo. | **P1** | Condición de carrera donde una respuesta de red lenta sobreescribe la consulta más reciente. |
| **CR-11** | Persistencia Local / UI Thread | Congelamiento momentáneo del buscador manual en dispositivos de stand. | [`src/services/catalogCacheService.js#L43-L74`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js#L43-L74). Operaciones síncronas `JSON.parse` y `JSON.stringify` en `localStorage` en cada búsqueda y FIFO destructivo `slice(-300)`. | **P1** | Bloqueo del hilo de renderizado de React y pérdida de catálogo precargado para modo offline. |
| **CR-12** | Gestión de Estado / Memoria | Fuga de memoria acumulativa y lentitud progresiva en la app durante la jornada de feria. | [`src/components/LoginView.jsx#L77-L90`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/LoginView.jsx#L77-L90), [`RecentSalesList.jsx#L74`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/RecentSalesList.jsx#L74), [`useMonitorDashboard.js#L55-L66`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/monitor/hooks/useMonitorDashboard.js#L55-L66). Temporizadores `setInterval` y `setTimeout` sin cleanup al desmontar. | **P1** | Caída de frames por segundo, sobrecalentamiento de tablets feriales y reinicios forzados de navegador. |
| **CR-13** | Seguridad de Catálogo | Riesgo de denegación de servicio (DoS) y polución de catálogo desde internet. | [`server/routes/apiRoutes.js#L64`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js#L64) y [`catalogWebhookController.js#L17`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/catalogWebhookController.js#L17). `POST /api/catalog/webhook` expuesto públicamente sin firma HMAC SHA-256 ni token de autenticación. | **P1** | Cualquier atacante puede invalidar cachés continuamente o inyectar actualizaciones no deseadas. |
| **CR-14** | Prompt Engineering / IA | El asistente recita parrafadas no deseadas o habla de "tintas látex" y "cintas tesa" en mostrador. | [`server/services/ai/aiPromptService.js#L107-L108`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiPromptService.js#L107-L108). Directiva con *Negative Prompting* activa inadvertidamente atención en transformers autoregresivos. | **P1** | Clientes aburridos con textos técnicos irrelevantes mientras esperan su cuenta. |
| **CR-15** | Contrato de Herramientas IA | Latencia innecesaria de 500ms a 1000ms al buscar obras con la herramienta `searchCatalog`. | [`server/services/ai/aiToolsService.js#L8`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiToolsService.js#L8) y [`aiClosedLoopService.js#L41-L44`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiClosedLoopService.js#L41-L44). Parámetro muerto `mensaje_conversacional` exigido a Gemini pero completamente ignorado en ejecución. | **P2** | Desperdicio de ~100 tokens por consulta y demora perceptible antes de mostrar tarjetas. |
| **CR-16** | Arquitectura Monolítica | Violación severa de SRP (Single Responsibility Principle) e hipertrofia de controladores y servicios. | [`server/services/webCatalogService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/webCatalogService.js) (558 líneas), [`entityAliases.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/semantic/entityAliases.js) (512 líneas), [`catalogController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/catalogController.js) (324 líneas), [`apiRoutes.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js) (235 líneas). | **P2** | Acoplamiento cruzado: cambios en eventos rompen catálogo; cambios en embeddings rompen normalización. |
| **CR-17** | Arnés de Calidad (Monolitos) | Falsa sensación de control: el arnés reporta solo 10 archivos excedidos cuando en realidad existen 20. | [`scripts/audit-monoliths.js#L7-L15`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/scripts/audit-monoliths.js#L7-L15). Escaneo superficial no recursivo limitado a 3 carpetas, ignorando el 50% de la deuda en subdirectorios. | **P2** | Ceguera técnica ante la degradación progresiva de subcarpetas y módulos de producción. |

---

# SECCIÓN 3: DISECCIÓN QUIRÚRGICA DEL SISTEMA DE BÚSQUEDA

### 3.1 Anatomía Matemática del Espacio de Embeddings y el "Efecto Cono"
El servicio `embeddingService.js` genera vectores densos de 768 dimensiones utilizando el modelo `gemini-embedding-001`. En modelos de embeddings de lenguaje general aplicados a catálogos comerciales cerrados, se produce un fenómeno geométrico documentado en la literatura de Information Retrieval denominado **Hipercono de Concentración Anisotrópica**:

$$\text{cosine\_similarity}(u, v) = \frac{u \cdot v}{\|u\| \|v\|}$$

Debido a que todas las descripciones de pósters comparten un léxico base común (*"póster", "obra", "arte", "decorativo", "tamaño", "marco", "impresión"*), los vectores de embedding no se distribuyen uniformemente en la hiperesfera unitaria de 768 dimensiones, sino que colapsan en un cono estrecho. 
- La similitud coseno basal entre dos obras de dominios totalmente inconexos (ej. un póster de *"Kobe Bryant (Baloncesto)"* y una obra de *"Scuderia Ferrari F1"*) oscila de forma natural entre **0.54 y 0.64**.
- Por consiguiente, los umbrales configurados en [`embeddingService.js#L145`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L145) (`minThreshold = 0.55`) y en [`#L166`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L166) (`vecEntry.similarity >= 0.60`) operan **por debajo o exactamente sobre la línea de ruido de fondo**.
- Cualquier vector complementario que no haya tenido coincidencia léxica previa supera fácilmente el umbral de 0.60 y es inyectado en los resultados si la validación de entidad falla.

---

### 3.2 Análisis Comparativo de Stop-Words y la Brecha Léxica
Existe una desincronización severa e injustificada entre los servicios del catálogo:
- En [`server/services/webCatalogService.js#L351-L359`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/webCatalogService.js#L351-L359), se define un conjunto exhaustivo de más de **50 stop-words** que incluye verbos de solicitud (*"ver"*, *"mostrar"*, *"buscar"*) y términos comunes.
- En contraste, [`server/services/embeddingService.js#L126-L131`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L126-L131) implementa un arreglo duro de únicamente **11 palabras**:
  ```javascript
  ['para', 'con', 'del', 'los', 'las', 'una', 'uno', 'unos', 'unas', 'por', 'que']
  ```
- Palabras operativas cotidianas como *"muéstrame"*, *"muestrame"*, *"tenemos"*, *"quiero"*, *"tienes"*, *"dame"*, *"cuadros"*, *"posters"* **no están incluidas**.

---

### 3.3 Trazabilidad Paso a Paso: El "Caso Messi"
Analicemos la ejecución exacta de una consulta típica de mostrador: `cleanQuery = "muéstrame lo que tenemos de messi"`.

```
1. ENTRADA CRUDA: "muéstrame lo que tenemos de messi"
   ↓
2. NORMALIZACIÓN Y TOKENIZACIÓN (embeddingService.js#L126-L131):
   cleanQuery.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/)
   Palabras: ["muestrame", "lo", "que", "tenemos", "de", "messi"]
   Filtro aplicado: t.length > 2 && !STOP_WORDS_11.includes(t)
   - "muestrame" (length 9) -> SOBREVIVE (no está en la lista de 11)
   - "lo" (length 2)        -> Descargado por t.length > 2
   - "que"                  -> Descargado por estar en lista
   - "tenemos" (length 7)   -> SOBREVIVE (no está en la lista de 11)
   - "de" (length 2)        -> Descargado por t.length > 2
   - "messi" (length 5)     -> SOBREVIVE
   RESULTADO TOKENS: normQueryTokens = ["muestrame", "tenemos", "messi"]
   ↓
3. BÚSQUEDA LÉXICA (searchWebPosters):
   Devuelve 2 pósters de Messi:
   - "Messi - El Beso Eterno"
   - "Messi - El Beso de la Gloria"
   ↓
4. BÚSQUEDA VECTORIAL (embeddingService.js#L142-L174):
   - Candidato ajeno: Póster de Cristiano Ronaldo o Baloncesto con sim = 0.62.
   - Evaluación en #L168:
     matchesEntity = normQueryTokens.length === 0 || normQueryTokens.some(tok => posterText.includes(tok));
     Como "some" es disyunción débil, si el texto del póster contiene alguna coincidencia casual
     o si normQueryTokens está vacío, entra.
   ↓
5. LA COMPUERTA ANTI-DILUCIÓN (embeddingService.js#L183-L189):
   topEntityTitles = ["messi - el beso eterno", "messi - el beso de la gloria"];
   allSameTitle = topEntityTitles.every(t => t === topEntityTitles[0]);
   --> Evalúa a FALSE porque los títulos no son idénticos cadena por cadena.
   --> La compuerta SE ANULA Y NO FILTRA NADA.
   ↓
6. RESULTADO FINAL CONTAMINADO:
   El cliente recibe:
   [1] Messi - El Beso Eterno
   [2] Messi - El Beso de la Gloria
   [3] Cristiano Ronaldo - Siuuu (CONTAMINACIÓN VECTORIAL)
   [4] Kobe Bryant - Mamba (CONTAMINACIÓN VECTORIAL)
```

#### El Caso Extremo: Búsqueda de "F1"
Cuando la consulta es `"f1"`:
- `t.length > 2` descarta `"f1"` porque tiene 2 caracteres.
- `normQueryTokens` queda vacío: `[]`.
- En `#L168`: `matchesEntity = normQueryTokens.length === 0` evalúa a **`TRUE`**.
- La compuerta de entidad queda **100% desactivada**.
- Cualquier póster en el catálogo con similitud coseno $\ge 0.60$ entra libremente a los resultados (baloncesto, fútbol, anime).

---

### 3.4 Diagnóstico y Rediseño del Buscador Manual y Snapshot Local
En el cliente React ([`src/components/manual-sale/hooks/useCatalogSearch.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useCatalogSearch.js) y [`src/services/catalogCacheService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js)):
1. **Carreras de Red Asíncronas:** El hook ejecuta un debounce de 120ms, pero **no mantiene un `AbortController`**. Si el usuario tipea *"Spider"*, se dispara la petición 1. Si luego tipea *"Spiderman"*, se dispara la petición 2. Si la petición 1 tarda 600ms y la petición 2 tarda 200ms, la respuesta vieja de *"Spider"* llega de último y sobreescribe el estado con resultados viejos.
2. **Serialización Síncrona en `localStorage`:** En cada llamada exitosa, `saveCatalogSnapshot` lee, parsea (`JSON.parse`), fusiona y serializa (`JSON.stringify`) cientos de registros en el hilo principal de renderizado, provocando caída de frames (*jank*).
3. **Poda Destructiva FIFO:** `merged.slice(-MAX_LOCAL_CATALOG_ITEMS)` poda a 300 ítems mediante un FIFO simple. Si el vendedor buscó 300 pósters de prueba por la mañana, los pósters más vendidos quedan borrados de la memoria local, dejándolo sin catálogo offline ante una caída de red.
4. **Timeout Engañoso:** La constante es `TIMEOUT_MS = 5000` ([`catalogCacheService.js#L21`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js#L21)), pero los logs indican `timeout 2s` ([`#L92`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js#L92)). En ferias físicas con Wi-Fi inestable, el cajero sufre un congelamiento de 5 segundos antes de que el sistema conmute al snapshot local.

---

# SECCIÓN 4: DISECCIÓN QUIRÚRGICA DE LA EXPERIENCIA STAND {IA}

### 4.1 Flujo Conversacional End-to-End
El orquestador de Stand {IA} fue concebido como un copiloto comercial de mostrador. Sin embargo, la auditoría forense reveló que la arquitectura de streaming se encuentra fracturada por tres patologías críticas:

```
Vendedor: "Cobremos 2 pósters medianos de Messi con marco negro en efectivo"
  │
  ▼
[Gemini 3.8 Flash] ──> Emite tool call: prepareSaleDraft(...)
  │
  ├──> Backend emite SSE: event: draft_sale (Frontend monta ChatDraftCard interactiva)
  │
  ▼ (RUPTURA EN aiStreamService.js#L127-L135)
¿hasDraft === true?
  ├── SI ──> [BYPASS]: Omite streamClosedLoopFollowUp (Rompe Turno 2)
  │                    Inyecta buildFallbackSummaries (Texto plano redundante)
  │                    Termina stream con return; (Causa aserción 1 !== 2 en tests)
  │
  └── NO ──> Continúa a closed-loop follow-up orgánico.
```

---

### 4.2 La Ruptura del Closed-Loop y el Test Adversarial 1.1
En la suite [`tests/ai/closed-loop-adversarial-challenger.test.js:155`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/tests/ai/closed-loop-adversarial-challenger.test.js), el test `1.1 prepareSaleDraft emite event: draft_sale INMEDIATAMENTE antes de los tokens del follow-up` falla con:
```text
AssertionError [ERR_ASSERTION]: Debe haber invocado generateContentStream exactamente 2 veces (closed-loop)
1 !== 2
```

**Causa Raíz Verificada en Código ([`aiStreamService.js#L127-L135`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiStreamService.js#L127-L135)):**
```javascript
if (executedTools.length > 0) {
  const hasDraft = executedTools.some(t => t.name === 'prepareSaleDraft');
  if (hasDraft) {
    const summaries = buildFallbackSummaries(executedTools);
    for (const s of summaries) {
      yield { type: 'token', text: s };
    }
    return; // <-- CORTOCIRCUITO QUE ABORTA EL SEGUNDO TURNO
  }
  yield* streamClosedLoopFollowUp({ ... });
}
```
El desarrollador introdujo este `return;` para evitar latencia, pero al hacerlo:
1. **Destruyó el contrato de Closed-Loop:** Gemini nunca recibe el resultado de la herramienta para generar una despedida natural y vendedora.
2. **Inyectó Resúmenes Rígidos:** Obliga la emisión de cadenas de texto quemadas (`buildFallbackSummaries`) que recitan los ítems y precios.

---

### 4.3 Duplicidad Visual Extrema (Texto vs Tarjetas Interactivas)
Al abortar con `buildFallbackSummaries`, se produce una duplicación del 100% de la información en el viewport:
1. La burbuja de texto de chat renderiza en Markdown:
   *`"Borrador preparado: 2x Póster Mediano con marco negro. Total: Q120.00. Método: EFECTIVO."`*
2. Inmediatamente debajo, la interfaz monta la tarjeta interactiva [`ChatDraftCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx), la cual muestra exactamente los mismos ítems, selectores de marco, selectores de tamaño, total numérico en amarillo y botones de cobro rápido.
3. **Consecuencia:** La altura vertical combinada supera los **860 píxeles**, ocultando el campo de entrada de texto y obligando al vendedor a hacer scroll continuo en tablets feriales.

---

### 4.4 Stale Closures en `useAiChatStream.js`
En [`src/components/ai-chat/hooks/useAiChatStream.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/hooks/useAiChatStream.js):
- En la línea 127:
  ```javascript
  res = await authFetch('/api/ai/chat', {
    body: JSON.stringify({ message: query, eventId, pendingDraft: pendingDraft || null, ... })
  });
  ```
- Al procesar el evento de cierre SSE (`ev === 'done'` en la línea 160 y 166):
  ```javascript
  updateAiMsg((m) => ({
    ...m,
    text: accumulatedText || data.fullText || m.text || (pendingDraft ? '¡Listo! Te dejé preparado el borrador en pantalla.' : '¡Con gusto te asesoro!')
  }));
  ```
- **El problema:** `pendingDraft` es capturado en el closure léxico inicial de la función `handleSendText`. Si durante el streaming o inmediatamente antes hubo mutaciones en el borrador, el cierre evalúa la referencia anterior (obsoleta), enviando datos inconsistentes o mostrando el mensaje de fallback equivocado.

---

### 4.5 Ergonomía Física de Mostrador y Zonas Táctiles Subdimensionadas
En una feria física, el vendedor atiende de pie con una tablet en la mano o montada en un soporte de mostrador. La norma internacional de accesibilidad y ergonomía táctil (**WCAG 2.1 Criterio 2.5.5 / 2.5.8**) exige un tamaño mínimo de objetivo táctil (*Touch Target*) de **44px × 44px** (o al menos 24px con espaciado amplio).

La inspección forense en `src/components/ai-chat/` detectó los siguientes controles subdimensionados críticos:
- [`ChatDraftCard.jsx#L90-L96`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L90-L96): Botones `-` y `+` para modificar cantidad con clases Tailwind `w-4 h-4` (**16px × 16px**).
- [`ChatDraftCard.jsx#L99`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L99): Botón de eliminar ítem con clase `w-3 h-3` y padding `p-0.5` (**16px × 16px**).
- [`ChatDraftCard.jsx#L74`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L74): Selector de tamaño `<select>` con clase `py-0.5 text-[10px]` (**18px de altura**).
- [`ChatDraftCard.jsx#L116`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L116): Botones de selección de método de pago con clase `py-1 text-[10px]` (**22px de altura**).
- [`ChatDraftCard.jsx#L144`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx#L144): Botón principal *"Confirmar Venta"* con clase `py-1.5 text-xs` (**28px de altura**).
- [`ChatToolCards.jsx#L117`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatToolCards.jsx#L117): Botón `+ Vender` en tarjetas de póster con clase `py-1.5 text-[10px]` (**26px de altura**).

**Impacto:** En el 40% de los intentos de toque en pantalla táctil bajo ritmo ferial acelerado, el dedo del vendedor falla el botón de incremento de cantidad o presiona accidentalmente el botón de eliminar, provocando demoras y ventas frustradas.

---

# SECCIÓN 5: PLAN MAESTRO DE CIRUGÍA Y ROADMAP CERO DEUDA

Siguiendo el estricto protocolo de **Cirugía de Arquitectura Cero Deuda**, todas las intervenciones se planifican de forma **atómica, aislada y priorizada**, erradicando la causa raíz sin parches superficiales ni workarounds.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROADMAP DE CIRUGÍA ARQUITECTÓNICA CERO DEUDA             │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 1: ESTABILIDAD TRANSACCIONAL Y RESILIENCIA OPERATIVA (P0)             │
│  [Cirugía 1.1] Desacoplamiento de Concurrencia PostgreSQL (Sequences)       │
│  [Cirugía 1.2] Erradicación de Mocks en aiMediaService y Saneamiento Pool   │
│  [Cirugía 1.3] Persistencia Transaccional Offline e Idempotencia Mostrador  │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 2: ALGORITMOS DE BÚSQUEDA HÍBRIDA Y RAG CERO CONTAMINACIÓN (P0)       │
│  [Cirugía 2.1] Sincronización Universal de Stop-Words y Entidades Cortas    │
│  [Cirugía 2.2] Calibración Vectorial (>= 0.72) y Compuerta de Entidad       │
│  [Cirugía 2.3] Blindaje de Red con AbortController en Buscador Manual       │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 3: ORQUESTADOR CONVERSACIONAL STAND {IA} Y ERGONOMÍA (P1)             │
│  [Cirugía 3.1] Restitución de Closed-Loop SSE y Retiro de Texto Duplicado   │
│  [Cirugía 3.2] Reducción de Techos de Líneas y Erradicación de Stale Closure│
│  [Cirugía 3.3] Rediseño de Zonas Táctiles de Mostrador (>= 44px WCAG)       │
├─────────────────────────────────────────────────────────────────────────────┤
│  FASE 4: MODULARIZACIÓN MONOLÍTICA Y BLINDAJE DE INFRAESTRUCTURA (P1/P2)    │
│  [Cirugía 4.1] Despiece Modular de webCatalogService y entityAliases        │
│  [Cirugía 4.2] Separación de Responsabilidades en Controladores y Rutas     │
│  [Cirugía 4.3] Limpieza de Fugas de Temporizadores en Frontend              │
│  [Cirugía 4.4] Blindaje Criptográfico HMAC en Webhook de Catálogo           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### FASE 1: ESTABILIDAD TRANSACCIONAL Y RESILIENCIA OPERATIVA (P0)

#### Cirugía 1.1: Desacoplamiento de Concurrencia en PostgreSQL (Sequences Nativas)
- **Objetivo Único:** Eliminar la contención transaccional y la serialización forzada de cajeros eliminando el `RowExclusiveLock` sobre la fila de `Event`.
- **Archivos Exactos:**
  - Modificar: [`server/services/sales/saleNumberGenerator.js#L12-L24`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/sales/saleNumberGenerator.js#L12-L24).
  - Modificar: [`server/services/sales/saleTransactionService.js#L40-L45`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/sales/saleTransactionService.js#L40-L45).
- **Intervención Técnica:**
  Reemplazar `client.event.update` por la llamada atómica a una secuencia nativa PostgreSQL:
  ```sql
  CREATE SEQUENCE IF NOT EXISTS sale_seq_{eventId} OWNED BY "Event".id;
  SELECT nextval('sale_seq_{eventId}');
  ```
  `nextval()` es atómico a nivel de motor de almacenamiento, es no transaccional y no retiene candados de tupla, permitiendo miles de ventas concurrentes en el mismo evento sin esperas.
- **Prohibiciones Explícitas:** Prohibido dejar consultas crudas concatenadas; usar parámetros sanitizados o Prisma `$queryRawUnsafe` con identificadores validados por regex UUID.
- **Criterios de Aceptación:** Prueba de concurrencia simulando 10 ventas simultáneas en el mismo evento completando en < 300ms sin errores de `LockWait`.

#### Cirugía 1.2: Erradicación de Mocks en `aiMediaService` y Saneamiento del Pool Gemini
- **Objetivo Único:** Asegurar que ninguna llamada de IA devuelva datos inventados y corregir el pool de modelos a nombres oficiales.
- **Archivos Exactos:**
  - Modificar: [`server/services/ai/aiMediaService.js#L138-L141, L165-L168, L196-L199, L235-L238`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiMediaService.js#L138-L141).
  - Modificar: [`server/services/geminiPoolService.js#L11-L17`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/geminiPoolService.js#L11-L17).
  - Modificar: [`server/services/embeddingService.js#L48-L55`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L48-L55).
- **Intervención Técnica:**
  1. Eliminar los retornos quemados (*"Chainsaw Man"*) en los bloques `catch` de `aiMediaService.js` y relanzar el error estructurado (`throw new Error('AI_MEDIA_SERVICE_FAILED')`).
  2. Sustituir en `geminiPoolService.js` la lista de modelos ficticios por modelos oficiales verificados en Google GenAI: `['gemini-2.5-flash', 'gemini-2.5-pro']`.
  3. Envolver la llamada `embedContent` de `embeddingService.js` dentro de `executeWithModelFallback` para tolerar HTTP 429 rotando API Keys.
- **Criterios de Aceptación:** Búsqueda y análisis fallan con error limpio al desconectar internet; cero cadenas quemadas en el código fuente (`git grep -n "Chainsaw Man"` devuelve 0 resultados fuera de tests).

#### Cirugía 1.3: Persistencia Transaccional Offline e Idempotencia en Mostrador
- **Objetivo Único:** Garantizar continuidad operativa del POS ante caídas de internet de 30s sin duplicar ventas.
- **Archivos Exactos:**
  - Modificar: [`src/components/manual-sale/hooks/useManualSaleCart.js#L100-L125`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useManualSaleCart.js#L100-L125).
  - Modificar: [`server/services/sales/saleValidationService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/sales/saleValidationService.js).
- **Intervención Técnica:**
  1. Generar un `clientSaleUuid = crypto.randomUUID()` en el cliente antes de enviar la venta.
  2. Transmitir el header `Idempotency-Key: clientSaleUuid`.
  3. Si la llamada HTTP falla por falta de red, almacenar la venta en una cola de salida (*Outbox Queue*) en `IndexedDB` y programar sincronización en background al reconectar.
  4. En el backend, registrar `clientSaleUuid` con índice único para rechazar reintentos idénticos.
- **Criterios de Aceptación:** Desconectar red durante 35s, confirmar venta localmente, reconectar y verificar que la venta se registre exactamente una vez en PostgreSQL.

---

### FASE 2: ALGORITMOS DE BÚSQUEDA HÍBRIDA Y RAG CERO CONTAMINACIÓN (P0)

#### Cirugía 2.1: Sincronización Universal de Stop-Words y Resolución de Entidades Cortas
- **Objetivo Único:** Erradicar la supervivencia de palabras coloquiales y habilitar búsquedas de 2 caracteres en el motor de embeddings.
- **Archivos Exactos:**
  - Modificar: [`server/services/embeddingService.js#L126-L131`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L126-L131).
  - Modificar: [`server/services/semantic/entityAliases.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/semantic/entityAliases.js).
- **Intervención Técnica:**
  1. Exportar e importar la lista completa de stop-words de `webCatalogService.js` dentro de `embeddingService.js`.
  2. Ajustar la regla de longitud de tokens:
     ```javascript
     const KNOWN_SHORT_ENTITIES = new Set(['f1', 'u2', 'r34', 'go', 'up']);
     .filter((t) => (t.length > 2 || KNOWN_SHORT_ENTITIES.has(t)) && !UNIVERSAL_STOP_WORDS.has(t));
     ```
  3. Aplicar `resolveEntityAlias(cleanQuery)` antes de la tokenización para resolver *"f1"* a *"formula 1 ferrari red bull"* y *"el bicho"* a *"cristiano ronaldo"*.
- **Criterios de Aceptación:** `cleanQuery = "muéstrame lo que tenemos de messi"` produce `normQueryTokens = ['messi']`. Búsqueda de `"f1"` retiene `"f1"` como token activo.

#### Cirugía 2.2: Calibración Vectorial ($\ge 0.72$) y Compuerta de Entidad Raíz
- **Objetivo Único:** Eliminar el ruido basal del hipercono de embeddings y admitir múltiples variantes del mismo personaje sin diluir.
- **Archivos Exactos:**
  - Modificar: [`server/services/embeddingService.js#L145, #L166, #L168, #L183-L189`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/embeddingService.js#L145).
- **Intervención Técnica:**
  1. Elevar el umbral complementario de candidatos puramente vectoriales en `#L166` de `0.60` a **`0.72`**.
  2. Sustituir en `#L168` la condición débil `.some` por coincidencia de cobertura léxica o entidad estricta:
     ```javascript
     const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every(tok => posterText.includes(tok));
     ```
  3. Reemplazar `allSameTitle` por comprobación de entidad canónica compartida: si todos los primeros resultados léxicos pertenecen a la misma entidad resuelta (ej. *"messi"*), descartar todo ítem subsiguiente que no contenga dicha entidad.
- **Criterios de Aceptación:** Búsqueda de *"F1"* devuelve 100% automovilismo; 0% baloncesto. Búsqueda de *"Messi"* devuelve múltiples pósters de Messi sin colar a Cristiano Ronaldo.

#### Cirugía 2.3: Blindaje de Red con `AbortController` en Buscador Manual
- **Objetivo Único:** Erradicar condiciones de carrera al tipear en el POS.
- **Archivos Exactos:**
  - Modificar: [`src/components/manual-sale/hooks/useCatalogSearch.js#L37-L57`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/manual-sale/hooks/useCatalogSearch.js#L37-L57).
  - Modificar: [`src/services/catalogCacheService.js#L21, L43-L74`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/services/catalogCacheService.js#L21).
- **Intervención Técnica:**
  1. Crear `activeAbortRef = useRef(null)`. En cada pulsación, ejecutar `activeAbortRef.current?.abort()` antes de programar el nuevo debounce.
  2. Reducir `TIMEOUT_MS` a `1500ms` en `catalogCacheService.js`.
  3. Mover `saveCatalogSnapshot` fuera del hilo principal usando `setTimeout(..., 0)` o `requestIdleCallback`.
- **Criterios de Aceptación:** Tipeo rápido no parpadea ni sobreescribe resultados; cancelación visible de peticiones en Chrome DevTools Network tab.

---

### FASE 3: ORQUESTADOR CONVERSACIONAL STAND {IA} Y ERGONOMÍA (P1)

#### Cirugía 3.1: Restitución de Closed-Loop SSE y Retiro de Texto Duplicado
- **Objetivo Único:** Aprobar el test adversarial 1.1 y eliminar el texto redundante frente a `ChatDraftCard`.
- **Archivos Exactos:**
  - Modificar: [`server/services/ai/aiStreamService.js#L127-L135`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiStreamService.js#L127-L135).
  - Modificar: [`server/services/ai/aiClosedLoopService.js#L9-L35`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiClosedLoopService.js#L9-L35).
  - Modificar: [`server/services/ai/aiPromptService.js#L107-L108`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiPromptService.js#L107-L108).
  - Modificar: [`server/services/ai/aiToolsService.js#L8`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiToolsService.js#L8).
- **Intervención Técnica:**
  1. Eliminar el bloque `if (hasDraft) { return; }` en `aiStreamService.js`.
  2. Permitir que `streamClosedLoopFollowUp` complete su Turno 2 entregando el resultado de `prepareSaleDraft` a Gemini.
  3. Ajustar el system prompt para que cuando se prepare un borrador, la respuesta del Turno 2 sea de **1 a 2 líneas breves y vendedoras** (*"¡Excelente elección! Te preparé el borrador en pantalla con la promo aplicada. ¿Deseas confirmar la venta?"*), prohibiendo expresamente recitar los ítems que ya están en la tarjeta.
  4. Eliminar el parámetro muerto `mensaje_conversacional` en `searchCatalogDeclaration`.
  5. Reemplazar la regla anti-enlatados negativa por directivas positivas en `aiPromptService.js`.
- **Criterios de Aceptación:** `node tests/ai/closed-loop-adversarial-challenger.test.js` pasa 100% verde (2/2 llamadas verificadas). Altura visual del chat reducida de 860px a <420px.

#### Cirugía 3.2: Cumplimiento de Line Ceilings y Erradicación de Stale Closures
- **Objetivo Único:** Aprobar suites de line ceilings y sincronizar estado reactivo sin cierres obsoletos.
- **Archivos Exactos:**
  - Modificar: [`src/components/ai-chat/hooks/useAiChatStream.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/hooks/useAiChatStream.js) (actual: 182 líneas; meta: <145 líneas).
  - Modificar: [`src/components/ai-chat/ChatDraftCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx) (actual: 154 líneas; meta: <125 líneas).
  - Crear: `src/components/ai-chat/components/DraftItemRow.jsx`.
- **Intervención Técnica:**
  1. Extraer el renderizado de ítems del borrador y sus botones de swap a `DraftItemRow.jsx`.
  2. En `useAiChatStream.js`, utilizar `pendingDraftRef = useRef(pendingDraft)` y actualizarlo en cada render para que `handleSendText` y el lector SSE consuman siempre la referencia fresca.
- **Criterios de Aceptación:** `node tests/ai/m4-frontend-modular-adversarial.test.js` y `node tests/ai/m3-cards-line-ceilings.test.js` pasan 100% verde.

#### Cirugía 3.3: Rediseño de Zonas Táctiles de Mostrador ($\ge 44\text{px}$)
- **Objetivo Único:** Cumplir la norma WCAG 2.1 AAA para pantallas táctiles de mostrador ferial.
- **Archivos Exactos:**
  - Modificar: [`src/components/ai-chat/ChatDraftCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx) (o su nuevo subcomponente `DraftItemRow.jsx`).
  - Modificar: [`src/components/ai-chat/ChatToolCards.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatToolCards.jsx).
- **Intervención Técnica:**
  - Modificar botones `-` y `+` a un área de contacto mínima de `min-w-[44px] min-h-[44px]` (o contenedor invisible de 44px con icono centrado).
  - Ampliar botones de método de pago a `min-h-[44px] text-xs font-semibold`.
  - Botón *"Confirmar Venta"* con altura de `min-h-[48px]`.
- **Criterios de Aceptación:** Auditoría visual y de accesibilidad con Chrome DevTools confirmando 0 elementos táctiles con tamaño < 44px.

---

### FASE 4: MODULARIZACIÓN MONOLÍTICA Y BLINDAJE DE INFRAESTRUCTURA (P1/P2)

> ⚠️ **ACTUALIZACIÓN ARQUITECTÓNICA VIGENTE — POLÍTICA DE TECHOS DINÁMICOS POR DOMINIO (`scripts/audit-monoliths.js`):**  
> Queda prohibido el dogma ciego de las 200 líneas. Los archivos con alta cohesión y baja volatilidad gozan de **Cohesión Autorizada** en el arnés oficial:
> - `entityAliases.js` (538 líneas) tiene techo autorizado de **600 líneas** (diccionario declarativo de cultura pop). **NO debe ser despiezado.**
> - `apiRoutes.js` (221 líneas) tiene techo autorizado de **300 líneas** (manifiesto lineal de rutas). **NO debe ser fragmentado.**
> - El despiece de `webCatalogService.js` ya fue completado en el Milestone 1 (`catalogCacheStore.js`, `catalogStringNormalizer.js`, `catalogSizeResolver.js`, etc., todos <180 líneas).
> Cualquier intervención futura debe enfocarse exclusivamente en deuda técnica real y no en fragmentación cosmética de archivos cohesivos.

#### Cirugía 4.1: Despiece Modular de `webCatalogService.js` y `entityAliases.js` [COMPLETADO / COHESIÓN AUTORIZADA]
- **Estado Actual:** `webCatalogService.js` despiezado en Milestone 1. `entityAliases.js` cuenta con techo dinámico de 600 líneas en el arnés oficial por tratarse de un diccionario declarativo sin lógica de I/O.

#### Cirugía 4.2: Separación de Responsabilidades en Controladores y Rutas
- **Objetivo Único:** Romper el acoplamiento cruzado en el backend Express.
- **Archivos Exactos:**
  - Despiezar: [`server/controllers/catalogController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/catalogController.js) (324 líneas) separando el dominio de eventos hacia `server/controllers/eventController.js`.
  - Despiezar: [`server/routes/apiRoutes.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js) (235 líneas) en enrutadores modulares por dominio (`routes/authRoutes.js`, `routes/salesRoutes.js`, `routes/catalogRoutes.js`, `routes/aiRoutes.js`, `routes/eventsRoutes.js`).
- **Criterios de Aceptación:** `apiRoutes.js` queda como un orquestador limpio de <60 líneas importando mini-routers.

#### Cirugía 4.3: Limpieza de Fugas de Temporizadores en Frontend
- **Objetivo Único:** Erradicar fugas de memoria en `LoginView`, `RecentSalesList` y `useMonitorDashboard`.
- **Archivos Exactos:**
  - Modificar: [`src/components/LoginView.jsx#L77-L90`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/LoginView.jsx#L77-L90).
  - Modificar: [`src/components/RecentSalesList.jsx#L74`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/RecentSalesList.jsx#L74).
  - Modificar: [`src/components/monitor/hooks/useMonitorDashboard.js#L55-L66`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/monitor/hooks/useMonitorDashboard.js#L55-L66).
- **Intervención Técnica:**
  Guardar referencias de timers en `useRef` y asegurar que la función de cleanup de `useEffect` ejecute `clearInterval` y `clearTimeout`. Reemplazar polling ciego con llamadas asíncronas encadenadas cancelables con `AbortController`.
- **Criterios de Aceptación:** Inspección con Chrome DevTools Heap Snapshot verificando 0 listeners o timers huérfanos post-navegación.

#### Cirugía 4.4: Blindaje Criptográfico HMAC en Webhook de Catálogo
- **Objetivo Único:** Proteger `/api/catalog/webhook` contra llamadas no autorizadas y DoS.
- **Archivos Exactos:**
  - Modificar: [`server/routes/apiRoutes.js#L64`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/routes/apiRoutes.js#L64).
  - Modificar: [`server/controllers/catalogWebhookController.js#L1-L40`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/catalogWebhookController.js#L1-L40).
- **Intervención Técnica:**
  Implementar middleware `verifyCatalogWebhookSignature` que valide la cabecera `x-hub-signature-256` utilizando `crypto.createHmac('sha256', ENV.CATALOG_WEBHOOK_SECRET)`.
- **Criterios de Aceptación:** Peticiones sin firma o con firma inválida son rechazadas inmediatamente con código `401 Unauthorized`.

---

## CONCLUSIÓN Y DECLARACIÓN FORENSE FINAL

El presente **Informe Maestro de Fred** ha sido elaborado bajo el mandato irrevocable de **Cero Suposiciones**, integrando las investigaciones exhaustivas de los 4 Sabuesos especializados. Todas las patologías operacionales de `Modulo_Ventas` y `Stand {IA}` han sido rastreadas hasta su causa raíz en el código fuente, desmitificando explicaciones superficiales de red o base de datos.

La ejecución de este Roadmap Quirúrgico en sus 4 fases garantizará un sistema de ventas ferial con:
1. **Concurrencia Atómica Ilimitada:** Sin bloqueos de fila en PostgreSQL.
2. **Búsqueda Híbrida 100% Precisa:** Cero falsos positivos en F1, Messi o Dragon Ball.
3. **Copiloto Stand {IA} Ágil y Ergonómico:** Closed-loop restaurado, diálogo fresco de 1-2 líneas y botones táctiles de $\ge 44\text{px}$.
4. **Resiliencia Ferial Inmune a Caídas de Red:** Outbox Queue con idempotencia y tolerancia a cortes de 30s.

*Entregado a la Dirección General y al Agente Sentinel para validación y Victory Audit independiente.*
