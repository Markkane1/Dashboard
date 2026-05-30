# API Authentication Token Contract

NextAuth owns user sign-in and session creation. Express owns API authorization.

To bridge those layers, NextAuth issues a short-lived API access token on every JWT session callback. Express accepts only that API token format.

## Signing

- Algorithm: HS256 via `jsonwebtoken`
- Secret: `AUTH_SECRET`
- Issuer: `next-auth`
- Audience: `express-api`
- Expiry: 1 hour for user sessions, 5 minutes for the internal service token

## Required Payload

```json
{
  "sub": "user-id",
  "id": "user-id",
  "email": "user@example.com",
  "role": "student",
  "tokenUse": "api"
}
```

## Client Usage

Browser-to-Express calls must send:

```http
Authorization: Bearer <session.apiAccessToken>
```

Do not pass tokens in query strings or cookies.

## Server Usage

Next.js server code should use the API clients under `src/infrastructure` or `src/features/users/data/userDb.ts`.
It must not import Mongoose models or `src/server/*` internals directly.
