# perfect-bloom

A plant care app. Photograph a plant, find out what it is and how to keep it
alive, add it to your collection, and get a reminder at noon to water whatever is
due.

Native iOS and Android via **Expo**, backed by a **FastAPI** JSON API.

```
api/       FastAPI + SQLAlchemy + Alembic (Python)
mobile/    Expo app (TypeScript)
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the domain rules that make it
correct.

## API

```bash
cd api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Serves on http://127.0.0.1:8000 with `IDENTIFY_PROVIDER=fake`, so no third-party
API keys are needed for local development.

```bash
uv run pytest
uv run ruff check --fix . && uv run ruff format .
```

### Endpoints

The API is a metered proxy for PlantNet and Perenual, plus the shared species
cache. Plants, waterings and photos live on the device — none of them are here.

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/v1/devices` | — |
| `POST` | `/api/v1/identify` | device token |
| `GET` | `/api/v1/care?scientific_name=…` | device token |
| `GET` | `/healthz` | — |

A device token is anonymous: no email, no password, nothing personal. It exists so
the two routes that spend real credits can be rationed per install
(`DEVICE_DAILY_CALL_LIMIT`, default 100/day).

Interactive docs at `/docs` while the server is running.

## App

```bash
cd mobile
npm install
npx expo start          # then press "i" for iOS or "a" for Android
npm run typecheck
npm test
```

Local notifications work in Expo Go on both platforms, so reminders can be tested
without a development build.

The app finds the API automatically: it reuses the Expo dev server's host, so a
simulator and a physical phone on the same network both work without editing
anything. Override with `EXPO_PUBLIC_API_URL` if the API runs elsewhere.

Start the API first — the app talks to it on port 8000.
