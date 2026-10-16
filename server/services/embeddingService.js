import crypto from 'node:crypto';
import { executeWithModelFallback } from './geminiPoolService.js';
import { ENV } from '../config/env.js';
import { prisma } from '../config/prisma.js';
import { searchWebPosters, deduplicatePosters, getCachedProducts } from './webCatalogService.js';
import { UNIVERSAL_STOP_WORDS, KNOWN_SHORT_ENTITIES, resolveEntityAlias } from './semantic/entityAliases.js';

export const EMBEDDING_MODEL = ENV.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001', MIN_SIMILARITY_THRESHOLD = 0.45, VECTOR_CACHE_TTL_MS = 30 * 60 * 1000;
const vectorCache = new Map(), warmingPromises = new Map();

export function computePosterEmbeddingHash(poster) {
  const text = posterToEmbeddingText(poster);
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 32);
}

export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !vecA.length || !vecB.length || vecA.length !== vecB.length) return 0.0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < vecA.length; i++) { dot += vecA[i] * vecB[i]; normA += vecA[i] * vecA[i]; normB += vecB[i] * vecB[i]; }
  if (normA === 0 || normB === 0) return 0.0;
  return Math.max(-1.0, Math.min(1.0, dot / (Math.sqrt(normA) * Math.sqrt(normB))));
}
export const computeCosineSimilarity = cosineSimilarity;

export function posterToEmbeddingText(p) {
  const tags = Array.isArray(p?.tags) ? p.tags.join(' ') : '';
  let cat = p?.categoria || '';
  if (cat === 'BASKETBALL_Y_FORMULA_1') {
    cat = /(lakers|nba|basket|jordan|kobe|lebron|bulls|mamba)/i.test(`${p?.titulo || ''} ${p?.subtitulo || ''} ${tags}`) ? 'BASKETBALL' : 'FORMULA 1';
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
  const config = taskType ? { taskType } : {};
  const { result: response } = await executeWithModelFallback({
    taskFn: async ({ model, client: activeClient }) => {
      if (!activeClient) throw new Error('GEMINI_CLIENT_UNAVAILABLE');
      return activeClient.models.embedContent({ model, contents, config });
    },
    models: [EMBEDDING_MODEL], actionName: 'EMBED_TEXTS', client,
  });
  const raw = response?.embeddings || (response?.embedding ? [response.embedding] : []);
  return raw.map((e) => (e?.values ? Array.from(e.values) : null)).filter(Boolean);
}
export async function getPosterEmbedding(poster, { client = null, tenantId = null } = {}) {
  const currentHash = computePosterEmbeddingHash(poster);
  const key = `${tenantId || '__GLOBAL__'}:${poster.id || poster.sku || poster.titulo}`;
  const cached = vectorCache.get(key);
  if (cached && cached.hash === currentHash && Date.now() - cached.timestamp < VECTOR_CACHE_TTL_MS) {
    return cached.vector;
  }
  if (Array.isArray(poster?.embedding) && poster.embedding.length > 0 && (!poster.embeddingHash || poster.embeddingHash === currentHash)) {
    vectorCache.set(key, { id: poster.id, poster, vector: poster.embedding, hash: currentHash, timestamp: Date.now() });
    return poster.embedding;
  }
  const [vector] = await embedTexts([posterToEmbeddingText(poster)], client, 'RETRIEVAL_DOCUMENT');
  if (vector) {
    vectorCache.set(key, { id: poster.id, poster, vector, hash: currentHash, timestamp: Date.now() });
    if (poster.id || poster.sku) {
      const where = poster.id ? { id: poster.id } : { sku: poster.sku };
      prisma?.product?.updateMany?.({
        where,
        data: { embedding: vector, embeddingHash: currentHash, embeddingUpdatedAt: new Date() },
      }).catch(() => {});
    }
  }
  return vector || null;
}

export async function warmCatalogVectors(tenantId = null, forceRefresh = false, client = null) {
  const key = tenantId || '__GLOBAL__';
  if (warmingPromises.has(key)) return warmingPromises.get(key);
  const warmPromise = (async () => {
    try {
      const getProds = typeof getCachedProducts === 'function' ? getCachedProducts : (t) => searchWebPosters({ tenantId: t, query: '', limit: 1000 });
      const deduplicated = deduplicatePosters(await getProds(tenantId));
      if (!deduplicated.length) return [];
      const toFetch = [], items = [];
      for (const p of deduplicated) {
        const cKey = `${key}:${p.id || p.sku || p.titulo}`;
        const currentHash = computePosterEmbeddingHash(p);
        const cached = vectorCache.get(cKey);

        if (!forceRefresh && cached && cached.hash === currentHash && Date.now() - cached.timestamp < VECTOR_CACHE_TTL_MS) {
          items.push(cached);
        } else if (!forceRefresh && Array.isArray(p.embedding) && p.embedding.length > 0 && (!p.embeddingHash || p.embeddingHash === currentHash)) {
          const entry = { id: p.id, poster: p, vector: p.embedding, hash: currentHash, timestamp: Date.now() };
          vectorCache.set(cKey, entry);
          items.push(entry);
        } else {
          toFetch.push({ poster: p, hash: currentHash });
        }
      }

      for (let i = 0; i < toFetch.length; i += 50) {
        const batch = toFetch.slice(i, i + 50);
        const vectors = await embedTexts(batch.map((b) => posterToEmbeddingText(b.poster)), client, 'RETRIEVAL_DOCUMENT');
        for (let j = 0; j < vectors.length; j++) {
          if (vectors[j]) {
            const { poster: p, hash } = batch[j];
            const entry = { id: p.id, poster: p, vector: vectors[j], hash, timestamp: Date.now() };
            vectorCache.set(`${key}:${p.id || p.sku || p.titulo}`, entry);
            items.push(entry);

            if (p.id || p.sku) {
              const where = p.id ? { id: p.id } : { sku: p.sku };
              prisma?.product?.updateMany?.({
                where,
                data: { embedding: vectors[j], embeddingHash: hash, embeddingUpdatedAt: new Date() },
              }).catch(() => {});
            }
          }
        }
      }
      return items;
    } catch (err) {
      console.warn('[EmbeddingService] ⚠️ Error pre-calentando vectores:', err.message);
      return Array.from(vectorCache.values()).filter((e) => e?.vector);
    } finally { warmingPromises.delete(key); }
  })();
  warmingPromises.set(key, warmPromise);
  return warmPromise;
}

export async function searchHybridPosters({ tenantId = null, query = '', category = null, limit = 12, minThreshold = 0.55, client = null } = {}) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) {
    const res = await searchWebPosters({ tenantId, query: '', category, limit });
    const finalRes = Array.isArray(res) ? [...res] : [];
    finalRes.results = finalRes; finalRes.source = 'lexical';
    return finalRes;
  }
  const lexicalMatches = await searchWebPosters({ tenantId, query: cleanQuery, category, limit: 30 });
  const lexicalList = Array.isArray(lexicalMatches) ? deduplicatePosters(lexicalMatches) : [];
  const aliasRes = resolveEntityAlias(cleanQuery);
  const effectiveQuery = (aliasRes.matched && aliasRes.searchQuery) ? aliasRes.searchQuery : cleanQuery;
  const extractTokens = (q) => (q || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter((t) => (t.length > 2 || KNOWN_SHORT_ENTITIES.has(t)) && !UNIVERSAL_STOP_WORDS.has(t));
  const rawTokens = extractTokens(cleanQuery);
  const normQueryTokens = rawTokens.length > 0 ? rawTokens : extractTokens(effectiveQuery);
  try {
    if (vectorCache.size === 0 && !client && lexicalList.length > 25) {
      warmCatalogVectors(tenantId, false, client).catch(() => {});
      const res = deduplicatePosters(lexicalList).slice(0, limit);
      res.results = res; res.source = 'lexical_parachute'; res.fallbackMode = 'lexical_warming_async';
      return res;
    }
    const queryVectors = await embedTexts([effectiveQuery], client, 'RETRIEVAL_QUERY');
    if (!queryVectors?.length) throw new Error('EMBEDDINGS_UNAVAILABLE');
    const cachedItems = await warmCatalogVectors(tenantId, false, client);
    if (!cachedItems?.length) throw new Error('CATALOG_VECTORS_UNAVAILABLE');
    const queryVec = queryVectors[0], vectorScores = new Map();
    for (const item of cachedItems) {
      if (category && String(category).trim().toUpperCase() !== (item.poster.categoria || '').toUpperCase()) continue;
      const sim = cosineSimilarity(queryVec, item.vector);
      if (sim >= minThreshold) vectorScores.set(item.poster.id || item.poster.sku || item.poster.titulo, { poster: item.poster, similarity: sim });
    }
    const combinedScores = new Map();
    lexicalList.forEach((poster, rank) => {
      const key = poster.id || poster.sku || poster.titulo, lexicalWeight = Math.max(0.2, 1.0 - (rank * 0.05));
      const vecSim = vectorScores.get(key)?.similarity || 0.0, vecBoost = vecSim >= 0.70 ? (vecSim - 0.70) * 2.0 : 0.0;
      combinedScores.set(key, { poster, hybridScore: (lexicalWeight * 0.40) + (vecSim * 0.60) + vecBoost });
    });
    for (const [key, vecEntry] of vectorScores.entries()) {
      const p = vecEntry.poster, pText = `${p.titulo || ''} ${p.subtitulo || ''} ${Array.isArray(p.tags) ? p.tags.join(' ') : ''}`.toLowerCase();
      const matchesEntity = normQueryTokens.length === 0 || normQueryTokens.every((t) => pText.includes(t));
      if (!combinedScores.has(key) && vecEntry.similarity >= 0.72 && matchesEntity) {
        const vecSim = vecEntry.similarity, vecBoost = (vecSim - 0.70) * 2.0;
        combinedScores.set(key, { poster: p, hybridScore: (vecSim * 0.85) + vecBoost });
      }
    }
    let filteredList = Array.from(combinedScores.values()).sort((a, b) => b.hybridScore - a.hybridScore).map((m) => m.poster);
    if (lexicalList.length > 0 && lexicalList.length <= 4 && normQueryTokens.length > 0) {
      const sharedTokens = normQueryTokens.filter((tok) => lexicalList.every((p) => `${p.titulo || ''} ${p.subtitulo || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(tok)));
      if (sharedTokens.length > 0) filteredList = filteredList.filter((p) => sharedTokens.every((tok) => `${p.titulo || ''} ${p.subtitulo || ''} ${(p.tags || []).join(' ')}`.toLowerCase().includes(tok)));
    }
    const res = deduplicatePosters(filteredList).slice(0, limit);
    res.results = res; res.source = 'vector';
    return res;
  } catch (err) {
    console.warn(`[RAG Hybrid Parachute] 🪂 Conmutando a búsqueda léxica local: ${err.message}`);
    const res = deduplicatePosters(lexicalList).slice(0, limit);
    res.results = res; res.source = 'lexical_parachute';
    return res;
  }
}
export const searchPostersByEmbedding = searchHybridPosters;
