# UFC ELO Ratings

A web application that tracks ELO ratings for UFC fighters over time.

ELO scores are calculated after each event by a Python pipeline and stored as an append-only history in Supabase. The Next.js frontend reads that history to render leaderboards, fighter profiles, divisional comparisons, and more.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (TypeScript, App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (PostgreSQL) |
| ELO pipeline | Python |
| Automation | GitHub Actions (weekly cron) |

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema applied (see below)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.local` and fill in your Supabase project credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Both values are found in your Supabase dashboard under **Settings → API**.

> The `SUPABASE_SERVICE_ROLE_KEY` is used by the Python pipeline only — never set it in the Next.js environment.

### 3. Apply the database schema

Run `supabase/schema.sql` in the Supabase SQL editor. This creates all tables, indexes, and Row Level Security policies.

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Database schema

Five tables. Full design rationale is in `CLAUDE.md`.

```
fighters      — id, name, weight_class, status, nationality, date_of_birth
events        — id, name, date, location
fights        — id, event_id, fighter_a_id, fighter_b_id, winner_id, method, round, time, weight_class, is_title_fight
elo_history   — id, fighter_id, fight_id, elo_before, elo_after, delta, date
rankings      — id, fighter_id, weight_class, rank, valid_from, valid_to
```

Key rules:
- `elo_history` and `rankings` are **append-only** — never UPDATE or DELETE
- `rankings.valid_to = NULL` means the ranking is currently active
- `fights.winner_id = NULL` means draw or no contest
- `rankings.rank = 0` means champion

## Project structure

```
app/                  Next.js App Router pages and layouts
lib/supabase.ts       Supabase client (anon key, read-only)
supabase/
  schema.sql          Full database schema — run once on a new project
  seed.sql            Sample data for local validation
```

## ELO pipeline

The Python pipeline lives in `pipeline/` (not yet committed). It scrapes fight results via `ufcscraper`, calculates ELO using a standard K-factor formula, and INSERTs rows into `elo_history`. It runs weekly via GitHub Actions.

Fighter ELO carries over when they change weight class — it is never reset.

## Key commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run type-check   # TypeScript check
```
