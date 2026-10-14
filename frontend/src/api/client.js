import { auth } from '../lib/firebase';

const BASE_URL = '/api';

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function toApiError(response) {
  try {
    const { error } = await response.json();
    return new ApiError(response.status, error?.code ?? 'UNKNOWN', error?.message ?? 'Request failed', error?.details);
  } catch {
    return new ApiError(response.status, 'UNKNOWN', 'Request failed');
  }
}

async function send(path, init, forceRefresh) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  // The Firebase SDK caches the ID token and renews it before it expires.
  const token = await auth.currentUser?.getIdToken(forceRefresh);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return fetch(`${BASE_URL}${path}`, { ...init, headers });
}

/** JSON request helper. A 401 triggers one forced token refresh and retry. */
export async function api(path, init = {}) {
  let response = await send(path, init, false);
  if (response.status === 401 && auth.currentUser) response = await send(path, init, true);
  if (!response.ok) throw await toApiError(response);
  return response.status === 204 ? undefined : response.json();
}
