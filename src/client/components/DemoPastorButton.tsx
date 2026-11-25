import { useState } from "react";
import { api } from "../api";
import { navigate } from "../router";

const LABEL = "Try the demo as Pastor Dana";

/** One-tap entry into the shared HOPE25 Studio. No password is typed, sent, or shown. */
export function DemoPastorButton({ onDone }: { onDone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setErr("");
    setBusy(true);
    try {
      await api("/api/auth/demo", { body: {} });
      if (onDone) onDone();
      else navigate("/studio");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="demo-cta-wrap">
      <button type="button" className="btn btn-gold demo-cta" onClick={go} disabled={busy}>
        {busy ? "Opening the demo…" : LABEL}
      </button>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
