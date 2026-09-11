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
