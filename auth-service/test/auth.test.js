import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import express from 'express';

process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.FIREBASE_PROJECT_ID = 'demo-test';
process.env.AUTH_SERVICE_SECRET = 'development-service-secret';

const { createApp } = await import('../src/app.js');
const { createAuth } = await import('../src/middleware/auth.js');
const { errorHandler } = await import('../src/middleware/errorHandler.js');
const { toImportRecord } = await import('../src/migration/toImportRecord.js');

// Stand-ins for Firebase (token -> decoded claims) and MongoDB (users collection).
const TOKENS = {
  'tok-alice': { uid: 'uid-alice', email: 'Alice@Example.com', name: 'Alice' },
  'tok-bob': { uid: 'uid-bob', email: 'bob@example.com' },
  'tok-forged': { uid: 'uid-mallory', email: 'mallory@example.com', role: 'admin', admin: true },
  'tok-root': { uid: 'uid-root', email: 'root@example.com' },
  'tok-nomail': { uid: 'uid-phone' },
  'tok-dup': { uid: 'uid-new', email: 'taken@example.com' },
};
const fakeVerify = async (token) => {
  if (!TOKENS[token]) throw new Error('invalid token');
  return TOKENS[token];
};

function fakeUsers(seed = []) {
  const rows = [...seed];
  return {
    rows,
    findByUid: async (uid) => rows.find((row) => row.firebaseUid === uid) ?? null,
    create: async (data) => {
      if (rows.some((row) => row.email === data.email)) throw Object.assign(new Error('dup'), { code: 11000 });
      const row = { _id: `id-${rows.length + 1}`, ...data };
      rows.push(row);
      return row;
    },
  };
}

const seeded = () => [
  { _id: 'id-root', firebaseUid: 'uid-root', email: 'root@example.com', name: 'Root', role: 'admin' },
  { _id: 'id-legacy', email: 'taken@example.com', name: 'Legacy', role: 'student' }, // not migrated: no firebaseUid
];

describe('auth-service', () => {
  let server;
  let base;
  let users;
  let guarded;
  let guardedBase;

  before(async () => {
    users = fakeUsers(seeded());
    server = createApp({ verifyIdToken: fakeVerify, users, isReady: () => false }).listen(0);

    const auth = createAuth({ verifyIdToken: fakeVerify, users });
    const app = express();
    app.get('/admin-only', auth.authenticate, auth.requireRole('admin'), (_req, res) => res.json({ ok: true }));
    app.use(errorHandler);
    guarded = app.listen(0);

    await Promise.all([server, guarded].map((s) => new Promise((resolve) => s.once('listening', resolve))));
    base = `http://127.0.0.1:${server.address().port}`;
    guardedBase = `http://127.0.0.1:${guarded.address().port}`;
  });

  after(() => {
    server.close();
    guarded.close();
  });

  const call = (path, { token, body, method = body ? 'POST' : 'GET', headers = {}, root = base } = {}) =>
    fetch(`${root}${path}`, {
      method,
      headers: {
        ...(body && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...headers,
      },
      ...(body && { body: JSON.stringify(body) }),
    });
  const json = (response) => response.json();

  it('exposes health probes', async () => {
    assert.equal((await call('/healthz')).status, 200);
    assert.equal((await call('/readyz')).status, 503);
  });

  it('rejects missing and invalid tokens', async () => {
    assert.equal((await json(await call('/api/auth/me'))).error.code, 'UNAUTHENTICATED');
    const bad = await call('/api/auth/me', { token: 'garbage' });
    assert.equal(bad.status, 401);
    assert.equal((await json(bad)).error.code, 'INVALID_TOKEN');
    assert.equal((await call('/api/auth/session', { token: 'garbage', body: {} })).status, 401);
  });

  it('requires valid service auth for the internal user lookup route', async () => {
    const missing = await call('/api/auth/user/uid-root');
    assert.equal(missing.status, 401);
    assert.equal((await json(missing)).error.code, 'SERVICE_AUTH_REQUIRED');

    const ok = await call('/api/auth/user/uid-root', {
      headers: { 'X-Service-Auth': 'development-service-secret' },
    });
    assert.equal(ok.status, 200);
    assert.equal((await json(ok)).role, 'admin');
  });

  it('really rejects a malformed token with the real Firebase Admin SDK (no network needed)', async () => {
    const realBase = createApp({ users: fakeUsers(), isReady: () => true }).listen(0);
    await new Promise((resolve) => realBase.once('listening', resolve));
    const response = await call('/api/auth/me', { token: 'not.a.jwt', root: `http://127.0.0.1:${realBase.address().port}` });
    realBase.close();
    assert.equal(response.status, 401);
  });

  it('refuses a valid token that has no profile yet', async () => {
    const response = await call('/api/auth/me', { token: 'tok-alice' });
    assert.equal(response.status, 403);
    assert.equal((await json(response)).error.code, 'NO_PROFILE');
  });

  it('creates a student profile on first session, normalising the email, and is idempotent', async () => {
    const first = await json(await call('/api/auth/session', { token: 'tok-alice', body: {} }));
    assert.deepEqual([first.user.role, first.user.email, first.user.name], ['student', 'alice@example.com', 'Alice']);
    const again = await json(await call('/api/auth/session', { token: 'tok-alice', body: {} }));
    assert.equal(again.user.id, first.user.id);
    assert.equal(users.rows.filter((row) => row.firebaseUid === 'uid-alice').length, 1);
  });

  it('lets a new user pick student or instructor at creation, and accepts an empty body', async () => {
    const created = await json(await call('/api/auth/session', { token: 'tok-bob', body: { role: 'instructor', name: 'Bob B' } }));
    assert.deepEqual([created.user.role, created.user.name], ['instructor', 'Bob B']);
    const bare = await call('/api/auth/session', { token: 'tok-bob', method: 'POST' });
    assert.equal(bare.status, 200);
  });

  it('never lets a user change their own role', async () => {
    const response = await call('/api/auth/session', { token: 'tok-alice', body: { role: 'instructor' } });
    assert.equal((await json(response)).user.role, 'student'); // existing profile wins; body ignored
    assert.equal((await call('/api/auth/session', { token: 'tok-alice', body: { role: 'admin' } })).status, 400);
    assert.equal((await call('/api/auth/session', { token: 'tok-alice', body: { isAdmin: true } })).status, 400);
    assert.equal((await call('/api/auth/session', { token: 'tok-alice', body: { permissions: ['*'] } })).status, 400);
    assert.equal(users.rows.find((row) => row.firebaseUid === 'uid-alice').role, 'student');
  });

  it('ignores role claims inside the token and role hints in query or headers', async () => {
    const created = await json(await call('/api/auth/session', { token: 'tok-forged', body: {} }));
    assert.equal(created.user.role, 'student');
    const spoofed = await json(await call('/api/auth/me?role=admin&isAdmin=true', {
      token: 'tok-forged',
      headers: { 'X-Role': 'admin', 'X-Is-Admin': 'true' },
    }));
    assert.equal(spoofed.user.role, 'student');
  });

  it('enforces roles on protected routes', async () => {
    const anon = await call('/admin-only', { root: guardedBase });
    assert.equal(anon.status, 401);
    const student = await call('/admin-only', { token: 'tok-alice', root: guardedBase });
    assert.equal(student.status, 403);
    assert.equal((await json(student)).error.code, 'FORBIDDEN');
    const noProfile = await call('/admin-only', { token: 'tok-nomail', root: guardedBase });
    assert.equal(noProfile.status, 403);
    const admin = await call('/admin-only', { token: 'tok-root', root: guardedBase });
    assert.equal(admin.status, 200);
  });

  it('requires an email, and reports a clear conflict for an unmigrated legacy account', async () => {
    assert.equal((await call('/api/auth/session', { token: 'tok-nomail', body: {} })).status, 400);
    const conflict = await call('/api/auth/session', { token: 'tok-dup', body: {} });
    assert.equal(conflict.status, 409);
    assert.equal((await json(conflict)).error.code, 'EMAIL_IN_USE');
  });
});

describe('legacy user migration mapping', () => {
  it('keeps the Mongo _id as the Firebase uid and carries over bcrypt hashes and provider links', () => {
    const record = toImportRecord({
      _id: { toString: () => '64f0c0ffee' },
      email: 'a@b.com', name: 'A', passwordHash: '$2b$12$abcdefghijklmnopqrstuv', googleId: '1234', githubId: '99',
    });
    assert.equal(record.uid, '64f0c0ffee');
    assert.equal(record.passwordHash.toString(), '$2b$12$abcdefghijklmnopqrstuv');
    assert.deepEqual(record.providerData.map((p) => [p.providerId, p.uid]), [['google.com', '1234'], ['github.com', '99']]);
    assert.equal(record.emailVerified, true);
  });

  it('marks password-only users unverified and omits empty fields', () => {
    const record = toImportRecord({ _id: 'x1', email: 'a@b.com', name: 'A', passwordHash: '$2b$12$zzz' });
    assert.equal(record.emailVerified, false);
    assert.ok(!('providerData' in record) && !('photoURL' in record));
  });
});
