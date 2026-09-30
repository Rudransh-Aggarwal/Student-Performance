import { toPublicUser } from '../services/profiles.js';
import { AppError } from '../utils/AppError.js';

/**
 * Central authentication/authorization. Identity comes only from a Firebase ID token verified server-side;
 * the role comes only from our database. Nothing the client sends (body, query, headers, token claims) is
 * ever used to decide a role.
 */
export function createAuth({ verifyIdToken, users }) {
  const verifyToken = async (req, _res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'UNAUTHENTICATED', 'Missing bearer token'));

    try {
      const decoded = await verifyIdToken(header.slice('Bearer '.length));
      req.token = { uid: decoded.uid, email: decoded.email, name: decoded.name, picture: decoded.picture };
      return next();
    } catch {
      return next(new AppError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
    }
  };

  const requireServiceAuth = (req, _res, next) => {
    const expected = process.env.AUTH_SERVICE_SECRET || 'development-service-secret';
    const provided = req.headers['x-service-auth'];

    if (provided !== expected) {
      return next(new AppError(401, 'SERVICE_AUTH_REQUIRED', 'Missing or invalid service auth'));
    }

    return next();
  };

  const loadUser = async (req) => {
    const doc = await users.findByUid(req.token.uid);
    if (!doc) throw new AppError(403, 'NO_PROFILE', 'Account setup is incomplete. Sign in again.');
    req.user = { ...toPublicUser(doc), uid: doc.firebaseUid };
  };

  // Express 5 forwards rejected promises from async middleware to the error handler.
  const authenticate = [verifyToken, async (req, _res, next) => { await loadUser(req); next(); }];

  const requireRole =
    (...allowed) =>
    (req, _res, next) =>
      allowed.includes(req.user?.role)
        ? next()
        : next(new AppError(403, 'FORBIDDEN', 'You do not have permission to perform this action'));

  return { verifyToken, requireServiceAuth, authenticate, requireRole };
}
