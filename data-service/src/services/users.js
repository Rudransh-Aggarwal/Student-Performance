import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const LOOKUP_TIMEOUT_MS = 3000;

/**
 * Fetch a user's profile (including role) from auth-service by Firebase UID.
 * Throws AppError: 404 when the profile does not exist, 503 when auth-service is unreachable or failing.
 * @param {string} firebaseUid
 * @returns {Promise<{firebaseUid: string, role: string, name: string, email: string}>}
 */
export async function getUserByFirebaseUid(firebaseUid) {
  let response;
  try {
    response = await fetch(`${env.AUTH_SERVICE_URL}/api/auth/user/${encodeURIComponent(firebaseUid)}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Auth': env.AUTH_SERVICE_SECRET,
      },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch {
    throw new AppError('Could not reach the auth service', 503);
  }

  if (response.status === 404) {
    throw new AppError('User not found', 404);
  }
  if (!response.ok) {
    throw new AppError('Auth service error', 503);
  }

  return response.json();
}