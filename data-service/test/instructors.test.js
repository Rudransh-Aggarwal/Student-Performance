import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { register } from 'node:module';

process.env.MONGO_URI ??= 'mongodb://127.0.0.1:0/test';
process.env.FIREBASE_PROJECT_ID ??= 'test-project';
process.env.PORT ??= '0';
process.env.AUTH_SERVICE_URL ??= 'http://auth.test';
process.env.AUTH_SERVICE_SECRET ??= 'development-service-secret';

// Firebase and role lookups use the shared stubs; auth-service calls are faked below.
register('./stubs/hooks.mjs', import.meta.url);
const { default: app } = await import('../src/app.js');

const realFetch = globalThis.fetch;
let authMode = 'ok';
let lastServiceAuth = null;

globalThis.fetch = async (url, init = {}) => {
  if (!String(url).startsWith(process.env.AUTH_SERVICE_URL)) return realFetch(url, init);
  lastServiceAuth = init.headers?.['X-Service-Auth'] ?? null;
  if (authMode === 'down') throw new TypeError('fetch failed');
  if (authMode === 'error') return new Response('boom', { status: 500 });
  return Response.json({
    users: [{ firebaseUid: 'uid-instructor', name: 'teacher_1', email: 't1@test.local', role: 'instructor' }],
  });
};

const TOKENS = { student: 'tok-student', instructor: 'tok-instructor', admin: 'tok-admin' };

describe('GET /api/data/admin/instructors', () => {
  let server;
  let base;

  before(async () => {
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    base = `http://127.0.0.1:${server.address().port}/api/data`;
  });

  after(async () => {
    globalThis.fetch = realFetch;
    await new Promise((resolve) => server.close(resolve));
  });

  async function call(token) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await realFetch(`${base}/admin/instructors`, { headers });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }

  it('rejects requests without a token', async () => {
    assert.equal((await call(null)).status, 401);
  });

  it('forbids instructors and students', async () => {
    assert.equal((await call(TOKENS.instructor)).status, 403);
    assert.equal((await call(TOKENS.student)).status, 403);
  });

  it('returns instructor directory entries to admins, using the service secret', async () => {
    authMode = 'ok';
    const res = await call(TOKENS.admin);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.instructors, [
      { firebaseUid: 'uid-instructor', name: 'teacher_1', email: 't1@test.local', role: 'instructor' },
    ]);
    assert.equal(lastServiceAuth, process.env.AUTH_SERVICE_SECRET);
  });

  it('returns 502 when auth-service responds with an error', async () => {
    authMode = 'error';
    const res = await call(TOKENS.admin);
    assert.equal(res.status, 502);
    assert.equal(res.body.error, 'Could not load instructors from the auth service');
  });

  it('returns 502 when auth-service is unreachable', async () => {
    authMode = 'down';
    const res = await call(TOKENS.admin);
    assert.equal(res.status, 502);
    assert.equal(res.body.error, 'Could not reach the auth service');
  });
});