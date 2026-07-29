# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

A plant care app. Users photograph a plant, get it identified along with its care
needs, add it to their collection, and receive a daily reminder to water whatever
is due. A later phase diagnoses unhealthy plants from a photo.

Ships as a **Python-only PWA** — no separate mobile codebase. Installed to the
home screen, it gets camera access and Web Push, which is the whole reason for
this architecture.

## Stack (decided — do not substitute)

| Layer | Choice |
|---|---|
| Language | Python 3.12+ |
| Web | FastAPI |
| Frontend | Jinja2 templates + HTMX + vanilla CSS. No React, no build step. |
| DB | SQLite in dev, Postgres in prod. SQLAlchemy 2.0 (async) + Alembic. |
| Scheduler | APScheduler |
| Push | Web Push / VAPID via `pywebpush` |
| Package mgmt | `uv` |
| Tests | pytest + pytest-asyncio |
| Lint/format | ruff |

Alembic is used from the first migration even though dev is SQLite — switching to
Postgres later must not require hand-written DDL.

## Commands

```bash
uv sync                          # install
uv run uvicorn app.main:app --reload
uv run pytest
uv run ruff check --fix . && uv run ruff format .
uv run alembic revision --autogenerate -m "msg"
uv run alembic upgrade head
```

## Layout

```
app/
  main.py            # FastAPI app, startup/shutdown, scheduler wiring
  config.py          # pydantic-settings; all env vars declared here
  models/            # SQLAlchemy models
  routes/            # HTTP handlers, return HTML partials for HTMX
  templates/         # Jinja2; partials/ holds HTMX fragments
  static/            # manifest.json, sw.js, css
  services/
    identify/        # plant ID providers (see below)
    care/            # care-data lookup + species matching
    schedule/        # due-date computation
    notify/          # push subscription + delivery
  db.py
tests/
migrations/
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

**Timezones.** Reminders fire at 12:00 *local* time. Store an IANA timezone
string per user, persist all timestamps as UTC, and convert only at the schedule
boundary. Never use server-local time. A user who moves timezones should get
noon in their new one.

**Identification is behind an interface.** All ID providers implement a single
Protocol in `services/identify/base.py`:

```python
class PlantIdentifier(Protocol):
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
- Free use requires displaying PlantNet's attribution line and logo. Keep this in
  the identification result template permanently, not as a TODO.
- **Before any public launch**, this must be revisited: either a Pro contract or a
  swap to Kindwise (plant.id), which is ~€0.05/credit with 100 free credits and
  covers health assessment in the same API.

**Perenual** (`perenual.com/api/v2`) — care data. Supplies watering, sunlight,
cycle (annual/perennial), flowering season, pest susceptibility, and the
`poisonous_to_pets` / `poisonous_to_humans` fields the toxicity rule depends on.

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
policy, and a cached fallback. A dead third party must degrade the page, not 500 it.

## Conventions

- Async throughout — async SQLAlchemy, `httpx.AsyncClient`. No sync DB calls in
  request handlers.
- Routes are thin. Business logic lives in `services/`, and that's what tests
  target. Never test by asserting on HTML strings.
- Secrets only via environment, declared in `config.py`. No API keys in code,
  templates, tests, or fixtures. `.env` stays gitignored.
- HTMX endpoints return HTML partials from `templates/partials/`, not JSON.
- **Strip EXIF before storing any uploaded image.** Phone photos carry GPS, and
  this is a public app storing pictures taken inside people's homes.
- Images: local disk in dev behind a storage interface, S3-compatible later. Never
  write file paths directly in handlers.
- Validate uploads on content type and size before they reach any provider.

## Phasing

**V1 (current):** photo → identify → care info + toxicity → save to collection →
watering schedule → noon push → check off watered → completion animation.

**V2 (not yet — do not build ahead):** photo of a struggling plant → diagnosis
(yellowing, dry soil, curling) with a fix. Planned as Claude vision rather than a
classifier, because diagnosis is advisory judgment and benefits from the plant's
watering log as context. Diagnosis output is advice, and must be framed as such —
never as certainty.

**Explicitly out of scope for now:** social features, plant marketplace,
multi-user shared collections, native app wrappers, offline-first sync.

## Decisions made

- **Auth:** session cookie + password. Argon2 hashing via `argon2-cffi`, signed
  cookie via Starlette `SessionMiddleware`. Timezone captured at signup.
- **Plant deletion is a soft delete** (`plants.deleted_at`). `watering_events`
  never cascades — the log outlives the plant, per the domain rule above.

## Open decisions

Ask before assuming; don't unilaterally resolve these.

- Whether unidentified/manual plants are a first-class flow or an edge case.
- Notification granularity: one digest at noon vs. per-plant pushes.
- Whether Perenual data is bulk-cached locally or fetched lazily per species.
