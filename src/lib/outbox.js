// The outbox — the reason this works in the basement of the supermarket.
//
// Every status change Dad makes is applied locally first and queued here. The
// flusher drains it whenever the network comes back. Because each entry carries
// the client's own timestamp and the server refuses older writes, a queue that
// drains late can never clobber something newer, and a retry is harmless.

import { supabase } from './supabase.js'
import { outboxAdd, outboxAll, outboxDel, outboxPut } from './idb.js'
import { isDemo, demo } from './demo.js'

const listeners = new Set()
let pending = 0
let flushing = false
let timer = null

export function onOutboxChange(fn) {
  listeners.add(fn)
  fn(pending)
  return () => listeners.delete(fn)
}

function announce(n) {
  pending = n
  listeners.forEach((fn) => fn(n))
}

async function refreshCount() {
  const all = await outboxAll()
  announce(all.length)
  return all
}

export async function queueItemUpdate(itemId, patch) {
  if (isDemo()) { demo.updateItem(itemId, patch); return }
  await outboxAdd({
    itemId,
    patch,
    clientUpdatedAt: new Date().toISOString(),
    attempts: 0,
  })
  await refreshCount()
  flush()
}

export async function flush() {
  if (flushing || !supabase) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return

  flushing = true
  try {
    const entries = await outboxAll()
    for (const entry of entries) {
      const { error } = await supabase.rpc('apply_item_update', {
        p_item: entry.itemId,
        p_patch: entry.patch,
        p_client_ts: entry.clientUpdatedAt,
      })

      if (!error) {
        await outboxDel(entry.id)
        continue
      }

      // A row that no longer exists, or a payload the server rejects outright,
      // will never succeed. Retrying it forever would wedge everything behind
      // it, so give up after a few tries and let the rest through.
      const attempts = (entry.attempts ?? 0) + 1
      if (attempts >= 8) {
        console.warn('outbox: dropping entry after repeated failures', entry, error)
        await outboxDel(entry.id)
      } else {
        await outboxPut({ ...entry, attempts })
        break // network is unhappy; stop and let the timer try again
      }
    }
  } finally {
    flushing = false
    const left = await refreshCount()
    schedule(left.length > 0)
  }
}

function schedule(hasPending) {
  clearTimeout(timer)
  if (hasPending) timer = setTimeout(flush, 15000)
}

export function startOutbox() {
  refreshCount().then((all) => {
    if (all.length) flush()
  })
  window.addEventListener('online', flush)
  // Coming back from a locked screen is the most common moment for a phone to
  // rejoin the network without firing `online`.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flush()
  })
}
