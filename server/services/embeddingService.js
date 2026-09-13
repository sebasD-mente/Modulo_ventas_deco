import { getGeminiClient } from '../config/gemini.js';
import { getNextClient } from './ai/aiKeyPoolService.js';
import { ENV } from '../config/env.js';
import { searchWebPosters, deduplicatePosters, getCachedProducts } from './webCatalogService.js';

export const EMBEDDING_MODEL = ENV.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';
export const MIN_SIMILARITY_THRESHOLD = 0.45;
export const VECTOR_CACHE_TTL_MS = 30 * 60 * 1000;

const vectorCache = new Map();
const warmingPromises = new Map();

export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !vecA.length || !vecB.length || vecA.length !== vecB.length) return 0.0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0.0;
  return Math.max(-1.0, Math.min(1.0, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}
export const computeCosineSimilarity = cosineSimilarity;

export function posterToEmbeddingText(p) {
  const tags = Array.isArray(p?.tags) ? p.tags.join(' ') : '';
  let cat = p?.categoria || '';
  if (cat === 'BASKETBALL_Y_FORMULA_1') {
    const isBasket = /(lakers|nba|basket|jordan|kobe|lebron|bulls|mamba)/i.test(`${p?.titulo || ''} ${p?.subtitulo || ''} ${tags}`);
    cat = isBasket ? 'BASKETBALL' : 'FORMULA 1';
  }
  return `${p?.titulo || ''} ${p?.subtitulo || ''} ${cat} ${tags}`.replace(/\s+/g, ' ').trim();
}

export function clearVectorCache(tenantId = null) {
  if (tenantId) {
    for (const k of vectorCache.keys()) if (k.startsWith(`${tenantId}:`)) vectorCache.delete(k);
  } else vectorCache.clear();
}
export const invalidateVectorCache = clearVectorCache;
export const getVectorCacheStats = () => ({ size: vectorCache.size });

export async function embedTexts(texts, client = null, taskType = null) {
  if (!texts?.length) return [];
  const contents = texts.map((t) => String(t || '').trim()).filter(Boolean);
  if (!contents.length) return [];
  const activeClient = client || getNextClient(EMBEDDING_MODEL)?.client || getGeminiClient(EMBEDDING_MODEL);
  if (!activeClient) throw new Error('GEMINI_CLIENT_UNAVAILABLE');

  const config = taskType ? { taskType } : {};
  const response = await activeClient.models.embedContent({ model: EMBEDDING_MODEL, contents, config });
  const raw = response?.embeddings || (response?.embedding ? [response.embedding] : []);
  return raw.map((e) => (e?.values ? Array.from(e.values) : null)).filter(Boolean);
}

export async function getPosterEmbedding(poster, { client = null, tenantId = null } = {}) {
  const key = `${tenantId || '__GLOBAL__'}:${poster.id || poster.sku || poster.titulo}`;
  const cached = vectorCache.get(key);
  if (cached && Date.now() - cached.timestamp < VECTOR_CACHE_TTL_MS) return cached.vector;

  const [vector] = await embedTexts([posterToEmbeddingText(poster)], client, 'RETRIEVAL_DOCUMENT');
  if (vector) vectorCache.set(key, { id: poster.id, poster, vector, timestamp: Date.now() });
  return vector || null;
}

export async function warmCatalogVectors(tenantId = null, forceRefresh = false, client = null) {
  const key = tenantId || '__GLOBAL__';
  if (warmingPromises.has(key)) return warmingPromises.get(key);

  const warmPromise = (async () => {
    try {
      const getProds = typeof getCachedProducts === 'function' ? getCachedProducts : (t) => searchWebPosters({ tenantId: t, query: '', limit: 1000 });
      const products = await getProds(tenantId);
      const deduplicated = deduplicatePosters(products);
      if (!deduplicated.length) return [];

      const toFetch = [], items = [];
      for (const p of deduplicated) {
        const cKey = `${key}:${p.id || p.sku || p.titulo}`;
        const cached = vectorCache.get(cKey);
        if (!forceRefresh && cached && Date.now() - cached.timestamp < VECTOR_CACHE_TTL_MS) items.push(cached);
        else toFetch.push(p);
      }

      const BATCH = 50;
      for (let i = 0; i < toFetch.length; i += BATCH) {
        const batch = toFetch.slice(i, i + BATCH);
        const vectors = await embedTexts(batch.map(posterToEmbeddingText), client, 'RETRIEVAL_DOCUMENT');
        for (let j = 0; j < vectors.length; j++) {
          if (vectors[j]) {
            const entry = { id: batch[j].id, poster: batch[j], vector: vectors[j], timestamp: Date.now() };
            vectorCache.set(`${key}:${batch[j].id || batch[j].sku || batch[j].titulo}`, entry);
            items.push(entry);
          }
        }
      }
      return items;
    } catch (err) {
      console.warn('[EmbeddingService] ⚠️ Error pre-calentando vectores:', err.message);
      return Array.from(vectorCache.values()).filter((e) => e?.vector);
    } finally {
      warmingPromises.delete(key);
    }
  })();

  warmingPromises.set(key, warmPromise);
  return warmPromise;
}

export async function searchHybridPosters({ tenantId = null, query = '', category = null, limit = 12, minThreshold = MIN_SIMILARITY_THRESHOLD, client = null } = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    const res = await searchWebPosters({ tenantId, query: '', category, limit });
    const finalRes = Array.isArray(res) ? [...res] : [];
    finalRes.results = finalRes;
    finalRes.source = 'lexical';
    return finalRes;
  }
  try {
    const queryVectors = await embedTexts([cleanQuery], client, 'RETRIEVAL_QUERY');
    if (!queryVectors?.length) throw new Error('EMBEDDINGS_UNAVAILABLE');
    const cachedItems = await warmCatalogVectors(tenantId, false, client);
    if (!cachedItems?.length) throw new Error('CATALOG_VECTORS_UNAVAILABLE');

    const queryVec = queryVectors[0], scored = [];
    for (const item of cachedItems) {
      if (category && String(category).trim().toUpperCase() !== (item.poster.categoria || '').toUpperCase()) continue;
      const sim = cosineSimilarity(queryVec, item.vector);
      if (sim >= minThreshold) scored.push({ poster: item.poster, similarity: sim });
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    const res = scored.length > 0 ? deduplicatePosters(scored.map((s) => s.poster)).slice(0, limit) : [];
    res.results = res;
    res.source = 'vector';
    return res;
  } catch (err) {
    console.warn(`[RAG Hybrid Parachute] 🪂 Conmutando a búsqueda léxica local: ${err.message}`);
    const res = await searchWebPosters({ tenantId, query: cleanQuery, category, limit });
    const finalRes = Array.isArray(res) ? [...res] : [];
    finalRes.results = finalRes;
    finalRes.source = 'lexical_parachute';
    return finalRes;
  }
}
export const searchPostersByEmbedding = searchHybridPosters;
