import { AppError } from '../../src/utils/AppError.js';

// ---- Firebase (token verification) ----
const TOKEN_TO_UID = {
  'tok-student': 'uid-student',
  'tok-instructor': 'uid-instructor',
  'tok-instructor-2': 'uid-instructor-2',
  'tok-admin': 'uid-admin',
};

export async function verifyToken(token) {
  const uid = TOKEN_TO_UID[token];
  if (!uid) throw new Error('Decoding Firebase ID token failed');
  return { uid, email: `${uid}@test.local` };
}

// ---- auth-service user lookup ----
const UID_TO_ROLE = {
  'uid-student': 'student',
  'uid-instructor': 'instructor',
  'uid-instructor-2': 'instructor',
  'uid-admin': 'admin',
  'uid-student-target': 'student',
};

export async function getUserByFirebaseUid(uid) {
  const role = UID_TO_ROLE[uid];
  if (!role) throw new Error(`User not found: ${uid}`);
  return { firebaseUid: uid, role, name: uid, email: `${uid}@test.local` };
}

// ---- module assignments (in-memory, same contract as the real service) ----
export const assignments = new Map();

export async function assignModuleToInstructor(instructorId, moduleCode) {
  if (!assignments.has(instructorId)) assignments.set(instructorId, new Set());
  assignments.get(instructorId).add(moduleCode);
}

export async function getAssignedModules(instructorId) {
  return [...(assignments.get(instructorId) ?? [])].sort();
}

export async function isModuleAssigned(instructorId, moduleCode) {
  return assignments.get(instructorId)?.has(moduleCode) ?? false;
}

export async function removeModuleAssignment(instructorId, moduleCode) {
  return assignments.get(instructorId)?.delete(moduleCode) ?? false;
}

// ---- modules ----
const KNOWN_MODULES = {
  AAA: [{ code: 'AAA', presentation: '2013J', lengthDays: 268 }],
};

export async function listModules() {
  return Object.values(KNOWN_MODULES).flat();
}

export async function getModuleCohorts(code) {
  return KNOWN_MODULES[code] ?? [];
}

export async function getModuleEnrollments(code, presentation) {
  return [
    { studentId: 1, moduleCode: code, presentation, finalResult: 'Pass', studiedCredits: 60, registeredDay: -10 },
  ];
}

// ---- students ----
export async function getStudentDetail() {
  return { student: { externalId: 1 }, enrollment: {}, activity: [] };
}

export async function linkUserToStudent(userId, externalId) {
  return { userId, externalId };
}

export async function getDemoAccountForUser(userId) {
  if (userId === 'uid-student') throw new AppError('No demo account linked', 404);
  return { userId, externalId: 1 };
}

export async function getStudentPredictionDataForUser() {
  return { studentId: 1, features: {}, dataCounts: {} };
}