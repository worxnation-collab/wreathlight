import type { Env } from "./env";
import { health } from "./health";

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return json(health(env.AI_ENABLED));
    }
    return json({ error: "not_found" }, 404);
  },

  // Cron placeholder: hourly demo reset and nightly ai_runs purge land here (spec section 5).
  async scheduled(_controller: ScheduledController, _env: Env): Promise<void> {},
} satisfies ExportedHandler<Env>;
