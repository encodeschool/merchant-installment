import { useRef, useEffect, useImperativeHandle, forwardRef, useState } from 'react'

export interface SignaturePadHandle {
  clear: () => void
  toDataURL: () => string | null   // null if empty
  isEmpty: () => boolean
}

interface Props {
  onChange?: (hasSignature: boolean) => void
}

const MIN_PAINTED_PIXELS = 100

const SignaturePad = forwardRef<SignaturePadHandle, Props>(({ onChange }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number; time: number } | null>(null)
  const [hasSignature, setHasSignature] = useState(false)

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    
    ctx.strokeStyle = '#e8edf5'
    ctx.lineWidth = 0.5
    for (let y = 40; y < canvas.height; y += 40) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(canvas.width, y)
      ctx.stroke()
    }
    
    const baseY = Math.round(canvas.height * 0.72)
    ctx.strokeStyle = '#c7d2e0'
    ctx.lineWidth = 1
    ctx.setLineDash([8, 6])
    ctx.beginPath()
    ctx.moveTo(40, baseY)
    ctx.lineTo(canvas.width - 40, baseY)
    ctx.stroke()
    ctx.setLineDash([])
    
    ctx.save()
    ctx.fillStyle = '#c8d0dc'
    ctx.font = '16px system-ui, sans-serif'
    ctx.fillText('Sign here ↓', 48, 28)
    ctx.restore()
    
    ctx.strokeStyle = '#1a1a2e'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  useEffect(() => {
    initCanvas()
  }, [])

  const countNonWhite = (): number => {
    const canvas = canvasRef.current
    if (!canvas) return 0
    const ctx = canvas.getContext('2d')!
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    let count = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 250 || data[i + 1] < 250 || data[i + 2] < 250) count++
    }
    return count
  }

  const updateEmpty = () => {
    const filled = countNonWhite() >= MIN_PAINTED_PIXELS
    setHasSignature(filled)
    onChange?.(filled)
  }

  const getPos = (e: MouseEvent | Touch, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (('clientX' in e ? e.clientX : (e as Touch).clientX) - rect.left) * scaleX,
      y: (('clientY' in e ? e.clientY : (e as Touch).clientY) - rect.top) * scaleY,
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = getCtx()!

    const onDown = (e: MouseEvent) => {
      drawing.current = true
      const { x, y } = getPos(e, canvas)
      lastPoint.current = { x, y, time: Date.now() }
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const onMove = (e: MouseEvent) => {
      if (!drawing.current || !lastPoint.current) return
      const { x, y } = getPos(e, canvas)
      const dx = x - lastPoint.current.x
      const dy = y - lastPoint.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const dt = Date.now() - lastPoint.current.time
      const speed = dist / (dt || 1)
      const width = Math.max(1.5, Math.min(3.5, 3.5 - speed * 0.05))
      ctx.lineWidth = width
      ctx.lineTo(x, y)
      ctx.stroke()
      lastPoint.current = { x, y, time: Date.now() }
    }
    const onUp = () => {
      drawing.current = false
      lastPoint.current = null
      updateEmpty()
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      const { x, y } = getPos(e.touches[0], canvas)
      lastPoint.current = { x, y, time: Date.now() }
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!drawing.current || !lastPoint.current) return
      const { x, y } = getPos(e.touches[0], canvas)
      const dx = x - lastPoint.current.x
      const dy = y - lastPoint.current.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const dt = Date.now() - lastPoint.current.time
      const speed = dist / (dt || 1)
      const width = Math.max(1.5, Math.min(3.5, 3.5 - speed * 0.05))
      ctx.lineWidth = width
      ctx.lineTo(x, y)
      ctx.stroke()
      lastPoint.current = { x, y, time: Date.now() }
    }
    const onTouchEnd = () => {
      drawing.current = false
      lastPoint.current = null
      updateEmpty()
    }

    canvas.addEventListener('mousedown', onDown)
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseup', onUp)
    canvas.addEventListener('mouseleave', onUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)

    return () => {
      canvas.removeEventListener('mousedown', onDown)
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseup', onUp)
      canvas.removeEventListener('mouseleave', onUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    clear: () => {
      initCanvas()
      setHasSignature(false)
      onChange?.(false)
    },
    toDataURL: () => {
      if (!hasSignature) return null
      return canvasRef.current?.toDataURL('image/png') ?? null
    },
    isEmpty: () => !hasSignature,
  }))

  return (
    <div className="space-y-1">
      <div 
        className="relative rounded-xl border-2 border-gray-200 overflow-hidden bg-white shadow-inner"
        style={{
          cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cpath d='M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z' fill='%231a1a2e'/%3E%3C/svg%3E") 4 20, crosshair`
        }}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={400}
          className="w-full"
          style={{ height: '200px', touchAction: 'none' }}
        />
      </div>
    </div>
  )
})

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
