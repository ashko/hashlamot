import { useState } from 'react'
import { UNIT_OPTIONS } from '../lib/quantities.js'

// A product that is not in the catalog is one extra tap, not a detour: name is
// already typed, pick a department from a grid of fifteen big tiles, done.
// No dropdown — a native select on iOS is a spinning wheel of tiny text.

export default function NewProduct({ name, departments, onSave, onCancel }) {
  const [dept, setDept] = useState(null)
  const [unit, setUnit] = useState('unit')
  const [qty, setQty] = useState(1)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onCancel} aria-label="חזרה">→</button>
        <h1>{name}</h1>
      </div>

      <div className="screen-body stack">
        <div className="pad">
          <span className="label">איפה זה נמצא בסופר?</span>
        </div>
        <div className="dept-grid">
          {departments.map((d) => (
            <button
              key={d.key}
              type="button"
              className={`dept-tile${dept === d.key ? ' selected' : ''}`}
              onClick={() => setDept(d.key)}
              aria-pressed={dept === d.key}
            >
              <span className="emoji" aria-hidden="true">{d.icon}</span>
              <span>{d.name_he}</span>
            </button>
          ))}
        </div>

        <div className="pad stack" style={{ marginTop: 8 }}>
          <span className="label">כמה בדרך כלל קונים?</span>
          <div className="btn-row">
            <input
              className="field"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.25"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              aria-label="כמות"
              style={{ maxWidth: '40%' }}
            />
            <select
              className="field"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="יחידה"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="screen-foot">
        <button
          className="btn"
          disabled={!dept}
          onClick={() => onSave({ name, department_key: dept, default_unit: unit, default_qty: Number(qty) || 1 })}
        >
          {dept ? 'הוספה' : 'בחרי מחלקה'}
        </button>
      </div>
    </div>
  )
}
