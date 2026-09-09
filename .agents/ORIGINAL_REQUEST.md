# Original User Request

## 2026-09-09T14:21:10Z

Implementar y auditar de forma quirúrgica la arquitectura de producción de **Deko EventSales** (para **Deco Vintage Guate** y **Deko Labs**), erradicando la deuda técnica acumulada, blindando la seguridad, garantizando el aislamiento estricto de base de datos e infraestructura, y preparando el despliegue inmutable en Dokploy con Google Cloud Storage.

Working directory: `c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas`  
Integrity mode: development  

Requested team: Full multi-agent engineering team (DevOps, Security, Frontend QA & Cloud Storage)

## Requirements

### R1. Saneamiento de Código Muerto & Frontend QA
- Eliminar de forma segura los 7 componentes huérfanos que ya no son referenciados en la aplicación: `src/components/AiChatAssistant.jsx`, `src/components/BatchPhotoScanner.jsx`, `src/components/QuickPosKeyboard.jsx`, `src/components/LiveMonitor.jsx`, `src/components/CatalogView.jsx`, `src/components/VoiceRecorder.jsx` y `src/components/HumanVerificationModal.jsx`.
- Auditar y verificar que ningún archivo en `src/` tenga imports rotos.
- Compilar el frontend con `npm run build` y asegurar 0 errores de compilación.

### R2. Blindaje de Seguridad en API & Concurrencia de Ventas
- Corregir la vulnerabilidad en `server/middleware/authMiddleware.js`: eliminar la cláusula `|| !authHeader` para garantizar que en `NODE_ENV === 'production'` se exija estrictamente un token Bearer JWT válido y no se asigne ningún usuario por defecto.
- Refactorizar `server/services/saleService.js` para que la generación de números de venta (`generateSaleNumber`) sea atómica y resistente a condiciones de carrera (evitando colisiones entre vendedores concurrentes en eventos masivos).
- Parametrizar la consulta SQL en `server/services/webCatalogService.js` para evitar interpolaciones de texto en queries crudas.

### R3. Control de Versiones & Repositorio Git
- Crear un archivo `.gitignore` blindado que excluya estrictamente: `.env*`, `node_modules/`, `dist/`, `.gemini/`, `public/uploads/*` (excepto `.gitkeep`), archivos de credenciales JSON, claves y logs.
- Inicializar el repositorio Git local (`git init`), generar un `README.md` técnico con la especificación del sistema y registrar el commit inicial semántico.

### R4. Almacenamiento Permanente en Google Cloud Storage (GCS)
- Aprovisionar el bucket dedicado `gs://deko-eventsales-media/` en la región `us-central1` dentro del proyecto GCP activo `tienda-deco-vintage-web` utilizando las herramientas CLI autenticadas (`gcloud`/`gsutil`).
- Configurar Service Account con rol `roles/storage.objectAdmin` y generar credenciales seguras.
- Refactorizar `server/services/gcsStorageService.js` para erradicar cualquier fallback silencioso que guarde archivos localmente en disco efímero: todas las fotos, grabaciones de voz y comprobantes deben almacenarse directamente en GCS.

### R5. Aislamiento Estricto de Base de Datos & Sincronización Desacoplada
- Cumplir estrictamente la regla `aislamiento-estricto-proyectos`: el módulo de ventas debe operar sobre su propia base de datos dedicada (`deko_eventsales_db`), sin cohabitar con `catalog_db` de la tienda web.
- Implementar el servicio de sincronización automática `catalogSyncService.js` que consuma la API pública de la web (`GET /api/catalog/posters`) para mantener poblada la tabla propia `Product` de forma autónoma.

### R6. Contenerización Docker Multi-Stage de Producción
- Reemplazar el `Dockerfile` actual por una versión multi-stage profesional basada en `node:22-bookworm-slim` (glibc / Debian OpenSSL 3.0.x compatible con Prisma).
- Crear script `entrypoint.sh` ejecutable con verificación de conectividad con PostgreSQL y ejecución automática de `npx prisma db push` o `npx prisma migrate deploy`.
- Crear `.dockerignore` estricto.

---

## Acceptance Criteria

### 1. Integridad de Código & Frontend
- [ ] Los 7 componentes muertos están eliminados y no existen referencias huérfanas en `src/`.
- [ ] `npm run build` compila exitosamente produciendo el bundle de producción en `dist/` con código de salida 0.

### 2. Seguridad & Robustez de Backend
- [ ] Peticiones a endpoints protegidos sin header `Authorization` en modo producción reciben respuesta `401 Unauthorized`.
- [ ] `generateSaleNumber` no falla ante transacciones concurrentes simuladas.
- [ ] Todas las consultas SQL crudas en servicios utilizan parámetros tipados sin concatenación de cadenas.

### 3. Git & Trazabilidad
- [ ] El repositorio local tiene `.git` inicializado y un commit inicial con historial limpio.
- [ ] `.gitignore` previene efectivamente el rastreo de archivos `.env`, `node_modules` y credenciales.

### 4. Cloud Storage (GCS)
- [ ] El bucket `gs://deko-eventsales-media/` existe en `tienda-deco-vintage-web`.
- [ ] `uploadBufferToStorage` sube archivos exitosamente al bucket y retorna URLs válidas de GCS.
- [ ] No se escriben archivos en `public/uploads` durante la ejecución normal en producción.

### 5. Docker & Despliegue
- [ ] El `Dockerfile` multi-stage se compila exitosamente con `docker build`.
- [ ] El contenedor arranca limpiamente ejecutando migraciones antes de iniciar Express.
- [ ] La aplicación responde `200 OK` en el endpoint `/health`.
