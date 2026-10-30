# Update 06: User management API

Date: 2026-10-30 · Backend branch `feature/assignments`

## Problem

Staff accounts (instructors, mentors, managers) could only be created through the seed or directly in the database. Nobody could change a role, suspend someone, or reset a password from the dashboard (`/admin/users` was a "coming soon" page).

## What changed

New API `/v1/admin/users` for `SUPER_ADMIN` and `INCUBATOR_MANAGER`. Full contract for the dashboard: **`api-contract-users.md`**.

| Endpoint | Purpose |
|----------|---------|
| `GET /v1/admin/users` | Paged list; search (email, names, phones), role/status filters, sort (created, email, last seen), counts per role and status |
| `GET /v1/admin/users/:id` | Profile, active sessions, stats (enrollments, hand-ins, quiz attempts, grading done) |
| `POST /v1/admin/users` | Create an account with a role and an initial password (active immediately) |
| `PATCH /v1/admin/users/:id` | Edit name / phone |
| `PATCH /v1/admin/users/:id/role` | Change role |
| `PATCH /v1/admin/users/:id/status` | `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `POST /v1/admin/users/:id/password` | Set a new password |

### Rules

| Rule | Result |
|------|--------|
| `SUPER_ADMIN` manages every role; `INCUBATOR_MANAGER` manages `INSTRUCTOR`, `MENTOR`, `STUDENT`, `GUEST` | Otherwise `403 FORBIDDEN` |
| Nobody changes their own role or status | `409 CANNOT_MODIFY_SELF` |
| The last active `SUPER_ADMIN` cannot be demoted, suspended or archived | `409 LAST_SUPER_ADMIN` (defensive: with the self rule above it cannot normally happen) |
| Role / status changes | Effective on the user's next request (the JWT strategy reads both from the database) |
| `SUSPENDED`, `ARCHIVED`, password reset | All sessions revoked: signed out on every device |
| No delete | `ARCHIVED` keeps enrollments, hand-ins and grades |
| Duplicate email / phone | `409 EMAIL_TAKEN` / `PHONE_TAKEN` with `details` |

Each list item and detail has `canManage` (false for your own account and for roles above yours) so the UI shows actions only when allowed.

## Database

Migration `…_user_last_seen`: `User.lastSeenAt` (nullable), set on every sign-in and session refresh (`AuthService.issueTokens`). Used for "last seen" and sorting. Run `npx prisma migrate deploy` (now 8 migrations).

## Contracts

`src/types/api.contract.ts` (copied to both apps): `UserStatus`, `GLOBAL_ROLES`, `SETTABLE_USER_STATUSES`, `USER_MANAGER_ROLES`, `MANAGEABLE_ROLES`, `canManageRole()`, `USER_LIMITS`, `AdminUserSort`, `AdminUserListQuery`, `AdminUserListItem`, `AdminUserList`, `AdminUserDetail`, `CreateUserBody`, `UpdateUserBody`, `ChangeUserRoleBody`, `ChangeUserStatusBody`, `ResetUserPasswordBody`, `ROLE_LABELS_AR`, `USER_STATUS_LABELS_AR`, `API_ENDPOINTS.adminUsers` / `adminUser` / `adminUserRole` / `adminUserStatus` / `adminUserPassword`; error codes `EMAIL_TAKEN`, `PHONE_TAKEN`, `CANNOT_MODIFY_SELF`, `LAST_SUPER_ADMIN` with Arabic messages.

## Backend files

| File | Change |
|------|--------|
| `src/users/admin-users.service.ts` | **New**: rules, queries, session revocation, audit log (no passwords logged) |
| `src/users/users.module.ts` | **New**: controller `/v1/admin/users` |
| `src/users/dto/admin-user.dto.ts` | **New**: validation |
| `src/auth/auth.service.ts` | Sets `lastSeenAt` on sign-in and refresh |
| `src/common/api-errors.ts`, `src/types/api.contract.ts` | New codes and types |
| `prisma/schema.prisma` + migration | `User.lastSeenAt` |
| `src/app.module.ts` | Registers `UsersModule` |
| `test/users.e2e-spec.ts` | **New**: 8 tests (access, list/search/counts/canManage, create within rights + sign-in, duplicates, profile edits, role changes taking effect immediately, suspend signs out / reactivate / archive, owners and the last owner, password reset) |
| `api-contract-users.md` | **New**: dashboard contract with a page outline and a service sketch |
| `api-contract-admin.md` | Roles table and section 9b link to it |

## Dashboard work (not done here)

Build `/admin/users` from `api-contract-users.md` §4: tabs with counts, search and filters, table, "add user" dialog, detail panel, role/status/password actions shown when `canManage`.

## Verification

- End-to-end 63/63 (8 new), unit tests, build and typecheck pass.
- Contract copied to `techbox_dashboard/types/` and `teckbox_lms_app/src/types/`; both typecheck.
