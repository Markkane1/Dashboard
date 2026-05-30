# Technical Debt & Anti-Patterns

## 1. Dead Code
Due to recent architectural shifts away from Mongoose on the frontend, a significant portion of the frontend codebase is now dead or broken:
*   `frontend/src/infrastructure/repositories/*` (e.g., `MongoCourseRepository.ts`, `MongoUserRepository.ts`)
*   `frontend/src/core/use-cases/*` (e.g., `SubmitQuiz.ts`, `EnrollInCourse.ts`)
*   These files still reference missing `mongoose` modules or deleted Database Models, creating a massive footprint of unmaintainable dead code.

## 2. Duplicated Logic
*   **Domain Entities**: Business entities and types are duplicated between `frontend/src/core/domain/entities` and `backend/models`. Changes to a schema (like `Course` or `User`) require updating multiple definitions across two repositories.
*   **Authentication Validation**: `frontend/src/core/use-cases/VerifyAccessToken.ts` and `VerifyRefreshToken.ts` duplicate the JWT verification logic that is already (or should be) handled by Express middleware.

## 3. Scalability Bottlenecks
*   **CPU-Bound Tasks in Next.js**: The PDF generation logic (`PDFDocument.create()` in `GenerateCertificate.ts` and `GenerateDiploma.ts`) is highly CPU-intensive. Running this synchronously inside the Next.js server will block the Node.js event loop, severely degrading the frontend's ability to serve regular web traffic under high concurrency.
*   **Database Connection Pooling**: If the frontend repositories were reactivated, maintaining separate Mongoose connection pools in both Next.js and Express would quickly exhaust MongoDB connection limits during traffic spikes.

## 4. Anti-Patterns
*   **Database Access from Presentation**: Passing `ICourseRepository` into Next.js components or server actions breaks the multi-tier architecture.
*   **Incomplete Migration**: The transition to an API-driven frontend is half-finished, leaving legacy use-cases stranded without their underlying infrastructure.
