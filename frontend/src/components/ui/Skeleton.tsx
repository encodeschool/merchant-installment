// Base shimmer block
function Shimmer({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-200 ${className ?? ''}`} />
}

// Stat card row: N cards side by side
function StatCardsSkeleton({ count }: { count: number }) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${count} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl bg-white border border-gray-100 shadow-sm p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Shimmer className="h-4 w-28" />
            <Shimmer className="h-8 w-8 rounded-lg" />
          </div>
          <Shimmer className="h-7 w-20" />
          <Shimmer className="h-3 w-32" />
        </div>
      ))}
    </div>
  )
}

// Generic table skeleton
function TableSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3">
                  <Shimmer className="h-3 w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {Array.from({ length: rows }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: cols }).map((_, j) => (
                  <td key={j} className="px-4 py-4">
                    <Shimmer className="h-4 w-full max-w-[120px]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Page-level skeletons ──────────────────────────────────────────────────────

export function MerchantDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      {/* CTA banner */}
      <Shimmer className="h-20 w-full rounded-xl" />
      {/* Two panel cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[0, 1].map(i => (
          <div key={i} className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-20" />
            </div>
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between px-5 py-3">
                  <div className="space-y-1.5">
                    <Shimmer className="h-4 w-32" />
                    <Shimmer className="h-3 w-48" />
                  </div>
                  <Shimmer className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MerchantProductsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-40" />
        <Shimmer className="h-9 w-32 rounded-lg" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
            <Shimmer className="h-36 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <Shimmer className="h-4 w-28" />
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
              <Shimmer className="h-3 w-full" />
              <Shimmer className="h-3 w-3/4" />
              <Shimmer className="h-5 w-24" />
              <div className="flex gap-2 pt-1">
                <Shimmer className="h-8 flex-1 rounded-lg" />
                <Shimmer className="h-8 w-8 rounded-lg" />
                <Shimmer className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MerchantInstallmentsSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={3} />
      <TableSkeleton cols={8} rows={6} />
    </div>
  )
}

export function MFODashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={5} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart panel */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-40" />
              <Shimmer className="h-3 w-32" />
            </div>
            <Shimmer className="h-5 w-5 rounded" />
          </div>
          <Shimmer className="h-[250px] w-full rounded-lg" />
        </div>
        {/* Quick actions */}
        <div className="space-y-3">
          <Shimmer className="h-4 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Shimmer key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
      <TableSkeleton cols={7} rows={5} />
    </div>
  )
}

export function MFOTariffsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-9 w-36 rounded-lg" />
      </div>
      <TableSkeleton cols={9} rows={6} />
    </div>
  )
}

export function MFOMerchantsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Shimmer className="h-9 w-72 rounded-lg" />
        <Shimmer className="h-9 w-40 rounded-lg" />
      </div>
      {/* Tab bar */}
      <Shimmer className="h-9 w-80 rounded-xl" />
      <TableSkeleton cols={6} rows={6} />
    </div>
  )
}

export function MFOApplicationsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Tab bar */}
      <Shimmer className="h-9 w-[480px] rounded-xl" />
      <TableSkeleton cols={11} rows={8} />
    </div>
  )
}

export function CBDashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Area chart */}
        <div className="lg:col-span-2 rounded-xl bg-white border border-gray-100 p-5 shadow-sm space-y-4">
          <div className="space-y-1.5">
            <Shimmer className="h-4 w-44" />
            <Shimmer className="h-3 w-36" />
          </div>
          <Shimmer className="h-[200px] w-full rounded-lg" />
        </div>
        {/* MFO list */}
        <div className="rounded-xl bg-white border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <Shimmer className="h-4 w-28" />
          </div>
          <div className="divide-y divide-gray-50">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <div className="space-y-1.5">
                  <Shimmer className="h-4 w-28" />
                  <Shimmer className="h-3 w-20" />
                </div>
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <TableSkeleton cols={5} rows={5} />
    </div>
  )
}

export function CBTariffApprovalsSkeleton() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Shimmer className="h-9 w-72 rounded-lg" />
        <Shimmer className="h-9 w-64 rounded-xl" />
      </div>
      <TableSkeleton cols={8} rows={7} />
    </div>
  )
}

export function CBMFOMonitoringSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardsSkeleton count={4} />
      <TableSkeleton cols={7} rows={6} />
    </div>
  )
}

export function CBAuditLogsSkeleton() {
  return (
    <div className="space-y-5">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Shimmer className="h-9 w-40 rounded-lg" />
        <Shimmer className="h-9 w-40 rounded-lg" />
      </div>
      <TableSkeleton cols={6} rows={10} />
    </div>
  )
}
