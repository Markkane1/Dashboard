# Application Discovery Report

This document contains a comprehensive analysis of the Elearning Dashboard application codebase. It covers backend Express APIs, frontend React components and Next.js routes, Mongoose database models, authentication structures, external libraries, environment variables, and potential security or implementation risks.

---

### 1. API ROUTES

All routes are mounted under `/api` and globally apply rate limiting (`apiLimiter`) and request origin verification (`requireAllowedMutationOrigin` for mutating methods like `POST`, `PUT`, `PATCH`, `DELETE`).

#### **Analytics Routes** (`/api/analytics`)
*   **`GET /overview`**
    *   **Description**: Retrieves platform-wide learning statistics.
    *   **Authentication**: Required (via Bearer JWT).
    *   **Permissions**: `analytics:view`
    *   **Parameters / Body**: None.
    *   **Success Return**: HTTP 200 JSON:
        ```json
        {
          "users": 150,
          "courses": 12,
          "enrollments": 450,
          "completedEnrollments": 120,
          "completionRate": 27,
          "progressRecords": 3200,
          "quizSubmissions": 180,
          "averageQuizScore": 82,
          "quizPassRate": 74,
          "dailyActiveUsers": 15,
          "weeklyActiveUsers": 65,
          "averageLessonCompletionRate": 68,
          "averageLessonWatchRate": 74,
          "topCourses": [
            { "courseId": "...", "title": "...", "enrollments": 45, "completions": 12, "completionRate": 27 }
          ]
        }
        ```
    *   **Error Return**: HTTP 500 JSON: `{ "error": "Failed to fetch analytics overview" }`.
*   **`GET /courses/:courseId`**
    *   **Description**: Retrieves course-specific learning analytics.
    *   **Authentication**: Required.
    *   **Permissions**: `analytics:view`
    *   **Parameters**: `courseId` (path parameter, valid ObjectId).
    *   **Success Return**: HTTP 200 JSON:
        ```json
        {
          "courseId": "...",
          "title": "...",
          "enrollments": 45,
          "completions": 12,
          "completionRate": 27,
          "dropOffRate": 73,
          "activeLearners": 38,
          "weeklyActiveLearners": 10,
          "quizAttempts": 180,
          "averageQuizScore": 82,
          "quizPassRate": 74,
          "averageLessonCompletionRate": 68,
          "averageLessonWatchRate": 74
        }
        ```
    *   **Error Return**: HTTP 400 JSON: `{ "error": "Invalid course id." }`, HTTP 404 JSON: `{ "error": "Course not found" }`, or HTTP 500 JSON: `{ "error": "Failed to fetch course analytics" }`.

#### **Assignments Routes** (`/api/assignments`)
*   **`GET /course/:courseId`**
    *   **Description**: Returns a course's assignment list. If reviewed by a trainer/instructor, it returns all assignments. If requested by a student, it returns only published assignments alongside their own submission states.
    *   **Authentication**: Required.
    *   **Permissions**: Course reviewer access OR enrolled student access.
    *   **Parameters**: `courseId` (path).
    *   **Success Return**: HTTP 200 JSON: List of assignments (with optional `mySubmission` object if student).
    *   **Error Return**: HTTP 400 JSON: `{ "error": "Invalid course id." }`, HTTP 403 JSON: `{ "error": "Access denied." }`, HTTP 500 JSON.
*   **`POST /`**
    *   **Description**: Creates a new assignment.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Body**: `{ courseId, moduleId?, lessonId?, title, instructions?, resourceIds?, dueAt?, status? }`
    *   **Success Return**: HTTP 201 JSON: Serialized assignment object.
    *   **Error Return**: HTTP 400 JSON (validation), HTTP 404 JSON: `{ "error": "Course not found." }`, HTTP 500 JSON.
*   **`POST /:id/submissions`**
    *   **Description**: Submits evidence (text, link, or file) for an assignment. Uses Multer disk storage.
    *   **Authentication**: Required.
    *   **Permissions**: Student enrolled in the course.
    *   **Parameters**: `id` (assignment path parameter).
    *   **Body / Files**: Form-data with text, linkUrl, and an optional file field name `file`. (PDF, JPEG, PNG, TXT, DOC, DOCX supported up to 25MB).
    *   **Success Return**: HTTP 201 JSON: Graded/ungraded submission details.
    *   **Error Return**: HTTP 400 JSON (missing all evidence types), HTTP 403 JSON: `{ "error": "Course enrollment is required." }`, HTTP 500 JSON.
*   **`GET /:id/submissions`**
    *   **Description**: Lists all submissions for an assignment.
    *   **Authentication**: Required.
    *   **Permissions**: Course reviewer (instructor / content manager).
    *   **Parameters**: `id` (assignment path parameter).
    *   **Success Return**: HTTP 200 JSON: Array of student submissions populated with learner names and emails.
    *   **Error Return**: HTTP 403 JSON: `{ "error": "Assignment reviewer access is required." }`, HTTP 500 JSON.
*   **`GET /submissions/:submissionId/file`**
    *   **Description**: Downloads an assignment submission's uploaded evidence file.
    *   **Authentication**: Required.
    *   **Permissions**: Submission owner OR course reviewer.
    *   **Parameters**: `submissionId` (path).
    *   **Success Return**: Binary file stream with headers (`Content-Disposition`).
    *   **Error Return**: HTTP 403 JSON: `{ "error": "Access denied." }`, HTTP 404 JSON (file not found), HTTP 500 JSON.
*   **`PATCH /submissions/:submissionId/review`**
    *   **Description**: Instructors approve, request revision, or reject a student submission.
    *   **Authentication**: Required.
    *   **Permissions**: Course reviewer.
    *   **Parameters**: `submissionId` (path).
    *   **Body**: `{ status: 'approved' | 'needs_revision' | 'rejected', comments: string }`
    *   **Success Return**: HTTP 200 JSON: Serialized reviewed submission.
    *   **Error Return**: HTTP 400 JSON, HTTP 403 JSON: `{ "error": "Assignment reviewer access is required." }`, HTTP 500 JSON.
*   **`PATCH /:id`**
    *   **Description**: Updates assignment parameters.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Body**: `{ moduleId?, lessonId?, title?, instructions?, resourceIds?, dueAt?, status? }`
    *   **Success Return**: HTTP 200 JSON: Updated assignment.
    *   **Error Return**: HTTP 404 JSON, HTTP 500 JSON.
*   **`DELETE /:id`**
    *   **Description**: Deletes assignment and associated submissions.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 204 (No Content).
    *   **Error Return**: HTTP 404 JSON, HTTP 500 JSON.

#### **Audit Logs Routes** (`/api/audit-logs`)
*   **`GET /`**
    *   **Description**: Returns paginated, filtered audit logs.
    *   **Authentication**: Required.
    *   **Permissions**: `audit-logs:view`
    *   **Query Params**: `actorId`, `action`, `entityType`, `entityId`, `from`, `to`, `limit` (max 500, default 100).
    *   **Success Return**: HTTP 200 JSON: Array of audit logs.
    *   **Error Return**: HTTP 500 JSON: `{ "error": "Failed to list audit logs." }`.

#### **Certificate Governance Routes** (`/api/certificates`)
*   **`GET /approvals`**
    *   **Description**: Lists certificate approval queue.
    *   **Authentication**: Required.
    *   **Permissions**: `certificates:approve`
    *   **Query Params**: `status` ('pending' default, 'approved', 'rejected').
    *   **Success Return**: HTTP 200 JSON: Array of certificate issuances.
    *   **Error Return**: HTTP 500 JSON.
*   **`GET /revocations`**
    *   **Description**: Lists revoked certificates.
    *   **Authentication**: Required.
    *   **Permissions**: `certificates:revoke`
    *   **Success Return**: HTTP 200 JSON: Array of revoked certificates.
    *   **Error Return**: HTTP 500 JSON.
*   **`POST/:courseId/approval`**
    *   **Description**: Approves or rejects certificate generation for a learner.
    *   **Authentication**: Required.
    *   **Permissions**: `certificates:approve`
    *   **Body**: `{ userId, status: 'approved' | 'rejected', comments?: string }`
    *   **Success Return**: HTTP 200 JSON: `{ issuance, approval }`.
    *   **Error Return**: HTTP 400 JSON, HTTP 404 JSON, HTTP 500 JSON.
*   **`POST /:certificateId/revoke`**
    *   **Description**: Revokes a certificate.
    *   **Authentication**: Required.
    *   **Permissions**: `certificates:revoke`
    *   **Body**: `{ reason: string }` (required).
    *   **Success Return**: HTTP 200 JSON: Updated certificate issuance.
    *   **Error Return**: HTTP 400 JSON, HTTP 404 JSON, HTTP 500 JSON.

#### **Docs & Certificates Retrieval Routes** (`/api/docs` and `/api/certificates`)
*   **`GET /verify/:certificateId`** (Mounted on `/api/docs/verify/:certificateId` and `/api/certificates/verify/:certificateId`)
    *   **Description**: Verifies authenticity of a certificate. (Public, unauthenticated, called via verification QR codes).
    *   **Authentication**: None.
    *   **Success Return**: HTTP 200 JSON:
        ```json
        {
          "valid": true,
          "certificateId": "...",
          "serialNumber": "...",
          "verificationCode": "...",
          "recipientName": "...",
          "courseTitle": "...",
          "issuedAt": "ISOString",
          "revokedAt": null,
          "status": "valid"
        }
        ```
    *   **Error Return**: HTTP 404 / 500 JSON with `"valid": false`, `"status": "not_found"`.
*   **`GET /:courseId/download`** (and `/certificates/:courseId/download`)
    *   **Description**: Generates and downloads the completion certificate PDF for a course.
    *   **Authentication**: Required.
    *   **Success Return**: PDF Binary stream (`attachment`).
    *   **Error Return**: HTTP 403 JSON: `{ "error": "Certificate has been revoked." }` or `{ "error": "Certificate is pending approval." }` or `{ "error": "Certificate is only available for completed courses." }`. HTTP 404, HTTP 500.
*   **`GET /diploma`**
    *   **Description**: Validates compliance and downloads the pathway diploma PDF.
    *   **Authentication**: Required.
    *   **Query Params**: `diplomaId` (required).
    *   **Success Return**: PDF Binary stream.
    *   **Error Return**: HTTP 400 JSON, HTTP 403 JSON: `{ "error": "Complete all required courses before downloading this diploma.", ... }`.

#### **Cohorts Routes** (`/api/cohorts`)
*   **`GET /`**
    *   **Description**: Lists all training cohorts.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Success Return**: HTTP 200 JSON: Array of cohorts.
*   **`POST /`**
    *   **Description**: Creates a new cohort.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Body**: `{ title, description?, courseIds: [], trainerIds: [], startsAt?, endsAt?, seatLimit?, status? }`
    *   **Success Return**: HTTP 201 JSON: Cohort.
*   **`PATCH /:id`**
    *   **Description**: Updates a cohort.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Success Return**: HTTP 200 JSON: Updated cohort.
*   **`GET /:id/members`**
    *   **Description**: Lists cohort member records.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Success Return**: HTTP 200 JSON: Cohort memberships populated with users.
*   **`POST /:id/members`**
    *   **Description**: Manual student registration to a cohort.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Body**: `{ userIds: [] }` or `{ userId: string }`
    *   **Success Return**: HTTP 201 JSON: Created membership records.
*   **`POST /:id/members/import/preview`**
    *   **Description**: Uploads and validates a CSV/XLSX learner roster before import.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Files**: Form-data with single file field `file`.
    *   **Success Return**: HTTP 200 JSON: Roster preview statistics detailing valid rows and validation errors (Blocked status for duplicates, invalid emails, missing users, non-learners, seat limits exceeded).
*   **`POST /:id/members/import/confirm`**
    *   **Description**: Bulk-inserts roster rows.
    *   **Authentication**: Required.
    *   **Permissions**: `cohorts:manage`
    *   **Body**: `{ rows: [{ email, userId }], userIds?: [] }`
    *   **Success Return**: HTTP 201 JSON: `{ importedCount, memberships }`.

#### **Courses Routes** (`/api/courses`)
*   **`GET /`**
    *   **Description**: Returns paginated public course catalog.
    *   **Authentication**: None.
    *   **Query Params**: `limit`, `page`, `cursor`, `category`, `sdg`, `topic`, `isDiploma`, `isExternal`, `section`, `mea`, `q` (Text search).
    *   **Success Return**: HTTP 200 JSON: Array of serialized courses. Sets headers `X-Total-Count`, `X-Page-Limit`, `X-Next-Cursor`.
*   **`POST /batch`**
    *   **Description**: Returns a subset of course cards matching IDs.
    *   **Authentication**: None.
    *   **Body**: `{ ids: string[] }`
    *   **Success Return**: HTTP 200 JSON: Serialized courses.
*   **`GET /manage`**
    *   **Description**: Lists course detail authoring records (includes full quiz questions keys).
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Query Params**: `limit`
    *   **Success Return**: HTTP 200 JSON: Manageable courses.
*   **`GET /manage/:id`**
    *   **Description**: Gets single manageable course.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a draft course.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Body**: Course creation payload.
    *   **Success Return**: HTTP 201 JSON.
*   **`GET /approvals`**
    *   **Description**: Lists pending course approval requests.
    *   **Authentication**: Required.
    *   **Permissions**: `courses:approve`
    *   **Query Params**: `status`
    *   **Success Return**: HTTP 200 JSON.
*   **`GET /:id`**
    *   **Description**: Public details of a single published course.
    *   **Authentication**: None.
    *   **Success Return**: HTTP 200 JSON.
*   **`PATCH /:id`**
    *   **Description**: Updates course details. If the course is NOT in `draft` status, this operation requires `courses:approve` permission (instructors are restricted to editing draft courses only).
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /:id/approval`**
    *   **Description**: Triggers approval workflow transitions.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage` (for action: `submit`); `courses:approve` (for actions: `approve`, `reject`, `publish`, `archive`).
    *   **Body**: `{ action: 'submit'|'approve'|'reject'|'publish'|'archive', comments?: string }`
    *   **Success Return**: HTTP 200 JSON: Updated course.
*   **`DELETE /:id`**
    *   **Description**: Deletes a course. Triggers model hooks to delete related lessons, progress logs, quiz submissions, certificate records, and enrollments.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 204.

#### **Feedback Routes** (`/api/feedback`)
*   **`GET /course/:courseId`**
    *   **Description**: Returns user's feedback.
    *   **Authentication**: Required.
    *   **Success Return**: HTTP 200 JSON: CourseFeedback document or `null`.
*   **`POST /course/:courseId`**
    *   **Description**: Submits/updates course feedback.
    *   **Authentication**: Required.
    *   **Body**: `{ rating: number (1-5), comments: string, answers: [] }`
    *   **Success Return**: HTTP 201 JSON: Feedback object.

#### **Lessons Routes** (`/api/lessons`)
*   **`GET /course/:courseId`**
    *   **Description**: Student lessons list. Excludes video transcript strings to reduce load. Includes matching progress records.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment check.
    *   **Success Return**: HTTP 200 JSON: Array of lessons.
*   **`GET /manage/course/:courseId`**
    *   **Description**: Instructor list of course lessons.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a lesson.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Body**: Lesson creation payload.
    *   **Success Return**: HTTP 201 JSON.
*   **`POST /:lessonId/upload`**
    *   **Description**: Receives MP4 files, runs ffprobe deep checks for stream validation/duration calculations, deletes old videos, uploads to the selected storage provider.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Files**: form-data file named `video`.
    *   **Success Return**: HTTP 200 JSON.
*   **`PATCH /:lessonId`**
    *   **Description**: Updates lesson metadata.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`DELETE /:lessonId`**
    *   **Description**: Deletes lesson, unlinks video from file systems, removes student progress records, and decrements lessonsCount on Course.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 204.
*   **`GET /:lessonId`**
    *   **Description**: Gets full lesson details (includes heavy transcript strings) and the current user's progress log.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment check.
    *   **Success Return**: HTTP 200 JSON.

#### **Modules Routes** (`/api/modules`)
*   **`GET /course/:courseId`**
    *   **Description**: Lists manageable modules in a course.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a module.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Body**: `{ courseId, title, description?, order?, isPublished? }`
    *   **Success Return**: HTTP 201 JSON.
*   **`PATCH /:id`**
    *   **Description**: Updates module values.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`DELETE /:id`**
    *   **Description**: Deletes a module. Unsets the `moduleId` field for all lessons that belong to this module.
    *   **Authentication**: Required.
    *   **Permissions**: `content:manage`
    *   **Success Return**: HTTP 204.

#### **Notifications Routes** (`/api/notifications`)
*   **`GET /`**
    *   **Description**: Retrieves notifications for current user.
    *   **Authentication**: Required.
    *   **Query Params**: `limit` (max 50, default 20), `unread` (bool).
    *   **Success Return**: HTTP 200 JSON: Set header `X-Unread-Count`. Returns notifications array.
*   **`POST /announce`**
    *   **Description**: Platform broadcast notification.
    *   **Authentication**: Required.
    *   **Permissions**: `notifications:announce`
    *   **Body**: `{ title, message, linkUrl? }`
    *   **Success Return**: HTTP 201 JSON: `{ createdCount }`.
*   **`PATCH /:id/read`**
    *   **Description**: Marks a notification as read.
    *   **Authentication**: Required.
    *   **Success Return**: HTTP 200 JSON: Updated notification.

#### **Progress Routes** (`/api/progress`)
*   **`POST /`**
    *   **Description**: Updates video playback watchedSeconds. If `watchedSeconds >= duration * 0.9`, it automatically sets the lesson as completed.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment check.
    *   **Body**: `{ lessonId, watchedSeconds }`
    *   **Success Return**: HTTP 200 JSON: Progress log object.
*   **`GET /course/:courseId`**
    *   **Description**: Fetch progress summary.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment check.
    *   **Success Return**: HTTP 200 JSON: `{ progress: Progress[], summary: { totalLessons, completedLessons, percentComplete } }`.

#### **Quiz Routes** (`/api/quiz`)
*   **`GET /:courseId`**
    *   **Description**: Generates final quiz attempt. Randomizes questions according to course configuration. Removes answers indexes in return.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment and verification that all lessons have been completed.
    *   **Success Return**: HTTP 200 JSON: Quiz questions (without answer keys) and attempt constraints details.
*   **`POST /:courseId/submit`**
    *   **Description**: Grades quiz answers. If score >= passing score, completes enrollment, generates certificate serial and verification details.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment, all lessons completed, attempts remaining > 0.
    *   **Body**: `{ answers: [{ questionId, selectedOptionIndex }] }`
    *   **Success Return**: HTTP 200 JSON: `{ score, passingScore, passed, correctCount, attemptNumber, attemptsRemaining }`.

#### **Reports Ingestion & Export Routes** (`/api/reports`)
*   **`GET /:type/preview`**
    *   **Description**: Fetches row count and sample rows.
    *   **Authentication**: Required.
    *   **Permissions**: `reports:export`
    *   **Parameters**: `type` (`cohort-roster`, `completion`, `quiz-results`, `certificates`, `assignment-submissions`, `audit-logs`, `courses`, `users`).
    *   **Success Return**: HTTP 200 JSON: `{ type, rowCount, sample: [] }`.
*   **`GET /:type/export`**
    *   **Description**: Downloads compliance spreadsheets or PDF.
    *   **Authentication**: Required.
    *   **Permissions**: `reports:export`
    *   **Query Params**: `format` ('csv', 'xlsx', 'pdf'), plus filters (`from`, `to`, `courseId`, `cohortId`, `status`, `approvalStatus`, `revoked`).
    *   **Success Return**: File stream.

#### **Roles Routes** (`/api/roles`)
*   **`GET /permissions`**
    *   **Description**: Lists entire catalog of permission scope descriptors.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`GET /`**
    *   **Description**: Lists system roles.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a new custom role.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage`
    *   **Body**: `{ key?, name, description?, permissions: [], active? }`
    *   **Success Return**: HTTP 201 JSON.
*   **`PATCH /:id`**
    *   **Description**: Modifies a role.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`DELETE /:id`**
    *   **Description**: Deletes a custom role, pulling its key from the `roles` array of all users.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage`
    *   **Success Return**: HTTP 204.

#### **Taxonomies Routes** (`/api/taxonomies`)
*   **`GET /`**
    *   **Description**: Fetch active taxonomies.
    *   **Authentication**: None.
    *   **Query Params**: `type` ('category', 'sdg', 'section', 'topic').
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a taxonomy item.
    *   **Authentication**: Required.
    *   **Permissions**: `taxonomies:manage`
    *   **Body**: `{ type, key, label, description?, order?, active?, metadata? }`
    *   **Success Return**: HTTP 201 JSON.
*   **`PATCH /:id`**
    *   **Description**: Updates a taxonomy item.
    *   **Authentication**: Required.
    *   **Permissions**: `taxonomies:manage`
    *   **Success Return**: HTTP 200 JSON.
*   **`DELETE /:id`**
    *   **Description**: Deletes a taxonomy item.
    *   **Authentication**: Required.
    *   **Permissions**: `taxonomies:manage`
    *   **Success Return**: HTTP 204.

#### **Users Routes** (`/api/users`)
*   **`GET /email/health`**
    *   **Description**: Performs health checks on the active email provider.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage` (Admin only).
    *   **Success Return**: HTTP 200 JSON: `{ status: 'healthy', provider: 'resend'|'sendgrid'|'smtp'|'console' }`.
*   **`GET /email/:email`**
    *   **Description**: Finds a user by email.
    *   **Authentication**: Required.
    *   **Permissions**: Self-request OR `users:read`/`users:manage`.
    *   **Success Return**: HTTP 200 JSON.
*   **`GET /me`**
    *   **Description**: Returns current authenticated user's enrollments.
    *   **Authentication**: Required.
    *   **Success Return**: HTTP 200 JSON: `{ enrolledCourses: string[] }`.
*   **`GET /`**
    *   **Description**: Admin users catalog listing.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage` (Admin only).
    *   **Query Params**: `page`, `limit` (max 100), `q` (name/email regex).
    *   **Success Return**: HTTP 200 JSON. Set headers `X-Total-Count`, `X-Page-Limit`.
*   **`POST /authenticate`**
    *   **Description**: Validates login credentials. Handles account lockouts (locks account for 15 mins after 5 failed attempts). Checks if email is verified. Writes login success/failure audit logs.
    *   **Authentication**: None.
    *   **Body**: `{ email, password }`
    *   **Success Return**: HTTP 200 JSON: Serialized user details.
*   **`POST /verify-email`**
    *   **Description**: Verifies registered user's email using a verification token hash.
    *   **Authentication**: None.
    *   **Body**: `{ token }`
    *   **Success Return**: HTTP 200 JSON: `{ success: true }`.
*   **`POST /password-reset/request`**
    *   **Description**: Records a password reset token hash in the DB.
    *   **Authentication**: Required.
    *   **Permissions**: `password-resets:manage`
    *   **Body**: `{ email, tokenHash, expiresAt }`
    *   **Success Return**: HTTP 200 JSON: `{ success: true }`.
*   **`POST /password-reset/confirm`**
    *   **Description**: Completes token-based password reset.
    *   **Authentication**: None.
    *   **Body**: `{ token, password }`
    *   **Success Return**: HTTP 200 JSON: `{ success: true }`.
*   **`POST /enroll`**
    *   **Description**: Enrolls current user in a course (verifies publish status and prerequisite course completion).
    *   **Authentication**: Required.
    *   **Body**: `{ courseId }`
    *   **Success Return**: HTTP 200 JSON: Updated user.
*   **`POST /unenroll`**
    *   **Description**: Unenrolls current user, decrements course enrollment count.
    *   **Authentication**: Required.
    *   **Body**: `{ courseId }`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /complete`**
    *   **Description**: Force-completes a course.
    *   **Authentication**: Required.
    *   **Permissions**: Admin, Instructor, or Internal Service.
    *   **Body**: `{ courseId, userId? }`
    *   **Success Return**: HTTP 200 JSON.
*   **`GET /:id`**
    *   **Description**: Finds a user by ID.
    *   **Authentication**: Required.
    *   **Permissions**: Self OR `users:read`/`users:manage`.
    *   **Success Return**: HTTP 200 JSON.
*   **`PATCH /:id/role`**
    *   **Description**: Admin action to adjust user roles and custom permission overrides.
    *   **Authentication**: Required.
    *   **Permissions**: `users:manage` (Admin only).
    *   **Body**: `{ roles: [], role?: string, permissions?: [] }`
    *   **Success Return**: HTTP 200 JSON.
*   **`PUT /:id`**
    *   **Description**: Updates current user's profile details.
    *   **Authentication**: Required.
    *   **Permissions**: Self OR `users:manage` (to modify status field).
    *   **Body**: `{ name?, avatar?, status? }`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /`**
    *   **Description**: Creates a new user record.
    *   **Authentication**: Required.
    *   **Permissions**: `internal-service` OR `users:manage`.
    *   **Body**: `{ name, email, password, avatar, emailVerified, status }`
    *   **Success Return**: HTTP 201 JSON.
*   **`POST /resend-verification`**
    *   **Description**: Re-issues email verification token. Rate-limited to max 3 requests per email per hour.
    *   **Authentication**: None.
    *   **Body**: `{ email }`
    *   **Success Return**: HTTP 200 JSON: `{ success: true }`. (Returns success even if user not found to prevent email enumeration).
*   **`POST /email-change/request`**
    *   **Description**: Requests user email change. Sends verification link to `newEmail`.
    *   **Authentication**: Required.
    *   **Body**: `{ newEmail }`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /email-change/confirm`**
    *   **Description**: Swaps email with pending email using confirmation token.
    *   **Authentication**: None.
    *   **Body**: `{ token }`
    *   **Success Return**: HTTP 200 JSON.
*   **`POST /admin-password-reset`**
    *   **Description**: Admin requests a password reset email for a user.
    *   **Authentication**: Required.
    *   **Permissions**: `password-resets:manage`
    *   **Body**: `{ userId?, email? }`
    *   **Success Return**: HTTP 200 JSON.

#### **Video Playback Streaming Routes** (`/api/video`)
*   **`GET /:lessonId`**
    *   **Description**: Streams a video file using HTTP byte-range request streaming or redirects to external sources.
    *   **Authentication**: Required.
    *   **Permissions**: Course enrollment check.
    *   **Success Return**: HTTP 206 (Partial Content) / HTTP 200 stream, or HTTP 302 redirect. Manages concurrency slots (`MAX_CONCURRENT_VIDEO_STREAMS`, default 25).
    *   **Error Return**: HTTP 403 JSON, HTTP 404 JSON, HTTP 416 (Range Not Satisfiable), HTTP 500.

---

### 2. REACT PAGES & COMPONENTS

The frontend is built using Next.js App Router. Next.js API routes act as proxy callers forwarding token payloads to the Express backend.

#### **Pages**
*   **Landing Page** (`src/app/page.tsx` renders `HomeClient`)
    *   **Renders**: Public landing page layout. Displays active courses from catalog.
    *   **API Calls**: `fetchCoursePage()`, `fetchTaxonomies("category")`, `fetchTaxonomies("topic")`, `fetchTaxonomies("section")`, `fetchTaxonomies("sdg")` on the server.
    *   **User Interactions**: Navigating categories, searching text query, filtering by SDG, Topic, and Conventions (CBD, UNFCCC, BRS).
    *   **Conditional Rendering**: Fallback loader when list fetches, displays warning banners or empty grids when no matching courses are found.
*   **Course Details Page** (`src/app/courses/[id]/page.tsx`)
    *   **Renders**: Detailed overview of single course: category labels, SDG lists, syllabus access, and related courses.
    *   **API Calls**: `fetchCourseById(id)`, `findUserByEmail(email)` (to verify enrollment), `fetchCoursePage()` (for related courses list) on the server.
    *   **User Interactions**: Clicking `EnrollButton` (triggers Server Action `enrollInCourse(id)`), downloading syllabus, clicking related courses.
    *   **Conditional Rendering**: Error banner if redirected back with `error=not-enrolled`. Shows `Unenroll` state or lesson links if learner is enrolled. Displays empty related course banner if none exist in category.
*   **Lesson Viewer** (`src/app/courses/[id]/learn/page.tsx` renders `CoursePlayer`)
    *   **Renders**: Sidebar listing lessons grouped by modules, video streaming box, and download resource links / assignments drawer.
    *   **API Calls**: `fetchCourseLessons(courseId, token)`, `fetchCourseAssignments(courseId, token)` on the server. Playback changes send HTTP POST `/api/progress` logs.
    *   **User Interactions**: Selecting a lesson from sidebar, playing/seeking video, clicking attachments, submitting assignment solutions, or triggering final quiz.
    *   **Conditional Rendering**: Renders loading spinners during buffer switches. Redirects back to course details if not enrolled. Active lesson defaults to active search param, first incomplete lesson, or first list index.
*   **Quiz Page** (`src/app/courses/[id]/quiz/page.tsx` renders `QuizForm`)
    *   **Renders**: Exam layout. Displays prompts, options list, and warning boxes.
    *   **API Calls**: `fetchCourseById(courseId)`, `fetchCourseQuizFromUiApi(courseId)`. Form submission calls `/api/quiz/:courseId/submit`.
    *   **User Interactions**: Answering questions, submitting exam answers.
    *   **Conditional Rendering**: If requirements are unmet (lessons uncompleted / maximum attempts exceeded), renders warning banners.
*   **Learner Dashboard** (`src/app/dashboard/page.tsx`)
    *   **Renders**: Enrolled student interface: stats counters (active, completed, average progress percentage) and tabbed navigation.
    *   **API Calls**: `findUserByEmail()`, `fetchCoursesByIds()`, `fetchCourseProgressSummary()` on the server.
    *   **User Interactions**: Switching tabs, clicking `UnenrollButton`, clicking `DownloadCertificateButton` (calls `/api/docs/:courseId/download`).
    *   **Conditional Rendering**: Show empty state screens if unenrolled. Shows certificate buttons only on completed tracks. Exposes "View Diploma" panel.
*   **Diploma Pathways Page** (`src/app/diploma/page.tsx`)
    *   **Renders**: Lists diploma tracks, completion progress, required courses checklists, and download options.
    *   **API Calls**: `findUserByEmail()`, `fetchCoursePage({ isDiploma: true })`, `fetchCoursesByIds(requiredIds)`.
    *   **User Interactions**: Clicking required courses, clicking `Download Diploma` button.
    *   **Conditional Rendering**: Shows `Download Diploma` button only if all required courses are completed; otherwise displays `Continue pathway`.
*   **Notifications Page** (`src/app/notifications/page.tsx`)
    *   **Renders**: List of notifications.
    *   **API Calls**: `fetchNotifications()` on the server.
    *   **User Interactions**: Clicking notification links.
    *   **Conditional Rendering**: Renders "New" badge on unread notifications.
*   **Admin Dashboard** (`src/app/admin/page.tsx` renders `AdminPanel`)
    *   **Renders**: Administrative dashboard with tabbed tabs (Overview, Operations, Users, Roles, Categories, Cohorts, Reports, Audit, Messages).
    *   **API Calls**: Serves as dashboard proxy: fetches users, overview, roles, catalog, and manageable courses on the server. Triggers client mutations (`updateUserAccess`, `saveRole`, `deleteRole`, `announce`, `createCohort`, `previewRosterImport`, `confirmRosterImport`, `reviewCourse`, `reviewCertificate`).
    *   **User Interactions**: Managing users, toggling permissions, CRUD custom roles, bulk-uploading rosters, downloading CSV/XLSX/PDF compliance exports.
    *   **Conditional Rendering**: Enforces admin authentication (server-side redirects to `/dashboard` if user doesn't have `PERMISSIONS.MANAGE_USERS` permission). Tabs switch content panels.

#### **Key Components**
*   **`ContentManagerPanel.tsx`**
    *   **Renders**: Multi-tab interface for editing course items.
    *   **API Calls**: Fetches course authoring data in parallel. Updates courses, modules, lessons, resources, and assignments. Calls direct file upload endpoints.
    *   **User Interactions**: Selecting course, editing details form, managing modules order, creating lessons, uploading video files, linking resources, managing assignments, editing quiz questions via `<QuizAuthoringEditor>`, and triggering course publishing workflows.
*   **`QuizAuthoringEditor.tsx`**
    *   **Renders**: Interactive quiz builder inside the Content Manager Panel.
    *   **User Interactions**: Adding, removing, or reordering questions. Editing option texts and selecting the correct answer index.
*   **`TaxonomyManager.tsx`**
    *   **Renders**: Admin categorization interface.
    *   **User Interactions**: Creating, updating, or deleting active category, topic, convention, or SDG entries.
*   **`HomeClient.tsx`**
    *   **Renders**: Public-facing catalog layout, filtering components, search fields, and course cards.
*   **`CoursePlayer.tsx`**
    *   **Renders**: Student learning page layout: video element, lesson tracker, and download resources list.
*   **`QuizForm.tsx`**
    *   **Renders**: Student exam interface, grading response panels, and downloadable certificate links.

---

### 3. MONGOOSE MODELS

#### **User** (`User.ts`)
*   **Fields**:
    *   `name`: String, required, trim
    *   `email`: String, required, unique, trim, lowercase
    *   `password`: String, required
    *   `role`: String, enum of all permission roles, default `"student"`
    *   `roles`: `[String]`, default `["student"]` (Has set modifier to sanitize values)
    *   `permissions`: `[String]`, default `[]`
    *   `avatar`: String, default `""`
    *   `emailVerified`: Boolean, default `false`
    *   `status`: String, enum `['active', 'pending', 'disabled']`, default `'active'`, index
    *   `emailVerificationTokenHash`: String
    *   `emailVerificationExpires`: Date
    *   `passwordResetTokenHash`: String
    *   `passwordResetExpires`: Date
    *   `failedLoginAttempts`: Number, default `0`
    *   `lockUntil`: Date
    *   `pendingEmail`: String, trim, lowercase
    *   `pendingEmailTokenHash`: String
    *   `pendingEmailExpires`: Date
    *   `demoKey`: String, index
*   **Indexes**: `status: 1`, `email: 1` (unique), `demoKey: 1`
*   **Middleware/Validators**: Timestamps enabled. Custom `set` hook on `roles` array.

#### **Role** (`Role.ts`)
*   **Fields**:
    *   `key`: String, required, unique, trim, lowercase
    *   `name`: String, required, trim
    *   `description`: String, default `""`, trim
    *   `permissions`: `[String]`, enum of all permissions catalog, default `[]`
    *   `system`: Boolean, default `false`
    *   `active`: Boolean, default `true`
*   **Indexes**: `key: 1` (unique)
*   **Statics / Hooks**: Exports `ensureDefaultRoles()` to seed `student`, `instructor`, `admin`, and `service` roles.

#### **Course** (`Course.ts`)
*   **Fields**:
    *   `title`: String, required, trim
    *   `description`: String, required, trim
    *   `instructorId`: String, default `""`
    *   `instructorName`: String, default `""`
    *   `instructorAvatar`: String, default `""`
    *   `trainerIds`: `[ObjectId]`, ref `'User'`
    *   `price`: Number, required, default `0`
    *   `thumbnail`: String, default `""`
    *   `category`: String, required
    *   `sdgGoals`: `[Number]`
    *   `topics`: `[String]`
    *   `sections`: `[String]`
    *   `mea`: `[String]`
    *   `syllabusUrl`: String
    *   `courseUrl`: String
    *   `isDiploma`: Boolean, default `false`
    *   `isExternal`: Boolean, default `false`
    *   `externalUrl`: String
    *   `diplomaRequiredCourseIds`: `[String]`
    *   `prerequisiteCourseIds`: `[ObjectId]`, ref `'Course'`
    *   `publishStatus`: String, enum `['draft', 'pending', 'published', 'rejected']`, default `'published'`, index
    *   `approvalStatus`: String, enum `['draft', 'pending', 'approved', 'rejected']`, default `'approved'`, index
    *   `status`: String, enum `['draft', 'submitted_for_review', 'approved', 'published', 'archived']`, index
    *   `createdBy`: `ObjectId`, ref `'User'`
    *   `submittedBy`: `ObjectId`, ref `'User'`
    *   `submittedAt`: Date
    *   `submittedForApprovalAt`: Date
    *   `approvedAt`: Date
    *   `approvedBy`: `ObjectId`, ref `'User'`
    *   `publishedBy`: `ObjectId`, ref `'User'`
    *   `publishedAt`: Date
    *   `archivedBy`: `ObjectId`, ref `'User'`
    *   `archivedAt`: Date
    *   `rejectedAt`: Date
    *   `rejectedBy`: `ObjectId`, ref `'User'`
    *   `approvalComments`: String, default `""`
    *   `requiresFeedback`: Boolean, default `false`
    *   `certificateEligible`: Boolean, default `false`, index
    *   `requiresVerifiedProgress`: Boolean, default `false`
    *   `requiresCertificateApproval`: Boolean, default `true`
    *   `duration`: String, default `""`
    *   `lessonsCount`: Number, required, default `0`
    *   `rating`: Number, default `4.5`
    *   `enrolledCount`: Number, default `0`
    *   `quizQuestions`: `[{ id, prompt, options: [String], correctAnswerIndex, explanation }]`
    *   `quizPassingScore`: Number, default `70`
    *   `quizMaxAttempts`: Number, default `3`
    *   `quizRandomizeQuestions`: Boolean, default `true`
    *   `quizRandomizeOptions`: Boolean, default `true`
    *   `demoKey`: String, index
*   **Virtuals**:
    *   `lessons`: Populates virtual array of related `Lesson` documents using `courseId`.
    *   `totalDuration`: Sums lesson video durations.
*   **Indexes**:
    *   `createdAt: -1`, `category: 1, createdAt: -1`, `publishStatus: 1, approvalStatus: 1, createdAt: -1`, `status: 1, createdAt: -1`
    *   `trainerIds: 1`, `sdgGoals: 1`, `sections: 1`, `mea: 1`, `title: 'text', description: 'text'` (Text index)
*   **Middleware/Validators**:
    *   Pre-delete hooks on `findOneAndDelete`, `deleteOne`, and `deleteMany` to clean up related enrollments, lessons, progress logs, quiz submissions, and certificate records.

#### **CourseModule** (`CourseModule.ts`)
*   **Fields**:
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `title`: String, required, trim
    *   `description`: String, default `""`, trim
    *   `order`: Number, required, default `0`
    *   `isPublished`: Boolean, default `false`, index
*   **Indexes**: `courseId: 1, order: 1`

#### **CourseResource** (`CourseResource.ts`)
*   **Fields**:
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `moduleId`: `ObjectId`, ref `'CourseModule'`, index
    *   `lessonId`: `ObjectId`, ref `'Lesson'`, index
    *   `title`: String, required, trim
    *   `url`: String, required, trim
    *   `type`: String, enum `['link', 'download', 'document', 'video', 'other']`, default `'download'`
    *   `isPublished`: Boolean, default `false`, index
*   **Indexes**: `courseId: 1, moduleId: 1`, `courseId: 1, lessonId: 1`

#### **Assignment** (`Assignment.ts`)
*   **Fields**:
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `moduleId`: `ObjectId`, ref `'CourseModule'`, index
    *   `lessonId`: `ObjectId`, ref `'Lesson'`, index
    *   `title`: String, required, trim
    *   `instructions`: String, default `""`, trim
    *   `resourceIds`: `[ObjectId]`, ref `'CourseResource'`
    *   `dueAt`: Date
    *   `status`: String, enum `['draft', 'published', 'archived']`, default `'draft'`, index
*   **Indexes**: `courseId: 1, status: 1, dueAt: 1`

#### **AssignmentSubmission** (`AssignmentSubmission.ts`)
*   **Fields**:
    *   `assignmentId`: `ObjectId`, ref `'Assignment'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `learnerId`: `ObjectId`, ref `'User'`, required, index
    *   `text`: String, default `""`, trim
    *   `linkUrl`: String, default `""`, trim
    *   `fileUrl`: String, default `""`, trim
    *   `fileName`: String, default `""`, trim
    *   `fileMimeType`: String, default `""`, trim
    *   `status`: String, enum `['submitted', 'approved', 'needs_revision', 'rejected']`, default `'submitted'`, index
    *   `reviewedBy`: `ObjectId`, ref `'User'`
    *   `reviewedAt`: Date
    *   `reviewComments`: String, default `""`, trim
    *   `history`: `[{ status, actorId: ObjectId, comments, createdAt: Date }]`
*   **Indexes**:
    *   `assignmentId: 1, learnerId: 1` (unique)
    *   `courseId: 1, status: 1, updatedAt: -1`
    *   `learnerId: 1, updatedAt: -1`

#### **Lesson** (`Lesson.ts`)
*   **Fields**:
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `moduleId`: `ObjectId`, ref `'CourseModule'`, index
    *   `title`: String, required, trim
    *   `description`: String, trim
    *   `order`: Number, required
    *   `videoUrl`: String, default `""`
    *   `videoOriginalName`: String
    *   `duration`: Number (Seconds)
    *   `completionMode`: String, enum `['video_progress', 'quiz_gate']`, default `'video_progress'`
    *   `resources`: `[{ label, url }]` (Legacy inline embedded resources)
    *   `resourceIds`: `[ObjectId]`, ref `'CourseResource'`
    *   `assignmentIds`: `[ObjectId]`, ref `'Assignment'`
    *   `transcript`: String
    *   `isPublished`: Boolean, default `false`
    *   `demoKey`: String, index
*   **Indexes**:
    *   `courseId: 1, order: 1`
    *   `courseId: 1, moduleId: 1, order: 1`
    *   `courseId: 1, isPublished: 1, order: 1`

#### **Progress** (`Progress.ts`)
*   **Fields**:
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `lessonId`: `ObjectId`, ref `'Lesson'`, required
    *   `watchedSeconds`: Number, default `0`
    *   `duration`: Number, required
    *   `completed`: Boolean, default `false`
    *   `lastWatchedAt`: Date, default `Date.now`
    *   `demoKey`: String, index
*   **Indexes**:
    *   `userId: 1, lessonId: 1` (unique)
    *   `userId: 1, courseId: 1`
*   **Middleware/Validators**:
    *   Pre-save validation hook: Automatically checks `watchedSeconds >= duration * 0.9` to flag `completed = true`.

#### **QuizSubmission** (`QuizSubmission.ts`)
*   **Fields**:
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `answers`: `[{ questionId, selectedOptionIndex }]`
    *   `questionSnapshot`: `[{ id, prompt, options: [String], correctAnswerIndex, explanation }]`
    *   `attemptNumber`: Number, required, default `1`
    *   `status`: String, enum `['submitted', 'passed', 'failed']`, default `'submitted'`, index
    *   `score`: Number, required
    *   `totalQuestions`: Number, required
    *   `passed`: Boolean, required
    *   `demoKey`: String, index
*   **Indexes**:
    *   `userId: 1, courseId: 1, createdAt: -1`
    *   `userId: 1, courseId: 1, attemptNumber: -1`

#### **Enrollment** (`Enrollment.ts`)
*   **Fields**:
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `completed`: Boolean, default `false`
    *   `completedAt`: Date
    *   `demoKey`: String, index
*   **Indexes**: `userId: 1, courseId: 1` (unique)

#### **CertificateIssuance** (`CertificateIssuance.ts`)
*   **Fields**:
    *   `certificateId`: String, required, unique, index
    *   `serialNumber`: String, unique, sparse, index
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `recipientName`: String, required, trim
    *   `courseTitle`: String, required, trim
    *   `issuedAt`: Date, required, default `Date.now`
    *   `approvalStatus`: String, enum `['pending', 'approved', 'rejected']`, default `'approved'`, index
    *   `approvedBy`: `ObjectId`, ref `'User'`
    *   `approvedAt`: Date
    *   `approvalComments`: String, default `""`
    *   `revokedAt`: Date
    *   `revokedBy`: `ObjectId`, ref `'User'`
    *   `revocationReason`: String, default `""`
    *   `status`: String, enum `['valid', 'revoked']`, default `'valid'`, index
    *   `verificationCode`: String, unique, sparse, index
    *   `cohortId`: `ObjectId`, ref `'Cohort'`, index
    *   `issuedBy`: `ObjectId`, ref `'User'`
*   **Indexes**:
    *   `userId: 1, courseId: 1` (unique)
    *   `courseId: 1, issuedAt: -1`
    *   `approvalStatus: 1, issuedAt: -1`

#### **CertificateApproval** (`CertificateApproval.ts`)
*   **Fields**:
    *   `certificateIssuanceId`: `ObjectId`, ref `'CertificateIssuance'`, required, index
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `status`: String, enum `['pending', 'approved', 'rejected']`, default `'pending'`, index
    *   `requestedBy`: `ObjectId`, ref `'User'`
    *   `reviewedBy`: `ObjectId`, ref `'User'`
    *   `reviewedAt`: Date
    *   `comments`: String, default `""`, trim
*   **Indexes**: `courseId: 1, status: 1, createdAt: -1`

#### **Cohort** (`Cohort.ts`)
*   **Fields**:
    *   `title`: String, required, trim
    *   `description`: String, default `""`, trim
    *   `courseIds`: `[ObjectId]`, ref `'Course'`
    *   `trainerIds`: `[ObjectId]`, ref `'User'`
    *   `startsAt`: Date
    *   `endsAt`: Date
    *   `seatLimit`: Number, default `0`
    *   `status`: String, enum `['draft', 'active', 'completed', 'archived']`, default `'draft'`, index
*   **Indexes**:
    *   `status: 1, startsAt: -1`
    *   `courseIds: 1`, `trainerIds: 1`

#### **CohortMembership** (`CohortMembership.ts`)
*   **Fields**:
    *   `cohortId`: `ObjectId`, ref `'Cohort'`, required, index
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `status`: String, enum `['active', 'removed', 'completed']`, default `'active'`, index
    *   `addedBy`: `ObjectId`, ref `'User'`
*   **Indexes**: `cohortId: 1, userId: 1` (unique)

#### **CourseApproval** (`CourseApproval.ts`)
*   **Fields**:
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `status`: String, enum `['pending', 'approved', 'rejected']`, required, index
    *   `submittedBy`: `ObjectId`, ref `'User'`
    *   `reviewedBy`: `ObjectId`, ref `'User'`
    *   `reviewedAt`: Date
    *   `comments`: String, default `""`, trim
*   **Indexes**: `courseId: 1, createdAt: -1`

#### **CourseFeedback** (`CourseFeedback.ts`)
*   **Fields**:
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `courseId`: `ObjectId`, ref `'Course'`, required, index
    *   `rating`: Number, required, min `1`, max `5`
    *   `comments`: String, default `""`, trim
    *   `answers`: `[{ question: String, answer: String }]`
*   **Indexes**: `userId: 1, courseId: 1` (unique)

#### **AuditLog** (`AuditLog.ts`)
*   **Fields**:
    *   `actorId`: `ObjectId`, ref `'User'`, index
    *   `actorEmail`: String, default `""`, index
    *   `actorRole`: String, default `""`, index
    *   `action`: String, required, index
    *   `entityType`: String, required, index
    *   `entityId`: String, default `""`, index
    *   `details`: Mixed, default `{}`
    *   `oldValue`: Mixed, default `undefined`
    *   `newValue`: Mixed, default `undefined`
    *   `result`: String, enum `['success', 'failure']`, default `'success'`, index
    *   `ip`: String, default `""`
    *   `ipAddress`: String, default `""`
    *   `userAgent`: String, default `""`
*   **Indexes**:
    *   `createdAt: -1`, `actorId: 1, createdAt: -1`, `entityType: 1, entityId: 1, createdAt: -1`

#### **Notification** (`Notification.ts`)
*   **Fields**:
    *   `userId`: `ObjectId`, ref `'User'`, required, index
    *   `type`: String, enum `['info', 'course', 'certificate', 'announcement']`, default `'info'`
    *   `title`: String, required, trim
    *   `message`: String, required, trim
    *   `linkUrl`: String, default `""`
    *   `readAt`: Date
    *   `demoKey`: String, index
*   **Indexes**: `userId: 1, createdAt: -1`, `userId: 1, readAt: 1`

#### **Taxonomy** (`Taxonomy.ts`)
*   **Fields**:
    *   `type`: String, required, enum `['category', 'sdg', 'section', 'topic']`, trim, lowercase
    *   `key`: String, required, trim
    *   `label`: String, required, trim
    *   `description`: String, trim, default `""`
    *   `order`: Number, default `0`
    *   `active`: Boolean, default `true`
    *   `metadata`: Mixed, default `{}`
*   **Indexes**: `type: 1, key: 1` (unique)
*   **Virtuals**: `id` mapped to string representation of `_id`.

---

### 4. AUTHENTICATION SURFACES

#### **How Auth Works**
*   **Frontend**: Implemented via NextAuth.js (App Router, utilizing NextAuth v5 beta). It uses JWT strategy. It supports Google OAuth and a custom Credentials Provider.
*   **Backend**: Enforced by a Bearer JWT header validation middleware on the Express server. The Express JWT is signed on the Next.js server via `signApiAccessToken` using `env.AUTH_SECRET` (with a short-lived `5m` expiry). This token contains the user's ID, email, roles, and permissions, which are unpacked by the Express `auth` middleware and attached to `req.user`.

#### **Token Storage**
NextAuth manages sessions in encrypted HTTP-only session cookies. In frontend API calls, the transient `apiAccessToken` is loaded from the active session and attached as a `Bearer` token header. For server actions or Next.js proxy API endpoints, it signs an internal service-level token (`internal-service` identifier) using `env.AUTH_SECRET` to authorize backend actions on behalf of anonymous users or system automation.

#### **Protected Routes (Express Backend)**
All Express backend endpoints require authentication by mounting the `auth` middleware *except*:
*   `POST /api/users/authenticate` (Login credentials validation)
*   `POST /api/users/verify-email` (Account validation token submission)
*   `POST /api/users/password-reset/confirm` (Password token validation)
*   `POST /api/users/resend-verification` (Re-issuing signup links)
*   `POST /api/users/email-change/confirm` (Validating email updates)
*   `GET /api/docs/verify/:certificateId` / `GET /api/certificates/verify/:certificateId` (Public certificate authentication checking)
*   `GET /api/courses` (Unauthenticated public paginated catalog view)
*   `POST /api/courses/batch` (Unauthenticated public batch details query)
*   `GET /api/courses/:id` (Unauthenticated public course card summary query)
*   `GET /api/taxonomies` (Unauthenticated query of categories, SDGs, topics)
*   `POST /api/client-logs` (Unauthenticated rate-limited client-side log ingestion)

#### **Role and Permission Restrictions**
The backend `roles.ts` middleware implements two modes of access restriction:
1.  `requireRole(roles: string[])`: Verifies legacy roles keys (e.g. `admin`, `instructor`).
2.  `requirePermission(permission: string)`: Resolves effective permission overrides.
    *   **Manage Users Permission (`users:manage`)**: Protects roles operations, user accounts updates, user roles patching (`/api/users/:id/role`), and taxonomy changes.
    *   **Manage Content Permission (`content:manage`)**: Protects course building, lesson parameters, file/video uploads (`/api/lessons/:lessonId/upload`), resources, modules editing, and assignments creation.
    *   **Approve Certificates Permission (`certificates:approve`)**: Controls certificate approval queue actions.
    *   **Revoke Certificates Permission (`certificates:revoke`)**: Protects the certificate revocation endpoint.
    *   **View Analytics Permission (`analytics:view`)**: Restricts access to overall overview and course stats analytics.
    *   **Broadcast Notification Permission (`notifications:announce`)**: Restricts broad announcement pushes.
    *   **Export Reports Permission (`reports:export`)**: Limits compliance CSV/XLSX/PDF downloads.

---

### 5. EXTERNAL DEPENDENCIES

*   **NextAuth.js (`next-auth`)**: Core authentication infrastructure for Next.js.
*   **Google OAuth Service**: Authenticates users using external credentials.
*   **Cloudflare Turnstile CAPTCHA**: Captcha bot validation for signup submissions.
*   **Nodemailer (`nodemailer`)**: Transmits signup verification and password reset emails.
*   **Resend Service (`resend`)**: Ingests transactional email templates (alternative provider).
*   **SendGrid Service (`sendgrid`)**: Ingests transactional email templates (alternative provider).
*   **FFmpeg & FFprobe (`fluent-ffmpeg`, `@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe`)**: Analyzes video files on upload, performs container checks, and calculates playback duration values.
*   **PDF-Lib (`pdf-lib`)**: Generates custom PDF layout streams for certificate and diploma downloads.
*   **ExcelJS (`exceljs`)**: Ingests CSV/XLSX rosters and compiles XLSX report sheets.
*   **Mongoose (`mongoose`)**: MongoDB database layer modeling.
*   **Pino / Pino-HTTP (`pino`, `pino-http`, `pino-pretty`)**: JSON server-side logging and request tracing.
*   **Rotating File Stream (`rotating-file-stream`)**: Rotates and compresses logs daily.

---

### 6. ENVIRONMENT VARIABLES

*   **`AUTH_SECRET` / `NEXTAUTH_SECRET`**: Core HMAC key used to encrypt NextAuth session cookies and sign the `apiAccessToken` JWT. Must match when both are defined.
*   **`NEXTAUTH_URL`**: Root URL of the Next.js server (e.g. `http://localhost:3000`), used to format redirection handlers.
*   **`GOOGLE_CLIENT_ID`**: ID for Google OAuth provider.
*   **`GOOGLE_CLIENT_SECRET`**: Secret for Google OAuth provider.
*   **`OAUTH_ALLOWED_DOMAINS`**: Comma-separated list of email domains automatically approved on Google signup (e.g., `punjab.gov.pk`). Unmatched domains default to a `pending` status.
*   **`NEXT_PUBLIC_TURNSTILE_SITE_KEY`**: Client key for Cloudflare Turnstile CAPTCHA widget.
*   **`TURNSTILE_SECRET_KEY`**: Cloudflare validation secret key used to verify Captcha tokens on registration.
*   **`NODE_ENV`**: Sets runtime execution behavior (`development`, `production`, `test`).
*   **`LOG_LEVEL`**: Logging verbosity limit (`debug`, `info`, `warn`, `error`).
*   **`PORT`**: Port number for the Express server (default `5000`).
*   **`MONGODB_URI`**: DB connection URL (e.g. `mongodb://127.0.0.1:27017/elearning`).
*   **`CORS_ALLOWED_ORIGINS`**: Permitted API request headers origins.
*   **`APP_URL`**: Base URL of the Next.js client application.
*   **`API_URL` / `NEXT_PUBLIC_API_URL`**: Base URL of the Express API backend service.
*   **`EMAIL_PROVIDER`**: Active mail driver option (`resend` | `sendgrid` | `smtp` | `console`).
*   **`EMAIL_FROM`**: Sender address descriptor (e.g., `EPA Punjab eLearning <no-reply@epa.punjab.gov.pk>`).
*   **`RESEND_API_KEY`**: Access key for Resend email service.
*   **`SENDGRID_API_KEY`**: Access key for SendGrid email service.
*   **`SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS`**: Connection variables for local mail relays.
*   **`VIDEO_STORAGE`**: Active video storage driver type (`local` | `s3` | `minio` | `azure`).
*   **`LOCAL_VIDEO_DIR`**: Disk location where uploaded lesson media is saved (default `uploads/videos`).
*   **`VIDEO_MAX_UPLOAD_SIZE_BYTES`**: Max upload limit (default 500MB).
*   **`VIDEO_DEFAULT_CHUNK_BYTES` / `VIDEO_MAX_CHUNK_BYTES`**: Stream chunk sizing constraints.
*   **`MAX_CONCURRENT_VIDEO_STREAMS`**: Active parallel streaming slots (default 25).
*   **`API_RATE_LIMIT_WINDOW_MS` / `API_RATE_LIMIT_MAX`**: General API rate limit rules.
*   **`AUTH_RATE_LIMIT_WINDOW_MS` / `AUTH_RATE_LIMIT_MAX`**: Lockout protection limits on authentication routes.
*   **`CLIENT_LOG_RATE_LIMIT_WINDOW_MS` / `CLIENT_LOG_RATE_LIMIT_MAX`**: Limits on client log ingestion routes.
*   **`MAX_FAILED_LOGIN_ATTEMPTS`**: Failed attempts limit before lockout (default 5).
*   **`ACCOUNT_LOCKOUT_MS`**: Lockout duration after failed attempts (default 15 mins).

---

### 7. UNFINISHED OR RISKY CODE

#### **Unfinished Features & Placeholders**
*   **Placeholder Video Storage Providers (`videoStorage.ts` L224-282)**:
    *   `S3VideoStorageProvider`, `MinIOVideoStorageProvider`, and `AzureBlobVideoStorageProvider` throw `VideoStorageNotImplementedError` for all operations (`upload`, `getStream`, `delete`, `exists`). Directing `VIDEO_STORAGE` to any value other than `local` in the configuration will cause upload/streaming exceptions.
*   **Mismatched Lesson Completion Check (`courseCompletion.ts` L30-38)**:
    *   `courseCompletion.ts` checks if any lesson has `completionMode === 'manual'` and blocks completion if so. However, the `Lesson` schema only lists `['video_progress', 'quiz_gate']` as valid completion modes, and does not define a `'manual'` option.
*   **Duplicate Mounting in `server.ts` (L123 and L125)**:
    *   The routes mount points `/api/certificates` are registered twice:
        *   `app.use('/api/certificates', require('./routes/certificate-governance'));` (Line 123)
        *   `app.use('/api/certificates', require('./routes/docs'));` (Line 125)
    *   This is duplicate mounting. It works because the individual routers handle different endpoints, but it should be cleaned up.

#### **Risky Code & Missing Error Handling**
*   **Swallowed Logging Exceptions (`audit.ts` L104-106)**:
    *   Any error during database writing in the `writeAuditLog` utility is caught and printed to console (`logger.error`), but the execution is allowed to continue silently. If database connection drops or writes fail, the app continues operating without recording auditable compliance logs.
*   **Missing Transaction Safety on Course Deletions (`courses.ts` L790-818)**:
    *   Deleting a course triggers a cascade delete across other collections (lessons, enrollments, progress, quiz submissions). However, this cascade delete is performed in parallel using `Promise.all` without an active Mongoose transaction session. If any deletion query fails, it will leave orphan documents in the DB.
*   **Audit Logger Swallows Admin Redirection Issues (`docs.ts` L247-311)**:
    *   Generating certificate and diploma downloads writes audit logs during the rendering pipeline. If the audit logger fails, it does not bubble up. If the generation fails inside a worker process, a generic `500` status is returned without detailed diagnostic warnings on the frontend.
*   **Rate Limiting Map Memory Leak (`users.ts` L872)**:
    *   `resendVerificationCount` is a global in-memory `Map` that tracks rate limits for verification emails. Since entries are never pruned, this Map will grow continuously as new registration attempts occur, posing a memory leak risk.
*   **Unsanitized Description Fields on Module Insertion (`modules.ts` L52-58)**:
    *   The `description` field submitted during module creation (`POST /api/modules`) is saved directly to the database without validation. While React protects against XSS during rendering, this field should ideally be sanitized to prevent storing malicious scripts.
