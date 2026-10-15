import express from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { requireRole } from '../middleware/auth.js';
import * as moduleSvc from '../services/modules.js';
import * as studentSvc from '../services/students.js';
import * as assignmentSvc from '../services/moduleAssignment.js';
import { AppError } from '../utils/AppError.js';
import { getUserByFirebaseUid } from '../services/users.js';

const router = express.Router();

/**
 * Middleware: instructors may only access modules assigned to them (admins bypass).
 */
async function requireModuleAccess(req, res, next) {
  try {
    if (req.user?.role === 'admin') return next();
    if (await assignmentSvc.isModuleAssigned(req.user?.firebaseUid, req.params.code)) return next();
    return next(new AppError('Module not assigned to this instructor', 403));
  } catch (err) {
    return next(err);
  }
}

// =============================================================================
// MODULES (public to authenticated users)
// =============================================================================

/**
 * GET /api/data/modules
 * List all modules.
 */
router.get('/modules', async (req, res, next) => {
  try {
    const modules = await moduleSvc.listModules();
    res.json({ modules });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/modules/:code
 * Get module cohorts (presentations) for an instructor.
 */
router.get('/modules/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const cohorts = await moduleSvc.getModuleCohorts(code);
    if (cohorts.length === 0) {
      return next(new AppError('Module not found', 404));
    }
    res.json({ code, cohorts });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// INSTRUCTOR-ONLY: Module enrollments and students
// =============================================================================

/**
 * GET /api/data/modules/:code/:presentation/enrollments
 * Get all student enrollments for a module (instructor only).
 */
router.get(
  '/modules/:code/:presentation/enrollments',
  requireRole('instructor', 'admin'),
  requireModuleAccess,
  async (req, res, next) => {
    try {
      const { code, presentation } = req.params;
      const enrollments = await moduleSvc.getModuleEnrollments(code, presentation);
      res.json({ enrollments });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/data/students/:externalId/modules/:code/:presentation
 * Get a student's detailed data for a module (instructor only).
 */
router.get(
  '/students/:externalId/modules/:code/:presentation',
  requireRole('instructor', 'admin'),
  requireModuleAccess,
  async (req, res, next) => {
    try {
      const { externalId, code, presentation } = req.params;
      const detail = await studentSvc.getStudentDetail(
        parseInt(externalId, 10),
        code,
        presentation,
      );
      res.json(detail);
    } catch (err) {
      next(err);
    }
  },
);

// =============================================================================
// INSTRUCTOR: Own module assignments
// =============================================================================

/**
 * GET /api/data/instructor/me/modules
 * List module codes assigned to the current instructor.
 */
router.get('/instructor/me/modules', requireRole('instructor'), async (req, res, next) => {
  try {
    const moduleCodes = await assignmentSvc.getAssignedModules(req.user.firebaseUid);
    res.json({ moduleCodes });
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// STUDENT-ONLY: Demo account linking
// =============================================================================

const linkDemoSchema = z.object({
  externalId: z.number().int().positive(),
});

/**
 * POST /api/data/demo-accounts/link
 * Link current user to a demo student account.
 */
router.post(
  '/demo-accounts/link',
  requireRole('student'),
  validate(linkDemoSchema, 'body'),
  async (req, res, next) => {
    try {
      const { externalId } = req.body;
      const student = await studentSvc.linkUserToStudent(req.user.firebaseUid, externalId);
      res.status(201).json({ student });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/data/demo-accounts/available
 * IDs of demo accounts not yet linked to a login (student only). Returns IDs only.
 */
router.get('/demo-accounts/available', requireRole('student'), async (req, res, next) => {
  try {
    const externalIds = await studentSvc.listUnlinkedDemoAccountIds();
    res.json({ externalIds });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/demo-accounts/linked
 * Linked demo accounts with their login IDs (admin only).
 */
router.get('/demo-accounts/linked', requireRole('admin'), async (req, res, next) => {
  try {
    const students = await studentSvc.listLinkedDemoAccounts();
    res.json({ students });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/admin/audit-log
 * Recent admin actions, newest first (admin only).
 */
router.get('/admin/audit-log', requireRole('admin'), async (req, res, next) => {
  try {
    const entries = await studentSvc.listAuditLog();
    res.json({ entries });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/data/demo-accounts/:externalId/link
 * Unlink any demo account from its login (admin only).
 */
router.delete('/demo-accounts/:externalId/link', requireRole('admin'), async (req, res, next) => {
  try {
    const externalId = Number(req.params.externalId);
    if (!Number.isInteger(externalId) || externalId <= 0) {
      return next(new AppError('Invalid student ID', 400));
    }
    await studentSvc.unlinkDemoAccount(externalId, req.user);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/data/demo-accounts/me
 * Get the demo account linked to the current user (student only).
 */
router.get('/demo-accounts/me', requireRole('student'), async (req, res, next) => {
  try {
    const student = await studentSvc.getDemoAccountForUser(req.user.firebaseUid);
    res.json({ student });
  } catch (err) {
    next(err);
  }
});

router.get('/demo-accounts/me/prediction-features', requireRole('student'), async (req, res, next) => {
  try {
    const predictionData = await studentSvc.getStudentPredictionDataForUser(req.user.firebaseUid);
    res.json(predictionData);
  } catch (err) {
    next(err);
  }
});

// =============================================================================
// ADMIN-ONLY: Module assignment
// =============================================================================

const assignModuleSchema = z.object({
  instructorId: z.string().min(1),
  moduleCode: z.string().min(1),
});

/**
 * POST /api/data/admin/module-assignments
 * Assign a module to an instructor (admin only).
 */
router.post(
  '/admin/module-assignments',
  requireRole('admin'),
  validate(assignModuleSchema, 'body'),
  async (req, res, next) => {
    try {
      const { instructorId, moduleCode } = req.body;

      // Verify module exists
      const cohorts = await moduleSvc.getModuleCohorts(moduleCode);
      if (cohorts.length === 0) {
        return next(new AppError('Module not found', 404));
      }

      // Verify target is an instructor (role lives in auth-service)
      const target = await getUserByFirebaseUid(instructorId).catch(() => null);
      if (!target || target.role !== 'instructor') {
        return next(new AppError('Target user is not an instructor', 400));
      }

      await assignmentSvc.assignModuleToInstructor(instructorId, moduleCode);
      res.status(201).json({ instructorId, moduleCode });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/data/admin/instructors/:instructorId/modules
 * List modules assigned to an instructor (admin only).
 */
router.get(
  '/admin/instructors/:instructorId/modules',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { instructorId } = req.params;
      const codes = await assignmentSvc.getAssignedModules(instructorId);
      res.json({ instructorId, moduleCodes: codes });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/data/admin/module-assignments/:instructorId/:moduleCode
 * Remove a module assignment (admin only).
 */
router.delete(
  '/admin/module-assignments/:instructorId/:moduleCode',
  requireRole('admin'),
  async (req, res, next) => {
    try {
      const { instructorId, moduleCode } = req.params;
      const removed = await assignmentSvc.removeModuleAssignment(instructorId, moduleCode);
      if (!removed) return next(new AppError('Assignment not found', 404));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;