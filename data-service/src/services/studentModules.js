import { Enrollment } from '../models/Enrollment.js';
import { Module } from '../models/Module.js';
import { Student } from '../models/Student.js';
import { AppError } from '../utils/AppError.js';

/**
 * Modules the current student is enrolled in, for their linked demo account only.
 * @param {string} userId - Firebase UID of the student
 * @returns {Promise<{code: string, presentation: string, lengthDays: number}[]>}
 */
export async function getModulesForLinkedStudent(userId) {
  const student = await Student.findOne({ userId }).select('externalId').lean();
  if (!student) {
    throw new AppError('No demo account linked', 404);
  }

  const enrollments = await Enrollment.find({ studentId: student.externalId })
    .select('moduleCode presentation')
    .lean();
  if (enrollments.length === 0) return [];

  const modules = await Module.find({
    $or: enrollments.map(({ moduleCode, presentation }) => ({ code: moduleCode, presentation })),
  }).lean();

  return modules
    .map(({ code, presentation, lengthDays }) => ({ code, presentation, lengthDays }))
    .sort((a, b) => a.code.localeCompare(b.code) || a.presentation.localeCompare(b.presentation));
}