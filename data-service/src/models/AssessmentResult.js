import { Schema, model } from 'mongoose';

const assessmentResultSchema = new Schema(
  {
    studentId: { type: Number, required: true },
    assessmentId: { type: Number, required: true },
    submittedDay: { type: Number, default: null },
    score: { type: Number, required: true, min: 0, max: 100 },
    isBanked: { type: Boolean, default: false },
  },
  { collection: 'assessmentResults' },
);
assessmentResultSchema.index({ studentId: 1, assessmentId: 1 }, { unique: true });
assessmentResultSchema.index({ assessmentId: 1 });

export const AssessmentResult = model('AssessmentResult', assessmentResultSchema);
