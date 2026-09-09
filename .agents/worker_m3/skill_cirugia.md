---
name: cirugia-arquitectura-cero-deuda
description: Protocolo quirúrgico estricto de ingeniería, despacho de prompts blindados y erradicación de parches superficiales para Deco Vintage y Deko Labs.
---

# 🛡️ PROTOCOLO QUIRÚRGICO DE INGENIERÍA Y DESPACHO DE PROMPTS (CERO DEUDA TÉCNICA)

Este protocolo es de cumplimiento obligatorio para todo agente, subagente o instrucción de desarrollo:

---

## 1. 📋 Estructura de Prompts Quirúrgicos
Todo prompt emitido para el **Agent IDE** o para **Jules** DEBE contener obligatoriamente:
1. **Objetivo Único y Aislado:** Una sola modificación atómica por intervención.
2. **Archivos Exactos y Líneas:** Rutas absolutas/relativas exactas sin ambigüedades.
3. **Restricciones y Prohibiciones Explícitas:** Qué está terminantemente prohibido alterar (contratos de React, nombres de propiedades, esquemas no relacionados).
4. **Criterios de Aceptación Técnicos:** Condiciones medibles para validar la solución.
5. **Protocolo de Verificación:** Pasos obligatorios de prueba antes de dar por cerrada la tarea.

---

## 2. 🚫 Prohibición Total de Parches o "Trucos" de Código
* **Causa Raíz Obligatoria:** Si un problema proviene de Docker, de PostgreSQL, de permisos de Linux o de Dokploy, **SE RESUELVE EN LA INFRAESTRUCTURA O EN LA CONFIGURACIÓN REAL**.
* **Cero Hacks en Código:** Queda terminantemente prohibido introducir *workarounds*, *polyfills* innecesarios, *try-catches* ciegos que silencien errores, o código espagueti para esquivar problemas de entorno.
* **Integridad de Contratos:** El backend debe adaptarse a los estándares de arquitectura limpios sin romper el contrato JSON que el frontend consume.

---

## 3. 🧭 Cero Cabos Sueltos y Verificación en Vivo
* Cada cambio debe auditar la memoria, el Event Loop y la base de datos.
* Toda entrega debe contar con comprobación activa en navegador real vía Chrome DevTools MCP.
