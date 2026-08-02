import { createClient } from '@supabase/supabase-js'

// The anon key is meant to be public and ships in the bundle. Every table it
// can reach is behind row level security, and device pairing is closed unless
// the admin has deliberately opened a window.
// The Supabase dashboard shows several URLs on one page — the project URL and
// the REST, auth and storage endpoints built from it. Pasting one of the
// endpoints here is an easy mistake and a baffling one to debug: the client
// appends its own path to whatever it is given, so "…/rest/v1/" quietly
// becomes "…/rest/v1/auth/v1" and every request fails on a path that does not
// exist. Keeping only the origin makes all of those spellings work, along with
// trailing slashes and stray whitespace.
function normaliseUrl(raw) {
  if (!raw) return undefined
  try {
    return new URL(String(raw).trim()).origin
  } catch {
    return undefined
  }
}

const url = normaliseUrl(import.meta.env.VITE_SUPABASE_URL)
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // Their phones stay signed in forever. There is no login screen to
        // send them back to.
        storageKey: 'hashlamot-auth',
      },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null

// Which URL the client ended up with, for the error screen. A typo or a stray
// space in the deploy variable is invisible in the code but obvious here.
export const configuredUrl = url ?? '(לא הוגדר)'

export async function ensureSignedIn() {
  if (!supabase) return null

  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) {
    // A stored session the server will not accept again would fail on every
    // future load too. Throw it away and carry on as a fresh device.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {})
  } else if (data.session) {
    return data.session.user
  }

  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!anon?.user) throw new Error('ההתחברות לא החזירה משתמש')
  return anon.user
}
