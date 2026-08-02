import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase, ensureSignedIn, isConfigured } from './supabase.js'
import { cacheGet, cacheSet } from './idb.js'
import { isDemo, demo } from './demo.js'

const SessionContext = createContext(null)
export const useSession = () => useContext(SessionContext)

export function SessionProvider({ children }) {
  const [state, setState] = useState({ status: 'loading' })

  const load = useCallback(async () => {
    if (isDemo()) {
      setState({ status: 'ready', demo: true, ...demo.session })
      return
    }
    if (!isConfigured) {
      setState({ status: 'unconfigured' })
      return
    }

    // Startup is four calls against three different Supabase services, and a
    // bare message like "invalid path" says nothing about which one broke.
    // Naming the step turns a guessing game into a single glance.
    let step = 'התחברות'
    const at = (name, fn) => { step = name; return fn() }

    try {
      const user = await at('התחברות', () => ensureSignedIn())
      if (!user) throw new Error('לא התקבל משתמש מהשרת')

      const { data: member, error } = await at('קריאת המשתמשים', () =>
        supabase.from('members').select('*').eq('user_id', user.id).maybeSingle(),
      )
      if (error) throw error

      if (!member) {
        setState({ status: 'unpaired', user })
        return
      }

      const { data: household, error: hErr } = await at('קריאת משק הבית', () =>
        supabase.from('households').select('*').eq('id', member.household_id).maybeSingle(),
      )
      if (hErr) throw hErr

      const session = { status: 'ready', user, member, household }
      setState(session)
      cacheSet('session', { member, household })
    } catch (err) {
      // Offline on a cold start: fall back to whatever we knew last time so
      // Dad can still open the list he already has.
      const cached = await cacheGet('session')
      if (cached?.member) {
        setState({ status: 'ready', offline: true, ...cached })
      } else {
        setState({ status: 'error', error: err, step })
      }
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const value = {
    ...state,
    reload: load,
    setTextScale: async (scale) => {
      setState((s) => ({ ...s, member: { ...s.member, text_scale: scale } }))
      if (isDemo()) return
      await supabase
        ?.from('members')
        .update({ text_scale: scale })
        .eq('id', state.member.id)
    },
    setDepartmentOrder: async (order) => {
      setState((s) => ({ ...s, household: { ...s.household, department_order: order } }))
      if (isDemo()) { demo.setDepartmentOrder(order); return }
      await supabase?.rpc('set_department_order', { p_order: order })
    },
  }

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
