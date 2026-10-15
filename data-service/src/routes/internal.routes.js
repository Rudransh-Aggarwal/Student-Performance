import crypto from 'node:crypto';
import express from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import { recordRoleChange } from '../services/roleChanges.js';
import { AppError } from '../utils/AppError.js';

/**
 * Service-to-service routes, authenticated with the shared AUTH_SERVICE_SECRET (not a user token).
 * Mounted before the user-token middleware in app.js.
 */
const router = express.Router();

const roleChangeSchema = z
  .object({
    actorUid: z.string().min(1),
    actorName: z.string().trim().min(1).max(200),
    targetUid: z.string().min(1),
    targetName: z.string().trim().min(1).max(200),
    previousRole: z.enum(['student', 'instructor']),
    newRole: z.enum(['student', 'instructor']),
  })
  .strict();

function secretMatches(provided) {
  if (typeof provided !== 'string') return false;
  const given = Buffer.from(provided);
  const expected = Buffer.from(env.AUTH_SERVICE_SECRET);
  return given.length === expected.length && crypto.timingSafeEqual(given, expected);
}

function requireServiceSecret(req, res, next) {
  if (!secretMatches(req.get('X-Service-Auth'))) {
    return next(new AppError('Missing or invalid service auth', 401));
  }
  return next();
}

/**
 * POST /api/data/internal/role-changes
 * Called by auth-service after an admin changes a user's role.
 */
router.post(
  '/role-changes',
  requireServiceSecret,
  validate(roleChangeSchema, 'body'),
  async (req, res, next) => {
    try {
      const result = await recordRoleChange(req.body);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  },
);

export default router;