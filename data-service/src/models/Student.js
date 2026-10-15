import { Schema, model } from 'mongoose';

/**
 * A learner from the dataset. externalId is the dataset's anonymised id_student.
 * userId is set only when a real login account is linked to this record (demo accounts, later phases).
 */
const studentSchema = new Schema(
  {
    externalId: { type: Number, required: true, unique: true },
    userId: { type: String, unique: true, sparse: true },
  },
  { collection: 'students' },
);

export const Student = model('Student', studentSchema);
