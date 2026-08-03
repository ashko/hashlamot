import { useEffect, useState, useCallback, useRef } from 'react'
import ItemRow from '../components/ItemRow.jsx'
import { SyncBar, Spinner, Empty } from '../components/ui.jsx'
import { getListItems, getDepartments, setListStatus, subscribeToList } from '../lib/data.js'
import { queueItemUpdate, flush, onWriteRejected } from '../lib/outbox.js'
import { groupByDepartment, countByStatus, departmentStyle } from '../lib/grouping.js'
import { useSession } from '../lib/session.jsx'
import { uploadImage } from '../lib/images.js'

// Dad's screen. Everything here assumes no signal and a phone held in one hand
// next to a trolley: whole-row taps, no swipes, marks applied instantly and
// queued for later, and a screen that refuses to sleep mid-aisle.

function useWakeLock(active) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock = null
    let cancelled = false

    const acquire = async () => {
      try {
        lock = await navigator.wakeLock.request('screen')
      } catch {
        // Denied or unsupported — the list still works, it just dims.
      }
    }
    acquire()

    // iOS drops the lock whenever the tab is backgrounded, including a lock
    // screen. Take it again on the way back.
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !cancelled) acquire()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release?.().catch(() => {})
    }
  }, [active])
}

export default function ShopperList({ list, onDone, onSettings }) {
  const { household, setDepartmentOrder } = useSession()
  const [items, setItems] = useState(null)
  const [departments, setDepartments] = useState([])
  const [substituting, setSubstituting] = useState(null)
  const [note, setNote] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  useWakeLock(Boolean(list))

  const refresh = useCallback(async () => {
    const data = await getListItems(list.id)
    setItems(data ?? [])
  }, [list.id])

  useEffect(() => {
    Promise.all([refresh(), getDepartments()]).then(([, d]) => setDepartments(d ?? []))
  }, [refresh])

  useEffect(() => {
    const unsub = subscribeToList(list.id, refresh)
    // Realtime replays nothing from the time the socket was down, so a full
    // refetch on every reconnect is what actually keeps the two phones honest.
    const onBack = () => {
      if (document.visibilityState === 'visible') { flush(); refresh() }
    }
    window.addEventListener('online', onBack)
    document.addEventListener('visibilitychange', onBack)
    const unsubRejected = onWriteRejected(refresh)
    return () => {
      unsub()
      unsubRejected()
      window.removeEventListener('online', onBack)
      document.removeEventListener('visibilitychange', onBack)
    }
  }, [list.id, refresh])

  // Optimistic: the row changes under his thumb, the network catches up later.
  function mark(item, patch) {
    setItems((s) => s.map((x) => (x.id === item.id ? { ...x, ...patch } : x)))
    queueItemUpdate(item.id, patch)
  }

  const toggle = (item) =>
    mark(item, { status: item.status === 'bought' ? 'pending' : 'bought' })

  function saveSubstitute(imageUrl) {
    mark(substituting, {
      status: 'substituted',
      substitute_note: note.trim(),
      ...(imageUrl ? { substitute_image_url: imageUrl } : {}),
    })
    setSubstituting(null)
    setNote('')
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const url = await uploadImage(file, household.id, 'sub')
      saveSubstitute(url)
    } catch {
      // No signal for the upload? Keep the note, drop the photo.
      saveSubstitute(null)
    } finally {
      setUploading(false)
    }
  }

  function moveDepartment(key, direction) {
    const order = [...(household?.department_order ?? [])]
    const i = order.indexOf(key)
    const j = i + direction
    if (i < 0 || j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    setDepartmentOrder(order)
  }

  if (!items) return <Spinner />

  const stats = countByStatus(items)
  const groups = groupByDepartment(items, departments, household?.department_order)

  if (substituting) {
    return (
      <div className="screen">
        <div className="topbar">
          <button className="icon-btn" onClick={() => setSubstituting(null)} aria-label="חזרה">→</button>
          <h1>{substituting.name_snapshot}</h1>
        </div>
        <div className="screen-body stack pad" style={{ paddingTop: 16 }}>
          <label className="label" htmlFor="sn">מה לקחת במקום?</label>
          <input
            id="sn"
            className="field"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="תנובה 15%"
            autoFocus
          />
          <p className="quickadd-hint">אמא תראה את זה מיד</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onPhoto}
            style={{ display: 'none' }}
          />
          <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
            📷 לצלם מה שלקחת
          </button>
        </div>
        <div className="screen-foot">
          <button className="btn" disabled={uploading} onClick={() => saveSubstitute(null)}>
            {uploading ? 'רגע…' : 'שמירה'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className="topbar">
        <h1>{list.title}</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="הגדרות">⚙</button>
      </div>

      <div className="progress">
        <div className="progress-head">
          <span className="progress-count">{stats.done} מתוך {stats.total}</span>
        </div>
        <div
          className="track"
          role="progressbar"
          aria-valuenow={stats.done}
          aria-valuemin={0}
          aria-valuemax={stats.total}
        >
          <div
            className="track-fill"
            style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
          />
        </div>
      </div>
      <SyncBar />

      <div className="screen-body">
        {items.length === 0 && <Empty icon="🛒" title="הרשימה ריקה" />}

        {groups.map((g, gi) => (
          <div key={g.key}>
            <div className="dept-band" style={departmentStyle(g.key)}>
              <span className="dept-icon" aria-hidden="true">{g.icon}</span>
              {g.name}
              <span className="count">{g.items.length}</span>
              {/* Fixing the order where the mistake is actually felt, rather
                  than in a settings screen he will never open. */}
              <span style={{ display: 'flex', gap: 6, marginInlineStart: 8 }}>
                <button
                  className="icon-btn"
                  style={{ minWidth: 48, minHeight: 48, fontSize: 18 }}
                  onClick={() => moveDepartment(g.key, -1)}
                  disabled={gi === 0}
                  aria-label={`להעביר את ${g.name} למעלה`}
                >↑</button>
                <button
                  className="icon-btn"
                  style={{ minWidth: 48, minHeight: 48, fontSize: 18 }}
                  onClick={() => moveDepartment(g.key, 1)}
                  disabled={gi === groups.length - 1}
                  aria-label={`להעביר את ${g.name} למטה`}
                >↓</button>
              </span>
            </div>

            {g.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                showActions
                onToggle={toggle}
                onMissing={(i) => mark(i, { status: 'missing' })}
                onSubstitute={(i) => { setSubstituting(i); setNote('') }}
              />
            ))}
          </div>
        ))}
      </div>

      <div className="screen-foot">
        <button
          className="btn"
          onClick={async () => {
            await flush()
            await setListStatus(list.id, 'done')
            onDone()
          }}
        >
          סיימתי
        </button>
      </div>
    </div>
  )
}
