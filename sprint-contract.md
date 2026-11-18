# Sprint Contract (Contrato de Ejecución de Tarea — `deko-eventsales`)

Este documento materializa la **Observabilidad de Proceso (Antes de Codificar)**. El Planificador y el Ejecutor (*Maker*) acuerdan el alcance exacto y los criterios verificables de éxito antes de iniciar la implementación, evitando desviaciones de alcance (*Scope Creep*) o interpretaciones ambiguas.

---

## Estado Actual del Contrato (`WIP = 0` — `feat-018` Completada y Verificada en `100/100`)
- **Tareas recientes completadas:** `feat-015`, `feat-016`, `feat-017` y `feat-018` (`done`).
- **Tarea activa en ejecución (`WIP = 0`):** Ninguna (`feat-000..018` en `done`).
- **Última verificación ejecutada:** `Modo Diario Ágil` (`41/41` suites focalizadas PASS, `1/1` `val005` `CustomItemModal` PASS, `265/265` unit tests PASS, `53/53` voice tests PASS, `npm run harness:check` `HARNESS_PASS`, `bash ./init.sh` `100/100 CLEAN STATE`).

---

## Alcance Incluido (`In-Scope`) para `feat-018`

1. **Reinicio Limpio de Estado en `CustomItemModal.jsx` (Solución al bloqueo del 2.º diseño en adelante)**:
   - Como `<CustomItemModal />` permanece montado en `FastManualSaleForm.jsx` (`if (!isOpen) return null;`), implementar una función `resetModalState()` que limpie todos los estados locales (`mode = 'STANDARD'`, `material = 'MDF_5_5MM'`, `selectedSize = null`, `customWidth = ''`, `customHeight = ''`, `unitPrice = ''`, `quantity = 1`, `description = ''`, `uploadedArts = []`, `customImageUrl = ''`, `isUploading = false`, `uploadError = ''`, `showUrlInput = false`, `errorMsg = ''`) y revoque cualquier `blob:` URL temporal (`URL.revokeObjectURL`).
   - Ejecutar `resetModalState()` al confirmar (`handleSubmit`), al cerrar/cancelar (`handleClose` -> `onClose()`) y en `useEffect` cuando `isOpen` cambie a `true`, garantizando que el vendedor pueda abrir `+ Personalizado` 2, 5 o 20 veces seguidas en un mismo pedido con el modal y el selector de archivos 100% limpios.

2. **Subida Múltiple de Imágenes (`multiple`) + Quitar / Reemplazar / Agregar Más Fotos (`src/components/manual-sale/CustomArtUploader.jsx`)**:
   - Extraer la interfaz y lógica de carga de artes personalizados hacia un subcomponente cohesivo `src/components/manual-sale/CustomArtUploader.jsx` (manteniendo `CustomItemModal.jsx` muy por debajo de su techo estricto de `<= 280` líneas).
   - Habilitar `<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" />` y soporte de múltiples archivos en *Drag & Drop* (`Array.from(e.dataTransfer?.files || [])`).
   - Procesar y subir secuencialmente o en paralelo controlado cada imagen seleccionada usando `compressImage(file, 1920, 0.85)` hacia `POST /api/sales/upload-art`, acumulando los resultados en `uploadedArts` (`[{ id, url, previewUrl, name }]`) sin destruir ni ocultar nunca el botón para **seguir agregando más imágenes** (`+ Agregar imagen(es)`).
   - Renderizar una grilla/lista clara de miniaturas cargadas donde cada imagen tenga un botón accesible (`min-h-[44px] min-w-[44px]`) para **quitarla individualmente** si el vendedor seleccionó una foto equivocada, conservando también la opción de ingresar un enlace URL externo manual (Drive, Dropbox, etc.).

3. **Creación Individual por Diseño en el Carrito (`CustomItemModal.jsx` + `useRemoteSaleForm.js`)**:
   - En `handleSubmit` de `CustomItemModal.jsx`:
     - Construir la lista efectiva de artes: las URLs de `uploadedArts` más `customImageUrl.trim()` (si ingresó enlace manual adicional).
     - **Caso 0 o 1 imagen**: invocar `onAddCustomItem` una sola vez (comportamiento idéntico al actual, respetando `quantity`).
     - **Caso $N > 1$ imágenes subidas en el mismo lote**: iterar por las $N$ imágenes e invocar `onAddCustomItem` **1 vez por cada imagen** etiquetando claramente cada obra (ej. `${description.trim()} — Diseño ${idx + 1}/${N}`), con el mismo `material`, `customDimensions`, `unitPrice` unitario, `quantity` por diseño y su propio `customImageUrl`. Así, cada cuadro entra como su propio `SaleItem` independiente al carrito, suma exactamente el total correspondiente, se lista con su link individual en el comprobante de WhatsApp y llega por separado con su foto a la cola de Producción / Taller (`Operario 1` y `Operario 2`).
   - En `addCustomItem` de `src/components/manual-sale/hooks/useRemoteSaleForm.js`:
     - Asegurar que el `id` generado para cada ítem personalizado sea 100% único incluso cuando `addCustomItem` se invoca $N$ veces seguidas dentro del mismo tick síncrono (usando `setCartItems((prev) => [...prev, newItem])` —que ya es funcional y soporta múltiples llamadas en ráfaga— más un contador o sufijo aleatorio robusto).

4. **Guardarraíles Innegociables de Arquitectura y Suites Existentes**:
   - **Techo estricto de líneas (`surgery-061` tests `4.1` y `4.2`)**:
     - `src/components/manual-sale/CustomItemModal.jsx` **DEBE tener `<= 280` líneas**.
     - `src/components/manual-sale/hooks/useRemoteSaleForm.js` **DEBE tener `<= 350` líneas**.
   - **Cadenas exactas obligatorias dentro de `CustomItemModal.jsx` (`surgery-061` tests `3.1..3.6`)**:
     - `const [unitPrice, setUnitPrice] = useState('');`
     - `const [selectedSize, setSelectedSize] = useState(null);`
     - `placeholder="0.00"`
     - `material === m.id ? 'bg-white text-black border-white font-bold shadow-sm' : 'bg-black border-neutral-800 text-neutral-400 hover:text-white'`
     - `mode === 'STANDARD' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'`
     - `mode === 'CUSTOM' ? 'bg-white text-black shadow font-bold' : 'text-neutral-400 hover:text-white'`
     - `bg-emerald-500 hover:bg-emerald-400 text-black font-black flex items-center gap-1.5 transition-colors cursor-pointer shadow-md shadow-emerald-500/20`
   - **Ergonomía táctil `>= 44px` (`val005-sprint3-ergonomics-api-challenger.test.js` test `1.1`)**:
     - Todo `<button>`, `<input>` (salvo `hidden` / `className="hidden"` — ¡ojo! en `val005` el extractor `extractOpeningTags` solo ignora `type="hidden"`, por lo que cualquier `<input type="file" ... />` en `CustomItemModal.jsx` si quedara allí o en `CustomArtUploader.jsx` conviene que incluya `min-h-[44px]` además de `hidden` por defensa en profundidad!) y `<select>` debe incluir `min-h-[44px]` (y `min-w-[44px]` si es botón `rounded-full` sin `w-full`).
   - **Suite nueva dedicada**: crear `tests/sales/custom-item-multi-image-and-reset.test.js` verificando: (a) reinicio completo del modal tras enviar/cerrar para agregar 2+ diseños consecutivos; (b) carga `multiple` y remoción individual de imágenes en `CustomArtUploader.jsx`; (c) creación de $N$ ítems independientes en el carrito con IDs únicos y `customImageUrl` propio al subir $N$ imágenes en lote; y (d) compatibilidad Zod con `createRemoteSaleSchema`.

## Exclusiones Explícitas (`Out-of-Scope`)
- Cero lectura o modificación de `.env`.
- Cero modificaciones en `prisma/schema.prisma` (cada diseño personalizado usa `SaleItem.customImageUrl` ya existente).
- Cero cambios en la lógica de precios o recargos de materiales (`PVC_SURCHARGE`, `WOOD_CUSTOM_CUT_SURCHARGE`, `VINYL_DISCOUNT_FACTOR`).
