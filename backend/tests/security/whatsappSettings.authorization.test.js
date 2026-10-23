import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authorize } from '../../src/middlewares/role.middleware.js';
import { ApiError } from '../../src/utils/apiError.js';

// ─────────────────────────────────────────────────────────────────────────────
// Authorization tests for the WhatsApp settings endpoints.
//
// The WhatsApp API token is a provider credential, so the whole section is
// Admin-only (`protect` + `authorize('admin')`), exactly like the other
// secret-management endpoints (`defaultPassword.routes.js`).
//
// The role guard is exercised directly with fake requests so the real
// authorization logic is verified, and the route file is checked to make sure
// the guard is actually wired to every endpoint. `protect` is stubbed in the
// chain simulation because the real middleware needs a database connection.
// ─────────────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROUTES_FILE = path.resolve(__dirname, '../../src/routes/whatsappSettings.routes.js');
const APP_FILE = path.resolve(__dirname, '../../src/app.js');

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

// Removes the comments so a static assertion inspects the executed code only
// and is not confused by the explanatory comment block.
const stripComments = (source) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|\s)\/\/.*$/gm, '$1');

// A stand-in for `protect`: it rejects an unauthenticated request with 401 and
// otherwise attaches the session user, exactly like the real middleware does.
const createProtectStub = (user) => (req) => {
  if (!user) {
    throw new ApiError(401, 'Not authorized, no token');
  }
  req.user = user;
};

/**
 * Run the middleware chain of a WhatsApp endpoint: `protect` -> `authorize` ->
 * handler. Returns whether the handler was reached and the error that was
 * raised (if any).
 */
const runEndpointChain = (user, receptionistProfile) => {
  const req = { headers: { authorization: user ? 'Bearer test-token' : '' } };
  if (receptionistProfile) req.receptionistProfile = receptionistProfile;

  let handlerCalled = false;
  const handler = () => {
    handlerCalled = true;
  };

  const chain = [createProtectStub(user), authorize('admin'), handler];

  for (const middleware of chain) {
    try {
      middleware(req, {}, () => {});
    } catch (error) {
      return { handlerCalled, thrown: error };
    }
  }

  return { handlerCalled, thrown: null };
};

describe('whatsappSettings authorization', () => {
  const guard = authorize('admin');

  it('should allow an administrator', () => {
    const { nextCalled, thrown } = runMiddleware(guard, { user: { role: 'admin' } });

    assert.strictEqual(thrown, null);
    assert.strictEqual(nextCalled, true);
  });

  it('should deny a receptionist without the school-settings grant', () => {
    const { nextCalled, thrown } = runMiddleware(guard, {
      user: { role: 'receptionist' },
      receptionistProfile: { permissions: ['module:dashboard'] },
    });

    assert.strictEqual(nextCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 403);
  });

  it('should deny a receptionist holding the school-settings module grant', () => {
    // A Receptionist grant for the ordinary school settings must never open
    // the WhatsApp provider credentials.
    const { nextCalled, thrown } = runMiddleware(guard, {
      user: { role: 'receptionist' },
      receptionistProfile: { permissions: ['module:school-settings'] },
    });

    assert.strictEqual(nextCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 403);
  });

  it('should deny a receptionist holding every module grant', () => {
    const { nextCalled, thrown } = runMiddleware(guard, {
      user: { role: 'receptionist' },
      receptionistProfile: {
        permissions: [
          'module:dashboard',
          'module:school-settings',
          'module:students',
          'module:communication',
        ],
      },
    });

    assert.strictEqual(nextCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 403);
  });

  it('should deny every other portal role', () => {
    for (const role of ['teacher', 'student']) {
      const { nextCalled, thrown } = runMiddleware(guard, { user: { role } });

      assert.strictEqual(nextCalled, false);
      assert.ok(thrown);
      assert.strictEqual(thrown.statusCode, 403);
    }
  });

  it('should deny a request without an authenticated user', () => {
    const { nextCalled, thrown } = runMiddleware(guard, {});

    assert.strictEqual(nextCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 403);
  });
});

describe('whatsappSettings endpoint authorization chain', () => {
  it('should let an administrator read the status, save a token and test the connection', () => {
    const { handlerCalled, thrown } = runEndpointChain({ role: 'admin' });

    assert.strictEqual(thrown, null);
    assert.strictEqual(handlerCalled, true);
  });

  it('should reject an unauthenticated request with 401 before the role check', () => {
    const { handlerCalled, thrown } = runEndpointChain(null);

    assert.strictEqual(handlerCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 401);
  });

  it('should never reach the handler for a receptionist with the school-settings grant', () => {
    const { handlerCalled, thrown } = runEndpointChain(
      { role: 'receptionist' },
      { permissions: ['module:school-settings'] },
    );

    assert.strictEqual(handlerCalled, false);
    assert.ok(thrown);
    assert.strictEqual(thrown.statusCode, 403);
  });

  it('should never reach the handler for a teacher or a student', () => {
    for (const role of ['teacher', 'student']) {
      const { handlerCalled, thrown } = runEndpointChain({ role });

      assert.strictEqual(handlerCalled, false);
      assert.ok(thrown);
      assert.strictEqual(thrown.statusCode, 403);
    }
  });
});

describe('whatsappSettings route wiring', () => {
  const source = fs.readFileSync(ROUTES_FILE, 'utf8');
  const code = stripComments(source);
  const calls = extractRouteCalls(code);

  it('should expose the status, token and connection-test endpoints', () => {
    const routes = calls.map((call) => ({
      method: call.method,
      path: (call.args.match(/^\s*'([^']+)'/) || [])[1],
    }));

    assert.deepStrictEqual(routes, [
      { method: 'get', path: '/status' },
      { method: 'put', path: '/token' },
      { method: 'post', path: '/test-connection' },
    ]);
  });

  it('should protect every endpoint with protect + authorize(admin)', () => {
    assert.ok(calls.length >= 3);

    for (const call of calls) {
      assert.ok(
        /(^|[\s,(])protect([,)\s]|$)/.test(call.args),
        `${call.method} endpoint is not protected by the auth middleware`,
      );
      assert.ok(
        call.args.includes("authorize('admin')"),
        `${call.method} endpoint is not restricted to the admin role`,
      );
      // The session check must run before the role check.
      assert.ok(
        call.args.indexOf('protect') < call.args.indexOf("authorize('admin')"),
        `${call.method} endpoint checks the role before the session`,
      );
    }
  });

  it('should not fall back to the shared module permission guard', () => {
    // `requireModuleAccess('school-settings')` would let a Receptionist with
    // the school-settings grant reach the provider credentials.
    assert.ok(!code.includes('requireModuleAccess'));
    assert.ok(!code.includes('permission.middleware.js'));
  });

  it('should validate the token after the role check and before the handler', () => {
    const tokenRoute = calls.find((call) => call.args.includes("'/token'"));

    assert.ok(tokenRoute);
    assert.ok(tokenRoute.args.includes('validateWhatsAppToken'));
    assert.ok(
      tokenRoute.args.indexOf("authorize('admin')") < tokenRoute.args.indexOf('validateWhatsAppToken'),
      'the token endpoint validates the body before the role check',
    );
    assert.ok(
      tokenRoute.args.indexOf('validateWhatsAppToken') < tokenRoute.args.indexOf('saveWhatsAppToken'),
      'the token endpoint reaches the handler before the body is validated',
    );
  });

  it('should mount the router behind the versioned api prefix', () => {
    const appSource = fs.readFileSync(APP_FILE, 'utf8');

    assert.ok(appSource.includes("app.use('/api/v1/whatsapp-settings', whatsappSettingsRoutes);"));
    assert.ok(appSource.includes("import whatsappSettingsRoutes from './routes/whatsappSettings.routes.js';"));
  });

  it('should never expose the raw token through an endpoint', () => {
    assert.ok(!/router\.\w+\([^)]*\)\s*;?\s*[^=]*=?\s*req\.body\.apiToken\s*;?\s*\n\s*return\s+res/.test(code));
    // The token is only forwarded to the service, never to the response.
    assert.ok(!code.includes('res.json(req.body'));
  });
});
