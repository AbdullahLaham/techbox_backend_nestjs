# Update 03: Housekeeping (repositories, contracts, summaries)

Date: 2026-10-29

## What changed

### Repositories

| Repo | Branch | Commits in this update | On GitHub |
|------|--------|------------------------|-----------|
| Backend `techbox-incubator-backend` | `feature/assignments` | `74564cd` progress (update 01), `682c696` notifications (update 02), this update's docs | Pushed to `AbdullahLaham/techbox_backend_nestjs` |
| Mobile `teckbox_lms_app` | `feature/lms-platform` | `df989fa` contract sync, `fe39d4b` courses tab and compact program card (your in-progress redesign, committed as it was; typecheck passes) | Pushed to `AbdullahLaham/techbox_expo_app` |
| Dashboard `techbox_dashboard` | `feature/lms-platform` | `d915321` contract sync | **Not on GitHub**: the repo has no remote (see "Still to do") |

All three working trees are clean.

### Contracts

`src/types/api.contract.ts` and `src/types/nodes.contract.ts` (progress and notification types) were re-copied into `techbox_dashboard/types/` and `teckbox_lms_app/src/types/`. Both apps typecheck with them.

### Documentation

| File | Change |
|------|--------|
| `docs/updates/01-program-progress.md` | New: lesson completion and program progress |
| `docs/updates/02-notifications.md` | New: notifications API and triggers |
| `docs/updates/README.md` | New: index of update notes |
| `api-contract-mobile.md` | Progress endpoint, notifications section (§9), screen map rows |
| `api-contract-admin.md` | Progress in enrollments, progress and bell rows for the learner pages, which admin actions notify |
| `BUILD_SUMMARY_DASHBOARD.md` | "Already built" now lists grading and hand-in; "left to build" is now lesson progress, the notification bell and the mocked overviews |
| `BUILD_SUMMARY_MOBILE.md` | "Already built" now lists the hand-in form and refresh tokens; "left to build" is now lesson progress and the notifications tab |

## Still to do (needs you)

1. **Dashboard on GitHub.** The GitHub CLI is not installed here, so the repository could not be created automatically. Create an empty repository (for example `techbox_dashboard`), then from `techbox_dashboard`:
   ```
   git remote add origin https://github.com/AbdullahLaham/<repo>.git
   git push -u origin master
   git push -u origin feature/lms-platform
   ```
2. **Merge after review.** The feature branches are not merged into `main` / `master`; open pull requests on GitHub (or merge locally) once you have reviewed them.
3. **Other environments.** Run `npx prisma migrate deploy` (now 7 migrations, including `notification_types`).
