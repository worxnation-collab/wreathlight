// Seeds (or re-seeds) the fictional demo church "Hope Creek Community Church (demo)", code HOPE25.
// Idempotent: uses the same statements as the hourly reset in the Worker (src/worker/demo.ts).
//
//   npx tsx scripts/seed-demo.ts --local              seed the local (wrangler dev) database
//   npx tsx scripts/seed-demo.ts --remote             seed production D1
//   npx tsx scripts/seed-demo.ts --remote --capture   save the demo church's current nights as the snapshot
//                                                     the hourly reset restores (after a real pipeline run)
//
// It never creates the judge login; that password is set separately and never stored in the repo.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { useShingleData } from "../src/shared/scripture";
import { CAPTURE_SQL, DEMO_CHURCH_ID, demoResetStatements, type SnapshotNight, type Stmt } from "../src/worker/demo";

const DB = "wreathlight-db";
const args = new Set(process.argv.slice(2));
const where = args.has("--remote") ? "--remote" : args.has("--local") ? "--local" : null;
if (!where) {
  console.error("usage: tsx scripts/seed-demo.ts --local|--remote [--capture]");
  process.exit(2);
}

function wrangler(extra: string[]): string {
  return execFileSync("npx", ["wrangler", "d1", "execute", DB, where!, "--yes", ...extra], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

function lit(v: string | number | null): string {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}
export function render(s: Stmt): string {
  let i = 0;
  const sql = s.sql.replace(/\?/g, () => lit(s.params[i++] ?? null));
  if (i !== s.params.length) throw new Error(`param count mismatch in: ${s.sql.slice(0, 60)}`);
  return sql.replace(/\s+/g, " ").trim() + ";";
}

if (args.has("--capture")) {
  wrangler(["--command", CAPTURE_SQL.replace(/\s+/g, " ")]);
  console.log("Captured the demo church's nights into demo_snapshot.");
  process.exit(0);
}

useShingleData(readFileSync(new URL("../content/bible/shingles.bin", import.meta.url)));

let snapshot: SnapshotNight[] | null = null;
try {
  const out = wrangler(["--json", "--command", `SELECT nights_json FROM demo_snapshot WHERE church_id = '${DEMO_CHURCH_ID}'`]);
  const rows = JSON.parse(out)[0]?.results ?? [];
  if (rows[0]?.nights_json) snapshot = JSON.parse(rows[0].nights_json);
} catch {
  console.warn("No demo_snapshot table yet (run migrations first); using the Starter Plan.");
}

const stmts = demoResetStatements(new Date(), snapshot);
const dir = mkdtempSync(join(tmpdir(), "wl-seed-"));
const file = join(dir, "seed-demo.sql");
writeFileSync(file, stmts.map(render).join("\n") + "\n");
wrangler(["--file", file]);
console.log(`Seeded ${DEMO_CHURCH_ID} (${snapshot ? "from snapshot" : "from the Starter Plan"}): ${stmts.length} statements.`);
