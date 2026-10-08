import mongoose from 'mongoose';
import { z } from 'zod';
import { env } from '../config/env.js';
import { firebaseAuth } from '../config/firebase.js';
import { User } from '../models/User.js';

// Creates (or promotes) an admin: a Firebase account plus a profile with role "admin".
const admin = z
  .object({
    ADMIN_EMAIL: z.string().email(),
    ADMIN_PASSWORD: z.string().min(12),
    ADMIN_NAME: z.string().default('Administrator'),
  })
  .parse(process.env);
const email = admin.ADMIN_EMAIL.toLowerCase();

let firebaseUser;
try {
  firebaseUser = await firebaseAuth.getUserByEmail(email);
} catch (error) {
  if (error.code !== 'auth/user-not-found') throw error;
  firebaseUser = await firebaseAuth.createUser({ email, password: admin.ADMIN_PASSWORD, displayName: admin.ADMIN_NAME });
}

await mongoose.connect(env.MONGO_URI);
try {
  const profile = await User.findOne({ email });
  if (profile?.firebaseUid && profile.firebaseUid !== firebaseUser.uid) {
    throw new Error(`${email} already belongs to a different Firebase account.`);
  }
  if (profile) {
    profile.set({ firebaseUid: firebaseUser.uid, role: 'admin' });
    await profile.save();
  } else {
    await User.create({ firebaseUid: firebaseUser.uid, email, name: admin.ADMIN_NAME, role: 'admin' });
  }
  console.log(`${email} is now an admin.`);
} finally {
  await mongoose.disconnect();
}
