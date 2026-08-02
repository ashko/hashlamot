import { useEffect, useState } from 'react'
import { useSession } from './lib/session.jsx'
import { configuredUrl } from './lib/supabase.js'
import { getLatestList, buildList } from './lib/data.js'
import { startOutbox } from './lib/outbox.js'
import Pairing from './screens/Pairing.jsx'
import PlannerHome from './screens/PlannerHome.jsx'
import RecipeEditor from './screens/RecipeEditor.jsx'
import ListReview from './screens/ListReview.jsx'
import LiveTracking from './screens/LiveTracking.jsx'
import ShopperList from './screens/ShopperList.jsx'
import Settings from './screens/Settings.jsx'
import { Spinner, Empty } from './components/ui.jsx'

export default function App() {
  const session = useSession()
  const [view, setView] = useState({ name: 'home' })
  const [list, setList] = useState(null)
  // The admin is not a third kind of user with a third kind of screen — they
  // just need to see what each parent sees, to help over the phone.
  const [asRole, setAsRole] = useState(null)

  useEffect(() => { startOutbox() }, [])

  // Text size is a member setting, applied to the whole document.
  useEffect(() => {
    document.documentElement.dataset.scale = session?.member?.text_scale ?? 'large'
  }, [session?.member?.text_scale])

  const role = asRole ?? session?.member?.role
  const isAdmin = session?.member?.role === 'admin'

  useEffect(() => {
    if (session?.status !== 'ready') return
    getLatestList().then(setList)
  }, [session?.status, view.name])

  if (session?.status === 'loading') return <Spinner />

  if (session?.status === 'unconfigured') {
    return (
      <div className="screen">
        <div className="screen-body">
          <Empty icon="⚙️" title="חסרה הגדרה">
            צריך להגדיר את VITE_SUPABASE_URL ו־VITE_SUPABASE_ANON_KEY.
            הפרטים ב־README.
          </Empty>
        </div>
      </div>
    )
  }

  if (session?.status === 'error') {
    // "No connection" used to be the answer to every possible failure here,
    // which sent someone hunting for a network problem when the real cause was
    // a setting. Only say it when the device is actually offline; otherwise
    // show what went wrong, quietly, under a message the parents can act on.
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false
    const detail = session.error?.message || String(session.error ?? '')

    return (
      <div className="screen">
        <div className="screen-body">
          <Empty icon={offline ? '📴' : '⚠️'} title={offline ? 'אין חיבור' : 'משהו לא עבד'}>
            {offline ? 'נסו שוב כשתהיה רשת.' : 'אפשר לנסות שוב.'}
          </Empty>
          {!offline && detail && (
            <div className="pad" style={{ textAlign: 'center' }}>
              {session.step && (
                <p className="subtle" style={{ margin: '0 0 6px', fontWeight: 700 }}>
                  נכשל בשלב: {session.step}
                </p>
              )}
              <p
                className="subtle"
                style={{ margin: 0, wordBreak: 'break-word', direction: 'ltr' }}
              >
                {detail}
              </p>
              <p
                className="subtle"
                style={{
                  marginTop: 10, fontSize: 'var(--fs-small)',
                  wordBreak: 'break-all', direction: 'ltr', opacity: .8,
                }}
              >
                {configuredUrl}
              </p>
            </div>
          )}
        </div>
        <div className="screen-foot">
          <button className="btn" onClick={session.reload}>נסו שוב</button>
          {!offline && (
            <button
              className="btn btn-quiet"
              onClick={async () => {
                // Last resort: drop every local trace and start clean. Nothing
                // here is the source of truth, so there is nothing to lose.
                try {
                  localStorage.clear()
                  const regs = await navigator.serviceWorker?.getRegistrations?.()
                  await Promise.all((regs ?? []).map((r) => r.unregister()))
                  const keys = await caches?.keys?.()
                  await Promise.all((keys ?? []).map((k) => caches.delete(k)))
                  indexedDB.deleteDatabase('hashlamot')
                } catch {
                  // nothing to clear
                }
                location.reload()
              }}
            >
              ניקוי והתחלה מחדש
            </button>
          )}
        </div>
      </div>
    )
  }

  if (session?.status === 'unpaired') {
    return <Pairing onDone={session.reload} />
  }

  const go = (name, extra = {}) => setView({ name, ...extra })

  if (view.name === 'settings') {
    return <Settings onBack={() => go('home')} />
  }

  // ------------------------------------------------------------------ shopper
  if (role === 'shopper') {
    const active = list && ['sent', 'shopping'].includes(list.status) ? list : null

    if (view.name === 'done' || (list?.status === 'done' && view.name === 'home')) {
      return (
        <div className="screen">
          <div className="topbar">
            <h1>סיימת</h1>
            <button className="icon-btn" onClick={() => go('settings')} aria-label="הגדרות">⚙</button>
          </div>
          <div className="screen-body">
            <Empty icon="✅" title="הקנייה הושלמה">אמא רואה את הסיכום.</Empty>
            {isAdmin && <AdminSwitch role={role} setAsRole={setAsRole} />}
          </div>
        </div>
      )
    }

    if (!active) {
      return (
        <div className="screen">
          <div className="topbar">
            <h1>השלמות</h1>
            <button className="icon-btn" onClick={() => go('settings')} aria-label="הגדרות">⚙</button>
          </div>
          <div className="screen-body">
            <Empty icon="🛒" title="אין רשימה חדשה">
              כשאמא תשלח רשימה, היא תופיע כאן.
            </Empty>
            {isAdmin && <AdminSwitch role={role} setAsRole={setAsRole} />}
          </div>
        </div>
      )
    }

    return (
      <ShopperList
        list={active}
        onDone={() => go('done')}
        onSettings={() => go('settings')}
      />
    )
  }

  // ------------------------------------------------------------------ planner
  if (view.name === 'recipe') {
    return (
      <RecipeEditor
        recipe={view.recipe}
        onBack={() => go('home')}
        onSaved={() => go('home')}
      />
    )
  }

  if (view.name === 'review') {
    return (
      <ListReview
        listId={view.listId}
        onBack={() => go('home')}
        onSent={() => go('tracking', { listId: view.listId })}
      />
    )
  }

  if (view.name === 'tracking' && list) {
    return <LiveTracking list={list} onBack={() => go('home')} />
  }

  const watching = list && ['sent', 'shopping', 'done'].includes(list.status)

  return (
    <PlannerHome
      onEditRecipe={(recipe) => go('recipe', { recipe })}
      onOpenList={(listId) => go('review', { listId })}
      onQuickList={async () => {
        const title = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
        const { data } = await buildList([], title)
        go('review', { listId: data })
      }}
      onSettings={() => go('settings')}
      // Status belongs at the top where she sees it on arrival, not behind a
      // floating bar that covers the last row of her own recipes.
      banner={
        watching ? {
          label: list.status === 'done' ? 'לראות את הסיכום' : 'לראות איפה אבא',
          title: list.status === 'done' ? 'אבא סיים לקנות' : 'אבא בסופר עכשיו',
          onOpen: () => go('tracking'),
        } : null
      }
      footer={isAdmin ? <AdminSwitch role={role} setAsRole={setAsRole} /> : null}
    />
  )
}

function AdminSwitch({ role, setAsRole }) {
  return (
    <div className="pad" style={{ paddingBottom: 24, paddingTop: 8 }}>
      <div className="segmented">
        <button aria-pressed={role === 'planner'} onClick={() => setAsRole('planner')}>
          מסך של אמא
        </button>
        <button aria-pressed={role === 'shopper'} onClick={() => setAsRole('shopper')}>
          מסך של אבא
        </button>
      </div>
    </div>
  )
}
