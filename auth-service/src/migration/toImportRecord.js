/**
 * Maps a legacy MongoDB user to a Firebase import record. The Mongo _id becomes the Firebase UID, so every
 * existing reference to the user (e.g. linked student records) stays valid.
 */
export function toImportRecord(doc) {
  const providerData = [];
  for (const [field, providerId] of [['googleId', 'google.com'], ['githubId', 'github.com']]) {
    if (doc[field]) {
      providerData.push({
        uid: doc[field], email: doc.email, displayName: doc.name, providerId,
        ...(doc.avatarUrl && { photoURL: doc.avatarUrl }),
      });
    }
  }

  return {
    uid: String(doc._id),
    email: doc.email,
    displayName: doc.name,
    ...(doc.avatarUrl && { photoURL: doc.avatarUrl }),
    emailVerified: providerData.length > 0, // only provider-verified emails count as verified
    ...(doc.passwordHash && { passwordHash: Buffer.from(doc.passwordHash) }), // bcrypt hashes are importable as-is
    ...(providerData.length > 0 && { providerData }),
  };
}
