import { AppError } from '../utils/AppError.js';

const isDuplicateKey = (error) => typeof error === 'object' && error !== null && error.code === 11000;

export function toPublicUser(doc) {
  return {
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    role: doc.role,
    avatarUrl: doc.avatarUrl ?? null,
    roleSelectionPending: doc.roleSelectionPending === true,
  };
}

/**
 * Idempotent first-sign-in setup. `name` and `role` are honoured ONLY when the profile is created, and the
 * route restricts `role` to student/instructor, so no request can ever change an existing user's role.
 */
export async function ensureProfile(users, token, { name, role } = {}) {
  if (!token.email) {
    throw new AppError(400, 'EMAIL_REQUIRED', 'This sign-in method did not provide an email address');
  }

  const existing = await users.findByUid(token.uid);
  if (existing) return existing;

  try {
    return await users.create({
      firebaseUid: token.uid,
      email: token.email.toLowerCase(),
      name: name ?? token.name ?? token.email.split('@')[0],
      role: role ?? 'student',
      // No role supplied (e.g. social sign-in from the Login page): the user must confirm one before using the app.
      roleSelectionPending: role === undefined,
      ...(token.picture && { avatarUrl: token.picture }),
    });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    const raced = await users.findByUid(token.uid); // two first sign-ins at once
    if (raced) return raced;
    throw new AppError(409, 'EMAIL_IN_USE', 'An account with this email already exists. Ask an admin to run the user migration.');
  }
}