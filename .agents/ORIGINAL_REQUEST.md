# Original User Request

## 2026-09-09T14:21:10Z

Implementar y auditar de forma quirúrgica la arquitectura de producción de **Deko EventSales** (para **Deco Vintage Guate** y **Deko Labs**), erradicando la deuda técnica acumulada, blindando la seguridad, garantizando el aislamiento estricto de base de datos e infraestructura, y preparando el despliegue inmutable en Dokploy con Google Cloud Storage.

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
Integrity mode: development  

Requested team: Full multi-agent engineering team (DevOps, Security, Frontend QA & Cloud Storage)

## Requirements

### R1. Saneamiento de Código Muerto & Frontend QA
- Eliminar de forma segura los 7 componentes huérfanos que ya no son referenciados en la aplicación: `src/components/AiChatAssistant.jsx`, `src/components/BatchPhotoScanner.jsx`, `src/components/QuickPosKeyboard.jsx`, `src/components/LiveMonitor.jsx`, `src/components/CatalogView.jsx`, `src/components/VoiceRecorder.jsx` y `src/components/HumanVerificationModal.jsx`.
- Auditar y verificar que ningún archivo en `src/` tenga imports rotos.
- Compilar el frontend con `npm run build` y asegurar 0 errores de compilación.

### R2. Blindaje de Seguridad en API & Concurrencia de Ventas
- Corregir la vulnerabilidad en `server/middleware/authMiddleware.js`: eliminar la cláusula `|| !authHeader` para garantizar que en `NODE_ENV === 'production'` se exija estrictamente un token Bearer JWT válido y no se asigne ningún usuario por defecto.
- Refactorizar `server/services/saleService.js` para que la generación de números de venta (`generateSaleNumber`) sea atómica y resistente a condiciones de carrera (evitando colisiones entre vendedores concurrentes en eventos masivos).
- Parametrizar la consulta SQL en `server/services/webCatalogService.js` para evitar interpolaciones de texto en queries crudas.

### R3. Control de Versiones & Repositorio Git
- Crear un archivo `.gitignore` blindado que excluya estrictamente: `.env*`, `node_modules/`, `dist/`, `.gemini/`, `public/uploads/*` (excepto `.gitkeep`), archivos de credenciales JSON, claves y logs.
- Inicializar el repositorio Git local (`git init`), generar un `README.md` técnico con la especificación del sistema y registrar el commit inicial semántico.

### R4. Almacenamiento Permanente en Google Cloud Storage (GCS)
- Aprovisionar el bucket dedicado `gs://deko-eventsales-media/` en la región `us-central1` dentro del proyecto GCP activo `tienda-deco-vintage-web` utilizando las herramientas CLI autenticadas (`gcloud`/`gsutil`).
- Configurar Service Account con rol `roles/storage.objectAdmin` y generar credenciales seguras.
- Refactorizar `server/services/gcsStorageService.js` para erradicar cualquier fallback silencioso que guarde archivos localmente en disco efímero: todas las fotos, grabaciones de voz y comprobantes deben almacenarse directamente en GCS.

### R5. Aislamiento Estricto de Base de Datos & Sincronización Desacoplada
- Cumplir estrictamente la regla `aislamiento-estricto-proyectos`: el módulo de ventas debe operar sobre su propia base de datos dedicada (`deko_eventsales_db`), sin cohabitar con `catalog_db` de la tienda web.
- Implementar el servicio de sincronización automática `catalogSyncService.js` que consuma la API pública de la web (`GET /api/catalog/posters`) para mantener poblada la tabla propia `Product` de forma autónoma.

### R6. Contenerización Docker Multi-Stage de Producción
- Reemplazar el `Dockerfile` actual por una versión multi-stage profesional basada en `node:22-bookworm-slim` (glibc / Debian OpenSSL 3.0.x compatible con Prisma).
- Crear script `entrypoint.sh` ejecutable con verificación de conectividad con PostgreSQL y ejecución automática de `npx prisma db push` o `npx prisma migrate deploy`.
- Crear `.dockerignore` estricto.

---

## Acceptance Criteria

### 1. Integridad de Código & Frontend
- [ ] Los 7 componentes muertos están eliminados y no existen referencias huérfanas en `src/`.
- [ ] `npm run build` compila exitosamente produciendo el bundle de producción en `dist/` con código de salida 0.

### 2. Seguridad & Robustez de Backend
- [ ] Peticiones a endpoints protegidos sin header `Authorization` en modo producción reciben respuesta `401 Unauthorized`.
- [ ] `generateSaleNumber` no falla ante transacciones concurrentes simuladas.
- [ ] Todas las consultas SQL crudas en servicios utilizan parámetros tipados sin concatenación de cadenas.

### 3. Git & Trazabilidad
- [ ] El repositorio local tiene `.git` inicializado y un commit inicial con historial limpio.
- [ ] `.gitignore` previene efectivamente el rastreo de archivos `.env`, `node_modules` y credenciales.

### 4. Cloud Storage (GCS)
- [ ] El bucket `gs://deko-eventsales-media/` existe en `tienda-deco-vintage-web`.
- [ ] `uploadBufferToStorage` sube archivos exitosamente al bucket y retorna URLs válidas de GCS.
- [ ] No se escriben archivos en `public/uploads` durante la ejecución normal en producción.

### 5. Docker & Despliegue
- [ ] El `Dockerfile` multi-stage se compila exitosamente con `docker build`.
- [ ] El contenedor arranca limpiamente ejecutando migraciones antes de iniciar Express.
- [ ] La aplicación responde `200 OK` en el endpoint `/health`.

## 2026-09-10T17:05:33Z

Auditoría integral 360°, profunda y con lupa de toda la arquitectura, código fuente (Backend Express / Prisma, Frontend React / Vite / Tailwind), infraestructura (Docker / Dokploy / PostgreSQL), patrones de seguridad Zero-Trust y funcionamiento integral del Agente de Inteligencia Artificial Multimodal del Módulo de Ventas & Taller de Producción (STAND {IA} para Deco Vintage Guate), generando un informe exhaustivo con hallazgos categorizados, código muerto, objetos huérfanos, riesgos técnicos y un diagnóstico detallado de qué le falta al agente de IA para alcanzar un estándar enterprise, robusto y profesional.

Working directory: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas`
Integrity mode: development

## Requirements

### R1. Auditoría Exhaustiva de Código Fuente (Frontend & Backend)
- Inspeccionar cada archivo en `server/` (`controllers`, `services`, `middleware`, `config`, `routes`) y `src/` (`components`, `context`, `services`, `hooks`, `views`).
- Identificar código muerto, variables/importaciones no utilizadas, objetos o funciones huérfanas, duplicación de lógica y dependencias innecesarias en `package.json`.
- Evaluar el manejo de errores asíncronos, consistencia en contratos JSON de API, tipado implícito y resiliencia en casos de falla de red o base de datos.

### R2. Auditoría de Seguridad, Autenticación y Reglas Zero-Trust
- Verificar el cumplimiento estricto del aislamiento Zero-Trust: tokens Bearer RS256/JWT en todas las rutas, roles (`SUPER_ADMIN`, `VENDEDOR`, `OPERARIO_1`, `OPERARIO_2`), permisos por evento y purga de accesos no autorizados.
- Validar la protección de endpoints contra inyecciones, límites de tasa (rate limiting), saneamiento de datos y políticas de CORS/COOP/Helmet.

### R3. Auditoría de Arquitectura de Base de Datos y Modelo de Datos (Prisma / PostgreSQL)
- Inspeccionar `prisma/schema.prisma` y migraciones: índices faltantes en claves foráneas o campos de búsqueda frecuente (`sku`, `barcode`, `tenantId`, `eventId`, `createdAt`), integridad referencial y cascadas de borrado.
- Analizar consultas N+1 potenciales, bloqueos por transacciones concurrentes en ventas de alto tráfico y consistencia de inventario en tiempo real.

### R4. Auditoría de Frontend, UX y Desempeño (React 18 + Vite)
- Evaluar la arquitectura de estados globales y locales (`AuthContext`, `PrinterContext`, etc.), re-renderizados innecesarios y optimización de componentes interactivos (POS, Escaneo QR, Asistente IA, Dashboard de Monitoreo).
- Auditar la accesibilidad (a11y), responsive design en dispositivos táctiles/móviles y manejo de tiempos de carga en catálogo e imágenes WebP.

### R5. Auditoría de Infraestructura, Contenedores y DevOps (Docker / Dokploy)
- Revisar `Dockerfile`, `.dockerignore`, `entrypoint.sh` y variables de entorno (`.env.example`, `env.js`).
- Evaluar la reproducibilidad de las construcciones, peso de las capas de imagen, optimización de caché, salud del contenedor (`/health`) y tiempos de reinicio/recuperación en Dokploy.

### R6. Auditoría Exhaustiva y Diagnóstico del Agente de IA Multimodal
- **Motor y Modelo:** Analizar la integración de `@google/genai` con `gemini-2.5-flash` / `gemini-3.8-flash` en `server/services/aiMultimodalService.js` y `server/controllers/aiController.js`.
- **Canales Multimodales:** Inspeccionar el flujo completo de voz (dictado y extracción de ventas vía `audio/webm`), visión/fotografía (escaneo de lotes de pósters y códigos QR), reconocimiento visual de arte y video en vivo de mostrador.
- **Ingeniería de Prompts y Grounding:** Evaluar las directivas de sistema, estructuración de salida (JSON Schemas), resiliencia a alucinaciones de precios o tamaños y conexión con el catálogo de 233 pósters y datos en vivo del evento (KPIs, metas).
- **Gestión de Memoria y Contexto:** Revisar cómo se poda el historial de conversación en `src/components/UnifiedAiChat.jsx` y cómo se preserva el contexto de venta activa.
- **Diagnóstico Profesional (Gap Analysis):** Explicar con precisión qué capacidades enterprise hacen falta para que el agente sea 100% profesional (ej. Function Calling / Tools formales, Streaming de respuestas SSE/WebSockets, procesamiento de audio en segundo plano con cancelación de ruido, observabilidad/trazabilidad de llamadas LLM y fallback ante contingencias de red).

### R7. Reporte Final Estructurado y Matriz de Mejoras Priorizada
- Entregar un reporte técnico milimétrico con hallazgos clasificados por severidad (Crítica, Alta, Media, Baja, Optimización/Cosmética).
- Incluir archivo exacto, número de línea, descripción de la causa raíz, impacto técnico y la solución recomendada para cada punto.
- Proveer un Roadmap de Modernización y Escalabilidad para llevar la plataforma y el Agente IA al estándar Enterprise de nivel mundial.

## Acceptance Criteria

### Cobertura y Exhaustividad
- [ ] 100% de los archivos `.js`, `.jsx`, `.json`, `.prisma`, `.sh` y `Dockerfile` del repositorio son analizados sin omisiones.
- [ ] Cada hallazgo incluye referencia exacta con enlace a archivo y línea (`file:///...#Lxx`).
- [ ] No se realizan asunciones teóricas: cada observación está respaldada por código real inspeccionado.

### Calidad y Rigor Técnico en Inteligencia Artificial
- [ ] Análisis exhaustivo de los 4 canales multimodales (Voz, Imagen, Video, Texto/Chat) con métricas de robustez.
- [ ] Gap Analysis detallado de qué funcionalidades y patrones de diseño separan el estado actual del agente de una solución enterprise de producción masiva.

### Plan de Acción
- [ ] Matriz de priorización clara: qué resolver antes del próximo evento masivo y qué programar para la fase de escala.

## 2026-09-10T20:43:54Z

Implementación quirúrgica y exhaustiva de la Fase 1 del Roadmap técnico: corrección inquebrantable de los 8 defectos críticos (C-01 a C-08) y los 14 defectos de alta prioridad (A-01 a A-14), siguiendo el orden estricto de la hoja de ruta para asegurar que ningún aspecto detectado quede sin ajustar, con validación automatizada mediante suite de tests y verificación en producción.

Working directory: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas`
Integrity mode: development

## Requirements

### R1. Infraestructura, Docker y Arranque Seguro
- **C-01:** Corregir `docker-compose.yml` declarando `GOOGLE_CLIENT_ID`, `SUPER_ADMIN_EMAILS`, `PORT=3001` y bucket por defecto `deko-eventsales-media`.
- **C-02:** Eliminar `--accept-data-loss` y `|| true` en `entrypoint.sh`. Configurar ejecución segura de `npx prisma migrate deploy`.
- **C-03:** Erradicar en `server/index.js` la llamada destructiva `prisma.user.deleteMany({ where: { email: { notIn: ENV.SUPER_ADMIN_EMAILS } } })`.
- **A-03:** Agregar `USER node` y permisos adecuados en `Dockerfile` etapa `runner`.
- **A-04:** Optimizar arranque en `entrypoint.sh` evitando sincronizaciones síncronas bloqueantes.

### R2. Backend, Lógica Contable y Seguridad Zero-Trust
- **C-04:** Corregir la condición lógica en `server/services/saleService.js:52` a `if (Math.abs(paymentsTotal - totalAmount) > 0.05) throw new ValidationError(...)`.
- **C-05:** Ampliar el enum `inputChannel` en `server/validators/saleValidators.js:25` agregando `IA_CHAT_TEXTO`, `IA_FOTO_ARTE`, `IA_VIDEO_MOSTRADOR` e `IA_IMAGEN_QR`.
- **C-06:** Refactorizar `updateSaleTransaction` en `server/services/saleService.js:286-302` para actualizar/reconciliar ítems sin borrarlos en cascada de `ProductionLog`.
- **C-07:** Corregir `server/controllers/productionController.js:314-319` para retornar `HTTP 500` con error real ante fallas de base de datos.
- **A-01:** Aplicar `requireEventAccess` en todas las rutas con parámetro o cuerpo `eventId` en `server/routes/apiRoutes.js`.
- **A-10:** Reemplazar la variable global `productCache` en `server/services/webCatalogService.js` por un `Map` indexado por `tenantId`.
- **A-12:** Eliminar en `server/controllers/authController.js` el fallback a `jwt.decode` no firmado y forzar validación criptográfica estricta con Google Auth Library.
- **A-14:** Añadir `fileFilter` en `server/middleware/uploadMiddleware.js` con mimetypes autorizados.

### R3. Modelo de Datos Prisma y PostgreSQL
- **A-11:** Añadir índices de PostgreSQL en `prisma/schema.prisma` para `User.assignedEventId`, `Sale.sellerId`, `SaleItem.productId`, `ProductionLog.userId`, `CashClosing.closedById`, `AuditLog.userId` y `Product(tenantId, isActive)`.
- **A-13:** Cambiar relaciones `Sale.event` y `CashClosing.event` de `onDelete: Cascade` a `onDelete: Restrict` en `prisma/schema.prisma` para proteger la inmutabilidad contable.

### R4. Frontend, Compatibilidad Móvil/iOS y Agente IA
- **C-08:** Corregir `src/components/UnifiedAiChat.jsx:261` con negociación dinámica de códec (`MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'`), directivas WebRTC de cancelación de ruido (`noiseSuppression: true`, `echoCancellation: true`) y limpieza de streams en `useEffect` cleanup.
- **M-01:** Enviar el borrador previo `pendingDraft` en el payload de `/api/ai/chat` en `src/components/UnifiedAiChat.jsx` para permitir edición conversacional de ventas.
- **A-02:** Unificar el modelo a `gemini-2.5-flash` en todos los archivos (`docker-compose.yml`, `.env.example`, `server/config/env.js`, `README.md`).
- **M-04:** Mapear equivalencias de medidas en pulgadas a tamaños estándar en `server/services/aiMultimodalService.js`.
- **A-05:** Corregir mutación directa de estado React en `src/components/EditSaleModal.jsx:41-47`.
- **A-06:** Memoizar el objeto `value` con `useMemo` y funciones con `useCallback` en `src/context/AuthContext.jsx` para erradicar el bucle de re-renders en `LoginView.jsx`.
- **A-07:** Agregar diálogo modal de confirmación antes de asentar el arqueo en `src/components/CashClosingView.jsx`.
- **A-08:** Añadir debounce de 250ms en la búsqueda de `src/components/ProductionManagementView.jsx`.
- **M-05:** Actualizar roles legacy en `tests/e2e/test-helpers.js`.

### R5. Verificación Integral y Despliegue en Producción
- Ejecutar `npm test` y `npm run build` localmente asegurando 100% de éxito.
- Desplegar en Dokploy mediante el webhook oficial y verificar el estado del sitio en vivo con Chrome DevTools MCP.

## Acceptance Criteria

### Integridad y Cero Errores
- [ ] Los 8 defectos críticos (C-01 a C-08) están 100% resueltos y verificados en código.
- [ ] No existen fallbacks no firmados, destrucciones de datos en arranque, ni descuadres en validación de pagos.
- [ ] Grabación de audio funcional y libre de excepciones en navegadores Safari / iOS.
- [ ] La suite de tests automatizados pasa 100% limpia (`npm test`).
- [ ] El build de producción compila sin errores (`npm run build`).

## 2026-09-10T22:19:31Z

Implementación quirúrgica y exhaustiva de la Fase 2 del Roadmap técnico de STAND {IA}: migración a Function Calling formal con Gemini 2.5 Flash, streaming progresivo de tokens (SSE) en el chat de IA, optimización de consultas SQL nativas (erradicación de cuellos de botella N+1 y agregaciones en memoria), optimización del bundle frontend con code-splitting (Vite / React.lazy), saneamiento total de código muerto (23 iconos huérfanos, CSS residual, dependencias innecesarias, assets duplicados y scripts obsoletos), con validación automatizada y despliegue en producción.

Working directory: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas`
Integrity mode: development

## Requirements

### R1. Function Calling Nativo y Schemas Estrictos en Motor IA (@google/genai)
- Reemplazar el scraping de texto markdown (` ```json_sale `) en `server/services/aiMultimodalService.js` por herramientas formales (`tools` con `functionDeclarations` en `@google/genai`):
  * `prepareSaleDraft(items, total, paymentMethod, notes, customerName)`
  * `searchCatalog(query, category)`
  * `getEventKPIs(eventId)`
- Implementar `responseSchema` estricto en las llamadas multimodales (visión, transcripción de voz) para eliminar la fragilidad de `JSON.parse` en texto plano.

### R2. Streaming de Tokens en Tiempo Real (Server-Sent Events / SSE)
- Implementar streaming de respuestas en `/api/ai/chat` mediante `generateContentStream` en el backend emitiendo eventos `text/event-stream`.
- Actualizar `src/components/UnifiedAiChat.jsx` para procesar el stream en tiempo real (`ReadableStream` / `fetch`), reduciendo el Time-To-First-Byte (TTFB) a <400ms con renderizado progresivo del texto.

### R3. Optimización de Consultas y Agregaciones SQL Nativas en Backend
- En `server/services/saleService.js:getEventKPIs`, reemplazar la hidratación en memoria de todas las ventas por consultas de agregación nativas de PostgreSQL con Prisma (`prisma.sale.aggregate()` y `prisma.salePayment.groupBy()`), optimizando de O(N) a O(1).
- Implementar límites y paginación eficiente en listados de ventas y producción.

### R4. Optimización de Rendimiento Frontend y División de Bundle (Code-Splitting)
- Implementar `React.lazy()` y `<Suspense>` en `src/App.jsx` para todas las vistas secundarias (`EventsManagementView`, `UserManagementView`, `ProductionManagementView`, `CashClosingView`, `MonitorDashboardView`).
- Configurar `manualChunks` en `vite.config.js` para separar `vendor-react` y librerías externas, reduciendo el bundle principal de 633 kB a <250 kB y eliminando las advertencias de tamaño de Vite.

### R5. Saneamiento Forense de Código Muerto, Dependencias y Assets Huérfanos
- Purgar los 23 iconos huérfanos de `lucide-react` en los 7 archivos identificados (`UnifiedAiChat.jsx`, `ProductionManagementView.jsx`, `MonitorDashboardView.jsx`, `Header.jsx`, `FastManualSaleForm.jsx`, `RecentSalesList.jsx`, `UserManagementView.jsx`).
- Purgar las dependencias huérfanas `"clsx"` y `"tailwind-merge"` de `package.json` si no tienen uso activo.
- Purgar las 37 líneas de CSS muerto en `src/index.css`.
- Purgar imágenes duplicadas y assets con nombres con espacios en `public/brand/`, corrigiendo el favicon en `index.html`.
- Eliminar scripts residuales obsoletos en `scripts/` que violaban el aislamiento.

### R6. Verificación Integral y Despliegue en Producción
- Ejecutar la suite de pruebas unitarias, de integración y de seguridad (`npm test`).
- Compilar la aplicación para producción (`npm run build`) verificando la reducción de peso del bundle.
- Desplegar en Dokploy mediante el webhook oficial y verificar la funcionalidad en vivo con Chrome DevTools MCP.

## Acceptance Criteria

### Inteligencia Artificial y Streaming
- [ ] El chat de IA utiliza Function Calling formal tipado sin depender de expresiones regulares sobre markdown.
- [ ] Las respuestas del chat se renderizan progresivamente vía SSE con latencia percibida inferior a 500ms.
- [ ] La extracción de ventas por voz, foto y chat genera borradores estructurados con 100% de fiabilidad.

### Rendimiento y Base de Datos
- [ ] `getEventKPIs` computa sumatorias y conteos exclusivamente en PostgreSQL vía `aggregate`/`groupBy`.
- [ ] El bundle JavaScript inicial generado por `npm run build` es menor a 250 kB sin alertas de chunk size.

### Calidad y Limpieza de Código
- [ ] 0 iconos huérfanos, 0 clases CSS muertas y 0 dependencias no utilizadas en el proyecto.
- [ ] La suite completa de pruebas automatizadas pasa al 100% con código de salida 0.


## 2026-09-11T15:33:48Z

Realizar una auditoría 360 profunda, quirúrgica y exhaustiva del agente de IA STAND en el proyecto Modulo_Ventas (c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas), comparándolo como referencia con el estándar de excelencia de Jarvis en el proyecto Web Deco Vintage Proyect (solo lectura, respetando estrictamente el aislamiento entre proyectos).

Objetivos de la auditoría del equipo multi-agente:
1. Inspeccionar cada línea de código, script, conexión a la base de datos PostgreSQL aislada (deko_eventsales_db / Prisma), controladores, servicios de IA, prompts de sistema, esquemas de function calling y componentes React del frontend (UnifiedAiChat.jsx).
2. Diagnosticar con precisión forense:
   - Por qué las respuestas son erráticas y por qué repite tarjetas visuales.
   - Por qué trunca búsquedas a 4 pósters y cómo implementar deduplicación por ID y por imagen.
   - Por qué falla o malinterpreta órdenes complejas de ventas en lenguaje natural como "1 de un verano sin ti portada en tarjeta" y cómo resolver el mapeo semántico de alias, medidas canónicas y métodos de pago.
   - Por qué el tono conversacional se siente rígido o robótico y cómo elevarlo al nivel de fluidez, empatía y profesionalismo de Jarvis.
   - Qué herramientas formales de Function Calling le faltan para tener acceso total a la información de la app (cierres y arqueos de caja, métricas de vendedores, estado de taller/producción, inventario).
3. Diseñar y entregar un informe técnico de auditoría exhaustivo clasificado por prioridades (P0, P1, P2) y la hoja de ruta definitiva con los 3 pilares: Robusto, Profesional y Escalable, además de proponer capacidades avanzadas para ventas frenéticas en eventos masivos.

## 2026-09-11T16:07:06Z

Ejecutar la modernización quirúrgica integral del agente STAND {IA} en el proyecto Modulo_Ventas (c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas) para erradicar los 5 dolores críticos (P0/P1/P2) diagnosticados en la auditoría forense y dotarlo del estándar de excelencia de J.A.R.V.I.S., respetando estrictamente el aislamiento de infraestructura (100% en deko_eventsales_db).

Requerimientos Quirúrgicos de Implementación:

1. Integridad Contable, Mapeo Semántico y Deduplicación Bicapa (P0-1, P1-1, P1-2, P1-3):
   - En `server/services/aiMultimodalService.js`, actualizar `normalizeCatalogSizeId()` para que reconozca explícitamente "portada", "portada de album", "vinilo" y "cuadrado", retornando 'PORTADA_ALBUM'.
   - Garantizar que en `constructDraftPayload()`, `fallbackPrice` para 'PORTADA_ALBUM' sea exactamente Q55.00 (nunca Q65.00).
   - Crear `server/services/semanticParserService.js` con extractor de métodos de pago (TARJETA, TRANSFERENCIA, EFECTIVO) y diccionario cultural `STAND_ENTITY_ALIASES` (Bad Bunny, Taylor Swift, Spider-Man, Pablo Escobar, F1, Checo Pérez, Star Wars, Goku, Anime, etc.).
   - En `server/services/webCatalogService.js`, implementar `deduplicatePosters(posters)` filtrando por Set(id), Set(imageSlug) y Set(normalizedTitle).
   - Reemplazar los 4 puntos hardcodeados con limit: 4 o limit: 3 en aiController.js:206, aiMultimodalService.js:60, 1050, 1258 por limit: 12.

2. Estabilidad de Streaming SSE, Desacople de Renderizado y VAD Móvil (P0-2, P0-3, P0-4, P0-5):
   - En `server/services/aiMultimodalService.js:1248-1266`, agregar Set(executedCalls) con firma `${call.name}:${JSON.stringify(call.args)}` para evitar re-emisión múltiple de eventos draft_sale y suggested_posters.
   - En `src/components/UnifiedAiChat.jsx`, implementar buffer de tokens con requestAnimationFrame para limitar re-renders a 60 FPS y desacoplar scrollIntoView para que solo se ejecute si el usuario está al final del chat, evitando Layout Thrashing.
   - En `src/components/UnifiedAiChat.jsx`, asegurar `if (audioCtx.state === 'suspended') await audioCtx.resume()` y `mediaRecorder.start(250)` con timeslice de 250ms para evitar cortes a 1.5s en iOS/Safari y Android.
   - En `src/components/UnifiedAiChat.jsx:1178` y `src/components/FastManualSaleForm.jsx:64, 230`, preservar attachments (audios en GCS y fotos), inputChannel y selectedSizeId al transferir borradores.
   - En `src/components/UnifiedAiChat.jsx:686-689`, inyectar en el historial de Gemini los metadatos de las obras sugeridas previas: `[Contexto de obras mostradas en pantalla al cliente en este turno: ...]`.

3. Suite Completa de Herramientas de Base de Datos PostgreSQL (P1-4, P1-5):
   - En `server/services/aiMultimodalService.js`, hacer que getEventKPIs ejecute la consulta real en PostgreSQL y emita el evento SSE event_kpis con resumen conversacional.
   - Declarar e implementar con `@google/genai` Type Object las 4 nuevas tools:
     * `getCashDrawerStatus`: Efectivo en gaveta, tarjetas, transferencias y último arqueo de cash_closings.
     * `getSellerShiftReport`: Ranking y desglose de ventas por vendedor (User + Sale).
     * `getProductionQueueStatus`: Obras en cola de taller (PENDIENTE, SEPARADO, A_PRODUCCION, IMPRESO).
     * `checkInventoryStock`: Existencias y disponibilidad física en stand.

4. System Prompt Estilo Asesor Estrella J.A.R.V.I.S. (P2-1, P2-2):
   - Rediseño del Prompt Maestro: Tono cálido, amigable, apasionado por arte y cultura pop, trato de "tú", con directivas de upselling (recomendar Mediano Q65, tintas HP Látex >10 años y cinta tesa® 15s).
   - Implementar pool de contingencia multi-modelo ante errores 429.

5. Verificación Rigurosa:
   - Ejecutar pruebas automatizadas unitarias y de integración.
   - Comprobar que `npm run build` pase limpiamente.
   - Validar que no se toquen bases de datos ni archivos fuera de Modulo_Ventas.

## 2026-09-11T21:05:27Z

# Teamwork Project Prompt

Cirugía modular y refactorización arquitectónica del archivo monolítico `server/services/aiMultimodalService.js` (2,415 líneas) en el sistema STAND {IA}, dividiéndolo en 4 submódulos especializados de responsabilidad única bajo `server/services/ai/` y una fachada limpia de menos de 40 líneas con identidad pura comercial.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Directiva Sagrada de Aislamiento
1. La intervención es 100% exclusiva dentro del directorio `Modulo_Ventas`.
2. Prohibido terminantemente tocar, modificar, editar o borrar cualquier archivo fuera de `Modulo_Ventas` (el proyecto vecino `Web Deco Vintage Proyect` y su agente son sagrados e intocables).
3. Cero conexiones a bases de datos externas de producción o hosts Dokploy ajenos.

## Requirements

### R1. Despiece Modular Quirúrgico con Límites Estrictos de Líneas
Despiezar `server/services/aiMultimodalService.js` en 4 módulos en `server/services/ai/` respetando estrictamente los límites de líneas:
- **`server/services/ai/aiPromptService.js` (<180 líneas)**:
  * `buildSalesSystemPrompt` (con la identidad oficial pura de STAND {IA} y reglas de trato de "tú").
  * `salesAssistantSafetySettings`.
  * Esquemas JSON: `voiceSaleResponseSchema`, `artworkRecognitionResponseSchema`, `videoRecognitionResponseSchema`, `batchPhotoResponseSchema`.
- **`server/services/ai/aiToolsService.js` (<200 líneas)**:
  * Las 7 declaraciones de tools: `prepareSaleDraftDeclaration`, `searchCatalogDeclaration`, `getEventKPIsDeclaration`, `getCashDrawerStatusDeclaration`, `getSellerShiftReportDeclaration`, `getProductionQueueStatusDeclaration`, `checkInventoryStockDeclaration`.
  * Array exportado `salesAssistantTools`.
  * Funciones ejecutoras: `executeGetCashDrawerStatus`, `executeGetSellerShiftReport`, `executeGetProductionQueueStatus`, `executeCheckInventoryStock`, `constructDraftPayload`.
- **`server/services/ai/aiMediaService.js` (<200 líneas)**:
  * `normalizeCatalogSizeId`, `matchPosterEverywhere`.
  * `processVoiceSaleAudio`, `recognizePosterArtworkFromImage`, `recognizePostersFromVideo`, `processPostersBatchPhoto`.
- **`server/services/ai/aiStreamService.js` (<150 líneas)**:
  * `chatWithSalesAssistant`.
  * `streamChatWithSalesAssistant` (generador asíncrono SSE token a token).

### R2. Fachada Limpia con Cero Breaking Changes
Transformar `server/services/aiMultimodalService.js` en una fachada limpia de menos de 40 líneas que reexporte el 100% de los símbolos desde `./ai/*.js`:
```javascript
export * from './ai/aiPromptService.js';
export * from './ai/aiToolsService.js';
export * from './ai/aiMediaService.js';
export * from './ai/aiStreamService.js';
```
Garantizar compatibilidad retroactiva total para que ningún controlador, ruta ni import existente se rompa.

### R3. Identidad Pura Comercial de STAND {IA}
- Eliminar cualquier mención residual o prestada de "J.A.R.V.I.S." del prompt del sistema.
- Consolidar la personalidad oficial comercial de STAND {IA}: trato de "tú", enérgico, dinámico, consultor experto en arte pop y cultura friki/geek, promoviendo activamente el upselling del tamaño estrella Mediano (Q65.00) y la tecnología HP Látex.
- Renombrar `tests/ai/jarvis-prompt.test.js` a `tests/ai/stand-prompt.test.js` y actualizar sus assertions a la identidad canónica de STAND {IA}.

### R4. Aislamiento de Base de Datos y Blindaje de Pruebas
- En `tests/ai/db-tools-adversarial.test.js`, asegurar que `prisma.product.findMany` esté totalmente mockeado en los bloques `beforeEach` para eliminar cualquier intento de conexión de red externa a hosts Dokploy o PostgreSQL remotos.

## Acceptance Criteria

### Modularidad y Cumplimiento de Límites
- [ ] `server/services/aiMultimodalService.js` es una fachada de menos de 40 líneas.
- [ ] `server/services/ai/aiPromptService.js` tiene menos de 180 líneas.
- [ ] `server/services/ai/aiToolsService.js` tiene menos de 200 líneas.
- [ ] `server/services/ai/aiMediaService.js` tiene menos de 200 líneas.
- [ ] `server/services/ai/aiStreamService.js` tiene menos de 150 líneas.
- [ ] Todos los exports originales se mantienen accesibles desde `server/services/aiMultimodalService.js`.

### Identidad Pura y Tests Unitarios
- [ ] `tests/ai/jarvis-prompt.test.js` renombrado exitosamente a `tests/ai/stand-prompt.test.js`.
- [ ] Cero menciones de "J.A.R.V.I.S." en los prompts y en los tests de identidad.
- [ ] `node --test tests/ai/stand-prompt.test.js` ejecuta y aprueba al 100%.
- [ ] `tests/ai/db-tools-adversarial.test.js` ejecuta de forma aislada sin llamadas de red a bases de datos externas.

### Arnés de Calidad Deko Labs
- [ ] `npm run test:security` pasa al 100% (9/9 pruebas aprobadas).
- [ ] `npm run audit:secrets` pasa con 0 violaciones detectadas.
- [ ] `npm run audit:monoliths` reporta `aiMultimodalService.js` reducido fuera de estado crítico.
- [ ] `npm run build` (Vite) compila exitosamente para producción sin errores de importación.
- [ ] `npm run harness:check` culmina en estado de salida 0 (100% VERDE).

## 2026-09-11T23:29:09Z

# Teamwork Project Prompt — Final

> Status: Launched
> Goal: Execute modular refactoring of UnifiedAiChat.jsx with zero technical debt
> Requested team: 4 specialized subagents + Orchestrator (Fred)

Refactorizar modularmente el componente monolítico `src/components/UnifiedAiChat.jsx` (1,694 líneas) en submódulos atómicos bajo `src/components/ai-chat/`, reduciendo el contenedor maestro a menos de 80 líneas sin romper su contrato público de props ni la funcionalidad en producción.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Voice & Audio Architecture (`src/components/ai-chat/hooks/useAiVoiceRecorder.js`)
Extraer y encapsular la gestión completa de audio y detección de actividad de voz en un hook reactivo (<140 líneas):
- Parámetro de entrada: `onRecordingComplete(audioBlob)` callback.
- Negociación dinámica de códecs cross-browser (`audio/webm;codecs=opus`, `audio/mp4`, `audio/aac`, etc.).
- MediaRecorder, MediaStream (`echoCancellation`, `noiseSuppression`, `autoGainControl`).
- Voice Activity Detection (VAD) mediante Web Audio API (`AudioContext`, `AnalyserNode`, umbral RMS ~-50 dBFS, ventana de silencio de 1.5s).
- Temporizador de grabación, estados reactivos (`isRecording`, `recordingSeconds`, `vadActive`) y función de auto-cierre y cleanup estricto de pistas.
- Al terminar o silenciarse la grabación, emitir `onRecordingComplete(audioBlob)` con el blob y tipo MIME correcto.

### R2. Streaming SSE & Chat Engine (`src/components/ai-chat/hooks/useAiChatStream.js` y `ChatMessageList.jsx`)
Extraer el motor de comunicación asíncrona y la lista de mensajes:
- Hook `useAiChatStream` (<160 líneas):
  - Recibe `{ eventId, onSaleRegistered, onPopulateManualForm }`.
  - Expone: `{ messages, inputText, setInputText, isLoading, processingNote, pendingDraft, setPendingDraft, handleSendText, handleVoiceUpload, handleImageUpload, confirmPendingSale, updateDraftItemSize, updateDraftItemQty, removeDraftItem, updateDraftPaymentMethod, discardDraft, addPosterToDraft, selectSwapPoster }`.
  - Conexión SSE al endpoint `/api/ai/chat` (streaming token a token vía `ReadableStream` y `TextDecoder`), buffer desacoplado con `requestAnimationFrame` (`rafIdRef`), Circuit Breaker con `AbortController` (timeout 8s), fallback con motor heurístico local (`buildOfflineFallbackReply`), y captura de eventos SSE (`token`, `draft_sale`, `suggested_posters`, `event_kpis`, `cash_drawer_status`, `sellerShiftReport`, `productionQueueStatus`, `inventoryStock`, `done`, `error`).
  - `handleVoiceUpload(audioBlob)`: Envía formData al endpoint `/api/ai/voice-sale`, crea mensaje de usuario `🎙️ [Venta dictada por voz]`, procesa la respuesta y actualiza `pendingDraft` y mensaje del asistente.
  - `handleImageUpload(e)`: Envía formData al endpoint `/api/ai/recognize-artwork`, procesa análisis visual y actualiza `pendingDraft`.
  - `confirmPendingSale()`: Envía POST `/api/sales` con confetti y ejecuta `onSaleRegistered`.
- Componente `ChatMessageList` (<100 líneas): Renderizado del feed de mensajes con scroll anclado (`chatContainerRef`, `isPinnedToBottomRef`, `chatBottomRef`), avatares, formato Markdown con cursor titilante en streaming, timestamps y llamada a tarjetas de herramientas embebidas (`ChatToolCards`) y sugerencias de catálogo.

### R3. Tool Cards & Interactive Draft (`ChatToolCards.jsx`, `ChatDraftCard.jsx`, `ChatSwapModal.jsx`)
Modularizar las tarjetas de base de datos y la gestión del borrador interactivo:
- `ChatToolCards.jsx` (<140 líneas): Renderizado condicional de las 5 tarjetas de herramientas embebidas en el chat (`eventKpis`, `cashDrawerStatus`, `sellerShiftReport`, `productionQueueStatus`, `inventoryStock`).
- `ChatDraftCard.jsx` (<140 líneas): Tarjeta interactiva del borrador Human-in-the-Loop (`pendingDraft`):
  - Miniaturas WebP de obras.
  - Selector interactivo de tamaños (`DEFAULT_EVENT_SIZES`) con recálculo dinámico de precios (`updateDraftItemSize`).
  - Control de cantidades (+ / -) (`updateDraftItemQty`) y eliminación de ítems (`removeDraftItem`).
  - Selector de método de pago (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`).
  - Botones de acción: Descartar (`discardDraft`), Modificar (puebla manual form y resetea draft), y Confirmar Venta (`confirmPendingSale`).
- `ChatSwapModal.jsx` (<100 líneas): Modal / overlay para sustituir un diseño del borrador con búsqueda interactiva con debounce hacia `/api/catalog/web-posters` y selección inmediata (`selectSwapPoster`).

### R4. Header & Input Controls (`ChatHeader.jsx` y `ChatInputBar.jsx`)
Extraer los elementos visuales de la interfaz de usuario:
- `ChatHeader.jsx` (<50 líneas): Squircle con logo Origami STAND {IA}, título "Asistente IA" y badge "ON LINE" esmeralda con pulso.
- `ChatInputBar.jsx` (<80 líneas): Barra inferior con selector de archivo de cámara oculto (`input capture="environment"`), botón de micrófono reactivo, botón de cámara/arte, input de texto píldora y botón de envío. Estado dinámico cuando está grabando (temporizador rojo o indicador ámbar VAD con botón "Finalizar").

### R5. Constantes y Utilidades (`chatConstants.js`)
- `chatConstants.js` (<60 líneas):
  - `DEFAULT_EVENT_SIZES`
  - `SIZE_PRICE_MAP`, `SIZE_ALIASES`, `PAYMENT_ALIASES`
  - `buildOfflineFallbackReply(query)`
  - `formatTime(seconds)`

### R6. Contenedor Maestro Canónico (`src/components/UnifiedAiChat.jsx`)
Ensamblar los hooks y componentes atómicos en un contenedor maestro (<80 líneas):
- Firma pública intacta: `UnifiedAiChat({ eventId, onSaleRegistered, onPopulateManualForm })`.
- Integración limpia:
  ```jsx
  const chatStream = useAiChatStream({ eventId, onSaleRegistered, onPopulateManualForm });
  const voiceRecorder = useAiVoiceRecorder({ onRecordingComplete: chatStream.handleVoiceUpload });
  ```
- Cero breaking changes para `src/App.jsx`.
- Cero deuda técnica: Ningún archivo creado puede exceder las 200 líneas (componentes visuales <60-100 líneas). Prohibidos parches o hacks.

### R7. Aislamiento Sagrado & Zero-Trust
- Todas las operaciones deben ocurrir estrictamente dentro de `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`.
- Prohibido tocar repositorios o carpetas vecinas como `Web Deco Vintage Proyect`.
- Cero claves o secretos hardcodeados.

## Acceptance Criteria

### Integridad Arquitectónica y Límites de Líneas
- [ ] `src/components/UnifiedAiChat.jsx` contiene menos de 80 líneas de código.
- [ ] Todos los archivos creados en `src/components/ai-chat/` respetan sus techos de líneas:
  - `src/components/ai-chat/chatConstants.js` < 60 líneas.
  - `src/components/ai-chat/hooks/useAiVoiceRecorder.js` < 140 líneas.
  - `src/components/ai-chat/hooks/useAiChatStream.js` < 160 líneas.
  - `src/components/ai-chat/ChatMessageList.jsx` < 100 líneas.
  - `src/components/ai-chat/ChatToolCards.jsx` < 140 líneas.
  - `src/components/ai-chat/ChatDraftCard.jsx` < 140 líneas.
  - `src/components/ai-chat/ChatSwapModal.jsx` < 100 líneas.
  - `src/components/ai-chat/ChatHeader.jsx` < 50 líneas.
  - `src/components/ai-chat/ChatInputBar.jsx` < 80 líneas.
- [ ] Ningún archivo nuevo o modificado supera las 200 líneas de código.

### Auditoría y Arnés de Calidad Deko
- [ ] `npm run test:security` finaliza en VERDE con 9/9 pruebas aprobadas.
- [ ] `npm run audit:secrets` finaliza con 0 violaciones detectadas.
- [ ] `npm run audit:monoliths` reporta 17 o menos archivos excedidos (`UnifiedAiChat.jsx` eliminado de la lista de monolitos).
- [ ] `npm run build` compila con Vite sin errores de JSX, imports rotos o tipos (código de salida 0).
- [ ] `npm run harness:check` ejecuta todos los checks en cadena con éxito absoluto.

## 2026-09-12T00:41:51Z

# Teamwork Project Prompt — Phase 3: Modular Refactoring of EventsManagementView.jsx

> Goal: Refactorizar modularmente el componente monolítico `src/components/EventsManagementView.jsx` (1,111 líneas) en submódulos atómicos especializados bajo `src/components/events/`, reduciendo el contenedor maestro canónico a menos de 70 líneas sin romper su contrato público de props `{ onEventActivated }` ni la integración con `src/App.jsx`.  
> Requested team: Orquestado por Fred (`teamwork_preview_orchestrator`), quien coordinará el despiece a través de subagentes especializados y un auditor independiente.

Refactorizar modularmente el componente monolítico `src/components/EventsManagementView.jsx` (1,111 líneas) en una arquitectura atómica desacoplada bajo `src/components/events/`, garantizando cero breaking changes, cumplimiento del arnés Zero-Trust y reducción del inventario de monolitos.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

---

## Requirements

### R1. Hook Reactivo Central (`src/components/events/hooks/useEventsManager.js` — < 150 líneas)
- Encapsular la lógica de negocio y comunicación con la API autenticada (`authFetch`):
  - Consulta y recarga de eventos (`/api/events`), métricas consolidadas y estados.
  - Creación de eventos (`POST /api/events`).
  - Activación de evento con asignación de vendedor Google (`POST /api/events/:id/activate`).
  - Archivo y reactivación de eventos (`PATCH /api/events/:id/archive`).
  - Eliminación con validación de seguridad (`DELETE /api/events/:id`).
  - Historial de ventas de evento (`GET /api/sales/events/:id`).
- Manejo reactivo de estados: `events`, `isLoading`, `errorMsg`, modales activos y estados de envío (`isSubmitting...`).
- Techo estricto: **< 150 líneas**.

### R2. Tarjeta de Evento & Barra de Filtros
- **`src/components/events/EventCard.jsx` (< 140 líneas)**:
  - Renderizado de tarjeta de evento: badge de estado (Activo, Próximo, Finalizado, Archivado), fechas formateadas, ubicación, vendedor asignado y métricas de venta.
  - Acciones: Botón Activar (con callback `onEventActivated`), Ver Ventas, Archivar/Reactivar, Eliminar.
  - Techo estricto: **< 140 líneas**.
- **`src/components/events/EventsFilterBar.jsx` (< 70 líneas)**:
  - Input de búsqueda reactivo con icono.
  - Tabs de filtro de estado (Todos, Activos, Próximos, Archivados).
  - Botón principal de acción: "Nuevo Evento".
  - Techo estricto: **< 70 líneas**.

### R3. Suite Atómica de Modales (`src/components/events/modals/`)
- **`CreateEventModal.jsx` (< 120 líneas)**: Formulario de alta con validación de nombre, ubicación, fechas y metas.
- **`ActivateEventModal.jsx` (< 100 líneas)**: Formulario de activación asignando Google Email del vendedor y nombre de cajero.
- **`EventSalesModal.jsx` (< 130 líneas)**: Modal/Drawer de auditoría con desglose de ventas del evento, métodos de pago y totales.
- **`EventActionModals.jsx` (< 90 líneas)**: Diálogos de confirmación de Archivo y Eliminación con alertas preventivas.
- Ningún modal debe superar las **140 líneas**.

### R4. Contenedor Maestro Canónico (`src/components/EventsManagementView.jsx` — < 70 líneas)
- Orquestar `useEventsManager`, `EventsFilterBar`, `EventCard` y los modales especializados.
- **Contrato público obligatorio**: Exportar por defecto `EventsManagementView({ onEventActivated })`.
- Cero breaking changes en `src/App.jsx`.
- Techo estricto: **< 70 líneas** (reducción >93% respecto a las 1,111 líneas originales).

---

## Strict Constraints & Security
- **Regla Sagrada de Monolitos**: NINGÚN archivo nuevo o modificado puede superar las **200 líneas de código**. Todos los componentes visuales deben mantenerse entre 40 y 140 líneas.
- **Protocolo Zero-Trust y Aislamiento**: Prohibido hardcodear correos, secretos o conectar infraestructura externa (<RULE[user_global]>).
- **Cero Suposiciones e Integridad Funcional**: Prohibido crear mocks ficticios o dejar comentarios TODO/FIXME. Toda la funcionalidad preexistente debe seguir operativa.

---

## Acceptance Criteria

### 1. Erradicación del Monolito y Estructura
- [ ] `src/components/EventsManagementView.jsx` tiene menos de 70 líneas.
- [ ] `src/components/events/hooks/useEventsManager.js` existe y tiene menos de 150 líneas.
- [ ] `src/components/events/EventCard.jsx` existe y tiene menos de 140 líneas.
- [ ] `src/components/events/EventsFilterBar.jsx` existe y tiene menos de 70 líneas.
- [ ] Todos los modales en `src/components/events/modals/` existen y tienen menos de 140 líneas cada uno.
- [ ] NINGÚN archivo en `src/components/events/` supera las 200 líneas.

### 2. Calidad de Arnés & Calificación Técnica
- [ ] `npm run test:security` ejecuta y aprueba 9/9 tests (pass 9, fail 0).
- [ ] `npm run audit:secrets` reporta 0 violaciones en todos los archivos de producción.
- [ ] `npm run audit:monoliths` reporta `<= 16` archivos (con `EventsManagementView.jsx` eliminado de la lista de monolitos).
- [ ] `npm run build` compila con éxito mediante Vite (código de salida 0).
- [ ] Suite de pruebas unitarias/modulares creada para los nuevos submódulos y pasando al 100%.

### 3. Verificación en Vivo & Certificación Visual
- [ ] El auditor independiente inspecciona el resultado y certifica `VICTORY CONFIRMED`.
- [ ] Verificación activa con Chrome DevTools en vivo con capturas de pantalla de alta resolución demostrando la UI de eventos operativa.

## 2026-09-12T01:33:17Z

# Teamwork Project Prompt — Phase 4: Modular Refactoring of FastManualSaleForm.jsx

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Fred (`teamwork_preview_orchestrator`)

Refactorizar modularmente el componente monolítico `src/components/FastManualSaleForm.jsx` (749 líneas) en una arquitectura atómica desacoplada bajo `src/components/manual-sale/`, reduciendo el contenedor maestro canónico a menos de 70 líneas sin romper su contrato público de props `{ eventId, onSaleRegistered, initialDraft = null }` ni su integración con `src/App.jsx`.

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Integrity mode: `development`

---

## Requested Team & Orchestration Roadmap
Orquestado por **Fred** (`teamwork_preview_orchestrator`), quien coordinará el despiece a través de subagentes especializados y un auditor independiente:

- **M0: Survey & Contract Mapping**: Mapear el flujo del carrito, autocompletado de catálogo `/api/catalog/search`, inyección de `initialDraft` desde el chat de IA, y liquidación de ventas vía `POST /api/sales`.
- **M1: Constants & Reactive Hooks Architecture**:
  - `src/components/manual-sale/manualSaleConstants.js` (< 40 líneas): `DEFAULT_SIZES` canónicos y mapas de precios.
  - `src/components/manual-sale/hooks/useCatalogSearch.js` (< 90 líneas): Buscador debounceado con autocompletado y dismiss de dropdown.
  - `src/components/manual-sale/hooks/useManualSaleCart.js` (< 150 líneas): Estado reactivo del carrito, cálculo de subtotal/descuento/total, mutaciones, soporte para `initialDraft` y confirmación de venta con confetti.
- **M2: UI Submodules (Search, Configurator & Cart)**:
  - `src/components/manual-sale/CatalogSearchInput.jsx` (< 100 líneas): Input de búsqueda con dropdown flotante de pósters.
  - `src/components/manual-sale/PosterConfigurator.jsx` (< 120 líneas): Tarjeta de póster seleccionado, selector de tallas y selector de cantidad.
  - `src/components/manual-sale/SaleCartList.jsx` (< 120 líneas): Lista de pósters en la venta actual con modificadores (+/-) y eliminar.
- **M3: Payment & Settlement Shell**:
  - `src/components/manual-sale/PaymentSummaryBar.jsx` (< 110 líneas): Selector de método de pago (Efectivo/Tarjeta/Transfer), descuento, notas y botón principal de cobro.
  - `src/components/FastManualSaleForm.jsx` (< 70 líneas): Contenedor maestro canónico que preserva `{ eventId, onSaleRegistered, initialDraft = null }`.
- **M4: Quality Gate & Independent Victory Audit**:
  - `npm run harness:check` (Zero-Trust, auditoría de secretos, auditoría de monolitos y compilación Vite).
  - Suite de pruebas unitarias/adversariales (`tests/manual-sale/`) aprobada al 100%.
  - Certificación independiente `VICTORY CONFIRMED` con capturas de pantalla de alta resolución mediante Chrome DevTools MCP.

---

## Requirements

### R1. Constantes y Hooks Centrales (`src/components/manual-sale/hooks/`)
- **`manualSaleConstants.js` (< 40 líneas)**:
  - Exportar array `DEFAULT_SIZES` (`MINI`, `PEQUENO`, `MEDIANO`, `GRANDE`, `GIGANTE`, `PORTADA_ALBUM`) con sus precios canónicos.
- **`useCatalogSearch.js` (< 90 líneas)**:
  - Estados: `searchQuery`, `searchResults`, `isSearching`, `showDropdown`.
  - Búsqueda reactiva con debounce contra `/api/catalog/search?q=...`.
  - Cierre automático al hacer clic fuera del contenedor (ref-based).
- **`useManualSaleCart.js` (< 150 líneas)**:
  - Manejo del carrito: `cartItems`, `addItem`, `removeItem`, `updateItemQty`, `clearCart`.
  - Sincronización reactiva automática ante cambios en `initialDraft` (cuando proviene de sugerencias de la IA).
  - Estados de venta: `paymentMethod` (default `EFECTIVO`), `discount`, `notes`, `isSubmitting`.
  - Función de liquidación `confirmSale()`: validaciones de stock/evento, llamada a `POST /api/sales`, disparo de confetti, reset y ejecución de `onSaleRegistered()`.
  - Techo estricto: **< 150 líneas**.

### R2. Submódulos Visuales Atómicos (`src/components/manual-sale/`)
- **`CatalogSearchInput.jsx` (< 100 líneas)**:
  - Input oscuro con icono de lupa, botón limpiar y dropdown con scroll de resultados con miniatura y precio.
- **`PosterConfigurator.jsx` (< 120 líneas)**:
  - Tarjeta de póster activo, grid de píldoras de tallas con precio dinámico, contador numérico y botón "Agregar a la venta".
- **`SaleCartList.jsx` (< 120 líneas)**:
  - Lista de ítems del ticket, badge de tamaño, controles numéricos (+ / -), botón de papelera y estado vacío amigable.
- **`PaymentSummaryBar.jsx` (< 110 líneas)**:
  - Botones de método de pago con 1 solo toque (`Efectivo`, `Tarjeta`, `Transferencia`).
  - Inputs para descuento opcional y nota de cliente.
  - Desglose de totales y botón gigante de cobro con estado de carga.

### R3. Contenedor Maestro Canónico (`src/components/FastManualSaleForm.jsx` — < 70 líneas)
- Ensamblar limpiamente `useCatalogSearch`, `useManualSaleCart`, `CatalogSearchInput`, `PosterConfigurator`, `SaleCartList` y `PaymentSummaryBar`.
- **Contrato público obligatorio**: `export default function FastManualSaleForm({ eventId, onSaleRegistered, initialDraft = null })`.
- Cero breaking changes en `src/App.jsx`.
- Techo estricto: **< 70 líneas** (reducción >90% respecto a las 749 líneas originales).

### R4. Seguridad, Aislamiento y Calidad Estricta
- Cero fugas de credenciales, secretos hardcodeados o acoplamiento de infraestructura.
- Todas las dependencias e importaciones de React, Canvas Confetti y Lucide React deben ser genuinas y funcionales.

---

## Acceptance Criteria

### Monolito & Despiece Arquitectónico
- [ ] `src/components/FastManualSaleForm.jsx` tiene menos de 70 líneas de código efectivas.
- [ ] Todos los submódulos en `src/components/manual-sale/` cumplen estrictamente con sus techos de líneas:
  - `manualSaleConstants.js` < 40 líneas.
  - `useCatalogSearch.js` < 90 líneas.
  - `useManualSaleCart.js` < 150 líneas.
  - `CatalogSearchInput.jsx` < 100 líneas.
  - `PosterConfigurator.jsx` < 120 líneas.
  - `SaleCartList.jsx` < 120 líneas.
  - `PaymentSummaryBar.jsx` < 110 líneas.
- [ ] Ningún archivo en el proyecto supera los límites del arnés ni añade nueva deuda técnica.
- [ ] El conteo de monolitos reportado por `npm run audit:monoliths` se reduce de 16 a 15 archivos.

### Integración y Contrato Funcional
- [ ] El componente `FastManualSaleForm` mantiene su firma exacta `{ eventId, onSaleRegistered, initialDraft = null }` y se integra fluidamente con `src/App.jsx`.
- [ ] La búsqueda de catálogo responde reactivamente con debounce contra el endpoint real.
- [ ] La carga de `initialDraft` (cuando se despachan ventas desde el agente IA) pobla correctamente el carrito.
- [ ] El cálculo de totales, descuentos y métodos de pago es exacto y se envía exitosamente a `POST /api/sales`.
- [ ] El efecto visual de confetti y el reset del formulario operan sin fallos en el navegador.

### Quality Gate & Auditoría
- [ ] `npm run test:security`: 9/9 pruebas aprobadas (cero regresiones).
- [ ] `npm run audit:secrets`: 0 violaciones detectadas.
- [ ] `npm run audit:monoliths`: 15 archivos o menos (sin FastManualSaleForm en la lista).
- [ ] `npm run build`: Vite build compila con código de salida 0.
- [ ] Suite de pruebas unitarias/adversariales (`tests/manual-sale/`) creada y aprobada al 100%.
- [ ] Verificación en vivo realizada con Chrome DevTools MCP y certificación `VICTORY CONFIRMED` con evidencia visual.

## 2026-09-12T03:41:02Z

# Teamwork Project Prompt — Phase 5: Complete Frontend Monolith Eradication (`UserManagement`, `MonitorDashboard`, `ProductionManagement`, `EditSaleModal`, `CashClosing`)

> **Status**: Launched  
> **Goal**: Erradicar el 100% de la deuda monolítica restante en el frontend de STAND {IA}, despiezando modularmente los 5 componentes visuales administrativos (1,915 líneas totales) en submódulos atómicos especializados bajo sus respectivos directorios desacoplados. Cada contenedor maestro canónico debe quedar estrictamente por debajo de las 70 líneas, ningún submódulo puede superar las 140 líneas, reduciendo el inventario global de monolitos de 15 a 10 archivos sin romper ningún contrato público ni la integración con `src/App.jsx`.  
> **Requested team**: Orquestado por Fred (`teamwork_preview_orchestrator`), coordinando subagentes especializados (Exploradores, Workers modulares, Enjambre de Revisores y Desafiantes, Worker de QA en vivo con Chrome DevTools) y un Auditor Independiente de Victoria post-ejecución.  

---

### 📍 Working Directory & Environment
- **Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
- **Integrity mode**: development
- **Live Preview URL**: `http://localhost:5173/` (Vite) / Producción Dokploy: `https://ventas.decovintage.online/`
- **Base Branch**: `main`

---

### 🧱 Requirements & Scope of Decomposition

#### R1. Despiece Modular de `UserManagementView.jsx` (528 líneas ➔ < 70 líneas)
Crear el directorio `src/components/users/`:
- `hooks/useUsersManager.js` (< 140 líneas): Consulta de usuarios (`/api/users`), mutaciones de roles (`PATCH /api/users/:id/role`), creación/edición y manejo reactivo de estados con `authFetch`.
- `UserTable.jsx` (< 120 líneas): Renderizado responsivo de la tabla de usuarios, badges de roles (`SUPER_ADMIN`, `VENDEDOR`), avatares de Google y acciones.
- `UserFilterBar.jsx` (< 70 líneas): Barra de búsqueda, filtro por rol y botón CTA para nuevo usuario.
- `modals/UserEditModal.jsx` (< 110 líneas): Modal atómico para actualización de roles y asignación de eventos.
- `src/components/UserManagementView.jsx` (< 70 líneas): Contenedor maestro canónico que preserva su contrato e integración con `src/App.jsx`.

#### R2. Despiece Modular de `MonitorDashboardView.jsx` (422 líneas ➔ < 70 líneas)
Crear el directorio `src/components/monitor/`:
- `hooks/useMonitorDashboard.js` (< 130 líneas): Polling reactivo, consulta de KPIs globales y desglose por evento vía `authFetch`.
- `MonitorKpiGrid.jsx` (< 100 líneas): Tarjetas métricas de alta jerarquía (Total Vendido, Transacciones, Ticket Promedio, Última Venta).
- `PaymentMethodsBreakdown.jsx` (< 90 líneas): Gráfica/desglose visual porcentual (Efectivo, Tarjeta, Transferencia).
- `EventsPerformanceList.jsx` (< 120 líneas): Acordeones de eventos activos con métricas consolidadas y badge `STAND ACTIVO`.
- `src/components/MonitorDashboardView.jsx` (< 70 líneas): Contenedor maestro canónico preservando su contrato en `src/App.jsx`.

#### R3. Despiece Modular de `ProductionManagementView.jsx` (410 líneas ➔ < 70 líneas)
Crear el directorio `src/components/production/`:
- `hooks/useProductionQueue.js` (< 130 líneas): Carga reactiva de cola de taller (`/api/production/queue`), actualización de estados de póster (`PENDIENTE`, `IMPRESO`, `ENTREGADO`).
- `ProductionFilterTabs.jsx` (< 70 líneas): Tabs de estado de producción con contadores reactivos.
- `ProductionOrderCard.jsx` (< 120 líneas): Tarjeta de póster a producir: thumbnail, tamaño, notas de cliente, timestamp y botón de transición de estado con 1 toque.
- `src/components/ProductionManagementView.jsx` (< 70 líneas): Contenedor maestro canónico (< 70 líneas).

#### R4. Despiece Modular de `EditSaleModal.jsx` (330 líneas ➔ < 70 líneas)
Crear el directorio `src/components/sales/edit/`:
- `hooks/useEditSaleForm.js` (< 120 líneas): Lógica reactiva de edición, re-cálculo de totales/descuentos y envío a `PUT /api/sales/:id`.
- `EditSaleItemsTable.jsx` (< 110 líneas): Lista editable de pósters en la venta, selector de tamaño y cantidad.
- `src/components/EditSaleModal.jsx` (< 70 líneas): Contenedor modal maestro con backdrop accesible y botones de guardar/cancelar.

#### R5. Despiece Modular de `CashClosingView.jsx` (325 líneas ➔ < 70 líneas)
Crear el directorio `src/components/closing/`:
- `hooks/useCashClosing.js` (< 130 líneas): Cálculo de arqueo de caja, totales teóricos vs reales y cierre final de jornada.
- `CashDenominationGrid.jsx` (< 110 líneas): Contador de billetes y monedas en Quetzales (Q200, Q100, Q50, Q20, Q10, Q5, Q1).
- `CashClosingSummary.jsx` (< 90 líneas): Comparativa de efectivo declarado vs registrado y discrepancias.
- `src/components/CashClosingView.jsx` (< 70 líneas): Contenedor maestro canónico (< 70 líneas).

---

### 🔒 Strict Constraints & Security
1. **Regla Sagrada de Monolitos**:
   - NINGÚN archivo nuevo o modificado puede superar las 200 líneas bajo ninguna circunstancia.
   - Los 5 contenedores maestros canónicos deben medir estrictamente menos de 70 líneas.
   - Todos los submódulos deben mantenerse entre 40 y 140 líneas.
2. **Protocolo Zero-Trust y Aislamiento (<RULE[user_global]>)**:
   - Prohibido hardcodear credenciales, correos @gmail.com o conectar a infraestructura externa ajena.
   - Mantener el aislamiento estricto de base de datos y contenedores Dokploy.
3. **Cero Breaking Changes**:
   - Las importaciones y props en `src/App.jsx` deben permanecer 100% idénticas y funcionales.
   - Prohibido crear stubs, mocks o comentarios `TODO/FIXME`.
4. **Reducción del Inventario**:
   - El comando `node scripts/audit-monoliths.js` debe pasar de 15 a **10 archivos o menos** (Cero monolitos en el frontend).

---

### ✅ Acceptance Criteria & Quality Gates
1. **Calidad de Arnés Automático (`npm run harness:check`)**:
   - `npm run test:security`: 9/9 pruebas aprobadas (pass 9, fail 0).
   - `npm run audit:secrets`: 0 violaciones detectadas en todos los archivos de producción.
   - `npm run audit:monoliths`: Reporta exactamente <= 10 archivos (todos en backend; 0 en frontend).
   - `npm run build`: Vite build compila limpiamente para producción con código de salida 0.
2. **Suites de Pruebas Modulares**:
   - Pruebas unitarias completas creadas para los nuevos hooks y submódulos aprobadas al 100%.
3. **Verificación en Vivo con Chrome DevTools MCP**:
   - Navegación e interacción real con cada una de las 5 vistas en el navegador.
   - Capturas de pantalla de alta resolución demostrando que no existen regresiones visuales ni funcionales.
4. **Certificación Independiente de Victoria**:
   - El auditor independiente (`teamwork_preview_victory_auditor`) debe inspeccionar la entrega y emitir el veredicto oficial `VICTORY CONFIRMED` antes del reporte final.

## 2026-09-12T05:32:41Z

# Teamwork Project Prompt — Auditoría Forense 360° y Diagnóstico de Arquitectura Enterprise del Agente STAND {IA}

> **Status**: Launched  
> **Target System**: Agente de Inteligencia Artificial Multimodal STAND {IA}  
> **Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
> **Integrity mode**: development  
> **Requested team**: Fred (`teamwork_preview_orchestrator`)  
> **Mandato de Sebastián Jiménez & Gary (CTO)**: /teamwork-preview Realizar una radiografía profunda, quirúrgica y exhaustiva de cada línea de código, script, herramienta, esquema de Function Calling, puente con PostgreSQL y tubería de streaming del agente STAND {IA}. Identificar con precisión matemática por qué actualmente falla al registrar ventas, dar reportes y responder sobre el catálogo, y entregar el mapa de ruta definitivo para elevarlo al estándar enterprise de nivel mundial.

---

### 🧱 1. Directivas Sagradas y Reglas de Compromiso (<RULE[user_global]>)
1. **Aislamiento Sagrado de Infraestructura**: Toda la auditoría e inspección ocurre 100% dentro de `Modulo_Ventas` y sobre la base de datos `deko_eventsales_db`. Prohibido tocar o referenciar infraestructura externa.
2. **Zero-Trust de Credenciales**: Cero secretos, tokens o correos en texto plano.
3. **Cero Suposiciones y Cero Mocks**: Prohibido alucinar diagnósticos teóricos. Todo problema señalado debe estar referenciado con archivo exacto, número de línea (`file:///...#Lxx`) y comprobado mediante pruebas empíricas reales.
4. **Fase de Inspección Pura**: Prohibido alterar o parchar código fuente de producción durante esta fase. El objetivo exclusivo de este sprint es el diagnóstico forense, trazabilidad de fallos y diseño de la solución arquitectónica.

---

### 📋 2. Requerimientos Modulares de Auditoría (R1 a R6)

#### R1. Auditoría de la Tubería Conversacional, Streaming SSE y Gestión de Contexto
Inspeccionar a fondo la comunicación asíncrona entre el cliente y el servidor:
- **Archivos bajo lupa**:
  * Frontend: `src/components/ai-chat/hooks/useAiChatStream.js`, `src/components/ai-chat/ChatMessageList.jsx`, `src/components/ai-chat/UnifiedAiChat.jsx`.
  * Backend: `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`.
- **Puntos críticos a diagnosticar**:
  1. Identificar por qué ocurren respuestas vacías o degradadas cuando Gemini ejecuta herramientas (`functionCalls`).
  2. Evaluar el procesamiento del stream SSE (`ReadableStream`, decodificación de chunks y renderizado con `requestAnimationFrame`).
  3. Diagnosticar la pérdida de memoria conversacional multi-turno: ¿por qué el agente no resuelve pronombres ni continuidad básica de venta (ej. si el cliente dice *"¿tienes de Batman?"* y luego *"¿a cuánto el mediano?"*)?
  4. Revisar la estrategia de podado de historial en `UnifiedAiChat.jsx` y su impacto en la coherencia del diálogo.

#### R2. Auditoría del Sistema de Function Calling y Acceso a Base de Datos
Inspeccionar la declaración, despacho y retorno de las herramientas formales de `@google/genai`:
- **Archivos bajo lupa**:
  * Backend: `server/services/ai/aiToolsService.js`, `server/config/prisma.js`.
  * Frontend: `src/components/ai-chat/ChatToolCards.jsx`.
- **Puntos críticos a diagnosticar**:
  1. Revisar las 7 declaraciones de tools: `prepareSaleDraft`, `searchCatalog`, `getEventKPIs`, `getCashDrawerStatus`, `getSellerShiftReport`, `getProductionQueueStatus`, `checkInventoryStock`.
  2. Diagnosticar por qué el modelo decide o no disparar cada herramienta ante intenciones explícitas del usuario.
  3. Auditar la consistencia entre los tipos de datos declarados en los esquemas y las consultas reales a PostgreSQL (`prisma.$queryRaw`, agregaciones de ventas, usuarios y arqueos).
  4. Verificar cómo viajan los eventos SSE de tools hacia el frontend y por qué las tarjetas visuales (`ChatToolCards.jsx`) fallan en renderizar datos vivos de producción.

#### R3. Auditoría del Flujo de Registro de Ventas y Borrador Interactivo (Human-in-the-Loop)
Inspeccionar el ciclo completo desde que el cliente dicta una orden hasta que se asienta contablemente en el evento:
- **Archivos bajo lupa**:
  * Frontend: `src/components/ai-chat/ChatDraftCard.jsx`, `src/components/ai-chat/hooks/useAiVoiceRecorder.js`, `src/components/manual-sale/hooks/useManualSaleCart.js`.
  * Backend: `server/services/ai/aiMediaService.js`, `server/services/semanticParserService.js`, `server/services/saleService.js`.
- **Puntos críticos a diagnosticar**:
  1. Mapeo semántico de lenguaje natural: ¿por qué fallan frases complejas como *"1 de un verano sin ti portada en tarjeta y 2 de star wars mediano en efectivo"*?
  2. Extracción y normalización de tallas canónicas (`MINI`, `PEQUENO`, `MEDIANO`, `GRANDE`, `GIGANTE`, `PORTADA_ALBUM`) y precios de venta fijos.
  3. Identificar si el borrador (`pendingDraft`) se genera con todos los datos necesarios para confirmar con 1 solo toque (`POST /api/sales`) sin obligar al cajero a usar formularios manuales.
  4. Auditar la robustez del canal de voz (`Web Audio API`, VAD y transcripción multimodal) ante ruido ambiente típico de convenciones o ferias.

#### R4. Auditoría de Consultas de Catálogo, Grounding y Búsqueda Semántica
Inspeccionar el acceso al inventario real de obras de arte:
- **Archivos bajo lupa**:
  * Backend: `server/services/webCatalogService.js`, `server/services/catalogSyncService.js`, `prisma/schema.prisma` (tabla `Product`).
- **Puntos críticos a diagnosticar**:
  1. Evaluar la cobertura y sincronización de las 233 obras del catálogo oficial de Deco Vintage Guate.
  2. Diagnosticar por qué se truncan o limitan las búsquedas y cómo opera la deduplicación bicapa (por ID, slug de imagen y título normalizado).
  3. Evaluar el grounding de Gemini: ¿el agente conoce los detalles del producto (tintas ecológicas HP Látex, duración >10 años, instalación con cinta tesa® en 15 segundos) o responde como un bot genérico de internet?
  4. Auditar la disponibilidad física y verificación de stock en el stand.

#### R5. Auditoría del Pool de Modelos, Latencia y Resiliencia ante Fallos
Inspeccionar la infraestructura de inferencia y consumo de APIs de Google Cloud:
- **Archivos bajo lupa**:
  * Backend: `server/services/geminiPoolService.js`, `server/services/ai/aiPromptService.js`, `server/config/env.js`.
- **Puntos críticos a diagnosticar**:
  1. Diagnosticar la compatibilidad estricta con el SDK moderno `@google/genai` y el uso de modelos actuales (`gemini-3.6-flash` titular, `gemini-3.5-flash-lite` backup).
  2. Evaluar el manejo de contingencias: ¿qué sucede ante errores HTTP 429 (rate limits) o caídas de red en el evento? ¿El fallback offline (`buildOfflineFallbackReply`) aporta valor o es un callejón sin salida?
  3. Medir el Time-To-First-Byte (TTFB) y la latencia de respuesta en turnos conversacionales y de ejecución de herramientas.

#### R6. Matriz de Brechas (Gap Analysis) y Plan Maestro de Solución Definitiva
Elaborar el informe final consolidado:
- **Clasificación por severidad**: P0 (Bloqueantes comerciales), P1 (Alta prioridad funcional), P2 (Optimizaciones de experiencia y velocidad).
- **Para cada hallazgo**:
  * Archivo exacto y líneas de código (`file:///...#Lxx`).
  * Causa raíz técnica comprobada.
  * Impacto operativo en el stand de ventas.
  * Solución arquitectónica definitiva (sin parches provisionales ni deuda técnica).

---

### ✅ 3. Criterios de Aceptación y Certificación de Victoria
- [x] **Cobertura 100%**: Inspección sin omisiones de la totalidad de archivos del subsistema de IA en frontend (`src/components/ai-chat/`) y backend (`server/services/ai/`, `server/controllers/aiController.js`, `server/services/semanticParserService.js`).
- [x] **Cero Mocks en Diagnóstico**: Cada fallo reportado verificado directamente en el código o mediante inspección y scripts empíricos en `scratch/`.
- [x] **Aislamiento Sagrado Verificado**: Cero alteraciones de esquemas ajenos ni credenciales no autorizadas; operación confinada a `Modulo_Ventas` y `deko_eventsales_db`.
- [x] **Informe Consolidado**: Publicación del reporte maestro en `.agents/orchestrator_12/AUDIT_REPORT_STAND_IA.md`.
- [x] **Certificación Independiente de Victoria**: `VICTORY CONFIRMED` emitido por `victory_auditor_12`.

## 2026-09-12T06:30:00Z

# Teamwork Project Prompt — REHACER FASE 1: Estabilización Real, Erradicación de Falsos Éxitos y Conexión Viva de STAND {IA}

> **Status**: Relaunched (Mandato de Rehacer Fase 1 por Rechazo de Auditoría)  
> **Target System**: Agente de Inteligencia Artificial Multimodal STAND {IA}  
> **Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
> **Integrity mode**: development  
> **Requested team**: Fred (`teamwork_preview_orchestrator`)  
> **Mandato Supremo de Sebastián Jiménez & Gary (CTO)**: /teamwork-preview **REHACER POR COMPLETO LA FASE 1**. La entrega anterior fue RECHAZADA tajantemente en la auditoría en vivo con evidencia visual irrefutable: el agente NO se comunicó con Gemini, entró en timeout de 8 segundos, cayó en el fallback offline local (`buildOfflineFallbackReply`), machacó el mensaje del usuario y duplicó grotescamente la burbuja de error en la interfaz. Queda TERMINANTEMENTE PROHIBIDO pasar a la Fase 2 hasta que la Fase 1 esté 100% operativa con conexión viva a Gemini, sin mensajes duplicados, sin caídas en modo offline y con confirmación de ventas 1-touch funcionando en el navegador real.

---

### 🚨 1. Diagnóstico de la Evidencia que Causó el Rechazo
En la prueba en vivo capturada en navegador real se demostró que:
1. **Gemini NUNCA respondió**: Saltó el Circuit Breaker de 8 segundos (`AbortError`) en `useAiChatStream.js#L101`. El sistema cayó en el bloque `catch` que ejecutó `buildOfflineFallbackReply` en `chatConstants.js`. Lo que calculó los Q55 fue un regex estático de emergencia, NO la IA.
2. **Corrupción y Duplicación Visual**: La burbuja derecha del usuario (que debía decir la orden de compra) fue sustituida por el texto del error offline (`📡 Sin conexión a Gemini...`), y la burbuja izquierda del bot repitió exactamente el mismo mensaje. El estado de `messages` en `useAiChatStream.js` se corrompió.
3. **Falso Éxito**: Dar por buena una pantalla que grita en el centro "Sin conexión a Gemini" es inaceptable.

---

### 🧱 2. Directivas Sagradas y Reglas de Compromiso (<RULE[user_global]>)
1. **Aislamiento Sagrado**: Operar 100% dentro de `Modulo_Ventas` y `deko_eventsales_db`.
2. **Zero-Trust de Credenciales**: Cero secretos o tokens expuestos.
3. **Cero Mocks y Cero Autoengaños**: Una respuesta proveniente de `buildOfflineFallbackReply` es considerada un **FALLO TOTAL** de la prueba. Solo se acepta como válida una respuesta con tokens reales generados por Gemini.
4. **Arnés de Calidad Inviolable**: Mantener en verde `npm run harness:check` (`test:security`, `audit:secrets`, `audit:monoliths`, `build`).

---

### 📋 3. Requerimientos Obligatorios de Rehacer Fase 1 (RF1 a RF7)

#### RF1. Erradicación de Corrupción y Duplicación de Mensajes en el Chat
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `src/components/ai-chat/ChatMessageList.jsx`, `src/components/ai-chat/ChatInputBar.jsx`.
- **Causa a corregir**: `id: Date.now()` y `aiMsgId = Date.now() + 1` generan colisiones de claves en React y permiten que `updateAiMsg` machaque el mensaje del usuario si los IDs coinciden o si el array se reasigna. Además, `ChatInputBar` debe limpiar el input de forma reactiva determinista.
- **Acción Obligatoria**:
  - Usar IDs estables y únicos garantizados (`crypto.randomUUID()` o contador incremental inmutable).
  - El mensaje del usuario (`sender: 'user'`) debe ser **estrictamente inmutable**: una vez insertado en `messages`, ninguna función de error o fallback puede alterar su propiedad `text`.
  - Asegurar que `updateAiMsg` solo modifique de forma atómica el mensaje de la IA con `sender: 'ai'`.

#### RF2. Blindaje del Timeout y Tubería de Comunicación con Gemini
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`.
- **Causa a corregir**: El timeout de 8 segundos (`circuitBreakerTimeout`) es excesivamente agresivo para inferencias de LLM con Function Calling en frío, provocando que cualquier demora normal de red aborte la conexión y caiga en el fallback offline.
- **Acción Obligatoria**:
  - Elevar el timeout a **25 segundos** en `useAiChatStream.js`.
  - Asegurar que el backend capture fallos de red sin colapsar el stream y que devuelva el stream SSE correctamente con tokens y eventos estructurados.
  - Asegurar que el fallback offline SOLO se active si el navegador está literalmente sin internet (`!navigator.onLine`), y que NUNCA altere ni mute el mensaje del usuario ni duplique burbujas.

#### RF3. Normalización de MIME Types en Multer (Voz en Chrome/Android)
- **Archivos**: `server/middleware/uploadMiddleware.js`.
- **Acción Obligatoria**: Normalizar `file.mimetype.split(';')[0].trim().toLowerCase()`. Garantizar que `audio/webm;codecs=opus` sea aceptado por la lista blanca.

#### RF4. Blindaje de UUID en Borrador de Venta (1-Touch Sale sin Error 400)
- **Archivos**: `server/services/ai/aiToolsService.js`, `src/components/ai-chat/hooks/useAiChatStream.js`, `server/validators/saleValidators.js`.
- **Acción Obligatoria**: Si una obra no tiene UUID en la base de datos (obras bajo demanda o personalizadas de alias), normalizar determinísticamente `productId = null`. Asegurar que `confirmPendingSale` (`POST /api/sales`) asiente la venta con código 201 en 1 solo toque.

#### RF5. Cuadre Contable de Descuentos
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`.
- **Acción Obligatoria**: Asignar al pago el total neto descontado exacto: `netTotal = Math.max(0, grandTotal - (pendingDraft.discount || 0))`. Cero rechazos contables por centavos.

#### RF6. Talla Canónica `PORTADA_ALBUM` (Q55.00)
- **Archivos**: `src/components/ai-chat/chatConstants.js`, `src/components/ai-chat/ChatDraftCard.jsx`, `server/services/ai/aiToolsService.js`.
- **Acción Obligatoria**: `{ sizeId: 'PORTADA_ALBUM', name: 'Portada Álbum (30x30 cm)', price: 55 }` registrado universalmente con precio Q55.00.

#### RF7. Parser SSE por Bloques Dobles `\n\n`
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`.
- **Acción Obligatoria**: Acumulador estricto por bloques `\n\n` que decodifique `event:` y `data:` sin perder paquetes fragmentados.

---

### ✅ 4. Criterios Inquebrantables de Aceptación (Condición para pasar a Fase 2)
- [ ] **Cero Mensajes de "Sin conexión a Gemini"**: El chat debe comunicarse en vivo con Gemini y emitir respuesta real.
- [ ] **Cero Duplicación de Burbujas**: El mensaje del usuario permanece a la derecha con su texto original; la respuesta de la IA aparece a la izquierda sin clonarse.
- [ ] **Borrador Interactivo Operativo**: La tarjeta de borrador se genera y permite cambiar talla a `Portada Álbum (Q55)`.
- [ ] **Confirmación 1-Touch Exitosa**: Al presionar `Confirmar Venta`, la venta se registra en PostgreSQL sin error 400.
- [ ] **Harness 100% Verde**: `test:security`, `audit:secrets`, `audit:monoliths`, `build` aprobados.
- [ ] **Prueba Visual en Vivo con Chrome DevTools MCP**: Capturas de pantalla que demuestren el chat limpio, sin errores y con la venta asentada.
- [ ] **Certificación de Victoria**: `VICTORY CONFIRMED` emitido por el Auditor Independiente.







## 2026-09-12T06:36:48Z

# Teamwork Project Prompt — REHACER FASE 1: Estabilización Real, Erradicación de Falsos Éxitos y Conexión Viva de STAND {IA}

> **Status**: Launched  
> **Target System**: Agente de Inteligencia Artificial Multimodal STAND {IA}  
> **Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
> **Integrity mode**: development  
> **Requested team**: Fred (`teamwork_preview_orchestrator`)  
> **Mandato de Sebastián Jiménez & Gary (CTO)**: /teamwork-preview REHACER POR COMPLETO LA FASE 1. La entrega anterior fue RECHAZADA tajantemente en la auditoría en vivo con evidencia visual irrefutable: el agente NO se comunicó con Gemini, entró en timeout de 8 segundos, cayó en el fallback offline local (buildOfflineFallbackReply), machacó el mensaje del usuario y duplicó grotescamente la burbuja de error en la interfaz. Queda TERMINANTEMENTE PROHIBIDO pasar a la Fase 2 hasta que la Fase 1 esté 100% operativa con conexión viva a Gemini, sin mensajes duplicados, sin caídas en modo offline y con confirmación de ventas 1-touch funcionando en el navegador real.

---

### 🚨 1. Diagnóstico de la Evidencia que Causó el Rechazo
1. **Gemini NUNCA respondió**: Saltó el Circuit Breaker prematuro de 8 segundos (`AbortError`) en `useAiChatStream.js`. El sistema cayó en el bloque catch que ejecutó `buildOfflineFallbackReply` en `chatConstants.js`. Lo que calculó los Q55 fue un regex estático de emergencia, NO la IA.
2. **Corrupción y Duplicación Visual**: La burbuja derecha del usuario (que debía decir la orden de compra) fue sustituida por el texto del error offline (*"📡 Sin conexión a Gemini..."*), y la burbuja izquierda del bot repitió exactamente el mismo mensaje. El estado de `messages` en `useAiChatStream.js` se corrompió debido a colisión de IDs basados en `Date.now()` y mutación no segregada por rol.
3. **Falso Éxito**: Dar por buena una pantalla que muestra *"Sin conexión a Gemini"* es inaceptable y viola las directivas de cero suposiciones y pruebas en vivo obligatorias.

---

### 🧱 2. Directivas Sagradas y Reglas de Compromiso (<RULE[user_global]>)
1. **Aislamiento Sagrado de Infraestructura**: Toda la auditoría e inspección ocurre 100% dentro de `Modulo_Ventas` y sobre la base de datos `deko_eventsales_db`. Prohibido tocar o referenciar infraestructura externa.
2. **Zero-Trust de Credenciales**: Cero secretos, tokens o correos en texto plano.
3. **Cero Suposiciones y Cero Mocks**: Cero respuestas simuladas de IA en producción. Todo debe ser verificado con conexiones reales a Gemini y PostgreSQL.
4. **Verificación Visual Obligatoria en Vivo**: El trabajo solo se considera terminado cuando se navegue en el navegador real vía Chrome DevTools MCP, se interactúe con el chat, se reciba respuesta real de Gemini y se capture evidencia visual irrefutable.

---

### 📋 3. Requerimientos Obligatorios de Rehacer Fase 1 (RF1 a RF7)

#### RF1. Erradicación de Corrupción y Duplicación de Mensajes en el Chat
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `src/components/ai-chat/ChatMessageList.jsx`, `src/components/ai-chat/ChatInputBar.jsx`.
- **Acción Obligatoria**:
  * Usar IDs únicos e inmutables garantizados (`crypto.randomUUID()` o generador atómico garantizado) erradicando cualquier colisión por `Date.now()`.
  * El mensaje del usuario (`sender: 'user'`) es estrictamente inmutable: una vez renderizado con el texto que escribió el usuario, ninguna rutina de error o fallback puede alterar su propiedad `text`.
  * `updateAiMsg` solo puede modificar de forma atómica el mensaje con `sender: 'ai' && m.id === aiMsgId`.

#### RF2. Blindaje del Timeout y Tubería de Comunicación con Gemini
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`.
- **Acción Obligatoria**:
  * Elevar el timeout del Circuit Breaker a 25 segundos en `useAiChatStream.js` para no abortar prematuramente llamadas de LLM en frío o con latencia de red.
  * Asegurar que el endpoint `/api/ai/chat` capture fallos sin tumbar la conexión y emita tokens reales en streaming SSE.
  * El fallback offline SOLO se permite si el navegador está literalmente sin internet (`!navigator.onLine`), y NUNCA altera el mensaje del usuario ni duplica burbujas.

#### RF3. Normalización de MIME Types en Multer (Voz en Chrome/Android)
- **Archivo**: `server/middleware/uploadMiddleware.js`.
- **Acción Obligatoria**: Preservar y blindar la normalización `file.mimetype.split(';')[0].trim().toLowerCase()` para que grabaciones WebRTC `audio/webm;codecs=opus` sean aceptadas limpiamente.

#### RF4. Blindaje de UUID en Borrador de Venta (1-Touch Sale sin Error 400)
- **Archivos**: `server/services/ai/aiToolsService.js`, `src/components/ai-chat/hooks/useAiChatStream.js`, `server/validators/saleValidators.js`.
- **Acción Obligatoria**: Si una obra no tiene UUID en la base de datos (obras bajo demanda o personalizadas de alias), normalizar determinísticamente `productId = null`. Asegurar que `confirmPendingSale` (`POST /api/sales`) asiente la venta con código 201 en 1 solo toque.

#### RF5. Cuadre Contable de Descuentos
- **Archivo**: `src/components/ai-chat/hooks/useAiChatStream.js`.
- **Acción Obligatoria**: Asignar al pago el total neto descontado exacto: `netTotal = Math.max(0, grandTotal - (pendingDraft.discount || 0))`. Cero discrepancias por centavos en backend.

#### RF6. Talla Canónica PORTADA_ALBUM (Q55.00)
- **Archivos**: `src/components/ai-chat/chatConstants.js`, `src/components/ai-chat/ChatDraftCard.jsx`, `server/services/ai/aiToolsService.js`.
- **Acción Obligatoria**: `{ sizeId: 'PORTADA_ALBUM', name: 'Portada Álbum (30x30 cm)', price: 55 }` registrado universalmente en frontend y backend con precio Q55.00.

#### RF7. Parser SSE por Bloques Dobles \n\n
- **Archivo**: `src/components/ai-chat/hooks/useAiChatStream.js`.
- **Acción Obligatoria**: Acumulador estricto por bloques `\n\n` que decodifique `event:` y `data:` sin perder paquetes fragmentados.
- **Restricción**: Mantener `chatConstants.js` en `< 60` líneas y `useAiChatStream.js` en `< 160` líneas.

---

### ✅ 4. Criterios Inquebrantables de Aceptación (Condición para pasar a Fase 2)
- [ ] **Cero Mensajes de "Sin conexión a Gemini"**: El chat debe comunicarse en vivo con Gemini y emitir respuesta real del modelo.
- [ ] **Cero Duplicación de Burbujas**: El mensaje del usuario permanece a la derecha con su texto original; la respuesta de la IA aparece a la izquierda sin clonarse.
- [ ] **Borrador Interactivo Operativo**: La tarjeta de borrador se genera con datos reales y permite cambiar talla a Portada Álbum (Q55).
- [ ] **Confirmación 1-Touch Exitosa**: Al presionar "Confirmar Venta", la venta se registra en PostgreSQL sin error 400 ni fallo contable.
- [ ] **Harness 100% Verde**: `npm run harness:check` aprobado (security, secrets, monoliths, build).
- [ ] **Prueba Visual en Vivo con Chrome DevTools MCP**: Navegación real en navegador, ejecución de venta por chat y captura de pantalla de alta resolución demostrando el chat limpio y la venta asentada.
- [ ] **Certificación de Victoria**: `VICTORY CONFIRMED` emitido por el Auditor Independiente de Victoria.

## 2026-09-12T19:00:00Z

# Teamwork Project Prompt — FASE 2: Function Calling Closed-Loop, Memoria Conversacional Multi-Turno y Robustez Enterprise de STAND {IA}

> **Status**: Ready for Dispatch  
> **Target System**: Agente de Inteligencia Artificial Multimodal STAND {IA}  
> **Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
> **Integrity mode**: development  
> **Requested team**: Fred (`teamwork_preview_orchestrator`)  
> **Mandato de Sebastián Jiménez & Gary (CTO)**: Despacho oficial de la **FASE 2** tras la certificación y cierre definitivo de la Fase 1 en producción (`https://ventas.decovintage.online/`). La Fase 2 eleva a STAND {IA} de un ejecutor unario de herramientas a un asesor comercial de alta gama con **Closed-Loop Function Calling**, streaming dual de razonamiento + datos estructurados (erradicación de `hasTextTokens`), memoria conversacional de 20 turnos con edición en cadena del borrador activo, optimización anti-N+1 en PostgreSQL y depuración quirúrgica de la UI.

---

### 🚨 1. Contexto y Objetivos Estratégicos
En la Fase 1 se logró la estabilidad de conexión viva a Gemini, el parser SSE determinista, la talla canónica `PORTADA_ALBUM` (Q55) y la confirmación de venta en un solo toque en PostgreSQL.
En esta **Fase 2**, eliminamos la desconexión entre la ejecución de herramientas y el lenguaje natural:
1. **Closed-Loop Real**: Cuando Gemini ejecuta una tool (`prepareSaleDraft`, `searchCatalog`, etc.), el resultado se reenvía al modelo en el mismo turno (`role: 'tool'`), para que Gemini explique con calidez qué preparó, qué encontró y proponga venta cruzada (*upselling*) con el tamaño Mediano Q65 o la Portada Álbum Q55.
2. **Streaming Dual sin Supresión**: Erradicar `hasTextTokens`. La UI debe recibir tanto los eventos estructurados (`draft_sale`, `suggested_posters`, etc.) como el flujo de tokens explicativos de la IA.
3. **Memoria Conversacional y Edición en Cadena (20 turnos)**: El usuario puede modificar el borrador conversacionalmente ("cámbiala a grande", "hazle Q10 de descuento", "agrega otra portada") sin que el sistema pierda el estado ni obligue a reescribir todo.
4. **Cero N+1 en Reportes**: Optimizar `executeGetSellerShiftReport` con agregaciones nativas de PostgreSQL en Prisma.
5. **UI Limpia**: `ChatToolCards.jsx` no debe renderizar tarjetas vacías o rotas ante `found: false`, ni emitir eventos duplicados de stock.

---

### 🧱 2. Directivas Sagradas y Reglas de Compromiso (<RULE[user_global]>)
1. **Aislamiento Sagrado de Infraestructura**: Todo el desarrollo y pruebas ocurren 100% dentro de `Modulo_Ventas` y `deko_eventsales_db`. Prohibido tocar o referenciar infraestructura ajena.
2. **Zero-Trust de Credenciales**: Cero secretos, tokens o correos expuestos en código o tests.
3. **Cero Suposiciones y Cero Mocks**: Cero respuestas simuladas en producción. Todo debe ser verificado con conexiones reales a Gemini y PostgreSQL.
4. **Vigilancia de Techos de Líneas (Arnés Anti-Monolitos)**:
   - `server/services/ai/aiStreamService.js` < 150 líneas.
   - `server/services/ai/aiToolsService.js` < 200 líneas.
   - `src/components/ai-chat/hooks/useAiChatStream.js` < 160 líneas.
   - `src/components/ai-chat/ChatToolCards.jsx` < 140 líneas.
   - *Directiva de Modularización*: Cualquier lógica compleja adicional DEBE extraerse en servicios satélite dedicados:
     - `server/services/ai/aiClosedLoopService.js` (para orquestar el reenvío de tools a Gemini).
     - `server/services/ai/aiShiftReportService.js` (para agregaciones y consultas SQL/Prisma de vendedores).
5. **Harness 100% Verde**: Mantener `npm run harness:check` (`test:security`, `audit:secrets`, `audit:monoliths`, `build`) en verde inmutable.
6. **Zero-Claim Policy**: Fred y sus workers no emiten declaraciones de victoria sin pruebas automatizadas verdes. Gary realiza el despliegue mecánico (`npm run deploy`) y la verificación en vivo con Chrome DevTools MCP.

---

### 📋 3. Requerimientos Técnicos Detallados de Fase 2 (F2.1 a F2.5)

#### F2.1. Arquitectura Closed-Loop Function Calling en Streaming
- **Archivos**: `server/services/ai/aiStreamService.js`, `server/services/ai/aiClosedLoopService.js` (nuevo módulo modular).
- **Acción Obligatoria**:
  * Al detectar `functionCalls` en el stream de Gemini (`prepareSaleDraft`, `searchCatalog`, `getEventKPIs`, etc.):
    1. Ejecutar la herramienta en backend inmediatamente.
    2. Emitir de inmediato el evento estructurado correspondiente por SSE (`event: draft_sale`, `event: suggested_posters`, etc.) para que la tarjeta visual se monte instantáneamente en el frontend.
    3. Construir el turno de respuesta de herramienta con el contrato oficial de `@google/genai`:
       `{ role: 'tool', parts: [{ functionResponse: { name: call.name, response: toolResult } }] }`.
    4. Invocar el stream de cierre con Gemini (`streamWithModelFallback` o `models.generateContentStream`) con el historial extendido y la respuesta de la tool, para que el modelo emita tokens de explicación natural, entusiasmo comercial y recomendaciones de upselling en streaming directo.
  * Si la llamada closed-loop falla por timeout o error de red, emitir un cierre cordial seguro sin tumbar la conexión SSE (`type: 'token'`).

#### F2.2. Erradicación de `hasTextTokens` y Streaming Dual Simultáneo
- **Archivos**: `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`, `src/components/ai-chat/hooks/useAiChatStream.js`.
- **Acción Obligatoria**:
  * Eliminar la bandera `hasTextTokens` y la lógica condicional que suprimía tokens si existía una llamada a herramienta o viceversa.
  * Garantizar que la tubería SSE soporte la emisión limpia tanto de tokens de texto continuos como de eventos de tarjeta intercalados.
  * En `useAiChatStream.js`, verificar que la acumulación de texto mediante `requestAnimationFrame` opere en paralelo con la recepción de eventos `draft_sale` y `suggested_posters`, sin sobreescribir ni resetear el texto en streaming.

#### F2.3. Memoria Conversacional Multi-Turno y Edición en Cadena del Borrador (20 turnos)
- **Archivos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `server/services/ai/aiPromptService.js`, `server/services/ai/aiStreamService.js`.
- **Acción Obligatoria**:
  * Ampliar el historial enviado por el frontend a **20 turnos** (`messages.slice(-20)`), preservando los roles `user` y `model` con sus contenidos limpios.
  * Inyectar determinísticamente `pendingDraft` en el payload (`POST /api/ai/chat`), y en el prompt del sistema (`buildSalesSystemPrompt`).
  * Soportar edición fluida en cadena del borrador:
    - *"Cámbialo a tamaño grande"* -> Actualiza el ítem a tamaño `GRANDE` (Q125.00) recalculando el total.
    - *"Hazle Q10 de descuento"* -> Aplica descuento de Q10, ajustando el neto contable exacto.
    - *"Va a pagar con tarjeta"* -> Cambia el método de pago a `TARJETA`.
    - *"Agrega una portada de álbum de Taylor Swift"* -> Agrega el segundo ítem al borrador preservando el anterior.

#### F2.4. Erradicación del Cuello de Botella N+1 en Reportes de Turno
- **Archivos**: `server/services/ai/aiToolsService.js`, `server/services/ai/aiShiftReportService.js` (nuevo módulo para evitar monolitos).
- **Acción Obligatoria**:
  * Refactorizar `executeGetSellerShiftReport`: Erradicar el bucle `salesGroup.map(async (g) => prisma.salePayment.groupBy(...))`.
  * Realizar la agregación de pagos agrupados en una sola consulta o mediante agregación SQL eficiente, indexada por `eventId` y `sellerId`.
  * Reducir `aiToolsService.js` para mantenerlo cómodamente por debajo de 200 líneas (ideal < 140 líneas).

#### F2.5. Depuración de UI en Tarjetas y Supresión de Eventos Duplicados
- **Archivos**: `src/components/ai-chat/ChatToolCards.jsx`, `server/services/ai/aiStreamService.js`.
- **Acción Obligatoria**:
  * En `ChatToolCards.jsx`: Blindar el renderizado de `inventoryStock` (`inv`). Si `inv.found === false` o no hay obra (`!inv.artwork`), NO renderizar un contenedor vacío ni bordes huérfanos.
  * En `aiStreamService.js`: Al ejecutar `checkInventoryStock`, no emitir un evento redundante `suggested_posters` que duplique tarjetas en el chat si `inventoryStock` ya contiene los datos.
  * Mantener `ChatToolCards.jsx` en `< 140 líneas`.

---

### ✅ 4. Criterios Inquebrantables de Aceptación (Condición de Entrega)
- [ ] **Closed-Loop Operativo**: Tras generar un borrador o buscar en catálogo, Gemini responde en streaming con lenguaje natural, tono vendedor y argumentos comerciales reales (cero monosílabos, cero respuestas vacías).
- [ ] **Dual Stream Funcional**: El chat muestra tanto el texto conversacional en streaming como las tarjetas interactivas (borrador, pósters o KPIs).
- [ ] **Edición en Cadena Verificada**: Se puede modificar un borrador existente por texto ("cámbiala a grande", "descuento de Q10") y el borrador en pantalla se actualiza reactivamente sin reiniciarse.
- [ ] **Cero N+1 en Base de Datos**: Las consultas de reporte de vendedores y gaveta se ejecutan sin bucles de consultas concurrentes individuales.
- [ ] **UI de Tarjetas Impecable**: Cero tarjetas rotas o vacías ante búsquedas sin stock (`found: false`).
- [ ] **Límites de Líneas y Arnés 100% Verde**: `npm run harness:check` aprueba `test:security`, `audit:secrets`, `audit:monoliths` y `build` con cero advertencias.
- [ ] **Verificación y Despliegue Oficial**: Fred entrega el código limpio a Gary. Gary ejecuta `npm run deploy`, confirma el commit en Dokploy, inyecta sesión en Chrome DevTools MCP y prueba en vivo la edición en cadena con captura visual de evidencia.

## 2026-09-12T19:07:46Z

# Teamwork Project Prompt — FASE 2: Function Calling Closed-Loop, Memoria Conversacional Multi-Turno y Robustez Enterprise de STAND {IA}

> **Status**: Launched
> **Goal**: Craft prompt → get user approval → delegate to `teamwork_preview`
> **Requested team**: Fred (`teamwork_preview_orchestrator`)

Transformar el agente STAND {IA} en un asesor comercial conversacional de alta gama con Closed-Loop Function Calling, streaming dual simultáneo continuo (erradicando `hasTextTokens`), memoria de 20 turnos con edición interactiva en cadena de borradores de venta, erradicación de consultas N+1 en PostgreSQL y depuración quirúrgica de tarjetas de interfaz.

**Working directory**: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
**Integrity mode**: development  
**Target Production**: `https://ventas.decovintage.online/`  
**Context Reference**: Mandato oficial de Sebastián Jiménez & Gary (CTO) tras cierre y certificación en producción de Fase 1 (commit Dokploy `1d41cec`).

---

## Directivas Sagradas e Inviolables (<RULE[user_global]>)
1. **Aislamiento Sagrado de Infraestructura**: Todo el desarrollo y pruebas ocurren 100% dentro de `Modulo_Ventas` y sobre la base de datos `deko_eventsales_db`. Prohibido tocar o referenciar infraestructura externa o bases de datos de otros proyectos.
2. **Zero-Trust de Credenciales**: Cero secretos, API keys o tokens expuestos en código o tests.
3. **Cero Suposiciones y Cero Mocks**: Cero respuestas simuladas en producción. Operar exclusivamente con conexiones reales a Gemini (`@google/genai`) y PostgreSQL (`@prisma/client`).
4. **Vigilancia Militar de Techos de Líneas (Arnés Anti-Monolitos)**:
   - `server/services/ai/aiStreamService.js`: Techo estricto **< 150 líneas**.
   - `server/services/ai/aiToolsService.js`: Techo estricto **< 200 líneas** (objetivo: < 140 líneas).
   - `src/components/ai-chat/hooks/useAiChatStream.js`: Techo estricto **< 160 líneas**.
   - `src/components/ai-chat/ChatToolCards.jsx`: Techo estricto **< 140 líneas**.
   - **Módulos Satélite Obligatorios**:
     * `server/services/ai/aiClosedLoopService.js`: Orquestación del reenvío de tools a Gemini y ciclo continuo.
     * `server/services/ai/aiShiftReportService.js`: Agregaciones nativas consolidada de ventas y métricas de turno sin N+1.
5. **Harness 100% Verde Inmutable**: Mantener `npm run harness:check` (`test:security`, `audit:secrets`, `audit:monoliths`, `build`) en verde inmutable.
6. **Zero-Claim Policy**: No declarar victoria sin verificación automatizada. Gary (CTO) realiza el despliegue mecánico (`npm run deploy`) y la verificación en vivo en navegador real con Chrome DevTools MCP.

---

## Requirements

### R1. Arquitectura Closed-Loop Function Calling en Streaming
- **Módulos**: `server/services/ai/aiStreamService.js`, `server/services/ai/aiClosedLoopService.js` (nuevo).
- Cuando Gemini invoque una herramienta (`prepareSaleDraft`, `searchCatalog`, `getEventKPIs`, etc.):
  1. Ejecutar inmediatamente la herramienta en PostgreSQL / Catálogo.
  2. Emitir de inmediato el evento estructurado por SSE (`event: draft_sale`, `event: suggested_posters`, etc.) para que la tarjeta se monte instantáneamente en el frontend sin esperar el texto.
  3. Construir el turno de respuesta de herramienta con el contrato oficial de `@google/genai`:  
     `{ role: 'tool', parts: [{ functionResponse: { name: call.name, response: toolResult } }] }`.
  4. Reenviar de inmediato a Gemini el historial con el turno de la tool en el mismo ciclo.
  5. Gemini emitirá en streaming sus tokens explicativos con calidez, lenguaje comercial natural, confirmación clara de lo preparado y sugerencias de upselling (tamaño Mediano Q65, Portada Álbum Q55 o cinta tesa®).
  6. En caso de timeout o contingencia, emitir cierre cordial sin romper el canal SSE.

### R2. Erradicación de `hasTextTokens` y Streaming Dual Simultáneo
- **Módulos**: `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`, `src/components/ai-chat/hooks/useAiChatStream.js`.
- Eliminar la variable `hasTextTokens` y cualquier lógica condicional que suprima tokens si hay herramientas o viceversa.
- Garantizar que el canal SSE transmita de forma intercalada y limpia tanto tokens de texto (`event: token`) como eventos estructurados (`event: draft_sale`, `event: suggested_posters`, etc.).
- En `useAiChatStream.js`, verificar que el acumulador con `requestAnimationFrame` renderice el texto progresivo sin colisionar ni resetearse cuando llega un evento de tarjeta.

### R3. Memoria Conversacional Multi-Turno y Edición en Cadena (20 turnos)
- **Módulos**: `src/components/ai-chat/hooks/useAiChatStream.js`, `server/services/ai/aiPromptService.js`, `server/services/ai/aiStreamService.js`.
- Ampliar la ventana de historial enviada en `useAiChatStream.js` a **20 turnos** (`messages.slice(-20)`), estructurando roles `user` y `model`.
- Enviar consistentemente en el cuerpo de la petición `pendingDraft: pendingDraft || null`.
- Garantizar la edición en cadena conversacional del borrador en mostrador:
  * *"Cámbiala a grande"* -> Gemini actualiza el ítem a tamaño `GRANDE` (Q125.00) y recalcula el total, preservando el título.
  * *"Hazle Q10 de descuento"* -> Aplica descuento de Q10, calculando el total neto exacto.
  * *"Va a pagar con tarjeta"* -> Actualiza el método de pago a `TARJETA`.
  * *"Agrega una portada de álbum de Taylor Swift"* -> Añade el segundo ítem al borrador manteniendo el ítem previo.
- La tarjeta `ChatDraftCard.jsx` refleja los cambios en pantalla inmediatamente al recibir el nuevo evento `draft_sale`.

### R4. Erradicación del Bucle N+1 en Reportes de Turno
- **Módulos**: `server/services/ai/aiToolsService.js`, `server/services/ai/aiShiftReportService.js` (nuevo).
- Refactorizar `executeGetSellerShiftReport`: Erradicar el bucle `salesGroup.map(async (g) => prisma.salePayment.groupBy(...))`.
- Realizar la agregación contable de pagos agrupados en una sola consulta indexada en PostgreSQL por `eventId` y `sellerId`.
- Reducir `aiToolsService.js` para mantenerlo holgadamente por debajo de 200 líneas (< 140 líneas).

### R5. Depuración Quirúrgica de UI y Tarjetas
- **Módulos**: `src/components/ai-chat/ChatToolCards.jsx`, `server/services/ai/aiStreamService.js`.
- En `ChatToolCards.jsx`: Blindar el renderizado de `inventoryStock` (`inv`). Si `inv.found === false` o no existe obra (`!inv.artwork`), NO renderizar ningún contenedor vacío ni marcos negros huérfanos.
- En `aiStreamService.js`: Al ejecutar `checkInventoryStock`, no emitir un evento redundante `suggested_posters` si `inventoryStock` ya encapsula los resultados, evitando tarjetas duplicadas en la UI.
- Mantener `ChatToolCards.jsx` en `< 140 líneas`.

---

## Verification Plan

### Automated Tests
1. `npm run harness:check`: Ejecuta `test:security`, `audit:secrets`, `audit:monoliths` y `build` con 0 errores y 0 advertencias.
2. Pruebas de unidad e integración de Closed-Loop: Verificar que al ejecutar una tool, Gemini recibe el `functionResponse` y genera tokens cálidos de respuesta.
3. Pruebas de agregación sin N+1: Verificar que `executeGetSellerShiftReport` emite métricas idénticas o superiores ejecutando una sola consulta agrupada.

### Manual Verification (Handoff a Gary / Chrome DevTools MCP)
1. Despliegue en producción vía `npm run deploy` y verificación del commit en Dokploy.
2. Navegación en vivo en `https://ventas.decovintage.online/` con sesión activa.
3. Prueba interactiva de edición en cadena de borrador:
   - Dictar *"1 mediano de Spider-Man"* -> Verificar tarjeta borrador + explicación cálida en streaming dual.
   - Enviar *"cámbiala a grande"* -> Verificar actualización inmediata de tarjeta a Q125.00 sin perder título ni reiniciar.
   - Enviar *"va a pagar con tarjeta"* -> Verificar cambio de método de pago a TARJETA.
4. Evidencia fotográfica de alta resolución capturada con Chrome DevTools MCP.

---

## Acceptance Criteria

### Closed-Loop & Streaming Dual
- [ ] Tras invocar `prepareSaleDraft` o `searchCatalog`, Gemini continúa el stream emitiendo texto conversacional cálido con detalles y recomendaciones (cero respuestas vacías, cero monosílabos).
- [ ] No existe la variable ni lógica de supresión `hasTextTokens`. Tokens de texto y eventos de tarjetas se transmiten de forma limpia y simultánea.
- [ ] La interfaz acumula y muestra el texto progresivo en tiempo real sin colisión con las tarjetas.

### Memoria y Edición en Cadena
- [ ] El payload de chat incluye los últimos 20 turnos de mensajes con estructura `user` y `model`.
- [ ] Las modificaciones conversacionales al borrador activo ("cámbiala a grande", "hazle Q10 de descuento", "va a pagar con tarjeta") actualizan la tarjeta activa en tiempo real preservando el contexto previo.

### Rendimiento & Base de Datos
- [ ] `executeGetSellerShiftReport` no ejecuta llamadas iterativas por vendedor en PostgreSQL (cero N+1).
- [ ] Todas las consultas de agregación de turno y caja se completan en tiempos mínimos de respuesta.

### UI & Calidad Visual
- [ ] Búsquedas con `found: false` no muestran bordes huérfanos ni tarjetas vacías en mostrador.
- [ ] `checkInventoryStock` no duplica tarjetas de pósters en la pantalla.

### Límites de Líneas y Arnés
- [ ] `server/services/ai/aiStreamService.js` < 150 líneas.
- [ ] `server/services/ai/aiToolsService.js` < 200 líneas (objetivo < 140 líneas).
- [ ] `src/components/ai-chat/hooks/useAiChatStream.js` < 160 líneas.
- [ ] `src/components/ai-chat/ChatToolCards.jsx` < 140 líneas.
- [ ] `npm run harness:check` 100% verde (0 fallos, 0 violaciones).
- [ ] Captura de pantalla de alta resolución en producción en vivo certificando la edición en cadena.