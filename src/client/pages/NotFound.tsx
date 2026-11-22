import { Link } from "../router";

/** Friendly 404. The Worker also answers these paths with HTTP status 404. */
export default function NotFound() {
  return (
    <main className="family">
      <div className="wrap" style={{ textAlign: "center", paddingTop: 48 }}>
        <p style={{ fontSize: "3rem", margin: 0 }} aria-hidden="true">🕯️</p>
        <h1>This page isn't here</h1>
        <p>The link may be old or mistyped. <span lang="es">Esta página no existe.</span></p>
        <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
          <Link to="/" className="btn btn-gold">Go to Wreathlight</Link>
          <Link to="/j/HOPE25" className="btn btn-ghost">Try the demo family view</Link>
        </div>
        <p className="small muted" style={{ marginTop: 20 }}>Families: ask your church for its code, or use the link they shared.</p>
      </div>
    </main>
  );
}
