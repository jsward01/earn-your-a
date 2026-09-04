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

### 🔧 Blocking / in progress
- **D1 binding not yet attached to the Pages project.** The schema and accounts exist in D1, but the deployed `/api/*` Functions can't reach the database until the binding is added: dashboard → Workers & Pages → earn-your-a → Settings → Bindings → Add → D1 database binding → variable name `DB` → database `earn-your-a-db`. (This couldn't be done via the Cloudflare API in this session — the available API token had read-only scope for Pages project mutations; every PATCH/POST attempt came back "Authentication error" even after re-auth. Dashboard binding changes worked fine when done manually.)
- **Login has not yet been verified end-to-end on the live site** — blocked on the binding above.

### ⏭️ Not started yet
1. Verify login works live once the D1 binding is attached
2. Wire the actual app screens (assignments, rewards, calendar, weekly summary, notifications, messages) to real D1 data via Pages Functions — everything except auth still runs on the original mock data in `src/data/mockData.ts`
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

1. Attach the D1 binding in the Cloudflare dashboard (see Blocking section above)
2. Verify login works live for both accounts
3. Start wiring real screens to D1 data, starting with assignments (everything else — rewards, calendar, weekly summary — derives from assignment data)
