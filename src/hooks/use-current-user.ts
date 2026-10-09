/**
 * The signed-in user's display identity, derived from the auth session.
 *
 * The values come from the session rather than a separate `profiles` query:
 * `signUp` stores the name in `user_metadata`, the `handle_new_user` trigger in
 * `supabase/schema.sql` mirrors it onto the `profiles` row, and Supabase returns
 * the metadata on every session. Reading it here means the Profile screen and
 * the Today greeting show the real account with no extra fetch, spinner or
 * failure mode.
 *
 * Returns `null` while signed out. Screens that sit behind the auth guard can
 * treat that as a transient frame (e.g. during sign-out).
 */

import { useAuth } from '@/contexts/auth';

export type CurrentUser = {
  id: string;
  email: string;
  /** Metadata name, or a readable fallback derived from the email. */
  fullName: string;
  /** First word of {@link fullName}, for greetings. */
  firstName: string;
  /** One or two uppercase letters for the avatar badge. */
  initials: string;
  avatarUrl: string | null;
};

/** `"John Tapang"` -> `"JT"`, `"Madonna"` -> `"M"`. */
const deriveInitials = (name: string): string => {
  const parts = name.split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return '?';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 1).toUpperCase();
  }

  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const asTrimmedString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export function useCurrentUser(): CurrentUser | null {
  const { session } = useAuth();

  // `use` is stable across renders for the same session object, and the session
  // identity only changes on sign-in/out/refresh, so this is cheap to read
  // directly without memoisation.
  const user = session?.user;

  if (!user) {
    return null;
  }

  const email = user.email ?? '';
  const metadata = user.user_metadata ?? {};
  const metadataName = asTrimmedString(metadata.full_name);
  const fallbackName = email.split('@')[0] || 'Habito user';
  const fullName = metadataName || fallbackName;
  const firstName = fullName.split(/\s+/)[0] || fullName;
  const avatarUrl = asTrimmedString(metadata.avatar_url);

  return {
    id: user.id,
    email,
    fullName,
    firstName,
    initials: deriveInitials(fullName),
    avatarUrl: avatarUrl || null,
  };
}
