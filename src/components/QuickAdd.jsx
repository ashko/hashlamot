import { useMemo, useRef, useState, useEffect } from 'react'
import { unitLabel } from '../lib/quantities.js'

// The screen the whole product lives or dies on.
//
// Mom has no recipe list to import — she types everything herself, and only
// the weeks she actually cooks. If picking one ingredient takes three seconds
// week one is pleasant and the library builds itself. If it takes fifteen,
// there is no week two. Hence: matches from two letters, the right unit
// already filled in, and "not in the catalog" as one more tap rather than a
// detour.
//
// Nothing appears under the field until she types. A list of "products you
// bought before" sounds helpful and is not: she already knows what she is
// adding, and six guesses filled the screen between the field and the
// ingredients she was building up.

const normalise = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')   // niqqud and cantillation
    .replace(/["'׳״]/g, '')            // geresh / gershayim, typed inconsistently
    .replace(/\s+/g, ' ')
    .trim()

function score(product, q) {
  const name = normalise(product.name)
  if (name === q) return 0
  if (name.startsWith(q)) return 1
  const aliasHit = (product.aliases || []).some((a) => normalise(a).startsWith(q))
  if (aliasHit) return 2
  if (name.includes(q)) return 3
  if ((product.aliases || []).some((a) => normalise(a).includes(q))) return 4
  return Infinity
}

export default function QuickAdd({
  products,
  onAdd,
  onCreate,
  placeholder = 'מה צריך לקנות?',
  autoFocus = true,
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const matches = useMemo(() => {
    const q = normalise(query)
    if (!q) return []

    return products
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s !== Infinity)
      // Ties broken by what she actually buys, so the common one leads.
      .sort((a, b) => a.s - b.s || (b.p.usage_count ?? 0) - (a.p.usage_count ?? 0))
      .slice(0, 7)
      .map((x) => x.p)
  }, [products, query])

  const exact = normalise(query) && matches.some((p) => normalise(p.name) === normalise(query))

  function pick(product) {
    setQuery('')
    // Let go of the field so the keyboard drops. Holding focus here kept the
    // keyboard up over the amount and unit that just appeared, waiting for an
    // ingredient she had not decided on yet — the next thing to settle is how
    // much of this one, not what the next one is. Tapping the field again
    // brings the keyboard back for the next.
    inputRef.current?.blur()
    onAdd(product, Number(product.default_qty) || 1, product.default_unit)
  }

  return (
    <div className="quickadd">
      <input
        ref={inputRef}
        className="field"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches[0]) {
            e.preventDefault()
            pick(matches[0])
          }
        }}
        placeholder={placeholder}
        enterKeyHint="done"
        autoComplete="off"
        autoCorrect="off"
        aria-label={placeholder}
      />

      {query.trim() && (
        <div className="suggestions" role="listbox">
          {matches.map((p) => (
            <button key={p.id} type="button" className="suggestion" onClick={() => pick(p)}>
              <span className="emoji" aria-hidden="true">{p.icon}</span>
              <span className="name">{p.name}</span>
              <span className="unit">
                {p.default_qty !== 1 ? `${p.default_qty} ` : ''}
                {unitLabel(p.default_unit, Number(p.default_qty))}
              </span>
            </button>
          ))}

          {!exact && (
            <button
              type="button"
              className="suggestion create"
              onClick={() => {
                onCreate(query.trim())
                setQuery('')
              }}
            >
              <span className="emoji" aria-hidden="true">＋</span>
              <span className="name">מוצר חדש: {query.trim()}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
