import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

// First run. Two doors: the admin creates the house, everyone else walks in
// with a code the admin read out loud. There is no password anywhere, and no
// "forgot password" screen for anyone to get stuck on later.

export default function Pairing({ onDone }) {
  const [mode, setMode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const [houseName, setHouseName] = useState('הבית')
  const [myName, setMyName] = useState('')
  const [code, setCode] = useState('')
  const [role, setRole] = useState('planner')

  async function createHouse() {
    setBusy(true)
    setError('')
    try {
      const { error: e1 } = await supabase.rpc('create_household', {
        p_household_name: houseName,
        p_member_name: myName || 'מנהל',
      })
      if (e1) throw e1
      // 272 products with their department and usual unit, so nobody ever
      // faces an empty catalog.
      const { error: e2 } = await supabase.rpc('seed_catalog')
      if (e2) throw e2
      onDone()
    } catch (err) {
      setError(err.message || 'משהו השתבש')
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setError('')
    try {
      const { error: e } = await supabase.rpc('join_household', {
        p_code: code.trim().toUpperCase(),
        p_name: myName || (role === 'planner' ? 'אמא' : 'אבא'),
        p_role: role,
      })
      if (e) throw e
      onDone()
    } catch (err) {
      setError(err.message || 'הקוד לא התקבל')
      setBusy(false)
    }
  }

  if (!mode) {
    return (
      <div className="screen">
        <div className="topbar"><h1>השלמות</h1></div>
        <div className="screen-body stack pad" style={{ paddingTop: 24 }}>
          <p className="subtle" style={{ fontSize: 'var(--fs-body)' }}>
            רשימת הקניות המשותפת של הבית.
          </p>
        </div>
        <div className="screen-foot">
          <button className="btn" onClick={() => setMode('join')}>
            יש לי קוד הצטרפות
          </button>
          <button className="btn btn-ghost" onClick={() => setMode('create')}>
            אני מקים את זה
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={() => { setMode(null); setError('') }} aria-label="חזרה">
          →
        </button>
        <h1>{mode === 'create' ? 'הקמת הבית' : 'הצטרפות'}</h1>
      </div>

      <div className="screen-body stack pad" style={{ paddingTop: 16 }}>
        {mode === 'create' ? (
          <>
            <div>
              <label className="label" htmlFor="hn">שם הבית</label>
              <input id="hn" className="field" value={houseName}
                     onChange={(e) => setHouseName(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="mn">השם שלך</label>
              <input id="mn" className="field" value={myName} placeholder="מנהל"
                     onChange={(e) => setMyName(e.target.value)} />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="cd">הקוד שקיבלת</label>
              <input
                id="cd"
                className="field"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="8 תווים"
                autoCapitalize="characters"
                autoComplete="off"
                style={{ fontFamily: 'var(--font-num)', letterSpacing: '.12em' }}
              />
            </div>
            <div>
              <label className="label" htmlFor="jn">איך קוראים לך?</label>
              <input id="jn" className="field" value={myName}
                     onChange={(e) => setMyName(e.target.value)}
                     placeholder={role === 'planner' ? 'אמא' : 'אבא'} />
            </div>
            <div>
              <span className="label">מה התפקיד?</span>
              <div className="segmented">
                <button type="button" aria-pressed={role === 'planner'}
                        onClick={() => setRole('planner')}>
                  מכינה רשימות
                </button>
                <button type="button" aria-pressed={role === 'shopper'}
                        onClick={() => setRole('shopper')}>
                  הולך לסופר
                </button>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="card card-alert" style={{ color: 'var(--missing)' }}>{error}</div>
        )}
      </div>

      <div className="screen-foot">
        <button
          className="btn"
          disabled={busy || (mode === 'join' && code.trim().length < 4)}
          onClick={mode === 'create' ? createHouse : join}
        >
          {busy ? 'רגע…' : mode === 'create' ? 'הקמה' : 'הצטרפות'}
        </button>
      </div>
    </div>
  )
}
