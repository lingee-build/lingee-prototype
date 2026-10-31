import { useEvaluation, checkKind, type PointsAmount, type PointsStatus, type EvalResult, type EvalRun, type EvalTurnResult } from "./evaluation"
type Usage = { execution: number; judging: number; missing: boolean; recorded: boolean; status?: PointsStatus; valueComplete?: boolean }
export function liveCasePoints(result: EvalResult): PointsAmount {
  const rounds = result.roundResults || []
  return {
    execution: rounds.reduce((n, t) => n + (t.points?.execution ?? 0), 0),
    judging: (result.overallJudgingPoints ?? 0) + rounds.reduce((n, t) => n + (t.points?.judging ?? 0), 0),
    missing: !rounds.length || rounds.some(t => !t.points) || result.overallJudgingPoints === undefined,
    recorded: result.overallJudgingPoints !== undefined || rounds.some(t => !!t.points),
  }
}
export function casePoints(result: EvalResult): Usage {
  return { ...(result.pointsSnapshot ?? liveCasePoints(result)), ...(result.pointsStatus ? { status: result.pointsStatus, valueComplete: result.pointsValueComplete } : {}) }
}
export function liveRunPoints(run: EvalRun): PointsAmount {
  return run.results.map(liveCasePoints).reduce((a, b) => ({ execution: a.execution + b.execution, judging: a.judging + b.judging, missing: a.missing || b.missing, recorded: a.recorded || b.recorded }), { execution: 0, judging: 0, missing: !run.results.length, recorded: false })
}
export function runPoints(run: EvalRun): Usage {
  const value = run.pointsQuery?.amount ?? liveRunPoints(run)
  return run.pointsQuery ? { ...value, status: run.pointsQuery.status, valueComplete: run.pointsQuery.valueComplete } : value
}
export function pointsText(value: Usage, detail = false): string {
  const status = value.status ?? (value.missing || !value.recorded ? "missing" : "complete")
  const labels: Record<PointsStatus, string> = { loading: "正在查询", pending: "统计中", complete: "", unavailable: "暂不可获取", missing: "未完整记录", exhausted: "尚未统计完整，可稍后刷新" }
  if (!value.recorded) return `消耗点数：${labels[status] || "未完整记录"}`
  const amount = (value.execution + value.judging).toFixed(2)
  const breakdown = detail ? `（执行 ${value.execution.toFixed(2)} · 判定 ${value.judging.toFixed(2)}）` : ""
  const qualifier = value.valueComplete && !value.missing ? "已查询点数" : "部分点数"
  return `消耗点数：${amount}${breakdown}${status === "complete" && !value.missing ? "" : `（${qualifier}，${labels[status] || "未完整记录"}）`}`
}
export function turnPointsText(turn: EvalTurnResult) {
  return pointsText({ ...(turn.pointsSnapshot ?? { execution: turn.points?.execution ?? 0, judging: turn.points?.judging ?? 0, missing: !turn.points, recorded: !!turn.points }), status: turn.pointsStatus, valueComplete: turn.pointsValueComplete }, true)
}

/** 本地原型仅演示查询状态；真实接入复用 statements2，不用模型成本换算点数。 */
export async function refreshRunPoints(key: string, id: string, demo: "normal" | "pending" | "unavailable" | "exhausted" = "normal") {
  const current = () => useEvaluation.getState().runs[key]?.find(r => r.id === id)
  const run = current()
  if (!run || run.pointsQuery?.status === "loading") return
  const previousTime = run.pointsQuery?.queriedAt
  const previousComplete = previousTime !== undefined && !!run.pointsQuery?.valueComplete
  const update = (status: PointsStatus, queriedAt?: number, valueComplete = false, capture = false) => {
    useEvaluation.setState(s => ({ runs: { ...s.runs, [key]: (s.runs[key] || []).map(r => r.id !== id ? r : {
      ...r, pointsQuery: { status, queriedAt, valueComplete, amount: capture ? liveRunPoints(r) : r.pointsQuery?.amount ?? liveRunPoints(r) },
      results: r.results.map(c => ({ ...c, overallPointsSnapshot: capture || !c.pointsSnapshot ? { amount: c.overallJudgingPoints, complete: c.overallJudgingPoints !== undefined } : c.overallPointsSnapshot, pointsSnapshot: capture ? liveCasePoints(c) : c.pointsSnapshot ?? liveCasePoints(c), pointsValueComplete: valueComplete && !(capture ? liveCasePoints(c) : casePoints(c)).missing, pointsStatus: status === "complete" && (capture ? liveCasePoints(c) : casePoints(c)).missing ? "missing" : status,
        roundResults: c.roundResults?.map(t => ({ ...t, pointsSnapshot: capture || !t.pointsSnapshot ? { execution: t.points?.execution ?? 0, judging: t.points?.judging ?? 0, missing: !t.points, recorded: !!t.points } : t.pointsSnapshot, pointsValueComplete: valueComplete && !!t.points, pointsStatus: status === "complete" && !t.points ? "missing" : status })) })),
    }) } }))
  }
  update("loading", previousTime, previousComplete)
  await new Promise(resolve => setTimeout(resolve, 300))
  const latest = current()
  if (!latest) return
  const status = demo === "normal" ? (liveRunPoints(latest).missing ? "missing" : "complete") : demo
  update(status, status === "unavailable" ? previousTime : Date.now(), status === "complete" || status === "unavailable" && previousComplete, status !== "unavailable")
}

export function overallPoints(result: EvalResult): number | undefined {
  if (result.overallPointsSnapshot) return result.overallPointsSnapshot.amount
  if (!result.pointsSnapshot) return result.overallJudgingPoints
  if (result.pointsSnapshot.missing) return undefined
  return Math.max(0, result.pointsSnapshot.judging - (result.roundResults || []).reduce((sum, t) => sum + (t.pointsSnapshot?.judging ?? 0), 0))
}

/** 成功查询时间与点数值同时存在，才属于成功查询快照。 */
export function pointsSourceText(run: EvalRun): string {
  if (run.pointsQuery?.amount && run.pointsQuery.queriedAt !== undefined) return "已查询点数快照"
  return runPoints(run).recorded ? "尚未成功查询，显示本地累计记录" : "尚未成功查询"
}

export function overallPointsText(result: EvalResult): string | undefined {
  const amount = overallPoints(result)
  if (!(amount && amount > 0) && !result.checks?.some(c => checkKind(c) === "natural")) return undefined
  return amount === undefined ? "未完整记录" : `消耗点数：${amount.toFixed(2)}${result.overallPointsSnapshot?.complete === false ? "（部分点数）" : ""}`
}
