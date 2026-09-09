## 2026-09-09T14:30:00Z
You are the Worker for Milestone M4 (Permanent Cloud Storage in GCS).
Your working directory is: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m4`
The project workspace root is: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas`
The original user request is at: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/ORIGINAL_REQUEST.md` (MANDATORY: Read first).
Project scope: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/PROJECT.md`
Survey evidence: `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/explorer_survey_3/handoff.md`
Domain skill: `C:\Users\sebas\.gemini\config\skills\cirugia-arquitectura-cero-deuda\SKILL.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership:
- `server/services/gcsStorageService.js`
- `server/config/env.js`
- `.env`
- `.env.example`
- GCP cloud bucket resources

Tasks:
1. Use `gcloud` CLI to provision bucket `gs://deko-eventsales-media/` in `us-central1` on project `tienda-deco-vintage-web` with uniform bucket level access:
   `gcloud storage buckets create gs://deko-eventsales-media --project=tienda-deco-vintage-web --location=us-central1 --uniform-bucket-level-access`
2. Add public read permission for objects:
   `gcloud storage buckets add-iam-policy-binding gs://deko-eventsales-media --member=allUsers --role=roles/storage.objectViewer`
3. Configure CORS policy for the bucket.
4. Update `server/config/env.js`, `.env`, and `.env.example` to set `GCS_BUCKET_NAME=deko-eventsales-media`.
5. Refactor `server/services/gcsStorageService.js`:
   - Eradicate the silent fallback to `public/uploads` / local disk.
   - In production (`ENV.NODE_ENV === 'production'`), any failure to upload to GCS must fail-fast by throwing an explicit Error.
   - In development, if GCS client is not configured, throw explicit error or log clear warning (zero uncontrolled local disk writes).
6. Verify live by running a Node test script that calls `uploadBufferToStorage` with a test buffer, confirms successful upload to `gs://deko-eventsales-media/`, validates the returned GCS URL via HTTP GET or `gsutil stat`, and confirms 0 files were created in `public/uploads`.
7. Document commands, outputs, code diffs, and verification in `c:/Users/sebas/Documents/Antigravity Files/Modulo_Ventas/.agents/worker_m4/handoff.md`. Send a message upon completion.
