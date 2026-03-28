import { useState, useEffect } from 'react'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import Badge from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Product } from '../../types'
import { apiProducts, apiMerchants } from '../../api'
import { useAuthStore } from '../../store/authStore'
import clsx from 'clsx'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

const categoryColors: Record<string, string> = {
  Smartphones: 'bg-blue-100 text-blue-700',
  Laptops: 'bg-purple-100 text-purple-700',
  TVs: 'bg-emerald-100 text-emerald-700',
  Appliances: 'bg-orange-100 text-orange-700',
  Other: 'bg-gray-100 text-gray-700',
}

const categories = ['Smartphones', 'Laptops', 'TVs', 'Appliances', 'Audio', 'Accessories', 'Other']

interface ProductForm {
  name: string
  category: string
  price: string
  description: string
  available: boolean
  downPaymentPercent: string
}

const emptyForm: ProductForm = { name: '', category: '', price: '', description: '', available: true, downPaymentPercent: '10' }

export default function MerchantProducts() {
  const { user } = useAuthStore()
  const [merchantId, setMerchantId] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Product | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [form, setForm] = useState<ProductForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiMerchants.my()
      .then(m => setMerchantId(m.id))
      .catch(() => {})

    apiProducts.list()
      .then(setProducts)
      .catch(() => {})
  }, [user])

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true) }

  const openEdit = (p: Product) => {
    setForm({
      name: p.name,
      category: p.category,
      price: String(p.price),
      description: p.description,
      available: p.available,
      downPaymentPercent: String(p.downPaymentPercent),
    })
    setEditTarget(p)
  }

  const handleCreate = () => {
    setSaving(true)
    apiProducts.create({
      merchant_id: merchantId,
      name: form.name,
      category: form.category,
      price: parseInt(form.price),
      description: form.description,
      available: form.available,
      down_payment_percent: parseInt(form.downPaymentPercent) || 0,
    })
      .then(created => { setProducts(prev => [created, ...prev]); setCreateOpen(false) })
      .catch(() => {
        const newProduct: Product = {
          id: `p${Date.now()}`,
          merchantId,
          name: form.name,
          category: form.category,
          price: parseInt(form.price),
          description: form.description,
          available: form.available,
          downPaymentPercent: parseInt(form.downPaymentPercent) || 0,
        }
        setProducts(prev => [newProduct, ...prev])
        setCreateOpen(false)
      })
      .finally(() => setSaving(false))
  }

  const handleEdit = () => {
    if (!editTarget) return
    setSaving(true)
    apiProducts.update(editTarget.id, {
      name: form.name,
      category: form.category,
      price: parseInt(form.price),
      description: form.description,
      available: form.available,
      down_payment_percent: parseInt(form.downPaymentPercent) || 0,
    })
      .then(updated => { setProducts(prev => prev.map(p => p.id === editTarget.id ? updated : p)); setEditTarget(null) })
      .catch(() => {
        setProducts(prev => prev.map(p => p.id === editTarget.id ? {
          ...p,
          name: form.name,
          category: form.category,
          price: parseInt(form.price),
          description: form.description,
          available: form.available,
          downPaymentPercent: parseInt(form.downPaymentPercent) || 0,
        } : p))
        setEditTarget(null)
      })
      .finally(() => setSaving(false))
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    apiProducts.remove(deleteTarget.id)
      .then(() => setProducts(prev => prev.filter(p => p.id !== deleteTarget.id)))
      .catch(() => setProducts(prev => prev.filter(p => p.id !== deleteTarget.id)))
      .finally(() => setDeleteTarget(null))
  }

  const toggleAvailability = (id: string) => {
    apiProducts.toggleAvailability(id)
      .then(updated => setProducts(prev => prev.map(p => p.id === id ? updated : p)))
      .catch(() => setProducts(prev => prev.map(p => p.id === id ? { ...p, available: !p.available } : p)))
  }

  const productFormFields = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Samsung Galaxy S24"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none"
        >
          <option value="">Select category</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Price (UZS)</label>
        <input
          type="number"
          value={form.price}
          onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          placeholder="e.g. 8500000"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Brief product description"
          rows={2}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100 resize-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Down Payment <span className="text-gray-400 font-normal">(% of price, 0–50%)</span>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0" max="50" step="5"
            value={form.downPaymentPercent}
            onChange={e => setForm(f => ({ ...f, downPaymentPercent: e.target.value }))}
            className="flex-1 accent-blue-600"
          />
          <span className="text-sm font-bold text-blue-700 w-10 text-right">{form.downPaymentPercent}%</span>
        </div>
        {form.price && (
          <p className="mt-1 text-xs text-gray-400">
            Upfront: {formatUZS(Math.round(parseInt(form.price || '0') * (parseInt(form.downPaymentPercent) / 100)))} · Financed: {formatUZS(Math.round(parseInt(form.price || '0') * (1 - parseInt(form.downPaymentPercent) / 100)))}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Available for installment</label>
        <button
          type="button"
          onClick={() => setForm(f => ({ ...f, available: !f.available }))}
          className={clsx(
            'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
            form.available ? 'bg-blue-600' : 'bg-gray-300'
          )}
        >
          <span
            className={clsx(
              'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform',
              form.available ? 'translate-x-4.5' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{products.length} products · {products.filter(p => p.available).length} available</p>
        <Button
          variant="primary"
          color="blue"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={openCreate}
        >
          Add Product
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-xl bg-white border border-dashed border-gray-300 p-16 text-center">
          <ShoppingBagPlaceholder />
          <p className="text-sm text-gray-400 mt-3">No products yet. Add your first product.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map(product => (
            <div key={product.id} className="rounded-xl bg-white border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="h-36 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                <div className="text-center">
                  <div className={clsx('inline-flex rounded-xl px-3 py-1.5 text-xs font-semibold mb-1', categoryColors[product.category] ?? categoryColors['Other'])}>
                    {product.category}
                  </div>
                  <p className="text-2xl font-black text-gray-300">{product.name.charAt(0)}</p>
                </div>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 leading-tight">{product.name}</h3>
                  <Badge variant={product.available ? 'success' : 'neutral'} className="ml-2 shrink-0">
                    {product.available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                <p className="text-base font-bold text-blue-700">{formatUZS(product.price)}</p>
                {product.downPaymentPercent > 0 && (
                  <p className="text-xs text-gray-400 mb-3">Down payment: {product.downPaymentPercent}% ({formatUZS(Math.round(product.price * product.downPaymentPercent / 100))})</p>
                )}
                {product.downPaymentPercent === 0 && <p className="text-xs text-gray-400 mb-3">No down payment</p>}

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAvailability(product.id)}
                    className={clsx(
                      'flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors',
                      product.available
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                    )}
                  >
                    {product.available ? 'Mark Unavailable' : 'Mark Available'}
                  </button>
                  <button
                    onClick={() => openEdit(product)}
                    className="rounded-lg p-1.5 bg-gray-50 text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(product)}
                    className="rounded-lg p-1.5 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Add New Product" size="md">
        <div className="space-y-5">
          {productFormFields}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button variant="primary" color="blue" className="flex-1" onClick={handleCreate} disabled={!form.name || !form.price || saving}>
              {saving ? 'Saving…' : 'Add Product'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Product" size="md">
        <div className="space-y-5">
          {productFormFields}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button variant="primary" color="blue" className="flex-1" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Product" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Delete <strong>{deleteTarget?.name}</strong>? This cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="primary" color="red" className="flex-1" onClick={handleDelete}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function ShoppingBagPlaceholder() {
  return (
    <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  )
}
