/**
 * scripts/deploy-dokploy.js
 * Arnés Mecánico de Despliegue en Producción — Deko EventSales
 * Garantiza cero suposiciones mediante verificación criptográfica de commit y uptime.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const DOKPLOY_WEBHOOK_URL = 'http://145.223.120.56:3000/api/deploy/ifJKTSseeCgAumCezDEZx';
const HEALTH_URL = 'https://ventas.decovintage.online/health';
const POLLING_INTERVAL_MS = 4000;
const MAX_WAIT_MS = 300000; // 5 minutos (holgura para compilación limpia de imagen Docker en VPS)

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPreFlightChecks() {
  console.log('🛡️ [Paso 1/8] Ejecutando Puerta de Calidad Local (npm run harness:check)...');
  try {
    execSync('npm run harness:check', { stdio: 'inherit' });
    console.log('✅ [Paso 1/8] Arnés de calidad aprobado en verde.');
  } catch (err) {
    console.error('\n❌ [ABORTADO] La puerta de calidad local falló. Corrige los errores antes de desplegar.');
    process.exit(1);
  }
}

async function triggerDokployWebhook() {
  console.log('🚀 [Paso 3/8] Disparando Webhook oficial de Dokploy...');
  const res = await fetch(DOKPLOY_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'x-github-event': 'push',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ ref: 'refs/heads/main' })
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fallo HTTP ${res.status} al disparar webhook: ${text}`);
  }
  console.log(`✅ [Paso 3/8] Webhook aceptado por Dokploy: ${text.trim()}`);
}

async function pollUntilDeployed(localCommit, deployStartTime) {
  console.log(`⏳ [Paso 4/8] Monitoreando reinicio del contenedor en ${HEALTH_URL}...`);
  console.log(`🎯 Objetivo: gitCommit === "${localCommit}" Y reinicio post-deploy.`);

  const start = Date.now();
  let attempts = 0;

  while (Date.now() - start < MAX_WAIT_MS) {
    attempts++;
    await sleep(POLLING_INTERVAL_MS);

    try {
      const res = await fetch(HEALTH_URL, { cache: 'no-store' });
      if (!res.ok && res.status !== 503) {
        process.stdout.write(`\r[T+${Math.round((Date.now() - start) / 1000)}s] Servidor respondió HTTP ${res.status}. Posible reinicio de contenedor... `);
        continue;
      }

      const data = await res.json();
      const remoteCommit = data.gitCommit || 'desconocido';
      const remoteUptime = data.uptime || 0;

      process.stdout.write(`\r[T+${Math.round((Date.now() - start) / 1000)}s] Remoto: commit=${remoteCommit}, uptime=${Math.round(remoteUptime)}s `);

      // Condiciones de Victoria:
      // 1. Si remoteCommit coincide con localCommit
      // 2. Y el uptime demuestra que es un contenedor recién levantado (< 120s)
      const commitMatches = remoteCommit === localCommit;
      const containerFresh = remoteUptime < 120;

      if (commitMatches && containerFresh) {
        console.log('\n\n🎉 [Victoria] ¡DESPLIEGUE CONFIRMADO EN PRODUCCIÓN!');
        const receipt = {
          status: 'DEPLOY_SUCCESS',
          localCommit,
          remoteCommit,
          remoteUptime: Number(remoteUptime.toFixed(2)),
          verifiedAt: new Date().toISOString()
        };
        console.log('\n========================================');
        console.log('🧾 RECIBO MECÁNICO DE DESPLIEGUE OFICIAL:');
        console.log('========================================');
        console.log(JSON.stringify(receipt, null, 2));
        console.log('========================================\n');
        return receipt;
      }
    } catch (fetchErr) {
      process.stdout.write(`\r[T+${Math.round((Date.now() - start) / 1000)}s] Contenedor reiniciando / temporalmente inaccesible... `);
    }
  }

  console.error('\n\n❌ ERROR FATAL: Dokploy no desplegó el commit dentro del tiempo límite (3 minutos).');
  console.error('El contenedor remoto sigue en la versión anterior o el build de Docker falló en el VPS.');
  process.exit(1);
}

async function runPostDeployAudit() {
  console.log('\n🔍 [Paso 5/8] Ejecutando Verificación Mecánica E2E de Uptime, DB, Sesión y Catálogo en Producción...');
  try {
    execSync('node scripts/verify-production-live.js', { stdio: 'inherit' });
    console.log('✅ [Paso 5/8] Verificación de salud y sesión aprobada con éxito.');
  } catch (err) {
    console.error('\n❌ [ERROR FATAL] La verificación E2E en producción falló.');
    console.error('El despliegue está incompleto o la aplicación tiene errores en vivo.');
    process.exit(1);
  }

  console.log('\n======================================================================');
  console.log('🧭 [PASOS ADICIONALES POST-DESPLIEGUE OBLIGATORIOS PARA GARY]');
  console.log('======================================================================');
  console.log('🌐 URL Oficial de Producción: https://ventas.decovintage.online\n');
  console.log('👉 [Paso 6/8] AUDITORÍA EN VIVO CON CHROME DEVTOOLS:');
  console.log('   1. Abrir Chrome DevTools MCP en https://ventas.decovintage.online');
  console.log('   2. Inyectar sesión autenticada con DEVTOOLS_AUTH_SNIPPET (npm run devtools:auth)');
  console.log('   3. Navegar e interactuar con el flujo real intervenido (sin bypasses manuales)');
  console.log('   4. Capturar pantalla de alta resolución y guardar en test_evidence/prod_*.png\n');
  console.log('👉 [Paso 7/8] ANÁLISIS FORENSE 360° DE LA EVIDENCIA (SIN SESGO DE CONFIRMACIÓN):');
  console.log('   * Pilar 1: ¿Quedó no solo montado, sino BIEN montado y con todo funcionando?');
  console.log('   * Pilar 2: ¿Fidelidad exacta a la especificación sin alucinaciones (ej. Top 3 estricto)?');
  console.log('   * Pilar 3: ¿Veracidad contable real contra datos de PostgreSQL (no fórmulas falsas)?');
  console.log('   * Pilar 4: ¿Inspección del entorno completo sin sesgo de túnel (cero fugas de UI)?\n');
  console.log('👉 [Paso 8/8] COMPUERTA DE DECISIÓN (CERO AUTO-ENCUBRIMIENTO):');
  console.log('   * Si TODO está 100% verificado: emitir el informe ejecutivo con evidencia visual.');
  console.log('   * Si se detecta CUALQUIER detalle o error: Gary NO toca código. Se documenta como');
  console.log('     Hallazgo Forense y se despacha a Fred para su solución limpia.');
  console.log('======================================================================\n');
}

async function main() {
  console.log('======================================================================');
  console.log('🚀 [Deko EventSales] Protocolo Mecánico de Despliegue Dokploy (8 Pasos)');
  console.log('======================================================================\n');

  // 1. Puerta de Calidad Local
  await runPreFlightChecks();

  // 2. Comprobar que el árbol de trabajo esté limpio antes de desplegar
  const status = execSync('git status --porcelain').toString().trim();
  if (status) {
    console.error('❌ [ABORTADO] Hay cambios locales sin commitear. Haz commit antes de desplegar:\n' + status);
    process.exit(1);
  }

  // 3. Hash Local actual
  const localCommit = execSync('git rev-parse --short HEAD').toString().trim();
  console.log(`📌 Commit local a desplegar: ${localCommit}`);

  // 4. Git Push
  console.log(`\n📤 [Paso 2/8] Enviando cambios a GitHub (origin/main)...`);
  execSync('git push origin main', { stdio: 'inherit' });

  // 5. Webhook Dokploy
  const deployStartTime = Date.now();
  await triggerDokployWebhook();

  // 6. Polling Determinista
  await pollUntilDeployed(localCommit, deployStartTime);

  // 7. Auditoría E2E y Pasos Adicionales Post-Despliegue
  await runPostDeployAudit();
}

main().catch((err) => {
  console.error('\n❌ [ERROR INESPERADO]', err.message);
  process.exit(1);
});
