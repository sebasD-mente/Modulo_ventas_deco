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
```

---

## 📋 4. RECOMENDACIONES PARA PRs Y REPORTES DE JULES
1. **Ejecución en VM:** Corre siempre `npm run harness:check` antes de finalizar cualquier tarea o Pull Request.
2. **Claridad Forense:** Explica la causa raíz de cualquier cambio propuesto; evita parches superficiales o envoltorios innecesarios.
3. **Ergonomía de Mostrador:** Recuerda que este software corre en pantallas táctiles de ferias masivas (los botones y controles deben tener una superficie de contacto táctil de al menos 44×44px).
