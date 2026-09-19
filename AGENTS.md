# 🏛️ AGENTS.md — GUÍA OPERATIVA PARA AGENTES AUTÓNOMOS (DEKO LABS)
> **Ecosistema:** `STAND {IA}` (Deko EventSales) — Sistema POS y Venta Ferial con IA Multimodal  
> **Organización:** Deco Vintage Guate & Deko Labs  
> **Líder de Producto:** Sebastián Jiménez  
> **Dirección Técnica & DevOps:** Gary (CTO) & Fred (Director de Arquitectura)  

Este documento define las convenciones, directivas inviolables, arquitectura y arneses de calidad que **todo agente autónomo (Jules, Fred, Jules VM, Sentinel, etc.)** DEBE respetar al operar en este repositorio.

---

## 🌐 1. PANORAMA ARQUITECTÓNICO
* **Frontend:** React 18 SPA impulsado por Vite y Tailwind CSS (`src/`).
  - Chat conversacional con IA multimodal (texto, dictado por voz y captura de fotos).
  - Venta Manual POS con atajos rápidos y métodos de pago táctiles (Efectivo, Tarjeta, Transferencia).
  - Monitoreo en tiempo real (`MonitorDashboardView`), Cola de Producción (`ProductionManagementView`), Cierre de Caja (`CashClosingView`), Gestión de Eventos y Usuarios.
* **Backend:** Node.js (ESM) con Express (`server/`).
  - Servicios desacoplados de dominio (`server/services/sales/`, `server/services/catalog/`, `server/services/ai/`).
  - Enrutamiento estructurado en `server/routes/apiRoutes.js`.
* **Base de Datos & ORM:** PostgreSQL en VPS Dokploy dedicado (`145.223.120.56:3000`), administrado con Prisma ORM (`prisma/schema.prisma`).
* **Núcleo de IA Multimodal:**
  - Pool rotativo de API Keys de Google Gemini (`server/services/geminiPoolService.js`).
  - Orquestador de chat en streaming SSE con Function Calling y Closed-Loop (`/api/ai/chat`).
  - Reconocimiento de arte visual por foto (`/api/ai/recognize-artwork`).
  - Venta asistida por voz ferial (`/api/ai/voice-sale`).

---

## 🛡️ 2. PROTOCOLOS INVIOLABLES DE DEKO LABS

### 🚫 A. Prohibición Absoluta del Dogma de las 200 Líneas (Cohesión sobre Espagueti)
* **Prohibido el micro-despiece ciego:** Queda terminantemente prohibido proponer o forzar la fragmentación de archivos con alta cohesión únicamente por superar 200 líneas.
* **La Regla de Oro:** Dividir archivos sanos produce "código ravioli" (indirecciones artificiales e infierno de imports) que destruye la mantenibilidad del sistema.
* **Fuente de Verdad Única:** La única autoridad técnica para validar techos de código es la matriz `DOMAIN_CEILINGS` en [`scripts/audit-monoliths.js`](file:///c:/Users/sebas/Documents/Antigravity%20Files/Modulo_Ventas/scripts/audit-monoliths.js):
  - `server/services/semantic/entityAliases.js` (Techo: **600 líneas** — Diccionario declarativo de cultura pop).
  - `server/services/geminiPoolService.js` (Techo: **350 líneas** — Máquina de estados para rotación de API keys).
  - `server/routes/apiRoutes.js` (Techo: **300 líneas** — Manifiesto central lineal de rutas de la API).
  - `server/controllers/authController.js` (Techo: **300 líneas** — Flujo lineal Google OAuth y JWT).
  - `server/services/ai/aiToolsService.js` (Techo: **280 líneas** — Declaraciones de Function Calling).
* Solo se considera deuda monolítica un archivo que mezcle capas incompatibles (ej. I/O en vistas, formateo HTML en modelos) o que genere condiciones de carrera.

### 🧱 B. Aislamiento Sagrado e Inviolable de Infraestructura
* Cada proyecto vive en su propio contenedor Docker, con su propio PostgreSQL dedicado y sus propios volúmenes en Dokploy.
* Queda terminantemente prohibido conectar, consultar o mutar esquemas o bases de datos de otros proyectos (como la tienda web externa).

### 🔒 C. Seguridad Zero-Trust
* Prohibido hardcodear correos electrónicos reales en el código de producción.
* Prohibido incluir bypasses de autenticación en controladores o middlewares (`devUser`, `x-dev-role`).
* Zod valida de forma estricta todas las variables de entorno en el arranque (`server/config/env.js`).

### 🎯 D. Frontera Dura de Catálogo y Cero ToolCalls Fantasma
* Bajo ninguna circunstancia el asistente de IA puede inventar productos, tamaños o precios que no existan en el catálogo físico.
* Obras de música (`MUSICA`) son exclusivas en formato `PORTADA_ALBUM` (30×30 cm a Q55.00) y jamás deben emitir un `prepareSaleDraft` con tamaños estándar.
* Ante cancelaciones del cliente, el closed-loop debe purgar el borrador de forma atómica (`draftSale: null`).

### 👁️ E. Protocolo Coercitivo Post-Despliegue y Auditoría Panóptica 360°
* **Veto Absoluto de Localhost:** Queda TERMINANTEMENTE PROHIBIDO presentar capturas de `localhost` en reportes post-despliegue. Solo es válida la URL oficial de producción (`https://ventas.decovintage.online`) con sesión autenticada.
* **Ciclo de Despliegue de 8 Pasos:** El despliegue oficial (`npm run deploy`) no termina al ver HTTP 200 en `/health` de Dokploy; exige completar los pasos adicionales post-despliegue:
  1. *Paso 1:* Puerta de calidad local (`npm run harness:check`).
  2. *Paso 2:* Push a `origin/main`.
  3. *Paso 3:* Disparo de Webhook en Dokploy VPS.
  4. *Paso 4:* Polling criptográfico de reinicio de contenedor (`gitCommit` y uptime fresco).
  5. *Paso 5:* Verificación mecánica E2E de salud, sesión JWT, evento activo y catálogo (`npm run verify:prod`).
  6. *Paso 6:* Navegación en vivo con Chrome DevTools en `https://ventas.decovintage.online` e inyección de auth (`DEVTOOLS_AUTH_SNIPPET`). Interacción real en el canal sin bypasses.
  7. *Paso 7:* Análisis Forense Panóptico 360° de Evidencias (Sin Sesgo de Confirmación).
  8. *Paso 8:* Compuerta de Decisión: Certificación de Entrega o Registro de Hallazgo para Fred.
* **Los 5 Pilares del Análisis Forense 360° de Evidencias:**
  1. *Montaje Integral vs. "Bien Montado":* No basta con que el componente aparezca; debe estar completamente operativo, con controles táctiles $\ge 44\text{px}$ y botones reactivos respondiendo en vivo.
  2. *Fidelidad Estricta a la Especificación & Cero Alucinaciones:* Respeto milimétrico al requerimiento pactado (ej. si se acordó Podio Top 3, deben haber estrictamente 3 puestos con sus 3 medallas; un 4to o 5to puesto sin medalla o un texto contradictorio es un defecto inaceptable).
  3. *Veracidad Contable y Datos Reales (Ground Truth vs. DB):* Las cifras y subtotales en pantalla deben coincidir con la realidad de PostgreSQL, descartando fórmulas sintéticas arbitrarias.
  4. *Visión Panóptica Sin Sesgo de Confirmación:* Prohibido el sesgo de túnel (mirar solo la métrica y desentenderse del resto). Se audita la cabecera, el chat, el panel de borrador, el layout y las alertas globales.
  5. *Protocolo de Cero Auto-Encubrimiento y Separación de Roles:* Gary audita con rigor forense e identifica hallazgos; Fred & Engineering Squad ejecutan las cirugías en el código. Si se detecta cualquier falla, Gary **TIENE TERMINANTEMENTE PROHIBIDO** parchar código a escondidas; debe redactar el Hallazgo Forense y despacharlo a Fred.

---

## ⚡ 3. COMANDOS CLAVE DE DESARROLLO Y ARNÉS DE CALIDAD

Todo cambio introducido debe ser verificado ejecutando los siguientes comandos en la terminal:

```bash
# 1. Compilación de producción Vite
npm run build

# 2. Suite de seguridad Zero-Trust
npm run test:security

# 3. Auditoría de secretos y correos planos
npm run audit:secrets

# 4. Auditoría de monolitos y techos de dominio
npm run audit:monoliths

# 5. Compuerta de Calidad Maestra (Debe pasar 100% verde antes de cualquier PR)
npm run harness:check

# 6. Verificación E2E y Arnés Anti-Pereza en Producción
npm run verify:prod
```

---

## 📋 4. RECOMENDACIONES PARA PRs Y REPORTES DE JULES
1. **Ejecución en VM:** Corre siempre `npm run harness:check` antes de finalizar cualquier tarea o Pull Request.
2. **Claridad Forense:** Explica la causa raíz de cualquier cambio propuesto; evita parches superficiales o envoltorios innecesarios.
3. **Ergonomía de Mostrador:** Recuerda que este software corre en pantallas táctiles de ferias masivas (los botones y controles deben tener una superficie de contacto táctil de al menos 44×44px).
