// Demo mode: ?demo=1
//
// The whole app driven by in-memory data, so it can be shown to someone before
// any of the Supabase setup exists — and so the screens can be checked at their
// real font sizes on a real phone, which is the only way to know whether the
// type is actually big enough.

import { SEED_PRODUCTS } from '../data/seed-products.js'

export const isDemo = () =>
  typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo')

const DEPARTMENTS = [
  ['produce', 'פירות וירקות', '🥬'], ['bakery', 'מאפייה ולחמים', '🥖'],
  ['deli', 'גבינות ומעדנייה', '🧀'], ['butcher', 'בשר, עוף ודגים', '🍗'],
  ['dairy', 'חלב וביצים', '🥛'], ['canned', 'שימורים ומזון יבש', '🥫'],
  ['grains', 'אורז, פסטה וקטניות', '🍚'], ['spices', 'תבלינים, אפייה וסוכר', '🧂'],
  ['oils', 'שמן, רטבים וממרחים', '🫒'], ['snacks', 'חטיפים ומתוקים', '🍫'],
  ['drinks', 'משקאות, קפה ותה', '☕'], ['frozen', 'קפואים', '🧊'],
  ['cleaning', 'ניקיון, כביסה וחד״פ', '🧻'], ['pharma', 'טואלטיקה ופארם', '🧴'],
  ['other', 'שונות', '📦'],
].map(([key, name_he, icon], i) => ({ key, name_he, icon, position: i + 1 }))

const products = SEED_PRODUCTS.map(([name, dept, unit, qty, icon, aliases], i) => ({
  id: `p${i}`,
  name,
  brand: '',
  icon,
  image_url: null,
  department_key: dept,
  default_unit: unit,
  default_qty: qty,
  aliases,
  // A freshly seeded catalogue has no history at all — that is the state a new
  // household is actually in, and pretending otherwise hid a real problem.
  // Only the products the demo's dishes use have been bought before.
  usage_count: 0,
  is_seed: true,
}))

const byName = (n) => products.find((p) => p.name === n)
const markUsed = (n, times) => { const p = byName(n); if (p) p.usage_count = times }

const recipes = [
  { id: 'r1', name: 'שניצל', icon: '🍗',
    items: [['חזה עוף', 2, 'kg'], ['ביצים', 1, 'tray'], ['פירורי לחם', 1, 'pack'],
            ['שמן קנולה', 1, 'bottle'], ['לימון', 1, 'kg']] },
  { id: 'r2', name: 'מרק עוף', icon: '🍲',
    items: [['עוף שלם', 1, 'unit'], ['גזר', 1, 'kg'], ['סלרי', 1, 'bunch'],
            ['בצל', 2, 'unit'], ['פטרוזיליה', 1, 'bunch'], ['אטריות', 1, 'pack']] },
  { id: 'r3', name: 'קוגל ירושלמי', icon: '🥘',
    items: [['אטריות', 2, 'pack'], ['סוכר', 0.5, 'kg'], ['ביצים', 1, 'tray'],
            ['שמן קנולה', 1, 'bottle'], ['פלפל שחור', 1, 'pack']] },
  { id: 'r4', name: 'סלט חצילים', icon: '🍆',
    items: [['חציל', 3, 'unit'], ['מיונז', 1, 'box'], ['שום', 2, 'unit'],
            ['לימון', 1, 'kg']] },
  { id: 'r5', name: 'דג מרוקאי', icon: '🐟',
    items: [['אמנון', 1, 'kg'], ['פלפל אדום', 1, 'kg'], ['כוסברה', 1, 'bunch'],
            ['חומוס משומר', 1, 'can'], ['פפריקה', 1, 'pack']] },
].map((r) => ({
  id: r.id,
  name: r.name,
  icon: r.icon,
  times_used: 3,
  last_used_at: new Date().toISOString(),
  recipe_ingredients: r.items
    .map(([n, quantity, unit], i) => {
      const p = byName(n)
      return p ? { id: `${r.id}-${i}`, product_id: p.id, quantity, unit, position: i } : null
    })
    .filter(Boolean),
}))

// A household a few weeks in: the staples it keeps buying have history behind
// them, everything else in the catalogue has none.
for (const [n, t] of [['חלב', 9], ['ביצים', 8], ['לחם אחיד', 7],
                      ['עגבניות', 6], ['מלפפונים', 5], ['בצל', 4]]) markUsed(n, t)

const list = {
  id: 'l1',
  title: 'לשבת',
  status: 'sent',
  created_at: new Date().toISOString(),
}

const DEMO_STATES = { 'חזה עוף': 'bought', 'עגבניות': 'bought', 'בצל': 'bought',
                      'פטרוזיליה': 'missing', 'ביצים': 'bought', 'לחם אחיד': 'bought' }

const order = DEPARTMENTS.map((d) => d.key)

let items = (() => {
  const picked = ['חזה עוף', 'ביצים', 'פירורי לחם', 'עוף שלם', 'גזר', 'סלרי',
                  'בצל', 'פטרוזיליה', 'אטריות', 'סוכר', 'חציל', 'מיונז',
                  'שום', 'לימון', 'עגבניות', 'לחם אחיד', 'חלב', 'שמנת חמוצה']
  return picked.map((n, i) => {
    const p = byName(n)
    if (!p) return null
    const status = DEMO_STATES[n] ?? 'pending'
    return {
      id: `i${i}`,
      list_id: 'l1',
      product_id: p.id,
      name_snapshot: p.name,
      brand_snapshot: '',
      icon_snapshot: p.icon,
      image_snapshot: null,
      department_key: p.department_key,
      quantities: [{ value: p.default_qty, unit: p.default_unit }],
      source_recipes:
        n === 'חלב' || n === 'שמנת חמוצה'
          ? []
          : [{ id: 'r1', name: recipes[i % recipes.length].name }],
      is_extra: n === 'חלב' || n === 'שמנת חמוצה',
      sort_index: (order.indexOf(p.department_key) + 1) * 1000 + i,
      status,
      substitute_note: n === 'שמנת חמוצה' ? '' : '',
      substitute_image_url: null,
      planner_reply: n === 'פטרוזיליה' ? 'קח כוסברה במקום' : '',
      bought_at: status === 'bought' ? new Date().toISOString() : null,
      updated_at: new Date(Date.now() - i * 60000).toISOString(),
    }
  }).filter(Boolean)
})()

let seq = 1000
const nextId = () => `x${seq++}`

export const demo = {
  session: {
    user: { id: 'demo-user' },
    member: { id: 'm1', name: 'הדגמה', role: 'admin', text_scale: 'large', household_id: 'h1' },
    household: { id: 'h1', name: 'הבית', department_order: order },
  },
  getDepartments: async () => DEPARTMENTS,
  getProducts: async () => products,
  getRecipes: async () => recipes,
  getListItems: async () => items,
  getLatestList: async () => list,

  updateItem: (id, patch) => {
    items = items.map((i) =>
      i.id === id
        ? {
            ...i, ...patch,
            updated_at: new Date().toISOString(),
            bought_at: patch.status === 'bought' ? new Date().toISOString() : i.bought_at,
          }
        : i,
    )
  },
  removeItem: (id) => { items = items.filter((i) => i.id !== id) },
  setDepartmentOrder: (next) => { demo.session.household.department_order = next },

  createProduct: async (fields) => {
    const p = {
      id: nextId(),
      brand: '', icon: '📦', image_url: null, aliases: [], usage_count: 0, is_seed: false,
      ...fields,
    }
    products.unshift(p)
    return p
  },

  saveRecipe: async ({ id, name, icon, ingredients }) => {
    const recipeId = id ?? nextId()
    const record = {
      id: recipeId, name, icon, times_used: 0, last_used_at: null,
      recipe_ingredients: ingredients.map((ing, i) => ({
        id: `${recipeId}-${i}`,
        product_id: ing.product_id, quantity: ing.quantity, unit: ing.unit, position: i,
      })),
    }
    const at = recipes.findIndex((r) => r.id === recipeId)
    if (at >= 0) recipes[at] = record
    else recipes.unshift(record)
    return recipeId
  },

  deleteRecipe: async (id) => {
    const at = recipes.findIndex((r) => r.id === id)
    if (at >= 0) recipes.splice(at, 1)
  },

  // Mirrors build_list(): merge by product, sum within a unit family, order by
  // aisle. Enough for the demo to behave like the real thing.
  buildList: async (recipeIds, title) => {
    const merged = new Map()
    for (const rid of recipeIds ?? []) {
      const r = recipes.find((x) => x.id === rid)
      if (!r) continue
      for (const ing of r.recipe_ingredients) {
        const key = `${ing.product_id}|${ing.unit}`
        const at = merged.get(key)
        if (at) { at.quantity += ing.quantity; at.sources.push(r.name) }
        else merged.set(key, { ...ing, sources: [r.name] })
      }
    }

    list.title = title || list.title
    list.status = 'draft'
    items = [...merged.values()].map((m, i) => {
      const p = products.find((x) => x.id === m.product_id)
      return {
        id: nextId(),
        list_id: list.id,
        product_id: m.product_id,
        name_snapshot: p?.name ?? 'מוצר',
        brand_snapshot: '',
        icon_snapshot: p?.icon ?? '📦',
        image_snapshot: null,
        department_key: p?.department_key ?? 'other',
        quantities: [{ value: m.quantity, unit: m.unit }],
        source_recipes: [...new Set(m.sources)].map((n) => ({ id: n, name: n })),
        is_extra: false,
        sort_index: (order.indexOf(p?.department_key ?? 'other') + 1) * 1000 + i,
        status: 'pending',
        substitute_note: '', substitute_image_url: null, planner_reply: '',
        bought_at: null,
        updated_at: new Date().toISOString(),
      }
    })
    return { data: list.id, error: null }
  },

  addListItem: async (productId, value, unit) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return { data: null, error: null }
    items = [...items, {
      id: nextId(), list_id: list.id, product_id: productId,
      name_snapshot: p.name, brand_snapshot: '', icon_snapshot: p.icon, image_snapshot: null,
      department_key: p.department_key,
      quantities: [{ value, unit }],
      source_recipes: [], is_extra: true,
      sort_index: (order.indexOf(p.department_key) + 1) * 1000 + 500,
      status: 'pending', substitute_note: '', substitute_image_url: null, planner_reply: '',
      bought_at: null, updated_at: new Date().toISOString(),
    }]
    return { data: null, error: null }
  },

  setListStatus: async (status) => { list.status = status },
}
