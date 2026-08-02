// Quantities the way a person says them.
//
// "חצי קילו", not "0.5 ק״ג". "קילו וחצי", not "1.5". Reading a number and
// mentally converting it is work, and this list gets read in a supermarket
// aisle by someone who should not have to do work.

const UNITS = {
  kg:     { one: 'קילו',  many: 'ק״ג',    base: 'קילו',  kind: 'scalar' },
  g:      { one: 'גרם',   many: 'גרם',                   kind: 'plain'  },
  l:      { one: 'ליטר',  many: 'ליטר',   base: 'ליטר',  kind: 'scalar' },
  ml:     { one: 'מ״ל',   many: 'מ״ל',                   kind: 'plain'  },
  unit:   { one: 'יחידה', many: 'יחידות',                kind: 'count'  },
  pack:   { one: 'חבילה', many: 'חבילות',                kind: 'count'  },
  box:    { one: 'קופסה', many: 'קופסאות',               kind: 'count'  },
  bunch:  { one: 'צרור',  many: 'צרורות',                kind: 'count'  },
  bag:    { one: 'שקית',  many: 'שקיות',                 kind: 'count'  },
  tray:   { one: 'תבנית', many: 'תבניות',                kind: 'count'  },
  bottle: { one: 'בקבוק', many: 'בקבוקים',               kind: 'count'  },
  can:    { one: 'פחית',  many: 'פחיות',                 kind: 'count'  },
}

export const UNIT_OPTIONS = Object.entries(UNITS).map(([value, u]) => ({
  value,
  label: u.many,
}))

export function unitLabel(unit, value = 2) {
  const u = UNITS[unit]
  if (!u) return unit
  return value === 1 ? u.one : u.many
}

// On its own: "חצי קילו". Trailing a whole number: "קילו וחצי", "2 ק״ג ורבע".
const FRACTIONS = {
  0.25: 'רבע',
  0.5: 'חצי',
  0.75: 'שלושת רבעי',
}
const FRACTION_SUFFIX = {
  0.25: 'ורבע',
  0.5: 'וחצי',
  0.75: 'ושלושת רבעי',
}

const round = (n) => Math.round(n * 1000) / 1000

export function formatQuantity(q) {
  if (!q) return ''
  const unit = UNITS[q.unit]
  const value = round(Number(q.value))
  if (!unit || !Number.isFinite(value)) return `${q.value} ${q.unit}`

  if (unit.kind === 'scalar') {
    const whole = Math.floor(value)
    const frac = round(value - whole)

    if (whole === 0 && FRACTIONS[frac]) return `${FRACTIONS[frac]} ${unit.base}`
    if (whole === 1 && frac === 0) return unit.base
    if (whole === 1 && FRACTION_SUFFIX[frac]) return `${unit.base} ${FRACTION_SUFFIX[frac]}`
    if (FRACTION_SUFFIX[frac]) return `${whole} ${unit.many} ${FRACTION_SUFFIX[frac]}`
    if (frac === 0) return `${whole} ${unit.many}`
    return `${value} ${unit.many}`
  }

  if (unit.kind === 'count') {
    return value === 1 ? unit.one : `${value} ${unit.many}`
  }

  return `${value} ${unit.many}`
}

// Units that cannot combine sit side by side rather than being forced into
// one number: "עגבניות — 2 ק״ג + 3 יחידות".
export function formatQuantities(quantities) {
  if (!Array.isArray(quantities) || quantities.length === 0) return ''
  return quantities.map(formatQuantity).filter(Boolean).join(' + ')
}

export function formatSources(sourceRecipes) {
  if (!Array.isArray(sourceRecipes) || sourceRecipes.length === 0) return ''
  return sourceRecipes.map((r) => `ל${r.name}`).join(', ')
}
