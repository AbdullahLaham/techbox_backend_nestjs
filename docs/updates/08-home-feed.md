# Update 08: Home screen feed

Date: 2026-11-07 · Backend branch `feature/assignments`

## Problem

The mobile Home tab mixed real and mock data. The hero and stats were built from `/v1/enrollments/my-enrollments`. The weekly activity strip, the "مقترحة لك" carousel and the incubator card were hard-coded, and the bell badge was a static dot.

## What changed

One new read-only endpoint feeds the whole tab:

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/home?tz=Asia/Gaza` | `HomeResponse` (`src/types/home.contract.ts`) |

- Bearer token required. The response holds only the caller's own data, with `Cache-Control: private, max-age=0`.
- `tz` is the device's IANA timezone. It sets "today" and the Saturday-to-Friday week. Default `Asia/Gaza`. An unknown name returns `400 VALIDATION_FAILED`.

| Section | Field | Source / rule |
|---------|-------|---------------|
| Bell badge | `notifications.unreadCount`, `latestUnread` | Same count as `/v1/notifications/unread-count` |
| Hero | `continueLearning` | The ACTIVE program the student worked in last, or the newest ACTIVE one if they have not started any. Draft and archived programs are skipped. `nextLesson` is the first lesson in curriculum order that is not completed and can be acted on: unpublished quizzes and assignments are skipped, and so are assignments that were already submitted or closed. `assignmentId` is set for assignment lessons. |
| Stats | `stats` | Counts per enrollment status. Lessons use ProgressService, the same numbers as my-enrollments. |
| Weekly activity | `weeklyActivity` | Days with lesson progress (video or reading), a submission or a quiz attempt. Grading by staff does not count. |
| Assignments | `assignments` | Same visibility, state and overdue rules as `/v1/assignments`. `upcoming` lists the 3 nearest deadlines. |
| Recommended | `recommendedPrograms` | Catalog programs the student has not joined or applied to, open ones first, at most 6. Each includes its lesson count, total video length and seats. |
| Incubator | `incubator` | The current INCUBATOR_BATCH program and the caller's own enrollment status in it. |

There are no changes to the database or to any existing endpoint. The endpoint reuses the existing rules read-only (`ProgressService`, `visibleTo`, the assignment state helpers, the seat rules in `program-mapping`, `NotificationsService`). It does not write: unlike my-enrollments, it does not refresh `Enrollment.progressPct`.

Performance: about 13 small queries in two parallel stages. The number of queries stays the same however much data the student has.

## Files

- `src/home/home.module.ts`: controller and module (registered in `app.module.ts`)
- `src/home/home.service.ts`: the aggregation
- `src/home/home-week.ts`: week and timezone helpers
- `src/home/home.dto.ts`: `tz` validation
- `src/types/home.contract.ts`: response types and an example (self-contained, so it can be copied into the app as is)
- Tests: `src/home/home-week.spec.ts`, `test/home.e2e-spec.ts`

## What the app should do

1. Copy `home.contract.ts` into `src/types/`.
2. Call `GET /v1/home?tz=${Intl.DateTimeFormat().resolvedOptions().timeZone}` with a `useHome()` query. Refetch it when the screen gets focus.
3. Replace the mock data:
   - Hero → `continueLearning`. Route to `/assignment/[assignmentId]` when `nextLesson.assignmentId` is set, otherwise to `/lesson/[nodeId]`.
   - Weekly strip → `weeklyActivity.days`.
   - Carousel → `recommendedPrograms`, with hours = `Math.round(videoDurationSec / 3600)`.
   - Incubator card → `incubator`.
   - Header dot → `notifications.unreadCount > 0`.
4. Optionally seed the bell's `['notifications','unread-count']` query from `notifications.unreadCount`.

## Known limit

`ProgressLog` stores only its first and last update. If a student works on the same lesson on several days, only the first and last of those days count as active. A full day-by-day history needs an activity log table, which is outside this read-only change.

## Verification

- Unit: 10/10. E2E: 71/71 across 10 suites, including the new home suite (8 tests). The home suite checks that `continueLearning` and the stats match my-enrollments, that overdue assignments match `/v1/assignments`, and that the endpoint does not write anything.
- `tsc` and `nest build` pass with no new errors. `oxlint` reports no new warnings.
