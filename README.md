# EPA Punjab E-Learning Platform

## Project Overview

This repository contains the EPA Punjab e-learning platform for official training delivery, learner progress tracking, quizzes, certificates, cohorts, audit logs, and compliance reporting.

The app has two runtime processes:

- Next.js web app for learner, instructor, and admin UI.
- Express API server for authentication-backed LMS APIs, MongoDB persistence, protected video streaming, reports, and operational workflows.

## Tech Stack

- Node.js with TypeScript
- Next.js `15.5.x`, React `19`, Tailwind CSS
- Express `4`, Mongoose `8`, MongoDB
- NextAuth v5 beta with JWT sessions
- Nodemailer, SendGrid, or Resend for transactional email
- Multer plus ffmpeg/ffprobe installers for video upload validation
- ExcelJS and pdf-lib for compliance exports

## Requirements

- Node.js `20.x` LTS recommended. Node `18.18+` should also work with the current Next.js version.
- npm `10+` recommended.
- MongoDB `6.x` or `7.x`.
- Windows, Linux, or macOS for local development.
- PM2, systemd, Docker, or another process supervisor for production.
- Nginx, Apache, IIS, or a managed reverse proxy in front of production.

## Environment Setup

Create `.env.local` from the example file:

```bash
cp .env.example .env.local
```

Do not commit `.env.local` or real credentials. The project reads the variables used in `.env.example`; names are intentionally matched to the codebase.

Important variables:

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string. |
| `AUTH_SECRET` | Primary JWT/NextAuth signing secret, minimum 32 characters. |
| `NEXTAUTH_SECRET` | Optional legacy alias; if set with `AUTH_SECRET`, both must match. |
| `NEXTAUTH_URL` | Public web origin, required in production for auth and CSRF origin checks. |
| `APP_URL` | Public web origin used in emails and document links. |
| `API_URL` | Server-side URL for the Express API. |
| `NEXT_PUBLIC_API_URL` | Browser-visible Express API base URL. |
| `CORS_ALLOWED_ORIGINS` | Comma-separated web origins allowed to call the Express API. |
| `OAUTH_ALLOWED_DOMAINS` | Comma-separated Google OAuth auto-approval domains, for example `punjab.gov.pk,epa.punjab.gov.pk`. |
| `EMAIL_PROVIDER` | `smtp`, `sendgrid`, `resend`, or `console`. |
| `EMAIL_FROM` | Sender displayed in transactional emails. |
| `LOCAL_VIDEO_DIR` | Local protected video storage directory. This is the app's upload directory variable. |
| `VIDEO_MAX_UPLOAD_SIZE_BYTES` | Maximum upload size in bytes. This is the app's max video upload variable. |

The project does not use `API_BASE_URL`, `VIDEO_UPLOAD_DIR`, or `MAX_VIDEO_UPLOAD_MB`; use `API_URL`, `NEXT_PUBLIC_API_URL`, `LOCAL_VIDEO_DIR`, and `VIDEO_MAX_UPLOAD_SIZE_BYTES`.

## Local Development

Install dependencies:

```bash
npm ci
```

Start MongoDB locally, or point `MONGODB_URI` in `.env.local` to an available MongoDB instance:

```ini
MONGODB_URI=mongodb://127.0.0.1:27017/elearning
```

Run both the Next.js app and Express API:

```bash
npm run dev
```

This starts:

- Web app: `http://localhost:3000`
- Express API: `http://localhost:5000`

You can also run them separately:

```bash
npm run dev:next
npm run dev:server
```

## Admin User And Seeding

Seed demo roles, categories, users, courses, and admin access:

```bash
npm run seed:demo
```

The demo seed creates:

- Email: `admin@example.com`
- Password: `AdminPassword123`

For production handover, change or disable this account immediately after first login. Do not use the demo password for a live EPA Punjab deployment.

Seed lesson content:

```bash
npm run seed:lessons
```

Remove seeded demo data if needed:

```bash
npm run seed:demo:remove
npm run seed:lessons:remove
```

## Email Provider Setup

Email is used for verification, account approval, and password reset flows.

For local development, use console email:

```ini
EMAIL_PROVIDER=console
```

For a government SMTP relay:

```ini
EMAIL_PROVIDER=smtp
EMAIL_FROM="EPA Punjab eLearning <no-reply@epa.punjab.gov.pk>"
SMTP_HOST=mail.punjab.gov.pk
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=relay-user@punjab.gov.pk
SMTP_PASS=replace-with-real-secret
```

For SendGrid or Resend:

```ini
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=replace-with-sendgrid-key
```

```ini
EMAIL_PROVIDER=resend
RESEND_API_KEY=replace-with-resend-key
```

## Video Storage Setup

The default storage driver is local disk:

```ini
VIDEO_STORAGE=local
LOCAL_VIDEO_DIR=uploads/videos
VIDEO_MAX_UPLOAD_SIZE_BYTES=524288000
```

Uploaded videos are protected by the API and should not be served directly as public static files. The upload route validates extension, MIME type, generated UUID filename, upload size, and ffprobe video metadata before accepting a file.

For production:

- Put `LOCAL_VIDEO_DIR` on durable storage with regular backups.
- Ensure the Node process has read/write access to the directory.
- Set reverse proxy upload limits at or above `VIDEO_MAX_UPLOAD_SIZE_BYTES`.
- Keep video access through the protected `/api/video/:lessonId` route.

## Tests And Quality Checks

Run the full test suite:

```bash
npm test
```

Run accessibility tests:

```bash
npm run test:a11y
```

Run lint:

```bash
npm run lint
```

Run high-severity dependency audit:

```bash
npm run audit:lock
```

Some tests use `mongodb-memory-server`. In restricted environments, configure a local MongoDB binary or use `TEST_MONGODB_URI`.

## Production Build

Build the Next.js app:

```bash
npm run build
```

Start the Next.js production server:

```bash
npm run start
```

Start the Express API:

```bash
npm run server
```

For PM2:

```bash
pm2 start npm --name epa-lms-web -- start
pm2 start npm --name epa-lms-api -- run server
```

## Deployment Notes

Recommended production layout:

- MongoDB runs on a protected internal host or managed database.
- Next.js listens on `127.0.0.1:3000`.
- Express listens on `127.0.0.1:5000`.
- Reverse proxy terminates HTTPS and routes `/api` to Express, all other traffic to Next.js.
- Production environment sets `NODE_ENV=production`, `NEXTAUTH_URL=https://your-domain`, `APP_URL=https://your-domain`, and matching API URLs.

Example Nginx sketch:

```nginx
server {
    listen 443 ssl;
    server_name elearning.epa.punjab.gov.pk;

    client_max_body_size 550M;

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

## Backup And Restore

Back up MongoDB daily:

```bash
mongodump --uri="$MONGODB_URI" --out=/var/backups/epa-lms/mongodb/$(date +%F)
```

Restore MongoDB:

```bash
mongorestore --uri="$MONGODB_URI" /var/backups/epa-lms/mongodb/YYYY-MM-DD
```

Back up uploaded protected videos:

```bash
tar -czf /var/backups/epa-lms/videos-$(date +%F).tar.gz -C /path/to/project/uploads/videos .
```

Restore uploaded videos:

```bash
mkdir -p /path/to/project/uploads/videos
tar -xzf /var/backups/epa-lms/videos-YYYY-MM-DD.tar.gz -C /path/to/project/uploads/videos
```

Verify after restore:

- Admin login works.
- Learner enrollment and progress records exist.
- Protected videos stream through the app.
- Certificate verification pages resolve expected records.

## Security Notes For EPA Punjab Deployment

- Use HTTPS only in production.
- Generate a unique `AUTH_SECRET` and keep `NEXTAUTH_SECRET` aligned if both are set.
- Set `NEXTAUTH_URL`, `APP_URL`, and `CORS_ALLOWED_ORIGINS` to the exact public HTTPS origin before production launch; mutating API requests from browser contexts are rejected unless their `Origin` or `Referer` matches this allow-list.
- Keep `API_RATE_LIMIT_*`, `AUTH_RATE_LIMIT_*`, and `CLIENT_LOG_RATE_LIMIT_*` enabled to protect authentication, signup, reset, verification, and browser log ingestion endpoints.
- Restrict Google OAuth with `OAUTH_ALLOWED_DOMAINS`.
- Keep public Gmail/consumer OAuth users pending unless explicitly approved.
- Never commit `.env.local`, database dumps, private keys, browser profiles, uploaded videos, or real API credentials.
- Do not log raw passwords, authorization headers, cookies, reset links, verification links, token hashes, or uploaded file metadata; the server logger redacts these fields and client log ingestion sanitizes user-supplied metadata.
- Rotate the demo admin password immediately after seeding.
- Protect MongoDB with authentication, network allow-listing, and regular tested backups.
- Use least-privilege roles for admins, instructors, and approvers.
- Keep audit logs enabled for course approvals, cohort changes, certificate actions, role changes, uploads, and report exports.
- Review `npm audit --audit-level=high` before production release and document any accepted risk.
