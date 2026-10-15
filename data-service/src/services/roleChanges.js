import { AuditLog } from '../models/AuditLog.js';
import { ModuleAssignment } from '../models/ModuleAssignment.js';

/**
 * Record a completed role change. Module assignments are removed whenever the new role is not
 * instructor, so a retry after a partial failure still cleans up. Entries are append-only.
 * @param {{actorUid: string, actorName: string, targetUid: string, targetName: string,
 *          previousRole: string, newRole: string}} change
 * @returns {Promise<{assignmentsRemoved: number}>}
 */
export async function recordRoleChange(change) {
  let assignmentsRemoved = 0;
  if (change.newRole !== 'instructor') {
    const result = await ModuleAssignment.deleteMany({ instructorId: change.targetUid });
    assignmentsRemoved = result.deletedCount;
  }

  await AuditLog.create({
    action: 'user.role_change',
    actorUid: change.actorUid,
    actorName: change.actorName,
    targetUid: change.targetUid,
    targetName: change.targetName,
    previousRole: change.previousRole,
    newRole: change.newRole,
  });

  return { assignmentsRemoved };
}