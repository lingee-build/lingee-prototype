import type { EvalRun } from "./evaluation"

/** 报告卡指标：分母口径与设计稿一致——已完成报告按已执行数，进行中报告按用例集全量。 */
export interface RunStats { total: number; executed: number; passed: number; failed: number; unknown: number }

export function runStats(run: EvalRun): RunStats {
  const passed = run.results.filter(c => c.verdict === "passed").length
  const failed = run.results.filter(c => c.verdict === "failed").length
  const unknown = run.results.filter(c => c.verdict === "unknown").length
  return { total: run.results.length, executed: passed + failed + unknown, passed, failed, unknown }
}

export const isCompletedRun = (run: EvalRun) => run.status === "completed"

/** 通过率：通过数 / 已执行数；未执行报告不参与通过率对比。 */
export function runPassRate(run: EvalRun): number | undefined {
  const stats = runStats(run)
  return stats.executed ? Math.round((stats.passed / stats.executed) * 100) : undefined
}

/** 参与对比的报告池：仅已完成，按开始时间倒序。 */
export function completedRuns(runs: EvalRun[]): EvalRun[] {
  return runs.filter(isCompletedRun).sort((a, b) => b.started - a.started)
}

export function runLabelText(run: EvalRun) {
  return run.code || new Date(run.started).toLocaleString("zh-CN")
}

/** 按用例逐条比较两份报告：新增失败 / 已修复 / 退化为无法判定。 */
export function runDiff(current: EvalRun, reference: EvalRun) {
  let newFailed = 0, fixed = 0, degraded = 0
  for (const c of current.results) {
    const before = reference.results.find(r => r.id === c.id)
    if (!before) continue
    if (before.verdict === "passed" && c.verdict === "failed") newFailed++
    else if (before.verdict === "failed" && c.verdict === "passed") fixed++
    else if (before.verdict === "passed" && c.verdict === "unknown") degraded++
  }
  return { newFailed, fixed, degraded }
}

/** 执行/评测模型不同时提示：结论变化可能来自模型而不是被测对象。 */
export function modelsDiffer(a: EvalRun, b: EvalRun) {
  const left = a.models, right = b.models
  if (!left || !right) return false
  return left.execution?.id !== right.execution?.id || left.judging?.id !== right.judging?.id
}

/** 仅当被对比报告的「用例版本」不同时提示“用例更新”（执行方式不影响可比性）。 */
export function caseVersionChanged(a: EvalRun, b: EvalRun) {
  return !!a.caseSnapshot?.version && !!b.caseSnapshot?.version && a.caseSnapshot.version !== b.caseSnapshot.version
}

/** 基线必须落在所选范围内；被移出时自动改为范围内最近一份。 */
export function normalizeBaseline(pool: EvalRun[], baselineId?: string) {
  if (pool.length && pool.some(run => run.id === baselineId)) return baselineId
  return pool[0]?.id
}

/** 范围内比当前报告更早的最近一份（pool 已按时间倒序）。 */
export function previousRunIn(pool: EvalRun[], run: EvalRun) {
  return pool.filter(item => item.started < run.started)[0] ?? null
}
