import { useState, useEffect } from 'react'
import { PlusIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Tariff } from '../../types'
import { apiTariffs } from '../../api'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

interface TariffForm {
  name: string
  interestRate: string
  minAmount: string
  maxAmount: string
  minMonths: string
  maxMonths: string
  minScore: string
}

const emptyForm: TariffForm = {
  name: '', interestRate: '', minAmount: '', maxAmount: '', minMonths: '', maxMonths: '', minScore: '60',
}

export default function MFOTariffs() {
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Tariff | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Tariff | null>(null)
  const [form, setForm] = useState<TariffForm>(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    apiTariffs.list()
      .then(setTariffs)
      .catch(() => {})
  }, [])

  const openCreate = () => { setForm(emptyForm); setCreateOpen(true) }

  const openEdit = (t: Tariff) => {
    setForm({
      name: t.name,
      interestRate: String(t.interestRate),
      minAmount: String(t.minAmount),
      maxAmount: String(t.maxAmount),
      minMonths: String(t.minMonths),
      maxMonths: String(t.maxMonths),
      minScore: String(t.minScore),
    })
    setEditTarget(t)
  }

  const handleCreate = () => {
    setSaving(true)
    apiTariffs.create({
      name: form.name,
      interest_rate: parseFloat(form.interestRate),
      min_amount: parseInt(form.minAmount),
      max_amount: parseInt(form.maxAmount),
      min_months: parseInt(form.minMonths),
      max_months: parseInt(form.maxMonths),
      min_score: parseInt(form.minScore),
    })
      .then(created => { setTariffs(prev => [created, ...prev]); setCreateOpen(false) })
      .catch(() => {
        const newTariff: Tariff = {
          id: `t${Date.now()}`,
          name: form.name,
          mfoName: 'Ipoteka Bank MFO',
          interestRate: parseFloat(form.interestRate),
          minAmount: parseInt(form.minAmount),
          maxAmount: parseInt(form.maxAmount),
          minMonths: parseInt(form.minMonths),
          maxMonths: parseInt(form.maxMonths),
          minScore: parseInt(form.minScore),
          status: 'PENDING',
          createdAt: new Date().toISOString().split('T')[0],
        }
        setTariffs(prev => [newTariff, ...prev])
        setCreateOpen(false)
      })
      .finally(() => setSaving(false))
  }

  const handleEdit = () => {
    if (!editTarget) return
    setSaving(true)
    apiTariffs.update(editTarget.id, {
      name: form.name,
      interest_rate: parseFloat(form.interestRate),
      min_amount: parseInt(form.minAmount),
      max_amount: parseInt(form.maxAmount),
      min_months: parseInt(form.minMonths),
      max_months: parseInt(form.maxMonths),
      min_score: parseInt(form.minScore),
    })
      .then(updated => { setTariffs(prev => prev.map(t => t.id === editTarget.id ? updated : t)); setEditTarget(null) })
      .catch(() => {
        setTariffs(prev => prev.map(t => t.id === editTarget.id ? {
          ...t,
          name: form.name,
          interestRate: parseFloat(form.interestRate),
          minAmount: parseInt(form.minAmount),
          maxAmount: parseInt(form.maxAmount),
          minMonths: parseInt(form.minMonths),
          maxMonths: parseInt(form.maxMonths),
          minScore: parseInt(form.minScore),
        } : t))
        setEditTarget(null)
      })
      .finally(() => setSaving(false))
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    apiTariffs.remove(deleteTarget.id)
      .then(() => setTariffs(prev => prev.filter(t => t.id !== deleteTarget.id)))
      .catch(() => setTariffs(prev => prev.filter(t => t.id !== deleteTarget.id)))
      .finally(() => setDeleteTarget(null))
  }

  const TariffFormFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tariff Name</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Standard 12"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Annual Interest Rate (%)</label>
        <input
          type="number"
          value={form.interestRate}
          onChange={e => setForm(f => ({ ...f, interestRate: e.target.value }))}
          placeholder="e.g. 18"
          min="1" max="100"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Amount (UZS)</label>
          <input
            type="number"
            value={form.minAmount}
            onChange={e => setForm(f => ({ ...f, minAmount: e.target.value }))}
            placeholder="1000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Amount (UZS)</label>
          <input
            type="number"
            value={form.maxAmount}
            onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))}
            placeholder="10000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Min Months</label>
          <select
            value={form.minMonths}
            onChange={e => setForm(f => ({ ...f, minMonths: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            <option value="">Select</option>
            {[3, 6, 9, 12].map(m => <option key={m} value={m}>{m} months</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Max Months</label>
          <select
            value={form.maxMonths}
            onChange={e => setForm(f => ({ ...f, maxMonths: e.target.value }))}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
          >
            <option value="">Select</option>
            {[3, 6, 9, 12].map(m => <option key={m} value={m}>{m} months</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Minimum Credit Score <span className="text-gray-400 font-normal">(0–100)</span>
        </label>
        <input
          type="number"
          value={form.minScore}
          onChange={e => setForm(f => ({ ...f, minScore: e.target.value }))}
          placeholder="60"
          min="0" max="100"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <p className="mt-1 text-xs text-gray-400">Clients scoring ≥ this get full approval; 50–(minScore-1) get partial; below 50 are rejected.</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{tariffs.length} tariff plans</p>
        </div>
        <Button
          variant="primary"
          color="emerald"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={openCreate}
        >
          Create Tariff
        </Button>
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Name', 'Rate %', 'Min Amount', 'Max Amount', 'Months', 'Min Score', 'Status', 'Created', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tariffs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                    No tariffs yet. Create your first tariff plan.
                  </td>
                </tr>
              ) : tariffs.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{t.name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700">{t.interestRate}%</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatUZS(t.minAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatUZS(t.maxAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{t.minMonths}–{t.maxMonths} mo</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{t.minScore}</td>
                  <td className="px-4 py-3">{statusBadge(t.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{t.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(t)}
                        disabled={t.status === 'APPROVED'}
                        className="flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      {t.status !== 'APPROVED' && (
                        <button
                          onClick={() => setDeleteTarget(t)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Tariff Plan" size="md">
        <div className="space-y-5">
          <TariffFormFields />
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              color="emerald"
              className="flex-1"
              onClick={handleCreate}
              disabled={!form.name || !form.interestRate || saving}
            >
              {saving ? 'Creating…' : 'Create Tariff'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title="Edit Tariff" size="md">
        <div className="space-y-5">
          <TariffFormFields />
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" color="emerald" className="flex-1" onClick={handleEdit} disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Tariff" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This action cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" color="red" className="flex-1" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
