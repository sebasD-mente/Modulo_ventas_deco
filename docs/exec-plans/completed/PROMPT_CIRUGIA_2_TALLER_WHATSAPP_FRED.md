# 🏛️ ORDEN DE TRABAJO — FRED: CIRUGÍA #2 (TALLER DE PRODUCCIÓN & WHATSAPP)
> **Proyecto:** `STAND {IA}` (Deco Vintage Guate — `Modulo_Ventas`)  
> **Emisor:** Gary (CTO & Director de Arquitectura)  
> **Destinatario:** Fred & Engineering Squad  
> **Protocolo:** Cirugía de Arquitectura Cero Deuda Técnica (SKILL: `cirugia-arquitectura-cero-deuda`)  
> **Fase:** Cirugía 2 — Cierre de Circuito en Taller & Comprobante WhatsApp con Arte  

---

## 🎯 1. OBJETIVO ÚNICO Y AISLADO
Habilitar la visibilidad completa del arte personalizado y las especificaciones de taller en la cola de producción (`ProductionOrderCard.jsx` y `AssignItemsToSheetModal.jsx`) permitiendo a los operarios ver la imagen de Google Cloud Storage, distinguir las órdenes con corte especial de madera y abrir el arte en alta resolución para el RIP del plotter, e incorporar el enlace directo al diseño aprobado en el comprobante generado para WhatsApp (`WhatsAppQuoteShareModal.jsx`).

---

## 📁 2. ARCHIVOS EXACTOS Y LÍNEAS DE INTERVENCIÓN

### 1. `src/components/production/ProductionOrderCard.jsx` (Líneas 1-91)
* **Techo arquitectónico:** 280 líneas (actualmente 91 líneas, quedará en ~120 líneas).
* **Importar iconos de Lucide React:** `Package`, `Clock`, `Printer`, `CheckCircle2`, `ExternalLink`, `Scissors`.
* **Modificaciones exactas:**
  1. **Resolución de Arte:**
     ```javascript
     const artUrl = item.customImageUrl || item.product?.imageUrl;
     ```
  2. **Renderizado de Miniatura con Acceso a Alta Resolución:**
     Reemplazar el contenedor de imagen (líneas 27-33) para que, si `artUrl` existe:
     - Renderice `<img src={artUrl} alt={item.description} className="w-full h-full object-cover" loading="lazy" />`.
     - Permita hacer clic o contenga un enlace flotante `<a href={artUrl} target="_blank" rel="noopener noreferrer" className="... min-h-[44px] min-w-[44px] ...">` con `<ExternalLink />` para que el operario abra el arte original en alta resolución en una pestaña nueva.
     - Si no hay `artUrl`, mantener el icono fallback `<Package className="w-6 h-6 text-neutral-600" />`.
  3. **Badges de Taller (Material, Dimensiones y Alerta de Carpintería):**
     Debajo del título y tickets (línea 48):
     - Mostrar las dimensiones: `{item.customDimensions && <span className="text-[11px] font-semibold text-neutral-300">📏 {item.customDimensions}</span>}`.
     - Si el ítem es de corte especial (ej. `item.isCustom` o `item.customDimensions?.includes('Corte Taller')`):
       Mostrar badge ámbar prominente:
       ```jsx
       <span className="bg-amber-950/80 text-amber-300 border border-amber-700/80 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
         <Scissors className="w-3 h-3 text-amber-400" />
         <span>CORTE TALLER</span>
       </span>
       ```
     - Mostrar badge de material: `{item.material && <span className="bg-neutral-800 text-neutral-300 text-[10px] font-bold px-2 py-0.5 rounded-md">{item.material}</span>}`.

---

### 2. `src/components/production/AssignItemsToSheetModal.jsx` (Líneas 193-220)
* **Techo arquitectónico:** 280 líneas (actualmente 260 líneas).
* En la fila del ítem para asignar al pliego (línea 203-210):
  - Si el ítem incluye `"Corte Taller"`, pintar badge visible con icono `<Scissors className="w-3 h-3 text-amber-400" />` para que el operario identifique inmediatamente que esa pieza requiere corte de sierra y no es una medida estándar de pliego.
  - En la miniatura (línea 193-199), envolverla en un enlace `<a href={item.customImageUrl || item.product?.imageUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>` para inspección rápida sin disparar el checkbox.

---

### 3. `src/components/manual-sale/WhatsAppQuoteShareModal.jsx` (Líneas 27-43)
* **Techo arquitectónico:** 280 líneas (actualmente 144 líneas).
* **Enriquecimiento del Mensaje para el Cliente:**
  Modificar la generación de `formattedItems`:
  ```javascript
  const formattedItems = items
    .map((it) => {
      let line = `• ${it.quantity}x ${it.description} — Q ${Number(it.subtotal || 0).toFixed(2)}`;
      if (it.customImageUrl) {
        line += `\n  🖼️ *Arte / Diseño Aprobado:* ${it.customImageUrl}`;
      }
      return line;
    })
    .join('\n');
  ```
  Esto permite que el cliente reciba la URL pública segura de Google Cloud Storage directamente en su WhatsApp para verificar su pedido antes del corte e impresión.

---

## 🚫 3. RESTRICCIONES Y PROHIBICIONES EXPLÍCITAS
- PROHIBIDO alterar controladores de backend o esquemas de base de datos (esta cirugía es puramente frontend en taller y post-venta).
- PROHIBIDO controles táctiles con altura inferior a 44px (`min-h-[44px]` obligatorio).
- PROHIBIDO romper la propagación de eventos: al hacer clic en el enlace de la imagen en `AssignItemsToSheetModal`, usar `e.stopPropagation()` para no seleccionar/deseleccionar el checkbox del pliego por error.
- PROHIBIDO exceder los techos dinámicos establecidos en `scripts/audit-monoliths.js` (Componentes: máx 280 líneas).

---

## 🎯 4. CRITERIOS DE ACEPTACIÓN TÉCNICOS
1. **Cola de Producción:** Cualquier ítem personalizado registrado muestra su arte de GCS, sus dimensiones exactas y el badge `🪚 CORTE TALLER` si es madera/corte especial.
2. **Alta Resolución Operarios:** Los operarios pueden hacer clic en el arte para abrirlo directamente en nueva pestaña (`target="_blank"`), facilitando su descarga para el software del plotter RIP.
3. **WhatsApp del Cliente:** El texto generado incluye el enlace de Google Cloud Storage con el prefijo `🖼️ *Arte / Diseño Aprobado:*`.
4. **Cumplimiento del Arnés:** `npm run build` compila con exit code 0 y `npm run audit:monoliths` reporta 0 violaciones.

---

## 🧪 5. PROTOCOLO DE VERIFICACIÓN
Ejecutar en terminal:
```bash
npm run build
npm run audit:monoliths
```
