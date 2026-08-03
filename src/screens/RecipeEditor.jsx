import { useEffect, useState } from 'react'
import QuickAdd from '../components/QuickAdd.jsx'
import NewProduct from '../components/NewProduct.jsx'
import QuantityEditor from '../components/QuantityEditor.jsx'
import { getProducts, getDepartments, createProduct, saveRecipe, deleteRecipe } from '../lib/data.js'
import { formatQuantity } from '../lib/quantities.js'
import { SEED_RECIPE_ICONS } from '../data/seed-products.js'
import { Spinner } from '../components/ui.jsx'
import { useSession } from '../lib/session.jsx'

// Entered once, reused forever. This is the whole bargain of the app: the
// minute she spends here this week is a minute she never spends on this dish
// again.

export default function RecipeEditor({ recipe, onBack, onSaved }) {
  const { household } = useSession()
  const [products, setProducts] = useState(null)
  const [departments, setDepartments] = useState([])
  const [name, setName] = useState(recipe?.name ?? '')
  const [icon, setIcon] = useState(recipe?.icon ?? '🍽️')
  const [items, setItems] = useState([])
  const [creating, setCreating] = useState(null)
  const [editingQty, setEditingQty] = useState(null)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    Promise.all([getProducts(), getDepartments()]).then(([p, d]) => {
      setProducts(p ?? [])
      setDepartments(d ?? [])
      if (recipe?.recipe_ingredients?.length) {
        const byId = new Map((p ?? []).map((x) => [x.id, x]))
        setItems(
          [...recipe.recipe_ingredients]
            .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
            .map((ing) => ({
              product_id: ing.product_id,
              quantity: Number(ing.quantity),
              unit: ing.unit,
              name: byId.get(ing.product_id)?.name ?? 'מוצר',
              icon: byId.get(ing.product_id)?.icon ?? '📦',
            })),
        )
      }
    })
  }, [recipe])

  function add(product, qty, unit) {
    setItems((s) => {
      if (s.some((i) => i.product_id === product.id)) return s
      return [...s, { product_id: product.id, quantity: qty, unit, name: product.name, icon: product.icon }]
    })
  }

  async function handleCreate(newProduct) {
    const created = await createProduct(newProduct, household.id)
    setProducts((p) => [created, ...(p ?? [])])
    add(created, created.default_qty, created.default_unit)
    setCreating(null)
  }

  async function save() {
    if (!name.trim()) return
    setBusy(true)
    try {
      await saveRecipe({
        id: recipe?.id,
        name: name.trim(),
        icon,
        householdId: household.id,
        ingredients: items,
      })
      onSaved()
    } catch {
      alert('לא הצלחתי לשמור. נסי שוב.')
      setBusy(false)
    }
  }

  // A visible two-step instead of a native dialog: the spec rules out blocking
  // pop-ups, and a system alert in the wrong language is exactly the kind of
  // thing that makes someone put the phone down.
  async function remove() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setBusy(true)
    await deleteRecipe(recipe.id)
    onSaved()
  }

  if (editingQty) {
    return (
      <QuantityEditor
        name={editingQty.name}
        value={editingQty.quantity}
        unit={editingQty.unit}
        onCancel={() => setEditingQty(null)}
        onSave={(quantity, unit) => {
          setItems((s) =>
            s.map((x) =>
              x.product_id === editingQty.product_id ? { ...x, quantity, unit } : x,
            ),
          )
          setEditingQty(null)
        }}
      />
    )
  }

  if (creating) {
    return (
      <NewProduct
        name={creating}
        departments={departments}
        onSave={handleCreate}
        onCancel={() => setCreating(null)}
      />
    )
  }

  if (!products) return <Spinner />

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>
        <h1>{recipe ? 'עריכת מנה' : 'מנה חדשה'}</h1>
      </div>

      <div className="screen-body stack">
        <div className="pad stack">
          <div>
            <label className="label" htmlFor="rn">שם המנה</label>
            <input
              id="rn"
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="שניצל"
            />
          </div>

        </div>

        {/* Ingredients come immediately after the name. The picture-picker is
            decoration and used to push this — the one field that matters —
            below the fold, so it now sits at the bottom. */}
        <div className="pad">
          <span className="label">מה צריך בשבילה?</span>
        </div>
        <QuickAdd
          products={products}
          onAdd={add}
          onCreate={setCreating}
          placeholder="שתי אותיות מספיקות"
          autoFocus={false}
        />

        {items.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div className="dept-band" style={{ position: 'static' }}>
              המרכיבים <span className="count">{items.length}</span>
            </div>
            {items.map((i) => (
              <div className="row" key={i.product_id}>
                <div className="thumb" aria-hidden="true">{i.icon}</div>
                <div>
                  <div className="row-name">{i.name}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="qty-edit"
                    onClick={() => setEditingQty(i)}
                    aria-label={`לשנות את הכמות של ${i.name}`}
                  >
                    {formatQuantity({ value: i.quantity, unit: i.unit })}
                  </button>
                  <button
                    className="icon-btn"
                    style={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
                    onClick={() =>
                      setItems((s) => s.filter((x) => x.product_id !== i.product_id))
                    }
                    aria-label={`להסיר ${i.name}`}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pad" style={{ marginTop: 20 }}>
          <span className="label">סימן למנה</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {SEED_RECIPE_ICONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                aria-label={`סימן ${e}`}
                aria-pressed={icon === e}
                style={{
                  fontSize: 28,
                  width: 52,
                  height: 52,
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: icon === e ? 'var(--accent-soft)' : 'var(--surface)',
                  border: `3px solid ${icon === e ? 'var(--accent)' : 'var(--rule)'}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="screen-foot">
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>
          {busy ? 'רגע…' : recipe ? 'שמירת השינויים' : 'שמירת המנה'}
        </button>
        {recipe && (
          confirmDelete ? (
            <div className="btn-row">
              <button className="btn btn-danger" disabled={busy} onClick={remove}>
                כן, למחוק
              </button>
              <button className="btn btn-quiet" onClick={() => setConfirmDelete(false)}>
                ביטול
              </button>
            </div>
          ) : (
            <button className="btn btn-quiet" onClick={remove}>מחיקת המנה</button>
          )
        )}
      </div>
    </div>
  )
}
