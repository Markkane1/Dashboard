# Priority Implementation Roadmap

This roadmap outlines the necessary steps to resolve the critical architectural, technical debt, and security findings identified in the audit.

## Phase 1: Aggressive Code Deletion (High Priority)
**Goal**: Remove all dead code and broken infrastructure from the frontend to stop the "Split-Brain" architecture.
*   Delete `frontend/src/infrastructure/repositories` entirely.
*   Delete all files in `frontend/src/core/use-cases` that rely on the deleted repositories (e.g., `SubmitQuiz.ts`, `EnrollInCourse.ts`).
*   Remove duplicated domain entities in `frontend/src/core/domain` if they can be replaced by shared Typescript interfaces matching the backend.

## Phase 2: Centralize Business Logic (High Priority)
**Goal**: Move heavy computation and security-sensitive operations to the Express backend.
*   **Quiz Grading Engine**: Create a `POST /api/progress/quiz/submit` endpoint in Express that accepts answers, grades them securely against the Mongoose models, and returns the score.
*   **PDF Generation Microservice**: Migrate `GenerateCertificate.ts` and `GenerateDiploma.ts` to the backend. Expose a `GET /api/certificates/:id/download` endpoint that streams the generated PDF back to the client, keeping the heavy `pdf-lib` processing off the Next.js UI thread.

## Phase 3: Secure Asset Management (Medium Priority)
**Goal**: Prevent unauthorized access to premium video and document assets.
*   Refactor `backend/server.js` to remove public static serving of the `/uploads` directory.
*   Ensure the existing `GET /api/video/:id` endpoint enforces strict JWT authentication checks before piping the file stream.

## Phase 4: Consolidate Types & API Clients (Low Priority)
**Goal**: Improve developer experience and type safety.
*   Create a shared `types` or `contracts` library between the frontend and backend to eliminate duplicate schema definitions.
*   Standardize the `frontend/src/lib/api` clients to automatically attach NextAuth JWT tokens using a centralized fetch wrapper.
