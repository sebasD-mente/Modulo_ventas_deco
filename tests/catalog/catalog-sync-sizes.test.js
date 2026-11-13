import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  buildNormalizedPosterData,
  hasCatalogProductChanged,
} from '../../server/services/catalog/liveCatalogSyncService.js';

describe('Catalog Sync: Detección de cambios en tamaños (sizes)', () => {
  it('detecta cambio cuando se agrega Pequeño (Q35) a un póster que solo tenía Mini (Q25) manteniendo basePrice=25', () => {
    const prevProduct = {
      sku: 'WEB-mvdwj7c3',
      name: 'DeBí TiRAR MáS FOTOs - Playlist Spotify',
      category: 'MÚSICA & BANDAS',
      basePrice: 25,
      imageUrl: 'https://storage.googleapis.com/decovintage-master-media/posters/full/obra-mvdwj7c3-6768.webp',
      isActive: true,
      tags: ['debí tirar más fotos', 'playlist spotify', 'música & bandas', 'debí', 'tirar', 'más', 'fotos', 'playlist', 'spotify'],
      sizes: [
        { sizeId: 'MINI', nombre: 'Mini', dimensiones: '14 x 21 cm', precio: 25, badge: 'Escritorio y coleccionable' },
      ],
    };

    const incomingPoster = {
      id: 'mvdwj7c3',
      titulo: 'DeBí TiRAR MáS FOTOs',
      subtitulo: 'Playlist Spotify',
      categoria: 'MÚSICA & BANDAS',
      imageUrl: 'https://storage.googleapis.com/decovintage-master-media/posters/full/obra-mvdwj7c3-6768.webp',
      availableSizes: ['MINI', 'PEQUENO'],
    };

    const normalized = buildNormalizedPosterData(incomingPoster, 'tenant-1');
    assert.ok(normalized, 'Debe normalizar el póster');
    assert.strictEqual(normalized.data.basePrice, 25, 'basePrice mínimo sigue siendo 25');
    assert.strictEqual(normalized.data.sizes.length, 2, 'Debe incluir MINI y PEQUENO');
    assert.strictEqual(
      hasCatalogProductChanged(prevProduct, normalized.data),
      true,
      'hasCatalogProductChanged debe retornar true cuando cambia sizes aunque basePrice sea igual'
    );
  });

  it('retorna false cuando ningún campo ni sizes cambió', () => {
    const incomingPoster = {
      id: 'mvdwj7c3',
      titulo: 'DeBí TiRAR MáS FOTOs',
      subtitulo: 'Playlist Spotify',
      categoria: 'MÚSICA & BANDAS',
      imageUrl: 'https://storage.googleapis.com/decovintage-master-media/posters/full/obra-mvdwj7c3-6768.webp',
      availableSizes: ['MINI', 'PEQUENO'],
    };

    const normalized = buildNormalizedPosterData(incomingPoster, 'tenant-1');
    const prevProduct = {
      ...normalized.data,
      sizes: [...normalized.data.sizes].reverse(),
    };

    assert.strictEqual(
      hasCatalogProductChanged(prevProduct, normalized.data),
      false,
      'No debe disparar upsert si las mismas tallas solo difieren en orden'
    );
  });

  it('syncCatalogFromWeb y deltaSyncRecentPosters seleccionan sizes desde prisma.product', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'server/services/catalog/liveCatalogSyncService.js'),
      'utf-8'
    );
    const matches = src.match(/select:\s*\{[^}]*\bsizes:\s*true\b[^}]*\}/g) || [];
    assert.strictEqual(
      matches.length,
      2,
      'Tanto deltaSyncRecentPosters como syncCatalogFromWeb deben seleccionar sizes: true'
    );
  });
});
