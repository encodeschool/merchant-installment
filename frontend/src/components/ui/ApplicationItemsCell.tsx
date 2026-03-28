import { ApplicationItem } from '../../types'

interface Props {
  items: ApplicationItem[]
}

export default function ApplicationItemsCell({ items }: Props) {
  if (!items || items.length === 0) return <span className="text-gray-400">—</span>

  const first = items[0]
  const rest  = items.length - 1
  const tooltip = items.map(i => `${i.productName} ×${i.quantity}`).join('\n')

  return (
    <span className="inline-flex items-center gap-1 max-w-36" title={tooltip}>
      <span className="truncate text-sm text-gray-700">{first.productName}</span>
      {rest > 0 && (
        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500">
          +{rest}
        </span>
      )}
    </span>
  )
}
