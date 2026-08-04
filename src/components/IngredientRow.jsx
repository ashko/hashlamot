import { useEffect, useRef } from 'react'
import {
  formatQuantity, unitLabel, stepFor, QUICK_UNITS, convertQuantity,
} from '../lib/quantities.js'

// An ingredient she has just added, ready to be corrected without going
// anywhere. Previously the amount arrived as the catalogue's default and
// changing it meant a trip to another screen — so setting the unit was a
// separate decision taken after the fact, rather than part of adding.
//
// The one just added opens with its controls showing; the rest stay quiet, so
// the list of ingredients does not turn into a wall of buttons.

const round = (n) => Math.round(n * 1000) / 1000

export default function IngredientRow({ item, open, onOpen, onChange, onRemove, onEdit }) {
  const amountRef = useRef(null)

  // When a row opens, bring it into view and hand it the focus, so attention
  // lands on the amount rather than staying in the search field above.
  useEffect(() => {
    if (!open) return
    const el = amountRef.current
    if (!el) return
    const t = setTimeout(() => {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el.focus({ preventScroll: true })
    }, 60)
    return () => clearTimeout(t)
  }, [open])

  const step = stepFor(item.unit)
  const bump = (dir) =>
    onChange({ ...item, quantity: round(Math.max(step, item.quantity + dir * step)) })

  const setUnit = (unit) =>
    onChange({ ...item, unit, quantity: convertQuantity(item.quantity, item.unit, unit) })

  const units = QUICK_UNITS.includes(item.unit) ? QUICK_UNITS : [item.unit, ...QUICK_UNITS]

  return (
    <div className={`row ing-row${open ? ' is-open' : ''}`}>
      <div className="thumb" aria-hidden="true">{item.icon}</div>

      <button type="button" className="row-main" onClick={onOpen}>
        <span className="row-name">{item.name}</span>
        {!open && (
          <span className="row-sub">{formatQuantity({ value: item.quantity, unit: item.unit })}</span>
        )}
      </button>

      <button
        className="icon-btn"
        style={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
        onClick={onRemove}
        aria-label={`להסיר ${item.name}`}
      >
        ✕
      </button>

      {open && (
        <div className="ing-adjust">
          <div className="ing-amount">
            <button
              type="button"
              className="qty-step"
              onClick={() => bump(-1)}
              disabled={item.quantity <= step}
              aria-label="פחות"
            >−</button>

            <button
              ref={amountRef}
              type="button"
              className="qty-now"
              onClick={onEdit}
              aria-label={`${item.name} — ${formatQuantity({ value: item.quantity, unit: item.unit })}. להקלדת כמות מדויקת`}
            >
              {formatQuantity({ value: item.quantity, unit: item.unit })}
            </button>

            <button type="button" className="qty-step" onClick={() => bump(1)} aria-label="עוד">
              +
            </button>
          </div>

          <div className="ing-units">
            {units.map((u) => (
              <button
                key={u}
                type="button"
                className={`ing-unit${item.unit === u ? ' selected' : ''}`}
                onClick={() => setUnit(u)}
                aria-pressed={item.unit === u}
              >
                {unitLabel(u, 2)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
