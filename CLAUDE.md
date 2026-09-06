# CLAUDE.md

Guidance for Claude Code when working on Earn Your A.

## What This Is

A student accountability and rewards app built for Jonathan's family. His high-school-age daughter (Susana) struggles with organization; the app tracks her assignments, ties her allowance to grades/completion per house rules, and gives Jonathan (and his wife) a parent dashboard to monitor and approve payouts. Long-term goal: validate on personal use, then possibly open up to other families (schema is already family-scoped for this reason — see Data Model below).

**Official name:** Earn Your A
**Domain:** earnyoura.com (Cloudflare-registered, live)
**Hosting:** Cloudflare Pages (git-integrated — pushes to `main` auto-deploy)
**Repo:** github.com/jsward01/earn-your-a
**Local path:** `~/earn-your-a` on CachyOS Linux
**Backend:** Cloudflare D1 (SQLite) via Pages Functions, chosen over Supabase to stay all-Cloudflare and avoid Supabase's free-tier auto-pause-after-inactivity behavior, which would be a bad fit for sporadic family use

## Current State — Where Things Stand

### ✅ Done
- **Frontend scaffolded and componentized**: Vite + React + TypeScript, Tailwind v4 (via `@tailwindcss/vite`, not the old v3 config style — don't reintroduce a `tailwind.config.js`/`@tailwind` directives, that was a real bug once already). Split from a single 1,744-line prototype file into `src/types.ts`, `src/data/`, `src/lib/` (pure logic — `rewards.ts` has the house reward-calculation rules as a testable pure function), and `src/components/{student,parent,shared}/`.
- **Deployed**: Cloudflare Pages project `earn-your-a`, custom domain `earnyoura.com` attached and live, git integration connected (`jsward01/earn-your-a`, branch `main`, build command `npm run build`, output dir `dist` — this got mis-set to `.vitepress/dist` once during setup, worth double-checking if deploys ever silently stop updating the live site).
- **D1 database provisioned**: `earn-your-a-db`, schema in `migrations/0001_init.sql` (families, users, reward_settings, assignments, reward_transactions, payout_requests, savings_goals, messages, notification_settings) and `migrations/0002_sessions.sql` (sessions). Applied to remote. `reward_transactions` is an append-only ledger — a student's balance is `SUM(amount)`, not a mutable column — this is intentional, matches the "negative balances carry forward" house rule, and gives a free audit trail.
- **Auth backend built**: `functions/api/auth/{login,logout,me,change-password}.ts`, password hashing via PBKDF2/Web Crypto (`functions/_lib/password.ts`), D1-backed sessions with an httpOnly cookie (`functions/_lib/session.ts`) — sessions are revocable (a real `sessions` table), not stateless JWTs. No signup endpoint exists on purpose — this is a closed 2-role family app, not open registration.
- **Frontend wired to real auth**: `LoginScreen` is a real email/password form (not the old demo role-picker), `App.tsx` checks `/api/auth/me` on load to restore sessions, header's logout button calls `/api/auth/logout`.
- **Two real accounts seeded** directly into remote D1 (no public signup flow): Jonathan Sward (parent, jsward01@gmail.com) and Susana Sward (student, susanas144@lpsk12.org). Temporary passwords were generated at seed time and given to Jonathan directly in chat — **not recorded here on purpose**. If they're lost, generate new ones and `UPDATE users SET password_hash = ...` directly, or add a password-reset flow.

- **D1 binding attached and login verified live**: the `DB` binding was added to the Pages project (dashboard-only — the available Cloudflare API token has read-only scope for Pages project mutations, every PATCH/POST attempt returned "Authentication error"). Confirmed live by hitting `/api/auth/login` with a deliberately wrong password and getting a clean "Invalid email or password" (i.e. a real D1 lookup happened, not a binding-missing crash).
- **Assignments wired to real D1 data**: `functions/api/assignments/index.ts` (GET list for the session's family, POST create) and `functions/api/assignments/[id].ts` (PATCH, DELETE) replace the old in-memory mock. `functions/_lib/assignments.ts` holds the shared row-mapping and the makeup-window state machine (`nextMakeupState`) — a missing/low-graded item opens a fixed `makeup_deadline` (from `reward_settings.makeup_window_days`, default 7) that does **not** reset on subsequent edits within the window (only clears once a retake reaches the passing threshold, which also flips `makeup_used`). Verified end-to-end against a local D1 instance (wrangler `--local`, seeded with a throwaway family/user, torn down after — no production data touched): create, repeated-failing-grade PATCH (deadline held steady), passing-retake PATCH (deadline cleared, `makeupUsed` set), delete, and auth-gating all behaved correctly.
  - Frontend: `Assignment.id` is now `string` (matches D1's `TEXT` primary key, was `number` for mock data). `src/lib/assignments.ts` maps API rows (`makeupDeadline`/`makeupUsed`) to the existing `daysLeft`/`makeupAvailable` fields the UI already reads. `src/lib/api.ts` gained `fetchAssignments`/`createAssignment`/`updateAssignment`/`deleteAssignment`. `App.tsx` loads assignments from the API on login instead of `INITIAL_ASSIGNMENTS` (deleted from `src/data/mockData.ts` — it's dead now that ids are strings).
  - `StudentDashboard`'s Add-Assignment modal now calls the real API instead of just pushing to local state. Tapping an assignment card opens a new edit modal (status + grade, plus a Delete button) — this didn't exist before at all, and without it nothing could ever move past "pending" against real data, so it was added as part of this wiring pass rather than as a separate feature.
  - Fixed three places that had a hardcoded prototype "today" of March 10, 2026 for real date math (`src/lib/notifications.ts`, `CalendarView.tsx`, `WeeklySummary.tsx`'s `TODAY`) — harmless against static mock data pinned to that week, but would have silently broken due-date/makeup-countdown math once real assignments started landing on real (2026-09+) dates. Now `new Date()` normalized to local midnight. Decorative-only mock text in `WeeklySummary` (e.g. "Mar 3 – Mar 9, 2026" header, "$23.00" running total) was left as-is — that's the not-yet-started weekly-summary/rewards-ledger wiring, not this pass.
  - Rewards/payouts still use the old mock arrays (`WEEKLY_HISTORY`, `PAYOUT_HISTORY` in `mockData.ts`) and the hardcoded `balance = 23` in `ParentOverview` — the `reward_transactions`/`payout_requests` tables exist in D1 but nothing reads/writes them yet. That's the next real chunk of wiring.

### ⏭️ Not started yet
1. Wire rewards/payouts to the `reward_transactions` ledger and `payout_requests` table (derive balance from `SUM(amount)` per the house rules in `src/lib/rewards.ts`, replace `ParentOverview`'s hardcoded `balance = 23` and the "Sarah" mock name with the real student's name/data)
2. Wire calendar/weekly-summary/notifications screens fully to real data (they already receive real `assignments` now, but weekly-summary's headline numbers and notification center are still mock-seeded)
3. A UI for changing your password (the `/api/auth/change-password` endpoint exists, no screen calls it yet)
4. Rate limiting on `/api/auth/login` — it's a public login endpoint for only 2 known accounts, so it's a plausible brute-force target. A Cloudflare Rate Limiting rule on `/api/auth/*` in the dashboard is the recommended fix; nothing has been configured yet.
5. Google Classroom API / Canvas API OAuth integrations (Infinite Campus has no public API — planned as CSV/PDF import, lowest priority of the three)
6. Real notifications: Twilio (SMS) + Resend (email), wired to the 7 triggers already scoped in the notification settings UI
7. AI Assignment Planner backend proxy — `src/components/student/AIBreakdown.tsx` currently calls `api.anthropic.com` directly from the browser with no API key attached; it will not work until there's a real Pages Function proxy holding the key server-side. Also update the model id (currently a stale `claude-sonnet-4-20250514`).

## Locked-In House Rules (business logic — confirm with Jonathan before changing any default)

- **Regular assignments:** $3 if on time and ≥70%. Late/missing/<70% = $0.
- **Tests & quizzes:** ≥70% = +$20. <70% = -$20.
- **1-week makeup window** on any missing/low assignment or test/quiz — retake within the week and score ≥70% reverses the penalty. After 1 week, the penalty locks in permanently.
- **Holdback buffer** (~$20) held back on payout requests to cover upcoming penalties; negative balances carry forward.
- **Reward type is configurable** (money/screen-time/points/custom), not hardcoded to dollars.
- Implementation lives in `src/lib/rewards.ts` (`getRewardStatus`) — pure function, worth unit testing directly since it encodes real financial rules the family agreed on.

## Immediate Next Step

1. Wire rewards/payouts to the `reward_transactions`/`payout_requests` tables — assignments are live now, so this is the next screen that needs real data instead of mocks
2. Log in as both real accounts on the live site at least once to confirm day-to-day usage feels right (add/grade/delete an assignment as Jonathan and as Susana)
