import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const BASE_URL = process.env.TEST_BASE_URL || `http://localhost:${process.env.PORT || '3001'}`;
export const JWT_SECRET = process.env.JWT_SECRET || 'deco_eventsales_jwt_secret_2026_super_secure_key_dekolabs';

// Known default fixtures for fallback if database query is unavailable
export const DEFAULT_TENANT_ID = '9e2f9c77-8eec-47fe-b8bb-6f1d1e5e1e51';
export const DEFAULT_USER_ID = '976521eb-89a1-4173-89fb-6b313130f69c';

/**
 * Generates a signed JWT with arbitrary payload and options
 */
export function generateToken(payload, options = {}, secret = JWT_SECRET) {
  const defaultPayload = {
    id: DEFAULT_USER_ID,
    tenantId: DEFAULT_TENANT_ID,
    email: 'admin@dekolabs.com',
    fullName: 'Test Admin',
    role: 'ADMIN_EMPRESA',
  };
  return jwt.sign({ ...defaultPayload, ...payload }, secret, {
    expiresIn: options.expiresIn || '2h',
    ...options,
  });
}

/**
 * Returns a valid Admin JWT token
 */
export function getValidAdminToken(tenantId = DEFAULT_TENANT_ID, userId = DEFAULT_USER_ID) {
  return generateToken({
    id: userId,
    tenantId,
    email: 'admin@dekolabs.com',
    fullName: 'Administrador E2E',
    role: 'ADMIN_EMPRESA',
  });
}

/**
 * Returns a valid Booth Seller JWT token
 */
export function getValidSellerToken(tenantId = DEFAULT_TENANT_ID, userId = DEFAULT_USER_ID) {
  return generateToken({
    id: userId,
    tenantId,
    email: 'vendedor@dekolabs.com',
    fullName: 'Vendedor Stand E2E',
    role: 'ENCARGADO_STAND',
  });
}

/**
 * Returns an already expired JWT token
 */
export function getExpiredToken(tenantId = DEFAULT_TENANT_ID, userId = DEFAULT_USER_ID) {
  return jwt.sign(
    {
      id: userId,
      tenantId,
      email: 'expired@dekolabs.com',
      role: 'ENCARGADO_STAND',
    },
    JWT_SECRET,
    { expiresIn: '-10s' }
  );
}

/**
 * Returns a JWT token signed with an invalid secret
 */
export function getInvalidSecretToken(tenantId = DEFAULT_TENANT_ID, userId = DEFAULT_USER_ID) {
  return jwt.sign(
    {
      id: userId,
      tenantId,
      email: 'hacker@malicious.com',
      role: 'ADMIN_EMPRESA',
    },
    'wrong_alien_secret_key_12345',
    { expiresIn: '1h' }
  );
}

/**
 * Wrapper for HTTP API requests
 */
export async function apiRequest(endpoint, { method = 'GET', headers = {}, body = null, token = null } = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
  const reqHeaders = { ...headers };

  if (body && typeof body === 'object' && !(body instanceof Buffer)) {
    reqHeaders['Content-Type'] = reqHeaders['Content-Type'] || 'application/json';
  }

  if (token) {
    reqHeaders['Authorization'] = `Bearer ${token}`;
  }

  const reqOptions = {
    method,
    headers: reqHeaders,
  };

  if (body) {
    reqOptions.body = typeof body === 'object' && !(body instanceof Buffer) ? JSON.stringify(body) : body;
  }

  const res = await fetch(url, reqOptions);
  let json = null;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }

  return {
    status: res.status,
    ok: res.ok,
    headers: res.headers,
    body: json !== null ? json : text,
    text,
  };
}

/**
 * Discovers and caches live test context (active event, seller user, tenant)
 */
let cachedContext = null;

export async function getLiveTestContext() {
  if (cachedContext) return cachedContext;

  const adminToken = getValidAdminToken();

  // Try to fetch active event from API
  const eventRes = await apiRequest('/api/events/active', { token: adminToken });
  let event = null;
  let tenantId = DEFAULT_TENANT_ID;

  if (eventRes.ok && eventRes.body?.success && eventRes.body?.data) {
    event = eventRes.body.data;
    tenantId = event.tenantId || DEFAULT_TENANT_ID;
  } else {
    // Fallback: list all events
    const listRes = await apiRequest('/api/events', { token: adminToken });
    if (listRes.ok && listRes.body?.success && Array.isArray(listRes.body.data) && listRes.body.data.length > 0) {
      event = listRes.body.data[0];
      tenantId = event.tenantId || DEFAULT_TENANT_ID;
    }
  }

  cachedContext = {
    tenantId,
    eventId: event?.id,
    eventName: event?.name || 'Evento Test',
    adminToken,
    sellerToken: getValidSellerToken(tenantId),
  };

  return cachedContext;
}
