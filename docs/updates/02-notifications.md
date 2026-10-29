# Update 02: Notifications API

Date: 2026-10-29 · Backend branch `feature/assignments`

## Problem

Grading already saved notifications for students, but there was no endpoint to read them, so the mobile notifications tab (and any web bell) stayed empty. Enrollment decisions and new assignments did not notify anyone.

## What changed

### Reading notifications (any signed-in user, own notifications only)

| Method | Path | Response |
|--------|------|----------|
| GET | `/v1/notifications?page=1&pageSize=20&unreadOnly=false` | `NotificationList` = `{ items, page, pageSize, total, unreadCount }`, newest first (`pageSize` ≤ 50) |
| GET | `/v1/notifications/unread-count` | `{ "unreadCount": 3 }` (cheap, for the bell badge) |
| PATCH | `/v1/notifications/:id/read` | The updated notification; `404` when it is not the caller's |
| POST | `/v1/notifications/read-all` | `{ "updated": 3, "unreadCount": 0 }` |

A notification (`AppNotification`):

```json
{
  "id": "nt1…",
  "type": "NEW_ASSIGNMENT",
  "title": "واجب جديد",
  "message": "بناء واجهة تسجيل الدخول: تطوير التطبيقات بـ React Native",
  "isRead": false,
  "actionUrl": "/assignments/as1…",
  "createdAt": "2026-10-29T09:00:00.000Z"
}
```

`actionUrl` is a resource path, not an app route; each app maps it to its own screen:

| `actionUrl` | Mobile screen | Web page |
|-------------|---------------|----------|
| `/assignments/<id>` | `assignment/[assignmentId]` | `/assignments/[id]` |
| `/programs/<slug>` | `course/[slug]` | `/programs/[slug]` |

### When notifications are sent

| Trigger | Who receives it | `type` | Title |
|---------|-----------------|--------|-------|
| Assignment published for the first time (or again after being unpublished to draft) in a visible program | Every **ACTIVE** learner of the program | `NEW_ASSIGNMENT` | واجب جديد |
| Admin changes an enrollment status | That student; message = program title + the admin's note | `ENROLLMENT` | تم قبول طلب انضمامك / لم يتم قبول طلب انضمامك / تم إيقاف وصولك إلى البرنامج مؤقتاً / تهانينا، أتممت البرنامج / تم إلغاء تسجيلك في البرنامج / طلب انضمامك قيد المراجعة مجدداً |
| Reviewer grades a hand-in (`GRADED`, `NEEDS_REVISION`, `REJECTED`) (existing) | The student | `GRADED` | تم تقييم واجبك / واجبك يحتاج إلى تعديل / تم رفض تسليم واجبك |

Not sent: restoring an archived assignment, publishing in a draft or archived program, `UNDER_REVIEW`. Sending is best effort: a failure is logged and never undoes the action that triggered it.

Reserved types, not sent yet: `SYSTEM`, `ANNOUNCEMENT`, `ASSIGNMENT_DUE` (deadline reminders need a scheduled job).

## Database

Migration `20261029…_notification_types`: adds `ENROLLMENT` and `NEW_ASSIGNMENT` to the `NotificationType` enum. Existing notifications are unchanged. Run `npx prisma migrate deploy` in every environment.

## Contracts

`src/types/api.contract.ts` (copied to both apps):

- `NotificationType`, `AppNotification`, `NotificationListQuery`, `NotificationList`, `UnreadCount`, `ReadAllResult`
- `API_ENDPOINTS.notifications`, `notificationsUnreadCount`, `notificationRead(id)`, `notificationsReadAll`

## Backend files

| File | Change |
|------|--------|
| `prisma/schema.prisma` + migration | Two new `NotificationType` values |
| `src/notifications/notifications.service.ts` | **New** `NotificationsService`: `notify(userIds, …)` for other modules; list, unread count, mark read, read all |
| `src/notifications/notifications.module.ts`, `notification.dto.ts` | **New** controller `/v1/notifications` (global module) |
| `src/enrollments/enrollments.service.ts` | Notifies the student after a status change |
| `src/assignments/admin-assignments.service.ts` | Notifies ACTIVE learners when an assignment is published |
| `src/app.module.ts` | Registers `NotificationsModule` |
| `test/notifications.e2e-spec.ts` | **New**: 3 tests (publish recipients, no repeat on restore, draft programs, enrollment decisions with note, list/paging/unread/mark read/read all, owner-only) |

## What the apps should do

- **Bell / tab badge**: `GET /v1/notifications/unread-count` on app focus (and after actions).
- **Notifications screen**: `GET /v1/notifications` with paging; tapping an item → `PATCH …/:id/read`, then open the mapped `actionUrl`; a "تعليم الكل كمقروء" button → `POST …/read-all`.
- Icons by `type`: `GRADED` (grade), `ENROLLMENT` (person/check), `NEW_ASSIGNMENT` (task).
- No push notifications yet (in-app only).

## Verification

- 52/52 end-to-end tests pass (3 new), build passes.
- Contracts re-copied to `techbox_dashboard/types/` and `teckbox_lms_app/src/types/`.
