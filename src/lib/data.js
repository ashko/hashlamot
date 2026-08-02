import { supabase } from './supabase.js'
import { cacheGet, cacheSet } from './idb.js'
import { isDemo, demo } from './demo.js'

const DEMO = isDemo()

// Read path: serve from cache immediately, refresh from the network when there
// is one. Dad opening the app in a basement aisle sees the full list, not a
// spinner, and Mom at home sees the same thing a moment fresher.
async function cached(key, query) {
  const local = await cacheGet(key)
  let fresh = null
  try {
    const { data, error } = await query()
    if (error) throw error
    fresh = data
    await cacheSet(key, data)
  } catch {
    // offline — the cache is the answer
  }
  return fresh ?? local ?? null
}

export const getDepartments = () =>
  DEMO ? demo.getDepartments() : cached('departments', () =>
    supabase.from('departments').select('*').order('position'),
  )

export const getProducts = () =>
  DEMO ? demo.getProducts() : cached('products', () =>
    supabase.from('products').select('*').order('usage_count', { ascending: false }),
  )

export const getRecipes = () =>
  DEMO ? demo.getRecipes() : cached('recipes', () =>
    supabase
      .from('recipes')
      .select('*, recipe_ingredients(id, product_id, quantity, unit, position)')
      .order('last_used_at', { ascending: false, nullsFirst: false }),
  )

export const getListItems = (listId) =>
  DEMO ? demo.getListItems() : cached(`list:${listId}`, () =>
    supabase.from('list_items').select('*').eq('list_id', listId).order('sort_index'),
  )

export async function getLatestList() {
  if (DEMO) return demo.getLatestList()
  const { data } = await supabase
    .from('lists')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (data) await cacheSet('activeList', data)
  return data ?? (await cacheGet('activeList'))
}

export async function createProduct(fields, householdId) {
  const { name, department_key, default_unit, default_qty } = fields
  if (DEMO) return demo.createProduct(fields)

  const { data, error } = await supabase
    .from('products')
    .insert({ household_id: householdId, name, department_key, default_unit, default_qty })
    .select()
    .single()
  if (error) throw error

  // Extend the cache rather than blanking it. Writing null here meant the next
  // read with no network came back empty — an empty catalog is the one thing
  // this app must never show her.
  const known = (await cacheGet('products')) ?? []
  await cacheSet('products', [data, ...known])
  return data
}

export async function saveRecipe({ id, name, icon, householdId, ingredients }) {
  if (DEMO) return demo.saveRecipe({ id, name, icon, ingredients })
  let recipeId = id
  if (recipeId) {
    const { error } = await supabase.from('recipes').update({ name, icon }).eq('id', recipeId)
    if (error) throw error
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId)
  } else {
    const { data, error } = await supabase
      .from('recipes')
      .insert({ household_id: householdId, name, icon })
      .select()
      .single()
    if (error) throw error
    recipeId = data.id
  }

  if (ingredients.length) {
    const { error } = await supabase.from('recipe_ingredients').insert(
      ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        product_id: ing.product_id,
        quantity: ing.quantity,
        unit: ing.unit,
        position: i,
      })),
    )
    if (error) throw error
  }
  await refreshRecipeCache()
  return recipeId
}

// Recipes are small and always read whole, so a plain refetch is simpler and
// safer than patching the cached array by hand.
async function refreshRecipeCache() {
  try {
    const { data } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(id, product_id, quantity, unit, position)')
      .order('last_used_at', { ascending: false, nullsFirst: false })
    if (data) await cacheSet('recipes', data)
  } catch {
    // offline — the stale list is still better than none
  }
}

export async function deleteRecipe(id) {
  if (DEMO) return demo.deleteRecipe(id)
  const { error } = await supabase.from('recipes').delete().eq('id', id)
  if (error) throw error
  await refreshRecipeCache()
}

export const buildList = (recipeIds, title) =>
  DEMO ? demo.buildList(recipeIds, title)
       : supabase.rpc('build_list', { p_recipe_ids: recipeIds, p_title: title })

export const addListItem = (listId, productId, value, unit) =>
  DEMO ? demo.addListItem(productId, value, unit)
       : supabase.rpc('add_list_item', {
           p_list_id: listId,
           p_product_id: productId,
           p_value: value,
           p_unit: unit,
         })

export const setListStatus = (listId, status) =>
  DEMO ? demo.setListStatus(status)
       : supabase.rpc('set_list_status', { p_list: listId, p_status: status })

export const removeListItem = (id) =>
  DEMO ? demo.removeItem(id) : supabase.from('list_items').delete().eq('id', id)

// Mom adjusting an amount before the list goes out. A merged row can hold
// several incompatible units; editing collapses it to the single one she chose,
// which is what she means by changing it.
export const setListItemQuantity = (id, value, unit) =>
  DEMO
    ? demo.updateItem(id, { quantities: [{ value, unit }] })
    : supabase.from('list_items').update({ quantities: [{ value, unit }] }).eq('id', id)

export const setPlannerReply = (id, reply) =>
  DEMO ? demo.updateItem(id, { planner_reply: reply })
       : supabase.rpc('apply_item_update', {
    p_item: id,
    p_patch: { planner_reply: reply },
    p_client_ts: new Date().toISOString(),
  })

export const suggestedOrder = (trips = 3) =>
  DEMO ? Promise.resolve({ data: null })
       : supabase.rpc('suggested_department_order', { p_trips: trips })

export const completedTrips = () =>
  DEMO ? Promise.resolve({ data: 0 }) : supabase.rpc('completed_trip_count')

// Live updates. Realtime does not replay what happened while the socket was
// down, so every caller also refetches on reconnect — otherwise Dad comes up
// from the basement and never sees Mom's answer.
export function subscribeToList(listId, onChange) {
  if (DEMO) return () => {}
  const channel = supabase
    .channel(`list:${listId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'list_items', filter: `list_id=eq.${listId}` },
      onChange,
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'lists', filter: `id=eq.${listId}` },
      onChange,
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
