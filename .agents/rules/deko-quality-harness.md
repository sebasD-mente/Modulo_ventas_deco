# 🛡️ ARNÉS DE CALIDAD DEKO LABS (OBLIGATORIO PARA FRED Y SUBAGENTES)

Este documento rige estrictamente para todo desarrollo, refactorización o corrección en STAND {IA} (Modulo_Ventas).

---

## 1. 🚫 Regla Antimonolito Estricta
* **Límite Absoluto para Archivos Nuevos o Refactorizados:** NINGÚN archivo nuevo o refactorizado puede superar las **200 líneas de código**.
* **Límite de Componentes:** NINGÚN componente nuevo puede superar las **50-60 líneas**.
* **Plan de Reducción de Deuda:** Los archivos legados existentes (`aiMultimodalService.js`, `UnifiedAiChat.jsx`, `EventsManagementView.jsx`) deben ser descompuestos en submódulos pequeños y NUNCA se les debe añadir más código monolítico.
* Si una funcionalidad crece:
  1. Extraer la lógica a hooks o submódulos en `src/hooks/` o `src/components/features/`.
  2. Extraer herramientas y prompts a `server/services/ai/`.

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
