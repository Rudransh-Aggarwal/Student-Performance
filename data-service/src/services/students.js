// File: data-service/src/services/students.js
import { Student } from '../models/Student.js';
import { Enrollment } from '../models/Enrollment.js';
import { WeeklyActivity } from '../models/WeeklyActivity.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentResult } from '../models/AssessmentResult.js';
import { Module } from '../models/Module.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import { calculatePredictionFeatures } from './studentFeatures.js';
import { getUserByFirebaseUid } from './users.js';

/**
 * Get a student by external ID (from OULAD dataset).
 */
export async function getStudentByExternalId(externalId) {
  const student = await Student.findOne({ externalId }).lean();
  if (!student) {
    throw new AppError('Student not found', 404);
  }
  return student;
}

/**
 * Get a student's enrollments across all modules.
 */
export async function getStudentEnrollments(externalId) {
  return Enrollment.find({ studentId: externalId }).lean();
}

/**
 * Get a student's weekly activity for a module.
 */
export async function getStudentWeeklyActivity(externalId, moduleCode, presentation) {
  return WeeklyActivity.find({
    studentId: externalId,
    moduleCode,
    presentation,
  })
    .sort({ week: 1 })
    .lean();
}

/**
 * Get detailed student view: enrollments + activity for a module.
 */
export async function getStudentDetail(externalId, moduleCode, presentation) {
  const [student, enrollment] = await Promise.all([
    Student.findOne({ externalId }).lean(),
    Enrollment.findOne({
      studentId: externalId,
      moduleCode,
      presentation,
    }).lean(),
  ]);

  if (!student) {
    throw new AppError('Student not found', 404);
  }
  if (!enrollment) {
    throw new AppError('Student not enrolled in this module', 404);
  }

  const activity = await getStudentWeeklyActivity(externalId, moduleCode, presentation);

  return {
    student,
    enrollment,
    activity,
  };
}

/**
 * Link a real user (Firebase UID) to a demo student account.
 */
export async function linkUserToStudent(userId, externalId) {
  const existingLink = await Student.findOne({ userId }).lean();
  if (existingLink && existingLink.externalId !== externalId) {
    throw new AppError('This user is already linked to a demo account', 409);
  }

  const student = await Student.findOneAndUpdate(
    {
      externalId,
      $or: [{ userId: null }, { userId }],
    },
    { $set: { userId } },
    { new: true, runValidators: true },
  ).lean();

  if (student) return student;

  const [linkedToUser, record] = await Promise.all([
    Student.findOne({ userId }).lean(),
    Student.findOne({ externalId }).select('externalId userId').lean(),
  ]);
  if (linkedToUser?.externalId === externalId) return linkedToUser;
  if (!record) {
    throw new AppError('Student not found', 404);
  }
  if (record.userId) throw new AppError('This demo account is already linked', 409);
  throw new AppError('Could not link this demo account', 409);
}

/**
 * External IDs of demo students not yet linked to a login account (IDs only).
 */
export async function listUnlinkedDemoAccountIds(limit = 1000) {
  const students = await Student.find({ userId: null })
    .select('externalId')
    .sort({ externalId: 1 })
    .limit(limit)
    .lean();
  return students.map(({ externalId }) => externalId);
}

/**
 * Demo accounts that currently have a login linked (admin view), with the linked user's name.
 * Names come from auth-service; if a lookup fails, name is null instead of failing the whole list.
 */
export async function listLinkedDemoAccounts(limit = 1000) {
  const links = await Student.find({ userId: { $ne: null } })
    .select('externalId userId')
    .sort({ externalId: 1 })
    .limit(limit)
    .lean();

  const profiles = await Promise.allSettled(links.map(({ userId }) => getUserByFirebaseUid(userId)));
  return links.map(({ externalId, userId }, index) => {
    const result = profiles[index];
    if (result.status === 'rejected') {
      console.warn(`Could not resolve name for demo student ${externalId} (uid ${userId}):`, result.reason?.message);
    }
    return {
      externalId,
      name: result.status === 'fulfilled' ? result.value.name ?? null : null,
    };
  });
}

/**
 * Remove the login link from a demo account (admin only) and record it in the audit log.
 * Uses $unset rather than null so the sparse unique index on userId keeps working.
 */
export async function unlinkDemoAccount(externalId, actor) {
  const previous = await Student.findOneAndUpdate(
    { externalId, userId: { $ne: null } },
    { $unset: { userId: 1 } },
    { new: false },
  ).lean();
  if (!previous) {
    throw new AppError('This demo account is not linked to a user', 404);
  }

  await AuditLog.create({
    action: 'demo_account.unlink',
    actorUid: actor.firebaseUid,
    actorName: actor.name || actor.email || actor.firebaseUid,
    targetExternalId: externalId,
    previousUserId: previous.userId,
  });
  return { externalId };
}

/**
 * Most recent audit entries (admin view).
 */
export async function listAuditLog(limit = 100) {
  return AuditLog.find().sort({ createdAt: -1 }).limit(limit).lean();
}

/**
 * Get the demo student account linked to a user.
 */
export async function getDemoAccountForUser(userId) {
  const student = await Student.findOne({ userId }).lean();
  if (!student) {
    throw new AppError('No demo account linked', 404);
  }
  return student;
}

export async function getStudentPredictionDataForUser(userId) {
  const student = await getDemoAccountForUser(userId);
  const enrollments = await Enrollment.find({ studentId: student.externalId }).lean();
  if (enrollments.length === 0) {
    throw new AppError('No enrollment data is available for this demo account', 404);
  }

  const enrollmentFilter = enrollments.map(({ moduleCode, presentation }) => ({
    moduleCode,
    presentation,
  }));
  const [assessments, modules] = await Promise.all([
    Assessment.find({ $or: enrollmentFilter }).lean(),
    Module.find({ $or: enrollmentFilter }).lean(),
  ]);
  const assessmentIds = assessments.map(({ assessmentId }) => assessmentId);
  const [results, activity] = await Promise.all([
    assessmentIds.length
      ? AssessmentResult.find({
          studentId: student.externalId,
          assessmentId: { $in: assessmentIds },
        }).lean()
      : [],
    WeeklyActivity.find({
      studentId: student.externalId,
      $or: enrollmentFilter,
    }).lean(),
  ]);

  const features = calculatePredictionFeatures({ modules, assessments, results, activity });
  return {
    studentId: student.externalId,
    features,
    dataCounts: {
      enrollments: enrollments.length,
      assessments: assessments.length,
      submittedAssessments: results.length,
      activeWeeks: activity.length,
    },
  };
}