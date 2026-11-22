# Ops: redraft the demo church with AI

Whole-season redraft is **locked** for the demo church (`403 demo_locked`) so visitors can't spend the
shared Gemini quota or wipe the demo. Forge can open a short window (2 hours at most; it closes on its own):

```bash
# 1. pause the hourly reset (otherwise it restores the old snapshot mid-run)
npx wrangler d1 execute wreathlight-db --remote --command \
  "INSERT OR REPLACE INTO app_flags (key, value, updated_at) VALUES ('demo_reset_paused', '1', datetime('now'))"
# 2. open the redraft window (UTC ISO time, <= 2 hours ahead)
npx wrangler d1 execute wreathlight-db --remote --command \
  "INSERT OR REPLACE INTO app_flags (key, value, updated_at) VALUES ('demo_redraft_until', strftime('%Y-%m-%dT%H:%M:%SZ','now','+45 minutes'), datetime('now'))"
# 3. as the demo pastor: reject the nights to redraft (redraft skips approved nights), then call
#    POST /api/churches/demo-hope-creek/draft with {"restart": true} and keep calling with {} until status is "done"
# 4. close the window right away
npx wrangler d1 execute wreathlight-db --remote --command "DELETE FROM app_flags WHERE key = 'demo_redraft_until'"
# 5. review and approve every night, then capture and resume
npm run seed:demo:remote -- --capture
npx wrangler d1 execute wreathlight-db --remote --command "DELETE FROM app_flags WHERE key = 'demo_reset_paused'"
```

The per-church cap (`MAX_AI_CALLS_PER_CHURCH_PER_DAY`, 20) still applies; nights past the cap fall back to the Starter Plan.
A value over 2 hours ahead, a past time or anything unparseable keeps the lock on.
