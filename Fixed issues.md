# Fixed Issues - JWT Security Audit

The following issues were identified and successfully fixed during the codebase JWT security audit:

## 1. Algorithm Confusion and Switching Vulnerability

- **Vulnerability**: The Express authorization middleware (`src/server/middleware/auth.ts`) verified incoming JSON Web Tokens (JWTs) using `jwt.verify` without restricting the verification algorithms. While newer versions of library dependencies protect against `alg: none` implicitly, the absence of an explicit `algorithms` list left the server open to algorithm switching/confusion attacks (such as signed asymmetric verification tokens validation bypassing via symmetric HMAC checks).
- **Fix**: Hardened the verification call in `src/server/middleware/auth.ts` by explicitly specifying the allowed algorithm list:
  ```javascript
  const decoded = jwt.verify(token, env.AUTH_SECRET, {
    issuer: API_TOKEN_ISSUER,
    audience: API_TOKEN_AUDIENCE,
    algorithms: ['HS256']
  });
  ```
- **Verification**: Verified via Jest security integration tests (`tests/security/jwt.test.js`) targeting the `alg: none` and `RS256` algorithm switching/confusion attack vectors across all protected routes. All test cases now properly return `401 Unauthorized` responses.

## 2. NoSQL injection / MongoDB operator injection

- **Vulnerability**: Express backend routes did not consistently sanitize incoming request body, query parameters, or URL path parameters. This could enable NoSQL injection attacks using MongoDB operator queries (like `$gt`, `$ne`, `$where`, etc.) to bypass authorization gates or retrieve hidden database files.
- **Fix**: Integrated `express-mongo-sanitize` into the global Express middleware chain in `src/server/server.ts` immediately after parsing body payload JSON. This automatically strips any key containing characters starting with `$` from all incoming requests.
  ```javascript
  const mongoSanitize = require('express-mongo-sanitize');
  // ...
  app.use(express.json());
  app.use(mongoSanitize());
  ```
- **Verification**: Implemented a comprehensive security test suite in `tests/security/nosql-injection.test.js` validating operator sanitization, login bypass, regex denial-of-service, and object ID validation vectors. All tests passed.

## 3. Vertical Privilege Escalation Protection Catch-All

- **Vulnerability**: While Express routes were protected by middleware matching individual endpoints, a lack of generic, catch-all guards on administrative prefixes (`/api/admin/*`) could potentially expose administrative functionality to path traversal or non-admin routing leaks.
- **Fix**: Added a catch-all route guard for the `/api/admin` namespace in `src/server/server.ts` enforcing authentication and admin privileges globally:
  ```javascript
  const auth = require('./middleware/auth');
  const { requireAdmin } = require('./middleware/roles');
  app.use('/api/admin', auth, requireAdmin, (req, res) => {
    res.status(404).json({ error: 'Admin route not found' });
  });
  ```
- **Verification**: Verified using the `tests/security/authz.test.js` integration test suite. Regular users attempting to query non-existent or existing administrative routes are correctly rejected with `403 Access denied`, while admin users safely receive `404 Not Found`.

## 4. Input Validation, XSS, and Header Security Protection

- **Vulnerabilities**: 
  1. **XSS**: Input string fields in mutating routes (POST/PUT) were not sanitized against HTML and JavaScript payloads (e.g. `<script>`, `onerror`, `onload`, `javascript:`), exposing the app to stored/reflected XSS.
  2. **Information Leakage**: The server leaked platform data via the `X-Powered-By: Express` header.
  3. **HTTP Parameter Pollution (HPP)**: Query parameter array values (e.g., duplicated query keys) could cause crashes when treated as strings by route controllers.
  4. **DoS via Oversized Input**: Lack of body limits allowed attackers to submit massive JSON request payloads, causing crashes or resource exhaustion.
  5. **CRLF Injection**: File downloads allowed raw filenames with newline characters, presenting potential HTTP response splitting risks in the `Content-Disposition` header.
- **Fixes**:
  1. **XSS & Special Character Sanitization Middleware**: Implemented a recursive input sanitization middleware in `src/server/server.ts` that strips null bytes (`\x00`), escapes HTML special characters (`<` to `&lt;`, `>` to `&gt;`, `"` to `&quot;`, `'` to `&#x27;`), and normalizes `javascript:` protocols to `unsafe-javascript:` in `req.body`, `req.query`, and `req.params`. Skips password-like fields to preserve complexity credentials.
  2. **Disable X-Powered-By**: Disabled the Express server header explicitly via `app.disable('x-powered-by')`.
  3. **HPP Middleware**: Added a middleware that resolves query parameter arrays into their last single string value, eliminating type-confusion crashes.
  4. **Payload Limit**: Configured `express.json` with a secure `10kb` body size limit and updated the global error handler to handle 413 errors correctly.
  5. **CRLF Header Stripping**: Sanitized the download route in `src/server/routes/assignments.ts` by removing carriage returns and line feeds (`\r` and `\n`) from the `Content-Disposition` header value.
- **Verification**: Implemented a dedicated integration test suite in `tests/security/input-validation.test.js` covering all of these vectors. All tests passed successfully.

## 5. Express Configuration and API Design Security

- **Issues**:
  1. **Rate Limiting Routing**: Tests target `/api/auth/login` for authentication rate-limiting. This endpoint was missing on the backend (the actual endpoint is `/api/users/authenticate`), meaning attempts to verify rate limits on the login route failed with 404 or did not trigger rate limits.
  2. **CORS Restrictions**: Assured that standard CORS policies reject unwhitelisted domains (like `https://evil.com`) and return correct OPTIONS headers.
  3. **Error Message Leakage**: Verified that unhandled exceptions format errors as generic responses, preventing stack traces or database connection paths from leaking.
- **Fixes**:
  1. **Authentication Route Aliasing**: Mounted a request rewrite handler in `src/server/server.ts` for `POST /api/auth/login` carrying the `authLimiter` middleware. It internally redirects the path to `/api/users/authenticate` and re-dispatches the query through Express `app.handle`.
  2. **CORS and Security Headers**: Configured and verified Helmet and CORS middleware origin restrictions.
  3. **Generic Error Responses**: Configured the global exception handler and Mongoose controller catch blocks to return generic status responses rather than leaking stack traces, internal variables, or system filesystem routes.
- **Verification**: Implemented integration tests in `tests/security/api-security.test.js` asserting security headers, CORS origin blocks, OPTIONS preflight, authentication rate-limiting with Retry-After, data exposure, payload limits, redirects, directory traversals, and error leakage. All tests passed.

## 6. Frontend and Client-Side Security

- **Issues**:
  1. **Open Redirect via Navigation**: The Next.js login component parsed the `callbackUrl` URL parameter and redirected to it via `router.push()` without verification, creating an open redirect vulnerability (e.g. allowing navigation to `https://evil.com` or `//evil.com` post-login).
  2. **High Severity Vulnerability in Dev Dependency**: An audit highlighted a high-severity advisory in `esbuild` allowing arbitrary file read on Windows and missing binary verification in Deno module.
- **Fixes**:
  1. **Sanitize Redirect Parameters**: Updated `src/app/auth/login/page.tsx` to parse `callbackUrl`, `redirect`, and `returnTo` parameters, validating that the value starts with a single `/` and does not start with `//` (enforcing relative pathing).
  2. **Audit Fixes**: Executed `npm audit fix` which updated packages (including resolving the `esbuild` advisory) and successfully clean audited `npm audit --audit-level=high` to 0 vulnerabilities.
- **Verification**:
  1. **Playwright spec**: Created `tests/security/frontend-security.spec.js` asserting Open Redirect mitigations (for absolute and protocol-relative redirect URLs) and Clickjacking frame checks.
  2. **Retire.js**: Verified that static library code contains no known vulnerable files.





