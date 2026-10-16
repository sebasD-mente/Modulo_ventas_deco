import 'dotenv/config';
import fs from 'fs';

const token = process.env.PROD_VERIFY_JWT || '';
const baseUrl = process.env.PROD_BASE_URL || 'https://ventas.decovintage.online';

async function testEndpoint(name, url, method = 'GET', body = null) {
  try {
    const opts = {
      method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(baseUrl + url, opts);
    const data = await res.json().catch(() => ({}));
    const pass = res.status === 200 || res.status === 201;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}: HTTP ${res.status} | Resumen:`, JSON.stringify(data).slice(0, 120));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.log(`[ERR] ${name}:`, err.message);
    return { ok: false, error: err.message };
  }
}

async function run() {
  console.log('================================================================');
  console.log('🔍 [GARY CTO] AUDITORÍA PANÓPTICA SPRINT 2 EN PRODUCCIÓN REAL');
  console.log(`🌐 Base: ${baseUrl}`);
  console.log('================================================================\n');

  // Dominio 1: Clientes y CRM
  await testEndpoint('DOMINIO 1: GET /api/customers', '/api/customers');
  
  // Dominio 2: Pliegos Diarios de Taller
  await testEndpoint('DOMINIO 2: GET /api/production/print-sheets', '/api/production/print-sheets');
  await testEndpoint('DOMINIO 2: GET /api/production/items', '/api/production/items');
  await testEndpoint('DOMINIO 2: GET /api/production/metrics', '/api/production/metrics');

  // Dominio 3: Liquidaciones y Comisiones
  await testEndpoint('DOMINIO 3: GET /api/commissions/pending', '/api/commissions/pending');
  await testEndpoint('DOMINIO 3: GET /api/commissions/settlements', '/api/commissions/settlements');

  // IA: Stand Multimodal con Gemini Flash 3.8
  await testEndpoint('IA: POST /api/ai/chat (Consulta Métrica)', '/api/ai/chat', 'POST', {
    message: '¿Cuánto hemos vendido hoy en la feria?',
    eventId: '4426d955-39bc-438e-a5eb-529e4b9277e2',
    history: []
  });

  await testEndpoint('IA: POST /api/ai/chat (Búsqueda Catálogo)', '/api/ai/chat', 'POST', {
    message: 'Quiero un póster de Batman en tamaño mediano',
    eventId: '4426d955-39bc-438e-a5eb-529e4b9277e2',
    history: []
  });

  console.log('\n================================================================');
  console.log('🏁 AUDITORÍA COMPLETADA');
  console.log('================================================================');
}

run();
