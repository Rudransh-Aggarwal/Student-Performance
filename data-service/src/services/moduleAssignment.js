import { ModuleAssignment } from '../models/ModuleAssignment.js';

/**
 * Assign a module to an instructor. Idempotent.
 * @param {string} instructorId - Firebase UID
 * @param {string} moduleCode
 */
export async function assignModuleToInstructor(instructorId, moduleCode) {
  await ModuleAssignment.updateOne(
    { instructorId, moduleCode },
    { $setOnInsert: { assignedAt: new Date() } },
    { upsert: true },
  );
}

/**
 * List module codes assigned to an instructor.
 * @param {string} instructorId
 * @returns {Promise<string[]>}
 */
export async function getAssignedModules(instructorId) {
  if (!instructorId) return [];
  const rows = await ModuleAssignment.find({ instructorId }).select('moduleCode -_id').lean();
  return rows.map((row) => row.moduleCode).sort();
}

/**
 * Check whether an instructor is assigned to a module.
 * @param {string} instructorId
 * @param {string} moduleCode
 * @returns {Promise<boolean>}
 */
export async function isModuleAssigned(instructorId, moduleCode) {
  if (!instructorId) return false;
  return (await ModuleAssignment.exists({ instructorId, moduleCode })) !== null;
}

/**
 * Remove a module assignment.
 * @returns {Promise<boolean>} true if an assignment was removed
 */
export async function removeModuleAssignment(instructorId, moduleCode) {
  const result = await ModuleAssignment.deleteOne({ instructorId, moduleCode });
  return result.deletedCount > 0;
}