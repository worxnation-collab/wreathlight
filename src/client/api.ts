export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? "POST" : "GET"),
    headers: opts.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: "same-origin",
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new ApiError(res.status, data?.error ?? "error", data?.message ?? friendly(data?.error, data?.details));
  return data as T;
}
function friendly(code?: string, details?: string[]): string {
  switch (code) {
    case "email_taken": return "That email already has an account. Try signing in.";
    case "signed_out": return "Please sign in.";
    case "too_many_tries": return "Too many tries. Please wait a bit and try again.";
    case "invalid_body": return "Please check the form: " + (details ?? []).join("; ");
    case "not_found": return "We couldn't find that.";
    default: return "Something went wrong. Please try again.";
  }
}
