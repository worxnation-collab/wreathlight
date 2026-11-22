import { describe, expect, it } from "vitest";
import { outcomeLabel } from "../../src/client/pages/Studio";

describe("AI activity log labels", () => {
  it("turns raw outcomes into plain English", () => {
    expect(outcomeLabel("week:ok")).toBe("Drafted the week ✓");
    expect(outcomeLabel("week-fallback:ok")).toBe("Backup model drafted the week ✓");
    expect(outcomeLabel("week:error:The operation was aborted due to timeout")).toBe("Drafted the week: timed out, so the backup model took over");
    expect(outcomeLabel("regenerate-week:ok")).toBe("Regenerated one night ✓");
    expect(outcomeLabel("retry-night-4:ok")).toBe("Retried night 4 after a failed check ✓");
    expect(outcomeLabel("starter-plan")).toBe("Used the Starter Plan");
  });
});
