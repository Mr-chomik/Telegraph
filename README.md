# Fun — AI-powered Telegram digital newspaper

**Read this in [Русский](README_RU.md)**

Fun is a self-hosted digital newspaper assembled automatically from Telegram
channels. It ingests raw posts, deduplicates and clusters them into stories,
writes article copy, typesets a real newspaper (front page, sections, light
reading), and serves it as a web app with an authentic print aesthetic.

The editorial pipeline works **without AI** (deterministic fallbacks) and can
optionally be refined by a local LLM (Ollama). Everything is traceable from an
article back to the original Telegram post.

## Milestones

| # | Status | What |
|---|--------|------|
| M1 | done | Monorepo, Prisma schema + demo seed, web/worker scaffolds, design tokens, auth, docker-compose |
| M2 | done | Telegram ingestion (add/validate/toggle channels, t.me preview, GramJS fetch job) + Sources UI |
| M3 | done | Editorial pipeline (spam → cluster → classify → importance → write) + AI providers, worker `process` job |
| M4 | done | Edition engine (pure layout, `generateEdition` job, traceable sources) + newspaper viewer |
| M5 | done | Archive, full-text Search, Settings (language/humor/amount), My Newspaper, Admin dashboard |
| M6 | done | e2e (Playwright), README, CI (GitHub Actions), start.bat, Docker images verified |
| M7 | done | Live Telegram collection (public-preview driver, no login) + per-user source mix (weights) |
| M8 | done | Live Telegram photos downloaded and shown as newspaper photo plates |
| M9 | done | Newspaper UI polish: scaled paper, sepia photo plates, realistic page-turn flip |

## Architecture

```
Telegram ──► apps/worker ──► packages/core ──► Postgres ──► apps/web
              (cron jobs)      (pure logic)     (Prisma 7)   (Next.js 16)
```

- **`packages/core`** — shared, deterministic editorial logic: normalization,
  spam filtering, clustering (0.55 cosine similarity), classification,
  importance scoring, writing/formatting, and the edition **layout engine**.
  Fully unit-tested, no IO.
- **`packages/db`** — Prisma schema, generated client, and the demo seed.
- **`apps/worker`** — node-cron scheduler running idempotent jobs: `fetch`
  (Telegram ingestion), `process` (pipeline), `generateEdition` (typeset),
  `cleanup` (retention).
- **`apps/web`** — Next.js App Router app: auth, home, newspaper viewer (page
  turn, TOC drawer, article modal with sources), archive, search, settings,
  My Newspaper, admin dashboard.

### Telegram ingestion drivers

Two interchangeable drivers, selected by `TELEGRAM_DRIVER`:

- **`public` (default, no login):** reads the public `t.me/s/<user>` preview
  page — text, rounded views, photos. Works for any public broadcast channel
  with zero credentials; fine for a demo. Post timestamps come from the visible
  `<time datetime>` element (the widget's `data-view` token is the page render
  time and must not be used for dates).
- **`mtproto` (full fidelity):** GramJS over your own account. Requires
  `TELEGRAM_API_ID`/`TELEGRAM_API_HASH` (from https://my.telegram.org/apps) and
  a one-time `npm run tg:login` (phone + code) that saves the session to
  `data/tg.session`. Exact view counts, forwards, more posts per run.

`fetch` retries `ERROR` channels, so a transient network failure never
permanently disables a channel. Because t.me connectivity is flaky in bursts
(DNS/TCP drops that resolve within seconds), every channel is also retried
within a single run: `FETCH_RETRIES` (default 3) total attempts spaced by
`FETCH_RETRY_DELAY_MS` (default 15000). Raise the retry count if your network
drops t.me for longer stretches.

### Freshness window

Only fresh information enters the pipeline: the first run collects at most 24h
back, and afterwards exactly the interval between editions (the next edition
only needs what changed since the previous one). The window is applied at every
stage — `fetch` drops preview messages older than the window, `process` only
clusters NEW posts inside it, and `generateEdition` only places stories whose
first post is inside it.

### Personalisation (source mix)

Any reader can add their own public channels and control how much of each source
appears in their personal digest:

- **Settings → «Источники»**: every source has an on/off toggle and a weight
  1–10 ("сколько информации откуда"). Add a channel by username right there.
- Adding a channel creates a global source (fetched by the worker) and
  auto-subscribes the adding user with weight 8; the owner (or an admin) can
  remove it.
- **My Newspaper** ranks articles by the strongest of the story's source
  weights, hides articles from sources the user disabled, then applies the
  user's content-amount cap.

Data: `Channel.ownerUserId` (who added a source) + `ChannelSubscription`
(user × channel, `weight` 1–10, `enabled`).

### Editorial pipeline

```
raw posts ─► normalize ─► spam ─► cluster ─► classify ─► importance ─► write ─► stories
                                                              │
                             edition (layout engine) ◄────────┘
```

Stories are placed into an edition by `buildEditionLayout`: a front page with
one featured story and up to four brief teasers, then sections in canonical
order (world, europe, russia, technology, science, business, games, sports,
culture), at most three stories per page, with a trailing "Light Reading"
section for funny stories. All sections run through the optional AI layer
(Ollama) or deterministic rules.

Headlines are always a condensed phrase, never a verbatim copy of the article
(weak verbs like "произошло" are dropped, the payload sentence is picked by
keyword load). Every article ends with its source and the **news-post publish
time** ("Опубликовано: 14 августа 2026, 14:31").

Channel self-promotion is cut out of posts before they reach the pipeline
("подписывайтесь на наш канал в MAX", "больше новостей — на нашем канале",
branded "Читайте нас в MAX" etc.) — `TelegramPost.raw` keeps the original text.

Stories that actually carry a Telegram photo get an image in the article
(main articles only, never short teasers); photos are served locally via
`/api/media`. Article bodies render `**bold**`, `*italic*` and links, with the
closing publish time styled as a byline.

## Tech stack

- Node.js ≥ 20, npm workspaces
- TypeScript, ESLint, Vitest (core unit tests)
- PostgreSQL 16, Prisma 7 (`@prisma/adapter-pg`)
- Next.js 16, React 19, Tailwind CSS 4, Framer Motion
- GramJS (`telegram`), node-cron
- Playwright (e2e)
## Quickstart (local development)

**One click:** double-click `start.bat` (Windows). It starts Postgres via Docker,
applies migrations, seeds demo data, generates today's edition, launches web +
worker in two windows, and opens the browser. `start.bat fresh` also resets the
database.

```bash
# 1. Configure environment
cp .env.example .env          # fill DATABASE_URL, SESSION_SECRET, ADMIN_EMAILS…

# 2. Start PostgreSQL
docker compose up -d db

# 3. Install and prepare the database
npm install
npm -w @fun/db run db:deploy   # apply migrations
npm run db:seed:demo           # categories + real public Telegram channels + admin user

# 4. Collect real news and produce today's paper (needs a reachable t.me)
npm run pipeline:run           # fetch → process → edition

# 4b. …or run a single pipeline step on demand (no scheduler needed)
npm run pipeline:run fetch    # only collection
npm run pipeline:run process  # only clustering/stories
npm run pipeline:run edition  # only typesetting today's paper

# 5. Start the apps
npm run dev:web                # http://localhost:3000
npm run dev:worker             # scheduled jobs (fetch/process/editions/cleanup)
```

Sign in with the seeded demo admin: **`demo@fun.app` / `demo1234`** (local demos only).

## CI

`.github/workflows/ci.yml` runs typecheck, lint, unit tests, and the Playwright
e2e suite (against a Postgres service container) on every push/PR.

## End-to-end tests

The Playwright suite prepares a **fresh** database automatically: it resets the
schema, applies migrations, seeds demo data, runs the process + edition jobs,
starts the Next.js dev server, and runs the tests in your installed Edge/Chrome.

```bash
npm run e2e
```

Covers: registration/login/logout, wrong-password errors, the newspaper viewer
(TOC drawer, article modal, page turn), archive, full-text search, settings
persistence, My Newspaper, and the admin dashboard + role guard.

## Docker compose (full stack)

```bash
# Database + web + worker
docker compose up -d --build

# …with a local LLM for AI refinement
docker compose --profile ai up -d --build
```

The compose file overrides `DATABASE_URL` to the `db` service host, so the
containers reach PostgreSQL without localhost assumptions. The `ai` profile
starts Ollama on port 11434.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` / `npm run dev:web` | Start the web app |
| `npm run dev:worker` | Start the worker scheduler |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run lint` | Lint all workspaces |
| `npm run test` | Unit tests (Vitest) |
| `npm run e2e` | Playwright end-to-end tests |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create/apply migrations (dev) |
| `npm run db:deploy` | Apply migrations (non-interactive) |
| `npm run db:seed:demo` | Seed categories + real Telegram channels + admin user |

## Data model (highlights)

`Channel` → `TelegramPost` (raw JSON kept immutable) → `StoryPost` →
`Story` → `Article` → `ArticleSource` (traceable t.me links) → `Edition`.
`UserPreference` personalizes language, humor section, and content amount.
`ProcessingJob` records every pipeline run for the admin dashboard.

## License & notes

**MIT License** — see [`LICENSE`](LICENSE).

Demo credentials exist for offline evaluation only (`demo@fun.app` / `demo1234`). The seed intentionally contains **no
placeholder news**: it ships real public channels (bbbreaking, rbc_news, readovkanews,
tjournal, nplus1, sportexpress, kinopoisk, mash, banksta) and the paper is produced from
live Telegram posts via `npm run pipeline:run`. Login/register rate limiting
(`AUTH_RATE_LIMIT`, default 20 per 15 min) is raised to 200 in the local `.env` so dev and
e2e don't trip it. The raw
Telegram content is stored verbatim and never rewritten; generated article copy
is clearly derived from sources shown on each article.
