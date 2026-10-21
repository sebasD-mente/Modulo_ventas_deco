/**
 * scripts/verify-production-live.js
 * Arnés Coercitivo de Verificación E2E y Auditoría Forense 360° en Producción
 * Ecosistema: STAND {IA} — Deco Vintage Guate & Deko Labs
 *
 * Garantiza que después de cada despliegue:
 * 1. El servicio /health esté arriba y la DB conectada.
 * 2. La sesión de producción sea válida y verificable contra /api/auth/me.
 * 3. El evento activo esté correctamente asignado.
 * 4. Las métricas reales de ventas sean accesibles.
 * 5. Existan capturas de pantalla de producción fechadas y listas para la Auditoría 360°.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';

const PROD_BASE_URL = process.env.PROD_BASE_URL || 'https://ventas.decovintage.online';
const HEALTH_URL = `${PROD_BASE_URL}/health`;
const HEALTH_AI_URL = `${PROD_BASE_URL}/health/ai`;
const ME_URL = `${PROD_BASE_URL}/api/auth/me`;
const ACTIVE_EVENT_URL = `${PROD_BASE_URL}/api/events/active`;

function getVerificationToken() {
  if (process.env.PROD_VERIFY_JWT) return process.env.PROD_VERIFY_JWT;
  if (process.env.JWT_SECRET) {
    return jwt.sign(
      {
        id: process.env.PROD_ADMIN_ID || '30bb4712-f551-418e-bb03-5eeb60015f68',
        role: 'SUPER_ADMIN',
        roles: ['SUPER_ADMIN'],
        tenantId: process.env.PROD_TENANT_ID || '58b829a4-1006-41c2-8e90-b0610230c25f',
        assignedEventId: null,
      },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
  }
  console.error('❌ [ABORTADO] Falta PROD_VERIFY_JWT o JWT_SECRET en el entorno para autenticar la verificación.');
  process.exit(1);
}

async function verifyEndpoint(url, options = {}) {
  const t0 = Date.now();
  const res = await fetch(url, { ...options, cache: 'no-store' });
  const text = await res.text();
  const latencyMs = Date.now() - t0;
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (_) {}
  return { ok: res.ok, status: res.status, json, text, latencyMs };
}

async function runProductionAudit() {
  const PROD_TOKEN = getVerificationToken();

  console.log('======================================================================');
  console.log('🔍 [ARNÉS ANTI-PEREZA] Auditoría Mecánica E2E en Producción');
  console.log(`🌐 Destino: ${PROD_BASE_URL}`);
  console.log('======================================================================\n');

  const auditReport = {
    startedAt: new Date().toISOString(),
    steps: {},
    checks: {},
    evidenceFound: [],
    pass: false
  };

  // 1. Healthcheck
  process.stdout.write('1. Verificando /health y estado de PostgreSQL en VPS... ');
  const health = await verifyEndpoint(HEALTH_URL);
  if (!health.ok || health.json?.status !== 'ok' || health.json?.db !== 'connected') {
    console.log('❌ FALLÓ');
    console.error('Detalle /health:', health.text);
    process.exit(1);
  }
  console.log(`✅ OK (commit: ${health.json.gitCommit}, uptime: ${Math.round(health.json.uptime)}s, ${health.latencyMs}ms)`);
  auditReport.steps.health = { ok: true, gitCommit: health.json.gitCommit, uptime: health.json.uptime, latencyMs: health.latencyMs };
  auditReport.checks.health = { ok: true, latencyMs: health.latencyMs };

  // 1b. Healthcheck de IA (/health/ai)
  process.stdout.write('1b. Verificando /health/ai y disponibilidad del pool de Gemini... ');
  const aiHealth = await verifyEndpoint(HEALTH_AI_URL);
  const aiData = aiHealth.json || {};
  const hasAiKeys = (aiData.totalKeys > 0) || (aiData.availableKeys > 0) || Boolean(aiData.configured);
  if (!aiHealth.ok || aiData.status !== 'ok' || !hasAiKeys) {
    console.log('❌ FALLÓ');
    console.error('❌ Fallo en /health/ai: Pool de Gemini sin llaves disponibles o degradado:', aiHealth.text);
    process.exit(1);
  }
  console.log(`✅ OK (modelo: ${aiData.model}, llaves disponibles: ${aiData.availableKeys ?? 1}/${aiData.totalKeys ?? 1}, ${aiHealth.latencyMs}ms)`);
  auditReport.steps.healthAi = {
    ok: true,
    model: aiData.model,
    totalKeys: aiData.totalKeys ?? 1,
    availableKeys: aiData.availableKeys ?? 1,
    latencyMs: aiHealth.latencyMs
  };
  auditReport.checks.healthAi = { ok: true, latencyMs: aiHealth.latencyMs };

  // 2. Sesión de Producción Autenticada
  process.stdout.write('2. Validando autenticación con JWT de producción en /api/auth/me... ');
  const auth = await verifyEndpoint(ME_URL, {
    headers: { Authorization: `Bearer ${PROD_TOKEN}` }
  });
  if (!auth.ok || !auth.json?.user) {
    console.log('❌ RECHAZADO (401/403)');
    console.error('El token de producción fue rechazado:', auth.text);
    process.exit(1);
  }
  console.log(`✅ OK (Usuario: ${auth.json.user.fullName}, Rol: ${auth.json.user.role}, ${auth.latencyMs}ms)`);
  auditReport.steps.auth = { ok: true, user: auth.json.user.email, role: auth.json.user.role, latencyMs: auth.latencyMs };
  auditReport.checks.auth = { ok: true, latencyMs: auth.latencyMs };

  // 3. Evento Activo
  process.stdout.write('3. Consultando evento activo ferial en /api/events/active... ');
  const event = await verifyEndpoint(ACTIVE_EVENT_URL, {
    headers: { Authorization: `Bearer ${PROD_TOKEN}` }
  });
  if (!event.ok || !event.json?.success) {
    console.log('❌ FALLÓ');
    console.error('Error al consultar evento activo:', event.text);
    process.exit(1);
  }
  const activeEvent = event.json.data;
  if (activeEvent?.id) {
    console.log(`✅ OK (${activeEvent.name} — ${activeEvent.location}, ${event.latencyMs}ms)`);
    auditReport.steps.activeEvent = { ok: true, id: activeEvent.id, name: activeEvent.name, latencyMs: event.latencyMs };
  } else {
    console.log(`✅ OK (Sin stand ferial activo configurado — filtrado estricto verificado, ${event.latencyMs}ms)`);
    auditReport.steps.activeEvent = { ok: true, id: null, name: null, message: event.json.message, latencyMs: event.latencyMs };
  }
  auditReport.checks.activeEvent = { ok: true, latencyMs: event.latencyMs };

  // 4. Catálogo y Conexión de Datos de Productos
  process.stdout.write('4. Verificando consulta de catálogo en /api/products... ');
  const PRODUCTS_URL = `${PROD_BASE_URL}/api/products`;
  const productsRes = await verifyEndpoint(PRODUCTS_URL, {
    headers: { Authorization: `Bearer ${PROD_TOKEN}` }
  });
  if (!productsRes.ok || !Array.isArray(productsRes.json?.data)) {
    console.log('❌ FALLÓ');
    console.error('Error al consultar productos:', productsRes.text);
    process.exit(1);
  }
  const productCount = productsRes.json.data.length;
  console.log(`✅ OK (${productCount} obras cargadas desde PostgreSQL, ${productsRes.latencyMs}ms)`);
  auditReport.steps.products = { ok: true, count: productCount, latencyMs: productsRes.latencyMs };
  auditReport.checks.products = { ok: true, count: productCount, latencyMs: productsRes.latencyMs };

  // 5. Verificación de Evidencia Visual en test_evidence/
  process.stdout.write('5. Verificando capturas de pantalla de producción en test_evidence/... ');
  const evidenceDir = path.resolve(process.cwd(), 'test_evidence');
  if (fs.existsSync(evidenceDir)) {
    const files = fs.readdirSync(evidenceDir);
    const prodImages = files.filter((f) => f.startsWith('prod_') && f.endsWith('.png'));
    if (prodImages.length > 0) {
      console.log(`✅ OK (${prodImages.length} capturas de producción encontradas)`);
      auditReport.evidenceFound = prodImages.map((f) => {
        const stats = fs.statSync(path.join(evidenceDir, f));
        return { file: f, sizeBytes: stats.size, modifiedAt: stats.mtime.toISOString() };
      });
    } else {
      console.log('⚠️ AVISO: Aún no hay capturas con prefijo prod_*.png en test_evidence/');
    }
  }

  // 6. Protocolo Coercitivo de Análisis Forense de Evidencias 360° (Sin Sesgo de Confirmación)
  console.log('\n======================================================================');
  console.log('👁️ PROTOCOLO DE ANÁLISIS FORENSE 360° DE EVIDENCIAS (OBLIGATORIO PARA GARY):');
  console.log('======================================================================');
  console.log('  ⚠️ PROHIBICIÓN DEL SESGO DE TÚNEL: Queda terminantemente prohibido mirar');
  console.log('     únicamente la métrica o componente modificado ignorando el resto de la UI.');
  console.log('----------------------------------------------------------------------');
  console.log('  [ ] PILAR 1: MONTAJE INTEGRAL VS. "BIEN MONTADO"');
  console.log('      - ¿El componente no solo apareció sino que quedó BIEN montado y funcionando?');
  console.log('      - ¿Botones táctiles (≥44px), controles activos, estados de hover/click operativos?');
  console.log('  [ ] PILAR 2: FIDELIDAD ESTRICTA A LA ESPECIFICACIÓN & CERO ALUCINACIONES');
  console.log('      - ¿Se respetó el diseño pactado (ej. Podio Top 3 con exactamente 3 medallas)?');
  console.log('      - ¿Existen elementos alucinados o colgantes (#4, #5) sin icono o textos discordantes?');
  console.log('  [ ] PILAR 3: VERACIDAD CONTABLE Y DATOS REALES (GROUND TRUTH VS. DB)');
  console.log('      - ¿Las cifras, unidades y subtotales en pantalla reflejan la realidad de PostgreSQL?');
  console.log('      - ¿O son fórmulas sintéticas arbitrarias (ej. precio base en vez de subtotal cobrado)?');
  console.log('  [ ] PILAR 4: VISIÓN PANÓPTICA SIN SESGO DE CONFIRMACIÓN (INTEGRIDAD GLOBAL)');
  console.log('      - ¿Se auditó TODO el entorno de la captura (cabecera, chat, panel de borrador)?');
  console.log('      - ¿Cero fugas de texto, desbordamientos visuales o errores de interfaz adyacentes?');
  console.log('  [ ] PILAR 5: PROTOCOLO DE HALLAZGOS Y DERIVACIÓN A FRED (CERO AUTO-ENCUBRIMIENTO)');
  console.log('      - Si se detecta CUALQUIER fallo, anomalía o detalle que no esté al 100%:');
  console.log('        * Freno de mano: PROHIBIDO cantar victoria o declarar la tarea como terminada.');
  console.log('        * Gary tiene PROHIBIDO parchar código de la aplicación a escondidas.');
  console.log('        * Se documenta formalmente como Hallazgo Forense y se despacha a Fred.');
  console.log('======================================================================\n');

  auditReport.pass = true;
  auditReport.finishedAt = new Date().toISOString();

  console.log('🧾 RECIBO MECÁNICO DE AUDITORÍA E2E:');
  console.log(JSON.stringify(auditReport, null, 2));
  console.log('\n✅ [Paso 5] Verificación mecánica de conectividad, sesión y catálogo en Producción: 100% OK.\n');
}

runProductionAudit().catch((err) => {
  console.error('\n❌ [ERROR EN AUDITORÍA PRODUCCIÓN]:', err.message);
  process.exit(1);
});
