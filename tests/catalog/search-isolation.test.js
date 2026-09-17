import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { searchWebPosters } from '../../server/services/webCatalogService.js';
import { productCache } from '../../server/services/catalog/catalogCacheStore.js';
import { resolveEntityAlias } from '../../server/services/semantic/entityAliases.js';

describe('🛡️ Suite de Aislamiento y Erradicación de Contaminación en Búsqueda de Catálogo', () => {
  const TEST_TENANT = 'tenant-search-isolation-test';

  const mockPosters = [
    {
      id: 'bb-1',
      titulo: 'Bad Bunny',
      subtitulo: 'Un Verano Sin Ti',
      categoria: 'MUSICA',
      imageUrl: 'https://cdn.example.com/bb-uvst.jpg',
      precioMinimo: 55,
      tags: ['musica', 'urbano', 'reggaeton', 'bad', 'bunny']
    },
    {
      id: 'bb-2',
      titulo: 'Bad Bunny',
      subtitulo: 'Nadie Sabe Lo Que Va A Pasar Mañana',
      categoria: 'MUSICA',
      imageUrl: 'https://cdn.example.com/bb-nadie.jpg',
      precioMinimo: 55,
      tags: ['musica', 'bad', 'bunny']
    },
    {
      id: 'bb-3',
      titulo: 'Bad Bunny',
      subtitulo: 'YHLQMDLG',
      categoria: 'MUSICA',
      imageUrl: 'https://cdn.example.com/bb-yhlqmdlg.jpg',
      precioMinimo: 55,
      tags: ['musica', 'bad', 'bunny']
    },
    {
      id: 'bb-series-1',
      titulo: 'Breaking Bad',
      subtitulo: 'Walter White Heisenberg',
      categoria: 'SERIESYPELICULAS',
      imageUrl: 'https://cdn.example.com/bb-heisenberg.jpg',
      precioMinimo: 65,
      tags: ['serie', 'quimica', 'heisenberg', 'breaking', 'bad']
    },
    {
      id: 'bb-series-2',
      titulo: 'Breaking Bad',
      subtitulo: 'Jesse Pinkman & RV',
      categoria: 'SERIESYPELICULAS',
      imageUrl: 'https://cdn.example.com/bb-jesse.jpg',
      precioMinimo: 65,
      tags: ['serie', 'breaking', 'bad']
    },
    {
      id: 'lana-1',
      titulo: 'Lana Del Rey',
      subtitulo: 'Verano en California',
      categoria: 'MUSICA',
      imageUrl: 'https://cdn.example.com/lana-verano.jpg',
      precioMinimo: 55,
      tags: ['musica', 'verano', 'california', 'indie']
    },
    {
      id: 'rick-1',
      titulo: 'Rick & Morty',
      subtitulo: 'Multiverse Portal Gun',
      categoria: 'INFANTILYDIBUJOSANIMADOS',
      imageUrl: 'https://cdn.example.com/rick-morty.jpg',
      precioMinimo: 45,
      tags: ['animacion', 'rick', 'morty']
    },
    {
      id: 'spiderman-1',
      titulo: 'Spider-Man Vintage Comic',
      subtitulo: 'Peter Parker Classic Marvel',
      categoria: 'SUPERHEROES',
      imageUrl: 'https://cdn.example.com/spiderman.jpg',
      precioMinimo: 65,
      tags: ['marvel', 'spider', 'man', 'peter', 'parker']
    },
    {
      id: 'chainsaw-1',
      titulo: 'Chainsaw Man',
      subtitulo: 'Denji & Pochita',
      categoria: 'ANIME',
      imageUrl: 'https://cdn.example.com/chainsaw.jpg',
      precioMinimo: 55,
      tags: ['anime', 'denji', 'pochita', 'manga']
    },
    {
      id: 'batman-1',
      titulo: 'Batman',
      subtitulo: 'The Dark Knight',
      categoria: 'SUPERHEROES',
      imageUrl: 'https://cdn.example.com/batman.jpg',
      precioMinimo: 65,
      tags: ['dc', 'batman', 'dark', 'knight']
    },
    {
      id: 'pablo-1',
      titulo: 'Pablo Escobar',
      subtitulo: 'Sonrisa Histórica',
      categoria: 'HISTORICOS',
      imageUrl: 'https://cdn.example.com/pablo-sonrisa.jpg',
      precioMinimo: 65,
      tags: ['pablo', 'escobar', 'patron', 'historicos']
    },
    {
      id: 'pablo-2',
      titulo: 'Pablo Escobar',
      subtitulo: 'Sneakerhead',
      categoria: 'HISTORICOS',
      imageUrl: 'https://cdn.example.com/pablo-sneakers.jpg',
      precioMinimo: 65,
      tags: ['pablo', 'escobar', 'sneakers']
    },
    {
      id: 'demon-1',
      titulo: 'Demon Slayer: Kimetsu no Yaiba',
      subtitulo: 'Tanjiro & Nezuko',
      categoria: 'ANIME',
      imageUrl: 'https://cdn.example.com/demon.jpg',
      precioMinimo: 65,
      tags: ['anime', 'tanjiro', 'nezuko', 'del', 'los', 'pilares']
    },
    {
      id: 'pink-1',
      titulo: 'Pink Floyd',
      subtitulo: 'The Dark Side of the Moon',
      categoria: 'MUSICA',
      imageUrl: 'https://cdn.example.com/pink.jpg',
      precioMinimo: 55,
      tags: ['musica', 'rock', 'prisma', 'del', 'triangulo']
    }
  ];

  before(() => {
    productCache.set(TEST_TENANT, {
      products: mockPosters,
      timestamp: Date.now() + 1000 * 60 * 60
    });
  });

  it('1. Búsqueda "bad bunny" devuelve pósters de Bad Bunny y 0 resultados de Breaking Bad, Lana Del Rey o Rick & Morty', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'bad bunny',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver al menos un póster de Bad Bunny');
    
    for (const item of results) {
      assert.strictEqual(item.titulo, 'Bad Bunny', `El ítem retornado debe ser de Bad Bunny, no "${item.titulo}"`);
    }

    const breakingBadCount = results.filter(r => /breaking\s+bad/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(breakingBadCount, 0, 'No debe retornar ningún póster de Breaking Bad');

    const lanaCount = results.filter(r => /lana\s+del\s+rey/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(lanaCount, 0, 'No debe retornar ningún póster de Lana Del Rey');

    const rickCount = results.filter(r => /rick/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(rickCount, 0, 'No debe retornar ningún póster de Rick & Morty');
  });

  it('2. Búsqueda "breaking bad" devuelve pósters de Walter White / Jesse y 0 resultados de Bad Bunny', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'breaking bad',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver al menos un póster de Breaking Bad');

    for (const item of results) {
      assert.strictEqual(item.titulo, 'Breaking Bad', `El ítem retornado debe ser Breaking Bad, no "${item.titulo}"`);
    }

    const badBunnyCount = results.filter(r => /bad\s+bunny/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(badBunnyCount, 0, 'No debe retornar ningún póster de Bad Bunny');
  });

  it('3. Búsqueda "spider man" no devuelve pósters de Chainsaw Man o Batman', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'spider man',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver el póster de Spider-Man');
    assert.ok(results.some(r => /spider/i.test(r.titulo)), 'Debe contener Spider-Man');

    const chainsawCount = results.filter(r => /chainsaw/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(chainsawCount, 0, 'No debe retornar pósters de Chainsaw Man');

    const batmanCount = results.filter(r => /batman/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(batmanCount, 0, 'No debe retornar pósters de Batman');
  });

  it('4. Búsqueda por alias "conejo malo" devuelve Bad Bunny y cero contaminantes', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'conejo malo',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe resolver conejo malo');
    for (const item of results) {
      assert.strictEqual(item.titulo, 'Bad Bunny');
    }
  });

  it('5. Búsqueda por álbum "un verano sin ti" devuelve Bad Bunny y descarta Lana Del Rey', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'un verano sin ti',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver el álbum');
    assert.strictEqual(results[0].titulo, 'Bad Bunny');
    assert.strictEqual(results[0].subtitulo, 'Un Verano Sin Ti');

    const lanaCount = results.filter(r => /lana/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(lanaCount, 0, 'No debe contener a Lana Del Rey');
  });

  it('6. resolveEntityAlias("y los del patron?") devuelve matched: true con canonicalTitle de Pablo Escobar', () => {
    const res = resolveEntityAlias('y los del patron?');
    assert.strictEqual(res.matched, true);
    assert.ok(res.canonicalTitle.includes('Pablo Escobar'));
    assert.strictEqual(res.searchQuery, 'Pablo Escobar');
  });

  it('7. resolveEntityAlias("el patron"), resolveEntityAlias("del patron") y resolveEntityAlias("patron") resuelven a Pablo Escobar', () => {
    for (const q of ['el patron', 'del patron', 'patron', 'el patrón', 'del patrón', 'los del patron', 'los del patrón']) {
      const res = resolveEntityAlias(q);
      assert.strictEqual(res.matched, true, `Fallo al resolver alias: "${q}"`);
      assert.ok(res.canonicalTitle.includes('Pablo Escobar'), `canonicalTitle incorrecto para "${q}"`);
      assert.strictEqual(res.searchQuery, 'Pablo Escobar');
    }
  });

  it('8. Búsqueda en catálogo de "y los del patron?" devuelve los pósters de Pablo Escobar y 0 pósters de Demon Slayer o Pink Floyd', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'y los del patron?',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver al menos un póster de Pablo Escobar');
    for (const item of results) {
      assert.strictEqual(item.titulo, 'Pablo Escobar', `El ítem retornado debe ser Pablo Escobar, no "${item.titulo}"`);
    }

    const demonCount = results.filter(r => /demon/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(demonCount, 0, 'No debe retornar pósters de Demon Slayer');

    const pinkCount = results.filter(r => /pink/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(pinkCount, 0, 'No debe retornar pósters de Pink Floyd');
  });

  it('9. Búsqueda "el patron" devuelve pósters de Pablo Escobar y 0 de Demon Slayer o Pink Floyd', async () => {
    const results = await searchWebPosters({
      tenantId: TEST_TENANT,
      query: 'el patron',
      limit: 10
    });

    assert.ok(results.length >= 1, 'Debe devolver al menos un póster de Pablo Escobar');
    for (const item of results) {
      assert.strictEqual(item.titulo, 'Pablo Escobar');
    }

    const demonCount = results.filter(r => /demon/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(demonCount, 0);

    const pinkCount = results.filter(r => /pink/i.test(`${r.titulo} ${r.subtitulo}`)).length;
    assert.strictEqual(pinkCount, 0);
  });
});
