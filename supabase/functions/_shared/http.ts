// Shared HTTP helpers for wya's Edge Functions (Deno). See docs/PHASE8.md §3.3.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-wya-webhook-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export function error(status: number, code: string, message: string): Response {
  return json({ error: code, message }, status);
}

/**
 * Every function checks its secrets first. A missing one answers 503
 * `not_configured` (naming the secret, never its value), which the app shows as
 * "Not available yet" and the tests report as BLOCKED instead of failing.
 */
export function missingSecrets(names: string[]): Response | null {
  const missing = names.filter((name) => !Deno.env.get(name));
  return missing.length ? json({ error: 'not_configured', missing }, 503) : null;
}

/** Answers CORS preflight; returns null for real requests. */
export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: corsHeaders }) : null;
}

/** For functions called only by database triggers: constant-time check of the shared secret. */
export function hasWebhookSecret(req: Request, secretName = 'PUSH_WEBHOOK_SECRET'): boolean {
  const expected = Deno.env.get(secretName);
  const given = req.headers.get('x-wya-webhook-secret');
  if (!expected || !given || expected.length !== given.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}
