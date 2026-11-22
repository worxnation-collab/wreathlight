# Wreathlight

A free web app that helps a church run a five-minute nightly family Advent practice, from the first Sunday of Advent to Christmas Day.

- **Live:** _TODO: https://wreathlight.<account-subdomain>.workers.dev_
- **Video:** _TODO_

## Built during the hackathon

Every line of code, content file and asset in this repository was created between November 22 and November 27, 2026, inside the AI for Church Hackathon build window (Oct 30–Nov 27, 2026). The commit history is public.

## Pre-existing work

Wreathlight shares no code, data, art or accounts with Verse Arcade (versearcade.org), an earlier app by the same builder. Wreathlight only links to it, optionally, after Christmas; churches can turn that link off.

Link used by the optional "Keep going" card: https://versearcade.org/?ref=wreathlight

## How AI is used

- **Build time:** built by Matthew Sharkey with AI coding agents (Cursor and Grok Bot agents).
- **Runtime:** Gemini drafts questions, prayers and activities; Scripture always comes from public-domain text via code.
- The pastor approves every night before any family sees it.

_TODO: expand._

## Safeguards

_TODO: validator rules, retries, fallback model, Starter Plan, kill switch, caps, logging._

## Privacy

_TODO: what we store and never store, the "fewer than 5" threshold, no family accounts, Gemini free-tier note._

## Data sources and licenses

See [DATA-SOURCES.md](DATA-SOURCES.md). Code is MIT licensed (see [LICENSE](LICENSE)).

## Run locally / deploy

```sh
npm ci
cp .dev.vars.example .dev.vars   # fill in locally; never commit
npm run db:migrate:local
npm run dev                      # http://localhost:8787/api/health
npm run check                    # typecheck, lint, unit tests, guard
```

Pushes to `main` deploy through GitHub Actions (`.github/workflows/ci.yml`) to Cloudflare Workers + D1 on the free plan.

## Demo church

Hope Creek Community Church (demo) is fictional and resets hourly.
