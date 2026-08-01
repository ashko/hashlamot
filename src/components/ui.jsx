import { useEffect, useState } from 'react'
import { onOutboxChange } from '../lib/outbox.js'

// No signal in the supermarket is a normal operating condition, not a fault.
// So: never a blocking spinner, never an error dialog — just an honest line
// saying the marks are safe on the phone until the network comes back.
export function SyncBar() {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => onOutboxChange(setPending), [])
  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  if (pending > 0) {
    return (
      <div className="syncbar waiting">
        <span aria-hidden="true">📴</span>
        נשמר במכשיר ({pending}) — יסתנכרן כשתחזור קליטה
      </div>
    )
  }
  if (!online) {
    return (
      <div className="syncbar waiting">
        <span aria-hidden="true">📴</span> אין חיבור — הרשימה זמינה
      </div>
    )
  }
  return (
    <div className="syncbar ok">
      <span aria-hidden="true">✓</span> הכל מסונכרן
    </div>
  )
}

export function Toast({ message, actionLabel, onAction, onDone, ms = 10000 }) {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDone, ms)
    return () => clearTimeout(t)
  }, [message, ms, onDone])

  if (!message) return null
  return (
    <div className="toast" role="status">
      <span>{message}</span>
      {actionLabel && (
        <button
          onClick={() => {
            onAction?.()
            onDone()
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

export function Empty({ icon, title, children }) {
  return (
    <div className="empty">
      <div className="big" aria-hidden="true">{icon}</div>
      <h2 style={{ fontSize: 'var(--fs-name)', margin: '0 0 8px' }}>{title}</h2>
      {children && <p style={{ margin: 0 }}>{children}</p>}
    </div>
  )
}

export function Spinner({ label = 'רגע…' }) {
  return <div className="center-msg">{label}</div>
}
