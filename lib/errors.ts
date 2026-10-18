/**
 * Turns an error into words a person can act on. The database's own messages are
 * already written for people ("Only the person who paid can change this bill"),
 * so those pass through; anything technical (network, session, missing server
 * pieces, raw constraint names) gets a plain sentence instead.
 */
type ErrorLike = { message?: string; code?: string; hint?: string | null; details?: string | null; status?: number; name?: string };

const OFFLINE = /failed to fetch|network request failed|networkerror|load failed|fetch failed|ERR_NETWORK|ECONN|timed? ?out/i;
const SESSION = /jwt|refresh token|not authenticated|invalid claim|session (has )?expired|auth session missing/i;
// Server pieces this version of the app expects but the database doesn't have yet (a migration not applied)
const MISSING = /could not find the (function|table)|function .* does not exist|relation .* does not exist|column .* does not exist|schema cache/i;
const TECHNICAL = /permission denied for|row-level security|violates (check|foreign key|not-null|unique) constraint|duplicate key|syntax error|invalid input syntax|PGRST\d|unexpected token|undefined is not|cannot read propert/i;

export function friendlyError(error: unknown, fallback = 'Something went wrong. Try again in a moment.'): string {
  if (error == null) return fallback;
  const e: ErrorLike = typeof error === 'string' ? { message: error } : (error as ErrorLike);
  const message = (e.message ?? String(error)).trim();
  const code = e.code ?? '';

  if (OFFLINE.test(message) || e.name === 'AbortError') return "Can't reach wya right now. Check your connection and try again.";
  if (SESSION.test(message) || code === '28000' || e.status === 401) return 'Your sign-in has expired. Sign in again and try once more.';
  if (MISSING.test(message) || code === 'PGRST202' || code === 'PGRST205' || code === '42883' || code === '42P01' || code === '42703') {
    return "This part of wya isn't set up on the server yet. (A database update needs to be applied.)";
  }
  if (code === '42501' && /^(not found|permission denied)/i.test(message)) return "You don't have access to that, or it's been removed.";
  if (TECHNICAL.test(message) || (e.status ?? 0) >= 500) return fallback;
  return message || fallback;
}

/** The short code behind an error, for logs and for picking a title. */
export const errorHint = (error: unknown) => (error as ErrorLike | null)?.hint ?? null;
