import { Module } from '../models/Module.js';
import { Enrollment } from '../models/Enrollment.js';
import { Student } from '../models/Student.js';
import { AppError } from '../utils/AppError.js';

/**
 * List all modules.
 */
export async function listModules() {
  return Module.find({}).lean();
}

/**
 * Get a module by code and presentation.
 */
export async function getModule(code, presentation) {
  const module = await Module.findOne({ code, presentation }).lean();
  if (!module) {
    throw new AppError('Module not found', 404);
  }
  return module;
}

/**
 * Get all unique module codes.
 */
export async function getModuleCodes() {
  return Module.distinct('code');
}

/**
 * Get all presentations for a module code.
 */
export async function getPresentations(code) {
  return Module.find({ code }).select('presentation').lean();
}

/**
 * Get cohorts (unique presentations) for a module.
 * A "cohort" is a presentation of a module (e.g., "AAA 2013J", "AAA 2014J").
 */
export async function getModuleCohorts(code) {
  const modules = await Module.find({ code }).select('presentation lengthDays').lean();
  return modules.map((m) => ({
    presentation: m.presentation,
    lengthDays: m.lengthDays,
  }));
}

/**
 * Get student enrollments for a module (instructor view).
 */
export async function getModuleEnrollments(code, presentation) {
  const enrollments = await Enrollment.find({
    moduleCode: code,
    presentation,
  })
    .lean()
    .exec();

  if (enrollments.length === 0) {
    return [];
  }

  // Fetch student external IDs for UI display
  const studentIds = [...new Set(enrollments.map((e) => e.studentId))];
  const students = await Student.find({ externalId: { $in: studentIds } }).lean();
  const studentMap = Object.fromEntries(students.map((s) => [s.externalId, s]));

  return enrollments.map((e) => ({
    ...e,
    student: studentMap[e.studentId] || null,
  }));
}