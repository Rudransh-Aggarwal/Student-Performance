import { User } from '../models/User.js';

/** The only place that touches the users collection; tests swap it for an in-memory fake. */
export const mongoUsers = {
  findByUid: (uid) => User.findOne({ firebaseUid: uid }).lean(),
  create: async (data) => (await User.create(data)).toObject(),
  listByRole: (role) => User.find({ role, firebaseUid: { $ne: null } }).sort({ name: 1 }).lean(),
  listAll: () => User.find({ firebaseUid: { $ne: null } }).sort({ name: 1 }).limit(1000).lean(),
  // Atomic: admin accounts are never matched, so they cannot be changed through the API.
  updateRole: (uid, role) =>
    User.findOneAndUpdate(
      { firebaseUid: uid, role: { $ne: 'admin' } },
      { $set: { role, roleSelectionPending: false } },
      { new: true },
    ).lean(),
  // Atomic: only succeeds while the role is still pending, so it can happen once.
  confirmRole: (uid, role) =>
    User.findOneAndUpdate(
      { firebaseUid: uid, roleSelectionPending: true },
      { $set: { role, roleSelectionPending: false } },
      { new: true },
    ).lean(),
};