import { Schema, model } from 'mongoose';

/** A module-presentation, e.g. code "AAA" running in "2013J". This is the "course" shown in dashboards. */
const moduleSchema = new Schema(
  {
    code: { type: String, required: true },
    presentation: { type: String, required: true },
    lengthDays: { type: Number, required: true },
  },
  { collection: 'modules' },
);
moduleSchema.index({ code: 1, presentation: 1 }, { unique: true });

export const Module = model('Module', moduleSchema);
