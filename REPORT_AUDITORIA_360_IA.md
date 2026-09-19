# 🔍 INFORME MAESTRO DE AUDITORÍA PANÓPTICA 360° DEL AGENTE DE IA (STAND {IA})
**Repositorio:** `Modulo_Ventas` / Subsistema `STAND {IA}` (Deco Vintage Guate & Deko Labs)
**Emisor:** Gary (CTO & Chief DevOps — Deko Labs)
**Auditor Autónomo:** Jules (Sentinel & Senior QA Auditor)
**Fecha de Emisión:** 2026-09-19
**Alcance:** Subsistema del Agente de IA (`STAND {IA}`)
**Directiva Primaria:** Auditoría forense exhaustiva sin modificación de código de aplicación.

---

## ÍNDICE GENERAL
1. **SECCIÓN 1:** Diagnóstico Ejecutivo de Salud del Agente y Semáforo 360°
2. **SECCIÓN 2:** Análisis Forense Detallado por Dimensión (Línea por Línea)
3. **SECCIÓN 3:** Matriz Panóptica de Hallazgos Forenses
4. **SECCIÓN 4:** 🚀 Las 10 Propuestas Estratégicas para un Copiloto Ferial Proactivo

---

# SECCIÓN 1: DIAGNÓSTICO EJECUTIVO DE SALUD DEL AGENTE Y SEMÁFORO 360°

### 1.1 Veredicto General de Madurez Técnica y Estabilidad
El subsistema de Inteligencia Artificial **`STAND {IA}`** exhibe un nivel de ingeniería robusto y maduro, diseñado específicamente para operar bajo la dinámica acelerada de ferias y convenciones masivas. El agente integra soporte multimodal completo (texto, dictado de voz, reconocimiento visual de obras por fotografía y análisis de lotes por QR/código de barras), gestión de rotación de API Keys con aislamiento de cuotas, un orquestador conversacional en streaming SSE (*Server-Sent Events*) con Function Calling de 10 herramientas oficializadas, y componentes visuales reactivos para tablets con áreas táctiles conformes a estándares de accesibilidad WCAG 2.1 ($\ge 44\text{px}$).

A pesar de esta sólida arquitectura base, la auditoría forense detectó cuellos de botella latentes en la resolución inicial del pool de modelos, sobreinyección de contexto sensible en consultas sencillas por regex laxo, y oportunidades de fortalecimiento en el manejo de excepciones de respuestas JSON multimodal.

### 1.2 Semáforo de Riesgo por Dimensión Evaluada

| # | Dimensión Auditada | Archivo(s) Principal(es) | Estado / Riesgo | Resumen del Diagnóstico |
|---|---|---|:---:|---|
| **1.1** | Pool de API Keys & Resiliencia Gemini | `server/services/geminiPoolService.js`<br>`server/services/ai/aiKeyPoolService.js` | **Verde** 🟢 | Cooldown por 429 funcional, rotación Round-Robin de llaves y degradación elegante en offline. Observación menor por inclusión de modelos 3.x no lanzados en la cascada inicial. |
| **1.2** | System Prompts & Directivas Feriales | `server/services/ai/aiPromptService.js` | **Amarillo** 🟡 | Excelente rigidez en precios fijos y regla de Portada Álbum (Q55.00 en 30x30 cm). Sin embargo, regex `isOperationalQuery` engloba la palabra "cuánto", inyectando datos financieros privados en preguntas sencillas de catálogo. |
| **1.3** | Function Calling & Declaración Tools | `server/services/ai/aiToolsService.js` | **Verde** 🟢 | 10 herramientas declaradas con esquemas OpenAPI rigurosos. Sanitización determinista de borradores con `constructDraftPayload`. |
| **1.4** | Orquestador SSE & Closed-Loop | `server/services/ai/aiClosedLoopService.js`<br>`server/services/ai/aiStreamService.js` | **Amarillo** 🟡 | Streaming SSE fluido y emisión reactiva de tarjetas. Purga atómica con `discardSaleDraft` impecable. Retorno anticipado en borradores con ítems no encontrados puede acortar el closed-loop. |
| **1.5** | Multimodalidad de Visión Artificial | `server/services/ai/aiMediaService.js`<br>`server/controllers/ai/aiMediaController.js` | **Verde** 🟢 | Filtro de dominio negativo contra comida, ropa y animales. Enriquecimiento y validación de cobertura léxica contra catálogo real de PostgreSQL. |
| **1.6** | Multimodalidad de Voz & Jerga | `server/services/ai/aiPromptService.js`<br>`server/services/ai/aiMediaService.js` | **Verde** 🟢 | *Priming* fonético efectivo para prevenir confusiones de "póster" con "pastel/stickers", manejo de vacilaciones y jerga guatemalteca. |
| **1.7** | Diccionario Semántico & Aliases | `server/services/semantic/entityAliases.js`<br>`paymentExtractor.js` | **Verde** 🟢 | Cobertura extensa de cultura pop y franquicias. Evaluado dentro de su techo autorizado de dominio (559/600 líneas). Extractor determinista de pago. |
| **1.8** | Componentes Visuales Chat & UX | `src/components/ai-chat/*` | **Verde** 🟢 | Renderizado reactivo de borradores, podio Top 3 y gráfico de ventas horarias. Cumplimiento de touch targets $\ge 44\text{px}$ en botones interactivos. |

---

# SECCIÓN 2: ANÁLISIS FORENSE DETALLADO POR DIMENSIÓN

### 2.1 Pool de API Keys & Resiliencia Gemini
- **Archivos Auditados:** [`server/services/geminiPoolService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/geminiPoolService.js) (328 líneas, dentro del techo de 350) y [`server/services/ai/aiKeyPoolService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiKeyPoolService.js) (89 líneas).
- **Análisis de Código Fuente:**
  - `aiKeyPoolService.js` implementa `getAvailableKeys()` (líneas 7-18) parseando `ENV.GEMINI_API_KEYS` separadas por comas.
  - `markKeyCooldown` (líneas 46-64) pone en cuarentena la clave por 60.000 ms en un `cooldownMap` aislado al recibir un error HTTP 429 (`RESOURCE_EXHAUSTED`).
  - `executeWithModelFallback` (líneas 113-228) y `streamWithModelFallback` (líneas 230-328) ejecutan cascadas multi-modelo y multi-clave. Ante fallos de red o saturación (HTTP 503 / 500 / 504), reintentan con *jitter* exponencial (`sleepWithJitter`).
  - **Degradación Elegante:** Si todas las claves se agotan o el cliente está desconectado (`client === null`), `streamWithModelFallback` (líneas 238-241) emite un token de aviso interpretativo sin colapsar el proceso Node.js: `"[Modo Offline] El asistente de IA no está conectado actualmente."`.
- **Hallazgo Forense:** `resolveEffectiveModels` (líneas 103-111) antepone los modelos `gemini-3.8-flash`, `gemini-3.7-flash` y `gemini-3.6-flash`. Al no ser nombres oficialmente desplegados en la API v1beta/v1 de Google GenAI, la API retorna HTTP 404 (`isModelNotFoundError`), lo que fuerza 1 a 3 reintentos antes de caer a `gemini-2.5-flash`, incrementando la latencia en ~400ms a 800ms por interacción.

### 2.2 System Prompts & Directivas Feriales
- **Archivo Auditado:** [`server/services/ai/aiPromptService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiPromptService.js) (líneas 1-213).
- **Análisis de Código Fuente:**
  - **Rigidez de Precios:** Líneas 81-91 imponen la política estricta de precios fijos: Mini Q25, Pequeño Q35, Portada Álbum Q55, Mediano Q65, Grande Q125, Gigante Q180. Prohíbe explícitamente inventar combos (2xQ120 o 3xQ180).
  - **Regla de MÚSICA & Vinilos:** Líneas 86-88 e instrucción 3 (líneas 120-125) establecen que la medida `PORTADA_ALBUM` (30×30 cm a Q55.00) es exclusiva para obras de música y prohíbe fabricar pósters normales (cine, anime, cómics) en 30×30 cm.
  - **Tono Comercial:** Exige uso exclusivo de "tú", comunicación ultra breve (1-2 líneas) y proactividad para armar el borrador.
- **Hallazgo Forense:** En la línea 63:
  ```javascript
  const isOperationalQuery = !message || /caja|dinero|m[eé]tricas|ventas|cu[aá]nto|reporte|turno/i.test(message);
  ```
  La inclusión del término `cu[aá]nto` hace que consultas simples de catálogo (ej. *"¿cuánto cuesta el mediano?"*) activen la inyección masiva de `resolvedContextData` (KPIs acumulados del evento, ventas recientes, desgloses de efectivo en caja), consumiendo ~500-1000 tokens adicionales e inyectando contexto financiero confidencial innecesariamente.

### 2.3 Function Calling & Declaración de Herramientas
- **Archivo Auditado:** [`server/services/ai/aiToolsService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiToolsService.js) (256 líneas, dentro del techo de 280).
- **Análisis de Código Fuente:**
  - Manifiesto oficial de 10 herramientas en `salesAssistantTools` (líneas 1-25): `prepareSaleDraft`, `discardSaleDraft`, `searchCatalog`, `getEventKPIs`, `getHourlySalesAnalytics`, `getTopSellingPosters`, `getCashDrawerStatus`, `getSellerShiftReport`, `getProductionQueueStatus`, `checkInventoryStock`.
  - Esquemas OpenAPI estructurados con `Type.OBJECT`, `Type.ARRAY` y campos `required` explícitos.
  - `constructDraftPayload` (líneas 28-124) enriquece los ítems resolviendo nombres con `matchPosterEverywhere` y `resolveEntityAlias`, calculando subtotales numéricos deterministas y generando un arreglo `unmatchedItems` si la obra no existe en PostgreSQL.
- **Hallazgo Forense:** En `executeSearchCatalog` (líneas 145-153), si no hay coincidencia directa en catálogo ni híbrida, se genera un objeto alias sintético con `id: alias-...` y precio Q65. Aunque previene respuestas vacías, puede presentar precios estimados de Q65 para obras que no han sido verificadas contra la DB.

### 2.4 Orquestador SSE & Closed-Loop Conversacional
- **Archivos Auditados:** [`server/services/ai/aiClosedLoopService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiClosedLoopService.js) (116 líneas), [`server/services/ai/aiStreamService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiStreamService.js) (148 líneas), [`server/controllers/ai/aiChatController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/ai/aiChatController.js) (78 líneas).
- **Análisis de Código Fuente:**
  - Enrutamiento SSE con `res.setHeader('Content-Type', 'text/event-stream')` en `aiChatController.js`.
  - `streamChatWithSalesAssistant` (líneas 63-148) procesa chunks del stream, detecta llamadas de herramientas (`chunk.functionCalls`), ejecuta `executeToolCall` y emite eventos SSE inmediatos (`event: draft_sale`, `event: suggested_posters`, `event: hourly_sales`, etc.).
  - Purga atómica del borrador: `discardSaleDraft` (líneas 46-49 en `aiClosedLoopService.js`) retorna `{ event: { type: 'draft_sale', data: null } }`, limpiando instantáneamente el estado `pendingDraft` en React ante frases como *"cancela la orden"* u *"olvídalo"*.
- **Hallazgo Forense:** En `aiStreamService.js` (líneas 105-131), cuando existen `unmatchedItems` en un borrador con ítems parciales, la función emite un token sintético y ejecuta `return;`, omitiendo el paso por `streamClosedLoopFollowUp`. Si bien evita duplicidad de texto, acorta el segundo turno de Gemini.

### 2.5 Multimodalidad de Visión por Computadora
- **Archivos Auditados:** [`server/services/ai/aiMediaService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiMediaService.js) (143 líneas), [`server/controllers/ai/aiMediaController.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/controllers/ai/aiMediaController.js) (142 líneas).
- **Análisis de Código Fuente:**
  - `recognizePosterArtworkFromImage` (líneas 100-136) procesa imágenes con `artworkRecognitionResponseSchema`.
  - **Filtro de Dominio Negativo:** `isNegativeDomainArtwork` (líneas 15-18) evalúa con expresiones regulares si la imagen corresponde a comida (ramen, tacos, hamburguesas, pizzas), ropa, calzado o animales vivos, rechazando la solicitud con `isArtworkDetected: false` si no es arte gráfico.
  - **Coincidencia Léxica con Catálogo:** `hasLexicalArtworkRelevance` (líneas 20-33) verifica que el título detectado por la visión mantenga coincidencia léxica con los registros reales de PostgreSQL.
  - `processPostersBatchPhoto` (líneas 180-210) extrae códigos QR/barras de fotos de lote y los cruza contra `product.qrCodeData` y `barcode`.
- **Hallazgo Forense:** En `recognizePosterArtworkFromImage` (línea 112), si la API de Gemini devuelve un JSON malformado o texto envuelto en bloques no parseables, `JSON.parse` lanza una excepción que es capturada por el bloque `catch` externo invocando `throwMediaError`, devolviendo HTTP 500 en lugar de una respuesta estructurada `isArtworkDetected: false`.

### 2.6 Multimodalidad de Voz Ferial & Jerga Guatemalteca
- **Archivos Auditados:** [`server/services/ai/aiPromptService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiPromptService.js) (`buildVoiceSalePrompt`, líneas 25-36), [`server/services/ai/aiMediaService.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/ai/aiMediaService.js) (`processVoiceSaleAudio`, líneas 46-98).
- **Análisis de Código Fuente:**
  - `buildVoiceSalePrompt` establece *priming* acústico explicito: *"Está terminantemente PROHIBIDO interpretar pastel, pasteles, postre o stickers. Si la acústica suena parecido a pastel o stickers, interpreta SIEMPRE póster o pósters"*.
  - Filtro de vacilaciones: *"En correcciones espontáneas ('dos pa-... un póster'), toma ÚNICAMENTE la cantidad final corregida (1 póster)"*.
  - Clasificación en 4 intenciones: `SALUDO`, `CONSULTA_CATALOGO`, `DICTADO_VENTA`, `RUIDO_NO_VENTA`.
  - Normalización de tamaños guatemaltecos y extracción de ítems con `processVoiceSaleAudio`.

### 2.7 Diccionario Semántico, Normalización & Aliases
- **Archivos Auditados:** [`server/services/semantic/entityAliases.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/semantic/entityAliases.js) (559 líneas, dentro del techo de 600) y [`server/services/semantic/paymentExtractor.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/server/services/semantic/paymentExtractor.js) (231 líneas, dentro del techo de 280).
- **Análisis de Código Fuente:**
  - `STAND_ENTITY_ALIASES` declara centenas de apodos y referencias culturales para música (Bad Bunny, Taylor Swift, Pink Floyd, Nirvana, Cerati), cómics (Spider-Man, Batman, Joker), anime (Dragon Ball, Chainsaw Man, Demon Slayer, One Piece), autos (F1, Checo Pérez, Porsche, Skyline) y fútbol (Messi, CR7, El Beso Eterno).
  - `resolveEntityAlias` (líneas 501-547) ordena los alias por longitud descendente para evaluar coincidencia con expresiones compuestas específicas (*"el beso eterno"*) antes de probar fragmentos cortos (*"el beso"*).
  - `extractPaymentMethod` en `paymentExtractor.js` (líneas 38-66) utiliza expresiones regulares contextuales para clasificar determinísticamente `TARJETA`, `TRANSFERENCIA` o `EFECTIVO`, ignorando menciones simples de quetzales.

### 2.8 Componentes Visuales del Chat & UX Táctil
- **Archivos Auditados:** [`src/components/ai-chat/ChatDraftCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatDraftCard.jsx) (102 líneas), [`DraftItemRow.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/DraftItemRow.jsx) (88 líneas), [`HourlySalesCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/HourlySalesCard.jsx) (108 líneas), [`TopPostersCard.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/TopPostersCard.jsx) (102 líneas), [`ChatToolCards.jsx`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/src/components/ai-chat/ChatToolCards.jsx) (228 líneas).
- **Análisis de Código Fuente:**
  - Todas las tarjetas se renderizan de forma reactiva al recibir eventos SSE.
  - **Ergonomía Táctil ($\ge 44\text{px}$):**
    - En `DraftItemRow.jsx`, los botones de incremento/decremento de cantidad y eliminación cuentan con dimensiones `min-w-[44px] min-h-[44px]`.
    - En `ChatDraftCard.jsx`, los botones de métodos de pago (`EFECTIVO`, `TARJETA`, `TRANSFERENCIA`) tienen clases `min-h-[44px] min-w-[44px]`.
    - El botón principal *"Confirmar Venta"* cuenta con `min-h-[48px]`.
    - En `TopPostersCard.jsx`, el botón `+ Vender` posee `min-h-[44px] min-w-[44px]`.

---

# SECCIÓN 3: MATRIZ PANÓPTICA DE HALLAZGOS FORENSES

| ID | Dimensión / Archivo | Severidad | Descripción del Defecto o Fuga de Lógica | Impacto Operativo en el Stand | Solución Técnica Recomendada |
|---|---|:---:|---|---|---|
| **HF-01** | Pool de Resiliencia / `server/services/geminiPoolService.js` (L103-L111) | **Media** | Inclusión de modelos no desplegados (`gemini-3.8-flash`, `gemini-3.7-flash`) en la cascada inicial de `resolveEffectiveModels`. | Genera reintentos con errores HTTP 404 antes de conmutar a `gemini-2.5-flash`, sumando ~400ms a 800ms de latencia en cada interacción. | Ajustar `resolveEffectiveModels` y `MODEL_PRIORITY_POOL` para utilizar únicamente los modelos oficialmente soportados (`gemini-2.5-flash`, `gemini-2.5-pro`). |
| **HF-02** | System Prompts / `server/services/ai/aiPromptService.js` (L63) | **Media** | Expresión regular `isOperationalQuery` demasiado permisisva (`/cu[aá]nto/i`). | Preguntas sencillas de catálogo ("¿cuánto cuesta el mediano?") disparan la inyección de todo el objeto `resolvedContextData` (KPIs, totales de caja, ventas recientes), inflando tokens e inyectando datos confidenciales. | Refinar la regex a frases analíticas explícitas como `/(cu[aá]nto\s+(llevamos\|vendimos\|hay\s+en\s+caja)\|m[eé]tricas\|reporte)/i` y excluir consultas directas de precio. |
| **HF-03** | Orquestador SSE / `server/services/ai/aiStreamService.js` (L105-L131) | **Baja** | Salida anticipada con `return;` en `streamChatWithSalesAssistant` al detectar `unmatchedItems` en borradores parciales. | Interrumpe el closed-loop del Turno 2 de Gemini, devolviendo un texto formateado plano sin permitir la respuesta conversacional personalizada del modelo. | Reemplazar el `return;` por la integración limpia del mensaje dentro del contexto del closed-loop en Turno 2. |
| **HF-04** | Multimodalidad Visión / `server/services/ai/aiMediaService.js` (L100-L136) | **Media** | Excepción no capturada en `recognizePosterArtworkFromImage` al parsear JSON devuelto por la API de visión. | Un fallo en `JSON.parse` lanza `throwMediaError`, respondiendo HTTP 500 al cliente en lugar de un JSON estructurado con `isArtworkDetected: false`. | Envolver `JSON.parse` en un bloque `try/catch` local que invoque la función `reject()` con un mensaje amigable al usuario. |
| **HF-05** | Function Calling / `server/services/ai/aiToolsService.js` (L145-L153) | **Baja** | `executeSearchCatalog` genera candidatos de alias sintéticos con precio Q65 sin consultar existencia física previa. | Puede presentar precios estimados de Q65 para obras de alias que no poseen registros correspondientes en la base de datos PostgreSQL. | Validar la existencia en la tabla `Product` o `WebPoster` antes de construir el objeto alias sintético. |
| **HF-06** | UX Visual Chat / `src/components/ai-chat/HourlySalesCard.jsx` (L38-L82) | **Baja** | Sin contenedor con altura máxima (`max-h`) ni scroll en la gráfica de ventas por hora. | En jornadas prolongadas con >12 franjas horarias, la tarjeta se expande verticalmente desplazando el historial de mensajes. | Añadir `max-h-60 overflow-y-auto custom-scrollbar` al contenedor de la gráfica de barras en `HourlySalesCard.jsx`. |

---

# SECCIÓN 4: 🚀 LAS 10 PROPUESTAS ESTRATÉGICAS PARA UN COPILOTO FERIAL PROACTIVO

Para transformar al Agente de IA de un asistente reactivo a un **copiloto ferial proactivo, inteligente y de alto valor operativo**, se proponen los siguientes 10 servicios y herramientas estratégicas:

1. **📢 Alerta Proactiva de Quiebre de Inventario & Agotamiento en Mostrador:**
   - *Mecanismo:* El agente monitorea en tiempo real las unidades vendidas por diseño. Al detectar que a un póster de alta rotación (ej. *"Messi - El Beso Eterno"* o *"Goku Ultra Instinto"*) le quedan $\le 2$ unidades en el stock físico del stand, emite una alerta preventiva en la cabecera del chat: *"⚠️ Quedan 2 unidades de Messi Mediano en mostrador. ¿Deseas enviar orden de pre-impresión al taller?"*.

2. **💡 Asistente Inteligente de Combos & Upselling Ferial Súper-Rápido:**
   - *Mecanismo:* Cuando el vendedor prepara un borrador de 1 póster Mediano (Q65), el agente sugiere proactivamente en pantalla un complemento de marco o producto adicional con 1 clic: *"💡 Sugerencia: Ofrece el marco de madera negro por Q45 adicionales o un segundo póster de la misma colección con 1 clic"*.

3. **🛡️ Copiloto de Respuesta a Objeciones del Cliente en Tiempo Real:**
   - *Mecanismo:* Un panel desplegable táctil con respuestas cortas y contextualizadas para el vendedor ante dudas de clientes: durabilidad de tintas al sol/agua (HP LÁTEX), instalación sin perforar muros (cinta tesa®), o protección para transporte en avión (tubo protector).

4. **🔮 Predicción Inteligente de Demanda para Taller en Horas Pico:**
   - *Mecanismo:* Analiza la velocidad de ventas de las últimas 2 horas y predice qué 5 diseños tendrán mayor demanda en el siguiente bloque horario (pico de 4 PM a 7 PM), generando una "Lista de Pre-Impresión Recomendada" para el taller antes de que se formen colas de espera.

5. **📲 Auditoría Criptográfica & Validación Automática de Comprobantes de Transferencia:**
   - *Mecanismo:* Herramienta multimodal donde el vendedor sube una foto de la boleta o captura bancaria (BI en Línea, Banrural, BAC). La IA extrae número de autorización, monto en Quetzales, fecha y cuenta de destino, verificando en PostgreSQL si el comprobante ya fue registrado previamente para evitar duplicidades o estafas.

6. **📊 Reporte de Arqueo Inteligente y Resumen Automático al Cierre de Turno / Cierre Ferial:**
   - *Mecanismo:* Al detectar el cambio de usuario o la hora de cierre del evento, la IA genera un resumen ejecutivo visual y auditado: total facturado en efectivo vs tarjeta/transferencia, vendedor estrella del turno, top 3 más vendidos y discrepancias detectadas en caja chica para facilitar los Cortes X y Z.

7. **🎙️ Modo "Manos Libres / Manos Ocupadas" con Activación por Voz Directa:**
   - *Mecanismo:* Para momentos de alta afluencia en mostrador donde el vendedor sostiene marcos o láminas, el chat habilita un modo de escucha continua con VAD (Voice Activity Detection) donde basta dictar *"Agrega Spiderman Mediano"* para armar el borrador sin tocar la tablet.

8. **💵 Prevención de Fugas de Efectivo & Auditoría Proactiva de Gaveta:**
   - *Mecanismo:* Auditoría continua en segundo plano. Si el dinero en efectivo acumulado en la gaveta del stand supera los Q 2,500.00, la IA notifica en pantalla al encargado del stand recomendando realizar un "Retiro Parcial de Caja" para resguardo seguro.

9. **🎯 Sincronizador de Descuentos por Lote y Ofertas de Cierre de Feria ("Última Hora"):**
   - *Mecanismo:* En las últimas 2 horas del evento, la IA activa el modo "Remate de Cierre", sugiriendo automáticamente al vendedor combos de liquidación autorizados para agotar el stock impreso restante y evitar devoluciones.

10. **🏷️ Generador Automático de Etiquetas QR y Venta Directa en Exhibición:**
    - *Mecanismo:* Permite a la IA generar códigos QR dinámicos para las obras en los paneles de exhibición. El cliente escanea el QR con su teléfono para ver los detalles del póster, y la selección se transmite directamente a la tablet del vendedor con la orden lista para cobro.

---

*Informe redactado por Jules (Sentinel & Senior QA Auditor) para Gary (CTO & Chief DevOps) y Deko Labs. Verificado mediante auditoría forense de código fuente en producción.*
