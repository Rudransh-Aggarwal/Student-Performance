import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const LOOKUP_TIMEOUT_MS = 3000;

/**
 * Instructor accounts (name, email, Firebase UID) from auth-service, which owns roles.
 * @returns {Promise<Array<{firebaseUid: string, name: string, email: string, role: string}>>}
 */
export async function listInstructors() {
  let response;
  try {
    response = await fetch(`${env.AUTH_SERVICE_URL}/api/auth/users?role=instructor`, {
      headers: { 'X-Service-Auth': env.AUTH_SERVICE_SECRET },
      signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
    });
  } catch {
    throw new AppError('Could not reach the auth service', 502);
  }
  if (!response.ok) {
    throw new AppError('Could not load instructors from the auth service', 502);
  }
  const { users } = await response.json();
  return users;
}