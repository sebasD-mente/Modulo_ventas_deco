---
trigger: always_on
description: "Arnés de calidad DeKo Labs para STAND {IA} (Modulo_Ventas): Doctrina Anti-Ravioli (DOMAIN_CEILINGS), Zero-Leak Guard, aislamiento Zero-Trust y compuerta npm run harness:check."
---

# 🛡️ ARNÉS DE CALIDAD DEKO LABS (OBLIGATORIO PARA FRED Y SUBAGENTES)

Este documento rige estrictamente para todo desarrollo, refactorización o corrección en STAND {IA} (Modulo_Ventas).

---

## 1. 🍝 Doctrina Anti-Ravioli y Techos Dinámicos por Dominio (`DOMAIN_CEILINGS`)
* **Prohibición Expresa del Dogma de las 200 Líneas:** Queda TERMINANTEMENTE PROHIBIDO fragmentar archivos con alta cohesión de dominio únicamente por superar 200 líneas o crear micro-archivos huérfanos (< 80 líneas) para evadir linters.
* **Techos por Capa Autorizados (`LAYER_DEFAULT_CEILINGS` y `DOMAIN_CEILINGS` en `scripts/audit-monoliths.js`):**
  - Diccionarios semánticos y cultura pop (`server/services/semantic/`): **800 a 1,000 líneas**.
  - Servicios de dominio transaccional (`server/services/`): **500 líneas**.
  - Manifiestos de rutas e infraestructura (`server/routes/`, `server/index.js`, `src/App.jsx`): **450 a 500 líneas**.
  - Controladores REST (`server/controllers/`) y Hooks/Contextos (`src/**/hooks/`, `src/context/`): **350 líneas**.
  - Componentes UI React (`src/components/`): **280 líneas**.
* Solo se descompone un archivo cuando mezcla capas incompatibles (ej. consultas SQL/Prisma dentro de vistas React).

---

## 2. 🔑 Cero Hardcodeo de Credenciales y URLs (Zero-Leak Guard)
* NUNCA escribir claves de API (`AIzaSy...`, `sk-...`), contraseñas o tokens en el código fuente.
* NUNCA hardcodear URLs absolutas o IPs de infraestructura externa (`145.223.120.56` está terminantemente prohibida).
* Todo acceso a configuración DEBE realizarse a través de `server/config/env.js`.

---

## 3. 🛡️ Protocolo de Aislamiento Inviolable (Zero-Trust)
* La inspección de otros repositorios en el workspace es **estrictamente de solo lectura**.
* Queda terminantemente prohibido extraer, clonar o transportar claves o datos de otros proyectos sin aprobación explícita de Sebastian.

---

## 4. ⚡ Comando Universal de Aprobación
Antes de reportar cualquier tarea como completada al Director Creativo:
1. Ejecutar en terminal: `npm run harness:check`
2. El comando ejecuta en cadena:
   - `npm run test:security` (Suite de seguridad Zero-Trust)
   - `npm run audit:secrets` (Escáner anti-fugas de credenciales)
   - `npm run audit:monoliths` (Auditoría de tamaños de archivo)
   - `npm run build` (Compilación de producción libre de errores)
3. **Regla de Cierre:** Si cualquiera de estos pasos falla, Fred DEBE auto-corregir el error antes de presentar la entrega.
