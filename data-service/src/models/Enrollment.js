import { Schema, model } from 'mongoose';
import { FINAL_RESULTS } from '../oulad/constants.js';

/** One student's registration on one module-presentation, including the outcome (the ML target). */
const enrollmentSchema = new Schema(
  {
    studentId: { type: Number, required: true },
    moduleCode: { type: String, required: true },
    presentation: { type: String, required: true },
    registeredDay: { type: Number, default: null }, // days relative to module start (negative = before)
    unregisteredDay: { type: Number, default: null },
    ageBand: { type: String, default: null },
    highestEducation: { type: String, default: null },
    prevAttempts: { type: Number, required: true },
    studiedCredits: { type: Number, required: true },
    finalResult: { type: String, enum: FINAL_RESULTS, required: true },
  },
  { collection: 'enrollments' },
);
enrollmentSchema.index({ studentId: 1, moduleCode: 1, presentation: 1 }, { unique: true });
enrollmentSchema.index({ moduleCode: 1, presentation: 1, finalResult: 1 });

export const Enrollment = model('Enrollment', enrollmentSchema);
