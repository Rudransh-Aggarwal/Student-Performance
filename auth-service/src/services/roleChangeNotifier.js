import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

const NOTIFY_TIMEOUT_MS = 3000;

const syncFailed = () =>
  new AppError(
    502,
    'ROLE_SYNC_FAILED',
    'The role was changed, but module assignments and the audit log could not be updated. Retry the change.',
  );

/**
 * Tells data-service about a completed role change so it can write the audit entry and, when the
 * account is no longer an instructor, remove its module assignments. Throws 502 if that fails.
 */
export async function notifyRoleChange(change) {
  const url = `${env.DATA_SERVICE_URL}/api/data/internal/role-changes`;
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Auth': env.AUTH_SERVICE_SECRET,
      },
      body: JSON.stringify(change),
      signal: AbortSignal.timeout(NOTIFY_TIMEOUT_MS),
    });
  } catch (error) {
    console.error('[role-change] request to data-service failed', { url, reason: error?.message ?? String(error) });
    throw syncFailed();
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('[role-change] data-service rejected the change', { url, status: response.status, body });
    throw syncFailed();
  }
}