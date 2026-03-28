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
  const [hasSignature, setHasSignature] = useState(false)

  const getCtx = () => canvasRef.current?.getContext('2d') ?? null

  const initCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#1e293b'
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
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const onMove = (e: MouseEvent) => {
      if (!drawing.current) return
      const { x, y } = getPos(e, canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    const onUp = () => {
      drawing.current = false
      updateEmpty()
    }

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault()
      drawing.current = true
      const { x, y } = getPos(e.touches[0], canvas)
      ctx.beginPath()
      ctx.moveTo(x, y)
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (!drawing.current) return
      const { x, y } = getPos(e.touches[0], canvas)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    const onTouchEnd = () => {
      drawing.current = false
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
      <div className="relative rounded-xl border-2 border-gray-200 overflow-hidden bg-white" style={{ cursor: 'crosshair' }}>
        <canvas
          ref={canvasRef}
          width={800}
          height={300}
          className="w-full"
          style={{ height: '150px', touchAction: 'none' }}
        />
        {!hasSignature && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-gray-300 text-sm select-none">Draw signature here</p>
          </div>
        )}
      </div>
    </div>
  )
})

SignaturePad.displayName = 'SignaturePad'
export default SignaturePad
