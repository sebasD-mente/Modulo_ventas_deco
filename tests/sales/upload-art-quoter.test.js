import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OFFICIAL_SIZES,
  DEFAULT_SIZES,
  CUSTOM_CM2_RATE,
  WOOD_CUSTOM_CUT_SURCHARGE,
  PVC_SURCHARGE,
  VINYL_DISCOUNT_FACTOR,
} from '../../src/components/manual-sale/manualSaleConstants.js';
import { uploadCustomArt } from '../../server/controllers/remoteSaleController.js';

describe('📦 Cotizador Personalizado & Pipeline de Arte (Fases 1 y 2)', () => {
  it('Debe validar la matriz estricta de 6 tamaños oficiales de Deco Vintage', () => {
    assert.equal(OFFICIAL_SIZES.length, 6, 'Deben existir exactamente 6 tamaños oficiales');
    const expectedIds = ['MINI', 'PEQUENO', 'PORTADA_ALBUM', 'MEDIANO', 'GRANDE', 'GIGANTE'];
    assert.deepEqual(
      OFFICIAL_SIZES.map((s) => s.sizeId),
      expectedIds,
      'Los sizeIds deben corresponder a la matriz oficial'
    );

    const mini = OFFICIAL_SIZES.find((s) => s.sizeId === 'MINI');
    assert.equal(mini.precio, 25.00);
    assert.equal(mini.dimensiones, '14 x 21 cm');

    const gigante = OFFICIAL_SIZES.find((s) => s.sizeId === 'GIGANTE');
    assert.equal(gigante.precio, 210.00);
    assert.equal(gigante.dimensiones, '60 x 100 cm');

    assert.equal(DEFAULT_SIZES, OFFICIAL_SIZES, 'DEFAULT_SIZES debe apuntar a OFFICIAL_SIZES');
  });

  it('Debe tener las constantes comerciales exactas y NO exportar presets rápidos', async () => {
    assert.equal(CUSTOM_CM2_RATE, 0.048, 'La tasa por cm2 debe ser 0.048');
    assert.equal(WOOD_CUSTOM_CUT_SURCHARGE, 25.00, 'El recargo por corte especial de madera debe ser Q 25.00');
    assert.equal(PVC_SURCHARGE, 15.00, 'El recargo por PVC debe ser Q 15.00');
    assert.equal(VINYL_DISCOUNT_FACTOR, 0.50, 'El factor de descuento de vinilo debe ser 0.50');

    const constantsModule = await import('../../src/components/manual-sale/manualSaleConstants.js');
    assert.equal(constantsModule.CUSTOM_PRESETS, undefined, 'PROHIBIDO exportar CUSTOM_PRESETS');
  });

  it('uploadCustomArt debe rechazar solicitudes sin archivo con HTTP 400', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const req = {};
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await uploadCustomArt(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonResponse.success, false);
    assert.match(jsonResponse.error, /No se recibió ningún archivo/);
  });

  it('uploadCustomArt debe rechazar archivos con magic bytes falsos o no soportados', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const fakeExeBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00');
    const req = {
      file: {
        buffer: fakeExeBuffer,
        originalname: 'malicious.exe',
        mimetype: 'application/octet-stream',
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await uploadCustomArt(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonResponse.success, false);
    assert.match(jsonResponse.error, /Firma binaria inválida/);
  });

  it('uploadCustomArt debe rechazar archivos que superen los 15MB', async () => {
    let statusCode = null;
    let jsonResponse = null;

    const largeBuffer = Buffer.alloc(16 * 1024 * 1024); // 16MB
    largeBuffer[0] = 0xFF;
    largeBuffer[1] = 0xD8;
    largeBuffer[2] = 0xFF;

    const req = {
      file: {
        buffer: largeBuffer,
        originalname: 'huge.jpg',
        mimetype: 'image/jpeg',
      },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(data) {
        jsonResponse = data;
        return this;
      },
    };

    await uploadCustomArt(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonResponse.success, false);
    assert.match(jsonResponse.error, /supera el límite máximo permitido de 15MB/);
  });

  it('🛡️ TEST GUARDIÁN: Ningún archivo en src/ ni server/ debe contener medidas o precios fantasmas (60x90, 60 x 90, GIGANTE.*180)', () => {
    function scanDir(dir, fileList = []) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath, fileList);
        } else if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) {
          fileList.push(fullPath);
        }
      }
      return fileList;
    }

    const srcFiles = scanDir(path.resolve('src'));
    const serverFiles = scanDir(path.resolve('server'));
    const allFiles = [...srcFiles, ...serverFiles];

    const violations = [];
    const ghostPattern = /(?:60\s*[xX]\s*90|90\s*[xX]\s*60|GIGANTE[^\n]*180)/;

    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        if (ghostPattern.test(line)) {
          violations.push(`${filePath}:${idx + 1} -> ${line.trim()}`);
        }
      });
    }

    assert.equal(
      violations.length,
      0,
      `Se encontraron residuos prohibidos de la medida inexistente 60x90 o precio 180 en el código:\n${violations.join('\n')}`
    );
  });
});
