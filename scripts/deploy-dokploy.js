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
const MAX_WAIT_MS = 180000; // 3 minutos

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPreFlightChecks() {
  console.log('🛡️ [Paso 1/4] Ejecutando Puerta de Calidad Local (npm run harness:check)...');
  try {
    execSync('npm run harness:check', { stdio: 'inherit' });
    console.log('✅ [Paso 1/4] Arnés de calidad aprobado en verde.');
  } catch (err) {
    console.error('\n❌ [ABORTADO] La puerta de calidad local falló. Corrige los errores antes de desplegar.');
    process.exit(1);
  }
}

async function triggerDokployWebhook() {
  console.log('🚀 [Paso 3/4] Disparando Webhook oficial de Dokploy...');
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
  console.log(`✅ [Paso 3/4] Webhook aceptado por Dokploy: ${text.trim()}`);
}

async function pollUntilDeployed(localCommit, deployStartTime) {
  console.log(`⏳ [Paso 4/4] Monitoreando reinicio del contenedor en ${HEALTH_URL}...`);
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

async function main() {
  console.log('======================================================================');
  console.log('🚀 [Deko EventSales] Iniciando Protocolo Mecánico de Despliegue Dokploy');
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
  console.log(`\n📤 [Paso 2/4] Enviando cambios a GitHub (origin/main)...`);
  execSync('git push origin main', { stdio: 'inherit' });

  // 5. Webhook Dokploy
  const deployStartTime = Date.now();
  await triggerDokployWebhook();

  // 6. Polling Determinista
  await pollUntilDeployed(localCommit, deployStartTime);
}

main().catch((err) => {
  console.error('\n❌ [ERROR INESPERADO]', err.message);
  process.exit(1);
});
