// A very small IndexedDB key-value store.
//
// Firestore would have handed us offline persistence; Supabase does not, so the
// read cache and the write queue are ours to keep. This is the storage floor
// under both — no library, two object stores, promise-shaped.

const DB_NAME = 'hashlamot'
const DB_VERSION = 1
const CACHE = 'cache'
const OUTBOX = 'outbox'

let dbPromise = null

function open() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(CACHE)) db.createObjectStore(CACHE)
      if (!db.objectStoreNames.contains(OUTBOX)) {
        db.createObjectStore(OUTBOX, { keyPath: 'id', autoIncrement: true })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req?.result)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

// Storage is a convenience, never a requirement. Private mode, a full disk or
// a browser that refuses IndexedDB must degrade to "online only", not to a
// blank screen.
const safe = (p, fallback) => p.catch(() => fallback)

export const cacheGet = (key) => safe(tx(CACHE, 'readonly', (s) => s.get(key)), undefined)
export const cacheSet = (key, value) =>
  safe(tx(CACHE, 'readwrite', (s) => s.put(value, key)), undefined)
export const outboxAdd = (entry) =>
  safe(tx(OUTBOX, 'readwrite', (s) => s.add(entry)), undefined)
export const outboxAll = () => safe(tx(OUTBOX, 'readonly', (s) => s.getAll()), [])
export const outboxDel = (id) =>
  safe(tx(OUTBOX, 'readwrite', (s) => s.delete(id)), undefined)
export const outboxPut = (entry) =>
  safe(tx(OUTBOX, 'readwrite', (s) => s.put(entry)), undefined)
