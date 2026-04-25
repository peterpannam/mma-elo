# UFC ELO Ratings

A web application that tracks ELO ratings for UFC fighters over time.

ELO scores are calculated after each event by a Python pipeline and stored as an append-only history in Supabase. The Next.js frontend reads that history to render leaderboards, fighter profiles, divisional comparisons, and more.

Shout out to NBAtrev for creating the scraper and engine and for giving me the idea for this project https://github.com/NBAtrev/UFC-Elo-Engine/blob/main/ufcstatswebscraper.py

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
