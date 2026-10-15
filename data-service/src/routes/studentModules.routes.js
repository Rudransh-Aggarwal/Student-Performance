import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { getModulesForLinkedStudent } from '../services/studentModules.js';

const router = Router();

/**
 * GET /api/data/demo-accounts/me/modules
 * Modules the current student is enrolled in (student only). 404 when no demo account is linked.
 */
router.get('/demo-accounts/me/modules', requireRole('student'), async (req, res, next) => {
  try {
    const modules = await getModulesForLinkedStudent(req.user.firebaseUid);
    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

export default router;