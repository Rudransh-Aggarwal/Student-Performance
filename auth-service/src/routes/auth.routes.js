import { Router } from 'express';
import { z } from 'zod';
import { firebaseAuth } from '../config/firebase.js';
import { validateBody } from '../middleware/validate.js';
import { notifyRoleChange as defaultNotifyRoleChange } from '../services/roleChangeNotifier.js';
import { ensureProfile, toPublicUser } from '../services/profiles.js';
import { AppError } from '../utils/AppError.js';

// strict(): unknown keys (isAdmin, permissions, ...) are rejected; role can never be "admin" here.
const sessionSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    role: z.enum(['student', 'instructor']).optional(),
  })
  .strict()
  .default({});

// One-time role choice for social sign-ups that were created without a role. Admin is not selectable.
const roleChoiceSchema = z.object({ role: z.enum(['student', 'instructor']) }).strict();

// Admin role management: admin is deliberately not assignable here.
const roleUpdateSchema = z.object({ role: z.enum(['student', 'instructor']) }).strict();

// Service-only directory query. "admin" is deliberately not listable.
const listUsersQuerySchema = z.object({ role: z.enum(['student', 'instructor']) }).strict();

/**
 * @param {object} deps
 * @param {object} deps.auth - middleware from createAuth
 * @param {object} deps.users - user repository
 * @param {(uid: string) => Promise<void>} [deps.revokeSessions] - revokes Firebase refresh tokens (injectable for tests)
 * @param {(change: object) => Promise<void>} [deps.notifyRoleChange] - records role changes in data-service (injectable for tests)
 */
export function createAuthRouter({
  auth,
  users,
  revokeSessions = (uid) => firebaseAuth.revokeRefreshTokens(uid),
  notifyRoleChange = defaultNotifyRoleChange,
}) {
  const router = Router();

  router.get('/user/:firebaseUid', auth.requireServiceAuth, async (req, res, next) => {
    try {
      const user = await users.findByUid(req.params.firebaseUid);
      if (!user) {
        return next(new AppError(404, 'USER_NOT_FOUND', 'User not found'));
      }
      return res.json(toPublicUser(user));
    } catch (error) {
      return next(error);
    }
  });

  // Service-only: directory of accounts for a role (used by data-service's admin assignment picker).
  router.get('/users', auth.requireServiceAuth, async (req, res, next) => {
    try {
      const parsed = listUsersQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        return next(new AppError(400, 'INVALID_QUERY', 'role must be "student" or "instructor"'));
      }
      const docs = await users.listByRole(parsed.data.role);
      return res.json({
        users: docs.map((doc) => ({
          firebaseUid: doc.firebaseUid,
          name: doc.name,
          email: doc.email,
          role: doc.role,
        })),
      });
    } catch (error) {
      return next(error);
    }
  });

  // Called after every Firebase sign-in: creates the profile on first use, then returns it.
  router.post('/session', auth.verifyToken, validateBody(sessionSchema), async (req, res) => {
    res.json({ user: toPublicUser(await ensureProfile(users, req.token, req.body)) });
  });

  router.post('/role', auth.verifyToken, validateBody(roleChoiceSchema), async (req, res, next) => {
    try {
      const user = await users.confirmRole(req.token.uid, req.body.role);
      if (!user) {
        const existing = await users.findByUid(req.token.uid);
        if (!existing) return next(new AppError(403, 'NO_PROFILE', 'No profile exists for this account'));
        return next(new AppError(409, 'ROLE_ALREADY_SET', 'The role for this account has already been chosen'));
      }
      return res.json({ user: toPublicUser(user) });
    } catch (error) {
      return next(error);
    }
  });

  // Signs the user out everywhere: revokes Firebase refresh tokens so the session cannot be renewed.
  // Access tokens already issued stay valid until they expire (Firebase ID tokens last up to one hour).
  router.post('/logout', auth.verifyToken, async (req, res, next) => {
    try {
      await revokeSessions(req.token.uid);
      return res.status(204).send();
    } catch (error) {
      return next(error);
    }
  });

  // Admin: list all accounts for the role-management panel.
  router.get('/admin/users', auth.authenticate, auth.requireRole('admin'), async (_req, res, next) => {
    try {
      const docs = await users.listAll();
      return res.json({ users: docs.map((doc) => ({ ...toPublicUser(doc), firebaseUid: doc.firebaseUid })) });
    } catch (error) {
      return next(error);
    }
  });

  // Admin: change a student's or instructor's role. Admins cannot change their own role or any other admin.
  router.patch(
    '/admin/users/:firebaseUid/role',
    auth.authenticate,
    auth.requireRole('admin'),
    validateBody(roleUpdateSchema),
    async (req, res, next) => {
      try {
        const { firebaseUid } = req.params;
        if (firebaseUid === req.user.uid) {
          return next(new AppError(400, 'CANNOT_CHANGE_OWN_ROLE', 'You cannot change your own role'));
        }
        const target = await users.findByUid(firebaseUid);
        if (!target) return next(new AppError(404, 'USER_NOT_FOUND', 'User not found'));
        if (target.role === 'admin') {
          return next(new AppError(403, 'ADMIN_ROLE_PROTECTED', 'Admin roles can only be changed by the seed script'));
        }
        const updated = await users.updateRole(firebaseUid, req.body.role);
        if (!updated) {
          return next(new AppError(409, 'ROLE_UPDATE_CONFLICT', 'The account changed while updating. Try again.'));
        }
        // Audit entry and module-assignment cleanup live in data-service; a failure surfaces as 502 and can be retried.
        await notifyRoleChange({
          actorUid: req.user.uid,
          actorName: req.user.name,
          targetUid: firebaseUid,
          targetName: target.name,
          previousRole: target.role,
          newRole: req.body.role,
        });
        return res.json({ user: { ...toPublicUser(updated), firebaseUid } });
      } catch (error) {
        return next(error);
      }
    },
  );

  router.get('/me', auth.authenticate, (req, res) => {
    const { uid, ...user } = req.user;
    res.json({ user });
  });

  return router;
}