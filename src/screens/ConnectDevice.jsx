import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { isDemo } from '../lib/demo.js'

// Connecting the two phones is the whole job right after setup, and it used to
// live at the bottom of Settings under fifteen rows of aisle order — findable
// only if you already knew it was there. It is now its own screen, reached from
// a prompt on the home screen that stays until both parents are connected.

export default function ConnectDevice({ role, onBack, onDone }) {
  const [code, setCode] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const who = role === 'shopper' ? 'אבא' : 'אמא'
  const roleLabel = role === 'shopper' ? 'הולך לסופר' : 'מכינה רשימות'
  const url = window.location.origin + window.location.pathname

  async function open() {
    setBusy(true)
    setError('')
    if (isDemo()) {
      setCode('DEMO2026')
      setBusy(false)
      return
    }
    const { data, error: e } = await supabase.rpc('open_pairing', { p_minutes: 10 })
    if (e) setError(e.message || 'לא הצלחתי לפתוח חלון צירוף')
    else setCode(data)
    setBusy(false)
  }

  async function share() {
    const text = `הקישור לאפליקציה: ${url}\nהקוד: ${code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch {
      // cancelled, or no clipboard permission — the code is on screen anyway
    }
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>
        <h1>חיבור הטלפון של {who}</h1>
      </div>

      <div className="screen-body stack" style={{ paddingTop: 16 }}>
        {!code ? (
          <>
            <div className="pad">
              <div className="card">
                <h2>איך זה עובד</h2>
                <ol style={{ margin: 0, paddingInlineStart: '1.2rem', lineHeight: 1.7 }}>
                  <li>תקבל כאן קוד בן 8 תווים, תקף 10 דקות.</li>
                  <li>בטלפון של {who}, ב־<b>Safari</b>, פותחים את הכתובת של האפליקציה.</li>
                  <li>מקישים <b>"יש לי קוד הצטרפות"</b>, מקלידים את הקוד ובוחרים <b>"{roleLabel}"</b>.</li>
                </ol>
              </div>
            </div>
            {error && (
              <div className="pad">
                <div className="card card-alert" style={{ color: 'var(--missing)' }}>{error}</div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="pad">
              <span className="label">הקוד — להקריא ל{who}</span>
              <div className="pair-code">{code}</div>
              <p className="quickadd-hint" style={{ textAlign: 'center' }}>
                תקף ל־10 דקות · חד־פעמי
              </p>
            </div>

            <div className="pad">
              <span className="label">הכתובת שצריך לפתוח בטלפון שלה</span>
              <div className="pair-url">{url}</div>
            </div>

            <div className="pad">
              <button className="btn btn-ghost" onClick={share}>
                {copied ? '✓ הועתק' : 'שליחת הקישור והקוד'}
              </button>
            </div>

            <div className="pad">
              <div className="card">
                <h2>בטלפון של {who}</h2>
                <ol style={{ margin: 0, paddingInlineStart: '1.2rem', lineHeight: 1.7 }}>
                  <li>לפתוח את הכתובת ב־<b>Safari</b></li>
                  <li>להקיש <b>"יש לי קוד הצטרפות"</b></li>
                  <li>להקליד <b>{code}</b>, שם, ו<b>"{roleLabel}"</b></li>
                  <li>שיתוף ← <b>הוספה למסך הבית</b></li>
                </ol>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="screen-foot">
        {!code ? (
          <button className="btn" disabled={busy} onClick={open}>
            {busy ? 'רגע…' : 'לקבל קוד'}
          </button>
        ) : (
          <>
            <button className="btn" onClick={onDone}>{who} התחברה — סיימתי</button>
            <button className="btn btn-quiet" onClick={open}>קוד חדש</button>
          </>
        )}
      </div>
    </div>
  )
}
