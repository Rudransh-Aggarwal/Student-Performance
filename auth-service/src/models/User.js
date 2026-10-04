import { Schema, model } from 'mongoose';

export const ROLES = ['student', 'instructor', 'admin'];

/**
 * Application profile keyed by the Firebase UID. Firebase owns identity (passwords, providers, tokens);
 * this collection is the trusted source of the user's role. Legacy fields from the old auth system
 * (passwordHash, googleId, githubId, refreshTokens) are intentionally absent from the schema but left in the data.
 */
const userSchema = new Schema(
  {
    firebaseUid: { type: String, unique: true, sparse: true }, // sparse: legacy rows have none until migrated
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ROLES, default: 'student', required: true },
    // Set only for social sign-ups that did not pick a role; cleared by the one-time POST /api/auth/role.
    roleSelectionPending: { type: Boolean, default: false },
    avatarUrl: { type: String },
  },
  { timestamps: true },
);

export const User = model('User', userSchema);