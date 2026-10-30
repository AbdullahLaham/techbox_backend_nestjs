# What was built: guide for the Expo mobile app

Short guide for the `teckbox_lms_app` team: what the backend now offers learners, what the app already uses, and what is left to build. Full endpoint and payload details: **`api-contract-mobile.md`**. Types: `src/types/*.contract.ts` (copied from the backend's `src/types/`; re-copy, never edit).

Status: 2026-10-30. Backend: 55 end-to-end and 6 unit tests passing. Change log per update: `docs/updates/`.

## 1. What the backend provides

| Area | What the learner can do | Endpoints |
|------|-------------------------|-----------|
| Session | Sign in, refresh (single-use refresh tokens), sign out | `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` |
| Catalog | See published and ongoing programs with seats left and whether applying is open | `GET /v1/programs` |
| Program | See the curriculum; own enrollment status and admin note; lessons unlock once accepted | `GET /v1/programs/:slug` (send the token) |
| Enrollment | Apply with personal data and a payment receipt; apply again after rejection | `POST /v1/enrollments/:programId`, `GET /v1/enrollments/my-enrollments` |
| Assignments | List with state (new, overdue, submitted, graded), detail with instructions and files | `GET /v1/assignments`, `GET /v1/assignments/:id` |
| **Hand-in** (new) | Submit files, links or text; see score, feedback and every attempt; resubmit after a revision request | `POST /v1/assignments/:id/submit`, `GET /v1/assignments/:id/my-submission` |
| Lessons | Video, reading material (link or file), quiz lessons | `GET /v1/nodes/:nodeId` |
| Quizzes | Questions (no answers sent), automatic grading, results, attempt history | `/v1/quizzes/...` |

Errors on `/v1` routes: `{ statusCode, code, message, details? }`. `src/api/errors.ts` (`getApiErrorMessage`) already turns them into Arabic messages; `details` holds per-field messages for forms.

## 2. Already in the app

| Screen | Uses |
|--------|------|
| Courses tab, `course/[slug]` | Catalog, program detail with `myEnrollment` / `canAccessContent`, lesson ticks |
| `enrollments/[programId]` | Apply (multipart with receipt) |
| Assignments tab, `assignment/[assignmentId]` | List, detail, hand-in form and submission history |
| `lesson/[nodeId]` | Video (position reporting and resume), reading (mark done), completion card |
| `quiz/[quizId]`, `quiz/attempt/[attemptId]` | Taking a quiz and its result |
| Home | Program progress from `my-enrollments` (overview cards still partly mocked) |
| Notifications tab | List, unread badge, mark read / all read, navigation from `actionUrl` |
| Session | Login with refresh tokens kept in secure storage |

## 3. Left to build

### 3.1 Still mocked

Parts of the home screen use fixtures until the backend offers a learner overview endpoint (`/v1/dashboard/me`).

### 3.2 Waiting for backend features

| Feature | Needs |
|---------|-------|
| Push notifications | Expo push tokens endpoint and sending on the backend |
| Deadline reminders | A scheduled job on the backend |
| Certificates, my startup | Those domains on the backend |

### 3.3 Small improvements

- Lint: 18 findings from the React Hooks rules in older screens (`useRef(new Animated.Value()).current`, …); CI reports them without failing. Fix, then make lint blocking in `.github/workflows/ci.yml`.
- On `429` (too many login attempts) show the wait time from `retryAfterSec`.

## 4. Rules worth knowing (what the API will refuse)

| Situation | Response |
|-----------|----------|
| Program not open for applications | `409 ENROLLMENT_CLOSED` (`canEnroll` false in the catalog tells you before) |
| No seat left | `409 PROGRAM_FULL` |
| Applying twice | `409 ALREADY_ENROLLED` (allowed again after `REJECTED` / `DROPPED`) |
| Opening content before acceptance | Lessons come back `isLocked: true`; `GET /v1/nodes/...`, `/v1/quizzes/...` and assignment calls return `404` |
| Handing in while waiting for review / after grading or rejection | `409 SUBMISSION_LOCKED` |
| Quiz attempts used up | `409 MAX_ATTEMPTS_REACHED` |
| Upload too big / wrong type / too many | `413` / `415` / `429` |
| Expired or revoked session | `401` → refresh once, else sign out |

## 5. Setup

- `EXPO_PUBLIC_API_URL` → the backend (default `http://192.168.137.1:5000`). The backend's `PUBLIC_API_URL` must use a host the phone can reach, or file links will not open.
- After a backend contract change, re-copy `src/types/*.contract.ts` into the app's `src/types/`.
