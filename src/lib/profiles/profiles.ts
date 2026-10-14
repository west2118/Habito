/**
 * Profiles API — read the signed-in user's profile row.
 *
 * The row is created server-side by the `handle_new_user` trigger in
 * `supabase/schema.sql`, and RLS restricts every read to `id = auth.uid()`,
 * so this can only ever return the caller's own profile. Null means the row
 * is missing (e.g. the trigger predates the account) — callers fall back to
 * session and device values rather than failing the screen.
 *
 * Every function is an `async` arrow function returning a `ProfileResult`, so
 * callers handle failure with one `if (!result.ok)` branch and no `try`/`catch`.
 * Nothing here throws.
 */

import { toProfileError, type ProfileResult } from '@/lib/profiles/errors';
import { fail, ok } from '@/lib/result';
import { getSupabase } from '@/lib/supabase';

/** A row of the `profiles` table, as Supabase returns it. */
export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

/** Reads the caller's profile row, or null when it does not exist. */
export const getMyProfile = async (): Promise<ProfileResult<Profile | null>> => {
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, avatar_url, timezone, created_at, updated_at')
      .maybeSingle();

    if (error) {
      return fail(toProfileError(error));
    }

    return ok((data as Profile | null) ?? null);
  } catch (error) {
    return fail(toProfileError(error));
  }
};
