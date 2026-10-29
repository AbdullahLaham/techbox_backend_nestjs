# TechBox API contract: Expo mobile app (learner)

Every endpoint the learner app uses: sign-in, the program catalog, enrollment, assignments and their submissions, lessons (video, reading, quiz) and quizzes.

The dashboard (admin and web learner pages) has its own contract: `api-contract-admin.md`.

## 0. Type files

The exact TypeScript types live in the backend under `src/types/` and are copied unchanged into the app's `src/types/` (do not edit the copies; re-copy after a backend change):

| File | Covers |
|------|--------|
| `api.contract.ts` | Programs, enrollments, error codes and Arabic messages, labels |
| `assignments.contract.ts` | Assignment list and detail |
| `submissions.contract.ts` | Handing in assignments, results |
| `nodes.contract.ts` | Lessons and quizzes |

## 1. Conventions

| | |
|---|---|
| Base URL | `EXPO_PUBLIC_API_URL` (dev default `http://192.168.137.1:5000`) |
| Auth | `Authorization: Bearer <accessToken>` (section 2) |
| Body | JSON unless the endpoint says multipart |
| Dates | ISO 8601 UTC strings; show them in the device timezone |
| Numbers | Scores, points and percentages are numbers (up to 2 decimals) |
| IDs | UUID strings |
| Caching | Responses carry `Cache-Control: private, max-age=0`; do not cache them on the device |
| Signed links | File URLs (`url` on files and receipts) are valid about 1 hour. Never store them; refetch the screen's data if opening one fails with `403` |
| Old paths | `/programs`, `/enrollments` and `/assignments/...` without `/v1` still answer for installed app versions; new code uses `/v1` |

### Errors

Every `/v1` route answers errors as:

```json
{ "statusCode": 409, "code": "PROGRAM_FULL", "message": "No seats left in this program.", "details": { "field": "رسالة" } }
```

- Show `API_ERROR_MESSAGES_AR[code]` (`api.contract.ts`); `message` is English and for logs.
- `details` (field → Arabic message) is only sent with `VALIDATION_FAILED`; nested fields use dots (`answers.0.optionId`). Show each message next to its field.
- `401 UNAUTHORIZED`: the access token expired or the account is suspended → refresh once (section 2), else sign out.
- `404 NOT_FOUND` also means "you may not see this" (not enrolled, enrollment not accepted, draft content). Show "غير متاح" and go back.
- Auth routes (`/auth/*`) still use Nest's default shape: `{ statusCode, message: string | string[], error }`.

| HTTP | `code` | Typical cause in the app |
|------|--------|--------------------------|
| 400 | `VALIDATION_FAILED` | A form field is wrong |
| 401 | `UNAUTHORIZED` | Session expired |
| 403 | `FORBIDDEN` | Not allowed (rare in the learner app) |
| 404 | `NOT_FOUND` | Missing, or not visible to this user |
| 409 | `ENROLLMENT_CLOSED`, `PROGRAM_FULL`, `ALREADY_ENROLLED` | Applying to a program |
| 409 | `SUBMISSION_LOCKED` | Handing in while the last submission is awaiting review, graded or rejected |
| 409 | `MAX_ATTEMPTS_REACHED` | No quiz attempts left |
| 413 | `FILE_TOO_LARGE` | Upload over the limit |
| 415 | `UNSUPPORTED_FILE_TYPE` | Wrong file type, or the content does not match the extension |
| 429 | `TOO_MANY_REQUESTS` | More than 20 uploads per minute |

---

## 2. Authentication

| Method | Path | Body | Response |
|--------|------|------|----------|
| POST | `/auth/register` | `{ email, password (≥ 8), firstName, lastName, bio? }` | `201 { message, user: { id, email, globalRole, createdAt } }` |
| POST | `/auth/login` | `{ email, password }` | `200 { accessToken, refreshToken, user: { id, email, globalRole, firstName, lastName, role } }` |
| POST | `/auth/refresh` | `{ refreshToken }` | `200 { accessToken, refreshToken }` |
| POST | `/auth/logout` | `{ refreshToken }` | `204` |
| GET | `/auth/me` | Bearer | `200 { id, email, globalRole, firstName, lastName }` |

- Store both tokens in SecureStore. The refresh token is **single use**: every refresh returns a new pair; replace both.
- On `401` from any API call, call `/auth/refresh` once; if that fails too, sign out.
- Suspended or archived accounts get `401` everywhere, including login.

---

## 3. Programs

### 3.1 `GET /v1/programs`: catalog

Published and ongoing programs, newest first. No auth needed. Response `ProgramSummary[]`:

```json
[
  {
    "id": "a91c…",
    "title": "تطوير التطبيقات بـ React Native",
    "slug": "react-native",
    "description": "…",
    "type": "BOOTCAMP",
    "status": "ONGOING",
    "coverImage": "https://…",
    "startDate": "2026-11-01T00:00:00.000Z",
    "endDate": null,
    "isEnrollmentOpen": true,
    "seats": { "max": 30, "taken": 12, "remaining": 18 },
    "canEnroll": true,
    "enrollmentBlockReason": null,
    "createdAt": "…",
    "updatedAt": "…",
    "_count": { "tracks": 3, "enrollments": 10 }
  }
]
```

- `seats.max` / `seats.remaining` are `null` for unlimited seats.
- `canEnroll` false → `enrollmentBlockReason`: `NOT_AVAILABLE` | `CLOSED` | `ENDED` | `FULL`.
- `_count.enrollments` = accepted learners (ACTIVE + COMPLETED).

### 3.2 `GET /v1/programs/:slug`: detail and curriculum

Send the Bearer token when signed in (optional): it adds the learner's own enrollment and unlocks the content. Draft and archived programs give `404`.

Response `ProgramDetail` = the summary above plus:

```json
{
  "myEnrollment": {
    "id": "e1…",
    "status": "ACTIVE",
    "reviewNote": "أهلاً بك",
    "reviewedAt": "…",
    "hasReceipt": true,
    "progressPct": 0,
    "createdAt": "…"
  },
  "enrollments": [ "…same object as myEnrollment (deprecated)…" ],
  "canAccessContent": true,
  "tracks": [
    {
      "id": "t1…", "programId": "a91c…", "title": "المسار الأول", "description": null, "orderIndex": 0,
      "modules": [
        {
          "id": "m1…", "trackId": "t1…", "title": "الوحدة 1", "description": null, "orderIndex": 0,
          "nodes": [
            {
              "id": "n1…", "moduleId": "m1…", "title": "مقدمة", "description": null,
              "type": "VIDEO_LECTURE", "orderIndex": 0, "isMandatory": true, "isLocked": false,
              "video": { "durationSec": 600, "playbackUrl": "https://iframe.mediadelivery.net/embed/…" },
              "assignment": null
            },
            {
              "id": "n2…", "type": "ASSIGNMENT", "isLocked": false, "video": null,
              "assignment": { "id": "as1…", "allowedType": "FILE_UPLOAD", "maxScore": 100, "dueDate": "…", "instructions": "…" }
            }
          ]
        }
      ]
    }
  ]
}
```

- `myEnrollment` is only the caller's own (null when anonymous or never applied). Use it, not `enrollments`.
- `canAccessContent` is true for ACTIVE or COMPLETED enrollments. Until then every lesson has `isLocked: true`, `video.playbackUrl: null` and `assignment.instructions: null`.
- Only published assignments and published quizzes appear in the curriculum.
- Open a lesson by type:

| `type` | Open with |
|--------|-----------|
| `ASSIGNMENT` | `GET /v1/assignments/:assignment.id` (section 5) |
| `VIDEO_LECTURE`, `READING_MATERIAL`, `QUIZ` | `GET /v1/nodes/:id` (section 7) |

### Enrollment status in the UI

| `myEnrollment.status` | Show |
|-----------------------|------|
| none | "سجّل الآن" when `canEnroll`, else the block reason |
| `PENDING` | "طلبك قيد المراجعة" |
| `ACTIVE` | Content open |
| `COMPLETED` | Content open, "أتممت البرنامج" |
| `SUSPENDED` | "تم إيقاف وصولك مؤقتاً" + `reviewNote` |
| `REJECTED` / `DROPPED` | `reviewNote`, and "إعادة التقديم" when `canEnroll` (`canApply()` in the contract) |

---

## 4. Enrollments

### 4.1 `POST /v1/enrollments/:programId`: apply

`multipart/form-data`:

| Field | Rules |
|-------|-------|
| `fullNameAr`, `fullNameEn` | Required, ≤ 150 |
| `age` | Integer 10 to 100 |
| `phoneWhatsApp` | Required, ≤ 30 |
| `nationalId` | Required, ≤ 30 |
| `governorate` | Required, ≤ 100 |
| `receipt` (file) | Optional payment receipt: jpg, jpeg, png, webp or pdf, ≤ 10 MB |

Response `201` (`MyEnrollment`): `MyEnrollmentRef` (above) plus `program: { id, title, slug, type, status, coverImage, startDate, endDate }`, status `PENDING`.

- A REJECTED or DROPPED student can apply again; the same enrollment goes back to `PENDING` (new receipt optional).
- Errors: `404` (program missing or draft), `409 ENROLLMENT_CLOSED` | `PROGRAM_FULL` | `ALREADY_ENROLLED`, `413`, `415`, `400`.

### 4.2 `GET /v1/enrollments/my-enrollments`

Response `MyEnrollment[]`, newest first: the learner's own applications only.

---

## 5. Assignments

### 5.1 `GET /v1/assignments`: my assignments

Published assignments of programs where the learner is ACTIVE or COMPLETED. Response `{ items: AssignmentItem[] }`:

```json
{
  "items": [
    {
      "id": "as1…",
      "title": "بناء واجهة تسجيل الدخول",
      "allowedType": "URL_LINK",
      "maxScore": 100,
      "dueDate": "2026-11-05T20:59:00.000Z",
      "createdAt": "…",
      "publishedAt": "2026-10-21T09:00:00.000Z",
      "isNew": true,
      "isOverdue": false,
      "program": { "id": "a91c…", "title": "…", "slug": "react-native" },
      "submission": null
    }
  ]
}
```

- `submission` = the latest attempt: `{ id, status, submittedAt, score, feedback, attemptsCount }`, or null.
- `isNew`: no submission and published within 3 days. `isOverdue`: past `dueDate` and not submitted (or revision requested).
- Tabs and states: use `getAssignmentState()` / `getAssignmentBucket()` from `assignments.contract.ts` (TODO, SUBMITTED, DONE).

### 5.2 `GET /v1/assignments/:id`: detail

The list item plus `instructions` (plain text; keep line breaks) and `attachments: [{ id, fileName, mimeType, sizeBytes, url }]` (signed links). `404` when not visible.

---

## 6. Handing in assignments

What the hand-in must contain depends on the assignment's `allowedType` (`SUBMISSION_RULES` in `submissions.contract.ts`):

| `allowedType` | Must send | Also allowed |
|---------------|-----------|--------------|
| `FILE_UPLOAD` | 1 to 5 `files` | `text` (note) |
| `URL_LINK` | exactly 1 `links` entry | `text` (note) |
| `TEXT_CONTENT` | `text` (the answer) | nothing else |
| `MULTIMEDIA` | at least one link or file (up to 5 links and 5 files) | `text` (note) |

Files: pdf, doc, docx, png, jpg/jpeg, webp; ≤ 20 MB each; the real file type is checked. Links: `http`/`https` only, ≤ 2000 characters. Text: ≤ 20,000 characters.

When a learner may hand in:

| Latest submission | Can hand in? |
|-------------------|--------------|
| none | yes |
| `NEEDS_REVISION` | yes, as a new attempt |
| `SUBMITTED`, `UNDER_REVIEW` | no (`AWAITING_REVIEW`) |
| `GRADED` | no (`GRADED`) |
| `REJECTED` | no (`REJECTED`) |

Late hand-ins (after `dueDate`) are accepted and marked `isLate: true`.

### 6.1 `POST /v1/assignments/:assignmentId/submit`

**JSON** (URL_LINK, TEXT_CONTENT, MULTIMEDIA links only), `Content-Type: application/json`:

```json
{ "links": ["https://github.com/sara/login-screen"], "text": "رابط المستودع مع ملف README" }
```

```json
{ "text": "إجابتي على السؤال…" }
```

**Multipart** (anything with files), `Content-Type: multipart/form-data`:

| Part | Value |
|------|-------|
| `files` | A file; repeat the part for each file (max 5) |
| `text` | Optional note (answer for TEXT_CONTENT) |
| `links` | Optional; repeat the part for each link |

```ts
const form = new FormData();
form.append('text', 'الحل مرفق');
for (const f of picked) form.append('files', { uri: f.uri, name: f.name, type: f.mimeType } as any);
await apiClient.post(SUBMISSIONS_ENDPOINTS.submit(assignmentId), form, {
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 0, // large files on slow connections
});
```

Response `201` (`SubmissionView`):

```json
{
  "id": "s1…",
  "assignmentId": "as1…",
  "attemptNumber": 1,
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
    "files": [
      { "id": "f1…", "fileName": "الحل.pdf", "mimeType": "application/pdf", "sizeBytes": 245123, "url": "https://…/v1/files/download?…" }
    ]
  }
}
```

Errors: `400 VALIDATION_FAILED` (`details.files`, `details.links` or `details.text` when the hand-in does not match the type), `404`, `409 SUBMISSION_LOCKED`, `413`, `415`, `429`.

### 6.2 `GET /v1/assignments/:assignmentId/my-submission`

Response `200` (`MySubmissionResponse`):

```json
{
  "assignmentId": "as1…",
  "allowedType": "FILE_UPLOAD",
  "maxScore": 100,
  "dueDate": "2026-11-05T20:59:00.000Z",
  "latest": { "…SubmissionView…": "" },
  "attempts": [ "…SubmissionView, newest first…" ],
  "canSubmit": false,
  "submitBlockReason": "AWAITING_REVIEW"
}
```

- `latest` is `null` before the first hand-in. `status` + `score` + `feedback` drive the result card.
- Show the submit button only when `canSubmit`; otherwise explain `submitBlockReason`.
- After a hand-in, refetch this and `GET /v1/assignments`.

---

## 7. Lessons (video, reading, quiz)

### `GET /v1/nodes/:nodeId`

For learners with an ACTIVE or COMPLETED enrollment in the lesson's program; others get `404`. Response `NodeContent`:

```json
{
  "id": "n3…",
  "moduleId": "m1…",
  "program": { "id": "a91c…", "title": "React Native", "slug": "react-native" },
  "type": "READING_MATERIAL",
  "title": "دليل الإعداد",
  "description": null,
  "isMandatory": true,
  "isCompleted": false,
  "video": null,
  "resource": { "kind": "FILE", "url": "https://…", "fileName": "الدرس الأول.pdf", "mimeType": "application/pdf", "sizeBytes": 245123 },
  "quiz": null
}
```

| `type` | Field to use |
|--------|--------------|
| `VIDEO_LECTURE` | `video: { playbackUrl, durationSec }` |
| `READING_MATERIAL` | `resource`: `kind` `LINK` (external page) or `FILE` (signed download) |
| `QUIZ` | `quiz` summary (null when not published), then section 8 |

`isCompleted`: the learner finished the lesson (for quizzes: passed once). `progress: { isCompleted, completionPct, lastPositionSec, watchedSeconds }`: resume a video from `lastPositionSec`.

### `POST /v1/nodes/:nodeId/progress`: report progress

Video and reading lessons only (quizzes complete by passing, assignments by being graded; others `400`).

| Body | When |
|------|------|
| `{ "positionSec": 312 }` | Video: about every 15 s, on pause and when leaving. Completes at 90% of the duration |
| `{ "completed": true }` | Reading (the "تم الانتهاء" button), or a video the player cannot track |

Response `200` (`LessonProgressResult`): `{ nodeId, isCompleted, completionPct, lastPositionSec, watchedSeconds, recorded, programProgress: { completedLessons, totalLessons, percent } }`. Completion is never undone.

Program progress = completed / counted lessons (mandatory lessons, quizzes and assignments once published). It appears as `myEnrollment.progressPct`, `completedLessons`, `totalLessons` (program screen, `my-enrollments`), and each curriculum lesson has `isCompleted`.

---

## 8. Quizzes

### 8.1 Quiz summary (inside `NodeContent.quiz`)

```json
{
  "id": "q1…", "title": "اختبار الوحدة الأولى", "description": null,
  "questionCount": 10, "totalScore": 20, "passingScore": 12,
  "maxAttempts": 3, "attemptsUsed": 1, "attemptsRemaining": 2,
  "bestScore": 10, "passed": false, "lastAttemptId": "at1…"
}
```

`maxAttempts` / `attemptsRemaining` are `null` when unlimited.

### 8.2 `GET /v1/quizzes/:quizId`: questions without answers

The summary plus `nodeId` and `questions`:

```json
{
  "questions": [
    {
      "id": "qq1…", "text": "ما الأمر الذي ينشئ مشروع Expo جديداً؟", "points": 2, "orderIndex": 0,
      "options": [
        { "id": "o1…", "text": "npx create-expo-app" },
        { "id": "o2…", "text": "npm init expo" },
        { "id": "o3…", "text": "expo new" },
        { "id": "o4…", "text": "npx react-native init" }
      ]
    }
  ]
}
```

Every question has exactly 4 options and **no correctness information**. Unpublished quizzes give `404`.

### 8.3 `POST /v1/quizzes/:quizId/attempts`: submit

```json
{ "answers": [{ "questionId": "qq1…", "optionId": "o1…" }, { "questionId": "qq2…", "optionId": null }] }
```

One entry per question; unanswered may be `null` or left out (scores 0). Response `201` (`QuizAttemptResult`):

```json
{
  "id": "at1…", "quizId": "q1…", "nodeId": "n4…",
  "score": 2, "totalScore": 5, "passingScore": 3, "percentage": 40, "passed": false,
  "correctCount": 1, "questionCount": 2, "attemptNumber": 1, "attemptsRemaining": 1,
  "showCorrectAnswers": true, "submittedAt": "…",
  "questions": [
    {
      "questionId": "qq1…", "text": "…", "points": 2, "pointsAwarded": 2,
      "selectedOptionId": "o1…", "isCorrect": true, "correctOptionId": "o1…",
      "explanation": "…", "options": [{ "id": "o1…", "text": "…" }]
    }
  ]
}
```

- A question earns its full points only when the selected option is the correct one. `passed` = `score >= passingScore`. Passing completes the lesson.
- When `showCorrectAnswers` is false, `correctOptionId` and `explanation` are null.
- Errors: `400` (unknown question or option, question answered twice), `404`, `409 MAX_ATTEMPTS_REACHED`.

### 8.4 History and results

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/quizzes/:quizId/attempts` | `MyQuizAttempt[]` newest first: `{ id, attemptNumber, score, totalScore, passingScore, percentage, passed, submittedAt }` |
| GET | `/v1/quizzes/attempts/:attemptId` | `QuizAttemptResult` (own attempts only; the grading as recorded at submission) |

---

## 9. Notifications

The signed-in user's own in-app notifications (`AppNotification`: `id, type, title, message, isRead, actionUrl, createdAt`).

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/notifications?page=&pageSize=&unreadOnly=` | `{ items, page, pageSize, total, unreadCount }`, newest first, `pageSize` ≤ 50 |
| GET | `/v1/notifications/unread-count` | `{ unreadCount }` for the tab badge |
| PATCH | `/v1/notifications/:id/read` | The notification (`404` if not yours) |
| POST | `/v1/notifications/read-all` | `{ updated, unreadCount: 0 }` |

| `type` | Sent when |
|--------|-----------|
| `NEW_ASSIGNMENT` | An assignment was published in one of your programs (ACTIVE enrollments) |
| `ENROLLMENT` | An admin accepted, rejected, suspended, completed or removed your enrollment (message includes the admin's note) |
| `GRADED` | A hand-in was graded, sent back for revision, or rejected |

`actionUrl` → screen: `/assignments/<id>` → `assignment/[assignmentId]`; `/programs/<slug>` → `course/[slug]`; `null` → nothing to open.

## 10. Screen map

| Screen | Calls |
|--------|-------|
| Sign in / session | `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/logout` |
| Catalog | `GET /v1/programs` |
| Program | `GET /v1/programs/:slug` (with token) |
| Apply | `POST /v1/enrollments/:programId` (multipart) |
| My programs | `GET /v1/enrollments/my-enrollments` |
| Assignments tab | `GET /v1/assignments` |
| Assignment | `GET /v1/assignments/:id`, `GET /v1/assignments/:id/my-submission`, `POST /v1/assignments/:id/submit` |
| Lesson | `GET /v1/nodes/:nodeId` |
| Quiz | `GET /v1/quizzes/:quizId`, `POST /v1/quizzes/:quizId/attempts` |
| Quiz result / history | `GET /v1/quizzes/attempts/:attemptId`, `GET /v1/quizzes/:quizId/attempts` |
| Video / reading progress | `POST /v1/nodes/:nodeId/progress` |
| Notifications tab | `GET /v1/notifications`, `GET /v1/notifications/unread-count`, `PATCH /v1/notifications/:id/read`, `POST /v1/notifications/read-all` |
