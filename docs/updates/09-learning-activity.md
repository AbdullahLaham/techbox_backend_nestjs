# Update 09: Learning activity log

Date: 2026-11-09 · Backend branch `feature/assignments`

## Problem

The weekly strip of `GET /v1/home` (update 08) got its days from `ProgressLog`, which keeps only the first and last update of each lesson. If a student opened the same lesson on Monday, Wednesday and Friday, Wednesday was lost.

## What changed

### Database (migration `20261109120000_learning_activity`, additive only)

```prisma
model LearningActivity {
  userId      String
  bucketStart DateTime // start of a 15-minute window, UTC
  @@id([userId, bucketStart])
}
```

- **One row per student per 15-minute window with activity.** Every UTC offset in use is a multiple of 15 minutes (including +5:30 and +5:45), so a window never spans two local days in any timezone. Repeated video-progress saves collapse into one row.
- **Backfill:** the migration fills the table from the existing history: video and reading progress (first and last update), submissions, and quiz attempts. Days that `ProgressLog` already overwrote cannot be recovered.
- When a user is deleted, their rows are deleted too.

### Writes (best effort)

`ActivityService.record(userId)` (`src/activity/activity.service.ts`, a global module) is called after a student action has been saved:

| Action | Where |
|--------|-------|
| Lesson progress (video / reading) | `NodesService.updateProgress`, after the progress upsert. Staff previews are not recorded. |
| Assignment submission | `SubmissionsService.submit`, after the transaction |
| Quiz attempt (passed or not) | `QuizzesService.submit`, after the transaction. Staff previews are not recorded. |

It runs one `INSERT … ON CONFLICT DO NOTHING`, so it is idempotent. Like `NotificationsService.notify`, it logs a failure (`activity.record_failed`) and never throws, so it cannot fail the student's action. Responses and the existing rules are unchanged. Grading is not recorded: it is the grader's action, not the student's.

### Reads

`GET /v1/home` builds `weeklyActivity` from this table with one query on the primary key. The API response is unchanged.

## Deploying

Run `npx prisma migrate deploy`. It is additive and safe on a live database.

## Verification

- Unit tests: the window math, including the +5:30 and +5:45 timezones, and `record` never throwing.
- E2E (`test/home.e2e-spec.ts`): lesson progress, a submission and a failed quiz attempt each write exactly one row. A repeated record in the same window is a no-op. Activity at the start of the week shows on Saturday.
- The backfill's SQL bucket expression was checked against the JS one on edge timestamps.
- Unit tests 13/13, e2e tests 73/73. `tsc` passes with no errors.
