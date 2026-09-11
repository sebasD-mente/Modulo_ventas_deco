import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicatePosters,
  extractImageSlug,
  normalizePosterTitle,
} from '../../server/services/webCatalogService.js';

describe('🎯 Suite de Deduplicación Bicapa de Catálogo Web (webCatalogService)', () => {
  it('1. Manejo resiliente de entradas vacías o inválidas', () => {
    assert.deepEqual(deduplicatePosters(null), []);
    assert.deepEqual(deduplicatePosters(undefined), []);
    assert.deepEqual(deduplicatePosters([]), []);
    assert.deepEqual(deduplicatePosters([null, undefined, {}]), []);
  });

  it('2. extractImageSlug extrae el identificador eliminando extensiones, query params y dimensiones', () => {
    assert.equal(
      extractImageSlug('https://storage.googleapis.com/deko-eventsales-media/sample.jpg'),
      'sample'
    );
    assert.equal(
      extractImageSlug('https://decovintage.online/uploads/posters/bad-bunny-un-verano-sin-ti-500x750.webp?v=2'),
      'bad-bunny-un-verano-sin-ti'
    );
    assert.equal(extractImageSlug(null), null);
    assert.equal(extractImageSlug(''), null);
  });

  it('3. normalizePosterTitle normaliza acentos, puntuaciones y espacios', () => {
    assert.equal(
      normalizePosterTitle('Pablo Escobar (Sonrisa / Mugshot)'),
      'pablo escobar sonrisa mugshot'
    );
    assert.equal(
      normalizePosterTitle('pablo escobar - sonrisa / mugshot!'),
      'pablo escobar sonrisa mugshot'
    );
  });

  it('4. Capa 1: Deduplica pósters con ID repetido', () => {
    const list = [
      { id: 'poster-1', name: 'Obra 1', imageUrl: 'https://cdn/img1.jpg' },
      { id: 'poster-1', name: 'Obra 1 Clon', imageUrl: 'https://cdn/img2.jpg' },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, 'Obra 1');
  });

  it('5. Capa 2A: Deduplica pósters con distinto ID pero misma imagen (imageSlug)', () => {
    const list = [
      { id: 'p-alpha', name: 'Spider-Man Vintage', imageUrl: 'https://cdn/spiderman-classic.webp' },
      { id: 'p-beta', name: 'Hombre Araña Clásico', imageUrl: 'https://cdn/spiderman-classic-500x750.webp?token=123' },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'p-alpha');
  });

  it('6. Capa 2B: Deduplica pósters con distinto ID e imagen pero título semánticamente idéntico', () => {
    const list = [
      { id: 'p-1', name: 'Taylor Swift - 1989 (Taylor\'s Version)', imageUrl: 'https://cdn/img1.jpg' },
      { id: 'p-2', name: 'Taylor Swift: 1989 (Taylors Version)!', imageUrl: 'https://cdn/img2.jpg' },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'p-1');
  });

  it('7. NO colisiona obras diferentes del mismo artista', () => {
    const list = [
      { id: 'p-bb1', name: 'Bad Bunny - Un Verano Sin Ti', imageUrl: 'https://cdn/uvst.jpg' },
      { id: 'p-bb2', name: 'Bad Bunny - YHLQMDLG', imageUrl: 'https://cdn/yhlqmdlg.jpg' },
      { id: 'p-bb3', name: 'Bad Bunny - Nadie Sabe Lo Que Va a Pasar Mañana', imageUrl: 'https://cdn/nslqvapm.jpg' },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 3, 'Debe preservar las 3 obras distintas del mismo artista');
  });

  it('8. No descarta pósters sin imagen si sus títulos e IDs son distintos', () => {
    const list = [
      { id: 'p-noimg1', name: 'Obra Sin Foto 1', imageUrl: null },
      { id: 'p-noimg2', name: 'Obra Sin Foto 2', imageUrl: null },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 2);
  });

  it('9. Preserva el orden de relevancia original', () => {
    const list = [
      { id: 'top-1', name: 'Top Hit', imageUrl: 'https://cdn/hit.jpg', score: 100 },
      { id: 'dup-1', name: 'Top Hit Clon', imageUrl: 'https://cdn/hit.jpg', score: 80 },
      { id: 'top-2', name: 'Second Hit', imageUrl: 'https://cdn/second.jpg', score: 60 },
    ];
    const result = deduplicatePosters(list);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, 'top-1');
    assert.equal(result[1].id, 'top-2');
  });
});
