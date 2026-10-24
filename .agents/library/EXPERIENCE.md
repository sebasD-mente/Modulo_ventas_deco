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
