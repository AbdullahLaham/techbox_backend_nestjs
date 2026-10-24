# Assignments Feature Specification

Dashboard CRUD (Next.js) + student client (Expo mobile app) + backend (NestJS, Prisma, PostgreSQL)

| | |
|---|---|
| Status | Ready for implementation |
| Date | 2026-10-24 |
| Replaces | `ASSIGNMENTS_CRUD_SPEC.md`, `ASSIGNMENTS_API_SPEC.md` and the two contract files: all of it is in this one file |
| Self-contained | Yes. The TypeScript contracts are included in sections 17 and 18. The only outside input is the project's own `schema.prisma`. |

## Contents

1. [How to use this file](#1-how-to-use-this-file)
2. [Overview](#2-overview)
3. [Data model and migration](#3-data-model-and-migration)
4. [Business rules](#4-business-rules)
5. [API overview and error model](#5-api-overview-and-error-model)
6. [Admin API (dashboard)](#6-admin-api-dashboard)
7. [Instruction files (attachments and storage)](#7-instruction-files-attachments-and-storage)
8. [Student API (mobile)](#8-student-api-mobile)
9. [Dashboard client (Next.js)](#9-dashboard-client-nextjs)
10. [Mobile client (Expo)](#10-mobile-client-expo)
11. [Shared contracts](#11-shared-contracts)
12. [Non-functional requirements](#12-non-functional-requirements)
13. [Acceptance tests](#13-acceptance-tests)
14. [Rollout order](#14-rollout-order)
15. [Assumptions and open decisions](#15-assumptions-and-open-decisions)
16. [Appendix: example payloads](#16-appendix-example-payloads)
17. [Contract file: student types](#17-contract-file-student-types)
18. [Contract file: admin types](#18-contract-file-admin-types)

---

## 1. How to use this file

- **Save it in the project** (for example `docs/ASSIGNMENTS_SPEC.md`) and point the assistant at the path. Do not paste it into a terminal; long pastes get cut off.
- **Backend (NestJS):** implement sections 3 to 8, then check the work against section 13.
- **Dashboard (Next.js):** implement section 9 against the admin API in section 6.
- **Mobile (Expo):** implement section 10 against the student API in section 8.
- The TypeScript contracts are included at the end of this file (sections 17 and 18). Copy each code block into the file named in its heading. Do not change them without telling the project owner.
- Import Prisma enums from `@prisma/client` (`AssignmentStatus`, `NodeType`, `EnrollmentStatus`, `ProgramStatus`) instead of using string literals.

Suggested order of work: migration (3.3), admin API (6, 7), student API (8), dashboard (9), mobile (10).

---

## 2. Overview

### 2.1 Goal

An admin creates and manages assignments in the Next.js dashboard. Enrolled students see the published ones in the mobile app, together with the instruction text and any files the admin attached. Students can tell which assignments are new, not submitted, submitted, or completed.

### 2.2 Actors and flow

```
Admin (Next.js dashboard) ──► /v1/admin/assignments/**  ──┐
                                                          ├──► NestJS ──► PostgreSQL (Prisma)
Student (Expo app)        ──► /v1/assignments/**        ──┤              └─► Private file storage
                                                          │
                          instruction files: upload (admin) / signed download (student)
```

### 2.3 Scope

In scope:
- Admin: create, list, view, update, delete, publish, unpublish, archive and restore assignments.
- Admin: upload and delete instruction files.
- Student: list assignments (with new / not submitted / submitted / completed), open an assignment's detail, open its files.
- The schema migration these features need.

Out of scope (separate specs):
- Student submissions (`POST /v1/assignments/:id/submissions`) and the submission form.
- Reviewing and grading submissions in the dashboard.
- Attempt history on the detail screen.
- Push notification when an assignment is published (`NotificationType` has no "new assignment" value; `ANNOUNCEMENT` is the closest).

### 2.4 Key concepts

| Term | Meaning |
|------|---------|
| Assignment | Two rows created and deleted together: an `ActivityNode` (type `ASSIGNMENT`) and an `Assignment`. The API identifies it by `Assignment.id`, never the node id. |
| Status | Admin-controlled visibility: `DRAFT`, `PUBLISHED`, `ARCHIVED`. Only `PUBLISHED` is visible to students. |
| State | What the student's card shows, derived from the latest submission (`NOT_SUBMITTED`, `AWAITING_REVIEW`, `NEEDS_REVISION`, `GRADED`, `REJECTED`). |
| Bucket | Which student tab it belongs to (`TODO`, `SUBMITTED`, `DONE`), derived from the state. |
| Attachment | A file the admin attached to the instructions. |

---

## 3. Data model and migration

### 3.1 Structure

```
ActivityNode (type = ASSIGNMENT, title, orderIndex, isMandatory, moduleId)
  └─ Assignment (instructions, allowedType, maxScore, dueDate, status, publishedAt)
       ├─ AssignmentAttachment[]   (new)
       └─ Submission[]             (students' attempts)
```

The module decides the program, and the program's enrollments decide which students see the assignment:
`Assignment.node -> module -> track -> program -> enrollments`.

### 3.2 Schema changes

```prisma
enum AssignmentStatus {
  DRAFT      // hidden from students
  PUBLISHED  // visible to enrolled students
  ARCHIVED   // hidden from students, data kept
}

model Assignment {
  id           String                 @id @default(uuid())
  nodeId       String                 @unique
  instructions String
  allowedType  SubmissionType         @default(URL_LINK)
  maxScore     Decimal                @default(100.00) @db.Decimal(5, 2)
  dueDate      DateTime?
  status       AssignmentStatus       @default(DRAFT)   // new
  publishedAt  DateTime?                                // new: set on first publish, drives "new"
  createdAt    DateTime               @default(now())
  updatedAt    DateTime               @updatedAt
  node         ActivityNode           @relation(fields: [nodeId], references: [id], onDelete: Cascade)
  submissions  Submission[]
  attachments  AssignmentAttachment[]                   // new

  @@index([status])
}

model AssignmentAttachment {
  id           String     @id @default(uuid())
  assignmentId String
  storageKey   String     @unique   // path inside the storage provider, never a URL
  fileName     String                // original name, sanitized, for display and download
  mimeType     String
  sizeBytes    Int
  createdAt    DateTime   @default(now())
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@index([assignmentId])
}
```

Why a table and not one `fileUrl` column:
- It supports several files (a PDF plus a dataset) without another migration. Set `ATTACHMENT_LIMITS.maxCount = 1` for exactly one file.
- It stores the key, not a URL, so the storage provider or CDN can change and downloads can be signed.

`instructions` stays a plain-text column (max 10,000 characters). The mobile app renders it as text; the attached files carry anything richer.

### 3.3 Migration and mandatory backfill

The new `status` defaults to `DRAFT`, which would hide every existing assignment from students. Generate the migration with `prisma migrate dev --create-only`, then add this to the generated SQL after the `ALTER TABLE` statements:

```sql
UPDATE "Assignment" SET "status" = 'PUBLISHED', "publishedAt" = "createdAt";
```

### 3.4 Compatibility with the current schema

Everything the endpoints read exists in the current schema under these names. Only the changes in 3.2 are needed.

| Used by this spec | Schema |
|-------------------|--------|
| `Assignment.id, allowedType, maxScore (Decimal 5,2), dueDate (nullable), createdAt` | `Assignment` |
| One assignment per node | `Assignment.nodeId @unique` |
| Title, order, mandatory flag | `ActivityNode.title`, `orderIndex`, `isMandatory` |
| Path to the program | `ActivityNode.module`, `Module.track`, `Track.program` |
| Enrollment filter | `Program.enrollments` (`Enrollment.userId`, `Enrollment.status`) |
| Student's submissions | `Assignment.submissions` (`Submission.studentId`, `status`, `score`, `feedback`, `createdAt`) |
| Indexes already covering the queries | `Submission(assignmentId, studentId)`, `Enrollment(userId, programId)` unique, `Enrollment(userId)`, `Track(programId, orderIndex)`, `Module(trackId, orderIndex)` |

Notes:
- Student queries do not filter on `ActivityNode.type`. An `Assignment` row only exists for assignment nodes, and the schema does not force `type = ASSIGNMENT`, so filtering could hide valid rows.
- `Submission.payload` (Json) is never returned by any assignment endpoint.

---

## 4. Business rules

### 4.1 Status lifecycle

| From | To | Rule |
|------|----|------|
| DRAFT | PUBLISHED | Sets `publishedAt = now` if it is null. |
| PUBLISHED | DRAFT | Refused with `409 ASSIGNMENT_HAS_SUBMISSIONS` if any submission exists. Sets `publishedAt = null`, so a later publish counts as new again. |
| PUBLISHED | ARCHIVED | Always allowed. Submissions are kept. |
| ARCHIVED | PUBLISHED | Allowed. `publishedAt` is kept (it does not become "new" again). |

Any other change returns `409 INVALID_STATUS_TRANSITION`. The table is exported as `ASSIGNMENT_STATUS_TRANSITIONS`. New assignments are always created as `DRAFT`.

### 4.2 What a student sees

An assignment is visible to a student only when all of these hold:

1. `Assignment.status = PUBLISHED`.
2. The program status is `PUBLISHED`, `ONGOING` or `COMPLETED` (`DRAFT` and `ARCHIVED` programs are excluded; see D1 in section 15).
3. The student has an `Enrollment` in that program with status `ACTIVE` or `COMPLETED` (`PENDING`, `DROPPED` and `SUSPENDED` are excluded).

Archived assignments disappear from the student app, including graded history (decision V1).

### 4.3 Flags computed by the server (student API)

Let `now` be the current time and `state` be `getAssignmentState(item)` from the contract.

- **`isNew`** = `submission === null` and `publishedAt >= now - NEW_WINDOW_DAYS days` (`NEW_WINDOW_DAYS = 3`, exported by the contract).
- **`isOverdue`** = `dueDate !== null` and `dueDate < now` and `state` is `NOT_SUBMITTED` or `NEEDS_REVISION`. Submitted, graded and rejected work is never overdue.

### 4.4 State and tabs (derived by the client)

The server only returns facts. The client derives these with `getAssignmentState` and `getAssignmentBucket` from `assignments.contract.ts`. Do not reimplement them on the server.

| Latest submission | State | Bucket (tab) |
|-------------------|-------|--------------|
| none | `NOT_SUBMITTED` | `TODO` (لم تُسلَّم) |
| `NEEDS_REVISION` | `NEEDS_REVISION` | `TODO` (لم تُسلَّم) |
| `SUBMITTED` or `UNDER_REVIEW` | `AWAITING_REVIEW` | `SUBMITTED` (تم التسليم) |
| `GRADED` | `GRADED` | `DONE` (مكتملة) |
| `REJECTED` | `REJECTED` | `DONE` (مكتملة) |

The "جديدة" tab is `isNew` and overlaps with "لم تُسلَّم". "Latest submission" means the newest `Submission` row of that student for the assignment.

### 4.5 Permissions

All `/v1/admin/**` routes require a Bearer JWT and a role in `ASSIGNMENT_MANAGER_ROLES`.

| Constant | Default |
|----------|---------|
| `ASSIGNMENT_MANAGER_ROLES` | `SUPER_ADMIN`, `INCUBATOR_MANAGER` |

- `INSTRUCTOR` and `MENTOR` are excluded by default: the schema has no link between a staff member and a program, so an instructor could edit every program's assignments. Add them once a program-staff relation exists, or accept global scope on purpose (decision R1).
- Users with status `SUSPENDED` or `ARCHIVED` get `401` on every route.
- Wrong role on an admin route: `403 FORBIDDEN`.
- Student routes (`/v1/assignments/**`) accept any authenticated user, filtered by enrollment (4.2).
- CORS: allow the dashboard origin on `/v1/admin/**`.

### 4.6 Data integrity rules

| Rule | Where it applies |
|------|------------------|
| Create or update writes the node and the assignment in one nested write (one transaction). | 6.1, 6.4 |
| Delete only when the assignment has zero submissions, and delete the `ActivityNode` (not just the `Assignment`). | 6.6 |
| `allowedType` cannot change once any submission exists. | 6.4 |
| `maxScore` cannot drop below the highest existing `Submission.score`. | 6.4 |
| An assignment cannot be moved to another module in v1. | 6.4 |
| Every attempt is a new `Submission` row; a resubmission never overwrites an existing row (A1). | 8, 15 |

---

## 5. API overview and error model

### 5.1 Endpoints

| # | Consumer | Method | Path | Purpose | Success |
|---|----------|--------|------|---------|---------|
| A1 | Dashboard | POST | `/v1/admin/assignments` | Create (always `DRAFT`) | 201 `AdminAssignmentDetail` |
| A2 | Dashboard | GET | `/v1/admin/assignments` | Paginated list with filters | 200 `Paginated<AdminAssignmentListItem>` |
| A3 | Dashboard | GET | `/v1/admin/assignments/:id` | Detail with attachments | 200 `AdminAssignmentDetail` |
| A4 | Dashboard | PATCH | `/v1/admin/assignments/:id` | Partial update | 200 `AdminAssignmentDetail` |
| A5 | Dashboard | PATCH | `/v1/admin/assignments/:id/status` | Change status | 200 `AdminAssignmentDetail` |
| A6 | Dashboard | DELETE | `/v1/admin/assignments/:id` | Delete (no submissions only) | 204 |
| A7 | Dashboard | POST | `/v1/admin/assignments/:id/attachments` | Upload an instruction file | 201 `AdminAttachment` |
| A8 | Dashboard | DELETE | `/v1/admin/assignments/:id/attachments/:attachmentId` | Remove a file | 204 |
| A9 | Dashboard | GET | `/v1/admin/assignments/targets` | Programs > tracks > modules for the form | 200 `AssignmentTargetsResponse` |
| S1 | Mobile | GET | `/v1/assignments` | The student's published assignments with their latest submission | 200 `AssignmentsResponse` |
| S2 | Mobile | GET | `/v1/assignments/:id` | Assignment detail: instructions and files | 200 `AssignmentDetail` |

Route A9 must be declared before `/:id` in the controller so `targets` is not parsed as an id.

### 5.2 Error shape

```ts
{ statusCode: number, code: AssignmentErrorCode, message: string, details?: Record<string, string> }
```

`details` (field name to message) is present only for `VALIDATION_FAILED`.

| HTTP | `code` | When |
|------|--------|------|
| 400 | `VALIDATION_FAILED` | A field breaks a rule, or `moduleId` is sent in an update. |
| 401 | `UNAUTHORIZED` | Missing, expired or invalid token, or user `SUSPENDED` / `ARCHIVED`. |
| 403 | `FORBIDDEN` | Role not in `ASSIGNMENT_MANAGER_ROLES`. |
| 404 | `NOT_FOUND` | Unknown id, or (student API) assignment not visible to this student. |
| 409 | `ASSIGNMENT_HAS_SUBMISSIONS` | Delete, or PUBLISHED to DRAFT, with submissions. |
| 409 | `ALLOWED_TYPE_LOCKED` | Changing `allowedType` with submissions. |
| 409 | `MAX_SCORE_BELOW_EXISTING_SCORES` | `maxScore` lower than an existing score. |
| 409 | `INVALID_STATUS_TRANSITION` | Status change not in 4.1, or editing an `ARCHIVED` assignment or its files. |
| 409 | `ATTACHMENT_LIMIT_REACHED` | More than the maximum files per assignment. |
| 413 | `FILE_TOO_LARGE` | File above the size limit. |
| 415 | `UNSUPPORTED_FILE_TYPE` | Type not in the allowlist, or magic bytes do not match. |
| 500 | `INTERNAL_ERROR` | Anything unexpected (log it, never leak details). |

Arabic messages for each code are exported as `ASSIGNMENT_ERROR_MESSAGES_AR`.

---

## 6. Admin API (dashboard)

Base path: `/v1/admin/assignments`. Types are in `assignments.admin.contract.ts`. Every route requires the permissions in 4.5.

### 6.1 Create: `POST /v1/admin/assignments`

Body: `CreateAssignmentBody`.

| Field | Required | Rules |
|-------|----------|-------|
| `moduleId` | yes | Must exist, else `404 NOT_FOUND`. The module's program must not be `ARCHIVED`. |
| `title` | yes | Trimmed, 3 to 200 characters. |
| `instructions` | yes | Trimmed, 1 to 10,000 characters. |
| `allowedType` | no | `FILE_UPLOAD`, `URL_LINK`, `TEXT_CONTENT` or `MULTIMEDIA`. Default `URL_LINK`. |
| `maxScore` | no | Greater than 0, at most 999.99, at most 2 decimals. Default 100. |
| `dueDate` | no | ISO 8601 and in the future, or `null`. Default `null`. |
| `isMandatory` | no | Default `true`. |
| `orderIndex` | no | Integer, 0 or more. Default: last position in the module (`max(orderIndex) + 1`). |

One nested write, so the node and the assignment are created together or not at all:

```ts
const assignment = await this.prisma.assignment.create({
  data: {
    instructions, allowedType, maxScore, dueDate, // status defaults to DRAFT
    node: {
      create: { moduleId, title, type: NodeType.ASSIGNMENT, isMandatory, orderIndex },
    },
  },
  select: ASSIGNMENT_DETAIL_SELECT,
});
```

Response `201`: the created assignment with `status: "DRAFT"`, `publishedAt: null`, empty `attachments`.

### 6.2 List: `GET /v1/admin/assignments`

Query: `AdminAssignmentListQuery`.

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | 1 or more |
| `pageSize` | 20 | 1 to 100 |
| `q` | none | Case-insensitive `contains` on `node.title` |
| `programId`, `trackId`, `moduleId` | none | Filter through `node.module.track` |
| `status` | none (all statuses) | One status |
| `sort` | `-createdAt` | `createdAt`, `dueDate`, `title`, `publishedAt`, each with an optional `-` prefix for descending. A null `dueDate` sorts last. |

Response: `{ items, page, pageSize, total }`. Each item includes the counts the dashboard table needs:
- `submissionsCount`: number of `Submission` rows (every attempt counts).
- `pendingReviewCount`: rows with status `SUBMITTED` or `UNDER_REVIEW`.
- `attachmentsCount`.

Use Prisma `_count` with a filtered relation count for `pendingReviewCount`, and run `findMany` and `count` with the same `where` in one `$transaction`.

### 6.3 Detail: `GET /v1/admin/assignments/:id`

Returns `AdminAssignmentDetail`: the list fields plus `instructions`, `isMandatory`, `orderIndex` and `attachments` (each with a fresh `url`). Unknown id gives `404 NOT_FOUND`.

### 6.4 Update: `PATCH /v1/admin/assignments/:id`

Body: `UpdateAssignmentBody` (every field optional). Omitted means unchanged. `dueDate: null` clears the deadline. `moduleId` cannot change in v1; sending it returns `400 VALIDATION_FAILED`.

Same field rules as create, plus:

| Rule | Error |
|------|-------|
| Changing `allowedType` when the assignment has any submission (the shape of a submission's `payload` depends on it). | `409 ALLOWED_TYPE_LOCKED` |
| Lowering `maxScore` below the highest existing `Submission.score`. | `409 MAX_SCORE_BELOW_EXISTING_SCORES` |
| `dueDate` must be in the future **only when the value changes**. Editing other fields of an assignment whose deadline has passed must not fail. | `400 VALIDATION_FAILED` |
| Assignment is `ARCHIVED` (restore it first). | `409 INVALID_STATUS_TRANSITION` |

One nested write:

```ts
await this.prisma.assignment.update({
  where: { id },
  data: {
    instructions, allowedType, maxScore, dueDate,
    node: { update: { title, isMandatory, orderIndex } },
  },
});
```

Undefined fields are skipped by Prisma. Editing a published assignment is allowed and takes effect immediately for students.

### 6.5 Change status: `PATCH /v1/admin/assignments/:id/status`

Body: `{ "status": "PUBLISHED" }`. Apply the lifecycle table in 4.1. Response: the updated detail.

### 6.6 Delete: `DELETE /v1/admin/assignments/:id`

Allowed only when the assignment has **zero submissions**, in any status. Otherwise `409 ASSIGNMENT_HAS_SUBMISSIONS` (the dashboard should offer "archive" instead).

Delete the `ActivityNode`, not just the `Assignment`:

```ts
await this.prisma.activityNode.delete({ where: { id: assignment.nodeId } });
```

Deleting only the `Assignment` would leave an empty assignment node in the curriculum. The cascade (`Assignment`, `AssignmentAttachment`, and the `ProgressLog` rows of that node) is declared in the schema. After the database commit, delete the attachment files from storage (best effort, see 7.3).

### 6.7 Attachments: `POST` and `DELETE`

Rules are in section 7.

- `POST .../attachments`: `multipart/form-data` with one field named `file`. Returns the created `AdminAttachment`.
- `DELETE .../attachments/:attachmentId`: removes the row, then the file. The attachment must belong to the assignment in the path, else `404 NOT_FOUND`.
- Both are refused on an `ARCHIVED` assignment (`409 INVALID_STATUS_TRANSITION`).
- Adding or removing files is allowed after students have submitted.

### 6.8 Form helper: `GET /v1/admin/assignments/targets`

Returns every non-archived program with its tracks and modules (ordered by `orderIndex`, then title), so the dashboard can render cascading selects. If the dashboard already has program, track and module endpoints, reuse them and skip this route.

---

## 7. Instruction files (attachments and storage)

### 7.1 Rules

| Rule | Default | Error |
|------|---------|-------|
| Max size per file | 20 MB (`ATTACHMENT_LIMITS.maxBytes`) | `413 FILE_TOO_LARGE` |
| Max files per assignment | 5 (`ATTACHMENT_LIMITS.maxCount`) | `409 ATTACHMENT_LIMIT_REACHED` |
| Allowed types | pdf, docx, pptx, xlsx, png, jpg/jpeg, txt, zip | `415 UNSUPPORTED_FILE_TYPE` |

- Check the declared MIME type **and** the extension against the allowlist, and verify the real type from the file's magic bytes (for example with the `file-type` package). Never trust the client's `Content-Type` alone.
- Enforce the size limit while receiving (for example the `limits.fileSize` option of the Multer interceptor), not after reading the whole file.
- Rate limit uploads (for example 20 per minute per user).
- Recommended: scan uploads for malware (for example ClamAV) before storing.

### 7.2 Storage

Put the provider behind an interface so it can be swapped:

```ts
interface StorageService {
  put(key: string, body: Buffer | NodeJS.ReadableStream, opts: { contentType: string }): Promise<void>;
  delete(key: string): Promise<void>;
  /** Short-lived signed URL (or CDN URL). `fileName` sets Content-Disposition. */
  getDownloadUrl(key: string, opts: { fileName: string; expiresInSec: number }): Promise<string>;
}
```

- **Storage key:** `assignments/{assignmentId}/{attachmentId}{extension}`. Never put the user's file name in the key.
- **Display name:** the original name, sanitized: strip path separators and control characters, limit to 200 characters. Arabic names are allowed. Send downloads with an RFC 5987 header: `Content-Disposition: attachment; filename*=UTF-8''...`.
- **Provider** (decision S1): not decided here. Videos already use Bunny, so Bunny Storage behind a pull zone with token authentication is a natural fit; any S3-compatible bucket with presigned GET URLs also works. Keep the bucket or zone **private**.
- **Download URLs:** build them when the API responds (`expiresInSec` default 3600) and never store them. Both the admin and the student API return fresh URLs on every response.

### 7.3 Order of operations (keeps storage and database consistent)

Upload:
1. Validate the assignment (exists, not archived), the count, the size and the type.
2. Create the attachment id, then `storage.put`.
3. Insert the `AssignmentAttachment` row. If the insert fails, delete the stored file.

Delete:
1. Delete the row.
2. Delete the stored file. If that fails, log it with the key (an orphan cleanup job is optional).

### 7.4 Uploading from the dashboard

Upload **directly from the browser to the NestJS API** with the Bearer token, using `FormData`. Do not proxy uploads through Next.js route handlers or server actions: they have body size limits (about 4.5 MB on Vercel, 1 MB for server actions by default), so 20 MB uploads would fail there. Use `XMLHttpRequest` or axios `onUploadProgress` for a progress bar.

---

## 8. Student API (mobile)

### 8.1 List: `GET /v1/assignments`

Auth: Bearer JWT. No query params. Response: `AssignmentsResponse` (`{ items: AssignmentItem[] }`). Headers: `Cache-Control: private, max-age=0`.

Visibility: section 4.2. Flags: section 4.3.

```ts
import { AssignmentStatus, EnrollmentStatus, ProgramStatus } from '@prisma/client';

const assignments = await this.prisma.assignment.findMany({
  where: {
    status: AssignmentStatus.PUBLISHED,
    node: {
      module: {
        track: {
          program: {
            status: { in: [ProgramStatus.PUBLISHED, ProgramStatus.ONGOING, ProgramStatus.COMPLETED] },
            enrollments: {
              some: { userId, status: { in: [EnrollmentStatus.ACTIVE, EnrollmentStatus.COMPLETED] } },
            },
          },
        },
      },
    },
  },
  select: {
    id: true,
    allowedType: true,
    maxScore: true,
    dueDate: true,
    createdAt: true,
    publishedAt: true,
    node: {
      select: {
        title: true,
        module: {
          select: {
            track: { select: { program: { select: { id: true, title: true, slug: true } } } },
          },
        },
      },
    },
    // All of this student's attempts, newest first
    submissions: {
      where: { studentId: userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, score: true, feedback: true, createdAt: true },
    },
  },
});
```

If `EXPLAIN` shows the nested relation filter is slow, split it in two steps: first load the user's enrolled program ids (uses `Enrollment(userId)`), then filter with `node.module.track.programId in ids`.

Field mapping:

| Response field | Source |
|----------------|--------|
| `id` | `Assignment.id` |
| `title` | `Assignment.node.title` |
| `allowedType` | `Assignment.allowedType` |
| `maxScore` | `Assignment.maxScore.toNumber()` |
| `dueDate` | `Assignment.dueDate` as ISO string, or `null` |
| `createdAt` | `Assignment.createdAt` as ISO string |
| `publishedAt` | `Assignment.publishedAt` as ISO string (always set for `PUBLISHED`) |
| `isNew`, `isOverdue` | computed (4.3) |
| `program` | `{ id, title, slug }` from node, module, track |
| `submission` | `null` when `submissions` is empty, otherwise built from `submissions[0]` (below) |

`submission` (latest attempt = `submissions[0]`):

| Field | Source |
|-------|--------|
| `id` | `Submission.id` |
| `status` | `Submission.status` |
| `submittedAt` | `Submission.createdAt` as ISO string |
| `score` | `Submission.score?.toNumber() ?? null` |
| `feedback` | `Submission.feedback` or `null` |
| `attemptsCount` | `submissions.length` |

Sorting is done by the client; the server order is not significant. No pagination for now.

### 8.2 Detail: `GET /v1/assignments/:id`

Auth: Bearer JWT. Response: `AssignmentDetail` = the list item (same fields, same rules) plus `instructions` and `attachments`.

```ts
{ ...AssignmentItem,
  instructions: string,
  attachments: Array<{ id, fileName, mimeType, sizeBytes, url }> }
```

Access rule: the assignment must satisfy section 4.2 for this user. Otherwise return `404 NOT_FOUND` (not 403, so existence is not revealed). Use the same `where` as 8.1 plus `id`, and select `instructions` and `attachments` in addition.

Build each attachment `url` with `StorageService.getDownloadUrl` at response time (`expiresInSec` 3600). `submission`, `isNew` and `isOverdue` follow the same rules as the list. The latest submission includes the full `feedback`. Attempt history is out of scope for v1.

### 8.3 Not in this spec

- `POST /v1/assignments/:id/submissions` (the submit form). It must follow A1: always create a new row.
- `POST /v1/assignments/:id/view` and the `AssignmentView` table (optional "unseen" tracking, see 15.4).

---

## 9. Dashboard client (Next.js)

Layout and styling are up to the dashboard. Behavior:

### 9.1 Assignments list

- Table columns: title, program, status badge, deadline, `submissionsCount`, `pendingReviewCount`, `attachmentsCount`.
- Filters: search, program, track, module, status. Pagination and sorting use the query params in 6.2.
- Row actions: edit, publish or archive (depending on status), delete.

### 9.2 Create and edit form

- Program, track and module cascading selects from the targets endpoint (A9). The module is locked when editing.
- Fields: title, instructions, submission type, max score, deadline (date and time, show the timezone, send ISO UTC), mandatory toggle.
- When the assignment has submissions, disable the submission type field and show why.
- Attachments panel: drag and drop upload with progress, file name and size, a remove button, a counter (`n / 5`). Check type and size in the browser first (the server still enforces them). Upload as in 7.4.
- New assignments are saved as drafts. A separate "Publish" button changes the status.

### 9.3 Status and delete actions

- Confirm dialogs. Publishing says students will see it immediately.
- If delete returns `ASSIGNMENT_HAS_SUBMISSIONS`, offer "Archive instead".

### 9.4 Errors

Map `code` to `ASSIGNMENT_ERROR_MESSAGES_AR`. For `VALIDATION_FAILED`, show `details` next to the matching fields. On `401`, send the admin to login.

---

## 10. Mobile client (Expo)

The list screen (`src/app/(tabs)/assignments.tsx`) already exists and navigates to `/assignments/[id]`. This section lists what the client must do against the student API.

### 10.1 Operations

| # | Operation | Endpoint | When |
|---|-----------|----------|------|
| M1 | Load the list | S1 `GET /v1/assignments` | On first focus of the tab, on every return to the tab (`useFocusEffect`), on pull to refresh, and on retry after an error. |
| M2 | Load the detail | S2 `GET /v1/assignments/:id` | When the user opens an assignment. |
| M3 | Open an instruction file | `attachment.url` from M2 | When the user taps a file. |
| M4 | Submit work | not in this spec | Future (A1). |
| M5 | Mark as seen | optional (15.4) | Future. |

API client methods in `src/api/assignments.ts`:
- `getMyAssignments(): Promise<AssignmentItem[]>` (exists).
- `getAssignment(id: string): Promise<AssignmentDetail>` (new).

### 10.2 List behavior (M1)

- Tabs and counts: الكل, جديدة, لم تُسلَّم, تم التسليم, مكتملة. Buckets and states follow 4.4.
- Sort: work the student must do first (earliest deadline first, no deadline last), then submitted work, then closed work, most recent first. Prefer `publishedAt` over `createdAt` as the tie-break.
- Next-due card: the assignment with the nearest upcoming deadline among `TODO` items that are not overdue.
- Card: "جديد" pill from `isNew`; deadline text in red or orange from `isOverdue` and the time left; score bar for `GRADED`; grader feedback for `NEEDS_REVISION`, `REJECTED` and `GRADED`.
- Loading skeletons, an error state with retry, and per-tab empty states.
- Refetching on focus must not show a skeleton again after the first load.
- Because only `PUBLISHED` assignments are returned, an item can disappear from the list on the next refresh (unpublished, archived or deleted). That is expected, not an error.

### 10.3 Detail screen (M2)

Route: `/assignments/[id]`. It shows:
- Program name, title, "جديد" pill, state badge, submission type, deadline (same rules as the card).
- `instructions` as plain text. Preserve line breaks; render in RTL.
- Attachments list: icon by `mimeType`, `fileName`, size in KB or MB, tap to open.
- Score and the full `feedback` when present.
- A primary action area reserved for the submit form (M4). Until M4 exists, hide it or show it disabled; do not invent a submission flow.

States: skeleton while loading, error state with retry, and a not-found state for `404` ("هذا الواجب لم يعد متاحاً") with a button back to the list that triggers a refetch of M1.

### 10.4 Opening files (M3)

- Open with `Linking.openURL(url)` or `expo-web-browser`. For an in-app download use `expo-file-system` plus `expo-sharing`.
- URLs expire (default 1 hour). Never store a URL in persistent state. If the screen has been open for more than about 50 minutes, or opening fails with an expired-link response (`403`), refetch M2 and retry once with the fresh URL.
- Show a clear error if the file cannot be opened; keep the screen usable.

### 10.5 General rules

- Dates arrive as ISO UTC strings; format them in the device timezone with the helpers in `assignmentFormat.ts`.
- Treat `401` as session expiry: follow the app's existing auth flow.
- Never display `submission` details of other students (the API never returns them).

---

## 11. Shared contracts

Both contracts are included in full at the end of this file. Create them by copying the code blocks:

| Create this file | From | Used by | Content |
|------------------|------|---------|---------|
| `src/types/assignments.contract.ts` | section 17 | Mobile, backend | Everything the student side needs: `AssignmentItem` (with `publishedAt`), `AssignmentsResponse`, `AssignmentDetail`, `AssignmentAttachmentDto`, `getAssignmentState`, `getAssignmentBucket`, `NEW_WINDOW_DAYS`, example response |
| `src/types/assignments.admin.contract.ts` | section 18 | Dashboard, backend | Admin list and detail types, write bodies, status transitions, limits, error codes and Arabic messages. Imports `SubmissionType` from the student contract. |

The mobile app needs **only** the student contract. The dashboard needs the admin contract (plus the student contract it imports from). The backend uses both. In the dashboard project, keep the admin file's import path working (`./assignments.contract`), for example by placing both files in the same folder.

`createdAt` stays on `AssignmentItem` next to `publishedAt`, so existing mobile screens keep working.

---

## 12. Non-functional requirements

- Create and update are one database transaction (nested writes as shown).
- Admin list: one `findMany` plus one `count`, no N+1. Target p95 under 400 ms for 500 assignments.
- Student list: one database query, no N+1. Target p95 under 300 ms for a student with up to 100 assignments.
- Never return `Submission.payload` or other students' data from any assignment endpoint. Return only fields in the contract types.
- Convert every `Decimal` with `.toNumber()` and every `Date` to an ISO string.
- Log every admin write as structured JSON: user id, action, assignment id. Never log tokens.
- Concurrent edits: last write wins in v1.
- Admin and student responses carry `Cache-Control: private, max-age=0`.

---

## 13. Acceptance tests

### Migration

- **D-1.** After the migration, every existing assignment is `PUBLISHED` with `publishedAt = createdAt`, and still appears in the student list.

### Admin: create, read, update

- **A-1.** Valid create returns 201, status `DRAFT`, `publishedAt: null`, and creates both an `ActivityNode` (type `ASSIGNMENT`) and an `Assignment`.
- **A-2.** Defaults apply: `allowedType = URL_LINK`, `maxScore = 100`, `isMandatory = true`, `orderIndex` = last in module.
- **A-3.** Unknown `moduleId` gives 404. Title of 2 characters gives 400 with `details.title`. `maxScore` of 0 or 1000 gives 400. `dueDate` in the past gives 400.
- **A-4.** List filters by program, track, module, status and `q`. Pagination returns the correct `total`. Sorting by `-dueDate` puts null deadlines last.
- **A-5.** `submissionsCount`, `pendingReviewCount` and `attachmentsCount` match the data.
- **A-6.** PATCH changes only the sent fields and updates the node title.
- **A-7.** `dueDate: null` clears the deadline.
- **A-8.** Editing the title of an assignment whose deadline has passed succeeds. Sending a past `dueDate` that differs from the stored one fails.
- **A-9.** With submissions: changing `allowedType` gives `409 ALLOWED_TYPE_LOCKED`; lowering `maxScore` below an existing score gives `409 MAX_SCORE_BELOW_EXISTING_SCORES`.
- **A-10.** Sending `moduleId` in PATCH gives 400.
- **A-11.** PATCH on an `ARCHIVED` assignment gives `409 INVALID_STATUS_TRANSITION`.

### Admin: status and delete

- **S-1.** DRAFT to PUBLISHED sets `publishedAt`.
- **S-2.** PUBLISHED to DRAFT with no submissions clears `publishedAt`.
- **S-3.** PUBLISHED to DRAFT with a submission gives `409 ASSIGNMENT_HAS_SUBMISSIONS`.
- **S-4.** DRAFT to ARCHIVED gives `409 INVALID_STATUS_TRANSITION`.
- **S-5.** ARCHIVED to PUBLISHED keeps the old `publishedAt`.
- **X-1.** Delete with no submissions returns 204 and removes the `ActivityNode`, the `Assignment`, the attachment rows (no orphan node) and the stored files.
- **X-2.** Delete with a submission gives `409 ASSIGNMENT_HAS_SUBMISSIONS` and nothing is removed.

### Attachments

- **F-1.** Uploading a valid PDF returns 201 with `url`, and the file exists in storage under `assignments/{id}/...`.
- **F-2.** A file over 20 MB gives 413. An `.exe` renamed to `.pdf` gives 415 (magic bytes check). A sixth file gives `409 ATTACHMENT_LIMIT_REACHED`.
- **F-3.** Arabic file names are stored, returned and downloaded with the correct name.
- **F-4.** Deleting an attachment removes the row and the file. Using an attachment id from another assignment gives 404.
- **F-5.** If the database insert fails after `put`, the stored file is removed.
- **F-6.** Uploading to an `ARCHIVED` assignment gives 409.

### Permissions

- **P-1.** Student token on `/v1/admin/**` gives 403.
- **P-2.** No token, or a `SUSPENDED` or `ARCHIVED` user, gives 401 on admin and student routes.
- **P-3.** `SUPER_ADMIN` and `INCUBATOR_MANAGER` succeed on admin routes.
- **P-4.** `INSTRUCTOR` gets 403 while `ASSIGNMENT_MANAGER_ROLES` has the default value.

### Student list (S1)

- **M-1.** A student with no `ACTIVE` or `COMPLETED` enrollment gets `{ items: [] }`.
- **M-2.** `PENDING`, `DROPPED` and `SUSPENDED` enrollments: their assignments are not returned.
- **M-3.** `COMPLETED` enrollment: its assignments are returned (history).
- **M-4.** An assignment in a `DRAFT` or `ARCHIVED` program is not returned.
- **M-5.** A `DRAFT` or `ARCHIVED` assignment is never returned. After publishing it appears with `isNew: true`.
- **M-6.** Never submitted, published 1 day ago: `submission: null`, `isNew: true`. Published 10 days ago: `isNew: false`.
- **M-7.** Two rows (`NEEDS_REVISION`, then a newer `SUBMITTED`): `submission.status` is `SUBMITTED`, `attemptsCount` is 2.
- **M-8.** Latest status `NEEDS_REVISION` with a past `dueDate`: `isOverdue: true`.
- **M-9.** Latest status `GRADED` with a past `dueDate`: `isOverdue: false`, `score` is a number.
- **M-10.** `dueDate: null`: `dueDate` is `null`, `isOverdue: false`.
- **M-11.** Another student's submissions never appear in `submission` or `attemptsCount`.
- **M-12.** The response matches `AssignmentsResponse` exactly, including `publishedAt` (add a contract test).

### Student detail (S2)

- **M-13.** An enrolled student gets instructions and attachments with working `url`s.
- **M-14.** A student who is not enrolled, an enrollment that is not `ACTIVE` or `COMPLETED`, or a `DRAFT` or `ARCHIVED` assignment gives 404.
- **M-15.** The detail never contains `Submission.payload`.

### Mobile client

- **C-1.** Returning to the tab refetches the list without showing the skeleton again.
- **C-2.** Opening an assignment that was unpublished after the list loaded shows the not-found state, and going back refetches the list.
- **C-3.** Opening a file after the screen was open for more than 50 minutes refetches the detail and uses the fresh URL.
- **C-4.** Tab counts and buckets match the table in 4.4 for all five states.

---

## 14. Rollout order

1. Run the migration with the backfill (3.3). Existing assignments stay visible.
2. Deploy the backend: admin routes, storage configured, the student list `status` filter and `publishedAt`, the detail route.
3. Release the dashboard screens.
4. Release the mobile update: `publishedAt` in the contract, the detail screen with instructions and file opening.

Steps 2 and 4 are compatible with older app versions: the list keeps all existing fields and only adds `publishedAt`.

---

## 15. Assumptions and open decisions

### 15.1 Assumptions (relied on by this spec)

| # | Assumption |
|---|-----------|
| A1 | Every attempt is a new `Submission` row (`Submission` has no unique constraint on assignment and student). `submittedAt` is the newest row's `createdAt` and `attemptsCount` is the row count. The future submit endpoint must create a new row for a resubmission and never overwrite `payload`; otherwise `submittedAt` shows the first attempt and `attemptsCount` is always 1. |
| A2 | A `GRADED` submission has a non-null `score`. The client tolerates `null` (it hides the score bar), but the grading endpoint should always set it. |
| A3 | Grading should also update `ProgressLog`. These endpoints do not read it. To keep `Enrollment.progressPct` and home-screen stats consistent, the grading flow should set `ProgressLog.isCompleted = true` for the assignment's node when a submission is graded (decide whether `REJECTED` counts). |

### 15.2 Decisions and their defaults

| # | Decision | Default in this spec |
|---|----------|----------------------|
| R1 | Who can manage assignments | `SUPER_ADMIN`, `INCUBATOR_MANAGER` only |
| S1 | Storage provider | Not chosen: private bucket behind `StorageService` (Bunny Storage or S3-compatible) |
| V1 | Archived assignments visible to students | No (hidden, including graded history) |
| F1 | File limits and types | 20 MB, 5 files, pdf/docx/pptx/xlsx/png/jpg/txt/zip |
| P1 | Instructions format | Plain text; files carry richer content |
| M1 | Moving an assignment to another module | Not supported in v1 |
| D1 | Show assignments before the cohort starts | Yes: the student query includes `PUBLISHED` programs. For "only once running", use `ONGOING` and `COMPLETED`, or add `startDate <= now`. |
| D3 | A `NEEDS_REVISION` assignment is overdue after its deadline | Yes (the student still has to act). Change the `isOverdue` rule if late revisions are allowed. |

### 15.3 Superseded

The earlier decision D2 ("there is no way to hide a draft assignment") is resolved by `status` and `publishedAt` in this spec.

### 15.4 Optional: true "unseen" tracking

Today "new" is time-based because the schema cannot tell whether a student opened an assignment. For "new = never opened", add:

```prisma
model AssignmentView {
  id           String     @id @default(uuid())
  userId       String
  assignmentId String
  seenAt       DateTime   @default(now())
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)

  @@unique([userId, assignmentId])
  @@index([userId])
}
```

Required back-relations (Prisma will not validate without them):

```prisma
model User       { /* ... */ assignmentViews AssignmentView[] }
model Assignment { /* ... */ views           AssignmentView[] }
```

Then `isNew = submission === null && no AssignmentView row for this user`, and add `POST /v1/assignments/:id/view` that upserts the row when the student opens the assignment (operation M5).

---

## 16. Appendix: example payloads

### 16.1 Create (A1)

Request:

```json
{
  "moduleId": "6f1c0a52-9d3e-4b7a-8c11-2e5f7a90b1d4",
  "title": "بناء واجهة تسجيل الدخول",
  "instructions": "ابنِ شاشة تسجيل دخول باستخدام React Native...",
  "allowedType": "URL_LINK",
  "maxScore": 100,
  "dueDate": "2026-11-05T20:59:00.000Z",
  "isMandatory": true
}
```

### 16.2 Admin list item (A2)

```json
{
  "id": "a_1",
  "title": "بناء واجهة تسجيل الدخول",
  "status": "PUBLISHED",
  "allowedType": "URL_LINK",
  "maxScore": 100,
  "dueDate": "2026-11-05T20:59:00.000Z",
  "publishedAt": "2026-10-21T09:00:00.000Z",
  "createdAt": "2026-10-20T08:00:00.000Z",
  "updatedAt": "2026-10-21T09:00:00.000Z",
  "program": { "id": "p_rn", "title": "تطوير التطبيقات بـ React Native" },
  "track": { "id": "t_1", "title": "المسار الأول" },
  "module": { "id": "m_3", "title": "إدارة الحالات المتقدمة" },
  "submissionsCount": 12,
  "pendingReviewCount": 5,
  "attachmentsCount": 1
}
```

### 16.3 Status change (A5)

```json
{ "status": "PUBLISHED" }
```

### 16.4 Student list item (S1)

```json
{
  "id": "a_1",
  "title": "بناء واجهة تسجيل الدخول",
  "allowedType": "URL_LINK",
  "maxScore": 100,
  "dueDate": "2026-11-05T20:59:00.000Z",
  "createdAt": "2026-10-20T08:00:00.000Z",
  "publishedAt": "2026-10-21T09:00:00.000Z",
  "isNew": true,
  "isOverdue": false,
  "program": { "id": "p_rn", "title": "تطوير التطبيقات بـ React Native", "slug": "react-native" },
  "submission": null
}
```

### 16.5 Student detail (S2)

```json
{
  "id": "a_1",
  "title": "بناء واجهة تسجيل الدخول",
  "allowedType": "URL_LINK",
  "maxScore": 100,
  "dueDate": "2026-11-05T20:59:00.000Z",
  "createdAt": "2026-10-20T08:00:00.000Z",
  "publishedAt": "2026-10-21T09:00:00.000Z",
  "isNew": true,
  "isOverdue": false,
  "program": { "id": "p_rn", "title": "تطوير التطبيقات بـ React Native", "slug": "react-native" },
  "submission": null,
  "instructions": "ابنِ شاشة تسجيل دخول...",
  "attachments": [
    { "id": "f_1", "fileName": "المتطلبات.pdf", "mimeType": "application/pdf", "sizeBytes": 245123, "url": "https://..." }
  ]
}
```

### 16.6 Error

```json
{
  "statusCode": 409,
  "code": "ASSIGNMENT_HAS_SUBMISSIONS",
  "message": "Assignment has submissions; archive it instead."
}
```

---

## 17. Contract file: student types

Create `src/types/assignments.contract.ts` with exactly this content. Used by the mobile app and the backend.

```ts
// src/types/assignments.ts  (shared by the Expo app and the NestJS backend)
/**
 * Assignments page contract
 * -------------------------
 * Built from the Prisma schema:
 *   Assignment -> ActivityNode (type ASSIGNMENT) -> Module -> Track -> Program
 *   Submission (student's attempts; no unique constraint, so a student can have several)
 *
 * Rules:
 *  - ONE endpoint returns every PUBLISHED assignment of the current student's programs.
 *  - A second endpoint (GET /v1/assignments/:id) returns one assignment with instructions and files.
 *  - The server decides facts (isNew, isOverdue, latest submission). The client decides presentation.
 *  - "Not submitted" is not a database state: it means the student has no Submission row.
 */

export const ASSIGNMENTS_ENDPOINT = '/v1/assignments' as const;

/** An unsubmitted assignment published within this many days is "new". */
export const NEW_WINDOW_DAYS = 3;

/* ------------------------------ Schema enums ----------------------------- */

export type SubmissionStatus =
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'GRADED'
  | 'REJECTED'
  | 'NEEDS_REVISION';

export type SubmissionType = 'FILE_UPLOAD' | 'URL_LINK' | 'TEXT_CONTENT' | 'MULTIMEDIA';

/* -------------------------------- Response ------------------------------- */

export type AssignmentProgramRef = {
  id: string;
  title: string;
  slug: string;
};

/** The student's LATEST submission for the assignment. */
export type AssignmentSubmission = {
  id: string;
  status: SubmissionStatus;
  /** Submission.createdAt of the latest attempt */
  submittedAt: string;
  /** Submission.score as a number; null until graded */
  score: number | null;
  feedback: string | null;
  /** How many times the student has submitted */
  attemptsCount: number;
};

export type AssignmentItem = {
  /** Assignment.id */
  id: string;
  /** ActivityNode.title */
  title: string;
  allowedType: SubmissionType;
  /** Assignment.maxScore as a number */
  maxScore: number;
  /** ISO date, or null when there is no deadline */
  dueDate: string | null;
  /** Assignment.createdAt (ISO) */
  createdAt: string;
  /** Assignment.publishedAt (ISO). Always set for PUBLISHED assignments, which are the only ones students receive. */
  publishedAt: string;
  /** No submission yet AND published within NEW_WINDOW_DAYS */
  isNew: boolean;
  /** dueDate has passed AND the student still has to submit (not submitted, or needs revision) */
  isOverdue: boolean;
  program: AssignmentProgramRef;
  /** null = the student has not submitted */
  submission: AssignmentSubmission | null;
};

export type AssignmentsResponse = {
  items: AssignmentItem[];
};

/* ------------------------- Detail (GET /v1/assignments/:id) ---------------- */

/** A file the admin attached to the instructions. `url` is signed and expires (about 1 hour): never store it. */
export type AssignmentAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  url: string;
};

/** The list item plus everything the detail screen needs. */
export type AssignmentDetail = AssignmentItem & {
  instructions: string;
  attachments: AssignmentAttachmentDto[];
};

/* ---------------------- Shared derivation (client + server) --------------- */

/** What the card shows. Merges SUBMITTED + UNDER_REVIEW, adds NOT_SUBMITTED. */
export type AssignmentState =
  | 'NOT_SUBMITTED'
  | 'AWAITING_REVIEW'
  | 'NEEDS_REVISION'
  | 'GRADED'
  | 'REJECTED';

/** Which tab the assignment lives in. */
export type AssignmentBucket = 'TODO' | 'SUBMITTED' | 'DONE';

export function getAssignmentState(item: Pick<AssignmentItem, 'submission'>): AssignmentState {
  const status = item.submission?.status;
  switch (status) {
    case undefined:
      return 'NOT_SUBMITTED';
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      return 'AWAITING_REVIEW';
    case 'NEEDS_REVISION':
      return 'NEEDS_REVISION';
    case 'GRADED':
      return 'GRADED';
    case 'REJECTED':
      return 'REJECTED';
  }
}

/**
 * TODO       = the student must act (never submitted, or asked to revise)
 * SUBMITTED  = waiting for a grader
 * DONE       = closed (graded, or rejected)
 */
export function getAssignmentBucket(state: AssignmentState): AssignmentBucket {
  switch (state) {
    case 'NOT_SUBMITTED':
    case 'NEEDS_REVISION':
      return 'TODO';
    case 'AWAITING_REVIEW':
      return 'SUBMITTED';
    case 'GRADED':
    case 'REJECTED':
      return 'DONE';
  }
}

/* ----------------------------- Example response -------------------------- */

export const ASSIGNMENTS_RESPONSE_EXAMPLE: AssignmentsResponse = {
  items: [
    {
      id: 'a_1',
      title: 'بناء واجهة تسجيل الدخول',
      allowedType: 'URL_LINK',
      maxScore: 100,
      dueDate: '2026-10-24T20:59:00.000Z',
      createdAt: '2026-10-20T08:00:00.000Z',
      publishedAt: '2026-10-21T09:00:00.000Z',
      isNew: true,
      isOverdue: false,
      program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native' },
      submission: null,
    },
    {
      id: 'a_2',
      title: 'تصميم مخطط قاعدة البيانات',
      allowedType: 'FILE_UPLOAD',
      maxScore: 100,
      dueDate: '2026-10-18T20:59:00.000Z',
      createdAt: '2026-10-10T08:00:00.000Z',
      publishedAt: '2026-10-10T09:00:00.000Z',
      isNew: false,
      isOverdue: false,
      program: { id: 'p_rn', title: 'تطوير التطبيقات بـ React Native', slug: 'react-native' },
      submission: {
        id: 's_9',
        status: 'GRADED',
        submittedAt: '2026-10-17T12:30:00.000Z',
        score: 88.5,
        feedback: 'عمل ممتاز، انتبه لتسمية العلاقات.',
        attemptsCount: 1,
      },
    },
  ],
};
```

---

## 18. Contract file: admin types

Create `src/types/assignments.admin.contract.ts` with exactly this content. Used by the dashboard and the backend. It imports from `./assignments.contract`, so keep both files in the same folder.

```ts
// src/types/assignments.admin.ts  (shared by the NestJS backend and the Next.js dashboard)
/**
 * Assignments admin contract
 * --------------------------
 * Companion to ASSIGNMENTS_CRUD_SPEC.md and to assignments.contract.ts (the mobile list contract).
 * Adjust the import below to wherever assignments.contract.ts lives in each project.
 */
import type { SubmissionType } from './assignments.contract';

export const ADMIN_ASSIGNMENTS_ENDPOINT = '/v1/admin/assignments' as const;

/* -------------------------------------------------------------------------- */
/*  Status lifecycle                                                          */
/* -------------------------------------------------------------------------- */

export type AssignmentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ProgramStatus = 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'ARCHIVED';

/**
 * Allowed status changes. Extra server rule:
 * PUBLISHED -> DRAFT is refused (409 ASSIGNMENT_HAS_SUBMISSIONS) when the assignment has any submission.
 */
export const ASSIGNMENT_STATUS_TRANSITIONS: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
  DRAFT: ['PUBLISHED'],
  PUBLISHED: ['DRAFT', 'ARCHIVED'],
  ARCHIVED: ['PUBLISHED'],
};

/* -------------------------------------------------------------------------- */
/*  Limits (single source of truth for the backend validators and the UI)     */
/* -------------------------------------------------------------------------- */

export const ASSIGNMENT_LIMITS = {
  titleMin: 3,
  titleMax: 200,
  instructionsMax: 10_000,
  /** Assignment.maxScore is Decimal(5,2) */
  maxScoreMax: 999.99,
} as const;

export const ATTACHMENT_LIMITS = {
  maxCount: 5,
  maxBytes: 20 * 1024 * 1024,
  /** Allowed MIME type -> allowed extensions. The server also checks the file's magic bytes. */
  allowed: {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    'image/png': ['.png'],
    'image/jpeg': ['.jpg', '.jpeg'],
    'text/plain': ['.txt'],
    'application/zip': ['.zip'],
  } as Record<string, readonly string[]>,
} as const;

/* -------------------------------------------------------------------------- */
/*  Shared shapes                                                             */
/* -------------------------------------------------------------------------- */

export type IdTitle = { id: string; title: string };

export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** A file attached to an assignment's instructions. `url` is generated at read time. */
export type AdminAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** Download URL. May be time-limited (signed), so never store it. */
  url: string;
  createdAt: string;
};

/* -------------------------------------------------------------------------- */
/*  Admin: list + detail                                                      */
/* -------------------------------------------------------------------------- */

export type AdminAssignmentListItem = {
  /** Assignment.id */
  id: string;
  /** ActivityNode.title */
  title: string;
  status: AssignmentStatus;
  allowedType: SubmissionType;
  maxScore: number;
  dueDate: string | null;
  /** null while DRAFT */
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  program: IdTitle;
  track: IdTitle;
  module: IdTitle;
  /** Number of Submission rows (every attempt counts) */
  submissionsCount: number;
  /** Submission rows with status SUBMITTED or UNDER_REVIEW */
  pendingReviewCount: number;
  attachmentsCount: number;
};

export type AdminAssignmentDetail = AdminAssignmentListItem & {
  instructions: string;
  /** ActivityNode.isMandatory */
  isMandatory: boolean;
  /** ActivityNode.orderIndex (position inside the module) */
  orderIndex: number;
  attachments: AdminAttachment[];
};

export type AdminAssignmentSort =
  | 'createdAt'
  | '-createdAt'
  | 'dueDate'
  | '-dueDate'
  | 'title'
  | '-title'
  | 'publishedAt'
  | '-publishedAt';

export type AdminAssignmentListQuery = {
  /** default 1 */
  page?: number;
  /** default 20, max 100 */
  pageSize?: number;
  /** case-insensitive match on the title */
  q?: string;
  programId?: string;
  trackId?: string;
  moduleId?: string;
  status?: AssignmentStatus;
  /** default '-createdAt' */
  sort?: AdminAssignmentSort;
};

/* -------------------------------------------------------------------------- */
/*  Admin: write bodies                                                       */
/* -------------------------------------------------------------------------- */

export type CreateAssignmentBody = {
  /** The module the assignment lives in (this decides program and students) */
  moduleId: string;
  title: string;
  instructions: string;
  /** default 'URL_LINK' */
  allowedType?: SubmissionType;
  /** default 100; must be > 0 and <= 999.99, max 2 decimals */
  maxScore?: number;
  /** ISO date in the future, or null for no deadline */
  dueDate?: string | null;
  /** default true */
  isMandatory?: boolean;
  /** default: last position in the module */
  orderIndex?: number;
};

/** Partial update. Omitted = unchanged. `dueDate: null` clears the deadline. `moduleId` cannot change. */
export type UpdateAssignmentBody = Partial<Omit<CreateAssignmentBody, 'moduleId'>>;

export type ChangeStatusBody = { status: AssignmentStatus };

/* -------------------------------------------------------------------------- */
/*  Admin: form helper (programs > tracks > modules)                          */
/* -------------------------------------------------------------------------- */

export type AssignmentTargetsResponse = {
  programs: Array<{
    id: string;
    title: string;
    status: ProgramStatus;
    tracks: Array<{
      id: string;
      title: string;
      modules: IdTitle[];
    }>;
  }>;
};

/* -------------------------------------------------------------------------- */
/*  Errors                                                                    */
/* -------------------------------------------------------------------------- */

export type AssignmentErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'ASSIGNMENT_HAS_SUBMISSIONS'
  | 'ALLOWED_TYPE_LOCKED'
  | 'MAX_SCORE_BELOW_EXISTING_SCORES'
  | 'INVALID_STATUS_TRANSITION'
  | 'ATTACHMENT_LIMIT_REACHED'
  | 'FILE_TOO_LARGE'
  | 'UNSUPPORTED_FILE_TYPE'
  | 'INTERNAL_ERROR';

export type AssignmentApiError = {
  statusCode: number;
  code: AssignmentErrorCode;
  message: string;
  /** For VALIDATION_FAILED: field name -> message */
  details?: Record<string, string>;
};

/** Messages the dashboard can show for each code. */
export const ASSIGNMENT_ERROR_MESSAGES_AR: Record<AssignmentErrorCode, string> = {
  VALIDATION_FAILED: 'يرجى تصحيح الحقول المحددة ثم إعادة المحاولة.',
  UNAUTHORIZED: 'انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى.',
  FORBIDDEN: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  NOT_FOUND: 'العنصر غير موجود أو تم حذفه.',
  ASSIGNMENT_HAS_SUBMISSIONS: 'لا يمكن تنفيذ هذا الإجراء لأن الواجب لديه تسليمات. يمكنك أرشفته بدلاً من ذلك.',
  ALLOWED_TYPE_LOCKED: 'لا يمكن تغيير نوع التسليم بعد وجود تسليمات.',
  MAX_SCORE_BELOW_EXISTING_SCORES: 'الدرجة العظمى أقل من درجات مُسجّلة بالفعل لطلاب.',
  INVALID_STATUS_TRANSITION: 'هذا التغيير في حالة الواجب غير مسموح.',
  ATTACHMENT_LIMIT_REACHED: `وصلت إلى الحد الأقصى لعدد المرفقات (${ATTACHMENT_LIMITS.maxCount}).`,
  FILE_TOO_LARGE: `حجم الملف يتجاوز ${ATTACHMENT_LIMITS.maxBytes / (1024 * 1024)} ميجابايت.`,
  UNSUPPORTED_FILE_TYPE: 'نوع الملف غير مدعوم.',
  INTERNAL_ERROR: 'حدث خطأ غير متوقع، يرجى المحاولة لاحقاً.',
};
```