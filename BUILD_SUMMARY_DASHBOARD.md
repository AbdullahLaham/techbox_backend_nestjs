# What was built: guide for the web app (admin dashboard + learner pages)

Short guide for the `techbox_dashboard` team: what the backend now offers, what the web app already uses, and what is left to build. Full endpoint and payload details: **`api-contract-admin.md`**. Types: `types/*.contract.ts` (copied from the backend's `src/types/`; re-copy, never edit).

Status: 2026-10-28. Backend: 44 end-to-end tests passing.

## 1. What the backend provides

| Area | What it does | Base path |
|------|--------------|-----------|
| Programs | Create/edit in any status (draft → published → ongoing → completed → archived), seats, cohort dates, enrollment on/off, Arabic slugs | `/v1/admin/programs` |
| Curriculum | Tracks, modules, lessons; new items go to the end; deletes refused when they would erase student work | `/v1/admin/programs/...` |
| Enrollments | Review applications, see the payment receipt, accept/reject/suspend/complete with a note the student sees | `/v1/admin/enrollments` |
| Assignments | Create (draft), publish/archive, attach instruction files, lists with submission counts | `/v1/admin/assignments` |
| **Submissions** (new) | Review queue per assignment, open a hand-in (files, links, text), grade with score and feedback, request revision, reject | `/v1/admin/assignments/:id/submissions`, `/v1/admin/submissions/:id` |
| Lessons | Video (link), reading material (link or uploaded file), quiz lessons | `/v1/admin/nodes` |
| Quizzes | Questions with 4 options / 1 correct, publishing checks, attempt review with stats | `/v1/admin/quizzes` |
| Learner side | Catalog, program page (locked until accepted), apply, my assignments, hand-in, lessons, quizzes | `/v1/programs`, `/v1/enrollments`, `/v1/assignments`, `/v1/nodes`, `/v1/quizzes` |

All `/v1` errors share one shape: `{ statusCode, code, message, details? }`. `lib/api-error.ts` already turns them into Arabic messages (`getApiErrorMessage`) and per-field messages (`getApiErrorDetails`).

## 2. Already in the web app

| Screen | Uses |
|--------|------|
| `/admin/content` and `/admin/content/[slug]` | Admin programs API, curriculum API, lessons API |
| `/admin/lessons/...` (lesson editor, quiz questions and settings, attempts) | Lessons and quizzes APIs (`services/nodes-admin-service.ts`) |
| `/admin/enrollments` | Enrollment review API (tabs with counts, receipt preview, accept/reject with note) |
| `/admin/assignments` (list, new, edit, attachments) | Assignments API (`services/assignments-admin-service.ts`) |
| `/programs`, `/programs/[slug]` | Catalog, program detail with lock state, apply dialog |
| `/assignments`, `/assignments/[id]` | Learner list and detail (read-only) |

## 3. Left to build

### 3.1 Grading page (`/admin/grading`, now a "coming soon" placeholder)

Who: `SUPER_ADMIN`, `INCUBATOR_MANAGER`, `INSTRUCTOR` (`SUBMISSION_REVIEWER_ROLES`). Note the route rule in `lib/auth/rbac.ts` currently allows all staff on `/admin/grading`; tighten it to these roles (mentors get `403` from the API).

| Part | Call |
|------|------|
| Pick an assignment | `GET /v1/admin/assignments` (`pendingReviewCount` per row shows where work is waiting) |
| Review queue with status tabs | `GET /v1/admin/assignments/:id/submissions?status=&latestOnly=true&q=&page=` → `items` + `statusCounts` |
| Open a hand-in | `GET /v1/admin/submissions/:submissionId` → `content.text`, `content.links`, `content.files[].url` (signed, ~1 h), `isLate`, `attemptNumber` |
| Previous attempts of a student | Same list with `latestOnly=false&q=<email>` |
| Grade | `PATCH /v1/admin/submissions/:id/grade` with `{ status, score?, feedback? }` |

Grading rules to reflect in the form:

| Action | Body | Notes |
|--------|------|-------|
| Start reviewing | `{ "status": "UNDER_REVIEW" }` | Optional; shows the student it is being looked at |
| Grade | `{ "status": "GRADED", "score": 85.5, "feedback": "…" }` | Score required, 0 to `maxScore`, 2 decimals |
| Ask for changes | `{ "status": "NEEDS_REVISION", "feedback": "…" }` | The student can hand in a new attempt |
| Reject | `{ "status": "REJECTED", "feedback": "…" }` | Final; no new attempt |

Grading notifies the student, records the grader, and (for GRADED) completes the lesson in the student's progress. The quick-action card "قائمة التقييم" and the admin overview's grading preview can then read real data instead of mocks.

### 3.2 Hand-in on the learner assignment page (`/assignments/[id]`)

| Part | Call |
|------|------|
| Current state | `GET /v1/assignments/:id/my-submission` → `latest`, `attempts`, `canSubmit`, `submitBlockReason` |
| Hand in | `POST /v1/assignments/:id/submit`: JSON `{ text?, links? }`, or multipart with `files` (repeat), `text`, `links` (repeat) |

Form per `allowedType` (`SUBMISSION_RULES` in `submissions.contract.ts`):

| `allowedType` | Inputs |
|---------------|--------|
| `FILE_UPLOAD` | 1–5 files (pdf, doc, docx, png, jpg, webp; ≤ 20 MB each) + optional note |
| `URL_LINK` | 1 link + optional note |
| `TEXT_CONTENT` | Text answer (≤ 20,000) |
| `MULTIMEDIA` | Up to 5 links and/or up to 5 files (at least one) + optional note |

- Show the form only when `canSubmit`; otherwise explain `submitBlockReason` (awaiting review / graded / rejected).
- After a `NEEDS_REVISION`, the form appears again; the new hand-in is attempt 2, 3, …
- Late hand-ins are accepted and shown as `isLate`.
- Upload straight from the browser (FormData, `Content-Type: multipart/form-data`, `timeout: 0`, progress via `onUploadProgress`).
- After success, invalidate the assignment list and `my-submission` queries.

## 4. Rules worth knowing (what the API will refuse)

| Situation | Response |
|-----------|----------|
| Program slug already used | `409 SLUG_TAKEN` (`details.slug`) |
| Deleting a program with enrollments | `409 PROGRAM_HAS_ENROLLMENTS` → archive instead |
| Deleting curriculum with hand-ins or quiz attempts | `409 CONTENT_HAS_SUBMISSIONS` / `QUIZ_HAS_ATTEMPTS` |
| Changing a lesson's type | `409 NODE_TYPE_LOCKED` |
| Publishing an incomplete quiz | `409 QUIZ_NOT_READY` |
| Changing quiz scoring after attempts | `409 QUIZ_HAS_ATTEMPTS` |
| Accepting an enrollment with no seat left | `409 PROGRAM_FULL` → raise `maxSeats` |
| Assignment with hand-ins: change submission type / lower max score below a grade | `409 ALLOWED_TYPE_LOCKED` / `MAX_SCORE_BELOW_EXISTING_SCORES` |
| Student hands in while waiting for review | `409 SUBMISSION_LOCKED` |

## 5. Setup

- Backend `.env`: `STORAGE_SIGNING_SECRET` (keeps file links valid across restarts) and `PUBLIC_API_URL` (host used in signed links).
- Database: `npx prisma migrate deploy` (6 migrations). Old receipts in `uploads/`: `npx tsx scripts/migrate-legacy-receipts.ts` once.
- Web app: `NEXT_PUBLIC_API_URL` pointing at the backend.
- After a backend contract change, re-copy `src/types/*.contract.ts` into `types/`.
