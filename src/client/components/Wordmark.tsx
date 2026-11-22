import { APP_NAME } from "../../shared/brand";
import { Link } from "../router";

export function Wordmark({
  to = "/",
  suffix,
  inverted = false,
  as = "link",
  className = "",
}: {
  to?: string;
  suffix?: string;
  inverted?: boolean;
  as?: "link" | "h1";
  className?: string;
}) {
  const inner = (
    <>
      <img src="/favicon.svg" width={28} height={28} alt="" />
      {APP_NAME}
      {suffix ? (
        <span className="muted small brand-sub" style={{ fontFamily: "var(--sans)", fontWeight: 400 }}>
          {suffix}
        </span>
      ) : null}
    </>
  );
  const cls = ["brand", inverted ? "brand-inverted" : "", as === "h1" ? "wordmark-hero" : "", className]
    .filter(Boolean)
    .join(" ");
  if (as === "h1") return <h1 className={cls}>{inner}</h1>;
  return (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  );
}
