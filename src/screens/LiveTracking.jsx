import { useEffect, useState, useCallback } from 'react'
import { Spinner, Empty } from '../components/ui.jsx'
import { getListItems, subscribeToList, setPlannerReply } from '../lib/data.js'
import { countByStatus } from '../lib/grouping.js'
import { formatQuantities } from '../lib/quantities.js'

// The other half of the loop. Without this, "חסר" is a dead end and Dad still
// has to phone home — which was the whole problem.

const REPLIES = (item) => [
  `קח משהו דומה במקום`,
  `לא צריך, נסתדר`,
  `תתקשר אליי`,
]

export default function LiveTracking({ list, onBack }) {
  const [items, setItems] = useState(null)

  const refresh = useCallback(async () => {
    setItems((await getListItems(list.id)) ?? [])
  }, [list.id])

  useEffect(() => {
    refresh()
    const unsub = subscribeToList(list.id, refresh)
    const onBackOnline = () => refresh()
    window.addEventListener('online', onBackOnline)
    return () => {
      unsub()
      window.removeEventListener('online', onBackOnline)
    }
  }, [list.id, refresh])

  if (!items) return <Spinner />

  const stats = countByStatus(items)
  const needsAnswer = items.filter(
    (i) => (i.status === 'missing' || i.status === 'substituted') && !i.planner_reply,
  )
  const recent = items
    .filter((i) => i.status !== 'pending')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 12)

  async function reply(item, text) {
    setItems((s) => s.map((x) => (x.id === item.id ? { ...x, planner_reply: text } : x)))
    await setPlannerReply(item.id, text)
  }

  const finished = list.status === 'done'

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>
        <h1>{finished ? 'אבא סיים' : 'אבא בסופר'}</h1>
      </div>

      <div className="progress">
        <div className="progress-head">
          <span className="progress-count">{stats.done} מתוך {stats.total}</span>
          {stats.missing > 0 && (
            <span style={{ color: 'var(--missing)', fontWeight: 700 }}>
              {stats.missing} חסרים
            </span>
          )}
        </div>
        <div className="track">
          <div
            className="track-fill"
            style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="screen-body stack" style={{ paddingTop: 12 }}>
        {needsAnswer.map((item) => (
          <div className="pad" key={item.id}>
            <div className="card card-alert">
              <h2>
                {item.status === 'missing' ? 'חסר: ' : 'הוחלף: '}
                {item.name_snapshot}
              </h2>
              {item.substitute_note && (
                <p style={{ margin: '0 0 10px' }}>לקח: {item.substitute_note}</p>
              )}
              {item.substitute_image_url && (
                <img
                  src={item.substitute_image_url}
                  alt=""
                  style={{ width: '100%', borderRadius: 10, marginBottom: 10 }}
                />
              )}
              {item.status === 'missing' && (
                <div className="stack">
                  {REPLIES(item).map((text) => (
                    <button key={text} className="btn btn-ghost" onClick={() => reply(item, text)}>
                      {text}
                    </button>
                  ))}
                </div>
              )}
              {item.status === 'substituted' && (
                <button className="btn btn-ghost" onClick={() => reply(item, 'מצוין, תודה')}>
                  מצוין, תודה
                </button>
              )}
            </div>
          </div>
        ))}

        {finished && (
          <div className="pad">
            <div className="card card-accent">
              <h2>הקנייה הסתיימה</h2>
              <p style={{ margin: 0 }}>
                נקנו {stats.bought}
                {stats.substituted ? `, הוחלפו ${stats.substituted}` : ''}
                {stats.missing ? `, חסרים ${stats.missing}` : ''}.
              </p>
            </div>
          </div>
        )}

        {recent.length === 0 && !finished && (
          <Empty icon="🛒" title="אבא עוד לא התחיל">
            ברגע שהוא יסמן משהו, זה יופיע כאן.
          </Empty>
        )}

        {recent.length > 0 && (
          <div>
            <div className="dept-band" style={{ position: 'static' }}>מה קרה עד עכשיו</div>
            {recent.map((i) => (
              <div className="row" key={i.id}>
                <div className="thumb" aria-hidden="true">{i.icon_snapshot}</div>
                <div>
                  <div className="row-name">{i.name_snapshot}</div>
                  <div className="row-sub">{formatQuantities(i.quantities)}</div>
                </div>
                <div
                  className="row-qty"
                  style={{
                    color:
                      i.status === 'bought' ? 'var(--bought)'
                      : i.status === 'missing' ? 'var(--missing)'
                      : 'var(--swap)',
                  }}
                >
                  {i.status === 'bought' ? '✓ נקנה'
                    : i.status === 'missing' ? '✗ חסר'
                    : '⇄ הוחלף'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
