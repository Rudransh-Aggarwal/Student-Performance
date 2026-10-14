import { api } from './client';

/** Creates the app profile on first sign-in (name/role are used only then) and returns it. */
export async function syncProfile(details = {}) {
  const { user } = await api('/auth/session', { method: 'POST', body: JSON.stringify(details) });
  return user;
}

/** One-time role choice for social sign-ups that were created without a role. */
export async function chooseRole(role) {
  const { user } = await api('/auth/role', { method: 'POST', body: JSON.stringify({ role }) });
  return user;
}

/** Revokes this user's server-side sessions (refresh tokens). Call before signing out of Firebase. */
export function logoutSession() {
  return api('/auth/logout', { method: 'POST' });
}

/** Admin: every account with a Firebase UID, for the role-management panel. */
export async function listUsers() {
  const { users } = await api('/auth/admin/users');
  return users;
}

/** Admin: change a student's or instructor's role. Returns the updated user. */
export async function updateUserRole(firebaseUid, role) {
  const { user } = await api(`/auth/admin/users/${encodeURIComponent(firebaseUid)}/role`, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
  return user;
}