import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';

process.env.MONGO_URI = 'mongodb://localhost:27017/unused';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.FIREBASE_PROJECT_ID = 'demo-test';
process.env.AUTH_SERVICE_SECRET = 'development-service-secret';

const { createApp } = await import('../src/app.js');

const TOKENS = {
  'tok-admin': { uid: 'uid-admin', email: 'admin@example.com' },
  'tok-student': { uid: 'uid-student', email: 'student@example.com' },
};
const fakeVerify = async (token) => {
  if (!TOKENS[token]) throw new Error('invalid token');
  return TOKENS[token];
};

function fakeUsers() {
  const rows = [
    { _id: 'a', firebaseUid: 'uid-admin', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    { _id: 's', firebaseUid: 'uid-student', email: 'student@example.com', name: 'Student', role: 'student' },
    { _id: 'o', firebaseUid: 'uid-other-admin', email: 'other@example.com', name: 'Other', role: 'admin' },
    { _id: 'i', firebaseUid: 'uid-inst', email: 'inst@example.com', name: 'Inst', role: 'instructor', roleSelectionPending: true },
  ];
  return {
    findByUid: async (uid) => rows.find((row) => row.firebaseUid === uid) ?? null,
    listAll: async () => rows.map((row) => ({ ...row })),
    updateRole: async (uid, role) => {
      const row = rows.find((r) => r.firebaseUid === uid && r.role !== 'admin');
      if (!row) return null;
      Object.assign(row, { role, roleSelectionPending: false });
      return { ...row };
    },
  };
}

// Stand-in for data-service: records what auth-service reports after each role change.
function fakeNotifier(calls, { fail = false } = {}) {
  return async (change) => {
    calls.push(change);
    if (fail) {
      const error = new Error('data-service down');
      error.status = 502;
      error.code = 'ROLE_SYNC_FAILED';
      throw Object.assign(error, { status: 502, code: 'ROLE_SYNC_FAILED' });
    }
  };
}

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}/api/auth` };
}

function makeCaller(base) {
  return async function call(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
}

describe('admin role management', () => {
  const calls = [];
  let server;
  let call;

  before(async () => {
    const started = await startServer(
      createApp({
        verifyIdToken: fakeVerify,
        users: fakeUsers(),
        isReady: () => false,
        notifyRoleChange: fakeNotifier(calls),
      }),
    );
    server = started.server;
    call = makeCaller(started.base);
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('blocks non-admins from listing users', async () => {
    const res = await call('GET', '/admin/users', { token: 'tok-student' });
    assert.equal(res.status, 403);
  });

  it('lets an admin list users with their Firebase UIDs', async () => {
    const res = await call('GET', '/admin/users', { token: 'tok-admin' });
    assert.equal(res.status, 200);
    assert.ok(res.body.users.some((u) => u.firebaseUid === 'uid-student'));
  });

  it('changes a student to instructor, clears the pending flag and records the change', async () => {
    const res = await call('PATCH', '/admin/users/uid-student/role', {
      token: 'tok-admin',
      body: { role: 'instructor' },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'instructor');
    assert.deepEqual(calls.at(-1), {
      actorUid: 'uid-admin',
      actorName: 'Admin',
      targetUid: 'uid-student',
      targetName: 'Student',
      previousRole: 'student',
      newRole: 'instructor',
    });
  });

  it('records a demotion from instructor to student', async () => {
    const res = await call('PATCH', '/admin/users/uid-student/role', {
      token: 'tok-admin',
      body: { role: 'student' },
    });
    assert.equal(res.status, 200);
    assert.equal(calls.at(-1).previousRole, 'instructor');
    assert.equal(calls.at(-1).newRole, 'student');
  });

  it('rejects assigning the admin role', async () => {
    const res = await call('PATCH', '/admin/users/uid-student/role', {
      token: 'tok-admin',
      body: { role: 'admin' },
    });
    assert.equal(res.status, 400);
  });

  it('prevents an admin from changing their own role', async () => {
    const res = await call('PATCH', '/admin/users/uid-admin/role', {
      token: 'tok-admin',
      body: { role: 'student' },
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'CANNOT_CHANGE_OWN_ROLE');
  });

  it('prevents changing another admin', async () => {
    const res = await call('PATCH', '/admin/users/uid-other-admin/role', {
      token: 'tok-admin',
      body: { role: 'student' },
    });
    assert.equal(res.status, 403);
    assert.equal(res.body.error.code, 'ADMIN_ROLE_PROTECTED');
  });

  it('returns 404 for an unknown user', async () => {
    const res = await call('PATCH', '/admin/users/uid-nobody/role', {
      token: 'tok-admin',
      body: { role: 'student' },
    });
    assert.equal(res.status, 404);
  });
});

describe('admin role change when data-service is unavailable', () => {
  let server;
  let call;

  before(async () => {
    const started = await startServer(
      createApp({
        verifyIdToken: fakeVerify,
        users: fakeUsers(),
        isReady: () => false,
        notifyRoleChange: fakeNotifier([], { fail: true }),
      }),
    );
    server = started.server;
    call = makeCaller(started.base);
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('returns 502 ROLE_SYNC_FAILED so the change can be retried', async () => {
    const res = await call('PATCH', '/admin/users/uid-student/role', {
      token: 'tok-admin',
      body: { role: 'instructor' },
    });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'ROLE_SYNC_FAILED');
  });
});