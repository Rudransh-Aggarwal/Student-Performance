import { Router } from 'express';
import { requireRole } from '../middleware/auth.js';
import { listInstructors } from '../services/instructors.js';

const router = Router();

/**
 * GET /api/data/admin/instructors
 * Instructor accounts for the admin assignment picker (admin only).
 */
router.get('/admin/instructors', requireRole('admin'), async (req, res, next) => {
  try {
    const instructors = await listInstructors();
    res.json({ instructors });
  } catch (err) {
    next(err);
  }
});

export default router;