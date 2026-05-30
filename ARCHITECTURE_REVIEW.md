# Architecture Review

## 1. Overview
The current platform is a hybrid architecture utilizing Next.js (App Router) for the frontend and Express.js with MongoDB (MERN) for the backend. The frontend utilizes a localized "Clean Architecture" pattern, dividing its directory structure into `core/domain`, `core/use-cases`, and `infrastructure/`. 

## 2. Current Architecture Diagram
*   **Presentation Layer**: Next.js (React components, Server Components, NextAuth)
*   **Business Logic Layer**: Split between Next.js Server (`frontend/src/core/use-cases`) and Express (`backend/routes`)
*   **Data Access Layer**: Split between Express Mongoose Models and Next.js Repositories (`frontend/src/infrastructure/repositories`)

## 3. Violations of Separation of Concerns
The most glaring architectural flaw is the **"Fat Frontend"** or **"Split-Brain"** anti-pattern. Next.js is designed to be the presentation layer (and BFF), but it currently houses heavy core business logic that belongs in the Express backend:

*   **Quiz Grading**: The `SubmitQuiz.ts` use case retrieves quiz questions and grades them within the Next.js environment.
*   **PDF Generation**: The `GenerateCertificate.ts` and `GenerateDiploma.ts` use cases construct PDF buffers using `pdf-lib` within Next.js.
*   **Direct Database Access**: The `infrastructure/repositories` folder in the frontend attempts to connect directly to MongoDB via Mongoose, bypassing the Express backend entirely. (Note: The `mongoose` dependency was recently removed, rendering these files as dead code).

## 4. Recommendations
*   **Enforce Backend Authority**: The Express backend must be the sole owner of data access and heavy computational tasks (like PDF generation).
*   **Refactor Next.js to API Consumer**: The frontend's `core` and `infrastructure/repositories` should be completely deleted, replaced purely by HTTP clients (`lib/api`) that communicate with Express.
