# What was built: guide for the Expo mobile app

Short guide for the `teckbox_lms_app` team: what the backend now offers learners, what the app already uses, and what is left to build. Full endpoint and payload details: **`api-contract-mobile.md`**. Types: `src/types/*.contract.ts` (copied from the backend's `src/types/`; re-copy, never edit).

Status: 2026-10-28. Backend: 44 end-to-end tests passing.

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
| Courses tab, `course/[slug]` | Catalog, program detail with `myEnrollment` / `canAccessContent` |
| `enrollments/[programId]` | Apply (multipart with receipt) |
| Assignments tab, `assignment/[assignmentId]` | List and detail (read-only) |
| `lesson/[nodeId]` | Lesson content |
| `quiz/[quizId]`, `quiz/attempt/[attemptId]` | Taking a quiz and its result |

## 3. Left to build

### 3.1 Hand-in on the assignment screen (`assignment/[assignmentId]`)

| Step | Call |
|------|------|
| Load state | `GET /v1/assignments/:id/my-submission` → `latest`, `attempts`, `canSubmit`, `submitBlockReason`, `allowedType`, `maxScore`, `dueDate` |
| Submit | `POST /v1/assignments/:id/submit` (`SUBMISSIONS_ENDPOINTS.submit(id)`) |
| Afterwards | Refetch `my-submission` and the assignments list |

What to show per `allowedType` (`SUBMISSION_RULES` in `submissions.contract.ts`):

| `allowedType` | Inputs | Send as |
|---------------|--------|---------|
| `FILE_UPLOAD` | 1–5 files: pdf, doc, docx, png, jpg, webp; ≤ 20 MB each (document picker + image picker) + optional note | multipart: `files` repeated, `text` |
| `URL_LINK` | 1 link (http/https) + optional note | JSON `{ "links": ["…"], "text": "…" }` |
| `TEXT_CONTENT` | Text answer, up to 20,000 characters | JSON `{ "text": "…" }` |
| `MULTIMEDIA` | Up to 5 links and/or up to 5 files, at least one + optional note | JSON, or multipart if there are files (`links` repeated) |

Multipart from Expo:

```ts
const form = new FormData();
if (note) form.append('text', note);
links.forEach((l) => form.append('links', l));
files.forEach((f) => form.append('files', { uri: f.uri, name: f.name, type: f.mimeType } as any));
await apiClient.post(SUBMISSIONS_ENDPOINTS.submit(id), form, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 0,
});
```

Screen states:

| `my-submission` | Show |
|-----------------|------|
| `latest: null`, `canSubmit: true` | The hand-in form |
| `latest.status` SUBMITTED / UNDER_REVIEW | "تم التسليم، بانتظار المراجعة" + what was handed in (`content`) |
| `latest.status` NEEDS_REVISION | Grader `feedback` + the form again (next attempt) |
| `latest.status` GRADED | `score` / `maxScore` + `feedback` |
| `latest.status` REJECTED | `feedback`; no form |
| `latest.isLate` | A "متأخر" badge |
| `attempts.length > 1` | An attempt history (newest first) |

Errors to handle: `409 SUBMISSION_LOCKED` (refetch `my-submission`), `400` with `details.files` / `details.links` / `details.text`, `413` (file too large), `415` (wrong file type), `404` (no longer available: go back and refetch the list).

Files in `content.files[].url` are signed links valid about 1 hour: open them with `Linking.openURL` or `expo-web-browser`, never store them, and refetch if opening fails with `403`.

### 3.2 Notifications tab

Grading (graded, revision requested, rejected) now creates in-app notifications for the student in the database, but the backend has **no endpoint to read them yet**. The tab needs `GET /v1/notifications` (and a "mark as read" call) on the backend first.

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
