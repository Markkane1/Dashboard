# Security Findings

## 1. Business Logic / Grading Exposure
*   **Location**: `frontend/src/core/use-cases/SubmitQuiz.ts` (Lines 31-48)
*   **Vulnerability**: The quiz grading logic retrieves the entire quiz syllabus, including `correctOptionIndex`, into the Next.js server tier. If this logic ever leaks to the client, or if API boundaries blur (e.g., passing the raw quiz object to a Client Component), students will have full access to quiz answers.
*   **Remediation**: Quiz grading must occur strictly on the Express backend. The frontend should only submit `[selectedOptionIndices]` to an Express endpoint (`POST /api/quiz/submit`), and Express should return the final score without ever transmitting the correct answers over the network.

## 2. Insecure Static File Serving
*   **Location**: `backend/server.js` (Lines 15-25)
*   **Vulnerability**: The backend attempts to protect non-image files (like `.mp4` video streaming) by intercepting the `/uploads` static route and performing a regex/extension check (`path.extname`). This approach is brittle and susceptible to extension spoofing or directory traversal attacks. 
*   **Remediation**: Private static assets should be served via dedicated, authenticated API endpoints (like `/api/video/stream`) using secure read streams, and the `/uploads` directory should be entirely hidden from public static access.

## 3. Cryptographic Hashes in Frontend
*   **Location**: `frontend/src/core/use-cases/SubmitQuiz.ts` (Lines 85-90)
*   **Vulnerability**: Certificate IDs are generated using `crypto.createHash` inside the Next.js server. While not immediately exploitable, generating authoritative cryptographic proofs of completion outside the primary trusted backend (Express) weakens the audit trail.
*   **Remediation**: Certificate and Diploma hashes should be generated and cryptographically signed exclusively by the backend upon successful grading.
