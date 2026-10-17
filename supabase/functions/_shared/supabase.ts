// Supabase clients for Edge Functions (Deno).
//
// Reads go through the CALLER's session, so row-level security applies and a
// function can never see more than the person who called it. Elevated access is
// only for narrow security-definer functions (e.g. post_bot_message), never for
// general queries. Supabase injects the project URL and keys into every function;
// the names are checked in order so either key naming works.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const url = () => Deno.env.get('SUPABASE_URL')!;
const anonKey = () => Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
const serviceKey = () => Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY')!;

/** A client acting as the signed-in caller, or null when the request has no session. */
export function callerClient(req: Request): SupabaseClient | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return createClient(url(), anonKey(), {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** The caller's user id, or null for logged-out requests (the anon key alone isn't a user). */
export async function callerId(client: SupabaseClient): Promise<string | null> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

/** Service-role client: only for calling the narrow functions granted to service_role. */
export function serviceClient(): SupabaseClient {
  return createClient(url(), serviceKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}
