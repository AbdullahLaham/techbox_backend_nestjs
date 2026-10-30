# API contract: User management (web dashboard `/admin/users`)

Everything the dashboard needs to list accounts, create staff, edit profiles, change roles, suspend / reactivate / archive accounts, and reset passwords.

- TypeScript types: `src/types/api.contract.ts`, section **User management** (copied to the dashboard as `types/api.contract.ts`): `AdminUserListQuery`, `AdminUserList`, `AdminUserListItem`, `AdminUserDetail`, `CreateUserBody`, `UpdateUserBody`, `ChangeUserRoleBody`, `ChangeUserStatusBody`, `ResetUserPasswordBody`, `MANAGEABLE_ROLES`, `canManageRole()`, `ROLE_LABELS_AR`, `USER_STATUS_LABELS_AR`, `API_ENDPOINTS.adminUser*`.
- Conventions (auth, errors, dates) are the same as `api-contract-admin.md`.

## 1. Who can do what

Route access: `SUPER_ADMIN` and `INCUBATOR_MANAGER` (`USER_MANAGER_ROLES`). Others get `403`. The dashboard's `lib/auth/rbac.ts` already restricts `/admin/users` to these roles.

| Caller | May view | May create / edit / change role / suspend / reset password |
|--------|----------|-------------------------------------------------------------|
| `SUPER_ADMIN` | Everyone | Every role, including other `SUPER_ADMIN`s |
| `INCUBATOR_MANAGER` | Everyone | `INSTRUCTOR`, `MENTOR`, `STUDENT`, `GUEST` only (not owners or other managers) |

Rules (enforced by the API; mirror them in the UI with `canManage` / `canManageRole()`):

1. A user is **manageable** when their current role is in `MANAGEABLE_ROLES[callerRole]`. A role change also needs the **new** role in that list.
2. **Nobody changes their own role or status** → `409 CANNOT_MODIFY_SELF`. You can still edit your own name/phone and reset your own password.
3. The **last active `SUPER_ADMIN`** can never be demoted, suspended or archived → `409 LAST_SUPER_ADMIN`.
4. **Role and status changes apply on the user's next request** (the API reads them from the database each time), no new sign-in needed.
5. **`SUSPENDED` / `ARCHIVED` / password reset sign the user out on every device** (all refresh tokens revoked; access tokens refused).
6. There is **no delete**: `ARCHIVED` is for people who left. Their enrollments, hand-ins and grades are kept.

Every list item and detail carries `canManage: boolean` for the caller: show the action buttons only when it is `true`.

## 2. Endpoints

| Method | Path | Body / query | Success |
|--------|------|--------------|---------|
| GET | `/v1/admin/users` | `?page&pageSize&q&role&status&sort` | `200 AdminUserList` |
| GET | `/v1/admin/users/:id` | | `200 AdminUserDetail` |
| POST | `/v1/admin/users` | `CreateUserBody` | `201 AdminUserDetail` |
| PATCH | `/v1/admin/users/:id` | `UpdateUserBody` | `200 AdminUserDetail` |
| PATCH | `/v1/admin/users/:id/role` | `{ "role": "INSTRUCTOR" }` | `200 AdminUserDetail` |
| PATCH | `/v1/admin/users/:id/status` | `{ "status": "SUSPENDED" }` | `200 AdminUserDetail` |
| POST | `/v1/admin/users/:id/password` | `{ "password": "…" }` | `204` |

### 2.1 List: `GET /v1/admin/users`

| Param | Default | Notes |
|-------|---------|-------|
| `page` | 1 | |
| `pageSize` | 20 | 1 to 100 |
| `q` | | Case-insensitive: email, first/last name, Arabic/English full name, phone, WhatsApp |
| `role` | all | `SUPER_ADMIN`, `INCUBATOR_MANAGER`, `INSTRUCTOR`, `MENTOR`, `STUDENT`, `GUEST` |
| `status` | all | `PENDING`, `ACTIVE`, `SUSPENDED`, `ARCHIVED` |
| `sort` | `-createdAt` | `createdAt`, `email`, `lastSeenAt`, each with optional `-` (descending). Never-seen users sort last |

Response (`AdminUserList`):

```json
{
  "items": [
    {
      "id": "u1…",
      "email": "sara@example.com",
      "globalRole": "STUDENT",
      "status": "ACTIVE",
      "firstName": "Sara",
      "lastName": "Ahmad",
      "displayName": "سارة أحمد",
      "phoneNumber": "+970599000000",
      "avatarUrl": null,
      "createdAt": "2026-10-07T05:28:16.360Z",
      "lastSeenAt": "2026-10-30T09:12:00.000Z",
      "canManage": true
    }
  ],
  "page": 1,
  "pageSize": 20,
  "total": 57,
  "roleCounts": { "SUPER_ADMIN": 1, "INCUBATOR_MANAGER": 2, "INSTRUCTOR": 4, "MENTOR": 3, "STUDENT": 47, "GUEST": 0 },
  "statusCounts": { "PENDING": 0, "ACTIVE": 54, "SUSPENDED": 2, "ARCHIVED": 1 }
}
```

- `displayName`: Arabic full name when the person gave one (enrollment form), else "first last", else the email.
- `lastSeenAt`: last sign-in or session refresh (null = never signed in).
- `roleCounts` / `statusCounts` follow the search `q` but ignore the `role` / `status` filters, so tab badges stay stable while filtering.

### 2.2 Detail: `GET /v1/admin/users/:id`

`AdminUserDetail` = the list item plus:

```json
{
  "updatedAt": "2026-10-30T09:12:00.000Z",
  "profile": {
    "bio": null,
    "fullNameAr": "سارة أحمد محمد",
    "fullNameEn": "Sara Ahmad",
    "phoneWhatsApp": "+970599000000",
    "governorate": "غزة",
    "age": 22
  },
  "activeSessions": 2,
  "stats": { "enrollments": 2, "activeEnrollments": 1, "submissions": 5, "quizAttempts": 3, "gradedSubmissions": 0 }
}
```

`activeSessions` = signed-in devices. `gradedSubmissions` = hand-ins this person graded (staff).

### 2.3 Create: `POST /v1/admin/users`

```json
{
  "email": "mona@techbox.com",
  "password": "temporary-pass-2026",
  "firstName": "منى",
  "lastName": "خالد",
  "role": "INSTRUCTOR",
  "phoneNumber": "+970599111111"
}
```

| Field | Rules |
|-------|-------|
| `email` | Valid email, unique (case-insensitive) → `409 EMAIL_TAKEN` |
| `password` | 8 to 128 characters. Share it with the person securely; they sign in with it right away |
| `firstName`, `lastName` | 1 to 100 |
| `role` | In `MANAGEABLE_ROLES[callerRole]` → else `403 FORBIDDEN` |
| `phoneNumber` | Optional, ≤ 30, unique → `409 PHONE_TAKEN` |

The account is `ACTIVE`. Response `201`: the new `AdminUserDetail`.

### 2.4 Edit profile: `PATCH /v1/admin/users/:id`

`{ "firstName"?, "lastName"?, "phoneNumber"? }`; omitted = unchanged, `phoneNumber: null` clears it. Allowed on manageable users and on your own account.

### 2.5 Change role: `PATCH /v1/admin/users/:id/role`

`{ "role": "MENTOR" }`. Both the current and the new role must be manageable by the caller. Not on yourself. Same role = no change (`200`).

### 2.6 Change status: `PATCH /v1/admin/users/:id/status`

`{ "status": "ACTIVE" | "SUSPENDED" | "ARCHIVED" }` (`PENDING` is not settable → `400`).

| To | Effect |
|----|--------|
| `SUSPENDED` | Signed out on all devices; cannot sign in; data kept. Reversible |
| `ARCHIVED` | Same as suspended, for people who left |
| `ACTIVE` | Can sign in again |

Not on yourself; not on the last active `SUPER_ADMIN`.

### 2.7 Reset password: `POST /v1/admin/users/:id/password`

`{ "password": "new-temporary-pass" }` (8 to 128). Response `204`. Every session of that user is revoked (they must sign in with the new password). Allowed on manageable users and yourself (you will be signed out too).

## 3. Errors

| HTTP | `code` | When | UI |
|------|--------|------|----|
| 400 | `VALIDATION_FAILED` | Bad field; `details` maps `email`, `password`, `firstName`, `lastName`, `phoneNumber`, `role`, `status` | Message under the field |
| 401 | `UNAUTHORIZED` | Session expired | Refresh / login |
| 403 | `FORBIDDEN` | Caller's role cannot open the page, or cannot manage that role | Hide the action (`canManage`); show the message if it still happens |
| 404 | `NOT_FOUND` | Unknown user id | Back to the list |
| 409 | `EMAIL_TAKEN` / `PHONE_TAKEN` | Duplicate (`details.email` / `details.phoneNumber`) | Message under the field |
| 409 | `CANNOT_MODIFY_SELF` | Own role or status | Disable those controls on your own row |
| 409 | `LAST_SUPER_ADMIN` | Last active owner | Show the message |

Arabic messages: `API_ERROR_MESSAGES_AR[code]`; `lib/api-error.ts` (`getApiErrorMessage`, `getApiErrorDetails`) already handles this shape.

## 4. Suggested page

| Part | Calls |
|------|-------|
| Tabs by role or status with counts | `roleCounts` / `statusCounts` from the list |
| Search box (debounced) + role/status filters + sort | `GET /v1/admin/users?q&role&status&sort&page` |
| Table: name (`displayName`), email, role badge (`ROLE_LABELS_AR`), status badge (`USER_STATUS_LABELS_AR`), last seen, created | List items |
| "إضافة مستخدم" dialog: email, name, role (only `MANAGEABLE_ROLES[myRole]`), phone, password (with a "generate" button) | `POST /v1/admin/users` |
| Row / detail panel: profile, stats, active sessions | `GET /v1/admin/users/:id` |
| Actions when `canManage`: change role (select limited to `MANAGEABLE_ROLES[myRole]`), suspend / reactivate / archive (confirm dialog: "سيتم تسجيل خروجه من جميع الأجهزة"), reset password | `PATCH …/role`, `PATCH …/status`, `POST …/password` |
| Edit name/phone | `PATCH /v1/admin/users/:id` |

After any write, replace the row with the returned `AdminUserDetail` and refetch the list (counts change).

```ts
// services/users-admin-service.ts (sketch)
import { apiClient } from '@/services/auth-service';
import { API_ENDPOINTS, type AdminUserDetail, type AdminUserList, type AdminUserListQuery,
  type CreateUserBody, type UpdateUserBody, type GlobalRole, type ChangeUserStatusBody } from '@/types/api.contract';

export const usersAdminService = {
  list: (query: AdminUserListQuery, signal?: AbortSignal) =>
    apiClient.get<AdminUserList>(API_ENDPOINTS.adminUsers, { params: query, signal }).then((r) => r.data),
  get: (id: string) => apiClient.get<AdminUserDetail>(API_ENDPOINTS.adminUser(id)).then((r) => r.data),
  create: (body: CreateUserBody) => apiClient.post<AdminUserDetail>(API_ENDPOINTS.adminUsers, body).then((r) => r.data),
  update: (id: string, body: UpdateUserBody) =>
    apiClient.patch<AdminUserDetail>(API_ENDPOINTS.adminUser(id), body).then((r) => r.data),
  changeRole: (id: string, role: GlobalRole) =>
    apiClient.patch<AdminUserDetail>(API_ENDPOINTS.adminUserRole(id), { role }).then((r) => r.data),
  changeStatus: (id: string, status: ChangeUserStatusBody['status']) =>
    apiClient.patch<AdminUserDetail>(API_ENDPOINTS.adminUserStatus(id), { status }).then((r) => r.data),
  resetPassword: (id: string, password: string) =>
    apiClient.post<void>(API_ENDPOINTS.adminUserPassword(id), { password }),
};
```
