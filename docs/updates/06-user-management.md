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

## Dashboard page `/admin/users`

Replaces the "coming soon" page (sidebar item renamed «المستخدمون والصلاحيات»; visible to owners and managers only).

| Part | Behaviour |
|------|-----------|
| Role tabs with counts | From `roleCounts` (follow the search, ignore the filters) |
| Search (debounced), status filter with counts, sort, paging | Any change returns to page 1; previous page stays on screen while loading |
| Table | Name (+ «أنت» on your own row), email, role and status badges, last seen (relative), created; archived rows dimmed |
| «إضافة مستخدم» | Only roles you may create; password with generate / show / copy; server errors under the field; afterwards shows the temporary password once and offers to open the account |
| Detail panel | Profile, sessions, stats; edit name/phone (also on yourself); change role and status with confirm dialogs (hidden on yourself and when `canManage` is false); reset password (resetting your own signs you out) |

| File | |
|------|-|
| `app/(admin)/admin/users/page.tsx` | Page |
| `components/users/admin/users-directory.tsx` | List, tabs, filters, paging |
| `components/users/admin/create-user-dialog.tsx` | Create dialog |
| `components/users/admin/user-panel.tsx` | Detail panel and actions |
| `components/users/admin/user-parts.tsx` | Badges, form field, password input |
| `hooks/use-admin-users.ts` | React Query reads and writes (write result replaces the row, then lists refetch) |
| `services/users-admin-service.ts`, `lib/users.ts` | API calls; validation, badge colours, password generator |
| `config/navigation.ts` | Labels |

## Verification

- End-to-end 63/63 (8 new), unit tests, build and typecheck pass.
- Contract copied to `techbox_dashboard/types/` and `teckbox_lms_app/src/types/`; both typecheck.
- Dashboard: typecheck, lint and `next build` compile pass (`/admin/users` prerendered).
