import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { envSchema } from '../../server/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverDir = path.resolve(__dirname, '../../server');

function getAllFiles(dir, extensions = ['.js', '.mjs', '.json']) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results = results.concat(getAllFiles(filePath, extensions));
    } else {
      if (extensions.some((ext) => file.endsWith(ext))) {
        results.push(filePath);
      }
    }
  }
  return results;
}

describe('🔒 Suite de Seguridad Zero-Trust & Aislamiento Estricto', () => {
  it('No debe existir ningún correo @gmail.com en texto plano dentro del código de server/', () => {
    const files = getAllFiles(serverDir);
    const violations = [];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (line.includes('@gmail.com')) {
          violations.push({
            file: path.relative(serverDir, file),
            line: index + 1,
            content: line.trim(),
          });
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Se encontraron correos @gmail.com hardcodeados en server/:\n${JSON.stringify(violations, null, 2)}`
    );
  });

  it('No debe existir conexión o uso activo de la IP de infraestructura ajena (145.223.120.56) en server/', () => {
    const files = getAllFiles(serverDir);
    const violations = [];

    for (const file of files) {
      const relPath = path.relative(serverDir, file);
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.includes('145.223.120.56')) {
          const isDefensiveCheck =
            relPath.replace(/\\/g, '/') === 'config/env.js' &&
            (line.includes('FORBIDDEN_PATTERNS') || line.includes('prohibidas'));
          if (!isDefensiveCheck) {
            violations.push({
              file: relPath,
              line: index + 1,
              content: line.trim(),
            });
          }
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Se encontraron referencias activas a IPs ajenas no permitidas en server/:\n${JSON.stringify(violations, null, 2)}`
    );
  });

  it('server/config/env.js no debe contener fallbacks hardcodeados para SUPER_ADMIN_EMAILS o JWT_SECRET', () => {
    const envFile = path.join(serverDir, 'config', 'env.js');
    const content = fs.readFileSync(envFile, 'utf-8');

    assert.ok(
      !content.includes("|| 'ia@dekolabs.org'"),
      'No debe existir fallback hardcodeado para SUPER_ADMIN_EMAILS'
    );
    assert.ok(
      !content.includes("|| 'fallback_secret"),
      'No debe existir fallback hardcodeado para JWT_SECRET'
    );
  });

  it('Zod Schema debe fallar de inmediato si faltan variables obligatorias', () => {
    const result = envSchema.safeParse({});
    assert.equal(result.success, false, 'La validación con objeto vacío debe fallar');

    const issues = result.error.issues.map((i) => i.path.join('.'));
    assert.ok(issues.includes('DATABASE_URL'), 'DATABASE_URL debe ser requerida');
    assert.ok(issues.includes('JWT_SECRET'), 'JWT_SECRET debe ser requerido');
    assert.ok(issues.includes('GOOGLE_CLIENT_ID'), 'GOOGLE_CLIENT_ID debe ser requerido');
    assert.ok(issues.includes('SUPER_ADMIN_EMAILS'), 'SUPER_ADMIN_EMAILS debe ser requerida');
  });

  it('Zod Schema debe rechazar JWT_SECRET menor a 16 caracteres', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/test_db',
      JWT_SECRET: 'short_secret',
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      SUPER_ADMIN_EMAILS: 'admin@decovintage.online',
    });
    assert.equal(result.success, false, 'JWT_SECRET corto debe ser rechazado');
  });

  it('Zod Schema debe validar correctamente y parsear SUPER_ADMIN_EMAILS como array normalizado', () => {
    const result = envSchema.safeParse({
      DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/test_db',
      JWT_SECRET: 'super_secure_production_secret_key_2026',
      GOOGLE_CLIENT_ID: 'test-google-client-id.apps.googleusercontent.com',
      SUPER_ADMIN_EMAILS: '  Admin1@Test.Com, admin2@test.com  ',
    });
    assert.equal(result.success, true, 'Debe parsear exitosamente con valores válidos');
    assert.deepEqual(result.data.SUPER_ADMIN_EMAILS, ['admin1@test.com', 'admin2@test.com']);
  });
});
