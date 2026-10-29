# What was built: guide for the web app (admin dashboard + learner pages)

Short guide for the `techbox_dashboard` team: what the backend now offers, what the web app already uses, and what is left to build. Full endpoint and payload details: **`api-contract-admin.md`**. Types: `types/*.contract.ts` (copied from the backend's `src/types/`; re-copy, never edit).

Status: 2026-10-29. Backend: 52 end-to-end tests passing. Change log per update: `docs/updates/`.

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
| `/admin/lessons/...` (lesson editor, reading file, quiz questions and settings, attempts) | Lessons and quizzes APIs (`services/nodes-admin-service.ts`) |
| `/admin/enrollments` | Enrollment review API (tabs with counts, receipt preview, accept/reject with note) |
| `/admin/assignments` (list, new, edit, attachments) | Assignments API (`services/assignments-admin-service.ts`) |
| `/admin/grading`, `/admin/grading/[id]` | Submissions review queue, submission review, grade form (`services/submissions-service.ts`) |
| `/programs`, `/programs/[slug]` | Catalog, program detail with lock state, apply dialog |
| `/assignments`, `/assignments/[id]` | Learner list and detail, hand-in panel (`components/submissions/student/hand-in-panel.tsx`) |

## 3. Left to build

### 3.1 Lesson progress (new API, docs/updates/01-program-progress.md)

| Part | Call |
|------|------|
| Video lesson in `/programs/[slug]` | `POST /v1/nodes/:nodeId/progress` with `{ positionSec }` about every 15 s and on pause/leave; resume from `GET /v1/nodes/:nodeId` → `progress.lastPositionSec` |
| Reading lesson | A "تم الانتهاء" button → `{ completed: true }` |
| Curriculum ticks | `ProgramNode.isCompleted` from `GET /v1/programs/:slug` |
| Progress bar | `myEnrollment.progressPct`, `completedLessons / totalLessons`; learner dashboard from `GET /v1/enrollments/my-enrollments` (replace the mock in `services/dashboard-service.ts`) |
| Admin enrollments table | Show `completedLessons / totalLessons` per learner |

### 3.2 Notification bell (new API, docs/updates/02-notifications.md)

| Part | Call |
|------|------|
| Badge in the header | `GET /v1/notifications/unread-count` (on load and focus) |
| Dropdown or page | `GET /v1/notifications?page=&unreadOnly=` |
| Open one | `PATCH /v1/notifications/:id/read`, then route `actionUrl` (`/assignments/<id>` → `/assignments/[id]`, `/programs/<slug>` → `/programs/[slug]`) |
| Mark all read | `POST /v1/notifications/read-all` |

### 3.3 Still mocked

The admin and learner overviews (`services/dashboard-service.ts`) serve fixtures; the backend has no `/dashboard/*` aggregate endpoints yet.

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
