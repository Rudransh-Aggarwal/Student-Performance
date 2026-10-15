import { Schema, model } from 'mongoose';

const ROLE_VALUES = ['student', 'instructor'];
const isUnlink = function isUnlink() {
  return this.action === 'demo_account.unlink';
};
const isRoleChange = function isRoleChange() {
  return this.action === 'user.role_change';
};

/**
 * Append-only record of privileged admin actions. The application never updates or deletes entries.
 * Each action type uses its own subset of fields.
 */
const auditLogSchema = new Schema(
  {
    action: { type: String, required: true, enum: ['demo_account.unlink', 'user.role_change'] },
    actorUid: { type: String, required: true },
    actorName: { type: String, required: true, trim: true },

    // demo_account.unlink
    targetExternalId: { type: Number, required: isUnlink },
    previousUserId: { type: String, required: isUnlink },

    // user.role_change
    targetUid: { type: String, required: isRoleChange },
    targetName: { type: String, trim: true, required: isRoleChange },
    previousRole: { type: String, enum: ROLE_VALUES, required: isRoleChange },
    newRole: { type: String, enum: ROLE_VALUES, required: isRoleChange },

    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { collection: 'audit_logs' },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetExternalId: 1, createdAt: -1 });
auditLogSchema.index({ targetUid: 1, createdAt: -1 });

export const AuditLog = model('AuditLog', auditLogSchema);