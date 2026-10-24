# Modulo_Ventas (STAND {IA}) — Accumulated Project Experience (Google Harness²)

> Memoria técnica acumulativa de **Modulo_Ventas / STAND {IA}**. Todo agente DEBE consultar este archivo antes de intervenir el código y registrar nuevas lecciones verificadas con bloques `<experience>`.

<experience>
cue: Creación o modificación de vistas React, borradores de venta (draftSale), eventos feriales o modales de cobro
lesson: Todo estado en contenedores padres (App.jsx) debe conectarse bidireccionalmente con los componentes hijos mediante callbacks reales (onRefresh, onSaleRegistered, onEventsChanged) para actualizar el DOM sin recargar con F5. Todo componente que dependa de eventId o saleId debe incluir guarda defensiva fail-fast para evitar peticiones a /api/events/undefined.
evidence: Auditoría de DOM interactivo en Chrome DevTools MCP y pruebas de integración de flujo POS.
confidence: high
</experience>

<experience>
cue: Procesamiento de órdenes por voz o texto en el vendedor STAND {IA} y límite de catálogo (Hard Product Boundary)
lesson: Si el cliente solicita productos fuera del giro de pósters y cuadros decorativos, el backend NUNCA debe forzar coincidencias en draftSale (debe retornar draftSale: null y segregar en unmatchedItems). Asimismo, las dimensiones de cada obra deben validarse contra la base de datos real (ej. portadas de álbum cuadradas 30x30 cm no tienen tamaño Mediano ni Grande) y los modismos guatemaltecos ("pisto", "cabal", "en billete") deben mapearse a Efectivo.
evidence: Batería adversaria de Valkyria sobre /api/ai/voice-sale y /api/ai/chat.
confidence: high
</experience>

<experience>
cue: Cálculos monetarios en carrito, descuentos y botones de interfaz POS en mostrador ferial
lesson: Todo control táctil debe medir al menos 44x44px (min-h-[44px] min-w-[44px]) y todo cobro debe cuadrar exactamente al centavo de Quetzal: (cantidad * precioUnitario) - descuento === total.
evidence: Estándar de ergonomía ferial y pruebas unitarias financieras en npm run harness:check.
confidence: high
</experience>

<experience>
cue: Edición de ítems de una venta existente (cambio de diseño de póster en EditSaleModal / saleUpdateService) y selectores de método de pago
lesson: En el backend (saleUpdateService.js), al actualizar un ítem cuya descripción cambió (designChanged) por un póster del catálogo web sin UUID local (productId: null), NUNCA usar `item.productId || existingItem.productId` porque hereda el productId del póster viejo y muestra su miniatura antigua; debe limpiarse `resolvedProductId = null` y persistir `customImageUrl`. En la UI de modales estrechos, separar cada ítem en tarjeta de 2 niveles con `whitespace-nowrap` en montos (`Q25.00`) y usar estado activo blanco (`bg-white text-black border-white`) en todos los selectores de método de pago.
evidence: Cirugía [DEKO-STANDIA-064] y suite unitaria tests/adversarial/surgery-064-ui-sales-edit-design-and-white-selectors.test.js.
confidence: high
</experience>

<experience>
cue: Creación de modales emergentes (.fixed.inset-0), navegación entre pestañas SPA y diseño de tarjetas de eventos
lesson: Toda ventana emergente (modal) en la SPA debe registrarse con `useModalBackHandler(isOpen, onClose)` (de `src/hooks/useSpaBackNavigation.js`) antes de cualquier `return null` temprano para que el botón "Atrás" físico/navegador (`popstate`) cierre primero el modal activo o regrese de pestañas secundarias a la vista principal (`venta`) sin expulsar al usuario fuera del sitio web. En las tarjetas de eventos, mantener densidad compacta (vendedores en 1 fila horizontal y las 4 métricas financieras en una sola franja `UnifiedMetricsStrip`), archivados contraídos por defecto (`showArchivedSection = false`) y cero controles de asignación manual de vendedores en la tarjeta permanente de Redes Sociales.
evidence: Cirugía [DEKO-STANDIA-065] y suite unitaria tests/adversarial/surgery-065-events-compact-cards-and-back-navigation.test.js.
confidence: high
</experience>

