import { createClient } from '@supabase/supabase-js'

// The anon key is meant to be public and ships in the bundle. Every table it
// can reach is behind row level security, and device pairing is closed unless
// the admin has deliberately opened a window.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

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
