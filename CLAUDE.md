# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

A plant care app. Users photograph a plant, get it identified along with its care
needs, add it to their collection, and receive a daily reminder to water whatever
is due. A later phase diagnoses unhealthy plants from a photo.

Ships as a **native iOS and Android app built with Expo**, backed by a **Python
JSON API**. The app is submitted to both stores via EAS Build, which is why it is
a real native binary rather than a wrapped website.

## Stack (decided — do not substitute)

| Layer | Choice |
|---|---|
| App | Expo (React Native) + TypeScript, expo-router |
| App state | React Query for server state; no server data mirrored into `useState` |
| Secure storage | `expo-secure-store` for the auth token |
| Reminders | `expo-notifications`, scheduled **on-device** |
| API | Python 3.12+, FastAPI, JSON only |
| DB | SQLite in dev, Postgres in prod. SQLAlchemy 2.0 (async) + Alembic. |
| Package mgmt | `uv` for the API, `npm` for the app |
| Tests | pytest + pytest-asyncio (API); vitest for the app's pure logic only |
| Lint/format | ruff (API), eslint + tsc (app) |

Alembic is used from the first migration even though dev is SQLite — switching to
Postgres later must not require hand-written DDL.

## Layout

```
api/                 # FastAPI JSON API (Python)
  app/
    main.py          # app, lifespan, router wiring
    config.py        # pydantic-settings; all env vars declared here
    deps.py          # bearer-token auth dependencies
    schemas.py       # pydantic request/response models
    models/          # SQLAlchemy models
    routes/          # thin HTTP handlers, JSON only
    services/
      identify/      # plant ID providers (see below)
      care/          # care-data lookup + species matching
      schedule/      # due-date computation
      accounts.py    # signup / authentication
      tokens.py      # bearer token issue / resolve / revoke
      images/        # validation, EXIF stripping, storage
    db.py
  tests/
  migrations/
mobile/              # Expo app (TypeScript)
```

## Commands

```bash
# API — run from api/
uv sync
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check --fix . && uv run ruff format .
uv run alembic revision --autogenerate -m "msg"
uv run alembic upgrade head

# App — run from mobile/
npm install
npx expo start
npm run typecheck
npm test           # vitest, pure logic only — anything native is a manual pass
```

## Core domain rules

These are the rules that make the app correct. Do not quietly change them.

**Watering is an interval anchored to reality, not a calendar.**
Store `interval_days` on the plant and a row in `watering_events` each time the
user waters. The next due date is always computed as
`last_watered_at + interval_days`. Never write future watering dates into the
database. If a user waters two days late, every subsequent date shifts with
them — that is correct behavior, not drift to be fixed.

**Watering history is a log, never overwritten.** `watering_events` is
append-only. It's what makes V2 diagnosis possible ("you watered three times
this week" is a far stronger signal than any photo), so preserve it even when a
plant is deleted or a schedule changes.

**Pet toxicity is looked up, never generated.** Toxicity is only ever surfaced
from a cited source field (Perenual `poisonous_to_pets` / `poisonous_to_humans`).
Never let an LLM produce a toxicity verdict, and never infer safety from a
species' absence in the data. When toxicity is unknown, display "unknown" — not
"safe" — and always link ASPCA Animal Poison Control alongside any toxicity
display. A wrong "safe for cats" on a lily is the one bug in this app that kills
something. Treat it accordingly.

**Timezones.** Reminders fire at 12:00 *local* time, scheduled on the device,
which already knows its own zone. The API persists every timestamp as UTC-aware
and never uses server-local time — see `UtcDateTime` in `models/base.py`, which
exists because SQLite hands back naive datetimes and Postgres does not. The IANA
zone is still stored per user so server-side push stays possible later.

**Identification is behind an interface.** All ID providers implement a single
Protocol in `api/app/services/identify/base.py`:

```python
class PlantIdentifier(Protocol):
    attribution: Attribution | None
    async def identify(self, images: list[bytes]) -> list[Candidate]: ...
```

Routes and services depend on the Protocol, never on a concrete provider.
Provider selection comes from config. This is deliberate — the current provider's
free tier does not survive going public (see below), so swapping it must be a
config change plus one new file, not a refactor.

## External services

**PlantNet** (`my-api.plantnet.org/v2/identify/all`) — current identifier.
Accepts 1–5 images of the same plant, returns ranked species with confidence
scores. Returns taxonomy *only*: no care data, no toxicity, no diagnosis.

- Free tier is trial-shaped: ~50 requests/day credited for a 6-month period;
  commercial use beyond 500/day requires a paid contract, and the Pro plan starts
  at €1,000. One free account per person or legal entity, and multiple free
  accounts from one IP are prohibited.
- Free use requires displaying PlantNet's attribution line and logo. The API
  returns it on every identify response; **the app must render it wherever
  results appear.** Permanent, not a TODO. The official logo asset is still
  missing — `Attribution.logo_path` is null until it is added.
- **Before any public launch**, this must be revisited: either a Pro contract or a
  swap to Kindwise (plant.id), which is ~€0.05/credit with 100 free credits and
  covers health assessment in the same API.

**Perenual** (`perenual.com/api/v2`) — care data. Supplies watering, sunlight,
cycle (annual/perennial), flowering season, pest susceptibility, and the
`poisonous_to_pets` / `poisonous_to_humans` fields the toxicity rule depends on.

- **Toxicity is only in `/species/details/{id}`, not in `/species-list`.** A
  resolved species therefore costs two calls, which is why the cache is
  load-bearing rather than an optimization.
- Search is fuzzy. A hit is accepted only when its own `scientific_name`
  normalizes to the name we asked for — otherwise the wrong plant's toxicity
  would be attached to the user's plant.
- **The field mapping has never been checked against a live response**, only
  against the docs. Verify it with a real key before launch; `parse_toxicity`
  is deliberately defensive because of this.

**Species matching is the main technical risk in V1.** PlantNet returns a
scientific name; Perenual must be searched by it, and the two do not agree
cleanly. Approach:

1. Normalize to the binomial — strip authorship (`L.`, `(Thunb.) Lindl.`),
   hybrid markers, and infraspecific ranks before searching.
2. Try exact binomial, then genus-only as fallback (genus-level care advice is
   usually good enough for houseplants; label it as such in the UI).
3. **Cache every resolved mapping** in a `species_cache` table keyed by
   normalized scientific name. This is both a rate-limit defense and where manual
   corrections live.
4. On no match, save the plant with the identified name and care fields null.
   Let the user enter their own interval. Never fabricate a default schedule and
   present it as looked-up data.

Every outbound API call goes through a service module with a timeout, a retry
policy, and a cached fallback. A dead third party must degrade to a message the
app can show, not a 500.

## Conventions

### API

- Async throughout — async SQLAlchemy, `httpx.AsyncClient`. No sync DB calls in
  request handlers.
- Routes are thin and return JSON under `/api/v1`. Business logic lives in
  `services/`, and that's what tests target.
- Auth is a bearer token in `Authorization: Bearer <token>`. Tokens are random,
  stored only as a SHA-256 digest, and revocable. **Digest, not argon2** — the
  token is already high-entropy and a slow hash would run on every request.
  Argon2 is for passwords only.
- Never trust a client-supplied user id. Every authenticated route resolves the
  user from the token.
- Secrets only via environment, declared in `config.py`. No API keys in code,
  tests, or fixtures. `.env` stays gitignored.
- **Strip EXIF before storing any uploaded image.** Phone photos carry GPS, and
  this app stores pictures taken inside people's homes. The app may also request
  EXIF-free images from the picker, but the server strip is unconditional.
- Images: local disk in dev behind a storage interface, S3-compatible later.
  Never write file paths directly in handlers.
- Validate uploads on declared size, then content type and magic bytes, before
  they reach any provider.
- Migrations must never import app code. Render custom column types as plain SQL
  types (see `render_item` in `migrations/env.py`) so old migrations keep running.

### App

- Server state lives in React Query, never mirrored into component `useState`.
  Mutations update the cache; optimistic updates live in `useMutation` with a
  rollback, or are not optimistic at all.
- The auth token lives in `expo-secure-store`, never `AsyncStorage`.
- Reminders are scheduled locally and rescheduled after every watering and on app
  open, so a stale schedule can't survive.
- One failure-surfacing convention app-wide. No `Alert.alert()` scattered ad hoc.

## Phasing

**V1 (current):** photo → identify → care info + toxicity → save to collection →
watering schedule → noon local notification → check off watered → completion
animation.

**V2 (not yet — do not build ahead):** photo of a struggling plant → diagnosis
(yellowing, dry soil, curling) with a fix. Planned as Claude vision rather than a
classifier, because diagnosis is advisory judgment and benefits from the plant's
watering log as context. Diagnosis output is advice, and must be framed as such —
never as certainty.

**Explicitly out of scope for now:** social features, plant marketplace,
multi-user shared collections, a web version, offline-first sync.

## Decisions made

- **Repo:** monorepo. `api/` and `mobile/` change together on one branch.
- **Auth:** email + password, argon2 hashed, exchanged for an opaque bearer token
  with a 90-day expiry. Opaque rather than JWT so logout can actually revoke.
- **Reminders are on-device local notifications**, not server push. This removes
  APScheduler, Web Push, VAPID keys, and any push-subscription table. Revisit
  only if a phone that hasn't opened the app in weeks must still be nudged.
- **Plant deletion is a soft delete** (`plants.deleted_at`). `watering_events`
  never cascades — the log outlives the plant, per the domain rule above.
- **Perenual data is fetched lazily per species and cached**, not bulk-imported.
  A hit in `species_cache` never expires; a miss is retried after 30 days, since
  Perenual adds species over time and a permanent "no data" would never heal.
  `CARE_PROVIDER=fake` serves offline fixtures and needs no key.
- **Manual plants are first-class**, not a fallback. "Add a plant by name" sits
  next to "Identify" on the collection screen, and `mobile/app/(app)/add.tsx`
  serves both the blank and the prefilled-from-identification cases. A plant
  needs only a name *or* a nickname; species and interval are both optional.
- **The watering interval is captured at save time but optional.** A plant with
  a null interval is valid and simply has no schedule yet.
- **Due dates are local calendar dates, not instants.** Reminders fire at noon
  local, so a plant watered at 11pm must be due on the day the reminder lands.
  `compute_schedule` converts to the user's zone, adds `interval_days` as
  calendar days, and compares dates — so a 14-day interval across a DST change
  is still 14 days. Nothing is persisted; it is recomputed on every read.
- **A plant with no watering logged anchors on `created_at`**, labelled
  `anchor: "created"` so the UI can say "not watered yet". That is a real
  timestamp, not an invented schedule.
- **Reminders are one digest at noon**, never one notification per plant — five
  buzzes is how people disable notifications entirely. It repeats daily while
  anything stays overdue, because a plant that dies after one dismissed
  notification defeats the app.
- **Reminders are scheduled 14 days ahead and fully replaced on every sync.** A
  local notification cannot run code when it fires, so days are scheduled
  assuming nothing gets watered; watering, adding, or removing a plant cancels
  everything and rebuilds. iOS caps pending notifications at 64, hence the
  horizon.
- **The app pushes the device's timezone to `PATCH /api/v1/me` on launch.**
  Without it, due dates stay pinned to the zone captured at signup while
  notifications fire in device time — off by a day for anyone who travels.
- **Known gap: a watering cannot be undone.** The log is append-only by rule, so
  a mis-tap is permanent and skews the history V2 depends on. If this needs
  fixing, the honest option is a `voided_at` column rather than a delete.
- **Known gap: `/media` is a public unauthenticated mount.** Keys are uuid4, so
  photos are not enumerable, but there is no ownership check on read. Fix this
  when storage moves to S3 by issuing signed URLs — these are pictures taken
  inside people's homes.
- **Was a PWA until 2026-07-29.** Rebuilt as Expo because a PWA cannot be
  submitted to the App Store. The Jinja/HTMX layer was deleted; the service and
  data layers survived unchanged, which is why they were built behind interfaces.

## Open decisions

None outstanding — V1 is feature-complete. Before a public launch, the two
known gaps above (`/media` access control, no watering undo) and the PlantNet
tier question all need answers.
