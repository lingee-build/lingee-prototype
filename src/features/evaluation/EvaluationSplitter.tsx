import { useEffect, useRef, useState, type RefObject } from "react"

export function useEvaluationSplit() {
  const container = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(600)
  const [available, setAvailable] = useState(1200)
  const [dragging, setDragging] = useState(false)
  useEffect(() => {
    const node = container.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setAvailable(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const min = Math.min(320, available * .4)
  const max = Math.max(min, available - Math.min(400, available * .55) - 12)
  const actual = Math.max(min, Math.min(max, width))
  return { container, width: actual, dragging, splitter: { container, width: actual, min, max, setWidth, setDragging } }
}

export function EvaluationSplitter({ container, width, min, max, setWidth, setDragging }: {
  container: RefObject<HTMLDivElement | null>; width: number; min: number; max: number
  setWidth: (value: number) => void; setDragging: (value: boolean) => void
}) {
  const change = (value: number) => setWidth(Math.max(min, Math.min(max, value)))
  const drag = useRef(false)
  return <div className="eval-splitter" role="separator" aria-label="调整会话宽度" aria-orientation="vertical"
    aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(width)}
    tabIndex={0} title="拖动调整宽度，双击恢复默认；方向键微调"
    onDoubleClick={() => change(600)}
    onKeyDown={event => {
      const next = event.key === "ArrowLeft" ? width - 24 : event.key === "ArrowRight" ? width + 24 : event.key === "Home" ? min : event.key === "End" ? max : event.key === "Enter" ? 600 : undefined
      if (next !== undefined) { event.preventDefault(); change(next) }
    }}
    onPointerDown={event => { if (event.target !== event.currentTarget || event.button !== 0) return; event.preventDefault(); drag.current = true; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId) }}
    onPointerMove={event => { if (drag.current && container.current) change(event.clientX - container.current.getBoundingClientRect().left) }}
    onPointerUp={event => { drag.current = false; setDragging(false); if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
    onLostPointerCapture={() => { drag.current = false; setDragging(false) }}
    onPointerCancel={() => { drag.current = false; setDragging(false) }}>
  </div>
}
