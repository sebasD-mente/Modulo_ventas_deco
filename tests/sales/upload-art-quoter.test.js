import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
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
});
