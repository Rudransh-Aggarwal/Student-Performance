import { Schema, model } from 'mongoose';
import { ASSESSMENT_TYPES } from '../oulad/constants.js';

const assessmentSchema = new Schema(
  {
    assessmentId: { type: Number, required: true, unique: true },
    moduleCode: { type: String, required: true },
    presentation: { type: String, required: true },
    type: { type: String, enum: ASSESSMENT_TYPES, required: true },
    dueDay: { type: Number, default: null }, // days since module start; null when the dataset has no date
    weight: { type: Number, required: true }, // percent
  },
  { collection: 'assessments' },
);
assessmentSchema.index({ moduleCode: 1, presentation: 1 });

export const Assessment = model('Assessment', assessmentSchema);
