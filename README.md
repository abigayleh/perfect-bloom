# perfect-bloom

A plant care PWA. Photograph a plant, get it identified along with its care needs
and pet toxicity, add it to your collection, and get a daily reminder to water
whatever is due.

Python-only — FastAPI + Jinja2 + HTMX, installed to the home screen for camera
access and Web Push. No separate mobile codebase, no build step.

See [CLAUDE.md](CLAUDE.md) for the architecture and the domain rules that make it
correct.

## Setup

```bash
uv sync
cp .env.example .env          # then fill in SECRET_KEY
uv run alembic upgrade head
uv run uvicorn app.main:app --reload
```

Runs at http://127.0.0.1:8000 with `IDENTIFY_PROVIDER=fake`, so no API keys are
needed for local development.

## Commands

```bash
uv run pytest
uv run ruff check --fix . && uv run ruff format .
uv run alembic revision --autogenerate -m "msg"
uv run alembic upgrade head
```
