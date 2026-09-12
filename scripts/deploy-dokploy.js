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
  console.log('🛡️ [Paso 1/5] Ejecutando Puerta de Calidad Local (npm run harness:check)...');
  try {
    execSync('npm run harness:check', { stdio: 'inherit' });
    console.log('✅ [Paso 1/5] Arnés de calidad aprobado en verde.');
  } catch (err) {
    console.error('\n❌ [ABORTADO] La puerta de calidad local falló. Corrige los errores antes de desplegar.');
    process.exit(1);
  }
}

function syncVersionJson(commitHash) {
  const versionPath = path.resolve('server/config/version.json');
  const payload = {
    gitCommit: commitHash,
    updatedAt: new Date().toISOString()
  };
  fs.writeFileSync(versionPath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`📦 [Paso 2/5] Hash de versión sincronizado: ${commitHash}`);
}

async function triggerDokployWebhook() {
  console.log('🚀 [Paso 3/5] Disparando Webhook oficial de Dokploy...');
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
  console.log(`✅ [Paso 3/5] Webhook aceptado por Dokploy: ${text.trim()}`);
}

async function pollUntilDeployed(localCommit, deployStartTime) {
  console.log(`⏳ [Paso 4/5] Monitoreando reinicio del contenedor en ${HEALTH_URL}...`);
  console.log(`🎯 Objetivo: gitCommit === "${localCommit}" Y reinicio post-deploy.`);

  const start = Date.now();
  let lastUptime = null;
  let attempts = 0;

  while (Date.now() - start < MAX_WAIT_MS) {
    attempts++;
    await sleep(POLLING_INTERVAL_MS);

    try {
      const res = await fetch(HEALTH_URL, { cache: 'no-store' });
      if (!res.ok && res.status !== 503) {
        console.log(`[Intento ${attempts}] Servidor respondió HTTP ${res.status}. Posible reinicio de contenedor...`);
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
        console.log('\n\n🎉 [Paso 5/5] ¡DESPLIEGUE CONFIRMADO EN PRODUCCIÓN!');
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
      console.log(`\n[T+${Math.round((Date.now() - start) / 1000)}s] Contenedor reiniciando / temporalmente inaccesible (${fetchErr.message})...`);
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

  // 2. Hash Local
  const localCommit = execSync('git rev-parse --short HEAD').toString().trim();
  syncVersionJson(localCommit);

  // Asegurar que si version.json cambió, se comitea antes de push
  const gitDiff = execSync('git status --porcelain').toString().trim();
  if (gitDiff.includes('server/config/version.json')) {
    execSync('git add server/config/version.json');
    execSync(`git commit -m "chore(version): sync version.json with commit ${localCommit}"`);
  }

  const finalLocalCommit = execSync('git rev-parse --short HEAD').toString().trim();

  // 3. Git Push
  console.log(`\n📤 [Paso 2.5/5] Enviando cambios a GitHub (origin/main)...`);
  execSync('git push origin main', { stdio: 'inherit' });

  // 4. Webhook Dokploy
  const deployStartTime = Date.now();
  await triggerDokployWebhook();

  // 5. Polling Determinista
  await pollUntilDeployed(finalLocalCommit, deployStartTime);
}

main().catch((err) => {
  console.error('\n❌ [ERROR INESPERADO]', err.message);
  process.exit(1);
});
