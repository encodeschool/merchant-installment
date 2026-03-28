interface LoaderProps {
  fullPage?: boolean
}

export default function Loader({ fullPage = false }: LoaderProps) {
  if (fullPage) {
    return (
      <div className="flex flex-1 items-center justify-center h-full min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-blue-600 border-t-transparent" />
      </div>
    )
  }
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
    </div>
  )
}
