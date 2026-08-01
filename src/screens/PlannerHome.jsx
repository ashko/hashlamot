import { useEffect, useState } from 'react'
import { getRecipes, buildList } from '../lib/data.js'
import { Spinner, Empty } from '../components/ui.jsx'

// One big question, and her own dishes underneath it. Week one this grid is
// empty and every dish is new; by week five she taps four times and is done.

export default function PlannerHome({
  onEditRecipe, onOpenList, onQuickList, onSettings, banner, footer,
}) {
  const [recipes, setRecipes] = useState(null)
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getRecipes().then((r) => setRecipes(r ?? []))
  }, [])

  const toggle = (id) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function makeList() {
    setBusy(true)
    const title = new Date().toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })
    const { data, error } = await buildList(selected, title)
    setBusy(false)
    if (error) {
      alert('לא הצלחתי ליצור את הרשימה. נסי שוב.')
      return
    }
    onOpenList(data)
  }

  if (!recipes) return <Spinner />

  return (
    <div className="screen">
      <div className="topbar">
        <h1>מה מבשלים?</h1>
        <button className="icon-btn" onClick={onSettings} aria-label="הגדרות">⚙</button>
      </div>

      <div className="screen-body">
        {banner && (
          <div className="pad" style={{ paddingBottom: 12 }}>
            <button
              className="card card-accent"
              onClick={banner.onOpen}
              style={{
                width: '100%', textAlign: 'start', cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 'var(--fs-body)',
              }}
            >
              <h2 style={{ marginBottom: 4 }}>{banner.title}</h2>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>
                {banner.label} ←
              </span>
            </button>
          </div>
        )}

        <p className="pad subtle" style={{ marginTop: 0 }}>
          {selected.length ? `נבחרו ${selected.length} מנות` : 'הקישי על המנות של השבוע'}
        </p>

        {recipes.length === 0 && (
          <Empty icon="🍲" title="עדיין אין מנות">
            כל מנה שתזיני נשמרת, ובשבוע הבא היא כבר תחכה לך מוכנה.
          </Empty>
        )}

        <div className="recipe-grid">
          {recipes.map((r) => {
            const on = selected.includes(r.id)
            return (
              <button
                key={r.id}
                type="button"
                className={`recipe-card${on ? ' selected' : ''}`}
                onClick={() => toggle(r.id)}
                onContextMenu={(e) => { e.preventDefault(); onEditRecipe(r) }}
                aria-pressed={on}
              >
                <span className="emoji" aria-hidden="true">{r.icon}</span>
                <span className="name">{r.name}</span>
                <span className="mark">
                  {on ? '✓ נבחר' : `${r.recipe_ingredients?.length ?? 0} מרכיבים`}
                </span>
              </button>
            )
          })}

          <button type="button" className="recipe-card new" onClick={() => onEditRecipe(null)}>
            + מנה חדשה
          </button>
        </div>

        <div className="pad" style={{ marginTop: 20 }}>
          <button className="btn btn-ghost" onClick={onQuickList}>
            רשימה מהירה — בלי מנות
          </button>
          <p className="quickadd-hint" style={{ textAlign: 'center' }}>
            לחלב, נייר טואלט, וכל מה שלא שייך למתכון
          </p>
        </div>

        {footer}
      </div>

      {selected.length > 0 && (
        <div className="screen-foot">
          <button className="btn" disabled={busy} onClick={makeList}>
            {busy ? 'רגע…' : `הכנת רשימה (${selected.length})`}
          </button>
        </div>
      )}
    </div>
  )
}
