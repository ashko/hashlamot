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

export async function ensureSignedIn() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user
  const { data: anon, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return anon.user
}
