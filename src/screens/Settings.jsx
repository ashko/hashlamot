import { useEffect, useState } from 'react'
import { useSession } from '../lib/session.jsx'
import { supabase } from '../lib/supabase.js'
import { getDepartments, suggestedOrder, completedTrips } from '../lib/data.js'

const SCALES = [
  { value: 'normal', label: 'רגיל' },
  { value: 'large', label: 'גדול' },
  { value: 'xlarge', label: 'ענק' },
]

export default function Settings({ onBack }) {
  const { member, household, setTextScale, setDepartmentOrder, reload } = useSession()
  const [departments, setDepartments] = useState([])
  const [code, setCode] = useState(null)
  const [suggestion, setSuggestion] = useState(null)
  const [trips, setTrips] = useState(0)

  const isAdmin = member?.role === 'admin'
  const canReorder = isAdmin || member?.role === 'shopper'

  useEffect(() => {
    getDepartments().then((d) => setDepartments(d ?? []))
    completedTrips().then(({ data }) => setTrips(data ?? 0))
  }, [])

  // After a few trips the order he actually walks is readable from the data.
  // It is offered, never applied quietly — an order that rearranges itself
  // without asking is exactly the kind of surprise that loses trust.
  useEffect(() => {
    if (trips < 3 || !canReorder) return
    suggestedOrder(3).then(({ data }) => {
      if (data && JSON.stringify(data) !== JSON.stringify(household?.department_order)) {
        setSuggestion(data)
      }
    })
  }, [trips, canReorder, household?.department_order])

  const meta = new Map(departments.map((d) => [d.key, d]))
  const order = household?.department_order ?? []

  function move(key, direction) {
    const next = [...order]
    const i = next.indexOf(key)
    const j = i + direction
    if (i < 0 || j < 0 || j >= next.length) return
    ;[next[i], next[j]] = [next[j], next[i]]
    setDepartmentOrder(next)
  }

  async function openPairing() {
    const { data, error } = await supabase.rpc('open_pairing', { p_minutes: 10 })
    if (!error) {
      setCode(data)
      reload()
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>
        <h1>הגדרות</h1>
      </div>

      <div className="screen-body stack" style={{ paddingTop: 12 }}>
        <div className="pad stack">
          <span className="label">גודל הטקסט</span>
          <div className="segmented">
            {SCALES.map((s) => (
              <button
                key={s.value}
                type="button"
                aria-pressed={member?.text_scale === s.value}
                onClick={() => setTextScale(s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {suggestion && (
          <div className="pad">
            <div className="card card-accent">
              <h2>לסדר לפי הדרך שאתה עובר?</h2>
              <p style={{ margin: '0 0 12px' }}>
                לפי {trips} הקניות האחרונות, הסדר בפועל שונה מהמוגדר.
              </p>
              <p style={{ margin: '0 0 12px', fontWeight: 700 }}>
                {suggestion.slice(0, 5).map((k) => meta.get(k)?.name_he).filter(Boolean).join(' ← ')}…
              </p>
              <div className="btn-row">
                <button
                  className="btn"
                  onClick={() => { setDepartmentOrder(suggestion); setSuggestion(null) }}
                >
                  כן, לסדר ככה
                </button>
                <button className="btn btn-quiet" onClick={() => setSuggestion(null)}>
                  להשאיר
                </button>
              </div>
            </div>
          </div>
        )}

        {canReorder && (
          <div>
            <div className="dept-band" style={{ position: 'static' }}>
              סדר המחלקות בסופר
            </div>
            {order.map((key, i) => {
              const d = meta.get(key)
              if (!d) return null
              return (
                <div className="reorder-row" key={key}>
                  <span className="emoji" aria-hidden="true">{d.icon}</span>
                  <span>{d.name_he}</span>
                  <span className="spacer">
                    <button
                      className="icon-btn" style={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
                      onClick={() => move(key, -1)} disabled={i === 0}
                      aria-label={`להעביר את ${d.name_he} למעלה`}
                    >↑</button>
                    <button
                      className="icon-btn" style={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
                      onClick={() => move(key, 1)} disabled={i === order.length - 1}
                      aria-label={`להעביר את ${d.name_he} למטה`}
                    >↓</button>
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {isAdmin && (
          <div className="pad stack" style={{ marginTop: 12 }}>
            <span className="label">חיבור מכשיר חדש</span>
            {code ? (
              <div className="card card-accent">
                <p style={{ margin: '0 0 8px' }}>הקוד תקף ל־10 דקות:</p>
                <p style={{
                  margin: 0, fontFamily: 'var(--font-num)', fontSize: 'var(--fs-h1)',
                  fontWeight: 800, letterSpacing: '.15em',
                }}>{code}</p>
              </div>
            ) : (
              <button className="btn btn-ghost" onClick={openPairing}>
                פתיחת חלון צירוף
              </button>
            )}
            <p className="quickadd-hint">
              הצירוף סגור כברירת מחדל. הקוד חד־פעמי ונסגר מיד אחרי שימוש.
            </p>
          </div>
        )}

        <div className="pad" style={{ marginTop: 12 }}>
          <p className="subtle">
            {member?.name} · {household?.name}
          </p>
        </div>
      </div>
    </div>
  )
}
