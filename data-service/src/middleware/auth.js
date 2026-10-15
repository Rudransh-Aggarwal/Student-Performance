import { verifyToken } from '../config/firebase.js';
import { getUserByFirebaseUid } from '../services/users.js';
import { AppError } from '../utils/AppError.js';

/**
 * Middleware: Verify Firebase token and attach user + role to req.
 * Extracts token from Authorization: Bearer <token>.
 * 401 = token invalid or expired; 403 = no profile for a valid token; 503 = auth-service unavailable.
 */
export async function authenticateToken(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError('Missing or invalid Authorization header', 401));
  }

  let decodedToken;
  try {
    decodedToken = await verifyToken(authHeader.slice(7));
  } catch (err) {
    const message = err.message?.includes('Firebase ID token has expired')
      ? 'Token expired'
      : 'Invalid or missing token';
    return next(new AppError(message, 401));
  }

  try {
    const user = await getUserByFirebaseUid(decodedToken.uid);
    req.user = {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      role: user.role,
      name: user.name,
    };
    return next();
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      return next(new AppError('No profile for this account. Sign in again.', 403));
    }
    return next(err instanceof AppError ? err : new AppError('Could not verify your account right now', 503));
  }
}

/**
 * Middleware: Require a specific role(s).
 * @param {...string} roles - Allowed roles
 * @returns {Function} Express middleware
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Not authenticated', 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError('Insufficient permissions', 403));
    }
    next();
  };
}