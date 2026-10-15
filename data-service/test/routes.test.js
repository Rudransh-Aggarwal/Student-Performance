import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { register } from 'node:module';

process.env.MONGO_URI ??= 'mongodb://127.0.0.1:0/test';
process.env.FIREBASE_PROJECT_ID ??= 'test-project';
process.env.PORT ??= '0';
process.env.AUTH_SERVICE_URL ??= 'http://127.0.0.1:0';

// Route stubs for Firebase, auth-service and MongoDB services (works on any Node >= 20.6).
register('./stubs/hooks.mjs', import.meta.url);
const { assignments } = await import('./stubs/index.js');
const { default: app } = await import('../src/app.js');

const TOKENS = {
  student: 'tok-student',
  instructor: 'tok-instructor',
  instructor2: 'tok-instructor-2',
  admin: 'tok-admin',
};

describe('data-service HTTP routes', () => {
  let server;
  let base;

  before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/data`;
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  async function call(method, path, { token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  describe('authentication', () => {
    it('rejects requests without a bearer token', async () => {
      const res = await call('GET', '/modules');
      assert.equal(res.status, 401);
    });

    it('rejects invalid tokens', async () => {
      const res = await call('GET', '/modules', { token: 'tok-bogus' });
      assert.equal(res.status, 401);
    });

    it('returns 404 when a student has no linked demo account', async () => {
      const res = await call('GET', '/demo-accounts/me', { token: TOKENS.student });
      assert.equal(res.status, 404);
    });
  });

  describe('instructor module access', () => {
    it('forbids students from cohort data', async () => {
      const res = await call('GET', '/modules/AAA/2013J/enrollments', { token: TOKENS.student });
      assert.equal(res.status, 403);
    });

    it('denies an instructor a module that is not assigned to them', async () => {
      const res = await call('GET', '/modules/AAA/2013J/enrollments', { token: TOKENS.instructor });
      assert.equal(res.status, 403);
      assert.equal(res.body.error, 'Module not assigned to this instructor');
    });

    it('denies unassigned instructors on the student detail route', async () => {
      const res = await call('GET', '/students/1/modules/AAA/2013J', { token: TOKENS.instructor });
      assert.equal(res.status, 403);
    });

    it('lets an admin assign a module to an instructor, idempotently', async () => {
      const first = await call('POST', '/admin/module-assignments', {
        token: TOKENS.admin,
        body: { instructorId: 'uid-instructor', moduleCode: 'AAA' },
      });
      assert.equal(first.status, 201);

      const second = await call('POST', '/admin/module-assignments', {
        token: TOKENS.admin,
        body: { instructorId: 'uid-instructor', moduleCode: 'AAA' },
      });
      assert.equal(second.status, 201);
      assert.deepEqual([...assignments.get('uid-instructor')], ['AAA']);
    });

    it('allows the assigned instructor to read enrollments', async () => {
      const res = await call('GET', '/modules/AAA/2013J/enrollments', { token: TOKENS.instructor });
      assert.equal(res.status, 200);
      assert.equal(res.body.enrollments.length, 1);
    });

    it('still denies that instructor an unassigned module', async () => {
      const res = await call('GET', '/modules/ZZZ/2013J/enrollments', { token: TOKENS.instructor });
      assert.equal(res.status, 403);
    });

    it('returns only the current instructor\'s own module codes', async () => {
      const mine = await call('GET', '/instructor/me/modules', { token: TOKENS.instructor });
      assert.equal(mine.status, 200);
      assert.deepEqual(mine.body.moduleCodes, ['AAA']);

      const other = await call('GET', '/instructor/me/modules', { token: TOKENS.instructor2 });
      assert.deepEqual(other.body.moduleCodes, []);
    });

    it('lets admins read any module regardless of assignment', async () => {
      const res = await call('GET', '/modules/ZZZ/2013J/enrollments', { token: TOKENS.admin });
      assert.equal(res.status, 200);
    });
  });

  describe('admin assignment validation', () => {
    it('rejects assigning a non-instructor account', async () => {
      const res = await call('POST', '/admin/module-assignments', {
        token: TOKENS.admin,
        body: { instructorId: 'uid-student-target', moduleCode: 'AAA' },
      });
      assert.equal(res.status, 400);
    });

    it('returns 404 for an unknown module code', async () => {
      const res = await call('POST', '/admin/module-assignments', {
        token: TOKENS.admin,
        body: { instructorId: 'uid-instructor', moduleCode: 'NOPE' },
      });
      assert.equal(res.status, 404);
    });

    it('rejects a malformed body with 400', async () => {
      const res = await call('POST', '/admin/module-assignments', {
        token: TOKENS.admin,
        body: { instructorId: 'uid-instructor' },
      });
      assert.equal(res.status, 400);
    });

    it('forbids non-admins from assigning modules', async () => {
      const res = await call('POST', '/admin/module-assignments', {
        token: TOKENS.instructor,
        body: { instructorId: 'uid-instructor', moduleCode: 'AAA' },
      });
      assert.equal(res.status, 403);
    });
  });

  describe('revocation', () => {
    it('removes an assignment and then denies access', async () => {
      const removed = await call('DELETE', '/admin/module-assignments/uid-instructor/AAA', {
        token: TOKENS.admin,
      });
      assert.equal(removed.status, 204);

      const again = await call('DELETE', '/admin/module-assignments/uid-instructor/AAA', {
        token: TOKENS.admin,
      });
      assert.equal(again.status, 404);

      const denied = await call('GET', '/modules/AAA/2013J/enrollments', { token: TOKENS.instructor });
      assert.equal(denied.status, 403);
    });
  });
});