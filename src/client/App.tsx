import { lazy, Suspense } from "react";
import { usePath } from "./router";
import { Home } from "./pages/Home";

const Studio = lazy(() => import("./pages/Studio"));
const Family = lazy(() => import("./pages/Family"));
const WreathView = lazy(() => import("./pages/WreathView"));
const HowAI = lazy(() => import("./pages/HowAI"));
const Print = lazy(() => import("./pages/Print"));

export function App() {
  const path = usePath();
  let page: React.ReactNode;
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/j\/([A-Za-z0-9]{4,8})\/?$/))) page = <Family code={m[1].toUpperCase()} />;
  else if (path === "/j" || path === "/j/") page = <Family code="" />;
  else if ((m = path.match(/^\/c\/([A-Za-z0-9]{4,8})\/wreath\/?$/))) page = <WreathView code={m[1].toUpperCase()} />;
  else if (path.startsWith("/studio")) page = <Studio />;
  else if (path === "/ai") page = <HowAI />;
  else if ((m = path.match(/^\/print\/([A-Za-z0-9-]{1,64})\/(booklet|fridge|insert)$/))) page = <Print churchId={m[1]} kind={m[2] as "booklet" | "fridge" | "insert"} />;
  else page = <Home />;
  return <Suspense fallback={<div className="wrap" aria-busy="true" />}>{page}</Suspense>;
}
