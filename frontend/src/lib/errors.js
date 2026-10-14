import { ApiError } from '../api/client';

const AUTH_MESSAGES = {
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Choose a stronger password (at least 8 characters).',
  'auth/too-many-requests': 'Too many attempts. Try again later.',
  'auth/network-request-failed': 'Network error. Check your connection and try again.',
  'auth/popup-blocked': 'Allow pop-ups for this site and try again.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with this email. Sign in with the method you used before.',
};

/** Turns Firebase and API errors into { message, fields } for forms. */
export function toFormError(error) {
  if (error instanceof ApiError) {
    const fields = {};
    if (error.code === 'VALIDATION_ERROR' && error.details) {
      for (const [field, messages] of Object.entries(error.details)) {
        if (typeof messages?.[0] === 'string') fields[field] = messages[0];
      }
    }
    const hasFields = Object.keys(fields).length > 0;
    return { message: hasFields ? 'Please fix the highlighted fields.' : error.message, fields };
  }
  if (typeof error?.code === 'string' && error.code.startsWith('auth/')) {
    return { message: AUTH_MESSAGES[error.code] ?? 'Sign-in failed. Please try again.', fields: {} };
  }
  return { message: 'Could not reach the server. Please try again.', fields: {} };
}
