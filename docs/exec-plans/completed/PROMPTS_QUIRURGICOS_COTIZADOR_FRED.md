# 🏛️ PROMPTS QUIRÚRGICOS PARA FRED (DIRECTOR DE ARQUITECTURA & SQUAD)
> **Proyecto:** `STAND {IA}` (Deco Vintage Guate — `Modulo_Ventas`)  
> **Emisor:** Gary (CTO & Ingeniero DevOps en Jefe)  
> **Destinatario:** Fred & Engineering Squad  
> **Protocolo:** Cirugía de Arquitectura Cero Deuda Técnica & Aislamiento Estricto  
> **Revisión:** v1.1 — Incorporación de Directivas Comerciales de Sebastián (Corte Especial Q25 & Veto a Presets)

---

## 🎯 RESUMEN DE LA INTERVENCIÓN
Esta intervención implementa la arquitectura oficial del **Cotizador de Pedidos Personalizados** dentro del flujo de trabajo del **Vendedor de Redes** en `Modulo_Ventas`:
1. Pipeline HTTP multipart y almacenamiento en la nube en Google Cloud Storage para artes y fotos personalizadas.
2. Homologación estricta de la matriz oficial de 6 tamaños de Deco Vintage.
3. **Cálculo paramétrico reactivo por $cm^2$ para medidas especiales ($W \times H \times \text{Q } 0.048$) con recargo obligatorio de Q 25.00 por corte especial de taller en madera.**
4. **Erradicación total de presets rápidos (40x50, 50x70, etc.)** para inducir e incentivar la compra de los tamaños oficiales precortados.
5. Reglas comerciales de materiales (MDF base + corte, PVC +Q15, Vinilo Solo 50%).
6. Carga de imágenes interactiva (drag & drop / selector) con preview local e indexación en base de datos para la línea de producción de operarios.

---

## 📦 PROMPT QUIRÚRGICO #1: FASE 1 (BACKEND & PIPELINE GCS)

```markdown
### 📋 ORDEN DE TRABAJO #1 — FRED: ENDPOINT DE SUBIDA DE ARTE PERSONALIZADO A GCS

#### 1. OBJETIVO ÚNICO Y AISLADO
Crear y exponer el endpoint autenticado `POST /api/sales/upload-art` para recibir archivos de imagen en memoria (JPEG, PNG, WebP de hasta 15MB), verificar su firma binaria (magic bytes), persistirlos en Google Cloud Storage mediante `uploadBufferToStorage` bajo la carpeta `custom_orders_arts` y retornar la URL pública definitiva y el nombre del archivo.

#### 2. ARCHIVOS EXACTOS Y LÍNEAS DE INTERVENCIÓN
1. `server/controllers/remoteSaleController.js` (Techo autorizado: 350 líneas, actual: 182 líneas):
   - Importar `uploadBufferToStorage` desde `../services/gcsStorageService.js`.
   - Implementar y exportar la función `uploadCustomArt(req, res)`:
     * Validar que `req.file` exista.
     * Comprobar magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`, WebP: `RIFF....WEBP`).
     * Subir vía `uploadBufferToStorage({ buffer: req.file.buffer, originalname: req.file.originalname, mimetype: req.file.mimetype, folder: 'custom_orders_arts' })`.
     * Retornar HTTP 201 con `{ success: true, url, filename }`.
2. `server/routes/apiRoutes.js` (Sección 6: Ventas, CRM y Métricas):
   - Importar `uploadCustomArt` desde `../controllers/remoteSaleController.js`.
   - Registrar la ruta:
     ```javascript
     router.post(
       '/sales/upload-art',
       requireRole(['SUPER_ADMIN', 'VENDEDOR', 'VENDEDOR_REDES']),
       upload.single('image'),
       uploadCustomArt
     );
     ```

#### 3. RESTRICCIONES Y PROHIBICIONES EXPLÍCITAS
- PROHIBIDO guardar archivos en disco local (cero escritura en `/public/uploads/` o carpetas locales efímeras en el contenedor Docker).
- PROHIBIDO alterar esquemas de Prisma o migraciones existentes (el campo `SaleItem.customImageUrl` ya existe en PostgreSQL).
- PROHIBIDO crear micro-controladores huérfanos (< 80 líneas); la función `uploadCustomArt` pertenece al dominio de `remoteSaleController.js`.
- PROHIBIDO relajar la autenticación; la ruta exige token JWT válido y roles autorizados.

#### 4. CRITERIOS DE ACEPTACIÓN TÉCNICOS
- Validación de Magic Bytes en memoria activa y estricta.
- Persistencia sin estado en GCS (`deko-eventsales-media/custom_orders_arts/`).
- Contrato JSON exacto:
  ```json
  {
    "success": true,
    "message": "Arte subido a Cloud Storage con éxito.",
    "url": "https://storage.googleapis.com/deko-eventsales-media/custom_orders_arts/1726848000-abcd.webp",
    "filename": "custom_orders_arts/1726848000-abcd.webp"
  }
  ```

#### 5. PROTOCOLO DE VERIFICACIÓN
- Ejecutar suite de seguridad: `npm run test:security`
```

---

## 🎨 PROMPT QUIRÚRGICO #2: FASE 2 (FRONTEND — COTIZADOR Y UPLOADER EN `CustomItemModal`)

```markdown
### 📋 ORDEN DE TRABAJO #2 — FRED: COTIZADOR OFICIAL, RECARGO DE CORTE Q25 Y CARGA DE ARTE EN `CustomItemModal.jsx`

#### 1. OBJETIVO ÚNICO Y AISLADO
Homologar la matriz de tamaños oficiales de Deco Vintage y reconstruir el componente `CustomItemModal.jsx` convirtiéndolo en un cotizador de pedidos personalizados para el vendedor de redes. Debe soportar los 6 tamaños estándar oficiales, cálculo paramétrico por cm² para medidas especiales con **recargo obligatorio de Q 25.00 por corte especial de madera**, reglas de materiales, **cero botones de presets rápidos** (para fomentar la compra de medidas precortadas) y cargador interactivo de imágenes directo a GCS con preview local y fallback de URL.

#### 2. ARCHIVOS EXACTOS Y LÍNEAS DE INTERVENCIÓN
1. `src/components/manual-sale/manualSaleConstants.js`:
   - Actualizar `DEFAULT_SIZES` con la matriz oficial estricta de 6 tamaños:
     ```javascript
     export const OFFICIAL_SIZES = [
       { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', anchoCm: 14, altoCm: 21, precio: 25.00, badge: 'Escritorio y coleccionables' },
       { sizeId: 'PEQUENO', nombre: 'Pequeño', dimensiones: '21 x 27 cm', anchoCm: 21, altoCm: 27, precio: 35.00, badge: 'Espacios reducidos y cabeceras' },
       { sizeId: 'PORTADA_ALBUM', nombre: 'Portada de Álbum', dimensiones: '30 x 30 cm', anchoCm: 30, altoCm: 30, precio: 55.00, badge: 'Formato vinilo cuadrado música' },
       { sizeId: 'MEDIANO', nombre: 'Mediano', dimensiones: '30 x 45 cm', anchoCm: 30, altoCm: 45, precio: 65.00, badge: '⭐ El más vendido para habitaciones' },
       { sizeId: 'GRANDE', nombre: 'Grande', dimensiones: '45 x 60 cm', anchoCm: 45, altoCm: 60, precio: 125.00, badge: 'Protagonista para salas y oficinas' },
       { sizeId: 'GIGANTE', nombre: 'Gigante', dimensiones: '60 x 100 cm', anchoCm: 60, altoCm: 100, precio: 210.00, badge: 'Impacto visual monumental' }
     ];
     export const DEFAULT_SIZES = OFFICIAL_SIZES;
     ```
   - Exportar constantes comerciales:
     - `CUSTOM_CM2_RATE = 0.048`
     - `WOOD_CUSTOM_CUT_SURCHARGE = 25.00` // Recargo de taller por cortar tabla fuera de medidas estándar
     - `PVC_SURCHARGE = 15.00`
     - `VINYL_DISCOUNT_FACTOR = 0.50`
     - **PROHIBIDO exportar `CUSTOM_PRESETS` o botones de dimensiones rápidas.**

2. `src/components/manual-sale/CustomItemModal.jsx` (Reemplazo bajo techo de 280 líneas):
   - Importar `useAuth` para consumir `authFetch`.
   - Importar constantes oficiales desde `./manualSaleConstants`.
   - Lucide Icons: `Palette`, `X`, `Plus`, `Upload`, `Image as ImageIcon`, `CheckCircle2`, `Loader2`, `Ruler`, `Sparkles`, `Scissors`.

#### 3. RESTRICCIONES Y PROHIBICIONES EXPLÍCITAS
- **PROHIBIDO colocar botones de presets rápidos (ej. 40x50, 50x70, etc.).** La política de negocio exige que el cliente elija preferentemente tamaños oficiales precortados. En modo personalizado solo deben existir los inputs limpios de `Ancho (cm)` y `Alto (cm)`.
- PROHIBIDO omitir el recargo de Q 25.00 de corte de taller cuando se trate de medida personalizada en madera/MDF.
- PROHIBIDO romper el contrato de `onAddCustomItem`: debe enviar `{ description, material, customDimensions, unitPrice, quantity, customImageUrl }`.
- PROHIBIDO usar medidas inventadas (`COMMON_DIMENSIONS = ['30x40 cm', ...]`).
- PROHIBIDO controles táctiles con altura inferior a 44px (`min-h-[44px]` obligatorio).

#### 4. CRITERIOS DE ACEPTACIÓN TÉCNICOS
- **A. Pestañas de Modo:**
  - `[Medida Estándar]` (Por defecto): Grid con los 6 tamaños oficiales mostrando precio, medidas y badge.
  - `[Medida Personalizada]`:
    - Inputs numéricos limpios para `Ancho (cm)` y `Alto (cm)`. Cero botones o sugerencias de atajos.
    - Área en cm² = Ancho $\times$ Alto.
    - Base de impresión = Área $\times 0.048$.
- **B. Reglas Comerciales de Material y Recargo de Corte:**
  - **MDF 5.5mm (Madera):**
    * Si es tamaño oficial: Precio de la matriz.
    * Si es tamaño personalizado:
      $$\text{Precio} = (\text{Área } cm^2 \times 0.048) + \text{Q } 25.00 \text{ (Corte Especial Taller)}$$
      Mostrar desglose visual al vendedor: *"Base Q XX.XX + Q25.00 corte tabla especial"*.
  - **PVC 5mm:**
    * Si es tamaño oficial: Precio base oficial $+ \text{Q } 15.00$.
    * Si es tamaño personalizado: $(\text{Área } cm^2 \times 0.048) + \text{Q } 15.00$.
  - **Vinilo Solo (Lámina sin cuadro):**
    * Si es tamaño oficial: Precio base oficial $\times 0.50$ (50% de descuento).
    * Si es tamaño personalizado: $(\text{Área } cm^2 \times 0.048) \times 0.50$ (No lleva recargo de madera porque no usa tabla).
  - El input de precio final calculado debe permanecer editable para ajustes de negociación del vendedor.
- **C. Cargador de Arte a GCS:**
  - Dropzone interactiva con input file (`accept="image/jpeg,image/png,image/webp"`).
  - Preview local inmediato vía `FileReader`.
  - Subida a `POST /api/sales/upload-art` vía `FormData` con badge verde `✓ Arte en la nube`.
  - Campo de enlace URL colapsable como fallback secundario.
- **D. Inyección al Carrito:**
  - `customDimensions` formateado para taller:
    * Si fue oficial: `"Estándar: Mediano (30 x 45 cm)"`.
    * Si fue personalizado: `"Especial: 48 x 68 cm (Corte Taller)"`.
  - Inyección de la URL de GCS en `customImageUrl` para que la cola de operarios reciba el arte de inmediato.

#### 5. PROTOCOLO DE VERIFICACIÓN
- Compilación Vite limpia: `npm run build`
```
