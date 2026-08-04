// Quantities the way a person says them.
//
// "חצי קילו", not "0.5 ק״ג". "קילו וחצי", not "1.5". Reading a number and
// mentally converting it is work, and this list gets read in a supermarket
// aisle by someone who should not have to do work.

// family and factor mirror the units table in the database, so a conversion
// done on the phone and one done by the merge agree.
const UNITS = {
  kg:     { one: 'קילו',  many: 'ק״ג',    base: 'קילו',  kind: 'scalar', family: 'mass',   factor: 1000 },
  g:      { one: 'גרם',   many: 'גרם',                   kind: 'plain',  family: 'mass',   factor: 1 },
  l:      { one: 'ליטר',  many: 'ליטר',   base: 'ליטר',  kind: 'scalar', family: 'volume', factor: 1000 },
  ml:     { one: 'מ״ל',   many: 'מ״ל',                   kind: 'plain',  family: 'volume', factor: 1 },
  unit:   { one: 'יחידה', many: 'יחידות',                kind: 'count',  family: 'c_unit',   factor: 1 },
  pack:   { one: 'חבילה', many: 'חבילות',                kind: 'count',  family: 'c_pack',   factor: 1 },
  box:    { one: 'קופסה', many: 'קופסאות',               kind: 'count',  family: 'c_box',    factor: 1 },
  bunch:  { one: 'צרור',  many: 'צרורות',                kind: 'count',  family: 'c_bunch',  factor: 1 },
  bag:    { one: 'שקית',  many: 'שקיות',                 kind: 'count',  family: 'c_bag',    factor: 1 },
  tray:   { one: 'תבנית', many: 'תבניות',                kind: 'count',  family: 'c_tray',   factor: 1 },
  bottle: { one: 'בקבוק', many: 'בקבוקים',               kind: 'count',  family: 'c_bottle', factor: 1 },
  can:    { one: 'פחית',  many: 'פחיות',                 kind: 'count',  family: 'c_can',    factor: 1 },
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

// Kilos and litres move by quarters — רבע, חצי, שלושת רבעי — because those are
// the amounts people say out loud. Everything countable moves by one.
const STEP = { kg: 0.25, l: 0.25, g: 50, ml: 50 }
export const stepFor = (unit) => STEP[unit] ?? 1

// The handful worth offering inline. The full set lives in the editor, which is
// one tap away when none of these is right.
export const QUICK_UNITS = ['kg', 'g', 'unit', 'pack', 'box', 'l']

// Changing kilos to grams should give the same amount in grams, not start over.
// Only a jump between families — weight to a count of packets — has no sensible
// conversion, and there the new unit's own step is the honest answer.
export function convertQuantity(value, from, to) {
  const a = UNITS[from]
  const b = UNITS[to]
  if (!a || !b) return value
  if (a.family !== b.family) return stepFor(to)
  return round((value * a.factor) / b.factor)
}

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
