# TechBox API contract: Web app (admin dashboard + learner pages)

Every endpoint the Next.js project (`techbox_dashboard`) uses: the admin dashboard (programs and curriculum, enrollments, assignments, submissions and grading, lessons, quizzes) and the learner pages of the same web app.

The mobile app has its own contract: `api-contract-mobile.md`. The learner endpoints are identical for both apps.

## 0. Type files

Exact TypeScript types are in the backend under `src/types/`, copied unchanged into the web app's `types/` (do not edit the copies; re-copy after a backend change):

| File | Covers |
|------|--------|
| `api.contract.ts` | Programs, curriculum, enrollments, roles, error codes, Arabic labels, `slugify` |
| `assignments.admin.contract.ts` | Assignment management and attachments |
| `assignments.contract.ts` | Learner assignment list |
| `submissions.contract.ts` | Hand-ins, reviewing and grading |
| `nodes.contract.ts` | Lessons (video, reading, quiz) and quizzes |

## 1. Conventions

| | |
|---|---|
| Base URL | `NEXT_PUBLIC_API_URL` (dev `http://localhost:5000`) |
| Auth | `Authorization: Bearer <accessToken>`; refresh with `/auth/refresh` (single-use refresh tokens) |
| Body | JSON unless the endpoint says multipart |
| Uploads | Send multipart **directly from the browser to the API** (not through Next.js route handlers or server actions, which cap bodies at about 1 to 4.5 MB). Override the axios instance's JSON `Content-Type` with `multipart/form-data` |
| Dates | ISO 8601 UTC; show them in the admin's timezone |
| Numbers | Scores, points, percentages: numbers with up to 2 decimals |
| Caching | `Cache-Control: private, max-age=0` on admin and learner responses |
| Signed links | File `url`s (attachments, receipts, submission files, reading files) last about 1 hour. Never store them; refetch the data |

### Errors

```json
{ "statusCode": 400, "code": "VALIDATION_FAILED", "message": "…", "details": { "slug": "هذا الرابط التعريفي مستخدم لبرنامج آخر" } }
```

- Show `API_ERROR_MESSAGES_AR[code]` (`api.contract.ts`) or, for assignment routes, `ASSIGNMENT_ERROR_MESSAGES_AR` (`assignments.admin.contract.ts`).
- `details` (field → Arabic message, nested with dots) comes only with `VALIDATION_FAILED`: show it next to the field. `lib/api-error.ts` (`getApiErrorMessage`, `getApiErrorDetails`) already does this.
- `401` → session expired (refresh, else login). `403` → role not allowed.

| HTTP | `code` | Where |
|------|--------|-------|
| 400 | `VALIDATION_FAILED` | Any form |
| 404 | `NOT_FOUND` | Unknown id |
| 409 | `SLUG_TAKEN` | Program slug used by another program |
| 409 | `PROGRAM_HAS_ENROLLMENTS` | Deleting a program with enrollments (archive instead) |
| 409 | `CONTENT_HAS_SUBMISSIONS` | Deleting curriculum containing assignment hand-ins |
| 409 | `QUIZ_HAS_ATTEMPTS` | Changing a quiz's scoring after attempts, or deleting content with quiz attempts |
| 409 | `QUIZ_NOT_READY` | Publishing an incomplete quiz |
| 409 | `NODE_TYPE_LOCKED` | Changing a lesson's type |
| 409 | `INVALID_STATUS_TRANSITION` | Enrollment or assignment status change not allowed |
| 409 | `PROGRAM_FULL` | Activating an enrollment with no seat left |
| 409 | assignment codes | `ASSIGNMENT_HAS_SUBMISSIONS`, `ALLOWED_TYPE_LOCKED`, `MAX_SCORE_BELOW_EXISTING_SCORES`, `ATTACHMENT_LIMIT_REACHED` |
| 413 / 415 / 429 | `FILE_TOO_LARGE` / `UNSUPPORTED_FILE_TYPE` / `TOO_MANY_REQUESTS` | Uploads |

### Roles

| Area | Roles |
|------|-------|
| Programs, tracks, modules, lessons: read, create, edit | `SUPER_ADMIN`, `INCUBATOR_MANAGER`, `INSTRUCTOR` (`CONTENT_MANAGER_ROLES`) |
| Delete programs, tracks, modules, lessons; ASSIGNMENT lessons | `SUPER_ADMIN`, `INCUBATOR_MANAGER` (`CONTENT_OWNER_ROLES`) |
| Assignments (`/v1/admin/assignments`) | `SUPER_ADMIN`, `INCUBATOR_MANAGER` (`ASSIGNMENT_MANAGER_ROLES`) |
| Review and grade submissions | `SUPER_ADMIN`, `INCUBATOR_MANAGER`, `INSTRUCTOR` (`SUBMISSION_REVIEWER_ROLES`) |
| Quizzes (edit, attempts) | `CONTENT_MANAGER_ROLES` |
| Enrollment review | `SUPER_ADMIN`, `INCUBATOR_MANAGER` (`ENROLLMENT_MANAGER_ROLES`) |
| User management (`/v1/admin/users`) | `SUPER_ADMIN` (every role), `INCUBATOR_MANAGER` (instructors, mentors, students, guests): see **`api-contract-users.md`** |

There is no staff-to-program link in the schema yet, so staff roles apply to every program.

---

## 2. Authentication

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/login` | `{ email, password }` | `{ accessToken, refreshToken, user: { id, email, globalRole, firstName, lastName, role } }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `{ accessToken, refreshToken }` (the old refresh token is consumed) |
| POST | `/auth/logout` | `{ refreshToken }` | `204` |
| GET | `/auth/me` | Bearer | `{ id, email, globalRole, firstName, lastName }` |
| POST | `/auth/register` | `{ email, password, firstName, lastName, bio? }` | `201 { message, user }` |

Login is limited to 10 tries per email and 30 per IP per 15 minutes (register 10 per IP per hour, refresh 60 per IP per 15 minutes). Over the limit: `429` with `code: "TOO_MANY_REQUESTS"`, `retryAfterSec` and a `Retry-After` header. The first admin accounts come from `npm run seed` (see `.env.example`); there is no way to register as staff.

---

## 3. Programs and curriculum (`/v1/admin/programs`)

### 3.1 Programs

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/v1/admin/programs` | `?status=&type=&q=` | `AdminProgram[]` (all statuses, newest first) |
| GET | `/v1/admin/programs/:idOrSlug` | | `AdminProgramDetail` (with tracks → modules → lessons) |
| POST | `/v1/admin/programs` | `CreateProgramBody` | `201 AdminProgram` |
| PATCH | `/v1/admin/programs/:id` | `UpdateProgramBody` (partial) | `AdminProgram` |
| DELETE | `/v1/admin/programs/:id` | | `204`; `409 PROGRAM_HAS_ENROLLMENTS` → set status `ARCHIVED` instead |

`CreateProgramBody`:

| Field | Rules |
|-------|-------|
| `title` | 3 to 200 |
| `slug` | `SLUG_PATTERN` (lowercase letters incl. Arabic, digits, single hyphens), ≤ 120, unique (`409 SLUG_TAKEN`). Build with `slugify(title)` |
| `description` | ≤ 5000, `""`/`null` clears |
| `type` | `ACADEMIC_COURSE` (default), `INCUBATOR_BATCH`, `BOOTCAMP`, `WORKSHOP_SERIES` |
| `status` | `DRAFT` (default), `PUBLISHED`, `ONGOING`, `COMPLETED`, `ARCHIVED` |
| `coverImage` | http(s) URL, `""`/`null` clears |
| `maxSeats` | Integer ≥ 1, `null` = unlimited, default 30 |
| `startDate`, `endDate` | ISO or `null`; `endDate` not before `startDate` |
| `isEnrollmentOpen` | Default `true` |

`AdminProgram` = the public `ProgramSummary` (seats, `canEnroll`, `enrollmentBlockReason`, `_count`) plus `maxSeats` and `enrollmentCounts` (per enrollment status, e.g. `{ "PENDING": 3, "ACTIVE": 20, … }`).

Public visibility: the catalog shows `PUBLISHED` and `ONGOING`; the detail page also shows `COMPLETED`; `DRAFT` and `ARCHIVED` are hidden (staff can still preview).

### 3.2 Tracks, modules and lessons

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/v1/admin/programs/:programId/tracks` | `{ title, description?, orderIndex? }` | `201 AdminTrack` |
| PATCH | `/v1/admin/programs/tracks/:trackId` | partial | `AdminTrack` |
| DELETE | `/v1/admin/programs/tracks/:trackId` | | `204` |
| POST | `/v1/admin/programs/tracks/:trackId/modules` | `{ title, description?, orderIndex? }` | `201 AdminModule` |
| PATCH | `/v1/admin/programs/modules/:moduleId` | partial | `AdminModule` |
| DELETE | `/v1/admin/programs/modules/:moduleId` | | `204` |
| POST | `/v1/admin/programs/modules/:moduleId/nodes` | `CreateNodeBody` (api.contract) | `201 AdminNode` |
| PATCH | `/v1/admin/programs/nodes/:nodeId` | `UpdateNodeBody` | `AdminNode` |
| DELETE | `/v1/admin/programs/nodes/:nodeId` | | `204` |

- Omit `orderIndex` to append at the end.
- A lesson's `type` cannot change (`409 NODE_TYPE_LOCKED`).
- `ASSIGNMENT` lessons need `assignmentData` and an owner role; they follow the assignment rules (section 5) and start as `DRAFT`. `QUIZ` lessons get an unpublished quiz (section 8).
- Deletes are refused while the content holds assignment hand-ins (`CONTENT_HAS_SUBMISSIONS`) or quiz attempts (`QUIZ_HAS_ATTEMPTS`). Stored files are removed after a delete.
- The dedicated lessons API (section 7) is the newer way to manage video, reading and quiz lessons; both write the same data.

---

## 4. Enrollments (`/v1/admin/enrollments`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/v1/admin/enrollments` | `?page=&pageSize=&status=&programId=&q=&sort=` | `AdminEnrollmentList` |
| GET | `/v1/admin/enrollments/:id` | | `AdminEnrollmentDetail` |
| PATCH | `/v1/admin/enrollments/:id/status` | `{ status, note? }` | `AdminEnrollmentDetail` |

- `q` matches email, names, phone, national id. `sort`: `createdAt`, `-createdAt` (default), `updatedAt`, `-updatedAt`.
- `AdminEnrollmentList` = `{ items, page, pageSize, total, statusCounts }`; `statusCounts` covers the same filters ignoring `status` (for the tabs).
- Detail adds the applicant's age, national id, governorate, phone, and `receiptUrl` (signed) + `receiptMimeType`.
- List items and detail carry the learner's live progress: `progressPct`, `completedLessons`, `totalLessons` (mandatory visible lessons; see `docs/updates/01-program-progress.md`).
- Status changes (`ENROLLMENT_STATUS_TRANSITIONS`):

| From | To |
|------|----|
| `PENDING` | `ACTIVE` (accept), `REJECTED` |
| `ACTIVE` | `COMPLETED`, `SUSPENDED`, `DROPPED` |
| `SUSPENDED` | `ACTIVE`, `DROPPED` |
| `COMPLETED` | `ACTIVE` |
| `DROPPED` | `ACTIVE` |
| `REJECTED` | `PENDING`, `ACTIVE` |

  `note` (≤ 1000) is shown to the student; each change replaces the previous note. Taking a seat again (from REJECTED/DROPPED) needs a free seat (`409 PROGRAM_FULL`).

---

## 5. Assignments (`/v1/admin/assignments`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/v1/admin/assignments/targets` | | Programs > tracks > modules for the form |
| GET | `/v1/admin/assignments` | `?page&pageSize&q&programId&trackId&moduleId&status&sort` | `Paginated<AdminAssignmentListItem>` |
| GET | `/v1/admin/assignments/:id` | | `AdminAssignmentDetail` |
| POST | `/v1/admin/assignments` | `CreateAssignmentBody` | `201 AdminAssignmentDetail` (DRAFT) |
| PATCH | `/v1/admin/assignments/:id` | `UpdateAssignmentBody` | `AdminAssignmentDetail` |
| PATCH | `/v1/admin/assignments/:id/status` | `{ status }` | `AdminAssignmentDetail` |
| DELETE | `/v1/admin/assignments/:id` | | `204` |
| POST | `/v1/admin/assignments/:id/attachments` | multipart `file` | `201 AdminAttachment` |
| DELETE | `/v1/admin/assignments/:id/attachments/:attachmentId` | | `204` |

Key rules (details in `ASSIGNMENTS_SPEC.md` and `assignments.admin.contract.ts`):

- Create: `moduleId`, `title` (3–200), `instructions` (1–10,000), `allowedType` (default `URL_LINK`), `maxScore` (0 < x ≤ 999.99, default 100), `dueDate` (future or null), `isMandatory`, `orderIndex`.
- Status: DRAFT → PUBLISHED (sets `publishedAt`); PUBLISHED → DRAFT (only without hand-ins), → ARCHIVED; ARCHIVED → PUBLISHED.
- With hand-ins: `allowedType` is locked, `maxScore` cannot go below the highest score, delete is refused (archive instead).
- Instruction files: pdf, docx, pptx, xlsx, png, jpg, txt, zip; ≤ 20 MB; ≤ 5 per assignment.
- List items carry `submissionsCount`, `pendingReviewCount` and `attachmentsCount`.

---

## 6. Submissions: review and grading

### 6.1 How hand-ins work (reference)

Students hand in with `POST /v1/assignments/:assignmentId/submit` (section 9). Each attempt is a new submission; a student can hand in again only after `NEEDS_REVISION`. Late hand-ins are accepted and flagged `isLate`. What a hand-in contains depends on `allowedType`:

| `allowedType` | Content |
|---------------|---------|
| `FILE_UPLOAD` | 1 to 5 files (pdf, doc, docx, png, jpg, webp; ≤ 20 MB each) + optional note |
| `URL_LINK` | 1 link + optional note |
| `TEXT_CONTENT` | Text answer (≤ 20,000) |
| `MULTIMEDIA` | Up to 5 links and/or up to 5 files (at least one) + optional note |

### 6.2 `GET /v1/admin/assignments/:assignmentId/submissions`

Query (`AdminSubmissionListQuery`):

| Param | Default | Notes |
|-------|---------|-------|
| `page`, `pageSize` | 1, 20 | `pageSize` ≤ 100 |
| `status` | all | `SUBMITTED`, `UNDER_REVIEW`, `GRADED`, `REJECTED`, `NEEDS_REVISION` |
| `latestOnly` | `true` | `true`: each student's latest attempt (the review queue). `false`: every attempt |
| `q` | | Student email or name |

Ordered oldest first (review in arrival order). Response (`AdminSubmissionList`):

```json
{
  "items": [
    {
      "id": "s1…",
      "assignmentId": "as1…",
      "attemptNumber": 2,
      "status": "SUBMITTED",
      "submittedAt": "2026-10-28T10:00:00.000Z",
      "isLate": false,
      "score": null,
      "maxScore": 100,
      "feedback": null,
      "reviewedAt": null,
      "content": {
        "type": "FILE_UPLOAD",
        "text": "الحل مرفق",
        "links": [],
        "files": [{ "id": "f1…", "fileName": "الحل.pdf", "mimeType": "application/pdf", "sizeBytes": 245123, "url": "https://…" }]
      },
      "student": { "id": "u1…", "email": "sara@example.com", "name": "سارة أحمد" },
      "grader": null,
      "assignment": { "id": "as1…", "title": "بناء واجهة تسجيل الدخول", "maxScore": 100, "dueDate": "…" }
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 14,
  "statusCounts": { "SUBMITTED": 5, "UNDER_REVIEW": 1, "GRADED": 7, "REJECTED": 0, "NEEDS_REVISION": 1 }
}
```

`statusCounts` covers the same rows (same `latestOnly` and `q`) ignoring `status`, for the tabs.

### 6.3 `GET /v1/admin/submissions/:submissionId`

One `AdminSubmission` (same shape as a list item).

### 6.4 `PATCH /v1/admin/submissions/:submissionId/grade`

Body (`GradeSubmissionBody`):

```json
{ "status": "GRADED", "score": 85.5, "feedback": "عمل ممتاز، انتبه لتسمية المتغيرات." }
```

| `status` | Effect |
|----------|--------|
| `UNDER_REVIEW` | Marks the hand-in as being reviewed (score untouched unless sent) |
| `GRADED` | `score` required (0 to `maxScore`, 2 decimals). Completes the assignment lesson in the student's progress |
| `NEEDS_REVISION` | The student may hand in a new attempt. `score` optional |
| `REJECTED` | Final; the student cannot hand in again. `score` optional |

- `feedback` ≤ 5000; omitted keeps the current one, `null` clears it.
- Records the grader (`grader` in responses) and `reviewedAt`.
- `GRADED`, `NEEDS_REVISION` and `REJECTED` send the student an in-app notification.
- Response: the updated `AdminSubmission`. Errors: `400` (missing or too-high score, bad status), `404`.

---

## 7. Lessons (`/v1/admin/nodes`)

Manages `VIDEO_LECTURE`, `READING_MATERIAL` and `QUIZ` lessons (`LIVE_SESSION` is not supported; `ASSIGNMENT` lessons belong to section 5).

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/v1/admin/nodes?moduleId=` | | `AdminNodeDetail[]` |
| GET | `/v1/admin/nodes/:nodeId` | | `AdminNodeDetail` |
| POST | `/v1/admin/nodes` | `CreateNodeBody` (nodes.contract) | `201 AdminNodeDetail` |
| PATCH | `/v1/admin/nodes/:nodeId` | `UpdateNodeBody` | `AdminNodeDetail` |
| POST | `/v1/admin/nodes/:nodeId/file` | multipart `file` (READING_MATERIAL) | `201 AdminNodeDetail` |
| DELETE | `/v1/admin/nodes/:nodeId/resource` | | `AdminNodeDetail` |
| DELETE | `/v1/admin/nodes/:nodeId` | owners only | `204`; `409 QUIZ_HAS_ATTEMPTS` |

- `VIDEO_LECTURE`: `video: { playbackUrl, durationSec, externalId? }` required (`externalId` defaults to the URL's last segment).
- `READING_MATERIAL`: `link` (http/https) or an uploaded file (pdf, docx, pptx, xlsx, png, jpg, txt, zip; ≤ 50 MB); one replaces the other.
- `QUIZ`: optional `quiz: { title?, description?, passingScore?, maxAttempts?, showCorrectAnswers? }`; the quiz is created unpublished.
- `AdminNodeDetail` includes `video`, `resource` (signed `url` for files) and a `quiz` summary (`id`, `isPublished`, `questionCount`, `totalScore`, `passingScore`, `attemptsCount`).

---

## 8. Quizzes (`/v1/admin/quizzes`)

| Method | Path | Body / query | Response |
|--------|------|--------------|----------|
| GET | `/v1/admin/quizzes/:quizId` | | `AdminQuiz` (with correct answers) |
| PATCH | `/v1/admin/quizzes/:quizId` | `{ title?, description?, passingScore?, maxAttempts?, showCorrectAnswers?, isPublished? }` | `AdminQuiz` |
| POST | `/v1/admin/quizzes/:quizId/questions` | `CreateQuizQuestionBody` | `201 AdminQuiz` |
| PATCH | `/v1/admin/quizzes/questions/:questionId` | partial | `AdminQuiz` |
| DELETE | `/v1/admin/quizzes/questions/:questionId` | | `AdminQuiz` |
| GET | `/v1/admin/quizzes/:quizId/attempts` | `?page&pageSize&passed&studentId` | `AdminQuizAttemptList` (+ `stats`) |
| GET | `/v1/admin/quizzes/attempts/:attemptId` | | `AdminQuizAttemptDetail` |

- A question: `text` (≤ 2000), `explanation?`, `points` (> 0, ≤ 1000, default 1), exactly **4 options** with exactly **one** `isCorrect: true`. Option edits apply in place by position.
- Publish (`isPublished: true`) only when complete: ≥ 1 question, every question valid, `passingScore` ≤ total (`409 QUIZ_NOT_READY`). A published quiz must stay complete.
- After the first attempt (`isLocked: true`): no adding/deleting questions, no changing points, correct answers or `passingScore` (`409 QUIZ_HAS_ATTEMPTS`). Texts, explanations, order, settings and publishing stay editable.
- Students never receive `isCorrect`. Staff can try a quiz from the learner endpoints; their result is graded but not saved.

---

## 9. Learner pages of the web app

The web learner pages use the same endpoints and shapes as the mobile app (`api-contract-mobile.md`):

| Page | Calls |
|------|-------|
| `/programs` | `GET /v1/programs` |
| `/programs/[slug]` | `GET /v1/programs/:slug` (send the token: adds `myEnrollment`, unlocks lessons) |
| Apply dialog | `POST /v1/enrollments/:programId` (multipart: `fullNameAr`, `fullNameEn`, `age`, `phoneWhatsApp`, `nationalId`, `governorate`, optional `receipt` ≤ 10 MB) |
| `/assignments` | `GET /v1/assignments` |
| `/assignments/[id]` | `GET /v1/assignments/:id`, `GET /v1/assignments/:id/my-submission`, `POST /v1/assignments/:id/submit` |
| Lessons | `GET /v1/nodes/:nodeId` |
| Quizzes | `GET /v1/quizzes/:quizId`, `POST /v1/quizzes/:quizId/attempts`, `GET /v1/quizzes/attempts/:attemptId` |
| Lesson progress | `POST /v1/nodes/:nodeId/progress` (video `positionSec`, reading `completed: true`) |
| Notification bell | `GET /v1/notifications`, `GET /v1/notifications/unread-count`, `PATCH /v1/notifications/:id/read`, `POST /v1/notifications/read-all` (see `api-contract-mobile.md` §9; `actionUrl` `/assignments/<id>` → `/assignments/[id]`, `/programs/<slug>` → `/programs/[slug]`) |

Notifications sent by admin actions: publishing an assignment notifies the program's ACTIVE learners (`NEW_ASSIGNMENT`), changing an enrollment status notifies the student with your note (`ENROLLMENT`), grading notifies the student (`GRADED`).

Hand-in from the browser (`submissions.contract.ts`):

```ts
const form = new FormData();
form.append('text', note);
links.forEach((l) => form.append('links', l));
files.forEach((f) => form.append('files', f));
await api.post(SUBMISSIONS_ENDPOINTS.submit(assignmentId), form, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 0,
  onUploadProgress: (e) => e.total && setProgress(Math.round((e.loaded / e.total) * 100)),
});
```

For link or text only, a JSON body `{ text, links }` works too. `GET .../my-submission` returns `canSubmit` and `submitBlockReason`.

---

## 9b. User management

`/v1/admin/users`: list and search accounts, create staff, edit profiles, change roles, suspend / reactivate / archive, reset passwords. Full contract with rules, payloads and a page outline: **`api-contract-users.md`**.

## 10. Changes in this release

| Area | Change |
|------|--------|
| Programs | New admin API with drafts, seats, dates, enrollment toggle; public detail returns only the caller's enrollment and locks content until accepted; slug rules and `SLUG_TAKEN` |
| Curriculum | New lessons appended at the end; lesson type locked; deletes protected against losing student work; QUIZ/assignment lessons hidden until published |
| Enrollments | Review API (list, detail, status with note); `REJECTED` status; re-apply; seat checks; private receipts with signed links |
| Assignments | Admin API, attachments, status lifecycle, student list and detail |
| Submissions | **New:** hand-in endpoint (JSON or multipart) by assignment type, resubmission after revision, late flag, review list (latest attempt or all), grading with feedback, progress update and notification |
| Lessons and quizzes | New lessons API (video, reading link/file, quiz) and quiz API (questions, publishing, automatic grading, attempt limits, attempt review) |
| Errors | One error shape `{ statusCode, code, message, details? }` on all `/v1` routes |
