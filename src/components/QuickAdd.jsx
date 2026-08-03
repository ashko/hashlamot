import { useMemo, useRef, useState, useEffect } from 'react'
import { unitLabel } from '../lib/quantities.js'

// The screen the whole product lives or dies on.
//
// Mom has no recipe list to import — she types everything herself, and only
// the weeks she actually cooks. If picking one ingredient takes three seconds
// week one is pleasant and the library builds itself. If it takes fifteen,
// there is no week two. Hence: one field that never loses focus, matches from
// two letters, arrives with the right unit already filled in, and treats
// "not in the catalog" as one more tap rather than a detour.

const normalise = (s) =>
  (s || '')
    .toLowerCase()
    .replace(/[֑-ׇ]/g, '')  // niqqud and cantillation
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
  // On the recipe screen adding *is* the task, so offer her usual products
  // straight away. On the review screen the list itself is the content, and a
  // panel of suggestions on arrival pushed it off the bottom of the phone.
  suggestWhenEmpty = true,
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  const matches = useMemo(() => {
    const q = normalise(query)

    // Before she types, offer what she has actually bought before — and only
    // that. Ranking the whole catalogue put six arbitrary products above the
    // field on day one, taking up the screen and answering a question nobody
    // asked. The shortcut earns its space once there is history behind it.
    if (!q) {
      if (!suggestWhenEmpty) return []
      const used = products.filter((p) => (p.usage_count ?? 0) > 0)
      if (!used.length) return []
      return used
        .sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0) || a.name.localeCompare(b.name, 'he'))
        .slice(0, 6)
    }

    return products
      .map((p) => ({ p, s: score(p, q) }))
      .filter((x) => x.s !== Infinity)
      .sort((a, b) => a.s - b.s || (b.p.usage_count ?? 0) - (a.p.usage_count ?? 0))
      .slice(0, 7)
      .map((x) => x.p)
  }, [products, query, suggestWhenEmpty])

  const exact = normalise(query) && matches.some((p) => normalise(p.name) === normalise(query))

  function pick(product) {
    onAdd(product, Number(product.default_qty) || 1, product.default_unit)
    setQuery('')
    // Straight back to the field. No "saved" confirmation, no mode switch —
    // add, add, add, the way a list gets written on paper.
    inputRef.current?.focus()
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
      <p className="quickadd-hint">
        {query ? 'הקישי על המוצר להוספה' : 'אפשר גם להכתיב במקום להקליד 🎤'}
      </p>

      {(matches.length > 0 || query.trim()) && (
      <div className="suggestions" role="listbox">
        {matches.map((p) => (
          <button
            key={p.id}
            type="button"
            className="suggestion"
            onClick={() => pick(p)}
          >
            <span className="emoji" aria-hidden="true">{p.icon}</span>
            <span className="name">{p.name}</span>
            <span className="unit">
              {p.default_qty !== 1 ? `${p.default_qty} ` : ''}
              {unitLabel(p.default_unit, Number(p.default_qty))}
            </span>
          </button>
        ))}

        {query.trim() && !exact && (
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
