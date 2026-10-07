import { parseArgs } from 'node:util';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { firebaseAuth } from '../config/firebase.js';
import { toImportRecord } from '../migration/toImportRecord.js';
import { User } from '../models/User.js';

// Imports legacy users (bcrypt passwords and Google/GitHub links) into Firebase and records firebaseUid on each
// profile. Nothing is deleted: legacy fields stay in MongoDB until you remove them yourself.
const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false } } });
const BATCH_SIZE = 500;

await mongoose.connect(env.MONGO_URI);
try {
  const legacy = await User.collection.find({ firebaseUid: { $exists: false } }).toArray();
  console.log(`${legacy.length} user(s) without a Firebase account.`);

  if (!values['dry-run']) {
    let migrated = 0;
    for (let i = 0; i < legacy.length; i += BATCH_SIZE) {
      const batch = legacy.slice(i, i + BATCH_SIZE);
      const records = batch.map(toImportRecord);
      const options = records.some((record) => record.passwordHash) ? { hash: { algorithm: 'BCRYPT' } } : undefined;
      const result = await firebaseAuth.importUsers(records, options);

      const failed = new Set(result.errors.map((error) => error.index));
      const imported = batch.filter((_, index) => !failed.has(index));
      if (imported.length > 0) {
        await User.collection.bulkWrite(
          imported.map((doc) => ({
            updateOne: { filter: { _id: doc._id }, update: { $set: { firebaseUid: String(doc._id) } } },
          })),
        );
      }
      for (const { index, error } of result.errors) console.error(`  FAILED ${batch[index].email}: ${error.message}`);
      migrated += imported.length;
    }
    console.log(`Migrated ${migrated} of ${legacy.length}.`);
  }
} finally {
  await mongoose.disconnect();
}
