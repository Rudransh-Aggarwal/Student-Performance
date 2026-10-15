import { Schema, model } from 'mongoose';

/** Learning-environment clicks summed per student, module-presentation and week (the engagement signal). */
const weeklyActivitySchema = new Schema(
  {
    studentId: { type: Number, required: true },
    moduleCode: { type: String, required: true },
    presentation: { type: String, required: true },
    week: { type: Number, required: true }, // floor(day / 7); negative = before the module started
    clicks: { type: Number, required: true },
    activeDays: { type: Number, required: true },
  },
  { collection: 'weeklyActivity' },
);
weeklyActivitySchema.index({ studentId: 1, moduleCode: 1, presentation: 1, week: 1 }, { unique: true });

export const WeeklyActivity = model('WeeklyActivity', weeklyActivitySchema);
