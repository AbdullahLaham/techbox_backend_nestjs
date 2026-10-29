# Update 01: Lesson completion and program progress

Date: 2026-10-29 · Backend branch `feature/assignments`

## Problem

`Enrollment.progressPct` was never calculated, so every learner showed 0% (mobile home, web dashboard, admin enrollment list). Lessons were marked complete only when a quiz was passed or an assignment graded, and videos and reading material could not be completed at all.

## What changed

### When a lesson counts as done

| Lesson type | Completed when |
|-------------|----------------|
| `VIDEO_LECTURE` | The learner reached 90% of the video (`VIDEO_COMPLETION_THRESHOLD`), or the app sends `completed: true` |
| `READING_MATERIAL` | The app sends `completed: true` (the learner taps "تم") |
| `QUIZ` | The learner passes the quiz (automatic) |
| `ASSIGNMENT` | A reviewer grades the hand-in `GRADED` (automatic) |

Completion is never undone (seeking back in a video, or a later failed quiz attempt, keeps it).

### How the percentage is computed

```
progress = completed counted lessons / counted lessons × 100   (1 decimal)
```

- **Counted lessons**: mandatory lessons the learner can see. QUIZ lessons count once their quiz is published, ASSIGNMENT lessons once the assignment is `PUBLISHED`. Optional lessons (`isMandatory: false`) never count.
- Computed from the data each time it is shown, so it follows curriculum changes (adding a lesson lowers the percentage; publishing a quiz adds it).
- Also written to `Enrollment.progressPct` (a cache for anything reading the column), after every completion and whenever the learner or an admin views it.
- Reaching 100% does **not** change the enrollment status to `COMPLETED`; that stays an admin decision (`PATCH /v1/admin/enrollments/:id/status`).

## API changes

### New: `POST /v1/nodes/:nodeId/progress`

Learner with an ACTIVE or COMPLETED enrollment (others `404`). Body (`UpdateLessonProgressBody`):

| Field | Lesson type | Meaning |
|-------|-------------|---------|
| `positionSec` | `VIDEO_LECTURE` only | Current playback position (integer seconds). Send about every 15 s and on pause/exit |
| `completed` | video or reading | `true` marks the lesson done |

Response `200` (`LessonProgressResult`):

```json
{
  "nodeId": "n1…",
  "isCompleted": true,
  "completionPct": 100,
  "lastPositionSec": 545,
  "watchedSeconds": 545,
  "recorded": true,
  "programProgress": { "completedLessons": 1, "totalLessons": 4, "percent": 25 }
}
```

- `watchedSeconds` = furthest point reached; `lastPositionSec` = where to resume.
- QUIZ / ASSIGNMENT lessons → `400 VALIDATION_FAILED` (they complete through their own flows); `positionSec` on reading → `400`.
- Staff (previewing): `recorded: false`, `programProgress: null`, nothing saved.

### Added fields (all additive; existing clients keep working)

| Where | Field |
|-------|-------|
| `GET /v1/nodes/:nodeId` (`NodeContent`) | `progress: { isCompleted, completionPct, lastPositionSec, watchedSeconds }` for resuming videos |
| `GET /v1/programs/:slug` lessons (`ProgramNode`) | `isCompleted` (ticks in the curriculum; false when anonymous or staff) |
| `myEnrollment`, `GET /v1/enrollments/my-enrollments` (`MyEnrollmentRef`) | `completedLessons`, `totalLessons`; `progressPct` is now the real value |
| `GET /v1/admin/enrollments` and `/:id` | `completedLessons`, `totalLessons`; `progressPct` real |
| `api.contract.ts` | `ProgramProgress` type |
| `nodes.contract.ts` | `LessonProgress`, `UpdateLessonProgressBody`, `LessonProgressResult`, `VIDEO_COMPLETION_THRESHOLD`, `NODES_ENDPOINTS.nodeProgress` |

## Backend files

| File | Change |
|------|--------|
| `src/progress/progress.service.ts` | **New** global `ProgressService`: one SQL query computes progress for many enrollments; `refreshForLesson()` after a completion |
| `src/nodes/nodes.service.ts`, `nodes.controllers.ts`, `dto/node.dto.ts` | Progress endpoint; `progress` in lesson content |
| `src/quizzes/quizzes.service.ts` | Refresh progress after a passing attempt |
| `src/submissions/submissions.service.ts` | Refresh progress after grading `GRADED` |
| `src/programs/programs.service.ts`, `program-mapping.ts` | Per-lesson `isCompleted`, live progress in `myEnrollment` |
| `src/enrollments/enrollments.service.ts` | Live progress in learner and admin enrollment responses |
| `src/app.module.ts` | Registers `ProgressModule` |
| `test/progress.e2e-spec.ts` | **New**: 5 tests (video threshold and resume, reading, optional lessons ignored, quiz and grading, curriculum change, staff not recorded) |

No database migration: the existing `ProgressLog` and `Enrollment.progressPct` columns are used.

## What the apps should do

**Mobile / web learner**
- Video player: `POST …/progress` with `positionSec` every ~15 s, on pause and when leaving; resume from `NodeContent.progress.lastPositionSec`.
- Reading screen: a "تم الانتهاء" button → `{ "completed": true }`.
- Program screen: tick completed lessons (`isCompleted`), show `myEnrollment.completedLessons / totalLessons` and `progressPct`.
- Home / my programs: use `progressPct` from `GET /v1/enrollments/my-enrollments`.

**Admin dashboard**
- Enrollment list and detail can show `completedLessons / totalLessons` and a progress bar.

## Verification

- 49/49 end-to-end tests pass (5 new), build passes.
- Contracts re-copied to `techbox_dashboard/types/` and `teckbox_lms_app/src/types/`.
