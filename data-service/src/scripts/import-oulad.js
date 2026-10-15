import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Assessment } from '../models/Assessment.js';
import { AssessmentResult } from '../models/AssessmentResult.js';
import { Enrollment } from '../models/Enrollment.js';
import { Module } from '../models/Module.js';
import { Student } from '../models/Student.js';
import { WeeklyActivity } from '../models/WeeklyActivity.js';
import { buildDataset } from '../oulad/buildDataset.js';

const USAGE = 'Usage: npm run import:oulad -- [--dir ./data/oulad] [--students 1000] [--seed 42] [--reset]';
const BATCH_SIZE = 5000;

const { values } = parseArgs({
  options: {
    dir: { type: 'string', default: './data/oulad' },
    students: { type: 'string', default: '1000' },
    seed: { type: 'string', default: '42' },
    reset: { type: 'boolean', default: false },
  },
});

const studentCount = Number.parseInt(values.students, 10);
const seed = Number.parseInt(values.seed, 10);
if (!Number.isInteger(studentCount) || studentCount < 1 || !Number.isInteger(seed)) {
  console.error(`--students must be a positive integer and --seed an integer.\n${USAGE}`);
  process.exit(1);
}

const MODELS = [Module, Student, Enrollment, Assessment, AssessmentResult, WeeklyActivity];

async function insertInBatches(label, model, docs) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    await model.insertMany(docs.slice(i, i + BATCH_SIZE), { ordered: false });
  }
  console.log(`  ${label}: ${docs.length}`);
}

async function main() {
  if (existsSync(join(values.dir, 'SYNTHETIC_DATA.txt'))) {
    console.warn('\n*** WARNING: these files are SYNTHETIC (generated), not real OULAD data. ***\n');
  }

  // Connect first, so a database problem shows up now instead of after the slow CSV scan.
  await mongoose.connect(env.MONGO_URI, { serverSelectionTimeoutMS: 8000 });
  await Promise.all(MODELS.map((model) => model.init())); // create unique indexes before inserting
  if (!values.reset && (await Enrollment.estimatedDocumentCount()) > 0) {
    throw new Error('Data already imported. Re-run with --reset to replace it.');
  }
  console.log('Connected to MongoDB. Reading CSV files (the click file takes a few minutes)...');

  const dataset = await buildDataset({ dir: values.dir, studentCount, seed, onProgress: console.log });

  // Demo-account links are stored on Student documents, which --reset deletes. Read them now, restore them later.
  const previousLinks = values.reset
    ? await Student.find({ userId: { $ne: null } }).select('externalId userId').lean()
    : [];

  // Only clear old data once the new data has been read successfully.
  if (values.reset) {
    for (const model of MODELS) await model.deleteMany({});
    console.log('Cleared existing data-service collections.');
  }

  console.log('Writing to MongoDB:');
  await insertInBatches('modules', Module, dataset.modules);
  await insertInBatches('students', Student, dataset.students);

  if (previousLinks.length > 0) {
    const sampledIds = new Set(dataset.students.map((student) => student.externalId));
    const restorable = previousLinks.filter((link) => sampledIds.has(link.externalId));
    if (restorable.length > 0) {
      await Student.bulkWrite(
        restorable.map(({ externalId, userId }) => ({
          updateOne: { filter: { externalId }, update: { $set: { userId } } },
        })),
      );
    }
    console.log(`Restored ${restorable.length} of ${previousLinks.length} demo account link(s).`);
    if (restorable.length < previousLinks.length) {
      console.warn(
        'Some links were not restored because their student IDs are not in the new sample. ' +
          'Re-run with the original --students and --seed to keep them.',
      );
    }
  }

  await insertInBatches('enrollments', Enrollment, dataset.enrollments);
  await insertInBatches('assessments', Assessment, dataset.assessments);
  await insertInBatches('assessmentResults', AssessmentResult, dataset.results);
  await insertInBatches('weeklyActivity', WeeklyActivity, dataset.weeklyActivity);

  const outcomes = await Enrollment.aggregate([{ $group: { _id: '$finalResult', count: { $sum: 1 } } }]);
  console.log('Final results:', Object.fromEntries(outcomes.map((row) => [row._id, row.count])));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('\nImport failed:', error instanceof Error ? error.message : error);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});