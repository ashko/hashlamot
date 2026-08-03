import { useEffect, useState, useCallback } from 'react'
import QuickAdd from '../components/QuickAdd.jsx'
import NewProduct from '../components/NewProduct.jsx'
import QuantityEditor from '../components/QuantityEditor.jsx'
import { Spinner, Toast } from '../components/ui.jsx'
import {
  getListItems, getProducts, getDepartments, createProduct,
  addListItem, removeListItem, setListStatus, setListItemQuantity,
} from '../lib/data.js'
import { formatQuantities, formatSources } from '../lib/quantities.js'
import { groupByDepartment, departmentStyle } from '../lib/grouping.js'
import { listAsText, shareToWhatsApp } from '../lib/share.js'
import { useSession } from '../lib/session.jsx'

// The merged result, in aisle order, before it goes to Dad. She can still add
// the things no recipe knows about — milk, toilet paper — from the same field
// she used for ingredients.

export default function ListReview({ listId, onBack, onSent }) {
  const { household } = useSession()
  const [items, setItems] = useState(null)
  const [products, setProducts] = useState([])
  const [departments, setDepartments] = useState([])
  const [creating, setCreating] = useState(null)
  const [editingQty, setEditingQty] = useState(null)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState(null)

  const refresh = useCallback(async () => {
    const list = await getListItems(listId)
    setItems(list ?? [])
  }, [listId])

  useEffect(() => {
    Promise.all([refresh(), getProducts(), getDepartments()]).then(([, p, d]) => {
      setProducts(p ?? [])
      setDepartments(d ?? [])
    })
  }, [refresh])

  async function add(product, qty, unit) {
    await addListItem(listId, product.id, qty, unit)
    await refresh()
    setToast({ message: `${product.name} נוסף` })
  }

  async function handleCreate(newProduct) {
    const created = await createProduct(newProduct, household.id)
    setProducts((p) => [created, ...p])
    setCreating(null)
    await add(created, created.default_qty, created.default_unit)
  }

  async function remove(item) {
    await removeListItem(item.id)
    setItems((s) => s.filter((x) => x.id !== item.id))
    setToast({ message: `${item.name_snapshot} הוסר` })
  }

  async function send() {
    setBusy(true)
    await setListStatus(listId, 'sent')
    onSent()
  }

  if (editingQty) {
    const first = editingQty.quantities?.[0] ?? { value: 1, unit: 'unit' }
    return (
      <QuantityEditor
        name={editingQty.name_snapshot}
        value={first.value}
        unit={first.unit}
        onCancel={() => setEditingQty(null)}
        onSave={async (value, unit) => {
          setItems((s) =>
            s.map((x) =>
              x.id === editingQty.id ? { ...x, quantities: [{ value, unit }] } : x,
            ),
          )
          setEditingQty(null)
          await setListItemQuantity(editingQty.id, value, unit)
        }}
      />
    )
  }

  if (creating) {
    return (
      <NewProduct name={creating} departments={departments}
                  onSave={handleCreate} onCancel={() => setCreating(null)} />
    )
  }
  if (!items) return <Spinner />

  const groups = groupByDepartment(items, departments, household?.department_order)

  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn" onClick={onBack} aria-label="חזרה">→</button>
        <h1>הרשימה</h1>
      </div>

      <div className="screen-body">
        <p className="pad subtle" style={{ marginTop: 0 }}>
          {items.length} מוצרים
        </p>

        <QuickAdd
          products={products}
          onAdd={add}
          onCreate={setCreating}
          placeholder="+ להוסיף עוד משהו"
          autoFocus={false}
          suggestWhenEmpty={false}
        />

        <div style={{ marginTop: 16 }}>
          {groups.map((g) => (
            <div key={g.key}>
              <div className="dept-band" style={departmentStyle(g.key)}>
                <span className="dept-icon" aria-hidden="true">{g.icon}</span>
                {g.name}
                <span className="count">{g.items.length}</span>
              </div>
              {g.items.map((item) => (
                <div className="row" key={item.id}>
                  <div className="thumb" aria-hidden="true">
                    {item.image_snapshot
                      ? <img src={item.image_snapshot} alt="" />
                      : item.icon_snapshot}
                  </div>
                  <div>
                    <div className="row-name">{item.name_snapshot}</div>
                    {formatSources(item.source_recipes) && (
                      <div className="row-sub">{formatSources(item.source_recipes)}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      className="qty-edit"
                      onClick={() => setEditingQty(item)}
                      aria-label={`לשנות את הכמות של ${item.name_snapshot}`}
                    >
                      {formatQuantities(item.quantities)}
                    </button>
                    <button
                      className="icon-btn"
                      style={{ minWidth: 56, minHeight: 56, fontSize: 20 }}
                      onClick={() => remove(item)}
                      aria-label={`להסיר ${item.name_snapshot}`}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="screen-foot">
        <button className="btn" disabled={busy || items.length === 0} onClick={send}>
          {busy ? 'שולח…' : 'לשלוח לאבא'}
        </button>
        {items.length > 0 && (
          <button
            className="btn btn-quiet"
            onClick={() =>
              shareToWhatsApp(
                listAsText(items, departments, household?.department_order, 'לשבת'),
              )
            }
          >
            שליחה גם בוואטסאפ
          </button>
        )}
      </div>

      <Toast {...(toast ?? {})} onDone={() => setToast(null)} ms={4000} />
    </div>
  )
}
