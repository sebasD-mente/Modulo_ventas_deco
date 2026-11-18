# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-017` Completada y Verificada)
- **Tareas recientes completadas:** `feat-013`, `feat-014`, `feat-015`, `feat-016` y `feat-017` (`done`).
- **Siguiente tarea planificada en cola DAG:** Ninguna pendiente (`feat-000..017` en `done`).
- **Marcha de trabajo ejecutada:** `Modo Diario Ágil` (`WIP = 1` -> verificación en 3 puertas `bash ./init.sh` `100/100` -> cierre limpio `WIP = 0`).

---

## Alcance Incluido (`In-Scope`) para `feat-017`

1. **Anticipo Libre sin Restricción del 50% + Solo Campo de Anticipo y Botón `100%` (`RemoteQuoterSummary.jsx`, `useRemoteSaleForm.js`, `remoteSaleService.js`, `BalancePaymentModal.jsx`)**:
   - **Frontend (`useRemoteSaleForm.js`)**:
     - Eliminar el `useEffect` que pre-rellenaba automáticamente `depositInput` con el 50% (`minDeposit`), dejando `depositInput` inicialmente vacío (`''` -> `numericDeposit = 0`) para que el vendedor ingrese libremente el monto real cobrado o pulse el botón `100%`.
     - Actualizar `isDepositValid` a `totalAmount > 0 && (isPendingPaymentOnly || (numericDeposit > 0 && numericDeposit <= totalAmount + 0.01))`.
     - En `confirmRemoteSale`, retirar el bloqueo `if (numericDeposit < minDeposit)` y validar únicamente que en modo `Con Anticipo` el valor sea `> 0` y `<= totalAmount + 0.01`.
   - **Frontend (`RemoteQuoterSummary.jsx`)**:
     - Retirar el botón `50% Anticipo`, el indicador `Mínimo 50%: Q ...`, el bloque ámbar `isInsufficient` (`"Anticipo insuficiente..."`) y el texto `(mínimo 50% = Q ...)` dentro de `Pendiente Pago`.
     - Dejar únicamente el campo numérico para ingresar el anticipo cobrado y el botón de `100%` (`setDepositInput(totalAmount.toString())`), cambiando el mensaje de estado válido parcial a `"Anticipo registrado"` + `"Saldo pendiente: Q ..."`.
   - **Backend (`server/services/sales/remoteSaleService.js`) y Modal de Anticipo Diferido (`BalancePaymentModal.jsx`)**:
     - En `createRemoteSaleTransaction`: retirar la compuerta que rechazaba con `HTTP 400` pagos menores al 50% (`paymentsTotal < requiredDeposit && paymentsTotal < minProductDeposit`), aceptando cualquier anticipo positivo (`paymentsTotal > 0` y `<= totalAmount + 0.01`), marcando `ANTICIPO_PAGADO` cuando `< totalAmount` o `PAGADO_TOTAL` cuando `>= totalAmount` y enviando los ítems a `A_PRODUCCION`.
     - En `registerBalancePayment` (rama `isPendingPayment`) y `BalancePaymentModal.jsx`: retirar igualmente el tope mínimo del 50% al acreditar el primer anticipo sobre una orden previamente guardada como `PENDIENTE_PAGO` (dejando solo el botón de `100%` y el campo libre `> 0`).

2. **Retiro de Iconos a Color Redundantes (Doble Icono) y Centrado de Texto en Botones (`RemoteQuoterSummary.jsx`, `FastManualSaleForm.jsx`, `WhatsAppQuoteShareModal.jsx`, `BalancePaymentModal.jsx`)**:
   - En `RemoteQuoterSummary.jsx`, quitar todos los emojis/iconos a color redundantes de los botones (`⚡` en `Con Anticipo`, `⏳` en `Pendiente Pago`, `💯` en `100%`, `🔍` en `Verificar Boleta (OCR)`), conservando únicamente los iconos minimalistas de `lucide-react` (`Zap`, `Clock`, `CheckCircle2`, `Smartphone`, `Banknote`, `CreditCard`, `Search`, `Upload`) y asegurando alineación y texto debidamente centrado (`flex items-center justify-center gap-1.5 text-center`).
   - Limpiar también los dobles iconos del flujo de Nueva Venta de Redes: retirar `📱` junto a `<Smartphone />` en la cabecera de `FastManualSaleForm.jsx` (y actualizar el subtítulo `'Venta remota con anticipo 50/50, CRM y logística'` por `'Venta remota, registro de anticipo, CRM y logística'`), retirar `📲`, `✅` y `📋` junto a `<Smartphone />`, `<Check />` y `<Copy />` en `WhatsAppQuoteShareModal.jsx`, y retirar `⚡` / `💯` en `BalancePaymentModal.jsx`.

3. **Etiqueta Correcta del Campo: `Valor del anticipo` (`RemoteQuoterSummary.jsx`)**:
   - Eliminar el título `"Monto ingresado por el cliente (Q):"` (y el encabezado duplicado `"Monto de Anticipo a Registrar"`) y colocar como título exacto del campo **`Valor del anticipo`**.

4. **Texto del Botón que Finaliza la Venta: `Registrar Venta (abono Q 0.00)` (`RemoteQuoterSummary.jsx`)**:
   - Eliminar el texto `"Registrar Pedido 50/50..."` / `"Registrar Pedido..."` en el botón primario de confirmación y mostrar **`Registrar Venta (abono Q ${numericDeposit.toFixed(2)})`** (de modo que en estado inicial `0` se lea exactamente `Registrar Venta (abono Q 0.00)` y al escribir un anticipo o pulsar `100%` refleje el monto exacto abonado; y en estado `isSubmitting` mostrar `'Registrando venta...'`).

5. **Nuevo Pie de Página Global en el Sitio (`src/App.jsx` y `src/components/LoginView.jsx`)**:
   - Sustituir el texto del `<footer>` global en `src/App.jsx` (e incorporarlo de forma consistente en `src/components/LoginView.jsx` y en la vista informativa de vendedor sin stand en `src/App.jsx`) por:
     **`Desarrollado por Sebastian Jimenez / Deko Labs Todos los Derechos Reservados 2026`**.

6. **Guardarraíles de Suites Existentes**:
   - Preservar en `RemoteQuoterSummary.jsx` las cadenas de clases auditadas estáticamente por `tests/adversarial/surgery-061-ui-shipping-clean-colors-custom-modal.test.js`:
     - `'bg-white text-black border-white shadow-sm font-bold'`
     - `'bg-neutral-900 text-neutral-300 border-neutral-800 hover:text-white'`
     - `'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'`
   - Preservar en `RemoteQuoterSummary.jsx` el encabezado `'<span>4. Cotizador & Registro de Anticipo</span>'` y mantener `RemoteQuoterSummary.jsx <= 350` líneas y `FastManualSaleForm.jsx <= 350` líneas (`tests/adversarial/surgery-059-ui-polish-header-order-sync-camera.test.js` y `tests/adversarial/surgery-066-voice-catalog-search.test.js`).
   - Preservar en `remoteSaleService.js` las trazas forenses de `registerBalancePayment` (`[Saldo Q`, `cobrado por:`, `collectorName`, `collectorRole`, `SALDO_VENTA_COBRADO`) auditadas por `tests/adversarial/surgery-056-permanent-pos-and-pickup-accounting.test.js`.
   - Mantener ergonomía táctil `min-h-[44px]` / `min-h-[48px]` en todos los controles interactivos y `0 CRLF` en todos los archivos tocados.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma`.
- Cero cambios en la lógica de ventas presenciales de mostrador (`POS_FERIA` / `PaymentSummaryBar.jsx`) ni en el descuento del 50% de material `VINILO_SOLO` en `CustomItemModal.jsx`.
