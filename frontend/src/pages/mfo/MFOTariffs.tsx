import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlusIcon, PencilSquareIcon, TrashIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline'
import { statusBadge } from '../../components/ui/Badge'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Tariff } from '../../types'
import { apiTariffs } from '../../api'
import { useTranslation } from 'react-i18next'

function formatUZS(n: number): string {
  return n.toLocaleString() + ' UZS'
}

interface TariffForm {
  name: string
  interestRate: string
  minAmount: string
  maxAmount: string
  months: string
  minScore: string
}

const emptyForm: TariffForm = {
  name: '', interestRate: '', minAmount: '', maxAmount: '', months: '', minScore: '60',
}

export default function MFOTariffs() {
  const navigate = useNavigate()
  const { t } = useTranslation()
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
      months: String(t.months),
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
      months: parseInt(form.months),
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
          months: parseInt(form.months),
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
      months: parseInt(form.months),
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
          months: parseInt(form.months),
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

  const formFields = (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tariffs.name')}</label>
        <input
          type="text"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Standard 12"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tariffs.interestRate')}</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tariffs.minAmount')}</label>
          <input
            type="number"
            value={form.minAmount}
            onChange={e => setForm(f => ({ ...f, minAmount: e.target.value }))}
            placeholder="1000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('tariffs.maxAmount')}</label>
          <input
            type="number"
            value={form.maxAmount}
            onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))}
            placeholder="10000000"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{t('tariffs.months')}</label>
        <select
          value={form.months}
          onChange={e => setForm(f => ({ ...f, months: e.target.value }))}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none"
        >
          <option value="">{t('tariffs.select')}</option>
          {[3, 6, 9, 12].map(m => <option key={m} value={m}>{t('tariffs.monthOption', { n: m })}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {t('tariffs.minScore')} <span className="text-gray-400 font-normal">{t('tariffs.minScoreRange')}</span>
        </label>
        <input
          type="number"
          value={form.minScore}
          onChange={e => setForm(f => ({ ...f, minScore: e.target.value }))}
          placeholder="60"
          min="0" max="100"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
        />
        <p className="mt-1 text-xs text-gray-400">{t('tariffs.minScoreHint')}</p>
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{t('tariffs.count', { n: tariffs.length })}</p>
        </div>
        <Button
          variant="primary"
          color="emerald"
          icon={<PlusIcon className="h-4 w-4" />}
          onClick={openCreate}
        >
          {t('tariffs.createTariff')}
        </Button>
      </div>

      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {[t('tariffs.colName'), t('tariffs.colRate'), t('tariffs.colMinAmount'), t('tariffs.colMaxAmount'), t('tariffs.colMonths'), t('tariffs.colMinScore'), t('tariffs.colStatus'), t('tariffs.colCreated'), t('tariffs.colActions')].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {tariffs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm text-gray-400">
                    {t('tariffs.noTariffs')}
                  </td>
                </tr>
              ) : tariffs.map(tariff => (
                <tr key={tariff.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{tariff.name}</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700">{tariff.interestRate}%</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatUZS(tariff.minAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatUZS(tariff.maxAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{tariff.months} mo</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-700">{tariff.minScore}</td>
                  <td className="px-4 py-3">{statusBadge(tariff.status)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{tariff.createdAt}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => navigate(`/mfo/scoring/${tariff.id}`)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition-colors"
                      >
                        <AdjustmentsHorizontalIcon className="h-3.5 w-3.5" />
                        {t('tariffs.scoring')}
                      </button>
                      <button
                        onClick={() => openEdit(tariff)}
                        disabled={tariff.status === 'APPROVED'}
                        className="flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <PencilSquareIcon className="h-3.5 w-3.5" />
                        {t('common.edit')}
                      </button>
                      {tariff.status !== 'APPROVED' && (
                        <button
                          onClick={() => setDeleteTarget(tariff)}
                          className="flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 transition-colors"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          {t('common.delete')}
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

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('tariffs.createPlanTitle')} size="md">
        <div className="space-y-5">
          {formFields}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setCreateOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              color="emerald"
              className="flex-1"
              onClick={handleCreate}
              disabled={!form.name || !form.interestRate || saving}
            >
              {saving ? t('tariffs.creating') : t('tariffs.createTariff')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={t('tariffs.editTariff')} size="md">
        <div className="space-y-5">
          {formFields}
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setEditTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" color="emerald" className="flex-1" onClick={handleEdit} disabled={saving}>
              {saving ? t('common.saving') : t('common.saveChanges')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title={t('tariffs.deleteTariff')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            {t('tariffs.deleteConfirm', { name: deleteTarget?.name })}
          </p>
          <div className="flex gap-3">
            <Button variant="secondary" color="gray" className="flex-1" onClick={() => setDeleteTarget(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" color="red" className="flex-1" onClick={handleDelete}>
              {t('common.delete')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
