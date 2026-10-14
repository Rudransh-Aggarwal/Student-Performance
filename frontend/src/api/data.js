import { auth } from '../lib/firebase';

// Empty string = same origin: Nginx (production) or the Vite dev proxy forwards /api/data to data-service.
const DATA_SERVICE_URL = import.meta.env.VITE_DATA_SERVICE_URL ?? '';

export class DataApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'DataApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function toDataApiError(response) {
  try {
    const body = await response.json();
    const message = typeof body?.error === 'string' ? body.error : body?.error?.message;
    return new DataApiError(
      response.status,
      body?.error?.code ?? 'UNKNOWN',
      message ?? 'Request failed',
      body?.details ?? body?.error?.details,
    );
  } catch {
    return new DataApiError(response.status, 'UNKNOWN', 'Request failed');
  }
}

async function request(path, init = {}, forceRefresh = false) {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new DataApiError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  }

  const token = await currentUser.getIdToken(forceRefresh);
  const response = await fetch(`${DATA_SERVICE_URL}/api/data${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });

  if (response.status === 401 && auth.currentUser) {
    return request(path, init, true);
  }

  if (!response.ok) {
    throw await toDataApiError(response);
  }

  return response.status === 204 ? undefined : response.json();
}

export function dataApi(path, init = {}) {
  return request(path, init, false);
}