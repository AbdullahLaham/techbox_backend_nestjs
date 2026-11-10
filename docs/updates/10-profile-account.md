# Update 10: Profile tab: profile, account security, achievements, certificates

Date: 2026-11-10 · Backend branch `feature/assignments`, mobile branch `feature/lms-platform`

## Problem

The mobile Profile tab had four rows (تعديل الملف الشخصي، الشهادات والإنجازات، إعدادات الحساب، الأمان والخصوصية) that did nothing. Only signing out worked.

The backend had no route for a learner to edit their own profile, change their password or delete their account. It also had no certificates. App stores require in-app account deletion for any app that creates accounts.

## Decisions

- **One section instead of two.** "إعدادات الحساب" and "الأمان والخصوصية" are merged into **الحساب والأمان**. The app has no push notifications or other settings yet, so a separate settings page would only hold fake switches.
- **National ID and email are read-only** in the app. They are official data used in applications, and changing the email needs an email service, which does not exist yet.
- **Account deletion** closes the account (`ARCHIVED`) and erases personal data:
  - Learning records (submissions, grades, quiz results, progress) stay, attached to an anonymous profile, so program reports remain correct.
  - Open enrollments become `DROPPED`, which frees their seats.
  - Certificates are revoked.
  - The email can register again.
  - Staff accounts cannot be deleted from the app.
- **Certificates are automatic**: one per `COMPLETED` enrollment, with a verification code. A certificate is revoked while its enrollment is reopened, and valid again once it is completed again.

## What changed (backend)

| Method | Path | Notes |
|--------|------|-------|
| GET / PATCH | `/v1/me/profile` | PATCH changes only the fields that are sent; `nationalId` is refused with `400` |
| POST / DELETE | `/v1/me/avatar` | JPG / PNG / WEBP, up to 2 MB, real type checked; the old file is deleted |
| POST | `/v1/me/password` | Checks the current password, ends every session, returns a new pair for this device; rate limited |
| POST | `/v1/me/logout-all` | Ends every session |
| DELETE | `/v1/me` | Password confirmation; students and guests only; rate limited |
| GET | `/v1/me/achievements?tz=` | Stats and 9 badges; lesson counts match Home |
| GET | `/v1/me/certificates` | Issues missing certificates, then lists them |
| GET | `/v1/certificates/verify/:code` | Public, rate limited, case and spaces ignored |

- **Database:** migration `20261110090000_certificates`, additive (a new `Certificate` table).
- **Certificate issuing:** certificates follow the enrollments without a hook in the enrollment code. A sync runs when the learner lists their certificates and when a code is verified. Enrollments that were already `COMPLETED` get certificates the first time. The name printed is the Arabic full name, else the English one, else the first and last name, fixed at issue time.
- **Avatars:** `UserProfile.avatarUrl` now holds a storage key. `/v1/home`, `/v1/me/profile` and `/v1/admin/users` return a signed link that lasts one hour. Older values that are full URLs are returned as they are.
- **`AuthService.issueTokens`** is now public, so a password change creates the new session exactly as a login does.
- Types are in `src/types/profile.contract.ts` (self-contained, copied unchanged into the app).

## What changed (mobile)

- **Profile tab:** the picture, name, email, bio and role; an achievements summary card; and three working rows.
- **`profile/edit`:** picture (pick, crop to square, upload, remove), names, contact details, governorate, bio, and a read-only email and national ID. The app asks before discarding unsaved changes, and server errors show under their fields.
- **`profile/achievements`:**
  - Certificates with their verification code, with copy and share buttons.
  - Stats, and the 9 badges with progress bars.
- **`profile/account`:**
  - Change password.
  - Sign out of all devices.
  - Support links and the app version.
  - Delete account, with a clear list of what is erased and what stays, and password confirmation.
- **Support contact:** set `EXPO_PUBLIC_SUPPORT_EMAIL` and/or `EXPO_PUBLIC_SUPPORT_WHATSAPP` (digits, international format) in the app's `.env`. Each row stays hidden until its value is set.

## Deploying

Run `npx prisma migrate deploy`. It is additive.

## Not included yet

- "Forgot password" and changing the email: both need an email service.
- A list of active devices: logins don't record the device name yet.
- Push-notification settings.
- A PDF certificate and a public web verification page. The API endpoint for verification exists already.
- The certificate is issued when the learner opens their certificates, not at the moment the admin completes the enrollment. So there is no notification "you got a certificate" yet.

## Verification

- Backend:
  - `tsc` passes with no errors.
  - Unit tests 19/19, including streak math and certificate codes.
  - E2E tests 84/84 across 11 suites. The new `test/me.e2e-spec.ts` (11 tests) covers profile edits and validation, avatar upload, replace and delete with signed links in Home and the admin list, the password change ending all sessions, logout-all, achievements, certificate issue, verification, revocation and restore, and account deletion end to end.
- Mobile: `tsc` and ESLint pass. The screens have **not** been run on a device yet.
