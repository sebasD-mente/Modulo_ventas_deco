# 🔒 PROTOCOLO DE AISLAMIENTO INVIOLABLE Y CUARENTENA DE SECRETOS (ZERO-TRUST)

Este protocolo es de cumplimiento obligatorio para todo agente o subagente en STAND {IA}.

---

## 1. 👁️ Modo de Inspección: "Solo Lectura Contemplativa"
* Puedes leer e inspeccionar otros repositorios para entender el estándar de Deko Labs.
* **PROHIBICIÓN ABSOLUTA:** Queda terminantemente prohibido extraer, copiar, clonar, transportar o duplicar cualquier fragmento de código, lógica o credencial desde otro proyecto hacia este repositorio.

---

## 2. 🚫 Cuarentena de Secretos y Cero Reutilización de Claves
* **Cada proyecto es una isla independiente:** Ninguna aplicación puede compartir claves de Gemini API, contraseñas de PostgreSQL, Service Accounts de Google Cloud ni tokens JWT con otra aplicación.
* Si un agente encuentra una clave funcional en otro proyecto, **TIENE PROHIBIDO USARLA O COPIARLA**.

---

## 3. 🛑 Freno de Mano y Justificación Obligatoria
Si un agente considera que una lógica de otro proyecto debe ser reutilizada:
1. **DETENERSE INMEDIATAMENTE.**
2. **SOLICITUD FORMAL A SEBASTIAN:** Explicar qué se desea reutilizar, por qué se requiere, el impacto esperado y el riesgo de acoplamiento.
3. **Esperar Aprobación Expresa:** Sin aprobación explícita, se implementa una solución desacoplada desde cero.
