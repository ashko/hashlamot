import { useState } from 'react'
import { formatQuantity, unitLabel, UNIT_OPTIONS } from '../lib/quantities.js'

// Changing "how much" has to be as easy as a light switch: two enormous
// buttons and a number you can read across the kitchen. No dropdown wheels, no
// keyboard unless you want one.
//
// The step follows the unit, so kilos move by quarters — the amounts people
// actually say out loud (רבע, חצי, שלושת רבעי) rather than arbitrary decimals.
const STEP = { kg: 0.25, l: 0.25, g: 50, ml: 50 }
const stepFor = (unit) => STEP[unit] ?? 1

const round = (n) => Math.round(n * 1000) / 1000

export default function QuantityEditor({ name, value, unit, onSave, onCancel }) {
  const [qty, setQty] = useState(Number(value) || 1)
  const [u, setU] = useState(unit)

  const step = stepFor(u)
  const bump = (dir) => setQty((q) => round(Math.max(step, q + dir * step)))

  function changeUnit(next) {
    // Moving between units of wildly different size would leave a nonsense
    // number behind, so start from that unit's own sensible default.
    const from = stepFor(u)
    const to = stepFor(next)
    setU(next)
    if (from !== to) setQty(to)
  }

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onCancel} aria-label="ביטול">→</button>
        <h1>{name}</h1>
      </div>

      <div className="screen-body stack" style={{ paddingTop: 20 }}>
        <div className="pad">
          <span className="label">כמה?</span>
        </div>

        <div className="qty-stepper">
          <button
            className="qty-btn"
            onClick={() => bump(-1)}
            disabled={qty <= step}
            aria-label="פחות"
          >−</button>

          <div className="qty-value" aria-live="polite">
            {formatQuantity({ value: qty, unit: u })}
          </div>

          <button className="qty-btn" onClick={() => bump(1)} aria-label="עוד">+</button>
        </div>

        <div className="pad">
          <label className="label" htmlFor="qn">או להקליד מספר</label>
          <input
            id="qn"
            className="field"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 0)}
            style={{ textAlign: 'center' }}
          />
        </div>

        <div className="pad">
          <span className="label">יחידה</span>
          <div className="unit-chips">
            {UNIT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                className={`unit-chip${u === o.value ? ' selected' : ''}`}
                onClick={() => changeUnit(o.value)}
                aria-pressed={u === o.value}
              >
                {unitLabel(o.value, 2)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="screen-foot">
        <button className="btn" disabled={qty <= 0} onClick={() => onSave(qty, u)}>
          שמירה
        </button>
      </div>
    </div>
  )
}
