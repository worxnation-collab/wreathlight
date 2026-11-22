/** Client routes the SPA renders. Shared by the client router and the Worker (real 404s for anything else). */
export const ROUTES: RegExp[] = [
  /^\/$/,
  /^\/j\/?$/,
  /^\/j\/[A-Za-z0-9]{4,8}\/?$/,
  /^\/c\/[A-Za-z0-9]{4,8}\/wreath\/?$/,
  /^\/studio(\/.*)?$/,
  /^\/ai\/?$/,
  /^\/print\/[A-Za-z0-9-]{1,64}\/(booklet|fridge|insert)$/,
];
export const isAppRoute = (path: string): boolean => ROUTES.some((re) => re.test(path));
