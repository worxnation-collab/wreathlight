# Wreathlight

A free web app that helps a church run a nightly family Advent practice: five minutes at the table, then the phone goes away.

Live URL: _coming soon_ (`https://wreathlight.<account>.workers.dev`) · Video: _coming soon_

## Build window

Every line of code, content file and asset in this repository was created between November 22 and November 27, 2026, inside the AI for Church Hackathon build window (Oct 30–Nov 27, 2026). The commit history is public.

## Pre-existing work

Wreathlight shares no code, data, art or accounts with Verse Arcade (versearcade.org), an earlier app by the same builder. Wreathlight only links to it, optionally, after Christmas; churches can turn that link off.

## How AI is used

- **Build time:** built by Matthew Sharkey with AI coding agents (Cursor and Grok Bot agents).
- **Runtime:** Google Gemini drafts each night's questions, prayer, activity and a one-line rationale, and suggests a passage reference. Scripture text always comes from a public-domain Bible, filled in by code. The model never writes Scripture.
- **The pastor approves every night,** one at a time. There is no "approve all". Every published card shows "AI-drafted · Approved by {pastor} on {date}" (or "From the Starter Plan").
- The model only sees the theme, tradition, translation name, season dates, optional sermon titles/passages, language and the age-band rules. It never sees anything about families.

## Safeguards

- **Validator (plain code, `src/shared/validator.ts`, unit-tested).** Hard fails: reference doesn't parse or doesn't exist; more than 6 verses; outside the shipped books; a 10+ word run in any field matching any shipped verse in BSB, KJV, WEB or RV1909 (no model-written Scripture); empty field; length caps (talk 160, pray 200, do 220, why 160); duplicate reference in the season; URL or email. Soft flags (shown to the pastor, never blocking): little-ones reading level over grade 2; legends stated as fact ("three kings", Dec 25 as Jesus' birthday, Mary's age); fear/guilt; prosperity promises; Santa; secrets or going somewhere; medical advice; denominational distinctives (default tradition); Do activities that cost money or use a flame without an adult.
- **Retry policy:** hard fail → retry that night once with the reasons → fallback model once → Starter Plan, labeled "From the Starter Plan".
- **Kill switches:** per-church AI off toggle; global `AI_ENABLED=false`. Both make drafting use the Starter Plan.
- **Caps:** `MAX_AI_CALLS_PER_CHURCH_PER_DAY=20`, `MAX_AI_CALLS_GLOBAL_PER_DAY=300`, enforced in D1. Over the cap → Starter Plan.
- **Approval integrity:** approving stores the approver, time and a SHA-256 content hash. Any edit re-runs checks and un-approves.
- **Logging:** `ai_runs` keeps time, model, latency, outcome and check results. Prompt text is purged after 7 days by the cron.

## Privacy

- Families have no accounts. The household nickname is stored only in the browser's `localStorage` and is never sent to the server (an e2e test asserts this).
- The server stores a household id = SHA-256(random device UUID + church id), and which nights it lit. No names, photos, ages, schools or locations.
- No IP addresses are stored. Rate limits use SHA-256(IP + daily salt).
- Any count under 5 is returned as "fewer than 5", server-side.
- The only personal data is the pastor's email (for sign-in).
- Gemini free tier: Google may use prompts to improve its products. That is why prompts never contain anything about families.
- No analytics, trackers, email or SMS.

## Data sources and licenses

See [DATA-SOURCES.md](DATA-SOURCES.md). Scripture: Berean Standard Bible, King James Version, World English Bible and Reina-Valera 1909, all public domain, downloaded from their original publishers by `scripts/import-bible.ts`. Fonts: Fraunces and Inter (OFL). Code: MIT.

## Run locally

```bash
npm install
cp .dev.vars.example .dev.vars        # set SESSION_SECRET to a random string; AI_MOCK=1 uses a local mock drafter
npm run db:migrate:local
npm run seed:demo:local                # fictional demo church HOPE25 (idempotent)
npm run dev                            # builds the client, then wrangler dev on http://127.0.0.1:8787
npm test                               # vitest (validator, Starter Plan, draft pipeline)
npm run lint && npm run guard          # ESLint + the no-Verse-Arcade guard
npx playwright test                    # e2e; starts wrangler dev itself (or set BASE_URL)
```

`npm run import-bible` re-downloads the Bible texts and rebuilds `content/bible/*.json` and the quotation index `content/bible/shingles.bin`.

### Deploy (Cloudflare Workers free plan)

Every push to `main` runs CI (typecheck, lint, unit tests, guard, Playwright against `wrangler dev`) and then
`.github/workflows/ci.yml` builds the client, applies D1 migrations (`wreathlight-db`) remotely and deploys to
`https://wreathlight.worxnation.workers.dev` with the `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` repo secrets.
Worker secrets (`SESSION_SECRET`, `GEMINI_API_KEY`) are set once with `wrangler secret put` and never stored in the repo.
`GEMINI_MODEL` / `GEMINI_FALLBACK_MODEL` live in `wrangler.toml` (checked with ListModels).

## Demo church

"Hope Creek Community Church (demo)" in Lakeside is fictional. Its data is synthetic and resets hourly. Code `HOPE25`.
The hourly cron restores it from `demo_snapshot` (captured with `npm run seed:demo:remote -- --capture` after a real
pipeline run), or from the Starter Plan until a snapshot exists. Households are anonymous synthetic hashes; no names.

On the demo church, "Redraft unapproved nights" is off (the API answers 403 `demo_locked`) so visitors can't spend the
shared Gemini quota; single-night "Regenerate" still works within the per-church daily cap.

**Pausing the hourly reset** (e.g. while approving nights before a `--capture`). No deploy needed:

```bash
# pause
npx wrangler d1 execute wreathlight-db --remote --command \
  "INSERT OR REPLACE INTO app_flags (key, value, updated_at) VALUES ('demo_reset_paused', '1', datetime('now'))"
# resume
npx wrangler d1 execute wreathlight-db --remote --command "DELETE FROM app_flags WHERE key = 'demo_reset_paused'"
# check
npx wrangler d1 execute wreathlight-db --remote --command "SELECT * FROM app_flags"
```

Setting the `DEMO_RESET_PAUSED = "1"` var also pauses it (needs a deploy). Purges still run while paused.

## Structure

```
src/client   Vite + React + TS (Studio, family Table, projector wreath, print)
src/worker   Hono API on Cloudflare Workers, Gemini client, draft pipeline
src/shared   zod schemas, brand, season, Scripture lookup, validator
migrations   D1 SQL
content      Starter Plan (EN/ES), public-domain Bible data
scripts      import-bible, build-shingles
tests        vitest unit, playwright e2e
```
