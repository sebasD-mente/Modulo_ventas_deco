# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-019` Completada y Verificada)
- **Tareas completadas:** `feat-000` a `feat-019` (`done`).
- **Siguiente tarea planificada en cola DAG:** Ninguna pendiente (`WIP = 0`).
- **Última verificación ejecutada:** `Modo Diario Ágil` (`38/38` `feat-019 + surgery-059/061` PASS, `265/265` unit tests PASS, `53/53` voice tests PASS, `npm run harness:check` `HARNESS_PASS`, `bash ./init.sh` `100/100`).

---

## Alcance Incluido (`In-Scope`) para `feat-019`

1. **Nueva Casilla de Edición de Diseño debajo de los Diseños del Pedido (`src/components/manual-sale/DesignEditionPanel.jsx` + `src/components/FastManualSaleForm.jsx`)**:
   - Crear el componente `src/components/manual-sale/DesignEditionPanel.jsx` (`<= 140` líneas) y montarlo en la rama `REDES_PERSONALIZADO` de `FastManualSaleForm.jsx` **inmediatamente debajo de `<SaleCartList />` e inmediatamente arriba de `<DeliveryMethodSelector />`**.
   - **Diseño e Inputs**:
     - Tarjeta limpia acorde al formulario (`p-4 rounded-2xl bg-black border border-neutral-800 text-xs space-y-3`), con cabecera de icono minimalista de `lucide-react` (p. ej. `PenTool` o `Type`, cero emojis redundantes y cero clases `amber-*` / `orange-*`), título **`Edición de Diseño (Opcional)`** y badge derecho `+ Q {effectiveEditionCost.toFixed(2)}` cuando `effectiveEditionCost > 0`.
     - **Campo 1 — `Descripción de la edición`**: `<input type="text" ... placeholder="Ej. Se agregaron letras en la esquina inferior" className="... min-h-[44px] ..." />`.
     - **Campo 2 — `Costo de la edición (Q)`**: `<input type="number" min="0" step="any" ... placeholder="0.00" className="... min-h-[44px] font-mono ..." />`.

2. **Suma Reactiva al Total del Pedido y Desglose Visual (`useRemoteSaleForm.js`, `RemoteQuoterSummary.jsx` y `WhatsAppQuoteShareModal.jsx`)**:
   - **En `src/components/manual-sale/hooks/useRemoteSaleForm.js` (`<= 350` líneas estrictas)**:
     - Añadir estados `editionDescription` (`''`) y `editionCost` (`''`).
     - Calcular `effectiveEditionCost = Math.max(0, Number((Number(editionCost) || 0).toFixed(2)))`.
     - Sumar `effectiveEditionCost` a `totalAmount`:
       `totalAmount = Number((productsAmount + effectiveEditionCost + effectiveShippingCost).toFixed(2))`
       *(Esto actualiza automáticamente `balanceDue`, `isDepositValid` y el botón de `100%` en `RemoteQuoterSummary.jsx`)*.
     - Si `effectiveEditionCost > 0 && !editionDescription.trim()`, mostrar validación preventiva clara en `confirmRemoteSale` (`'Ingresa la descripción de la edición realizada (ej. letras o retoque aplicado).'`).
     - Incluir `editionDescription: editionDescription.trim() || null` y `editionCost: effectiveEditionCost` en el `payload` enviado a `POST /api/sales/remote`, y limpiar ambos estados (`setEditionDescription('')`, `setEditionCost('')`) tras registrar la venta.
   - **En `src/components/manual-sale/RemoteQuoterSummary.jsx` (`<= 350` líneas estrictas)**:
     - Recibir `effectiveEditionCost = 0` (y opcionalmente `editionDescription = ''`).
     - En el bloque `Desglose Contable de la Orden`, cuando `effectiveEditionCost > 0`, mostrar la fila:
       `Edición de diseño:` -> `Q {effectiveEditionCost.toFixed(2)}` justo antes de `Envío / Flete:` y `Total de la Orden:`.
   - **En `src/components/manual-sale/WhatsAppQuoteShareModal.jsx`**:
     - Si la venta registrada incluye edición (leída desde `sale.editionCost` / `sale.editionDescription` o extraída del sello `[Edición (+Q ...): ...]` en `sale.notes`), mostrar la línea correspondiente de edición en el resumen de WhatsApp para que cuadre al centavo con `Total de la Orden`.

3. **Validación Zod y Persistencia Backend sin Alterar `prisma/schema.prisma` (`server/validators/remoteSaleValidators.js` + `server/services/sales/remoteSaleService.js`)**:
   - **En `server/validators/remoteSaleValidators.js` (`createRemoteSaleSchema`)**:
     - Añadir `editionDescription: z.string().trim().max(300, 'La descripción de la edición no puede exceder 300 caracteres').optional().nullable()` y `editionCost: z.number().nonnegative('El costo de edición no puede ser negativo').optional().default(0)`.
   - **En `server/services/sales/remoteSaleService.js` (`createRemoteSaleTransaction`)**:
     - Calcular `const editionCost = Math.max(0, Number(Number(data.editionCost || 0).toFixed(2)));` y `const editionDescription = typeof data.editionDescription === 'string' ? data.editionDescription.trim() : '';`.
     - Si `editionCost > 0 && !editionDescription`, lanzar error `400` (`'La descripción de la edición es obligatoria cuando se cobra un costo de edición.'`).
     - Sumar `editionCost` al total de la venta:
       `const totalAmount = Number((productsAmount + editionCost + shippingCost).toFixed(2));`
     - **PROHIBIDO crear un `SaleItem` ficticio para la edición** (evita ensuciar la cola de impresión de Taller con un póster inexistente y mantiene intacto el cálculo de comisión del 20% sobre `sale.items` en `commissionService.js`). En cambio, cuando `editionCost > 0 || editionDescription`:
       1. Estampar de forma legible en `sale.notes`: `[Edición (+Q ${editionCost.toFixed(2)}): ${editionDescription || 'Edición personalizada'}]` (concatenado limpiamente con `data.notes` si existe).
       2. Estampar en `productionNotes` de cada ítem de `itemsData`: `editionDescription ? \`[Edición]: \${editionDescription}\` : null` (preservando `item.productionNotes` si viniera definido), de modo que `ProductionOrderCard.jsx` muestre automáticamente la indicación de edición en Taller.
       3. Registrar `editionCost` y `editionDescription` en `auditLog.create` (`details`) y devolver `editionCost` / `editionDescription` en el objeto retornado por `createRemoteSaleTransaction`.

4. **Guardarraíles Críticos de Arquitectura y Suites Existentes**:
   - **Orden estricto en `FastManualSaleForm.jsx` (`surgery-059` test `2.1`)**: `<SaleCartList` -> `<DesignEditionPanel` -> `<DeliveryMethodSelector` -> `<RemoteQuoterSummary` (`cartIdx < deliveryIdx < quoterIdx`).
   - **No alterar numeración de pasos 3 y 4 (`surgery-059` test `4.2`)**: mantener intactos `'<span>3. Método de Entrega & Logística</span>'` en `DeliveryMethodSelector.jsx` y `'<span>4. Cotizador & Registro de Anticipo</span>'` en `RemoteQuoterSummary.jsx`.
   - **Techos estrictos de líneas (`surgery-059`, `surgery-061`, `surgery-066`)**:
     - `src/components/FastManualSaleForm.jsx <= 350` líneas (actualmente `332L`).
     - `src/components/manual-sale/hooks/useRemoteSaleForm.js <= 350` líneas (actualmente `341L`: **¡atención!** compactar declaraciones multi-línea o extraer helper puro para no pasar de `350L`).
     - `src/components/manual-sale/RemoteQuoterSummary.jsx <= 350` líneas (actualmente `315L`).
     - `src/components/manual-sale/DesignEditionPanel.jsx <= 280` líneas.
   - **Ergonomía táctil `>= 44px`**: todo `<input>` y `<button>` en `DesignEditionPanel.jsx` debe tener `min-h-[44px]`.
   - **Estética limpia**: cero clases `amber-*` / `orange-*`, cero emojis redundantes en botones y `0 CRLF`.
   - **Suite nueva dedicada**: crear `tests/sales/remote-sale-design-edition.test.js` verificando aritmética frontend/backend (`productsAmount + editionCost + shippingCost`), validación cuando falta descripción con costo `> 0`, persistencia en `sale.notes` y `SaleItem.productionNotes` sin crear `SaleItem` fantasma, e invarianza de `calculateSaleProductBase` en comisiones.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma`.
- Cero cambios en el modo presencial de mostrador (`POS_FERIA`).
