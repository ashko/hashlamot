// Grouped by aisle, never by recipe. This is the whole point of the app for
// Dad: the list is in the order he walks, so he crosses the shop once.

export function groupByDepartment(items, departments, order) {
  const meta = new Map(departments.map((d) => [d.key, d]))
  const rank = new Map((order ?? []).map((k, i) => [k, i]))

  const buckets = new Map()
  for (const item of items) {
    const key = item.department_key
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(item)
  }

  return [...buckets.entries()]
    .map(([key, list]) => ({
      key,
      name: meta.get(key)?.name_he ?? 'שונות',
      icon: meta.get(key)?.icon ?? '📦',
      items: list.sort((a, b) => a.sort_index - b.sort_index),
      // A department not in his saved order sits at the end rather than
      // disappearing.
      rank: rank.has(key) ? rank.get(key) : 999,
    }))
    // Empty aisles are simply not shown.
    .filter((g) => g.items.length > 0)
    .sort((a, b) => a.rank - b.rank)
}

export function countByStatus(items) {
  const out = { total: items.length, bought: 0, missing: 0, substituted: 0, pending: 0 }
  for (const i of items) out[i.status] = (out[i.status] ?? 0) + 1
  // Anything Dad has dealt with counts as progress, even if the shelf was bare.
  out.done = out.bought + out.missing + out.substituted
  return out
}
