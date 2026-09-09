# Informe de Investigación Técnica (Handoff) — Explorer Survey 3

**Proyecto**: Deko EventSales (Deco Vintage Guate & Deko Labs)  
**Autor**: explorer_survey_3  
**Destinatario**: orchestrator_1 (parent: 40958512-4854-45d9-bf41-45feacb902c8)  
**Fecha/Hora**: 2026-09-09T14:30:00Z  
**Alcance**: Google Cloud Storage (R4), Docker & Dokploy Multi-Stage (R6), Health Check & Observabilidad  

---

## 1. Observation

### 1.1 Google Cloud Storage (GCS) y Almacenamiento Local (R4)
1. **Archivo `server/services/gcsStorageService.js`**:
   - Línea 11:
     ```javascript
     const LOCAL_UPLOAD_DIR = path.resolve(__dirname, '../../public/uploads');
     ```
   - Líneas 19-35:
     ```javascript
     if (gcs && ENV.GCS_BUCKET_NAME) {
       try {
         const bucket = gcs.bucket(ENV.GCS_BUCKET_NAME);
         const file = bucket.file(filename);
         await file.save(buffer, { metadata: { contentType: mimetype }, resumable: false });
         const publicUrl = `https://storage.googleapis.com/${ENV.GCS_BUCKET_NAME}/${filename}`;
         return { success: true, url: publicUrl, filename };
       } catch (err) {
         console.warn('[GCS Storage] ⚠️ Falló subida a bucket, usando respaldo local:', err.message);
       }
     }
     ```
   - Líneas 37-48 (Fallback silencioso a disco local):
     ```javascript
     try {
       const targetDir = path.join(LOCAL_UPLOAD_DIR, folder);
       fs.mkdirSync(targetDir, { recursive: true });
       const localFilePath = path.join(targetDir, `${Date.now()}-${randomHex}${ext}`);
       fs.writeFileSync(localFilePath, buffer);
       const localUrl = `/uploads/${folder}/${path.basename(localFilePath)}`;
       return { success: true, url: localUrl, filename };
     } catch (err) { ... }
     ```
   - Si `getGCSClient()` o `ENV.GCS_BUCKET_NAME` no están configurados, o si la subida a GCS lanza cualquier error (de red, permisos, etc.), el servicio atrapa el error silenciosamente y escribe en disco efímero en `public/uploads`.
2. **Archivos de configuración de entorno**:
   - `server/config/env.js` (Línea 19):
     `GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || 'decovintage-master-media'`
     Apunta por defecto al bucket maestro de la tienda web e-commerce (`decovintage-master-media`), violando el principio de aislamiento estricto de proyectos (`aislamiento-estricto-proyectos`).
   - `.env` (Línea 8):
     `GCS_BUCKET_NAME=decovintage-master-media`
   - `.env.example` (Línea 38-42):
     `GCS_BUCKET_NAME=decovintage-master-media`
     `GCS_CREDENTIALS_BASE64=`
     `GCS_PROJECT_ID=tienda-deco-vintage-web`
3. **Herramientas CLI de GCP y Proyecto Activo**:
   - Comando `gcloud --version`:
     ```
     Google Cloud SDK 578.0.0
     bq 2.1.36
     core 2026.07.24
     gcloud-crc32c 1.0.0
     gsutil 5.37
     ```
   - Comando `gcloud config list`:
     ```
     [compute] region = us-central1
     [core] account = sebasjimenez0330@gmail.com
            project = tienda-deco-vintage-web
     ```
   - Credenciales ADC locales: `gcloud auth application-default print-access-token` responde con token válido `ya29.a0AdMD...`.
4. **Estado de Buckets en GCP**:
   - Comando `gcloud storage buckets list`:
     Único bucket existente: `gs://decovintage-master-media/` (multi-region US, con `allUsers: roles/storage.objectViewer` y CORS configurado para dominios de Deco Vintage).
   - Comando `gsutil ls -b gs://deko-eventsales-media`:
     `BucketNotFoundException: 404 gs://deko-eventsales-media bucket does not exist.`
     El bucket solicitado en R4 **NO existe aún**.
5. **Cuentas de Servicio (Service Accounts)**:
   - `deco-storage-uploader@tienda-deco-vintage-web.iam.gserviceaccount.com` existe y tiene asignados los roles `roles/storage.admin` y `roles/storage.objectAdmin` en el proyecto `tienda-deco-vintage-web`.
   - `server/config/gcs.js` ya cuenta con soporte nativo para deserializar credenciales JSON provistas en base64 mediante `ENV.GCS_CREDENTIALS_BASE64`.

---

### 1.2 Docker y Despliegue en Dokploy (R6)
1. **Archivo `Dockerfile` existente**:
   - Línea 5: `FROM node:22-alpine AS builder`
   - Línea 21: `FROM node:22-alpine AS runner`
   - Línea 29: `RUN npm ci --only=production` (flag deprecated; además omite devDependencies).
   - Línea 39: `COPY --from=builder /app/public ./public`
     **Error crítico comprobado**: El directorio `public` **no existe** en la raíz del proyecto workspace (`c:\Users\sebas\Documents\Antigravity Files\Modulo_Ventas\public` no existe). Cualquier `docker build` fallará en este paso con error de archivo no encontrado.
   - Línea 43: `CMD ["node", "server/index.js"]`
     No ejecuta `entrypoint.sh`, no verifica la conexión a PostgreSQL antes de inicializar Express y no ejecuta migraciones ni `prisma db push`.
2. **Incompatibilidad de Prisma con Alpine**:
   - `prisma/schema.prisma` (Líneas 1-4):
     ```prisma
     generator client {
       provider      = "prisma-client-js"
       binaryTargets = ["native", "debian-openssl-3.0.x"]
     }
     ```
   - El schema define como target binario `debian-openssl-3.0.x`. `node:22-alpine` utiliza `musl libc`, lo cual causa fallos de compatibilidad binaria si no se genera específicamente para `linux-musl-openssl-3.0.x` o si faltan bibliotecas C compatibles.
3. **Ausencia de `.dockerignore`**:
   - El archivo `.dockerignore` **no existe** en el workspace.
   - Sin `.dockerignore`, `docker build` envía al daemon de Docker todo el árbol de archivos: `node_modules/` (con binarios Windows), `.env` (credenciales y contraseñas en texto plano), `.agents/`, `.git/`, `.gemini/` y `dist/`.
4. **Ausencia de `entrypoint.sh`**:
   - No existe ningún script de inicialización para el contenedor.
   - En `package.json`, `"prisma": "^6.9.0"` está ubicado en `devDependencies` y `"@prisma/client": "^6.9.0"` está en `dependencies`. Si en la etapa `runner` se corre `npm ci --omit=dev`, el binario CLI de Prisma (`npx prisma`) no estará disponible a menos que `prisma` se mueva a `dependencies` o se copie `node_modules` desde el builder.
5. **Archivo `docker-compose.yml` existente**:
   - Líneas 22-23:
     ```yaml
     volumes:
       - ./public/uploads:/app/public/uploads
     ```
     Contiene un montaje persistente de `public/uploads`, lo cual es síntoma del acoplamiento con almacenamiento en disco local efímero y contradice el modelo sin estado (stateless) para Dokploy con GCS.

---

### 1.3 Health Check & Observabilidad
1. **Endpoint `/health` en `server/index.js` (Líneas 33-35)**:
   ```javascript
   // Health check endpoint
   app.get('/health', (req, res) => {
     res.json({ status: 'ok', time: new Date().toISOString(), env: ENV.NODE_ENV });
   });
   ```
   - Es un chequeo meramente estático.
   - **No valida** la conexión a la base de datos PostgreSQL (`prisma.$queryRaw`). Si PostgreSQL cae o la URL es errónea, `/health` sigue respondiendo `200 OK`.
   - **No valida** el estado de GCS ni del motor de Gemini.
2. **Defecto en Graceful Shutdown de `server/index.js` (Línea 68)**:
   ```javascript
   const { prisma } = await import('./config/db.js');
   await prisma.$disconnect();
   ```
   - **Error en ruta**: El archivo `server/config/db.js` **no existe**. El archivo real es `server/config/prisma.js`. Al recibir `SIGTERM` o `SIGINT`, la desconexión limpia de Prisma falla por importación rota.

---

## 2. Logic Chain

1. **R4 — Pérdida de Datos en Producción por Fallback a Disco**:
   - Dado que Dokploy corre contenedores Docker sobre un VPS, el sistema de archivos del contenedor es efímero.
   - Dado que `gcsStorageService.js` contiene un bloque `catch` que degrada silenciosamente a `LOCAL_UPLOAD_DIR = public/uploads`, cualquier error en GCS guardará archivos en el contenedor.
   - Al reiniciar, actualizar o escalar el contenedor en Dokploy, todos los archivos guardados en `public/uploads` se destruyen irreversiblemente.
   - Por tanto, la regla de oro de `cirugia-arquitectura-cero-deuda` exige eliminar el fallback silencioso: en `production`, si GCS no está disponible o falla, la operación debe fallar explícitamente (`fail-fast`) retornando un error controlado al cliente, impidiendo escrituras en disco efímero.
2. **R4 — Requisitos de Aprovisionamiento del Bucket GCS**:
   - Dado que el bucket `gs://deko-eventsales-media/` arroja 404, debe ser creado con `gcloud storage buckets create gs://deko-eventsales-media --location=us-central1 --project=tienda-deco-vintage-web --uniform-bucket-level-access`.
   - Dado que la aplicación genera URLs públicas tipo `https://storage.googleapis.com/deko-eventsales-media/...` (línea 30 de `gcsStorageService.js`), el bucket debe tener permiso de lectura para `allUsers` con rol `roles/storage.objectViewer`.
   - Dado que el frontend web interactuará con fotos y audios, se debe aplicar una política CORS permisiva para orígenes autorizados.
   - Para que Dokploy en el VPS pueda autenticarse sin depender de ADC local del desarrollador, se debe inyectar la clave en base64 de la cuenta de servicio (`deco-storage-uploader` o una dedicada `deko-eventsales-sa`) en la variable de entorno `GCS_CREDENTIALS_BASE64`.
3. **R6 — Garantía Binaria con `node:22-bookworm-slim` y `entrypoint.sh`**:
   - Dado que `prisma/schema.prisma` compila binarios para `debian-openssl-3.0.x`, la imagen base debe ser `node:22-bookworm-slim` (Debian 12 con OpenSSL 3.0.x y glibc), no Alpine.
   - Dado que la base de datos de producción puede estar inicializándose en el arranque o requerir migración de esquema, `entrypoint.sh` debe ejecutar un bucle de sondeo (retry loop) con verificación real de conectividad PostgreSQL antes de lanzar la aplicación.
   - Una vez confirmada la conectividad, `entrypoint.sh` debe ejecutar `npx prisma db push --skip-generate` (o `prisma migrate deploy`) para que el esquema esté siempre al día antes de que Express reciba tráfico.
   - Finalmente, `entrypoint.sh` debe usar `exec "$@"` para que el proceso Node.js reciba directamente las señales de parada del sistema operativo (`SIGTERM`/`SIGINT`), permitiendo un apagado limpio.
4. **Observabilidad Robusta del Endpoint `/health`**:
   - De acuerdo con la sección 4 de `diagnostico-causa-raiz-devops` (*"Superar el Espejismo de HTTP 200"*), un endpoint de salud en producción debe verificar que los componentes vitales estén operando.
   - `/health` debe realizar un `prisma.$queryRaw\`SELECT 1\`` con timeout estricto. Si la base de datos responde, retorna `200 OK` con metadata de uptime y estado; si falla, retorna `503 Service Unavailable`.

---

## 3. Caveats

1. **Docker CLI en Windows Host**:
   - La máquina de desarrollo Windows no cuenta con el ejecutable `docker` en el PATH local. Esto no impide la creación del `Dockerfile`, `.dockerignore` y `entrypoint.sh`, pero la verificación de compilación del contenedor Docker se delega al build remoto de Dokploy/VPS o a una máquina con Docker Desktop/WSL2.
2. **Migración de Datos Existentes en GCS**:
   - El bucket `gs://decovintage-master-media/` contiene los pósters del e-commerce web. Las ventas anteriores en `catalog_db` que tengan referencias a archivos antiguos no deben ser alteradas (principio de no modificación de proyectos ajenos en `aislamiento-estricto-proyectos`). El nuevo bucket `gs://deko-eventsales-media/` almacenará exclusivamente los nuevos medios generados por EventSales (comprobantes, notas de voz, fotos de lotes).
3. **Modo Desarrollo vs Producción en GCS**:
   - Si un desarrollador local corre la app sin conexión a internet y sin credenciales GCS, la app fallará al subir archivos si no existe un modo mock controlado. Para desarrollo, se puede permitir simulación controlada o exigir credenciales ADC locales (que ya están activas en esta máquina). En producción (`NODE_ENV === 'production'`), el guardado local en disco está **estrictamente prohibido**.

---

## 4. Conclusion

1. **GCS (R4)**:
   - Se debe aprovisionar de inmediato el bucket `gs://deko-eventsales-media/` en `us-central1` dentro del proyecto `tienda-deco-vintage-web` con acceso público de lectura (`roles/storage.objectViewer`) y CORS.
   - En `server/services/gcsStorageService.js`: refactorizar eliminando el fallback a `public/uploads`. Si la subida falla, debe lanzar una excepción explícita.
   - En `server/config/env.js`, `.env` y `.env.example`: cambiar `GCS_BUCKET_NAME` por defecto a `deko-eventsales-media`.
2. **Docker Multi-Stage & Dokploy (R6)**:
   - Reemplazar el `Dockerfile` por una arquitectura multi-stage de 3 etapas sobre `node:22-bookworm-slim`:
     1. `deps`: `package*.json`, `prisma/`, `npm ci`, `npx prisma generate`.
     2. `builder`: código fuente frontend, `npm run build`.
     3. `runner`: Debian slim con `openssl` y `ca-certificates`, `prisma` disponible, código servidor, `entrypoint.sh` ejecutable con `exec "$@"`.
   - Eliminar de `Dockerfile` la línea errónea `COPY --from=builder /app/public ./public`.
   - Crear `.dockerignore` riguroso que excluya `node_modules`, `.env*`, `.agents`, `public/uploads`, etc.
   - Crear `entrypoint.sh` con verificación de PostgreSQL y `npx prisma db push --skip-generate` (garantizando terminaciones de línea Unix LF `\n`).
3. **Health Check y Graceful Shutdown**:
   - Enriquecer `/health` en `server/index.js` para que ejecute `prisma.$queryRaw\`SELECT 1\`` y devuelva `200` o `503`.
   - Corregir en `server/index.js` línea 68 la importación rota: cambiar `./config/db.js` por `./config/prisma.js`.

---

## 5. Verification Method

### 5.1 Verificación de Aprovisionamiento GCS (R4)
1. **Comando de creación del bucket**:
   ```bash
   gcloud storage buckets create gs://deko-eventsales-media --project=tienda-deco-vintage-web --location=us-central1 --uniform-bucket-level-access
   ```
2. **Comando de asignación de lectura pública**:
   ```bash
   gcloud storage buckets add-iam-policy-binding gs://deko-eventsales-media --member=allUsers --role=roles/storage.objectViewer
   ```
3. **Comprobación de existencia y política**:
   ```bash
   gsutil ls -b gs://deko-eventsales-media
   gcloud storage buckets get-iam-policy gs://deko-eventsales-media
   ```
4. **Verificación en código**:
   Ejecutar un script de prueba que invoque `uploadBufferToStorage` con un buffer de prueba y verificar que la URL devuelta comience con `https://storage.googleapis.com/deko-eventsales-media/` y que no se cree ningún archivo en `public/uploads`.

### 5.2 Verificación de Docker & Configuración Dokploy (R6)
1. **Verificación de archivos creados**:
   - Comprobar existencia y contenido de `.dockerignore`:
     Confirmar que ignore `.env`, `node_modules`, `.agents`, `.git`.
   - Comprobar `entrypoint.sh`:
     Confirmar que tenga permisos de ejecución y terminación LF (`\n` sin `\r`).
   - Comprobar `Dockerfile`:
     Confirmar uso de `node:22-bookworm-slim`, instalación de `openssl ca-certificates`, `ENTRYPOINT ["/app/entrypoint.sh"]` y `CMD ["node", "server/index.js"]`.
2. **Verificación del Endpoint `/health`**:
   - Con el servidor iniciado (`npm run server`), realizar petición HTTP:
     ```bash
     curl -i http://localhost:3001/health
     ```
   - Debe retornar HTTP 200 con payload JSON indicando estado `ok` y base de datos conectada.
   - Probar shutdown limpio enviando `SIGINT` (Ctrl+C) y validar en consola que `server/config/prisma.js` se desconecte sin errores de módulo no encontrado.
