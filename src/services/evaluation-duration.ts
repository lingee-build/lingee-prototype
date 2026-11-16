import { isActiveRun, type EvalResult, type EvalRun } from "./evaluation"

export interface EvaluationDuration { text: string; running: boolean; milliseconds?: number }
export const runDurationNote = "从运行开始到全部执行与判定结束，包含等待时间。"
export const caseDurationNote = "从本用例开始执行到执行与判定结束，不含开始前的排队等待。"

export function formatDuration(milliseconds: number): string {
  if (milliseconds === 0) return "0 秒"
  if (milliseconds < 1000) return "不足 1 秒"
  if (milliseconds < 60000) return `${Math.floor(milliseconds / 100) / 10} 秒`
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainder = String(seconds % 60).padStart(2, "0")
  return minutes < 60 ? `${minutes} 分 ${remainder} 秒` : `${Math.floor(minutes / 60)} 小时 ${String(minutes % 60).padStart(2, "0")} 分 ${remainder} 秒`
}

function duration(started: number | undefined, ended: number | undefined, running: boolean, now: number): EvaluationDuration {
  const end = running ? now : ended
  if (started === undefined || end === undefined || !Number.isFinite(started) || !Number.isFinite(end) || started < 0 || end < started) return { text: "未记录", running: false }
  const milliseconds = end - started
  return { text: formatDuration(milliseconds), running, milliseconds }
}

export function runDuration(run: EvalRun, now = Date.now()): EvaluationDuration {
  return duration(run.started, run.ended, isActiveRun(run), now)
}

export function caseDuration(result: EvalResult, run: EvalRun, now = Date.now()): EvaluationDuration {
  if (result.status === "pending") return { text: "待执行", running: false }
  if (result.status === "skipped") return { text: "未执行", running: false }
  const running = isActiveRun(run) && (result.status === "running" || !!result.judging)
  return duration(result.timing?.started, result.timing?.ended, running, now)
}

export function durationText(value: EvaluationDuration): string {
  return `${value.text}${value.running ? "（计时中）" : ""}`
}
