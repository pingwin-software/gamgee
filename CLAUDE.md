# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Gamgee** is a self-hosted, full-stack fitness tracker: workout logging, personal records, body-map visualisation, coaching analysis, buddy/scoreboard, trainer↔trainee coaching, live co-workouts, in-app chat, and Web Push notifications.

| Layer            | Technology                                  |
|------------------|---------------------------------------------|
| Frontend         | Vite + React 18 + TypeScript (PWA)          |
| Backend          | FastAPI (Python 3.12)                       |
| Database         | PostgreSQL 16 (SQLAlchemy 2 ORM)            |
| Realtime         | SSE (`/api/events/stream`), WebSocket (`/api/chat/ws`), Web Push (VAPID) |
| Infra            | Docker Compose (dev + prod); Hetzner + Caddy in prod |
| Package managers | pnpm (frontend), pip (backend)              |
| Tests            | pytest, vitest, Playwright                  |

## Commands

### Full stack (Docker)
```bash
cp .env.example .env
docker compose up --build
```
Services: frontend on `:5173`, backend on `:8000`, Swagger at `:8000/docs`, DB on `:5432`.

### Frontend (local)
```bash
cd frontend
pnpm install
pnpm run dev          # dev server on :5173 (proxies /api → :8000)
pnpm run build        # tsc --noEmit + Vite production build
pnpm test             # vitest unit tests (tests/unit/**/*.test.ts)
pnpm exec playwright test   # e2e tests (tests/e2e), auto-starts vite
```

### Backend (local)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # .venv/Scripts/activate on Windows
pip install -r requirements-dev.txt
DATABASE_URL=postgresql://gamgee:gamgee@localhost:5432/gamgee uvicorn app.main:app --reload
pytest                                # backend tests
python -m app.init_db                 # reset + seed exercise catalogue
python -m app.content_seed            # seed editable content tables (quotes, tips, etc.)
python -m app.gen_vapid               # generate a fresh VAPID keypair for Web Push
```

### Production
- `docker-compose.prod.yml` — no volume mounts, no `--reload`, restricted port exposure; requires real `JWT_SECRET`, `PASSWORD_PEPPER`, `VAPID_*`, and `SENDGRID_*`.
- `Caddyfile` + `docs/deployment.md` — Hetzner + Caddy production walkthrough.
- `Makefile` — `make ssh` / `make db-tunnel` for ops on a Hetzner box.
- `.github/workflows/deploy.yml` — auto-deploys `main` via SSH on push.
- `.github/workflows/test.yml` — runs pytest, vitest (with `tsc --noEmit`), and Playwright on every PR.

## Architecture

### Backend (`backend/app/`)

**Core**
- `main.py` — FastAPI app; registers every router under `/api`; CORS allows `localhost:5173` + `APP_BASE_URL` + `CORS_EXTRA_ORIGINS`; auto-creates tables on startup and runs lightweight Postgres-only in-place migrations (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) so existing dev DBs pick up new columns without a full reset; calls `content_seed.seed_if_empty()` so a fresh DB is usable immediately; exposes `/health` for liveness checks.
- `database.py` — SQLAlchemy engine, `SessionLocal`, `get_db()` dependency.
- `models.py` — all ORM models (see "Data model" below).
- `schemas.py` — Pydantic v2 request/response schemas.
- `auth.py` — JWT (HS256, 7-day expiry, secret from `JWT_SECRET`); bcrypt hashing with optional `PASSWORD_PEPPER` (HMAC-SHA256 + base64 before bcrypt, sidestepping bcrypt's 72-byte truncation); `get_current_user` and `get_admin_user` dependencies; `password_needs_rehash()` upgrades pre-pepper hashes on next login.
- `password_policy.py` — OWASP/NIST 800-63B validation (12–128 chars, complexity, username/email similarity, common-password blocklist).
- `tokens.py` — opaque random tokens for password-reset and email-verify; stored as SHA-256 hash so the DB row alone can't be replayed.
- `email_service.py` — SendGrid integration (falls back to stdout logging when `SENDGRID_API_KEY` is empty); helpers for password-reset and email-verify mails. See `docs/sendgrid-setup.md`.
- `push.py` — Web Push (VAPID) dispatch via `pywebpush`; degrades to no-op when VAPID env vars are unset; dead 404/410 subscriptions are auto-pruned; `dispatch_batch_async` fires from a daemon thread so requests don't block. See `docs/web-push-vapid.md`.
- `gen_vapid.py` — CLI to mint a `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` pair.
- `events.py` — in-process SSE pub/sub for general realtime signals (notifications, buddy / live / trainer changes). Single Uvicorn worker only — swap in Redis pub/sub if scaled.
- `chat_ws.py` — parallel pub/sub bus dedicated to chat traffic; carries full `MessageOut` JSON over WebSockets.
- `notifications.py` — central helpers: `create_notification`, `notify_buddies` (honours per-buddy + global `notify_*` flags), and `publish_*` signals. Each creator queues SSE/WebSocket/push events that are drained in a SQLAlchemy `after_commit` listener so we only fan out events for changes that actually persisted (and `after_rollback` discards them).
- `init_db.py` / `seed.py` — schema reset + ~93-exercise catalogue seed.
- `content_seed.py` — bulk seed of the editable content tables (quotes, tips, focuses, muscles, stretches, exercise info, body-map shapes, etc.). Idempotent: only inserts rows that don't already exist, so admin edits survive restarts.

**Routers (mounted under `/api`)** — `backend/app/routers/`
- `auth.py` (`/auth`) — `POST /register`, `POST /register-trainer`, `POST /login` (OAuth2 password flow; accepts username **or** email, case-insensitive), `GET /me`, `POST /change-password`, `PATCH /preferences` (`primary_color`, `progression_speed`), `PATCH /notification-preferences`, `PATCH /gym-preferences` (home-gym geofence + `training_reminders_enabled`, powering the location/time workout suggestions), `PATCH /profile`; password-reset + email-verification flows: `POST /forgot-password`, `POST /reset-password`, `POST /verify-email`, `POST /resend-verification`, `POST /resend-verification-me`. Forgot/resend always return 202 to avoid email enumeration.
- `workouts.py` (`/workouts`) — list (GET), create (POST), update (PUT `/{id}`), delete (DELETE `/{id}`). `id` is a client-generated UUID; duplicate POST returns 409.
- `prs.py` (`/prs`) — list (GET), upsert (PUT `/{exercise_id}`), delete (DELETE `/{exercise_id}`).
- `health.py` (`/health`) — body metric CRUD (`metric_type`, `value`, `unit`, `date`, `note`); GET supports `metric_type` / `from` / `to` filters.
- `items.py` (`/items`) — generic scaffold CRUD, mostly unused.
- `admin.py` (`/admin`) — admin-only endpoints (user list, role flips, feedback triage). Guarded by `get_admin_user`.
- `buddies.py` (`/buddies`) — user search, friend requests (`pending_out`/`pending_in`/`accepted`), per-buddy notification toggles, weekly/monthly scoreboard, motivation pings, public profile fetch.
- `notifications.py` (`/notifications`) — list / mark-read / delete in-app notifications.
- `live.py` (`/live-sessions`) — real-time co-workout sessions (status `active` → `ended`); owners broadcast their current exercise/set/weight, buddies and accepted trainers can view; trainers additionally see the set-by-set timeline via `LiveSetEvent` rows.
- `feedback.py` — user feedback intake (`router`); admin triage queue (`admin_router`).
- `events.py` (`/events`) — `GET /stream` returns an SSE event stream keyed off the JWT (token can be passed via `Authorization` header *or* `?token=` query because `EventSource` can't set headers).
- `content.py` (`/content`) — public GETs + admin-only writes for editable content tables (quotes, tips, focuses, muscles, stretches, exercise info, metric defs, body-map shapes, week days).
- `trainers.py` (`/trainers`) — trainer directory, profile updates, request/accept/decline trainer↔trainee links.
- `regimes.py` (`/regimes`) — 7-day workout-plan CRUD and the rule-based questionnaire generator (goal, experience, days/week, focus + avoid muscles, equipment).
- `assignments.py` (`/assignments`) — trainer assigns a regime to a trainee; trainee accepts and applies to their weekly plan.
- `chat.py` (`/chat`) — DMs + coaching-channel chat (REST for bootstrap, WebSocket `/chat/ws` for live delivery). Conversations are stored as ordered `(user_low, user_high, kind)` so each peer relationship is a single row.

**Data model highlights** (`models.py`)
- `User`: `is_admin`, `is_verified` (existing users grandfathered as verified on migration so they don't get locked out), `is_trainer` + trainer profile columns, `primary_color`, `progression_speed`, and four `notify_*` master switches that gate buddy-driven pings; plus a home-gym geofence (`gym_name`, `gym_latitude`, `gym_longitude`, `gym_radius_m`) and `training_reminders_enabled` that drive the client-side location/time "start your usual training" suggestion; `usage_profile` (JSONB, the first-run questionnaire answers: ways, progression, logging, extras; null = not asked yet).
- `WorkoutSession.id` is a client-generated UUID string; `exercises` is a **JSONB** array (no join table; full exercise+sets embedded); `duration` is **milliseconds**.
- `PersonalRecord` has a unique `(user_id, exercise_id)` constraint — always upsert via `PUT /api/prs/{exercise_id}`; `is_cardio` boolean.
- `Exercise.id` is the short key (`"bench"`, `"ohp"`, …) matching the frontend `EM` map.
- `BodyMetric` stores time-series health data (`metric_type`, `value`, `unit`, `date`, `note`).
- Buddy system: `Buddy` is **directed** (two rows per accepted pair) so `WHERE user_id = X` returns every buddy in one query.
- `Notification.payload` is JSONB; `kind` covers `buddy_request | buddy_accepted | workout_done | pr_set | motivate | live_started | live_joined | live_ended | chat_message | trainer_link_request | trainer_link_accepted | regime_assigned`.
- `LiveSession` exposes rich set-by-set broadcast columns (`current_exercise_id`, `current_set_index`, `last_weight`, etc.) plus a separate `LiveSetEvent` table for the trainer-only timeline.
- `PushSubscription`: unique `(user_id, endpoint)`; auto-upsert on resubscribe; auto-pruned when push returns 404/410.
- `TrainerLink` is **asymmetric** (single row with `trainer_id`/`trainee_id`/`initiator_id`) — contrast with `Buddy`'s two-row directed design.
- `Conversation` (and `Message`, `MessageRead`) — DM and coaching-channel chat, with per-user read tracking for unread badges.
- Editable content tables: `Quote`, `Tip`, `Focus`, `Muscle`, `Stretch`, `ExerciseInfo`, `MetricDef`, `BodyMapShape`, `WeekDay`, `ExerciseMotion`. These mirror the data that used to live in `frontend/src/data/*.ts`; the frontend can now read everything live via `/api/content/*`.
- Token tables (`PasswordResetToken`, `EmailVerificationToken`) store `token_hash` (SHA-256), `expires_at`, and a consumed/used timestamp.

### Frontend (`frontend/src/`)

**Top-level routing** (`App.tsx`)
- `/admin` → `<AdminApp />` (admin console, `src/admin/`).
- `/exercise-graphics` → `<ExerciseGraphicsDemo />` (stick-figure animation gallery).
- `/exercise-editor` → `<ExerciseEditor />` (motion/keyframe editor).
- `/reset-password?token=…` and `/verify-email?token=…` — deep links from emails; force the auth screen until the flow completes.
- Everything else → `<WorkoutTracker />` (the main app), with a one-shot splash gated on `sessionStorage["gamgee_splash_shown"]`.

**State and orchestration** — `WorkoutTracker.tsx` is the single stateful root. It owns every piece of app state (token, user info, history, PRs, weekly plan, wizard state, active workout, primary colour, buddies/notifications/live/trainers/regimes/conversations), performs all `authFetch` calls, and passes data + callbacks down. Real-time refresh is driven by `useEventStream` (SSE) and `useChatSocket` (WebSocket).

**Pages** (`components/tabs/`) — `workout | history | prs | buddies | health | coach | exercises | notifications | profile | chat | coaching | trainees | regimes`, grouped into five sections (see "Navigation, the workout flow and visual controls"); `settings` is part of `profile`. Active tab is persisted to `sessionStorage`; a `?tab=` query param overrides it (push notifications deep-link this way via the service worker).

**Wizard flow** (`components/workout/`) — workout creation steps:
1. `WizardStart` — last-session summary, motivational quote, start button.
2. `WizardMode` — pick a plan source (weekly plan, focus, custom build).
3. `WizardFocus` / `WizardWeeklySetup` — pick a focus or edit the recurring 7-day plan.
4. `WizardBuild` — search/add exercises; `BodyMap` previews coverage; cardio is picked inline (`CardioInline` in `WizardCardio.tsx`).
5. `WizardPrescribe` — optional RPE setup.
6. `ActiveWorkout` — live set logging with PR detection (broadcasts to `LiveSession` if active).
7. `WorkoutComplete` — post-workout summary, share to buddies.

`WorkoutTab.tsx` routes between wizard steps and `ActiveWorkout` based on `active` + `wStep` props.

**Hooks** (`src/hooks/`)
- `useEventStream(token, onEvent)` — subscribes to `/api/events/stream` via `EventSource`; auto-reconnects.
- `useChatSocket(token, onMessage)` — opens a WebSocket to `/api/chat/ws`; receives `message | conversation | read` events.
- `useContentLibrary` — lazy-fetches and caches `/api/content/*` lookup tables.
- `useMobileBackGesture` — Android back-button / swipe handler.

**Context** (`src/context/`)
- `ToneContext` — voice setting (`bro | grl | pro`) that swaps body copy on quotes/tips.
- `OnboardingContext` — first-run tour state.

**Data layer** (`src/data/`) — static lookup tables bundled with the frontend (the canonical copy now lives in DB; these are fallbacks / offline defaults):
- `exercises.ts` — `EM` (id → `{ p, s }` primary/secondary muscle ids); `ALL_EX` (full `ExerciseDef[]`); also subscribes to user-created custom exercises stored in localStorage.
- `exerciseInfo.ts` — setup/execute/cue strings.
- `exerciseMotions.ts` + `motionStorage.ts` — stick-figure animation keyframes for `<StickFigure />`.
- `muscles.ts` — `MI` (id → display name + group).
- `focuses.ts` — `FocusDef[]`.
- `bodymap.ts` — SVG path/ellipse data.
- `tips.ts`, `quotes.ts`, `stretches.ts`, `metrics.ts` — coaching content.
- `weeklyPlan.ts` — load/save the user's recurring 7-day plan from `localStorage` (`gamgee_weekly_plan`).
- `contentApi.ts` — typed helpers for the `/api/content/*` endpoints.

**Logic** (`src/`)
- `analysis.ts` — `analyzeEx(exId, history)` → progression status (`NEW | GAINING | READY | STALLED | …`), estimated 1RM, recommended next weight/reps.
- `constants.ts` — `UPPER_IDS`, `GROUPS`, `getActive()` builds `ActiveMuscles` from exercises, `muscleGroups()`, `STATUS` map.
- `utils.ts` — `fmtClock`, `fmtDate`, `fmtDur`, `orm1` (Epley: `w * (1 + r/30)`).
- `types.ts` — every shared TypeScript interface (workouts, buddies, live sessions, trainers/regimes, chat).
- `push.ts` — service-worker registration + Web Push subscribe/unsubscribe helpers.

**Auth + API**
- Token stored in `localStorage["iron_log_token"]`. A 401 from any `authFetch` automatically clears it and bumps the user to the auth screen.
- Vite proxies `/api` → `BACKEND_URL` (defaults to `http://localhost:8000`); WebSocket upgrade is also forwarded (`ws: true`) so the chat socket works in dev.
- The auth screen (`components/AuthScreen.tsx`) drives register / login / forgot-password / reset / verify-email — all gated on a single component with view switching.

**PWA** — configured in `vite.config.ts` via `vite-plugin-pwa`. Manifest sets theme/background colour, icons, standalone display. Workbox runtime caching: `NetworkOnly` for `/api/events` and `/api/chat/ws`, `NetworkFirst` for the rest of `/api/*`. `public/push-handlers.js` is imported into the generated service worker to handle Web Push events.

**Theming system** — a single CSS custom property `--primary` (default `#28D1FF`) drives every accent in the app:
- `--accent` = `var(--primary)` — interactive elements.
- `--ad` / `--ad2` — `color-mix(in srgb, var(--primary) 11%/22%, transparent)` tinted backgrounds.
- `--pr` = `var(--primary)`; `--pr-muted` = `color-mix(in srgb, var(--primary) 65%, var(--muted))` — PR card accents.
- `--logo-hue-shift` = `selectedHue − 193°` — CSS `hue-rotate` applied to the PNG logo (193° is the original cyan).

`WorkoutTracker.tsx` reads/writes `localStorage["gamgee_primary_color"]`, applies the variables to `document.documentElement` via `useEffect`, and persists via `PATCH /api/auth/preferences`. A small inline `<script>` in `index.html` re-applies the colour synchronously from `localStorage` *before* the first paint so the splash screen never flashes the default cyan.

`ProfileTab.tsx` contains the `ColorPicker` (8 swatches + native `<input type="color">`); `hexToHue(hex)` in `WorkoutTracker.tsx` converts a hex to HSL hue (0–360°).

### Configuration
- `.env.example` — every env var documented inline. Key ones: `JWT_SECRET`, `PASSWORD_PEPPER`, `SENDGRID_API_KEY`, `EMAIL_FROM`, `APP_BASE_URL`, `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY` / `_SUBJECT`, `CORS_EXTRA_ORIGINS`.
- `docker-compose.yml` — dev compose; injects env vars, backend waits for DB healthcheck, frontend volume-mounted for HMR.
- `docker-compose.prod.yml` — production compose; no volume mounts, no `--reload`, restricted port exposure.
- `frontend/nginx.conf` — production reverse proxy (multi-stage Docker build target).
- `docs/` — `deployment.md` (Hetzner+Caddy), `sendgrid-setup.md`, `web-push-vapid.md`, plus body-map design docs.

### Passkeys, sign-in throttling, What's new

- **Passkeys** (`backend/app/passkeys.py`, `routers/passkeys.py`, WebAuthn through the `webauthn` package; tables `passkeys` (public keys only) and `passkey_challenges`). Mounted under `/api/auth`: `GET /passkeys`, `POST /passkeys/options` (asks for the password again), `POST /passkeys`, `DELETE /passkeys/{id}`, and signed out `POST /passkey-login/options` then `POST /passkey-login`, which returns the same JWT as a password login. Passkeys are discoverable with user verification required, bound to `APP_BASE_URL` (its host is the RP ID, its origin the only one accepted), up to 10 per user; each challenge lives 5 minutes and works once (the browser holds a token, the DB its hash). Frontend: `src/passkeys.ts` (base64url glue), `components/PasskeysCard.tsx` (Settings, Account) and the **Use a passkey** button in `AuthScreen.tsx`. Tests use a software authenticator (`tests/test_passkeys.py`, needs `cbor2`).
- **Throttling** (`backend/app/ratelimit.py`, in-process `SlidingWindow`, single worker like `events.py`): wrong passwords 10 per 15 min per typed username/email (then 429; a success or a password reset clears it), failed passkey sign-ins 50 per 15 min overall, wrong passwords when adding a passkey 5 per 15 min per user. `conftest.py` resets the counters for every test.
- **What's new** (`frontend/src/whatsnew/`: `whatsNew.ts`, `WhatsNewModal.tsx`, `WhatsNewArt.tsx`, `WhatsNew.css`). **A pull request that adds or changes something important people will notice adds an entry**: `{ id, date }` at the top of `WHATS_NEW` (newest first, `date` the day it lands), its title and a few lines in `WHATS_NEW_COPY` (`**words**` bold, a bit tongue in cheek, no em dashes) and a looping demo in `WhatsNewArt` keyed by the id (`wn-*` keyframes; base styles are the end state because loops stop under reduced motion). Not for small polish or fixes: label those PRs `no-whats-new`. The sheet opens by itself once when an account has entries unseen in this browser (`gamgee_whats_new_seen_<userId>`) dated after the day it joined (`UserOut.created_at`, null for accounts older than the column), never over an active workout; *What's new* at the end of Me shows all. `tests/unit/whatsNew.test.ts` checks ids, order and copy; `.github/workflows/whats-new.yml` warns (never fails) on a PR touching `frontend/src` or `backend/app` without an entry.
- **Number fields keep their text while typing.** Do not clamp or substitute a default in `onChange` (the field then cannot be cleared and retyped); commit in-range values as typed and clamp on blur, as `NumField` in `WizardPrescribe.tsx` does.
- `authFetch`'s `tokenRef` in `WorkoutTracker.tsx` is assigned during render on purpose: children's mount effects run before the parent's, and a stale token there means a 401 that signs the user out.

### Navigation, the workout flow and visual controls

- **The app follows what the user said they use Gamgee for.** A four-question sheet (`components/UsageQuestionnaire.tsx`) opens once for any account whose `users.usage_profile` is null (new accounts and accounts from before it alike), never over an active workout, and before the welcome tour and What's new. Every answer switches things off:
  1. `ways` (any of `regime` weekly plan, `templates` saved workouts, `spot` impromptu; at least one): impromptu only goes Start, Focus, Build with no plan screen; without impromptu the start opens the plan screen with no one-off card and Build goes back to it; the regime (today's plan, week strip, week editor, Regimes' regimes) and templates (every template list, *Save as template*) show only when picked.
  2. `progression`: `auto` (suggestions as before), `fixed` (every working set gets last time's weight plus `fixedStepKg`, and the progression prefs become `fixedProgressionPrefs`), `manual` (no coach line, Apply, Progress, effort setup, Trends page or progression settings; last time's numbers carried as they were). `rampedSetsFromHistory` takes the mode.
  3. `logging` (any of `rest`, `effort`, `cardio`): no `rest` means a plain Add set / Done bar with no countdown and no rest settings; no `effort` drops the reps-left picker, the session-effort prompt and the effort setup step; no `cardio` drops `CardioInline`.
  4. `extras` (`progress`, `body`, `social`, `coach`): their pages; Notifications settings need social or coach.
  `src/usageProfile.ts` holds the rules (`visiblePages`, `buildsOnTheSpot`, `usesRegime`, `usesTemplates`, `suggestsWeights`, `logs`, `wizardBackStep`); Workout, History and Me always show, Trainees whenever the user is a trainer, null = everything. `AppHeader` drops empty sections. Stored on the account (`PATCH /auth/preferences`, validated in `UserPreferences`) and in `localStorage` (`gamgee_usage_profile`, with the user id); Settings, Workout, *What you use Gamgee for* asks again or shows everything. A new page goes into `ALL_PAGES` and `visiblePages` as well as `tabs` and a section; a new optional feature should get gated by an answer.
- **Templates are managed wherever they are listed.** The workout-type screen, Regimes (*My templates*) and both day editors (`components/templates/TemplatePicks.tsx`) each offer start or apply, edit, delete and new; all read `TemplatesContext` (provided by `WorkoutTracker`), and editing away from the workout flow opens `TemplateEditorSheet` (the builder on a full-screen sheet portalled to `<body>`). Do not add a list of templates with only some of these.
- **Five sections, not fourteen tabs.** `AppHeader.tsx` groups every page into `sections`: Train (workout, exercises), Progress (history, prs, coach shown as TRENDS, health shown as BODY), Social (buddies, chat, notifications), Plans (regimes, coaching, trainees for trainers), Me (profile). The desktop `.tabs` row and the phone's fixed `.bottom-nav` show the sections; `.subtabs` under the header shows the current section's pages. The phone's bar is a floating dock: one solid pill (`.bottom-nav-glider`, keyed inner pill) slides to the picked section and stretches as it sets off, the 26 px mark it lands on jumps (`dock-pop`), and a ring spreads from it; all of it stops under reduced motion (system or the in-app switch). A section reopens on the page it was left on. The page strip steps aside while a workout is being built or logged, the bottom bar only while it is being built (mid-workout it stays, so History or Chat is one tap away). **One way to each place:** there is no hamburger menu and no header buttons (no settings gear, help, bell or logout); the header is the logo, the page name (only where no page strip names it) or the workout timer, and the section tabs; on phones the page strip sits on the logo's row (`.hdr-strip`), so the header is one 65 px row (`--hdr-h`). What is neither a page nor a setting (What's new, Send feedback, Admin, Log out) is the `.me-actions` row at the end of Me; the tour is replayed from Settings, Guidance. Do not add a second route to a page or action that already has one. Page keys (`tab`) are unchanged, so deep links and `setTab("chat")` still work. Add a page by adding it to `tabs` and to a section.
- **Me = profile + settings.** `tab === "profile"` renders `ProfileTab` then `SettingsTab` (`#me-settings`). `setTab("settings")` and `?tab=settings` land on Me and scroll to it. Settings is seven collapsible `Group`s (Profile, Workout, Appearance, Notifications, Account, Guidance, About); a new setting goes inside a group, never as a new top-level block.
- **Workout flow.** Step 0 (`WizardStart`) shows the week (`WeekStrip`: trained days ticked, planned days with their focus icon) and one-tap starts: today's plan and Repeat last workout call `quickStart` (`startFromWizard(true, configs, exercises)`), straight into logging. The builder is Mode (1), Focus (2), Build (4); step 3 (cardio) is gone, cardio is `CardioInline` on the build screen, and the old forced Randomize / Start blank dialog is two inline chips shown while the list is empty. RPE setup (5) asks one effort for the session; per-lift detail (best set, sets, reps, own effort) is behind **Adjust**, opened by itself only for a lift with no reference.
- **Visual controls over typing** (`src/simple.css`): `EffortPicker` (ten tappable bars and a face, a radio group; use it wherever effort 1 to 10 is picked, never a range input), `Stepper` (44 px minus and plus for sets and reps), `.seg` segmented controls, `.chip-btn` choice chips, `.disclose` for "more". Clickable cards are `<button>`s (`button.focus-card`, `.start-card`), never clickable divs. Keep typed fields for free values only (weights, names).
- **Suggested progression is the user's** (`src/progressionPrefs.ts`, `components/ProgressionCard.tsx`, Me, Settings, Workout): `repsBeforeWeight` (null = automatic, 0 = more weight every session), `stepUpperKg` / `stepLowerKg`, `easyRir` (null = never skip ahead) and `onSlip` (step, percent, hold), with presets Steady, Standard (the old behaviour) and Fast. `analyzeEx` and the plate rounding in `analysis.ts` read the current prefs from that module (`getProgressionPrefs`), which `WorkoutTracker` sets during render, so every suggestion follows them without prop threading; tests pass prefs as the fourth argument. Stored in `localStorage` (`gamgee_progression_prefs`) and on the account (`users.progression_prefs`, JSON, via `PATCH /auth/preferences`, validated in `UserPreferences`). `users.progression_speed` is older and unused by the client.
- **Page styles live with their pages.** The redesigned pages each import a stylesheet from `src/pages/` with its own class prefix: `history.css` (`hx-`, History, PRs, the edit-session sheet), `progress.css` (`pg-`, Trends, Body), `social.css` (`so-`, Buddies, Alerts), `chat.css` (`ch-`, Chat, Exercises), `plans.css` (`pl-`, Regimes, Coaching, Trainees; `RegimesTab.tsx` also exports the shared `WeekDots`, `PlanAvatar` and `ConfirmButton`). New page styling goes there, not into `WorkoutTracker.css` (the rules the old page layouts used were removed from it; when a class stops being used, delete its rules with it). Destructive actions on these pages (delete a custom exercise, remove a trainee, revoke a plan) arm on the first tap and act on the second. History and the Body date default use the local day, and calendars start on Monday.
- **Sliding sessions.** `POST /api/auth/refresh` returns a fresh JWT; the client swaps its token once a day (`gamgee_token_refreshed_at`), so only a browser left alone for the token's 7 days is sent to sign in.
- **Phone sizes** (the phone block at the end of `simple.css`): on small or touch screens every button, link-button, select and text field is at least 44 px tall, fields use 16 px type (smaller makes iOS zoom on focus), and no text a person reads is under 11 px (badges and tags in fixed pills are the exception). Do not add `font-size` under 11px or a control under 44 px; a control that must stay compact gets an explicit exception in that block.
- **No scroll boxes inside a page or sheet.** Lists and pickers grow with the page or sheet and scroll with it; never give an inner area a `max-height` with `overflow: auto` (shorten the content instead: one list, not two; search to narrow). The custom-lift editor picks muscles on the body map: `BodyMap` takes `onPickMuscle` (shapes become tappable buttons with `pointer-events: all`; the detail lines ignore taps) and `scale`; a tap lights that muscle's group (`focusMuscles`) and lists the group's muscles as chips, a Primary / Secondary switch says what a chip tap marks, and the picked muscles show as removable chips.
- A section's badge (tab row, bottom bar) counts only what is waiting for the user (`WAITING` in `AppHeader.tsx`: chat, notifications, regimes), not how many workouts a page holds.
- The "confirm your email" notice is one dismissible line (`.verify-line`, hidden for the visit and while a workout is being built or logged).

## Conventions worth knowing

- **In-place migrations only.** New columns are added via `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` in `main.py`; there's no Alembic in use (despite the dep being listed). Add new migrations alongside existing ones in `main.py`'s startup block. Wrap any non-idempotent migration (e.g., column with default that needs backfilling) in an `information_schema` check, like `is_verified` already does, so it only runs once.
- **Editable content lives in DB.** When adding a new lookup table (a new flavour of `Quote`/`Tip`/etc.), seed defaults via `content_seed.py`; the seeder upserts by id so admin edits aren't clobbered on restart.
- **Realtime fan-out happens via `notifications.py` helpers.** Don't call `events.publish` / `chat_ws.publish` / `push.send_to_user` directly from routers — go through `create_notification` / `notify_buddies` / `publish_*` so events are deferred to `after_commit` and discarded on rollback.
- **Token-style endpoints return 202 unconditionally.** `forgot-password`, `resend-verification`, and similar must not leak whether an email is registered.
- **JWT for SSE/WebSocket comes via `?token=`,** not `Authorization`, because `EventSource` and (browser) WebSocket can't set custom headers. Both validate the token before subscribing.
- **Cardio vs. strength PRs** — `PersonalRecord.is_cardio` flips the PR comparison (greater weight × reps for strength, greater value for cardio).
- **Two notification gates.** Buddy-driven pings require **both** the recipient's global `User.notify_*` flag **and** the per-buddy `Buddy.notify_*` flag — see `_PREF_FIELD` in `notifications.py`.
- **Don't reuse component names across routes.** `App.tsx` switches on `window.location.pathname` for `/admin`, `/exercise-graphics`, `/exercise-editor` — these are entirely separate component trees, not React Router routes.
- **PWA service worker caches `/api/*` with NetworkFirst.** When debugging stale data in dev, hard-reload **and** unregister the service worker.
- **Tests live in `backend/tests/` (pytest) and `frontend/tests/unit/` (vitest) + `frontend/tests/e2e/` (Playwright).** CI runs all three and additionally enforces `tsc --noEmit` on the frontend; keep them green.
