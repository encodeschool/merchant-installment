import { useState } from 'react'
import { FunnelIcon } from '@heroicons/react/24/outline'
import Badge from '../../components/ui/Badge'
import { mockAuditLogs } from '../../data/mockData'
import { AuditLog, Role } from '../../types'
import clsx from 'clsx'

function actionBadge(action: string) {
  const map: Record<string, { color: string; label: string }> = {
    APPROVE: { color: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'APPROVE' },
    REJECT: { color: 'bg-red-50 text-red-700 ring-red-200', label: 'REJECT' },
    CREATE: { color: 'bg-blue-50 text-blue-700 ring-blue-200', label: 'CREATE' },
    SUBMIT: { color: 'bg-orange-50 text-orange-700 ring-orange-200', label: 'SUBMIT' },
    DELETE: { color: 'bg-red-50 text-red-700 ring-red-200', label: 'DELETE' },
    UPDATE: { color: 'bg-yellow-50 text-yellow-700 ring-yellow-200', label: 'UPDATE' },
  }
  const entry = map[action] ?? { color: 'bg-gray-100 text-gray-600 ring-gray-200', label: action }
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', entry.color)}>
      {entry.label}
    </span>
  )
}

function roleBadge(role: Role) {
  const map: Record<Role, string> = {
    CENTRAL_BANK: 'bg-purple-50 text-purple-700 ring-purple-200',
    MFO_ADMIN: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    MERCHANT: 'bg-blue-50 text-blue-700 ring-blue-200',
  }
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset', map[role])}>
      {role.replace('_', ' ')}
    </span>
  )
}

const PAGE_SIZE = 5

export default function CBAuditLogs() {
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [actionFilter, setActionFilter] = useState<string>('ALL')
  const [page, setPage] = useState(1)

  const filtered = mockAuditLogs.filter(log => {
    return (roleFilter === 'ALL' || log.role === roleFilter) &&
      (actionFilter === 'ALL' || log.action === actionFilter)
  })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  const uniqueActions = Array.from(new Set(mockAuditLogs.map(l => l.action)))

  const formatTimestamp = (ts: string) => {
    const d = new Date(ts)
    return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>

        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
        >
          <option value="ALL">All Roles</option>
          <option value="CENTRAL_BANK">Central Bank</option>
          <option value="MFO_ADMIN">MFO Admin</option>
          <option value="MERCHANT">Merchant</option>
        </select>

        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-purple-400 focus:outline-none"
        >
          <option value="ALL">All Actions</option>
          {uniqueActions.map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <span className="ml-auto text-xs text-gray-400">{filtered.length} records</span>
      </div>

      {/* Table */}
      <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Timestamp', 'User', 'Role', 'Action', 'Resource', 'Resource ID', 'IP Address'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">
                    No audit logs match your filters.
                  </td>
                </tr>
              ) : paginated.map((log: AuditLog) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatTimestamp(log.timestamp)}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 whitespace-nowrap">{log.userName}</td>
                  <td className="px-4 py-3">{roleBadge(log.role)}</td>
                  <td className="px-4 py-3">{actionBadge(log.action)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 capitalize">{log.resource}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-mono text-gray-600">{log.resourceId}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={clsx(
                    'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                    p === page ? 'bg-purple-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
