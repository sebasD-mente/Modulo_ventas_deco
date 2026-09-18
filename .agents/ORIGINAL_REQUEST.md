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

## 2026-09-13T14:04:36Z

Llevar a STAND {IA} a su máxima expresión de robustez enterprise para eventos masivos de alto tráfico (Comic Con), erradicando modelos obsoletos de Generación 1.5 y 2.5 mediante modernización a Gemini 3.8 Flash, implementando un pool rotativo multi-key resiliente ante cuotas HTTP 429, captura de voz optimizada con Opus a 24kbps y decibelímetro visual, tolerancia a intermitencia con catálogo offline en localStorage y motor de upselling de combos.

Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Modernización Radical a Generación 3 Pura (Erradicar 1.5 y 2.5)
- Actualizar `server/config/env.js` para que `GEMINI_MODEL` tenga por defecto `'gemini-3.8-flash'`.
- En `server/services/geminiPoolService.js`, redefinir `MODEL_PRIORITY_POOL` a:
  ```javascript
  export const MODEL_PRIORITY_POOL = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
  ];
  ```
- Erradicar cualquier string o fallback residual de `1.5-flash` o `2.5-flash` en todo el código fuente (`server/services/llmObservabilityService.js`, `server/services/ai/aiClosedLoopService.js`, `server/services/ai/aiStreamService.js`, `server/controllers/aiController.js`, `server/index.js`, `.env.example`, `docker-compose.yml`, `README.md`).
- En `src/components/ai-chat/ChatHeader.jsx`, actualizar la insignia visual a `STAND {IA} • Gemini 3.8 Flash`.

### R2. Pool Rotativo Multi-Key (`server/services/ai/aiKeyPoolService.js`)
- Añadir en `server/config/env.js`: `GEMINI_API_KEYS: z.string().optional()`.
- Crear el satélite modular `server/services/ai/aiKeyPoolService.js` (< 120 líneas) que gestione:
  - Detección de claves disponibles (usa `GEMINI_API_KEYS` o cae en `GEMINI_API_KEY`).
  - Rotación inteligente (Round-Robin).
  - Cooldown temporal por clave ante errores HTTP 429 (`RESOURCE_EXHAUSTED`), marcando la clave en cooldown por 60 segundos y conmutando inmediatamente a la siguiente clave sana sin alertar al usuario.
  - Provisión y cacheo de instancias cliente de `@google/genai` listas para usar.
- Integrar con `streamWithModelFallback` y `executeWithModelFallback` en `geminiPoolService.js` para reintentar con la siguiente clave activa antes de conmutar de modelo.

### R3. Resiliencia de Audio y Modo Feria Ruidosa
- En `src/components/ai-chat/hooks/useAiVoiceRecorder.js` y el satélite `src/components/ai-chat/hooks/useAiChatAudio.js` (< 60 líneas):
  - Optimizar la compresión a Opus a 24kbps (`audioBitsPerSecond: 24000`) para que una nota de voz de 3 segundos pese menos de 15 KB.
  - Añadir feedback visual de volumen/decibelios en tiempo real (`audioLevel` 0-100) en el botón de micrófono/barra de chat para que el cajero sepa en tiempo real si el micrófono está captando su voz en entornos ruidosos.
- Asegurar que el backend multimodal procese audio con `gemini-3.8-flash` con respuesta ultrarrápida.

### R4. Snapshot Local del Catálogo & Tolerancia a Intermitencia
- Crear `src/services/catalogCacheService.js` (< 90 líneas):
  - Cachear en `localStorage` las obras principales y la lista de precios canónicos de Deco Vintage (`MINI: 25`, `PEQUENO: 35`, `PORTADA_ALBUM: 55`, `MEDIANO: 65`, `GRANDE: 125`, `GIGANTE: 180`).
  - Si la búsqueda online de pósters (`searchWebPosters`) tarda más de 2 segundos o falla por red, resolver instantáneamente desde la caché local sin romper el flujo de la UI.
- Conectar en `useAiChatStream.js` y `useCatalogSearch.js`.

### R5. Motor de Combo y Upselling Proactivo en Gemini 3.8
- En `server/services/ai/aiPromptService.js`, instruir al System Instruction de `gemini-3.8-flash`:
  - Reconocer promociones de eventos: *"Combo 2 medianos por Q120 (ahorro de Q10)"* y *"Combo 3 medianos por Q180 (ahorro de Q15)"*.
  - Al preparar un borrador de 1 mediano, incluir una breve sugerencia amistosa de combo en el follow-up comercial.
- En `src/components/ai-chat/ChatToolCards.jsx`, mostrar un distintivo sutil de promoción cuando la orden califique para un combo.

### R6. Techos Estrictos de Líneas (Cero Monolitos)
- `server/services/ai/aiKeyPoolService.js`: **< 120 líneas**
- `server/services/geminiPoolService.js`: **$\le$ 334 líneas** (prohibido añadir líneas al monolito existente)
- `server/services/ai/aiClosedLoopService.js`: **< 120 líneas**
- `server/services/ai/aiStreamService.js`: **< 150 líneas**
- `server/services/ai/aiToolsService.js`: **< 140 líneas**
- `src/components/ai-chat/hooks/useAiChatStream.js`: **< 160 líneas**
- `src/components/ai-chat/ChatToolCards.jsx`: **< 140 líneas**
- `src/services/catalogCacheService.js`: **< 90 líneas**

### R7. Aislamiento Estricto y Arneses de Calidad
- Aislamiento sagrado: Toda persistencia reside exclusivamente en `deko_eventsales_db`. Prohibido tocar otras bases de datos o servicios ajenos.
- Protocolo Zero-Trust de credenciales y cero secretos expuestos.
- `npm run harness:check` debe correr y pasar al 100% (seguridad Zero-Trust 9/9, cero secretos, build Vite limpio en dist/).

### R8. Handoff Operativo
- Generar `handoff.md` con las instrucciones de despliegue en Dokploy y validación para Gary.

## Acceptance Criteria

### Calidad y Seguridad
- [ ] `npm run harness:check` termina con código de salida 0.
- [ ] La suite de seguridad `npm run test:security` pasa al 100% (9/9 pruebas).
- [ ] La auditoría de monolitos `npm run audit:monoliths` y secretos `npm run audit:secrets` terminan con código de salida 0.
- [ ] Cada archivo modificado respeta escrupulosamente su techo presupuestario de líneas.

### Pool Multi-Key y Modelos Gen 3
- [ ] `GEMINI_MODEL` está configurado por defecto a `gemini-3.8-flash`.
- [ ] Cero referencias residuales o fallbacks a `gemini-1.5-flash` o `gemini-2.5-flash` en el código fuente.
- [ ] Pruebas unitarias para `aiKeyPoolService.js` verifican rotación Round-Robin y conmutación automática de clave ante HTTP 429 con cooldown de 60 segundos.
- [ ] Las pruebas unitarias y adversariales de `tests/ai/gemini-pool.test.js` y `tests/adversarial/m4-pool-resilience-adversarial.test.js` pasan al 100% con los modelos Gen 3.

### Audio, Catálogo y Frontend
- [ ] `useAiVoiceRecorder.js` comprime audio a Opus 24kbps y expone decibelímetro en vivo.
- [ ] `ChatHeader.jsx` muestra `STAND {IA} • Gemini 3.8 Flash`.
- [ ] `catalogCacheService.js` resuelve búsquedas en < 2s usando fallback local cuando la red falla o demora.
- [ ] `ChatToolCards.jsx` muestra distintivo de combo cuando hay 2 o más pósters medianos en la orden.
- [ ] `handoff.md` creado con directivas operativas completas para Dokploy.

## 2026-09-13T16:28:10Z

Execute an exhaustive 360° forensic audit and enterprise innovation blueprint for the STAND {IA} (Modulo_Ventas) event sales system, diagnosing architectural health across all tiers without adding code bloat, and formulating 10 high-value features for high-stress convention environments.

Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Backend, Multimodal AI & Business Logic Forensic Audit (`server/`)
- Audit all HTTP/SSE controllers (`aiController.js`, `saleController.js`, `productionController.js`, `eventController.js`, `catalogController.js`, `authController.js`, `cashClosingController.js`, `userController.js`), checking SSE lifecycles (`req.on('close')`), circuit breakers, and memory leaks.
- Inspect the Multimodal AI engine and key pool (`geminiPoolService.js`, `aiKeyPoolService.js`, `aiClosedLoopService.js`, `aiStreamService.js`, `aiPromptService.js`, `aiToolsService.js`, `aiMultimodalService.js`). Confirm zero legacy fallback references (e.g. `gemini-1.5` or `gemini-2.5`) and verify HTTP 429 cooldown handling and Human-in-the-Loop draft hydration.
- Audit domain services (`saleService.js`, `semanticParserService.js`, `webCatalogService.js`, `catalogSyncService.js`, `llmObservabilityService.js`) and formulate a single-responsibility modular decomposition plan (<150 lines per satellite) for the 10 flagged monolithic files.

### R2. Frontend, State Management & Resilient UI Forensic Audit (`src/`)
- Audit component hierarchy and decoupling across conversational UI (`UnifiedAiChat.jsx`, `ChatInputBar.jsx`, `ChatToolCards.jsx`, `ChatDraftCard.jsx`, `ChatSwapModal.jsx`, `ChatMessageList.jsx`) and operational views (`ManualSaleView.jsx`, `EventsManagementView.jsx`, `MonitorDashboardView.jsx`, `ProductionManagementView.jsx`, `CashClosingView.jsx`, `UserManagementView.jsx`).
- Audit custom hooks (`useAiChatStream.js`, `useAiVoiceRecorder.js`, `useAiChatAudio.js`, `useCatalogSearch.js`, `useProductionQueue.js`, `useCashClosing.js`) for stale closures, uncleaned timers, unnecessary re-renders, and Web Worker/MediaStream memory leaks.
- Audit local caching and offline resilience (`catalogCacheService.js`, `localStorage` limits, price desynchronization risks, quota handling) and auth session reconciliation (`AuthContext.jsx`, JWT expiration, `deko_auth_token` vs `token`).

### R3. Relational Database, Prisma & PostgreSQL Concurrency Audit (`prisma/`)
- Audit `prisma/schema.prisma` across all models (`Tenant`, `User`, `Event`, `Product`, `Sale`, `SaleItem`, `SalePayment`, `CashClosing`, `AuditLog`, `ProductionLog`, etc.), evaluating referential actions (`onDelete`), composite indexes (`@@index`, `@@unique`), and query optimization under high convention volume.
- Inspect concurrency hazards and N+1 query patterns in `saleService.js`, `productionController.js`, and `cashClosingController.js`. Verify isolation and transactional safety (`prisma.$transaction`) during sequential ticket generation (`current_sale_sequence`) under multi-cashier load.

### R4. Storage, Assets, Infrastructure & Deployment Audit
- Audit file upload pipelines (`server/middleware/uploadMiddleware.js`) for MIME enforcement, strict size limits (audio <= 15MB, images/receipts <= 10MB), and immediate temp file cleanup on success/error.
- Audit catalog asset resolution (`imageUrl`), GCS availability fallbacks, and local offline asset handling.
- Audit containerization and deployment artifacts (`Dockerfile`, `docker-compose.yml`, `entrypoint.sh`, `scripts/deploy-dokploy.js`), enforcing `NODE_ENV=production`, dependency hygiene, memory limits, and crash recovery.

### R5. Dead Code, Orphan Artifacts & High-Stress Comic Con SPOF Modeling
- Scan for unused imports, unreachable functions, legacy roles (`ADMIN_EMPRESA`, `ENCARGADO_STAND`), legacy AI Studio references, or unprotected endpoints.
- Model and stress-diagnose 5 convention catastrophe scenarios:
  1. Convention center 4G/5G blackout.
  2. Gemini pool saturation / simultaneous exhaustion across all configured keys.
  3. Concurrent multi-cashier checkout collision on the same ticket.
  4. Cash register closing with items pending in the workshop queue.
  5. Audio input degradation under extreme ambient acoustic noise.

### R6. Enterprise Innovation Plan: 10 Disruptive Features for STAND {IA}
- Detail 10 high-impact commercial and operational innovations tailored for high-volume pop-culture convention booths.
- For each innovation, document: Feature Name, Business Pain Resolved, Technical Architecture (backend, frontend, Gemini multimodal prompt/tool), and Estimated Impact on checkout velocity, average ticket value, or customer satisfaction.

### R7. Master Deliverable & Zero-Regression Guardrail
- Consolidate all findings, matrices, and proposals into `AUDITORIA_360_STAND_IA.md` in the repository root.
- Ensure all findings include precise file paths and line number references (`path/to/file.ext:Lxx-Lyy`).
- Maintain existing Zero-Trust security test suites and monolithic limits completely green (`npm run harness:check`). No code bloat added to audited files.

## Acceptance Criteria

### Master Audit Report Deliverable
- [ ] `AUDITORIA_360_STAND_IA.md` is generated in the root of `Modulo_Ventas` containing all 8 mandated sections: Executive Summary, 360° Architectural Diagnostic with exact line citations, Dead Code & Technical Debt Catalog, Risk Matrix (P0/P1/P2), Monolithic File Decomposition Plan, 10 Disruptive Enterprise Innovations, and Surgical Refactoring Roadmap.
- [ ] Every technical finding cites the exact file path and line range (`path/to/file.ext:Lxx-Lyy`).
- [ ] All 10 monolithic files identified by `audit-monoliths.js` have a dedicated decomposition blueprint with modular satellite definitions under 150 lines each.
- [ ] All 5 Comic Con catastrophe scenarios are analyzed with root-cause mechanics, impact severity, and concrete resilience mitigations.
- [ ] 10 distinct, fully architected enterprise features are articulated with pain point, architecture (backend, frontend, Gemini prompt/tools), and business impact.

### Repository Integrity & Harness
- [ ] `npm run harness:check` runs and exits with code 0 (zero test failures, zero leaked secrets, zero added monolithic bloat, build succeeds).
- [ ] Zero unauthorized connections, shared databases, or cross-project credential leaks. Strict isolation of `deko_eventsales_db` preserved.

## 2026-09-13T17:32:10Z

Cirugía arquitectónica y blindaje operativo de alta resiliencia para el módulo de punto de venta Stand {IA} de Deco Vintage Guate, despiezando quirúrgicamente los 3 monolitos peligrosos y blindando las contingencias críticas de feria (P0) sin dispersión de archivos ni sobreingeniería.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

**Para:** Fred & Teamwork Core  
**De:** Sebastián Jiménez (Dirección) & Gary (CTO)  
**Objetivo:** Resolver quirúrgicamente las vulnerabilidades críticas detectadas en `AUDITORIA_360_STAND_IA.md`, aplicando el principio de **Cero Sobreingeniería**: despiezar ÚNICAMENTE los 3 monolitos peligrosos y blindar el sistema para la convención.

---

## 🚫 REGLA SAGRADA: PROHIBIDA LA DISPERSIÓN DE ARCHIVOS (ANTI-FILE SPRAWL)
* **Veto a la fragmentación excesiva:** QUEDA TERMINANTEMENTE PROHIBIDO despiezar o tocar los 7 archivos de tamaño medio (~250-300 líneas: `userController.js`, `authController.js`, `catalogController.js`, `geminiPoolService.js`, `catalogSyncService.js`, etc.). Están probados, funcionan y no deben pulverizarse en mini-archivos.
* **Despiece quirúrgico exclusivo en los 3 Monolitos Peligrosos:**
  1. `server/services/saleService.js`
  2. `server/services/semanticParserService.js`
  3. `server/controllers/productionController.js`

---

## Requirements

### R1. Despiece Quirúrgico de los 3 Monolitos Peligrosos
1. **`server/services/saleService.js` ➔ Desacoplar Cobro Contable de Reportería:**
   * Extraer `server/services/sales/saleTransactionService.js`: Lógica pura de creación y confirmación de ventas con transacciones ACID.
   * Extraer `server/services/sales/saleNumberGenerator.js`: Generación atómica del número de ticket (`CC26-XXXX`) sin adquirir candados exclusivos de fila `FOR UPDATE` que bloqueen a otros cajeros concurrentes.
   * Extraer `server/services/sales/saleKpiService.js`: Métricas, ventas por evento y dashboards de gerencia.
   * Extraer `server/services/sales/cashClosingService.js`: Arqueos y cierres de caja atómicos.
   * Dejar `server/services/saleService.js` como una **fachada canónica limpia (< 35 líneas)** que re-exporte todas las funciones para no romper ningún import existente ni contratos de consumo.
2. **`server/services/semanticParserService.js` ➔ Separar Datos Estáticos de Lógica:**
   * Extraer `server/services/semantic/entityAliases.js`: El array de más de 400 líneas `STAND_ENTITY_ALIASES`.
   * Extraer `server/services/semantic/paymentExtractor.js`: Regex y lógica de detección de métodos de pago.
   * Dejar `server/services/semanticParserService.js` como fachada canónica (< 30 líneas) re-exportando el pipeline semántico.
3. **`server/controllers/productionController.js` ➔ Erradicación de Mocks:**
   * Eliminar completamente el array residual `demoProductionItems` (94 líneas de datos falsos).
   * Mover la lógica de taller a `server/services/productionService.js` con consultas reales a PostgreSQL vía Prisma, manteniendo en el controlador los métodos de respuesta HTTP (incluyendo captura `catch (dbErr)` con `res.status(500)` para cumplir con las pruebas adversariales existentes).

### R2. Blindaje de Vulnerabilidades Críticas de Feria (P0)
1. **Resiliencia de Caché Offline (`P0-1`):**
   * En `src/services/catalogCacheService.js`, eliminar la sobreescritura destructiva de `localStorage.setItem`. Implementar fusión acumulativa (`Map` indexado por `id`, con tope de 300 obras) para que buscar una obra no borre las anteriores.
2. **Bloqueo Offline de Terminal (`P0-2`):**
   * En `src/context/AuthContext.jsx` y `src/App.jsx`, persistir el objeto `user` en `localStorage` (`deko_auth_user`). Si la terminal se recarga sin internet celular, permitir que el vendedor continúe cobrando en la venta manual sin ser expulsado a Google Login.
3. **VAD de Micrófono ante Ruido de Convención (`P0-3`):**
   * En `src/components/ai-chat/hooks/useAiVoiceRecorder.js`, implementar un hard timeout de seguridad (7 segundos) y calibración del piso de ruido en los primeros 400ms para que el micrófono no se quede trabado con los 95 dB de ruido del salón.
4. **Protección contra Error HTTP 429 en Medios (`P0-4`):**
   * En `server/services/ai/aiMediaService.js`, envolver las llamadas de audio, fotos y video dentro de `executeWithModelFallback` para que aprovechen la rotación automática del pool de claves Gemini en lugar de fallar con error 500.
5. **Aislamiento de Rutas y Multitenant (`P0-6` y `P0-7`):**
   * En `server/routes/apiRoutes.js`, añadir `requireEventAccess` a `PATCH /sales/:id`.
   * En `server/controllers/userController.js`, forzar el filtro por `tenantId: req.tenantId` en todas las mutaciones sin fragmentar el archivo.
6. **Protección de Diagnóstico (`P0-8`):**
   * Proteger el endpoint `/health/ai` con autenticación o convertirlo en una verificación estática de variables para evitar que bots externos quemen tokens de Gemini en producción.

### R3. Higiene de Dependencias, Docker y Migraciones
1. **Desinstalar dependencias no utilizadas:**
   * Ejecutar `npm uninstall bcryptjs qrcode`.
2. **Sanear Docker (`Dockerfile` y `entrypoint.sh`):**
   * Eliminar la copia de `.git` en el `Dockerfile` final (L77).
   * Generar las migraciones formales en `prisma/migrations` para posibilitar `npx prisma migrate deploy` en lugar de requerir `prisma db push` en producción.
3. **Aislamiento Sagrado y Zero-Trust:**
   * Cero IPs o URLs foráneas ajenas, cero credenciales hardcodeadas, cero violación de multitenancy.

---

## Acceptance Criteria

### Integridad Modular y Anti-Sprawl
- [ ] `server/services/saleService.js` actúa como fachada canónica re-exportando la API pública completa en menos de 35 líneas.
- [ ] `server/services/semanticParserService.js` actúa como fachada canónica re-exportando el analizador en menos de 30 líneas.
- [ ] `demoProductionItems` ha sido erradicado por completo de `server/controllers/productionController.js`, y la lógica de base de datos reside en `server/services/productionService.js`.
- [ ] Ninguno de los 7 archivos medianos preexistentes fue fragmentado en submódulos innecesarios.

### Blindaje Operativo Offline y P0
- [ ] En `catalogCacheService.js`, las consultas sucesivas agregan productos acumulativamente en `localStorage` hasta 300 obras sin truncar la memoria previa.
- [ ] En `AuthContext.jsx` / `App.jsx`, una recarga en modo desconectado lee `deko_auth_user` de `localStorage` y mantiene abierta la pantalla de ventas sin redireccionar a Google Login.
- [ ] En `useAiVoiceRecorder.js`, la grabación se corta forzosamente a los 7 segundos y calibra el piso de ruido ambiente en los primeros 400ms.
- [ ] En `aiMediaService.js`, las llamadas de inferencia utilizan `executeWithModelFallback` para tolerar errores de cuota HTTP 429.
- [ ] `PATCH /sales/:id` en `apiRoutes.js` cuenta con `requireEventAccess`, y las mutaciones en `userController.js` filtran por `tenantId`.
- [ ] `/health/ai` no realiza llamadas activas que consuman cuotas de API sin autenticación.

### Limpieza de Código y Contenedor
- [ ] `package.json` no contiene `bcryptjs` ni `qrcode`.
- [ ] `Dockerfile` no contiene la instrucción `COPY --chown=node:node .git ./.git`.
- [ ] La carpeta `prisma/migrations` contiene la migración inicial estructurada y compatible con `prisma migrate deploy`.

### Certificación del Arnés de Calidad (4/4 Verificaciones Limpias)
- [ ] `npm run test:security`: Ejecuta y aprueba las 9/9 pruebas de seguridad Zero-Trust.
- [ ] `npm run audit:secrets`: Reporta 0 secretos y 0 violaciones de aislamiento en el 100% de los archivos auditados.
- [ ] `npm test`: Las suites de dominio (`tests/sales`, `tests/semantic`, `tests/production`) ejecutan con 100% de tests aprobados.
- [ ] `npm run build`: El comando de empaquetado de Vite compila exitosamente con 0 errores.

## 2026-09-13T21:15:16Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Ted (Lead Architect & Orquestador), Atlas (Especialista en Embeddings y RAG), Echo (Especialista en Neuro-UX y Prompt Engineering), Sentinel (Especialista en QA Adversarial y DevTools)

STAND {IA} (`Modulo_Ventas`) es el sistema POS inteligente y copiloto de ventas de alta velocidad para Deco Vintage Guate en convenciones masivas (Comic Con Guatemala 2026). La misión es implementar el motor RAG vectorial híbrido con `@google/genai`, erradicar los textos enlatados ("tintas látex", "cintas tesa", "volumen alto"), calibrar la personalidad del asistente como copiloto táctico del vendedor del stand y certificar con pruebas adversariales en vivo vía Chrome DevTools MCP.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Motor RAG Vectorial Híbrido en Memoria RAM (`server/services/embeddingService.js`)
- Crear un servicio modular y limpio (< 150 líneas) utilizando el SDK moderno `@google/genai` con el modelo `text-embedding-004` (o `gemini-embedding-001`).
- Implementar caché de vectores en memoria RAM para los pósters del catálogo activo con TTL de refresco y cálculo matemático de similitud coseno con latencia sub-15ms.
- Establecer un umbral estricto de afinidad matemática (`MIN_SIMILARITY_THRESHOLD = 0.45`):
  * Al buscar obras específicas (ej. *"Dragon Ball"*), devolver exclusivamente las obras que superen el 45% de afinidad matemática.
  * Prohibido rellenar con obras no relacionadas (cero Batman, cero BTS cuando se busca Dragon Ball).
- Implementar paracaídas híbrido resiliente: si la API de embeddings parpadea por problemas de red en la feria, conmutar transparentemente a la búsqueda léxica local preservando el filtro estricto.
- Integrar el servicio en `webCatalogService.js` y en la tool `searchCatalog` de `server/services/ai/aiToolsService.js` / `server/services/ai/aiClosedLoopService.js`.

### R2. Erradicación de Textos Enlatados y Reparación del Bucle Cerrado
- Purgar completamente de `server/services/ai/aiStreamService.js`, `server/services/ai/aiClosedLoopService.js` y `server/services/geminiPoolService.js` todas las frases prefabricadas y plantillas comerciales ("Nuestro tamaño estrella es el Mediano (30x45 cm a Q65.00) con tintas ecológicas HP Látex y cinta tesa®...", "En este momento la red de IA está recibiendo un volumen alto de consultas...").
- Reparar `streamClosedLoopFollowUp`: jamás concatenar mensajes de error técnico o advertencias de fallback con discursos de ventas comerciales en la misma burbuja de respuesta.
- Garantizar generación 100% orgánica en tiempo real por el modelo Gemini en función de la consulta exacta del vendedor.

### R3. Calibración de Personalidad de Mostrador (`server/services/ai/aiPromptService.js`)
- Calibrar la directiva del sistema (`buildSalesSystemPrompt`):
  * El usuario es el VENDEDOR DEL STAND (colega interno, no cliente final). No necesita explicaciones básicas de materiales ni discursos largos.
  * Rol: Copiloto táctico de mostrador, rápido, enérgico, inteligente y comercial.
  * Estilo: Enfocado en cerrar ventas, agilizar el dictado y sugerir combos oficiales de feria (2 Medianos por Q120, 3 por Q180).
  * Respuestas ágiles: Confirmación inmediata de borradores, presentación directa de opciones encontradas en stock.

### R4. Aislamiento Estricto y Preservación Arquitectónica
- Cumplimiento estricto del protocolo Zero-Trust: no modificar proyectos externos, no conectar a bases de datos ajenas, no incluir referencias a la IP prohibida `145.223.120.56`.
- Mantener los límites de tamaño modular: `embeddingService.js` debe mantenerse por debajo de 150 líneas.
- Respetar los contratos existentes del frontend y la estructura de datos consumida por los componentes de React (`FastManualSaleForm`, etc.).

## Verification Resources & Protocol

### Verificación Automatizada (Tests y Arnés)
- Ejecutar `npm run harness:check` que comprende:
  * `npm run test:security`: 9/9 pruebas pasando de aislamiento estricto y Zero-Trust.
  * `npm run audit:secrets`: Cero fugas de claves o IPs ajenas.
  * `npm run audit:monoliths`: Respeto de límites modulares.
  * `npm run build`: Build de Vite en verde.
- Suite de pruebas unitarias para `embeddingService.js` verificando similitud coseno, umbral de corte del 45%, caché en memoria y degradación elegante a búsqueda léxica.

### Verificación en Vivo con Navegador Real (Chrome DevTools MCP)
- **Prueba 1 (Consulta con Typo & Cero Enlatados):**
  * Consulta: `"mustrame que tenemos disponible de dragon ball"`
  * Criterio: Respuesta 100% natural, cero menciones a tintas ecológicas HP Látex o cintas tesa, y exclusivamente tarjetas de Dragon Ball (cero Batman, cero BTS).
- **Prueba 2 (Lenguaje Coloquial y Cultural):**
  * Consultas: `"el saiyajin de pelo amarillo"`, `"el bicho"`, `"obras de F1"`.
  * Criterio: El motor RAG vectorial identifica con precisión a Goku, Cristiano Ronaldo y Checo Pérez / Ferrari / Red Bull.
- **Prueba 3 (Venta Rápida por Dictado):**
  * Consulta: `"2 medianos de Goku en efectivo"`
  * Criterio: Borrador de venta montado al instante con combo de feria aplicado (Q120.00) o precio regular correcto.
- **Evidencia Visual:** Captura de pantalla de alta resolución demostrando la respuesta en vivo.

## Acceptance Criteria

### Hito M1: Motor RAG Vectorial
- [ ] Archivo `server/services/embeddingService.js` implementado con < 150 líneas de código limpio.
- [ ] Similitud coseno matemática calcula distancias contra vectores cacheados en memoria RAM en < 15ms.
- [ ] `MIN_SIMILARITY_THRESHOLD = 0.45` filtra tajantemente obras no afines sin devolver falsos positivos irrelevantes.
- [ ] Paracaídas híbrido conmuta a búsqueda léxica si no hay embeddings disponibles o si falla la red.
- [ ] Integrado correctamente en `webCatalogService.js` y en la tool `searchCatalog`.

### Hito M2: Purga de Textos Enlatados
- [ ] Frases de "tintas ecológicas HP Látex" y "cinta tesa®" completamente eliminadas de los fallbacks de `aiStreamService.js` y `aiClosedLoopService.js`.
- [ ] Frase de "volumen alto de consultas" purgada de `geminiPoolService.js` y `aiClosedLoopService.js`.
- [ ] Respuestas generadas orgánicamente por Gemini sin mezclar errores de retry con discursos comerciales.

### Hito M3: Personalidad de Copiloto de Mostrador
- [ ] `aiPromptService.js` ajustado para tratar al vendedor como compañero de equipo táctico en mostrador.
- [ ] Promoción de combos de feria (2 Medianos por Q120, 3 por Q180) y cierre ágil de ventas.
- [ ] Tono enérgico, breve y resolutivo adaptado al ruido y velocidad de una convención.

### Hito M4: Certificación y Arnés
- [ ] `npm run harness:check` ejecuta y pasa al 100% (test:security 9/9, audit:secrets, audit:monoliths, build).
- [ ] Pruebas en vivo ejecutadas y validadas con Chrome DevTools MCP.
- [ ] Capturas de pantalla de evidencia visual de alta resolución tomadas y documentadas.

## 2026-09-13T23:23:00Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Ted (Lead Architect & Orquestador), Atlas (Especialista en Embeddings y RAG), Echo (Especialista en Neuro-UX y Prompt Engineering), Sentinel (Especialista en QA Adversarial y DevTools)

Misión de Calibración Cognitiva de Alto Nivel, RAG Vectorial 100% Funcional y Repetición Exhaustiva de Pruebas en STAND {IA} (`Modulo_Ventas`). Premisa inquebrantable de la Dirección: STAND debe ser un agente de IA profesional, sumamente inteligente y formal, como tener a un asistente "nerd" experto en cultura pop y en todo el catálogo oficial de Deco Vintage (descripciones de pósters, tags, dimensiones, variantes y combos), aprovechando la tecnología RAG vectorial al 100% con respuestas naturales, fluidas y sin errores técnicos ni tarjetas espurias.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Reparación de Causa Raíz en Motor RAG y Bucle Cerrado Cognitivo
- **Corrección de Modelo de Embeddings (`server/services/embeddingService.js`):**
  * Migrar el modelo predeterminado de `text-embedding-004` (inexistente en v1beta / 404) a `gemini-embedding-001` (soporte nativo verificado de 3072 dimensiones).
  * Garantizar que la búsqueda vectorial se ejecute de verdad contra la API de Google sin conmutar forzadamente al paracaídas léxico.
  * Mantener el cálculo de similitud coseno con umbral estricto `MIN_SIMILARITY_THRESHOLD = 0.45` para filtrar implacablemente obras fuera de contexto.
- **Reparación del Bucle Cerrado de Gemini 3.8 Flash (`aiClosedLoopService.js` / `aiStreamService.js`):**
  * Preservar los `candidates[0].content.parts` originales del stream (incluyendo `thoughtSignature`) para que la llamada de retorno de herramientas a Gemini 3.8 Flash no sea rechazada con HTTP 400.
  * Formatear correctamente la respuesta de funciones con el rol `user` y la estructura `functionResponse` requerida por `@google/genai`.
  * Erradicar de raíz la emisión del banner de fallo `"⚠️ Conexión con IA intermitente..."` cuando el modelo está operando normalmente.

### R2. Purga de Tarjetas Falsas y Precisión Semántica Estricta
- Auditar y calibrar el catálogo y las herramientas para que en consultas temáticas (Fórmula 1, Dragon Ball, Cristiano Ronaldo) el asistente presente **ÚNICAMENTE** obras pertenecientes a dichas entidades.
- Prohibir terminantemente que se filtren obras irrelevantes (ej. baloncesto/Kobe Bryant en búsquedas de automovilismo o fútbol).
- Si una obra no alcanza una afinidad semántica/vectorial mínima del 45%, debe ser descartada sin piedad.

### R3. Calibración Cognitiva y Personalidad (Asistente Nerd, Formal y Experto)
- El asistente debe operar como un consultor "nerd" de altísimo nivel: sumamente inteligente, formal, elocuente y con dominio enciclopédico de todo el catálogo oficial de Deco Vintage Web (títulos, descripciones de obras, artistas, franquicias, tags y medidas).
- El asistente debe generar **SIEMPRE** una respuesta conversacional natural, inteligente y fluida en tiempo real por Gemini 3.8 Flash.
- La respuesta no puede limitarse a colgar tarjetas: debe aportar valor contextual de forma ágil, recomendar tamaños o combos de feria (2xQ120, 3xQ180) y facilitar el cierre inmediato del pedido.
- Tono: Formal, respetuoso, dinámico y empático (trato de "tú", 1-3 líneas que demuestren inteligencia y conocimiento enciclopédico).

### R4. Repetición Exhaustiva de Pruebas en Vivo con Chrome DevTools MCP
- Repetir la totalidad de las pruebas en vivo en el navegador real analizando no solo si se monta una venta, sino **CADA PALABRA DE LA RESPUESTA Y CADA TARJETA PRESENTADA**:
  * **Prueba 1 (Typo Dragon Ball):** Mensaje `"mustrame que tenemos disponible de dragon ball"`.
    - *Análisis textual:* Verificar que la respuesta de Gemini sea 100% natural y fluida, cero menciones a látex/tesa, y CERO advertencias de fallo técnico ("conexión intermitente").
    - *Análisis de tarjetas:* Verificar que **TODAS** las tarjetas pertenezcan a Dragon Ball / Goku. Cero tarjetas de anime no relacionado o cómics.
  * **Prueba 2 (Entidades Coloquiales Segmentadas):**
    - Consultar individualmente o de forma clara:
      1. *"el saiyajin de pelo amarillo"* -> Debe mostrar a Goku / Super Saiyajin.
      2. *"el bicho"* -> Debe mostrar a Cristiano Ronaldo (CR7). Cero tarjetas de otros deportes.
      3. *"obras de F1"* -> Debe mostrar Ferrari, Checo Pérez, Red Bull, Leclerc, Hamilton. CERO tarjetas de baloncesto (Kobe Bryant).
    - *Criterio de éxito:* Cero contaminación cruzada entre categorías.
  * **Prueba 3 (Venta Rápida por Dictado & Combo):**
    - Mensaje `"2 medianos de Goku en efectivo"`.
    - *Análisis textual:* Respuesta confirmando el borrador y felicitando al vendedor.
    - *Análisis del borrador:* 2 pósters Medianos (30x45 cm), precio base Q130.00, descuento combo -Q10.00, total neto Q120.00 en efectivo.
- Capturar nuevas capturas de pantalla de alta resolución demostrando que el agente ahora responde con texto natural y fluido (sin banners de error) y con tarjetas 100% precisas.

### R5. Reporte Exhaustivo y Hoja de Ruta Arquitectónica
- Entregar un informe técnico detallando:
  1. Causa raíz exacta de los fallos anteriores y cómo fueron subsanados.
  2. Análisis cualitativo exhaustivo de las respuestas y tarjetas generadas en cada prueba.
  3. Hoja de ruta para garantizar que STAND {IA} sea un sistema de clase mundial, robusto y escalable para la Comic Con Guatemala 2026.

## Acceptance Criteria

### Causa Raíz y RAG Real
- [ ] `server/services/embeddingService.js` configurado con `gemini-embedding-001` (3072 dimensiones) ejecutando búsquedas vectoriales reales contra Gemini API.
- [ ] Bucle cerrado en `aiClosedLoopService.js` y `aiStreamService.js` preserva `thoughtSignature` y genera texto de respuesta conversacional real por Gemini 3.8 Flash.
- [ ] Cero banners de `"⚠️ Conexión con IA intermitente..."` durante la operación normal del asistente.

### Precisión de Catálogo
- [ ] Búsqueda de F1 devuelve exclusivamente obras de automovilismo (Ferrari, Red Bull, Leclerc, Sainz); cero tarjetas de baloncesto (Kobe Bryant).
- [ ] Búsqueda de "el bicho" devuelve exclusivamente a Cristiano Ronaldo.
- [ ] Búsqueda de "saiyajin de pelo amarillo" devuelve exclusivamente a Goku / Dragon Ball.

### Calidad de Respuesta del Asistente
- [ ] El asistente acompaña las tarjetas con una respuesta conversacional natural, enérgica y vendedora de 1 a 3 líneas.
- [ ] Sugerencia activa de combos de feria (2xQ120, 3xQ180).
- [ ] Cero respuestas prefabricadas de cintas tesa o tintas látex.

### Validación en Navegador Real y Reporte
- [ ] Pruebas 1, 2 y 3 repetidas en vivo y validadas visualmente con Chrome DevTools MCP.
- [ ] Capturas de pantalla actualizadas que muestran la conversación orgánica real y las tarjetas filtradas.
- [ ] `npm run harness:check` 100% verde (9/9 Zero-Trust, 0 secretos, build exitoso).
- [ ] Reporte y hoja de ruta arquitectónica entregados a la Dirección.

## 2026-09-15T17:17:38Z

# Teamwork Project Prompt

Auditoría forense 360°, diagnóstico exhaustivo de causa raíz y formulación del roadmap quirúrgico cero deuda técnica sobre el repositorio `Modulo_Ventas` y Stand {IA}, con entrega del Informe Maestro Final de Fred estructurado bajo 5 secciones obligatorias, respaldado 100% por inspección de código real y cero suposiciones.

Requested team: Squad Especialista de Subagentes de Fred (4 Sabuesos: Búsqueda Híbrida/RAG, Orquestador Conversacional Stand {IA}, Arquitectura Monolítica/Estado, Resiliencia Operativa/DB)
Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Auditoría Forense del Motor de Búsqueda Híbrida, RAG y Contaminación Vectorial (Sabueso 1)
- Inspección algorítmica exhaustiva en:
  - `server/services/embeddingService.js`
  - `server/services/webCatalogService.js`
  - `server/services/catalog/liveCatalogSyncService.js`
  - `server/services/semantic/entityAliases.js`
  - `src/components/manual-sale/hooks/useCatalogSearch.js`
  - `src/services/catalogCacheService.js`
  - `server/controllers/catalogController.js`
- Diagnóstico de causa raíz del "Caso Messi y Búsquedas Contaminadas":
  - Identificar por qué consultas compuestas como *"muéstrame lo que tenemos de messi"* conservan palabras funcionales/stop words en `normQueryTokens` y cómo la condición `normQueryTokens.some(...)` genera falsos positivos.
  - Auditar la calibración del umbral de similitud coseno (`minThreshold = 0.55` y `similarity >= 0.60`) y el balance de scoring léxico vs vectorial y deduplicación.
- Auditoría del Buscador Manual:
  - Analizar la interacción entre el snapshot local en `localStorage` (`saveCatalogSnapshot`) y la API en vivo `/api/catalog/web-posters`.
  - Determinar por qué se percibe errático o lento y evaluar el comportamiento ante desconexiones, timeouts y fallbacks.

### R2. Auditoría del Orquestador Conversacional Stand {IA} y Experiencia de Mostrador (Sabueso 2)
- Inspección detallada en:
  - `server/services/ai/aiPromptService.js`
  - `server/services/ai/aiStreamService.js`
  - `server/services/ai/aiClosedLoopService.js`
  - `server/services/ai/aiToolsService.js`
  - `src/components/ai-chat/` (`useAiChatStream.js`, `ChatMessageList.jsx`, `ChatToolCards.jsx`, `ChatDraftCard.jsx`, `ChatInputBar.jsx`)
- Erradicación de verbosidad e interrupciones:
  - Analizar `buildSalesSystemPrompt` identificando directivas que induzcan explicaciones innecesarias o textos redundantes que frenan la velocidad del cajero en mostrador ferial.
  - Auditar el contrato y comportamiento de la herramienta `searchCatalog`: determinar cuándo debe invocarse y cómo presentar resultados sin saturar la pantalla ni hablar de más.
- Auditoría de renderizado y streaming reactivo:
  - Evaluar duplicidades entre el texto generado por streaming SSE y las tarjetas interactivas (`ChatToolCards.jsx`).
  - Revisar el ciclo de vida del borrador interactivo (`prepareSaleDraft`): cómo se sincroniza el estado local de React con los eventos SSE del backend y evitar cierres obsoletos (*stale closures*).
- Experiencia de venta natural:
  - Evaluar si el agente actúa como un copiloto táctico ágil (acciones en 1 clic, confirmación visual rápida) o como un chatbot genérico invasivo.

### R3. Auditoría de Arquitectura de Software, Monolitos y Gestión de Estado (Sabueso 3)
- Ejecución e interpretación real del script `node scripts/audit-monoliths.js` en el repositorio local.
- Mapa cuantitativo de deuda técnica monolítica:
  - Inventariar todos los archivos que superan las 200 líneas y los críticos (>1000 líneas).
  - Identificar acoplamientos excesivos, lógica de negocio incrustada en vistas UI y controladores con responsabilidades múltiples.
- Auditoría de ciclos de vida y memoria:
  - Detectar `useEffect` y suscripciones sin limpieza en frontend.
  - Revisar el ciclo de vida del Event Loop en Node.js (manejo de SSE, conexiones a Prisma/PostgreSQL, llamadas a Gemini SDK).

### R4. Auditoría de Resiliencia Operativa, Concurrencia y Base de Datos (Sabueso 4)
- Inspección en:
  - `server/services/catalogSyncService.js`
  - `server/services/catalog/liveCatalogSyncService.js`
  - `server/services/ai/aiKeyPoolService.js`
  - `server/services/ai/aiMediaService.js`
  - `server/routes/apiRoutes.js`
  - `server/services/saleService.js`
  - `prisma/schema.prisma`
- Sincronización multi-tenant y webhooks:
  - Garantizar que nuevos productos publicados en la web se reflejen de inmediato en el stand sin reiniciar contenedores ni corromper cachés.
- Alta disponibilidad en feria física:
  - Diagnosticar el comportamiento del Módulo de Ventas ante cortes de internet de 30+ segundos.
  - Evaluar la resiliencia del pool de claves Gemini (`aiKeyPoolService.js`) ante errores 429/503 y detectar llamadas multimodales en `aiMediaService.js` que eludan el pool de fallback.
  - Identificar contención transaccional en PostgreSQL (`tx.event.update` en `saleService.js`) que serialice ventas concurrentes de múltiples cajeros.

### R5. Entrega del Informe Maestro de Fred (Formato Obligatorio en 5 Secciones)
- Generar el informe final consolidado estructurado estrictamente en:
  - **SECCIÓN 1:** Radiografía completa del Módulo de Ventas Stand {IA} (Venta IA, Venta Manual, Catálogo en Vivo, Cola de Taller, Arqueos, Monitoreo, Webhooks).
  - **SECCIÓN 2:** Matriz de Diagnóstico de Causa Raíz (`ID | Subsistema | Síntoma Visible | Causa Raíz en Código (Archivo:Líneas) | Nivel de Riesgo P0/P1/P2`).
  - **SECCIÓN 3:** Disección Quirúrgica del Sistema de Búsqueda (análisis punto por punto de contaminación vectorial, stop words y caché local).
  - **SECCIÓN 4:** Disección Quirúrgica de la Experiencia Stand {IA} (flujo conversacional, verbosidad, latencia percibida, renderizado de herramientas).
  - **SECCIÓN 5:** Plan Maestro de Cirugía y Roadmap Cero Deuda (intervenciones atómicas priorizadas según el protocolo de cirugía de arquitectura).
- Cumplimiento inquebrantable de **Cero Suposiciones**: cada hallazgo debe citar archivo real y rango exacto de líneas inspeccionadas.

## Verification Resources
- Script ejecutable de auditoría: `node scripts/audit-monoliths.js`
- Comprobaciones del arnés: `npm run harness:check`
- Código fuente local en `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`

## Acceptance Criteria

### Verificación de Búsqueda y Algoritmos (Sabueso 1)
- [ ] Ubicación exacta en código (archivo y líneas) de la condición de matching de tokens de consulta en `webCatalogService.js` / `embeddingService.js` con explicación de por qué pasan stop words.
- [ ] Mecanismo exacto de sobreescritura/destrucción en `saveCatalogSnapshot` (`catalogCacheService.js`) documentado con flujo de datos.
- [ ] Evaluación matemática del umbral de similitud coseno (0.55 / 0.60) y por qué admite obras no relacionadas.

### Verificación Conversacional y Ergonomía (Sabueso 2)
- [ ] Directivas exactas en `aiPromptService.js:buildSalesSystemPrompt` que provocan verbosidad o interrupciones identificadas con números de línea.
- [ ] Análisis de concurrencia y flujo de datos de `prepareSaleDraft` en `useAiChatStream.js` documentado.
- [ ] Identificación de áreas táctiles subdimensionadas (<44px) en componentes de chat/mostrador.

### Verificación de Arquitectura y Código (Sabueso 3)
- [ ] Salida cuantitativa real de `node scripts/audit-monoliths.js` incluida en el reporte con lista de archivos >200 líneas y críticos.
- [ ] Identificación con archivo y línea de efectos colaterales o suscripciones sin limpieza en hooks y controladores.

### Verificación de Resiliencia y Base de Datos (Sabueso 4)
- [ ] Identificación de llamadas en `aiMediaService.js` que eludan el pool de fallback y fallan con HTTP 429.
- [ ] Diagnóstico del candado exclusivo de fila (`tx.event.update`) en `saleService.js` y su impacto en tiempos de respuesta.
- [ ] Análisis del comportamiento offline ante pérdida de conectividad de 30 segundos.

### Integridad del Entregable
- [ ] Informe Maestro de Fred contiene las 5 secciones requeridas sin omisiones.
- [ ] 100% de las afirmaciones respaldadas por inspección real de código fuente con cita de archivo y línea.
- [ ] Cumplimiento estricto del aislamiento entre proyectos (0 alteraciones a repositorios o bases de datos externas).

## 2026-09-15T19:57:22Z

# Teamwork Project Prompt — Fase 1 (Roadmap Quirúrgico Cero Deuda)

Implementación atómica de la **Fase 1 del Roadmap Quirúrgico Cero Deuda (P0)** en el repositorio `Modulo_Ventas`, incorporando las recomendaciones críticas de Gary para prevenir colisiones de secuencias en PostgreSQL, blindar la experiencia de usuario ante fallos de IA multimodal y asegurar idempotencia real RFC 7231 en mostrador ferial.

Requested team: Squad de Cirugía de Arquitectura (Fred & Implementadores Especialistas)
Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development
Reference specification: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md (Sección 5: Fase 1)

## Requirements

### R1. Desacoplamiento de Concurrencia en PostgreSQL con Secuencias Nativas (Cirugía 1.1)
- Modificar `server/services/sales/saleNumberGenerator.js` y `server/services/sales/saleTransactionService.js` para eliminar el incremento serial mediante `tx.event.update` dentro de `prisma.$transaction`.
- Implementar secuencias nativas de PostgreSQL (`nextval`) sin retención de bloqueos de tupla (`RowExclusiveLock` / `FOR UPDATE`) sobre la tabla `events`.
- **Directiva de Gary (Prevención de Colisiones):** La secuencia debe crearse/inicializarse dinámicamente asegurando que arranque en `COALESCE("currentSaleSequence", 0) + 1` del evento actual, previniendo duplicados con ventas preexistentes:
  ```sql
  DO $$
  DECLARE
    current_seq int;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE sequencename = 'sale_seq_' || quote_ident($1)) THEN
      SELECT COALESCE("currentSaleSequence", 0) + 1 INTO current_seq FROM "Event" WHERE id = $1;
      EXECUTE 'CREATE SEQUENCE sale_seq_' || quote_ident($1) || ' START WITH ' || current_seq;
    END IF;
  END $$;
  ```
- **Casting Seguro:** Castear explícitamente el valor `BigInt` retornado por `nextval` a `Number()` en JavaScript para evitar problemas de serialización JSON.
- Mantener estrictamente el formato canónico del ticket (`{NOMBRE_EVENTO}-{SECUENCIA}`).

### R2. Erradicación de Mocks en `aiMediaService` y Resiliencia en Modales UI (Cirugía 1.2)
- En `server/services/ai/aiMediaService.js` (`#L138-L141, L165-L168, L196-L199, L235-L238`), erradicar completamente los retornos mock quemados (*"Chainsaw Man Q65"*, etc.) en los bloques `catch`. Propagar excepciones descriptivas estructuradas (`throw new Error('AI_MEDIA_SERVICE_FAILED')`).
- En `server/services/geminiPoolService.js`, sanear la lista del pool de modelos a identificadores válidos y operativos de Google GenAI (`gemini-2.5-flash`, `gemini-2.5-pro` u homólogos oficiales).
- En `server/services/embeddingService.js#L48-L55`, canalizar `embedContent` a través de `executeWithModelFallback` para tolerar errores HTTP 429 mediante rotación automática de API Keys.
- **Directiva de Gary (UX en Mostrador):** En los componentes de frontend que consumen notas de voz, fotos de obras y fotos de lote (ej. modales de dictado y escaneo), capturar limpiamente los errores de IA. Si la inferencia falla, detener el spinner y mostrar un banner visual ámbar/rojo con mensaje claro y botón de acción directa *"Cargar Manual"*, impidiendo bloqueos o spinners infinitos.

### R3. Resiliencia Offline e Idempotencia Real RFC 7231 (Cirugía 1.3)
- **Directiva de Gary (Esquema Prisma):** Agregar el campo `idempotencyKey String? @unique` al modelo `Sale` en `prisma/schema.prisma` y sincronizarlo con la base de datos de forma segura.
- **Idempotencia RFC 7231 en Backend:** En `server/services/sales/saleTransactionService.js` y `server/controllers/saleController.js`, si una petición incluye un `idempotencyKey` que ya existe en la base de datos, **no lanzar error 500 ni rechazar la transacción**: retornar de inmediato la venta previa registrada con status HTTP 200 OK y el flag `{ idempotentReplay: true }`.
- **Generación en Frontend:** En `src/components/manual-sale/hooks/useManualSaleCart.js` y el flujo de ventas, generar un `clientSaleUuid = crypto.randomUUID()` transmitido en la cabecera HTTP `Idempotency-Key`.
- **Tolerancia Offline 30s:** Manejo defensivo en frontend para reintentar la venta con la misma clave ante parpadeos de red sin duplicar filas en `sales`, `sale_items` o `sale_payments`.

## Verification Resources
- Suite de arnés oficial: `npm run harness:check`
- Comprobación de ausencia de mocks: `git grep -n "Chainsaw Man" server/` (debe devolver 0 fuera de tests archivados)
- Compilación de producción: `npm run build`
- Pruebas de base de datos y prisma: `npx prisma validate`

## Acceptance Criteria

### Concurrencia PostgreSQL (R1)
- [ ] `tx.event.update` eliminado del flujo de consecutivo dentro de `prisma.$transaction`.
- [ ] Secuencia creada dinámicamente con offset correcto (`currentSaleSequence + 1`), impidiendo colisión con ventas previas.
- [ ] Consecutivo devuelto como `Number` y formato de ticket `{NOMBRE}-{SEQ}` intacto.

### Saneamiento de IA y Frontend UI (R2)
- [ ] 0 referencias a datos mock ficticios en `server/services/ai/aiMediaService.js`.
- [ ] Fallos de red o 429 en voz/fotos muestran banner con botón "Cargar Manual" en la interfaz sin congelar la pantalla.
- [ ] `embeddingService.js` utiliza fallback de claves ante errores 429.

### Idempotencia RFC 7231 (R3)
- [ ] Campo `idempotencyKey` con índice `@unique` agregado al modelo `Sale` en `prisma/schema.prisma`.
- [ ] Peticiones repetidas con la misma `Idempotency-Key` devuelven la venta existente con HTTP 200 sin insertar duplicados.
- [ ] El frontend genera y envía `Idempotency-Key` en cada intento de confirmación de venta.

### Integridad General
- [ ] `npm run harness:check` pasando 100% verde (9/9 Zero-Trust, 0 secretos).
- [ ] `npm run build` exitoso con código de salida 0.
- [ ] Cero acoplamiento o alteraciones a bases de datos ajenas (aislamiento sagrado).

## 2026-09-15T23:59:14Z

# Teamwork Project Prompt — Fase 2 (Roadmap Quirúrgico Cero Deuda)

Implementación atómica y blindada de la **Fase 2 del Roadmap Quirúrgico Cero Deuda (P0)** en el repositorio `Modulo_Ventas`, erradicando definitivamente la contaminación vectorial en el motor de búsqueda híbrida/RAG, resolviendo entidades culturales cortas ("F1", "CR7"), sincronizando stop-words universales y dotando de `AbortController` al buscador manual de mostrador.

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Integrity mode: development
Reference specification: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 2)

## Requirements

### R1. Sincronización Universal de Stop-Words y Resolución de Entidades Cortas (Cirugía 2.1)
- Crear o centralizar la lista completa y exhaustiva `UNIVERSAL_STOP_WORDS` (50+ términos coloquiales de mostrador: `'de', 'la', 'el', 'los', 'las', 'en', 'y', 'un', 'una', 'unos', 'unas', 'con', 'por', 'para', 'cuanto', 'cuánto', 'cuesta', 'cuestan', 'precio', 'precios', 'tienen', 'tienes', 'hay', 'que', 'del', 'al', 'o', 'poster', 'posters', 'cuadro', 'cuadros', 'obra', 'obras', 'diseño', 'diseños', 'hola', 'buenas', 'buenos', 'muestrame', 'mustrame', 'muéstrame', 'mostrar', 'muestra', 'tenemos', 'disponible', 'disponibles', 'catalogo', 'catálogo', 'ver', 'mira', 'dame', 'quiero', 'busca', 'buscar'`) para consumo compartido entre `webCatalogService.js` y `embeddingService.js`.
- En `server/services/embeddingService.js`:
  - Utilizar `UNIVERSAL_STOP_WORDS` en lugar de la lista reducida de 11 palabras.
  - Implementar lista blanca de entidades cortas reconocidas:
    ```javascript
    const KNOWN_SHORT_ENTITIES = new Set(['f1', 'u2', 'r34', 'go', 'up', 'cr7']);
    ```
    para que tokens críticos de 2 caracteres no sean purgados por la regla `t.length > 2`.
  - Aplicar `resolveEntityAlias(cleanQuery)` o expansión canónica antes de la tokenización para resolver *"f1"* y apodos culturales.
- En `server/services/semantic/entityAliases.js`:
  - Incorporar la entidad `Formula 1 - F1` con alias `['f1', 'formula 1', 'formula uno', 'carreras', 'ferrari f1', 'red bull f1', 'verstappen', 'hamilton', 'senna', 'ayrton senna']` (categoría `DEPORTES` o `CARRERAS`).
  - Incorporar la entidad `Cristiano Ronaldo - CR7` con alias `['el bicho', 'cr7', 'cristiano ronaldo', 'cristiano', 'ronaldo', 'siuu', 'el comandante']` (categoría `FUTBOL`).

### R2. Calibración Vectorial (>= 0.72) y Compuerta de Entidad Raíz (Cirugía 2.2)
- En `server/services/embeddingService.js`:
  - Elevar el umbral complementario para candidatos puramente vectoriales de `0.60` a **`0.72`** para eliminar el ruido basal del hipercono de embeddings 768d/3072d.
  - Sustituir la condición débil `.some` por cobertura estricta de tokens de consulta:
    ```javascript
    const matchesEntity = normQueryTokens.length > 0 && normQueryTokens.every((tok) => posterText.includes(tok));
    ```
  - Reemplazar la compuerta restrictiva `allSameTitle` por comprobación de entidad canónica compartida: si los primeros resultados léxicos corresponden a una entidad raíz compartida (ej. *"messi"*), no admitir en la mezcla vectorial obras que pertenezcan a entidades distintas, permitiendo a la vez múltiples obras del mismo personaje (*"Messi - El Beso Eterno"*, *"Messi - El Beso de la Gloria"*).

### R3. Blindaje de Red con `AbortController` en Buscador Manual y Snapshot Asíncrono (Cirugía 2.3)
- En `src/components/manual-sale/hooks/useCatalogSearch.js`:
  - Implementar `activeAbortRef = useRef(null)`.
  - En cada cambio de `searchQuery`, abortar inmediatamente cualquier petición HTTP en vuelo (`activeAbortRef.current?.abort()`) antes de disparar el nuevo debounce.
  - Pasar el `signal` a `searchPostersWithFallback`.
  - Ignorar excepciones de tipo `AbortError` limpiamente sin congelar la interfaz ni parpadear mensajes de error.
- En `src/services/catalogCacheService.js`:
  - Ajustar `TIMEOUT_MS` a `1500ms`.
  - Optimizar `saveCatalogSnapshot` para diferir la serialización a `localStorage` fuera del hilo crítico de renderizado (mediante `setTimeout(..., 0)` o microtarea), preservando la compatibilidad síncrona en entornos de testing donde `localStorage` se evalúa inmediatamente.

### R4. Techos de Líneas y Calidad de Código
- `server/services/embeddingService.js` <= 200 líneas.
- `src/components/manual-sale/hooks/useCatalogSearch.js` <= 200 líneas.
- `src/services/catalogCacheService.js` <= 200 líneas.
- `server/services/semantic/entityAliases.js` <= 600 líneas.

## Verification Resources
- Arnés Zero-Trust: `npm run harness:check`
- Compilación Vite: `npm run build`
- Suite de pruebas unitarias y adversariales:
  - `node --test tests/catalog/catalog-cache-service.test.js`
  - `node --test tests/ai/embeddingService.test.js`
  - `node --test tests/adversarial/m1-embeddings-adversarial.test.js`
- Test de regresión y cobertura de búsqueda con alias cortos y stop words:
  - Verificar que `"muéstrame lo que tenemos de messi"` retiene únicamente `['messi']`.
  - Verificar que `"f1"` retiene `"f1"` y no se descarta.
  - Verificar que búsqueda de `"f1"` no devuelva pósters de baloncesto.

## Acceptance Criteria

### Búsqueda Semántica y Stop-Words (R1)
- [ ] `normQueryTokens` descarta limpiamente verbos y palabras de mostrador (*"muéstrame"*, *"tenemos"*, *"cuánto cuesta"*).
- [ ] Consulta `"f1"` retiene el token `"f1"` y resuelve alias a Formula 1.
- [ ] Entidades F1 y CR7 agregadas en `entityAliases.js` con sus respectivos alias culturales.

### Calibración y Compuerta de Entidad (R2)
- [ ] Umbral vectorial complementario fijado en `>= 0.72`.
- [ ] Descarte tajante de candidatos que no cumplan `every` sobre los tokens de entidad.
- [ ] Búsqueda de *"Messi"* admite múltiples obras de Messi pero bloquea pósters no afines (ej. Cristiano Ronaldo o películas).

### Ergonomía y Buscador Manual (R3)
- [ ] `activeAbortRef` cancela peticiones HTTP pendientes al escribir en el POS.
- [ ] `AbortError` no rompe el flujo ni borra la lista de resultados activa.
- [ ] `TIMEOUT_MS` configurado en `1500ms` en `catalogCacheService.js`.

### Integridad General (R4)
- [ ] `npm run harness:check` pasando 100% verde (9/9 Zero-Trust, 0 secretos, límites de líneas respetados).
- [ ] `npm run build` exitoso sin errores de bundling.
- [ ] Todas las suites de pruebas de embeddings y caché pasando 100% verde.

## 2026-09-16T01:32:28Z

# Teamwork Project Prompt — Fase 3 (Roadmap Quirúrgico Cero Deuda)

Implementación atómica y blindada de la **Fase 3 del Roadmap Quirúrgico Cero Deuda (P1)** en el repositorio `Modulo_Ventas`, restituyendo el flujo completo de bucle cerrado SSE (Turno 2) en `aiStreamService.js`, eliminando textos duplicados frente a `ChatDraftCard`, modularizando la tarjeta de borrador con `DraftItemRow.jsx` para cumplir los techos de líneas (<140 líneas), previniendo cierres obsoletos (*stale closures*) con `pendingDraftRef` y garantizando áreas táctiles feriales WCAG 2.1 AAA (>= 44px).

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Integrity mode: development
Reference specification: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\AUDITORIA_360_STAND_IA.md` (Sección 5: Fase 3)

## Requirements

### R1. Restitución del Bucle Cerrado SSE Turno 2 y Retiro de Texto Duplicado (Cirugía 3.1)
- En `server/services/ai/aiStreamService.js#L128-L135`:
  - Eliminar el bloqueo `if (hasDraft) { return; }` que truncaba el streaming impidiendo que Gemini complete el Turno 2 tras ejecutar `prepareSaleDraft`.
  - Permitir que `streamClosedLoopFollowUp` procese el resultado estructurado de `prepareSaleDraft` como `functionResponse`.
- En `server/services/ai/aiPromptService.js`:
  - Ajustar el system prompt para que, tras la preparación de un borrador, Gemini responda con **1 a 2 líneas breves, amables y vendedoras** (*"¡Excelente elección! Te preparé el borrador en pantalla con la promo aplicada. ¿Deseas confirmar la venta?"*).
  - Prohibir explícitamente en las directivas recitar la lista exhaustiva de ítems, precios unitarios o subtotales que ya están visibles de forma interactiva en `ChatDraftCard`.
  - Reemplazar la formulación negativa anti-enlatados por directivas afirmativas claras de estilo conversacional ágil para cajero ferial.
- En `server/services/ai/aiToolsService.js#L8`:
  - Eliminar el parámetro muerto o no utilizado `mensaje_conversacional` en `searchCatalogDeclaration`.

### R2. Modularización, Cumplimiento de Line Ceilings y Erradicación de Stale Closures (Cirugía 3.2)
- Crear el subcomponente modular: `src/components/ai-chat/components/DraftItemRow.jsx` (o `src/components/ai-chat/DraftItemRow.jsx` según el patrón de importación):
  - Extraer el renderizado de filas de ítems del borrador, selector de tamaño/precio, controles de cantidad y botón de sustitución (*swap*).
- En `src/components/ai-chat/ChatDraftCard.jsx`:
  - Importar y delegar en `DraftItemRow.jsx`.
  - Reducir el tamaño total del archivo a **< 140 líneas** (meta: < 125 líneas) para satisfacer `tests/ai/m3-cards-line-ceilings.test.js` y `tests/ai/m4-frontend-modular-adversarial.test.js`.
- En `src/components/ai-chat/hooks/useAiChatStream.js`:
  - Implementar `pendingDraftRef = useRef(pendingDraft)` manteniéndolo sincronizado en cada render o actualización de estado.
  - Asegurar que `handleSendText`, los callbacks de confirmación y el lector SSE consuman siempre `pendingDraftRef.current` para evitar cierres obsoletos (*stale closures*).
  - Mantener el tamaño de `useAiChatStream.js` estrictamente en **< 160 líneas** (meta: <= 145 líneas).

### R3. Rediseño de Zonas Táctiles de Mostrador Ferial (>= 44px) (Cirugía 3.3)
- En `src/components/ai-chat/ChatDraftCard.jsx` y `DraftItemRow.jsx`:
  - Asegurar que los botones de incremento (`+`) y decremento (`-`) de cantidad tengan un área de toque efectiva mínima de `min-w-[44px] min-h-[44px]` (o contenedor de 44px con icono centrado).
  - Asegurar que los botones de método de pago tengan una altura mínima de `min-h-[44px]` con tipografía táctil legible.
  - Asegurar que el botón principal *"Confirmar Venta"* tenga una altura mínima de `min-h-[48px]`.
- En `src/components/ai-chat/ChatToolCards.jsx`:
  - Verificar que los botones de acción rápida (*"+ Vender"*, etc.) cumplan con el estándar accesible `min-h-[44px]`.

### R4. Techos de Líneas y Calidad de Código
- `src/components/ai-chat/ChatDraftCard.jsx` < 140 líneas.
- `src/components/ai-chat/hooks/useAiChatStream.js` < 160 líneas.
- `src/components/ai-chat/ChatToolCards.jsx` < 140 líneas.
- `src/components/ai-chat/ChatSwapModal.jsx` < 100 líneas.
- `server/services/ai/aiStreamService.js` <= 200 líneas.
- `server/services/ai/aiClosedLoopService.js` <= 200 líneas.

## Verification Resources
- Suite adversarial de Closed-Loop: `node --test tests/ai/closed-loop-adversarial-challenger.test.js`
- Suite de techos de líneas de tarjetas: `node --test tests/ai/m3-cards-line-ceilings.test.js`
- Suite modular adversarial de frontend: `node --test tests/ai/m4-frontend-modular-adversarial.test.js`
- Arnés Zero-Trust y Monolitos: `npm run harness:check`
- Compilación Vite: `npm run build`

## Acceptance Criteria

### Closed-Loop SSE y Verbosidad (R1)
- [ ] Test 1.1 de `tests/ai/closed-loop-adversarial-challenger.test.js` pasa 100% verde (invoca exactamente 2 turnos de `generateContentStream`).
- [ ] Gemini genera mensaje vendedor conciso (1-2 líneas) tras armar el borrador sin recitar la lista de pósters ya mostrada en pantalla.
- [ ] Parámetro muerto `mensaje_conversacional` eliminado de `aiToolsService.js`.

### Line Ceilings y Modularidad (R2)
- [ ] `ChatDraftCard.jsx` tiene estrictamente < 140 líneas.
- [ ] `DraftItemRow.jsx` creado e integrado limpiamente.
- [ ] `useAiChatStream.js` consume `pendingDraftRef` erradicando cierres obsoletos.
- [ ] `tests/ai/m3-cards-line-ceilings.test.js` y `tests/ai/m4-frontend-modular-adversarial.test.js` pasan 100% verde.

### Accesibilidad Táctil Ferial (R3)
- [ ] Controles de cantidad (`+`, `-`), botones de pago y confirmación cumplen con tamaño mínimo de 44px (o 48px en confirmación).
- [ ] Tarjetas de herramientas (`ChatToolCards.jsx`) accesibles y optimizadas para pantallas táctiles de mostrador.

### Integridad General (R4)
- [ ] `npm run harness:check` pasando 100% verde (9/9 Zero-Trust, 0 secretos, 0 violaciones de límites).
- [ ] `npm run build` exitoso sin errores.
- [ ] 100% de tests unitarios y adversariales aprobados.
## 2026-09-16T02:15:00Z

# Teamwork Project Prompt — Fase 4: Modularización Quirúrgica, Unificación de Servicios y Protocolo del Nuevo Arnés

Implementación atómica de la **Fase 4 del Roadmap Quirúrgico Cero Deuda** en el repositorio `Modulo_Ventas`, ejecutando la unificación de servicios redundantes de sincronización de catálogo, el despiece de los monolitos críticos del backend y frontend conforme a los techos del nuevo arnés inteligente (`DOMAIN_CEILINGS` en `scripts/audit-monoliths.js`), garantizando la preservación inquebrantable de contratos HTTP y el aislamiento sagrado entre proyectos.

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`
Integrity mode: development
Reference specification: Master Prompt de Ingeniería de Gary (Sesión `@:4dfbdf49-6b03-4c91-98da-4d3ddbbfbcb2`) y `scripts/audit-monoliths.js`.

---

## Directivas Permanentes e Intocables (Regla del Nuevo Arnés)
- **Archivos Protegidos Autorizados (🟢 INTOCABLES):** Queda terminantemente prohibido tocar, dividir o alterar los 8 archivos protegidos en verde por tener cohesión natural:
  1. `server/services/semantic/entityAliases.js` (545/600 líneas)
  2. `server/services/geminiPoolService.js` (316/350 líneas)
  3. `server/index.js` (260/300 líneas)
  4. `server/routes/apiRoutes.js` (235/300 líneas)
  5. `server/controllers/authController.js` (266/300 líneas)
  6. `server/services/semantic/paymentExtractor.js` (229/280 líneas)
  7. `server/services/ai/aiToolsService.js` (216/250 líneas)
  8. `src/App.jsx` (212/250 líneas)
- La intervención debe ser **100% quirúrgica sobre los archivos en rojo con deuda técnica real**.

---

## Requirements

### R1. Unificación de Servicios de Sincronización de Catálogo (EJE A)
- Consolidar la duplicidad entre `server/services/catalog/liveCatalogSyncService.js` (293 líneas) y `server/services/catalogSyncService.js` (268 líneas):
  1. Extraer la normalización y constantes de tamaños a `server/services/catalog/catalogSizeResolver.js` (< 80 líneas) conteniendo `STANDARD_EVENT_SIZES`, `ALBUM_COVER_SIZE` y `resolvePosterSizes`.
  2. Centralizar en `server/services/catalog/liveCatalogSyncService.js` (< 200 líneas) la sincronización continua (delta-sync + webhooks + reconciliación periódica + paracaídas web).
  3. Reducir `server/services/catalogSyncService.js` a una **fachada de retrocompatibilidad (< 25 líneas)** que reexporte los símbolos públicos sin romper llamadas existentes.

### R2. Despiece del Monolito Crítico de Catálogo Web (EJE B.1)
- Despiezar `server/services/webCatalogService.js` (551 líneas | límite: 200):
  1. Extraer almacenamiento en memoria, TTL, invalidación y `getCachedProducts` a `server/services/catalog/catalogCacheStore.js` (< 110 líneas).
  2. Extraer tratamiento léxico, slugs, deduplicación y formateo POS (`extractImageSlug`, `normalizePosterTitle`, `deduplicatePosters`, `formatProductForPos`) a `server/services/catalog/catalogStringNormalizer.js` (< 130 líneas).
  3. Mantener `server/services/webCatalogService.js` en **< 180 líneas**, enfocado exclusivamente en `searchWebPosters`, scoring y fachadas públicas (`searchPosters`, `getCatalogPosters`, `getWebPosterById`).

### R3. Despiece de Controladores con Violación de Dominio y Monolitos (EJE B.2 & B.3)
- **Catálogo vs Eventos:**
  1. Crear `server/controllers/eventController.js` (< 190 líneas) con el ciclo de vida de eventos (`getActiveEvent`, `getEventsList`, `createEvent`, `activateEvent`, `archiveEvent`, `unarchiveEvent`, `deleteEvent`).
  2. Reducir `server/controllers/catalogController.js` a **< 90 líneas** con funciones exclusivas de catálogo (`getProducts`, `searchWebPostersCatalog`, `triggerCatalogSync`).
  3. Actualizar rutas en `server/routes/apiRoutes.js` para delegar `/api/events/*` en `eventController.js` sin alterar contratos de URL.
- **Controlador IA:**
  1. Extraer streaming SSE (`handleChatQuery`) a `server/controllers/ai/aiChatController.js` (< 170 líneas).
  2. Extraer endpoints multipart (`handleVoiceSale`, `handleBatchPhoto`, `handleArtworkRecognition`, `handleVideoRecognition`) a `server/controllers/ai/aiMediaController.js` (< 180 líneas).
  3. Reducir `server/controllers/aiController.js` a **< 30 líneas** como fachada reexportadora hacia `apiRoutes.js`.

### R4. Modularización de Controladores y Servicios de Ventas y Usuarios (EJE B.4 & B.5)
- **Ventas y Arqueos:**
  1. En `server/controllers/saleController.js`, delegar arqueos huérfanos (`postCashClosing`, `getCashClosingsList`) al controlador dedicado de caja, dejando `saleController.js` en **< 160 líneas**.
  2. En `server/services/sales/saleKpiService.js` (341 líneas), extraer métricas feriales de pantalla gigante (`getMonitorDashboardMetrics`) a `server/services/sales/monitorKpiService.js` (< 130 líneas), dejando `saleKpiService.js` en **< 190 líneas**.
  3. En `server/services/sales/saleTransactionService.js` (332 líneas), extraer `updateSaleTransaction` a `server/services/sales/saleUpdateService.js` (< 170 líneas), manteniendo `saleTransactionService.js` en **< 170 líneas** con reexportación.
- **Usuarios y Asignaciones:**
  1. En `server/controllers/userController.js` (284 líneas), extraer validaciones de roles y asignaciones feriales (`assignUserToEvent`) a `server/services/userEventAssignmentService.js` (< 80 líneas), reduciendo `userController.js` a **< 170 líneas**.

### R5. Modularización de Frontend y Limpieza de Timers (EJE B.6)
- En `src/components/RecentSalesList.jsx` (222 líneas | límite: 200):
  1. Extraer componente de fila a `src/components/sales/RecentSaleRow.jsx` (< 90 líneas) con formateo de estados, badges y botón de edición.
  2. Almacenar el temporizador de toast/notificación (`setTimeout 3500ms`) en `useRef` y limpiar con `clearTimeout` en el cleanup de `useEffect`.
  3. Reducir `RecentSalesList.jsx` a **< 130 líneas**.

---

## Verification Resources
- Auditoría de Monolitos: `node scripts/audit-monoliths.js` (Debe reportar 0 archivos en infracción en la sección de deuda real).
- Suite de Seguridad Zero-Trust: `npm run test:security` (9/9 pass).
- Auditoría de Secretos: `npm run audit:secrets` (0 secretos).
- Suite de Componentes Modulares: `node --test tests/manual-sale/manual-sale-m3.test.js` (17/17 pass).
- Compilación de Producción: `npm run build` (código de salida 0).
- Suite Integral de Regresión:
  - `node --test tests/catalog/catalog-cache-service.test.js`
  - `node --test tests/ai/embeddingService.test.js`
  - `node --test tests/ai/closed-loop-adversarial-challenger.test.js`
  - `node --test tests/ai/m3-cards-line-ceilings.test.js`
  - `node --test tests/ai/m4-frontend-modular-adversarial.test.js`
- Verificación en Vivo: Chrome DevTools MCP interactuando con el flujo de catálogo, eventos y ventas recientes.

---

## Acceptance Criteria

### Unificación y Despiece Backend (R1, R2, R3, R4)
- [ ] `node scripts/audit-monoliths.js` reporta 0 archivos en infracción en la Deuda Monolítica Real.
- [ ] Los 8 archivos protegidos permanecen intactos sin fragmentación artificial.
- [ ] Todos los archivos nuevos y modificados se encuentran estrictamente por debajo de sus techos respectivos (<200 líneas lógica estándar).
- [ ] `server/services/catalogSyncService.js` opera como fachada de < 25 líneas sin romper llamadas existentes.
- [ ] `server/controllers/aiController.js` opera como fachada de < 30 líneas delegando en `aiChatController` y `aiMediaController`.
- [ ] Contratos de API HTTP (rutas, query params, payloads y responses) 100% preservados.

### Modularización Frontend (R5)
- [ ] `RecentSalesList.jsx` tiene < 130 líneas y cuenta con cleanup estricto de temporizadores en desmontaje.
- [ ] `RecentSaleRow.jsx` creado y funcionando fluidamente.
- [ ] `tests/manual-sale/manual-sale-m3.test.js` pasa 17/17 verde.

### Integridad General
- [ ] `npm run harness:check` pasando 100% verde (9/9 Zero-Trust, 0 secretos, monolitos limpios, build en 0).
- [ ] Cero dependencias cruzadas o llamadas a bases de datos de otros proyectos.
- [ ] Evidencia visual en vivo mediante Chrome DevTools MCP demostrando operación fluida en catálogo, eventos y ventas recientes.

## 2026-09-17T05:19:24Z

Auditoría forense e implementación de la reingeniería 360° del ecosistema de voz de STAND {IA}: erradicar alucinaciones mediante desacople STT/NLU, conectar el reconocimiento de voz al RAG Híbrido y Entity Aliases, y calibrar hardware/UX en mostrador sin alterar bases de datos ajenas ni exceder techos monolíticos.

Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Desacople Arquitectónico STT vs NLU y Blindaje Anti-Alucinación (Backend)
- Desacoplar la inferencia de audio en 2 fases:
  * Fase 1: Transcripción Fiel Literal (STT Puro). Obtener el texto literal exacto de lo dicho sin interpretar ni inferir ventas.
  * Fase 2: Clasificación de Intención y Extracción de Venta (NLU). Evaluar el texto literal obtenido.
- Refactorizar `voiceSaleResponseSchema` en `server/services/ai/aiPromptService.js`:
  * Eliminar `items` y `paymentMethod` de la lista de campos obligatorios (`required`).
  * Introducir `isSaleDetected: boolean` e `intent` (`'SALUDO' | 'CONSULTA_CATALOGO' | 'DICTADO_VENTA' | 'RUIDO_NO_VENTA'`).
  * Si el audio es un saludo o no es venta, retornar `items: []` y `isSaleDetected: false`.

### R2. Conexión de Voz con RAG Híbrido y Protección de Consultas de Token Único (Backend)
- Conectar la resolución de obras en `server/services/ai/aiMediaService.js` al diccionario cultural `server/services/semantic/entityAliases.js` (`resolveEntityAlias`, `normalizeArtworkQuery`).
- Conectar la búsqueda de obras de voz al motor de embeddings de `server/services/embeddingService.js` (`searchHybridPosters`).
- Corregir en `server/services/webCatalogService.js` (`searchWebPosters`) la vulnerabilidad donde consultas con un solo token (`meaningfulTokens.length === 1`, como *"mundo"*) eluden el filtro de ratio de coincidencia y puntúan positivamente contra pósters no relacionados.
- Validar umbral de relevancia antes de aceptar resultados en `matchPosterEverywhere`.

### R3. Calibración de Sensibilidad Web Audio API, Visualizador Dinámico y Cancelación (Frontend)
- Calibrar el cálculo de nivel y decibeles en `src/components/ai-chat/hooks/useAiChatAudio.js` y `src/components/ai-chat/hooks/useAiVoiceRecorder.js` para los niveles de presión sonora de habla normal (RMS 0.015 - 0.035) en lugar del umbral 0.12.
- Mejorar el feedback visual en `src/components/ai-chat/ChatInputBar.jsx` para que las barras de nivel oscilen y reaccionen vivamente con el habla estándar, confirmando al vendedor que el micrófono está captando audio activamente.
- Incorporar un botón o mecanismo de cancelación inmediata en `ChatInputBar.jsx` que permita abortar grabaciones accidentales sin enviar la petición al backend.

### R4. Integración Conversacional de Mostrador y Respeto a Techos Monolíticos
- En `src/components/ai-chat/hooks/useAiChatStream.js` y `server/controllers/ai/aiMediaController.js`, manejar respuestas conversacionales naturales ante audios clasificados como saludo (`intent: 'SALUDO'`), saludando al vendedor por su nombre y con tono enérgico sin abrir borradores vacíos.
- Respetar estrictamente los límites de líneas de código definidos en `scripts/audit-monoliths.js` y los contratos fijados en `tests/ai/voice-vad-reengineering.test.js`.

## Acceptance Criteria

### Integridad y Anti-Alucinación (Backend)
- [ ] Inferencia con audio de saludo ("Hola Hola" o "Buenos días") clasifica `intent: 'SALUDO'`, retorna `isSaleDetected: false`, `items: []` y un mensaje conversacional sin borrador de venta.
- [ ] Inferencia con dictado de venta ("1 Batman mediano en efectivo" o "un conejo malo") detecta `intent: 'DICTADO_VENTA'`, `isSaleDetected: true`, resuelve el póster mediante el RAG/alias cultural y genera el borrador con tamaño y precio correctos.
- [ ] Consulta aislada de una palabra ("mundo") no empareja con Bad Bunny ni con productos irrelevantes; `searchWebPosters` exige coincidencia estricta para tokens individuales.

### Captura de Audio y UX (Frontend)
- [ ] Las barras de audio en `ChatInputBar.jsx` reaccionan visiblemente con variaciones dinámicas de altura ante volumen de voz normal (RMS ~0.02).
- [ ] La acción de cancelar grabación detiene el flujo y descarta los fragmentos de audio sin emitir llamada HTTP a `/api/ai/voice-sale`.

### Aislamiento, Seguridad y No-Regresión
- [ ] Cero interacción con bases de datos ajenas; únicamente opera sobre `deko_eventsales_db`.
- [ ] `node scripts/audit-monoliths.js` concluye con 0 archivos excedidos.
- [ ] `node --test tests/ai/voice-vad-reengineering.test.js` pasa al 100%.
- [ ] `npm test` pasa al 100%.

## 2026-09-17T14:17:48Z

Calibración profesional y blindaje acústico del reconocimiento de voz (STAND {IA}) en mostrador ferial para Deco Vintage Guate, erradicando sesgos fonéticos ("póster" vs "pastel"/"stickers"), reduciendo la latencia a menos de 5 segundos y garantizando tolerancia a ruido ambiental y control manual prioritario en el frontend.

Working directory: c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Priming de Dominio y Calibración Léxica de Mostrador (Backend)
- Inyectar contexto semántico y fonético de dominio ferial de Deco Vintage Guate (tienda de pósters feriales, marcos, cuadros, arte impreso, títulos de cultura pop, cine, anime, música y tamaños estándar: Mini, Pequeño, Portada de Álbum, Mediano, Grande, Gigante) en la inferencia de voz para asegurar la interpretación inequívoca de "póster(s)" y evitar falsos positivos como "pastel(es)" o "stickers".
- Proteger la extracción numérica contra vacilaciones fonéticas ("dos pa-") para evitar sobre-conteo de unidades o alteraciones de cantidad erróneas.
- Centralizar las plantillas léxicas y prompts en `server/services/ai/aiPromptService.js`, preservando la cohesión y límites de líneas en `server/services/ai/aiMediaService.js`.

### R2. Reducción Radical de Latencia en Mostrador Ferial
- Implementar y evaluar inferencia multimodal directa (audio a extracción estructurada `voiceSaleResponseSchema` en una única llamada con Gemini Flash) para reducir la latencia de 8-13s a menos de 5s, manteniendo la transcripción literal en el resultado estructurado.
- Si por motivos de fidelidad acústica se requiere preservar el flujo desacoplado, optimizar la brevedad y concurrencia de las llamadas garantizando la meta de latencia.

### R3. Tolerancia a Ruido Ambiente y Precedencia de Control Manual (Frontend)
- En `src/components/ai-chat/hooks/useAiVoiceRecorder.js`:
  - Elevar el tiempo de silencio para corte automático por VAD a mínimo 3.5 a 4.0 segundos una vez detectada la voz, evitando cortes prematuros cuando el vendedor toma aire o piensa.
  - Retardar o condicionar el aviso visual "Pausa detectada... finalizando" para que no interrumpa al 1.5s.
  - Otorgar precedencia absoluta al botón manual "■ Finalizar": al ser pulsado por el vendedor, detener y despachar la grabación de forma inmediata sin esperar ciclos del VAD.
  - Evitar cierres accidentales cuando el ruido de fondo (música ferial, TV, murmullo) eleve el piso de ruido (`noiseFloor`).
- En `src/components/ai-chat/hooks/useAiChatAudio.js` y `ChatInputBar.jsx`:
  - Calibrar la sensibilidad del VU-meter (`calculateDecibelsAndLevel`) para que las barras visuales del ecualizador respondan de manera reactiva y dinámica a la voz humana en tiempo real.

### R4. Arnés Arquitectónico, Pruebas Automatizadas y Cero Deuda
- Cumplir estrictamente con los límites de líneas establecidos en `scripts/audit-monoliths.js` (ningún archivo modificado debe exceder su techo asignado ni el límite base de 200 líneas).
- Actualizar la suite de pruebas en `tests/ai/voice-vad-reengineering.test.js` y añadir pruebas unitarias dedicadas en `tests/ai/` que certifiquen el priming fonético ("póster" vs "pastel"), la precisión de conteo numérico y los nuevos umbrales de VAD.
- Ejecutar y garantizar resultado 100% exitoso y limpio en `npm run harness:check` (seguridad, auditoría de secretos, monolitos y build de producción).

## Acceptance Criteria

### Inferencia y Backend
- [ ] La transcripción y extracción procesan audios con vocabulario ferial ("póster", "pósters", obras de cine/series/anime) transcribiendo fielmente el término sin confundirlo con "pastel" ni "stickers".
- [ ] Las vacilaciones verbales no generan sobre-conteo de cantidades en los ítems extraídos.
- [ ] La latencia de respuesta se optimiza sustancialmente frente al flujo previo de 12s.
- [ ] Las directivas y esquemas se mantienen centralizados en `aiPromptService.js`.

### Frontend & Experiencia de Usuario
- [ ] La grabación no se corta a los 2.5s si el usuario realiza pausas normales de habla (umbral de silencio configurado entre 3.5s y 4.0s).
- [ ] El botón manual "Finalizar" detiene la captura y procesa la venta de inmediato al ser pulsado.
- [ ] El ecualizador visual (VU-meter) muestra oscilación activa ante la modulación de voz en vivo.

### Calidad y Arquitectura
- [ ] `node --test tests/ai/voice-vad-reengineering.test.js` pasa con éxito con los nuevos umbrales.
- [ ] `npm run harness:check` finaliza con código 0 y sin advertencias críticas.
- [ ] `node scripts/audit-monoliths.js` confirma que 0 archivos exceden sus límites arquitectónicos.

## 2026-09-17T18:20:48Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview
> Requested team: Fred (Agente Implementador) y Equipo de Desarrollo, con supervisión y auditoría de Gary (Arquitecto de Sistemas & Auditor Forense)

Optimización crítica de latencia y resiliencia ferial en STAND {IA}: erradicar cuellos de botella en chat (< 2.5s) y visión (< 2.0s) e incorporar buffer de reintento offline/4G, manteniendo cero deuda técnica y contratos intactos.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas
Integrity mode: development

## Requirements

### R1. Eliminación del Doble Turno LLM en Ventas de Chat (aiStreamService.js)
En `server/services/ai/aiStreamService.js`, cuando Gemini invoca la herramienta `prepareSaleDraft` y `toolRecord.result` contenga ítems resueltos:
- Emitir inmediatamente el evento SSE `draft_sale` con el borrador resuelto.
- Emitir por SSE un token con la confirmación dinámica sin llamar a Gemini por segunda vez:
  *«¡Listo, [NombreVendedor]! Te monté el borrador en pantalla listo para cobrar con [método]. ¿Confirmamos la venta?»*
- Concluir el stream con `done`.
- Reservar `streamClosedLoopFollowUp` únicamente para consultas informativas complejas (catálogo amplio o métricas).

### R2. Persistencia Asíncrona Paralela en Visión (aiMediaController.js)
En `server/controllers/ai/aiMediaController.js` (`handleArtworkRecognition`):
- Eliminar la ejecución secuencial de `safePersistMedia` y `recognizePosterArtworkFromImage`.
- Ejecutar ambas operaciones en paralelo mediante `Promise.all` para lograr Zero-Wait GCS, manteniendo el retorno de `imageUrl` y `draftSale` idéntico e intacto.

### R3. Compresor de Imágenes en Cliente (imageCompressor.js)
- Crear `src/utils/imageCompressor.js` (máximo 60 líneas de código, función pura).
- Redimensionar proporcionalmente a un máximo de 1024 px en su lado mayor y exportar a Blob `image/jpeg` con calidad 0.75 (~100 KB a 140 KB).
- Integrar en `src/components/ai-chat/hooks/useAiChatStream.js` (`handleImageUpload`) para comprimir la imagen en el cliente antes de construir el `FormData`.

### R4. Aligeramiento Dinámico del Prompt Operativo (aiPromptService.js)
En `server/services/ai/aiPromptService.js` (`buildSalesSystemPrompt`):
- Omitir el volcado JSON masivo de ventas del día y métricas detalladas en órdenes de venta directa y consultas de catálogo.
- Inyectar el detalle transaccional completo únicamente si el mensaje del usuario contiene palabras clave de consulta operativa (`/caja|dinero|m[eé]tricas|ventas|cu[aá]nto|reporte|turno/i`).

### R5. Buffer de Reintento de Audio en Memoria (useAiChatStream.js)
En `src/components/ai-chat/hooks/useAiChatStream.js`:
- Almacenar el último `audioBlob` en una referencia en memoria `lastAudioBlobRef`.
- Ante fallo de red o timeout en `/api/ai/voice-sale`, habilitar acción visual o botón en el chat para reintentar el envío inmediato del buffer sin obligar al vendedor a volver a hablar.

### R6. Script Programático de Benchmarks de Latencia (latency-audit.test.js)
- Crear `tests/benchmarks/latency-audit.test.js` ejecutable con `node --test` para verificar de forma cuantitativa e independiente:
  1. Que el stream SSE de venta directa completa el ciclo con token + `draft_sale` + `done` en un solo turno.
  2. Que la persistencia en paralelo en visión ejecuta en simultáneo sin esperas bloqueantes.

## Verification Resources
- Suite de pruebas de seguridad y arnés existente:
  - `npm run test:security`
  - `npm run audit:secrets`
  - `npm run audit:monoliths`
  - `npm run build`
  - `npm run harness:check`
- Protocolos de calidad de la organización:
  - `cirugia-arquitectura-cero-deuda`
  - `arnes-verificacion-evidencia-forense`
  - `aislamiento-estricto-proyectos`

## Acceptance Criteria

### Integridad Arquitectónica y Calidad de Código
- [ ] `npm run harness:check` ejecuta y pasa al 100% limpio (seguridad, cero secretos, auditoría de monolitos y build de Vite).
- [ ] `src/utils/imageCompressor.js` tiene <= 60 líneas de código.
- [ ] Todos los archivos modificados cumplen estrictamente con los techos de `scripts/audit-monoliths.js` (< 200 líneas por defecto o excepciones de dominio).
- [ ] Cero alteraciones a esquemas de Prisma o migraciones de base de datos.
- [ ] Cero hardcodeo de credenciales, IPs o URLs absolutas.

### Latencia y Rendimiento Medido
- [ ] `node --test tests/benchmarks/latency-audit.test.js` pasa con éxito confirmando el ciclo directo.
- [ ] Latencia de venta directa por chat reducida de 11.5s a < 2.5s.
- [ ] Latencia de reconocimiento de imagen reducida de 6.6s a < 2.0s.
- [ ] Payload de imagen capturada desde smartphone reducido a <= 1024px (~100-140 KB) previo a la subida HTTP.

### Resiliencia y Contratos de Integración
- [ ] Contrato SSE y estructura de `draft_sale` se mantienen 100% compatibles con el frontend.
- [ ] Reintento de audio envía exitosamente el Blob almacenado en memoria tras un fallo de red simulado sin requerir re-grabación.

### Despliegue y Auditoría Forense
- [ ] Despliegue exitoso en Dokploy (`https://ventas.decovintage.online`).
- [ ] Inspección y certificación en vivo en navegador con Chrome DevTools bajo el protocolo de 4 filtros forenses de `arnes-verificacion-evidencia-forense`.

---

# Directiva Quirúrgica de Gary (Supervisión y Auditoría Forense)
Procedan pero ten en cuenta estas advertencias de Gary:
- Archivos a intervenir:
  1. `server/services/ai/aiStreamService.js` (Líneas 120-132)
  2. `server/controllers/ai/aiMediaController.js` (Líneas 115-135)
  3. `src/utils/imageCompressor.js` (NUEVO ARCHIVO, máx 60 líneas)
  4. `src/components/ai-chat/hooks/useAiChatStream.js` (Líneas 60-85)
  5. `server/services/ai/aiPromptService.js` (Líneas 160-168)
- Restricciones de Calidad (Deko Labs):
  - Ningún archivo nuevo o refactorizado puede superar las 200 líneas de código.
  - Ningún componente o módulo auxiliar puede superar las 60 líneas.
  - Prohibido hardcodear credenciales, IPs o URLs absolutas.
  - Prohibido romper el contrato de Server-Sent Events (SSE) ni la estructura de `draft_sale`.
  - Prohibido alterar esquemas de Prisma o migraciones de base de datos.

## 2026-09-18T21:32:20Z

# 🛡️ TEAMWORK PROJECT PROMPT: BLINDAJE DE CATÁLOGO Y CERO ALUCINACIONES EN STAND {IA}
**Autor:** Gary (CTO & Ingeniero DevOps en Jefe)  
**Destinatario:** Fred (`teamwork_preview_orchestrator`) & Cuadrilla de Subagentes  
**Repositorio:** `Modulo_Ventas` (Deco Vintage Guate / Deko Labs)  
**Directiva Sagrada de Sebastián Jiménez:** *"Bajo ninguna circunstancia se puede vender o presupuestar nada que no exista en el catálogo oficial de Deco Vintage."*

Erradicar los falsos positivos y la invención de productos en los canales de Audio (`/api/ai/voice-sale`) y Visión (`/api/ai/recognize-artwork`), garantizando que solo productos verificados con ID de catálogo oficial puedan ingresar a un borrador de venta.

Working directory: c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas  
Integrity mode: development  

## Context & Directives
- **Directiva Sagrada de Sebastián Jiménez:** *"Bajo ninguna circunstancia se puede vender o presupuestar nada que no exista en el catálogo oficial de Deco Vintage."*
- **Entorno:** Stand ferial en vivo / POS Inteligente (`Modulo_Ventas`).
- **Arquitectura:** Cero micro-fragmentación dogmática; justificación de techos de dominio y verificación Zero-Trust inquebrantable.

## Requirements

### R1. Frontera Dura y Manejo de Alternativas en Audio (`server/services/ai/aiMediaService.js`)
1. **Prohibición Total de Borradores Fantasma:**
   - En `processVoiceSaleAudio`, si `matched` es `null` (la obra dictada no existe en el catálogo con certeza), queda terminantemente prohibido hacer fallback a `item.title` o agregar ítems con `productId: null` o `webPosterId: null` a `enrichedItems`.
2. **Manejo Transparente de Dictados Mixtos:**
   - Si se dictan 2 o más obras y solo un subconjunto existe en el catálogo oficial (ej. *"1 Batman mediano y 2 pares de zapatos"*):
     - Únicamente la obra real del catálogo entra a `enrichedItems`.
     - Las obras no catalogadas se aíslan en `unmatchedItems`.
     - El mensaje de respuesta al vendedor debe notificar con claridad:  
       `"⚠️ Se preparó el borrador con Batman. Nota: No se encontró 'zapatos' en el catálogo oficial."`
3. **Rechazo con Sugerencias Amigables:**
   - Si ninguna obra dictada existe en el catálogo: `isSaleDetected = false`, `draftSale = null`, `items = []`.
   - El endpoint debe retornar `suggestedPosters` con las 3 alternativas más cercanas (si existen) para que el vendedor pueda agregarlas en 1 toque desde la pantalla ante posibles errores de pronunciación o ruido acústico.
   - Mensaje al vendedor: *"No se identificaron pósters del catálogo en el dictado de voz. Verifica el diseño o selecciónalo en el buscador."*

### R2. Refinamiento Inteligente del Comparador (`matchPosterEverywhere`)
1. **Eliminación del Coladero de 2 Tokens:**
   - Eliminar la condición laxa `matchedTokens.length >= 2` que permite que palabras genéricas accidentales (*live*, *rain*, *sombrero*, *street*, *mundo*) emparejen obras completamente ajenas.
2. **Criterios de Aceptación con Tolerancia Inteligente:**
   - **Paso 1 (Alias / Códigos):** Coincidencia inmediata si hay match de alias canónico (`aliasRes.matched === true`) o código QR/SKU exacto.
   - **Paso 2 (Normalización Previa):** Filtrar stopwords (*de, la, el, los, un, una, dos, en, con*), remover acentos y normalizar plurales simples (`s/es`).
   - **Paso 3 (Múltiples Palabras Significativas):** Exigir cobertura léxica real $\ge 70\%$ de los términos significativos sobre el título o franquicia principal de la obra. Si la consulta menciona un personaje/franquicia clave (ej. *Spider-Man*, *Batman*, *Taylor Swift*), dicho término debe estar presente obligatoriamente en el resultado.
   - **Paso 4 (1 Sola Palabra Significativa):** Solo se acepta si coincide directamente con el título primario, franquicia o alias registrado (prohibido validar basándose en tags secundarios o descripciones accesorias).

### R3. Umbral de Certeza en Visión (`recognizePosterArtworkFromImage`)
1. **Cero Forzado de Nearest-Neighbors:**
   - Prohibido tomar el primer resultado vectorial o búsqueda aproximada si la similitud léxica/semántica no supera el umbral de certeza estricto.
2. **Respuesta ante Obras Desconocidas:**
   - Si la obra fotografiada no se encuentra en el catálogo con certeza (`matched === null`):
     - `isArtworkDetected` DEBE ser `false`.
     - `draftSale` DEBE ser estrictamente `null`.
     - `items` DEBE ser `[]`.
     - Mensaje al vendedor: *"La obra fotografiada no pertenece al catálogo oficial de Deco Vintage Guate o no se identificó con certeza. Puedes buscarla manualmente en el catálogo."*

### R4. Cohesión y Arnés de Calidad (Sin Dogmas de 200 Líneas)
1. **Cohesión Justificada y Techos de Dominio:**
   - No micro-fragmentar archivos de forma artificial. Si `aiMediaService.js` crece de forma natural hasta ~240 líneas por la validación robusta, registrarlo legítimamente en `DOMAIN_CEILINGS` de `scripts/audit-monoliths.js` (`max: 260`, *"Orquestador multimodal de medios e inferencia"*).
   - Si se decide extraer el matcher a `server/services/ai/aiMatchService.js`, realizarlo únicamente si aporta claridad modular real.
2. **Compuertas Obligatorias del Arnés:**
   - Ejecutar y aprobar en verde total:
     ```powershell
     npm run harness:check
     ```
     (9/9 pruebas Zero-Trust, 0 fugas de secretos, 0 violaciones de techos dinámicos y build de producción limpio con código de salida 0).

## Acceptance Criteria

### Audio Channel & Voice Sale Integrity
- [ ] En `processVoiceSaleAudio`, ningún ítem con `productId: null` o `webPosterId: null` ingresa a `items`/`enrichedItems`.
- [ ] Dictados con obras inexistentes (ej. *"zapatos deportivos y un sombrero mediano"*):
  - Retorna `isSaleDetected: false`, `draftSale: null`, `items: []`, `total: 0`.
  - Retorna `suggestedPosters` con hasta 3 sugerencias opcionales.
  - Mensaje claro indicando que no se identificaron pósters del catálogo.
- [ ] Dictados mixtos (ej. *"1 Batman mediano y 2 pares de zapatos"*):
  - Solo la obra de catálogo entra a `items` y suma al total.
  - Obras ajenas se aíslan en `unmatchedItems`.
  - Mensaje advierte la exclusión de los ítems no encontrados.
- [ ] Dictados con obras reales (ej. *"Spider-Man debut grande en tarjeta"*):
  - Detecta la obra oficial al 100% sin regresiones.

### Catalog Comparator Precision
- [ ] La condición `matchedTokens.length >= 2` eliminada de `matchPosterEverywhere`.
- [ ] Consultas multi-palabra exigen $\ge 70\%$ de cobertura léxica sobre título/franquicia y preservan términos clave de franquicia.
- [ ] Consultas de una sola palabra solo emparejan contra título primario, franquicia o alias canónico registrado.
- [ ] Normalización previa remueve stopwords, acentos y plurales simples de forma determinista.

### Vision Artwork Recognition Integrity
- [ ] Foto de arte ajeno/no catalogado (*Neon Cyber Lobster*):
  - Retorna `isArtworkDetected: false`, `draftSale: null`, `items: []`.
  - Prohibido asociar por proximidad vectorial forzada a obras ajenas (ej. Pink Floyd).
- [ ] Foto de arte oficial (*La noche estrellada*):
  - Reconoce la obra oficial sin fallos ni regresiones.

### Verification & Quality Harness
- [ ] Suite de pruebas automatizadas en `tests/` cubriendo los 4 casos límite locales obligatorios.
- [ ] `scripts/audit-monoliths.js` actualizado en `DOMAIN_CEILINGS` para `aiMediaService.js` (`max: 260`) si excede el límite base.
- [ ] `npm run harness:check` aprueba al 100% (Zero-Trust 9/9, audit:secrets, audit:monoliths, build).
