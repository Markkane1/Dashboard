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

