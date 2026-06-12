# Security Audit Report: JWT Usage and Vulnerability Analysis

This report documents the security audit findings for JSON Web Token (JWT) usage across the Express backend and Next.js frontend of the application.

---

## Executive Summary

A comprehensive audit of JWT generation, verification, storage, and transport was performed. A vulnerability in the Express authentication middleware was identified (Algorithm Confusion/Switching) and successfully mitigated. Integration tests were developed to verify the security posture of the protected routes against common JWT attacks.

---

## Detailed Findings

### 1. Algorithm Confusion (alg: none)
- **Status**: **PASS / SECURED**
- **Analysis**: The Express middleware was hardened to explicitly reject any token attempting to use the `alg: none` header.
- **Verification**: Tests using `supertest` sending crafted `alg: none` tokens to all major protected API routes returned `401 Unauthorized`.

### 2. Algorithm Switching
- **Status**: **PASS / SECURED**
- **Analysis**: The Express middleware previously verified tokens without specifying an algorithm whitelist. If an attacker sent a token claiming the `RS256` algorithm, but signed it using `HS256` with the public key as the secret, the library might mistakenly verify the signature under the wrong algorithm. This was resolved by whitelisting `['HS256']` in `jwt.verify()`.
- **Verification**: Tested by signing tokens using `RS256` (using a mock RSA private key) and submitting them to the protected API routes. The server properly returned `401 Unauthorized` for all attempts.

### 3. Invalid Signatures
- **Status**: **PASS / SECURED**
- **Analysis**: Tokens with modified signatures are correctly rejected.
- **Verification**: Tested by taking a valid token, changing the last 3 characters of its signature, and sending it to protected routes. All routes successfully responded with `401 Unauthorized`.

### 4. Expired Tokens
- **Status**: **PASS / SECURED**
- **Analysis**: The middleware correctly checks the `exp` claim and rejects expired tokens.
- **Verification**: Sent tokens with expiration times (`exp`) set in the past to all protected routes. All routes correctly returned `401 Unauthorized`.

### 5. Missing `exp` Claim Check
- **Status**: **PASS / SECURED**
- **Analysis**: Audited token generation code in `src/shared/auth/apiToken.ts` and `auth.ts`. All tokens generated for production API access include an expiration configuration (`expiresIn: "5m"` or `"1h"`).
- **Verification**: Validated in tests that signing utility functions produce tokens with valid numeric `exp` claims that are strictly in the future.

### 6. Token Storage Audit
- **Status**: **SECURE**
- **Finding**: A recursive search of the React/Next.js codebase for `localStorage` and `sessionStorage` was performed. **No tokens are stored in Web Storage (localStorage/sessionStorage).**
- **Context**: The frontend application relies on `NextAuth` for session management. Sessions are managed using encrypted HTTP-Only cookies (`next-auth.session-token`). This is a highly secure design as HTTP-Only cookies prevent client-side JavaScript from accessing session data, effectively eliminating the risk of token theft via Cross-Site Scripting (XSS).

### 7. Token in URL Audit
- **Status**: **LOW RISK / RECOMMENDED MITIGATION**
- **Finding**: Identified three endpoints that pass sensitive single-use tokens in URLs:
  - **Email Verification**: `/auth/verify-email?token=${verificationToken}`
  - **Email Change Confirmation**: `/auth/change-email/confirm?token=${token}`
  - **Password Reset**: `/auth/reset-password?token=${token}`
- **Security Implications**: Tokens passed via URL query parameters can leak to third parties through:
  1. Browser history.
  2. Server access logs.
  3. HTTP `Referer` headers if page resources or external links are loaded.
- **Current Safeguards**:
  - The backend Express API endpoints (e.g. `/api/users/verify-email`, `/api/users/password-reset/confirm`) require these tokens to be sent in the POST request body rather than query parameters, preventing API-level access log leakage.
  - Client-side log sanitization (`src/server/routes/client-logs.ts`) detects and redacts URL query keys like `token`, `code`, and `verificationToken` before writing logs.
- **Recommendations**:
  - Transition to short-lived, single-use, random codes (e.g. 6-digit PINs) that users copy and paste into a form instead of embedding raw token strings in the URL.
  - Set `Referrer-Policy: no-referrer` or `strict-origin-when-cross-origin` headers on all pages (currently handled by Express `helmet` configuration).

---

## NoSQL Injection & MongoDB Security Audit

A parallel audit of database interaction safety was performed to check susceptibility to MongoDB query injection attacks.

### 1. Operator Injection
- **Status**: **PASS / SECURED**
- **Analysis**: Incoming parameters were not sanitized, which could allow raw queries to accept operator keys (e.g., query objects like `{ "$gt": "" }`). This was resolved by placing `express-mongo-sanitize` globally at the entry point of Express routing.
- **Verification**: Tested sending operator payload mutations (`$gt`, `$ne`, `$in`, `$where`, `$regex`) via query parameters and JSON bodies to routes like `/api/courses` and `/api/courses/batch`. In all test cases, the server sanitized inputs safely and returned expected status codes (e.g., 200 or 400 validation failures) without throwing 500 errors or crashing.

### 2. Login Bypass
- **Status**: **PASS / SECURED**
- **Analysis**: Tested credentials authentication paths against logic bypasses (e.g., submitting `{ "$ne": "wrongpassword" }` as the password payload).
- **Verification**: Verified that Zod schemas coupled with `express-mongo-sanitize` enforce strict email and password string validations, rendering bypass attempts invalid and ensuring they return rejection status codes (400, 401, or 403).

### 3. Regex DoS (ReDoS)
- **Status**: **PASS / SECURED**
- **Analysis**: Evaluated routes executing regex matches on user inputs (e.g. course searches) to verify they do not lock the Node event loop when processing catastrophic backtracking queries.
- **Verification**: Sent strings of 10,000 repeated characters followed by a mismatch trigger (`!`) to regex-linked query endpoints. The server processed the request safely within ~40ms (well under the 2-second crash boundary) and returned a sanitized response.

### 4. ObjectId Validation
- **Status**: **PASS / SECURED**
- **Analysis**: Evaluated routes querying the database by identifier (e.g., `findById` or `findOne` with `_id` parameters) to ensure they reject malformed or type-mutated inputs.
- **Verification**: Tested endpoints expecting ObjectIDs by sending:
  1. Non-ObjectID strings (`not-an-id`).
  2. Oversized strings (1,000+ characters).
  3. URL-encoded object variables (representing `{ "$gt": "" }`).
  All endpoints successfully rejected the queries with 400 or 404 client errors instead of throwing unhandled 500 database execution exceptions.

