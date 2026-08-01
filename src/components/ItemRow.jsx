import { useState } from 'react'
import { formatQuantities, formatSources } from '../lib/quantities.js'

const STATUS_MARK = { pending: '', bought: '✓', missing: '✗', substituted: '⇄' }
const STATUS_WORD = { pending: '', bought: 'נקנה', missing: 'חסר', substituted: 'הוחלף' }

// Buying it is the common case and gets the whole row — a target the size of a
// credit card. The two exceptions live behind one visible button rather than
// two permanent ones, because printing them on every line tripled the length
// of the list and made him scroll past what he came for.
//
// Nothing here is a swipe, a long press or a double tap. Every action is a
// single tap on something you can see.

export default function ItemRow({ item, onToggle, onMissing, onSubstitute, showActions }) {
  const [open, setOpen] = useState(false)
  const qty = formatQuantities(item.quantities)
  const src = formatSources(item.source_recipes)
  const sub =
    item.status === 'substituted' && item.substitute_note
      ? `לקחתי: ${item.substitute_note}`
      : ''

  const done = item.status !== 'pending'

  return (
    <div className={`row is-${item.status}`}>
      <button
        type="button"
        className="checkbox"
        onClick={() => onToggle?.(item)}
        aria-label={
          item.status === 'bought'
            ? `${item.name_snapshot} — לבטל סימון`
            : `${item.name_snapshot} — לסמן שנקנה`
        }
        aria-pressed={item.status === 'bought'}
      >
        <span aria-hidden="true">{STATUS_MARK[item.status]}</span>
      </button>

      <button
        type="button"
        className="row-main"
        onClick={() => onToggle?.(item)}
        aria-label={`${item.name_snapshot} — לסמן שנקנה`}
      >
        <span className="row-name">{item.name_snapshot}</span>
        {(sub || src || item.brand_snapshot) && (
          <span className="row-sub">{sub || item.brand_snapshot || src}</span>
        )}
      </button>

      <div className="row-end">
        <span className="row-qty">{STATUS_WORD[item.status] || qty}</span>
        {showActions && !done && (
          <button
            type="button"
            className="row-problem"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
          >
            בעיה?
          </button>
        )}
      </div>

      {item.planner_reply && (
        <div className="reply-chip">
          <b>אמא:</b> {item.planner_reply}
        </div>
      )}

      {showActions && !done && open && (
        <div className="row-extra">
          <button
            className="btn btn-quiet"
            onClick={() => { setOpen(false); onMissing?.(item) }}
          >
            אין במדף
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => { setOpen(false); onSubstitute?.(item) }}
          >
            לקחתי אחר
          </button>
        </div>
      )}
    </div>
  )
}
