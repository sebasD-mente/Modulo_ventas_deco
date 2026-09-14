import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { resolveEntityAlias, normalizeArtworkQuery } from '../server/services/semantic/entityAliases.js';

describe('🕷️ Suite de Verificación: Sincronización y Búsqueda Spider-Man (STAND {IA})', () => {

  it('1. resolveEntityAlias discrimina con precisión "spiderman acuarela azul"', () => {
    const alias = resolveEntityAlias('spiderman acuarela azul grande en efectivo');
    assert.strictEqual(alias.matched, true);
    assert.strictEqual(alias.canonicalTitle, 'Spider-Man - Traje Avanzado en Óleo y Acuarela');
    assert.strictEqual(alias.searchQuery, 'Spider-Man Traje Avanzado Óleo y Acuarela');
  });

  it('2. resolveEntityAlias discrimina "spiderman oleo" y variantes hacia Óleo y Acuarela', () => {
    const alias1 = resolveEntityAlias('spiderman oleo y acuarela');
    assert.strictEqual(alias1.matched, true);
    assert.strictEqual(alias1.canonicalTitle, 'Spider-Man - Traje Avanzado en Óleo y Acuarela');

    const alias2 = resolveEntityAlias('spider oleo');
    assert.strictEqual(alias2.matched, true);
    assert.strictEqual(alias2.canonicalTitle, 'Spider-Man - Traje Avanzado en Óleo y Acuarela');

    const alias3 = resolveEntityAlias('spiderman acuarela');
    assert.strictEqual(alias3.matched, true);
    assert.strictEqual(alias3.canonicalTitle, 'Spider-Man - Traje Avanzado en Acuarela');
  });

  it('3. normalizeArtworkQuery preserva la variante de Óleo y Acuarela', () => {
    const norm = normalizeArtworkQuery('dame spiderman acuarela azul por favor');
    assert.strictEqual(norm, 'Spider-Man Traje Avanzado Óleo y Acuarela');
  });

  it('4. liveCatalogSyncService tiene delta-sync con lote amplio (take=100) y paracaídas tokenizado', () => {
    const liveSyncCode = fs.readFileSync(
      path.join(process.cwd(), 'server/services/catalog/liveCatalogSyncService.js'),
      'utf-8'
    );
    assert.ok(liveSyncCode.includes('take=100'), 'deltaSyncRecentPosters debe usar take=100 para evitar puntos ciegos');
    assert.ok(liveSyncCode.includes('queryTokens.slice(0, 3)'), 'searchLiveWebParachute debe tokenizar consultas compuestas');
    assert.ok(liveSyncCode.includes('descTokens'), 'normalizeAndUpsertPoster debe enriquecer tags con tokens de descripción');
  });

  it('5. catalogSyncService unifica el tenant slug para deco-vintage-guate', () => {
    const fullSyncCode = fs.readFileSync(
      path.join(process.cwd(), 'server/services/catalogSyncService.js'),
      'utf-8'
    );
    assert.ok(
      fullSyncCode.includes("deco-vintage-guate"),
      'catalogSyncService debe soportar el tenant slug oficial deco-vintage-guate'
    );
    assert.ok(
      fullSyncCode.includes("descTokens"),
      'catalogSyncService debe incluir descripción en combinedTags'
    );
  });

  it('6. Frontend de búsqueda y swap solicita hasta 30 pósters (sin truncar en 8)', () => {
    const catalogSearchHook = fs.readFileSync(
      path.join(process.cwd(), 'src/components/manual-sale/hooks/useCatalogSearch.js'),
      'utf-8'
    );
    assert.ok(catalogSearchHook.includes('limit=30'), 'useCatalogSearch debe solicitar limit=30');

    const aiChatHook = fs.readFileSync(
      path.join(process.cwd(), 'src/components/ai-chat/hooks/useAiChatStream.js'),
      'utf-8'
    );
    assert.ok(aiChatHook.includes('limit=30'), 'useAiChatStream debe solicitar limit=30 en swap de pósters');
  });

});
