import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize } from '../../src/middlewares/role.middleware.js';
import { ApiError } from '../../src/utils/apiError.js';

// ─────────────────────────────────────────────────────────────────────────────
// Authorization tests for the WhatsApp fee-reminder endpoints.
//
// Sending a WhatsApp reminder can contact a real guardian, so every endpoint
// must be Admin-only. The tests exercise the real role guard and statically
// inspect the route wiring so a later edit cannot silently drop `protect` or
// `authorize('admin')` from one of the three routes.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.resolve(__dirname, '../../src/routes/whatsappFeeReminder.routes.js');
const APP_FILE = path.resolve(__dirname, '../../src/app.js');

const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

const extractRouteCalls = (source) => {
  const calls = [];
  const methodPattern = /router\.(get|post|put|patch|delete)\s*\(/g;
  let match = methodPattern.exec(source);

  while (match !== null) {
    const openIndex = match.index + match[0].length - 1;
    let depth = 0;
    let end = openIndex;

    for (let i = openIndex; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    calls.push({ method: match[1], args: source.slice(openIndex + 1, end) });
    match = methodPattern.exec(source);
  }

  return calls;
};

const runMiddleware = (middleware, req) => {
  let nextCalled = false;
  let thrown = null;
  try {
    middleware(req, {}, () => {
      nextCalled = true;
    });
  } catch (error) {
    thrown = error;
  }
  return { nextCalled, thrown };
};

const createProtectStub = (user) => (req) => {
  if (!user) throw new ApiError(401, 'Not authorized, no token');
  req.user = user;
};

const runEndpointChain = (user) => {
  const req = { headers: { authorization: user ? 'Bearer test-token' : '' } };
  let handlerCalled = false;
  const chain = [
    createProtectStub(user),
    authorize('admin'),
    () => {
      handlerCalled = true;
    },
  ];

  for (const middleware of chain) {
    try {
      middleware(req, {}, () => {});
    } catch (error) {
      return { handlerCalled, thrown: error };
    }
  }
  return { handlerCalled, thrown: null };
};

describe('WhatsApp fee reminder authorization', () => {
  const guard = authorize('admin');

  it('allows an administrator', () => {
    const { nextCalled, thrown } = runMiddleware(guard, { user: { role: 'admin' } });
    assert.equal(thrown, null);
    assert.equal(nextCalled, true);
  });

  it('denies receptionists even when they hold fee-management grants', () => {
    const { nextCalled, thrown } = runMiddleware(guard, {
      user: { role: 'receptionist' },
      receptionistProfile: {
        permissions: ['module:fee-management', 'page:fee-management:reminders'],
      },
    });
    assert.equal(nextCalled, false);
    assert.equal(thrown?.statusCode, 403);
  });

  it('denies every other portal role', () => {
    for (const role of ['teacher', 'student']) {
      const { nextCalled, thrown } = runMiddleware(guard, { user: { role } });
      assert.equal(nextCalled, false);
      assert.equal(thrown?.statusCode, 403);
    }
  });

  it('denies an unauthenticated request', () => {
    const { nextCalled, thrown } = runMiddleware(guard, {});
    assert.equal(nextCalled, false);
    assert.equal(thrown?.statusCode, 403);
  });

  it('reaches the handler only for an administrator', () => {
    assert.deepEqual(runEndpointChain({ role: 'admin' }), { handlerCalled: true, thrown: null });
    const unauthenticated = runEndpointChain(null);
    assert.equal(unauthenticated.handlerCalled, false);
    assert.equal(unauthenticated.thrown?.statusCode, 401);
    const receptionist = runEndpointChain({ role: 'receptionist' });
    assert.equal(receptionist.handlerCalled, false);
    assert.equal(receptionist.thrown?.statusCode, 403);
  });
});

describe('WhatsApp fee reminder routes', () => {
  it('protects every route with authentication and the admin role', () => {
    const source = stripComments(fs.readFileSync(ROUTES_FILE, 'utf8'));
    const calls = extractRouteCalls(source);

    assert.equal(calls.length, 3);
    for (const call of calls) {
      assert.match(call.args, /\bprotect\b/);
      assert.match(call.args, /authorize\(\s*['"]admin['"]\s*\)/);
      assert.doesNotMatch(call.args, /requireModuleAccess/);
      assert.ok(
        call.args.indexOf('protect') < call.args.indexOf("authorize"),
        'protect must run before the role check',
      );
    }

    assert.ok(calls.some((call) => call.method === 'get' && /\/recipients/.test(call.args)));
    assert.ok(
      calls.some((call) => call.method === 'get' && /students\/:studentId\/preview/.test(call.args)),
    );
    assert.ok(calls.some((call) => call.method === 'post' && /\/send/.test(call.args)));
  });

  it('mounts the Admin-only router under /api/v1/whatsapp/fee-reminders', () => {
    const appSource = fs.readFileSync(APP_FILE, 'utf8');
    assert.match(appSource, /whatsappFeeReminderRoutes/);
    assert.match(appSource, /app\.use\(\s*['"]\/api\/v1\/whatsapp\/fee-reminders['"]\s*,\s*whatsappFeeReminderRoutes\s*\)/);
  });
});
