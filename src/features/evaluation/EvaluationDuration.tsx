import { useEffect, useState } from "react"
import { durationText, type EvaluationDuration as Duration } from "@/services/evaluation-duration"

export function EvaluationDuration({ value, label, note }: { value: Duration; label?: string; note?: string }) {
  return <span className="eval-duration" title={note}>
    {label && <span className="eval-duration-label">{label}</span>}
    <span className="eval-duration-value" data-running={value.running || undefined}>{durationText(value)}</span>
  </span>
}

/** 一个可见视图共用时钟；终态记录和报告不随时钟重绘。 */
export function useEvaluationClock(active: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return active ? Date.now() : now
}
