import { Schema, model } from 'mongoose';

/** Links an instructor (Firebase UID) to a module code they may view. */
const moduleAssignmentSchema = new Schema(
  {
    instructorId: { type: String, required: true },
    moduleCode: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
  },
  { collection: 'moduleAssignments' },
);
moduleAssignmentSchema.index({ instructorId: 1, moduleCode: 1 }, { unique: true });
moduleAssignmentSchema.index({ moduleCode: 1 });

export const ModuleAssignment = model('ModuleAssignment', moduleAssignmentSchema);