/**
 * 📴 DEKO LABS — SALES OUTBOX (COLA OFFLINE INDEXEDDB & LOCALSTORAGE)
 * Absorbe caídas totales de conectividad en salones de convenciones feriales (Interfer / Comic-Con).
 * Garantiza resiliencia transaccional, idempotencia estricta (RFC 7231) y auto-sincronización.
 */

const STORAGE_KEY = 'deko_offline_sales_queue';
const DB_NAME = 'DekoSalesDB';
const DB_VERSION = 1;
const STORE_NAME = 'sales_outbox';

let memoryFallbackQueue = [];

// Helper para abrir IndexedDB de forma resiliente
function openIndexedDB() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Guarda una venta pendiente en la cola offline (IndexedDB con fallback a localStorage/memoria).
 */
export async function savePendingSaleOffline(salePayload) {
  if (!salePayload) return null;
  const idempotencyKey = salePayload.idempotencyKey || `offline-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const record = {
    ...salePayload,
    idempotencyKey,
    offline: true,
    syncStatus: 'PENDING',
    queuedAt: new Date().toISOString(),
    retryCount: 0,
  };

  const db = await openIndexedDB();
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
      return record;
    } catch {
      // Fallback a localStorage
    }
  }

  // Fallback seguro a localStorage o memoria
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const existing = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = existing.filter((item) => item.idempotencyKey !== idempotencyKey);
      filtered.push(record);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return record;
    }
  } catch {}

  // Fallback de memoria (ej. Node.js unit tests)
  memoryFallbackQueue = memoryFallbackQueue.filter((item) => item.idempotencyKey !== idempotencyKey);
  memoryFallbackQueue.push(record);
  return record;
}

/**
 * Retorna todas las ventas pendientes de sincronización en la cola.
 */
export async function getPendingOfflineSales() {
  const db = await openIndexedDB();
  if (db) {
    try {
      const records = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
      if (Array.isArray(records) && records.length > 0) {
        return records.filter((r) => r.syncStatus === 'PENDING');
      }
    } catch {
      // Continuar con fallback
    }
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter((r) => r.syncStatus === 'PENDING') : [];
    }
  } catch {}

  return memoryFallbackQueue.filter((r) => r.syncStatus === 'PENDING');
}

/**
 * Remueve una venta sincronizada de la cola offline.
 */
export async function removePendingOfflineSale(idempotencyKey) {
  if (!idempotencyKey) return false;

  const db = await openIndexedDB();
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(idempotencyKey);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
      const filtered = stored.filter((item) => item.idempotencyKey !== idempotencyKey);
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    }
  } catch {}

  memoryFallbackQueue = memoryFallbackQueue.filter((item) => item.idempotencyKey !== idempotencyKey);
  return true;
}

export const markSaleSynced = removePendingOfflineSale;

/**
 * Vacía la cola en memoria/almacenamiento (útil para pruebas y reseteo).
 */
export async function clearOfflineSalesQueue() {
  const db = await openIndexedDB();
  if (db) {
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } catch {}
  }

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}

  memoryFallbackQueue = [];
  return true;
}

/**
 * Sincroniza la cola offline enviando secuencialmente cada venta a POST /api/sales.
 */
export async function syncOfflineSalesQueue(authFetch = null) {
  const fetcher = authFetch || (typeof window !== 'undefined' ? window.fetch : null);
  if (!fetcher) return { syncedCount: 0, failedCount: 0, pending: 0 };

  const pending = await getPendingOfflineSales();
  if (!pending.length) return { syncedCount: 0, failedCount: 0, pending: 0 };

  let syncedCount = 0;
  let failedCount = 0;

  for (const sale of pending) {
    try {
      const res = await fetcher('/api/sales', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': sale.idempotencyKey,
        },
        body: JSON.stringify({
          eventId: sale.eventId,
          items: sale.items,
          payments: sale.payments,
          discount: sale.discount,
          notes: sale.notes,
          inputChannel: sale.inputChannel || 'OFFLINE_SYNC',
          attachments: sale.attachments || [],
          idempotencyKey: sale.idempotencyKey,
        }),
      });

      const json = await res.json();
      // Si fue exitoso o replay idempotente confirmado
      if (res.ok && (json.success || json.idempotentReplay)) {
        await removePendingOfflineSale(sale.idempotencyKey);
        syncedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  const remaining = await getPendingOfflineSales();
  return { syncedCount, failedCount, pending: remaining.length };
}

// Auto-sincronización al volver la conectividad
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncOfflineSalesQueue().catch(() => {});
  });
}
