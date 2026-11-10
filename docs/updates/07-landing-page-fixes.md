# Update 07: Landing page fixes and Next.js security upgrade

Date: 2026-11-05 · Dashboard branch `feature/landing-page` · No backend code changed

Status: committed in the dashboard as `4478948` (Next.js upgrade) and `21ab7dd` (landing page).

## Problem

| Problem | Effect |
|---------|--------|
| Next.js 16.4.0 had critical advisories (GHSA-2464-fhr4-w9xw, GHSA-673q-mjm6-r5xr: unauthenticated remote code execution; GHSA-p3m5-59mp-jv5r: denial of service) | Exposed further by a public page |
| The landing page's text was not in the first HTML | Visitors saw only the loading screen until the JavaScript loaded |
| The page mentioned programs for children and called TechBox an accelerator («مسرّعة») | TechBox is an incubator («حاضنة») and offers nothing for children here |
| Programs were static descriptions | Visitors could not see what is open now |

## What changed

| Change | Detail |
|--------|--------|
| Next.js | `next` and `eslint-config-next` 16.4.0 → 16.4.5 (latest stable). `package-lock.json` changes only those versions |
| Wording | Removed both mentions of children; pipeline eyebrow is now «حاضنة TechBox» |
| First HTML | `AuthGuardProvider` reads `window.location.search` when it needs it, instead of `useSearchParams`, which suspended prerendering of every public page |
| «التسجيل مفتوح الآن» | New block under the program types, from `GET /v1/programs`: programs with `canEnroll`, up to 3, those still to start first (soonest on top), with start date and seats left |

The new block loads in the browser, so the page stays static and a build never needs the API. It disappears when nothing is open or the API fails or is down; the rest of the page is not affected.

### Files (dashboard)

| File | Change |
|------|--------|
| `package.json`, `package-lock.json` | Upgrade |
| `providers/auth-guard-provider.tsx` | No `useSearchParams` |
| `app/layout.tsx` | Comment only: the root `Suspense` must stay |
| `components/landing/content.ts` | Wording; text for the new block |
| `components/landing/open-programs.tsx` | **New**: the block |
| `components/landing/programs-section.tsx` | Renders the block |

## Known limitation

The text is now in the HTML, but React places it in a hidden element behind the root `Suspense` fallback, and a small inline script reveals it. Visitors with JavaScript see the page long before the bundle finishes (see Verification). Visitors with JavaScript fully disabled still see only the loading screen.

Removing the root `Suspense` does not work: `next build` fails on `/admin/content/[slug]` because `usePathname()` must be inside `Suspense` on dynamic routes. A complete fix needs a separate root layout for the landing page, which moves the app's route folders.

## Upgrade incident

The upgrade needed two attempts and a repair. Nothing was lost.

1. First attempt: failed with `ECONNRESET` on a slow connection. npm rolled back to 16.4.0.
2. Second attempt: succeeded (51 minutes), but the running dashboard dev server held `next-swc.win32-x64-msvc.node` open, so npm hit `EPERM`, and `@next/swc-win32-x64-msvc` was left missing.
3. Repair, once no process held the file: removed npm's leftover temp folder and ran `npm install`, which restored the package from the lockfile.

**Stop the dashboard dev server before upgrading packages on Windows.**

## Verification

- `tsc`, ESLint and `next build` pass on 16.4.5.
- `node_modules` compared with `package-lock.json`: 613 packages match; none required missing, none at the wrong version, no npm leftovers; the compiler's native module loads.
- `npm ls` still exits 1 on three optional wasm packages dated 2026-10-07 (`@img/sharp-wasm32`, `@napi-rs/wasm-runtime`, `@tybys/wasm-util`). They are older than this work and are in the committed lockfile. Build, typecheck and lint are not affected.
- Headless Chrome on the production build, 32 of 32 checks, with API responses mocked inside the browser except where noted:
  - no mention of children or «مسرّعة» anywhere in the page;
  - list order, limit, closed programs excluded, date and seats, card link;
  - no sideways scroll at phone width;
  - block hidden for an empty list, API 500 and API down;
  - no console errors;
  - sign-in redirects: `?redirect=` honoured, `//evil.example` rejected, a student not sent into `/admin`, signed-in users sent from `/` to their home;
  - the real backend on `:5000` (public catalog, read only).
- First visit at 1.5 Mbps and 300 ms latency, empty cache: heading visible at about 1.2 s; JavaScript finished at about 4.1 s.

`npm audit` after the upgrade: **0 critical** (Next.js advisories gone). 14 remain: 1 high (`follow-redirects`), 11 moderate, 2 low. Most come from dev tools (`eslint-config-next`, `shadcn`); the suggested forced fixes would downgrade or change major versions, so they were not applied.

## Still open

- Placeholder statistics and testimonials in `components/landing/content.ts` must be replaced or hidden before launch.
- «متابعة مراحل نمو شركتك على المنصة» promises a feature the backend does not have yet (no startup model).
- The public Instagram profile still has a highlight about children, which the landing page links to.
- The landing page branch is not merged into `master`.
