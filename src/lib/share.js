import { formatQuantities } from './quantities.js'
import { groupByDepartment } from './grouping.js'

// The safety net. Push notifications are reliable right up until the once they
// are not, and WhatsApp is a channel they are already in every day. Same list,
// same aisle order, plain text.

export function listAsText(items, departments, order, title) {
  const groups = groupByDepartment(items, departments, order)
  const lines = [`🛒 רשימת קניות — ${title}`, '']

  for (const g of groups) {
    lines.push(`${g.icon} ${g.name}`)
    for (const item of g.items) {
      const qty = formatQuantities(item.quantities)
      lines.push(`  • ${item.name_snapshot}${qty ? ` — ${qty}` : ''}`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

export function shareToWhatsApp(text) {
  // The native sheet is nicer where it exists, and lets them pick WhatsApp
  // themselves; the wa.me link is the fallback for everything else.
  if (navigator.share) {
    navigator.share({ text }).catch(() => {})
    return
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
}
