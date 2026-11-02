import { evaluationRegex, matchEvaluationText, normalizeEvaluationText } from "./evaluation-text"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { EvalRunModels } from "./evaluation-models"
export type Source = "tenant" | "thirdParty" | "personal" | "none"
export type EvalEnvironment = "sandbox" | "production"
// 原型环境来源；接入执行器时由本地测试连接上下文提供，不由用例填写。
export const currentEvaluationEnvironment: EvalEnvironment = "sandbox"
export const environmentLabel = (environment?: EvalEnvironment) => environment ? environment === "sandbox" ? "沙箱" : "生产" : "环境未记录"
export const executionIssues = {
  tool_unavailable: { stage: "工具调用", reason: "当前环境未提供所需工具", action: "检查技能依赖的工具是否已配置并可用，再重新执行" },
  connection_failed: { stage: "连接业务服务", reason: "无法连接业务服务，未取得业务数据", action: "检查连接配置和服务状态，恢复后重新执行" },
  timeout: { stage: "等待执行回复", reason: "执行超过默认等待时间，未取得完整回复", action: "检查服务响应情况，稍后重新执行" },
  clarification_unmatched: { stage: "澄清回复", reason: "实际追问未匹配到配置的澄清回复", action: "根据实际追问补充澄清回复，再重新执行" },
} as const
export type ExecutionIssue = keyof typeof executionIssues
export type Outcome = "passed" | "failed" | "blocked"
export interface EvalAttachment { id: string; name: string; size: number; data: string }
export type CheckKind = "natural" | "text" | "keyword" | "regex" | "file"
export const checkOperators = { all: "包含全部关键词", any: "包含任一关键词", none: "不包含任一关键词", regex: "匹配正则表达式", not_regex: "不匹配正则表达式", exists: "存在", not_exists: "不存在" }
export interface EvalCheck { kind?: CheckKind; operator?: keyof typeof checkOperators; id: string; text: string; required: boolean; condition?: string; reference?: string; files: EvalAttachment[] }
export interface FileEvidence { path: string; exists: boolean; checkedAt?: number; content?: string }
export interface CheckResult extends EvalCheck { fileEvidence?: FileEvidence; verdict: "passed" | "failed" | "unknown" | "na"; actual: string; evidence: string }
/** 仅原型：预先编写的执行材料与语义依据，不从预期结论倒推回复或文件。 */
export interface DemoJudgment { check: Pick<EvalCheck, "text" | "condition" | "reference">; verdict: CheckResult["verdict"]; actual: string; evidence: string }
export interface DemoTurnEvidence { response: string; tool?: string; toolResult?: string; clarification: string; files: string[]; judgments: DemoJudgment[] }
export interface EvalTurn { checks?: EvalCheck[]; id: string; input: string; expected: string; inherit?: boolean; attachments: EvalAttachment[]; rules: { id: string; match: string; responses: string[] }[] }
export function turnsOf(c: EvalCase): EvalTurn[] {
  return c.turns?.length ? c.turns : [{ id: c.id + "-turn", input: c.input, expected: c.expected, attachments: [], rules: [] }]
}
export interface EvalCase {
  demoEvidence?: { turns: DemoTurnEvidence[]; overall: DemoJudgment[] }
  demoJudgingFailure?: "timeout" | "invalid"
  demoJudgingDelayMs?: number
  demoFailure?: ExecutionIssue
  businessId?: string
  checks?: EvalCheck[]
  demo?: boolean
  turns?: EvalTurn[]
  attachments?: EvalAttachment[]
  id: string
  name: string
  input: string
  expected: string
  source: Source
  outcome: Outcome
}
export type PointsAmount = { execution: number; judging: number; missing: boolean; recorded: boolean }
export type PointsStatus = "loading" | "pending" | "complete" | "unavailable" | "missing" | "exhausted"
export interface EvalTurnResult extends EvalTurn {
  toolResult?: string
  pointsSnapshot?: PointsAmount
  pointsStatus?: PointsStatus
  pointsValueComplete?: boolean
  points?: { execution: number; judging: number }
  tool?: string
  issue?: ExecutionIssue
  checkResults?: CheckResult[]
  status: Outcome | "pending" | "running" | "cancelled" | "skipped"
  responseRecorded?: boolean
  response: string
  evidence: string
  clarification: string
}
export interface EvalResult extends EvalCase {
  /** 仅新运行记录计时；历史缺失不按轮次数反推。 */
  timing?: { started?: number; ended?: number }
  pointsSnapshot?: PointsAmount
  pointsStatus?: PointsStatus
  pointsValueComplete?: boolean
  judging?: boolean
  overallPointsSnapshot?: { amount?: number; complete: boolean }
  overallJudgingPoints?: number
  checkResults?: CheckResult[]
  execution?: "completed" | "error"
  verdict?: "passed" | "failed" | "unknown"
  roundResults?: EvalTurnResult[]
  status: Outcome | "pending" | "running" | "cancelled" | "skipped"
  responseRecorded?: boolean
  response: string
  evidence: string
  tool: string
}
export interface EvalRun {
  models?: EvalRunModels
  pointsQuery?: { status: PointsStatus; queriedAt?: number; valueComplete?: boolean; amount?: PointsAmount }
  objectContentSummary?: string
  checkPolicySnapshot?: string
  environment?: EvalEnvironment
  objectType?: "skill" | "agent"
  id: string
  name: string
  ruleSnapshot?: string
  started: number
  ended?: number
  stopRequestedAt?: number
  stopReason?: string
  demoStopUnconfirmed?: boolean
  status: "running" | "judging" | "stopping" | "stop_unconfirmed" | "completed" | "cancelled" | "error"
  results: EvalResult[]
}
export const deletingEvaluationObjects = new Set<string>()
export const evaluationObjectUnavailable = (key: string) => deletingEvaluationObjects.has(key) || !!useEvaluation.getState().deletedObjects?.[key]
interface State {
  deletedObjects?: Record<string, true>
  drafts: Record<string, EvalCase | undefined>
  cases: Record<string, EvalCase[]>
  runs: Record<string, EvalRun[]>
  error: boolean
}
let storageWriteSucceeded = true
export const isActiveRun = (run: EvalRun) => ["running", "judging", "stopping", "stop_unconfirmed"].includes(run.status)
export const finishedCaseCount = (run: EvalRun) => run.results.filter(c => !c.judging && !["pending", "running"].includes(c.status)).length

/** 查询中的请求不跨页面存活；旧版无点数值快照的查询时间也不能冒充可信快照。 */
export function restorePointQueries(runs: State["runs"]): State["runs"] {
  return Object.fromEntries(Object.entries(runs).map(([key, list]) => [key, list.map(run => {
    const query = run.pointsQuery
    if (!query || query.status !== "loading" && query.amount) return run
    const status: PointsStatus = "unavailable"
    return { ...run, pointsQuery: { ...query, status, queriedAt: query.amount ? query.queriedAt : undefined },
      results: run.results.map(c => ({ ...c, pointsStatus: status,
        roundResults: c.roundResults?.map(t => ({ ...t, pointsStatus: status })) })) }
  })]))
}
export const useEvaluation = create<State>()(
  persist((): State => ({ drafts: {}, cases: {}, runs: {}, error: false }), {
    name: "lingee.evaluation.v1",
    partialize: ({ cases, runs, drafts, deletedObjects }) => ({ cases, runs: restorePointQueries(runs), drafts, deletedObjects }),
    storage: {
      getItem: (key) => {
        try {
          const value = localStorage.getItem(key)
          if (!value) return null
          const saved = JSON.parse(value)
          if (saved.state?.runs) saved.state.runs = restorePointQueries(saved.state.runs)
          return saved
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, JSON.stringify(value))
          storageWriteSucceeded = true
        } catch {
          storageWriteSucceeded = false
          queueMicrotask(() => {
            if (!storageWriteSucceeded && !useEvaluation.getState().error) useEvaluation.setState({ error: true })
          })
        }
      },
      removeItem: (key) => localStorage.removeItem(key),
    },
  }),
)
export function saveCases(key: string, cases: EvalCase[]) {
  if (evaluationObjectUnavailable(key)) return false
  const previous = useEvaluation.getState().cases
  useEvaluation.setState((s) => ({ cases: { ...s.cases, [key]: cases } }))
  if (!storageWriteSucceeded) {
    useEvaluation.setState({ cases: previous, error: true })
    return false
  }
  useEvaluation.setState({ error: false })
  return true
}
export function failedRunResults(run: EvalRun) {
  return run.results.filter(c => verdictLabel(c) === "不通过")
}
export function latestRunCases(key: string, run: EvalRun, resultIds = run.results.map(c => c.id)) {
  const latest = useEvaluation.getState().cases[key] || []
  const ids = new Set(resultIds)
  return { cases: latest.filter(c => ids.has(c.id)), missing: run.results.filter(c => ids.has(c.id) && !latest.some(item => item.id === c.id)) }
}
export function startRun(key: string, name: string, cases: EvalCase[], environment: EvalEnvironment = currentEvaluationEnvironment, models?: EvalRunModels) {
  if (evaluationObjectUnavailable(key) || environment !== "sandbox" || !cases.length || useEvaluation.getState().runs[key]?.some(isActiveRun)) return undefined
  if (models && [models.execution, models.judging].some(model => !model?.id?.trim() || !model.name?.trim() || !model.provider?.trim())) return undefined
  const run: EvalRun = {
    id: crypto.randomUUID(),
    ...(models ? { models: structuredClone(models) } : {}),
    environment,
    objectType: key.startsWith("agent:") ? "agent" : "skill",
    name,
    checkPolicySnapshot: evaluationCheckPolicy,
    ruleSnapshot: "任一标准不通过，用例不通过；无不通过但存在无法判定，或所有标准均不适用时，用例无法判定；执行完整且所有适用标准通过，用例通过；执行异常或停止时保留已确定的不通过，否则无法判定。",
    started: Date.now(),
    status: "running",
    results: cases.map((c) => ({ ...structuredClone(c), timing: {}, overallJudgingPoints: c.demo ? 0 : undefined, verdict: undefined, execution: undefined, checkResults: undefined, roundResults: structuredClone(turnsOf(c)).map((turn, i) => ({ ...turn, points: c.demo ? { execution: 0, judging: 0 } : undefined, checkResults: undefined, expected: i && turn.inherit ? turnsOf(c)[0].expected : turn.expected, status: "pending", responseRecorded: false, response: "", evidence: "", clarification: "" })), status: "pending", responseRecorded: false, response: "", evidence: "", tool: "" })),
  }
  const previous = useEvaluation.getState().runs
  useEvaluation.setState((s) => ({ runs: { ...s.runs, [key]: [run, ...(s.runs[key] || [])] } }))
  if (!storageWriteSucceeded) {
    useEvaluation.setState({ runs: previous, error: true })
    return undefined
  }
  useEvaluation.setState({ error: false })
  return run.id
}
/** 请求停止与执行器确认分开；本地模拟器在下一次推进时确认。 */
export function requestCancelRun(key: string, id: string, demoStopUnconfirmed = false) {
  useEvaluation.setState(s => ({ runs: { ...s.runs, [key]: (s.runs[key] || []).map(r => r.id === id && ["running", "judging"].includes(r.status) ? { ...r, status: "stopping", stopRequestedAt: Date.now(), demoStopUnconfirmed } : r) } }))
}
/** 仅在确认不存在活动执行和判定任务后调用；原型辅助入口模拟此确认。 */
export function cancelRun(key: string, id: string, terminal: "cancelled" | "error" = "cancelled") {
  useEvaluation.setState((s) => ({
    runs: {
      ...s.runs,
      [key]: (s.runs[key] || []).map((r) =>
        r.id === id && isActiveRun(r)
          ? {
              ...r,
              status: terminal,
              stopReason: terminal === "error" ? "已核实任务终止，运行级故障导致结束。" : "已核实所有执行与判定任务均已终止。",
              ended: Date.now(),
              results: r.results.map((c) => {
                if (c.status !== "pending" && c.status !== "running" && !c.judging) return c
                const failed = [...(c.checkResults || []), ...(c.roundResults || []).flatMap(t => t.checkResults || [])].some(check => check.verdict === "failed")
                return { ...c, judging: false, status: c.judging ? c.status : c.status === "pending" ? "skipped" : "cancelled", verdict: failed ? "failed" : "unknown",
                  timing: c.timing?.started !== undefined ? { ...c.timing, ended: Date.now() } : c.timing,
                  checkResults: completeStoppedChecks(c.checks || [], c.checkResults),
                  evidence: c.evidence || (c.status === "pending" ? "运行已停止，本用例未执行。" : "用户停止了本用例，已取得的证据和判定保留。"),
                  roundResults: c.roundResults?.map(t => t.status === "pending" || t.status === "running" ? {
                    ...t, status: t.status === "pending" ? "skipped" : "cancelled",
                    checkResults: completeStoppedChecks(checksOf(t), t.checkResults),
                    evidence: t.evidence || (t.status === "pending" ? "运行已停止，本轮未执行。" : "本轮已停止，已取得的证据保留。"),
                  } : t) }
              }),
            }
          : r,
      ),
    },
  }))
}
// Demo execution is clock-driven so leaving the panel does not lose a run.
// A browser reload preserves the run and completes the remaining simulated steps.
export function advanceRuns() {
  // 模拟执行器已停止确认；真实接入须等待确认，不得按定时器推定。
  for (const [key, runs] of Object.entries(useEvaluation.getState().runs)) {
    for (const run of runs) if (run.status === "stopping") {
      if (!run.demoStopUnconfirmed) cancelRun(key, run.id)
      else if (Date.now() - (run.stopRequestedAt ?? Date.now()) >= 1200) {
        useEvaluation.setState(s => ({ runs: { ...s.runs, [key]: s.runs[key].map(r => r.id === run.id ? { ...r, status: "stop_unconfirmed", stopReason: "尚未确认任务已终止，已转入后台核实。请稍后查看；暂不能重跑。" } : r) } }))
      }
    }
  }
  const state = useEvaluation.getState()
  let changed = false
  const runs = Object.fromEntries(
    Object.entries(state.runs).map(([key, list]) => [
      key,
      list.map((run) => {
        if (run.status !== "running" && run.status !== "judging") return run
        const elapsed = Date.now() - run.started
        let offset = 0
        let completedAt = run.started
        const results = run.results.map((item): EvalResult => {
          const rounds = item.roundResults
          const count = rounds?.length || 1
          const beginning = offset
          offset += count * 2400
          const completion = item.demo && item.outcome === "blocked" ? beginning + 2400 : offset + (item.demoJudgingDelayMs ?? 100)
          completedAt = Math.max(completedAt, run.started + completion)
          if (elapsed < beginning) return item
          const timing = item.timing ? { started: item.timing.started ?? run.started + beginning, ended: elapsed >= completion ? item.timing.ended ?? run.started + completion : undefined } : undefined
          if (timing?.started !== item.timing?.started || timing?.ended !== item.timing?.ended) changed = true
          if (item.demo && item.outcome === "blocked" && elapsed >= beginning + 2400) {
            const issue = item.demoFailure || "tool_unavailable"
            const detail = executionIssues[issue]
            const evidence = `${detail.stage}：${detail.reason}。${detail.action}`
            if (item.status !== "blocked") changed = true
            return { ...item, timing, judging: false, status: "blocked", execution: "error", verdict: [...(item.checkResults || []), ...(rounds || []).flatMap(t => t.checkResults || [])].some(c => c.verdict === "failed") ? "failed" : "unknown", response: "", evidence, tool: "",
              checkResults: completeStoppedChecks(item.checks || [], item.checkResults, evidence),
              roundResults: rounds?.map((turn, index) => ({ ...turn, points: { execution: index ? 0 : 0.18, judging: 0 }, status: index ? "skipped" : "blocked", issue: index ? undefined : issue,
                responseRecorded: false, response: "", tool: "", clarification: !index && issue === "clarification_unmatched" ? "实际追问：请确认查询所用的核算组织\n未找到匹配的自动回复" : "",
                evidence: index ? "前序轮次执行异常，本轮未执行" : evidence, checkResults: completeStoppedChecks(checksOf(turn), turn.checkResults, index ? "前序轮次执行异常，本轮未执行，缺少所需证据，无法判定。" : evidence) })) }
          }
          const status = elapsed < offset ? "running" : item.outcome
          const roundResults = rounds?.map((turn, index): EvalTurnResult => {
            const turnStatus = elapsed < beginning + index * 2400 ? "pending" : elapsed < beginning + (index + 1) * 2400 ? "running" : item.outcome
            if (turnStatus === turn.status) return turn
            changed = true
            const finished = !["running", "pending"].includes(turnStatus)
            const trace = item.demo ? item.demoEvidence?.turns[index] : undefined
            return { ...turn, status: turnStatus,
              points: item.demo ? { execution: finished ? Number((0.36 + turn.rules.length * 0.12 + index * 0.04).toFixed(2)) : 0.12, judging: finished ? checksOf(turn).filter(c => checkKind(c) === "natural").length * 0.08 : 0 } : undefined,
              tool: finished ? trace?.tool : undefined,
              toolResult: finished ? trace?.toolResult : undefined,
              checkResults: finished ? evaluateChecks(checksOf(turn, index && turn.inherit ? rounds?.[0].expected : undefined), item, run.started + beginning + (index + 1) * 2400, trace) : undefined,
              responseRecorded: finished && !!trace,
              response: finished ? trace?.response ?? "" : "",
              evidence: finished ? trace?.toolResult || "未取得可核验的执行证据。" : "",
              clarification: finished ? trace?.clarification || "未记录实际澄清过程。" : "" }
          })
          if (status !== item.status) changed = true
          const judging = status !== "running" && elapsed < offset + (item.demoJudgingDelayMs ?? 100)
          if (judging !== !!item.judging) changed = true
          const finalTrace = item.demo ? item.demoEvidence?.turns[count - 1] : undefined
          const checkResults = status === "running" || judging ? undefined : evaluateChecks(item.checks || [], item, run.started + offset, finalTrace, true)
          const allChecks = [...(checkResults || []), ...(roundResults || []).flatMap(t => t.checkResults || [])]
          return { ...item, timing, roundResults, status, checkResults, judging,
            overallJudgingPoints: item.demo ? status === "running" ? 0 : (item.checks || []).filter(c => checkKind(c) === "natural").length * 0.08 : undefined,
            execution: status === "running" ? undefined : item.outcome === "blocked" ? "error" : "completed",
            verdict: status === "running" || judging ? undefined : aggregateChecks(allChecks),
            responseRecorded: status !== "running" && !!finalTrace,
            response: status === "running" ? "" : finalTrace?.response ?? "",
            evidence: status === "running" ? "" : finalTrace?.toolResult || "未取得可核验的执行证据。",
            tool: status === "running" ? "" : finalTrace?.tool || "" }
        })
        const executed = results.every((c) => c.status !== "pending" && c.status !== "running")
        const done = executed && results.every(c => !c.judging)
        const nextStatus = done ? "completed" as const : executed ? "judging" as const : "running" as const
        if (nextStatus !== run.status) changed = true
        return {
          ...run,
          results,
          status: nextStatus,
          ended: done ? completedAt : undefined,
        }
      }),
    ]),
  )
  if (changed) useEvaluation.setState({ runs })
}
const timer = setInterval(advanceRuns, 400)
if (import.meta.hot) import.meta.hot.dispose(() => clearInterval(timer))

// Legacy expectations are projected without mutating saved cases or historical snapshots.
export function checksOf(turn: EvalTurn, inherited?: string): EvalCheck[] {
  if (turn.checks !== undefined) return turn.checks
  const text = inherited ?? turn.expected
  return text.trim() ? [{ id: `${turn.id}-legacy`, text, required: true, files: [] }] : []
}
export function aggregateChecks(checks: CheckResult[]): "passed" | "failed" | "unknown" {
  if (checks.some(c => c.verdict === "failed")) return "failed"
  if (!checks.some(c => c.verdict !== "na") || checks.some(c => c.verdict === "unknown")) return "unknown"
  return "passed"
}
function evaluateChecks(checks: EvalCheck[], item: EvalCase, checkedAt: number, trace?: DemoTurnEvidence, overall = false): CheckResult[] {
  return checks.map(c => {
    if (!trace) return { ...c, verdict: "unknown", actual: "未取得可核验的执行结果。", evidence: item.demo ? "旧版示例未记录执行材料，请添加新版示例后运行；历史记录保持不变。" : "缺少回复、工具返回或产物证据，暂无法判定。" }
    if (item.demoJudgingFailure && checkKind(c) === "natural") return { ...c, verdict: "unknown", actual: item.demoJudgingFailure === "timeout" ? "判定服务超时，未取得有效判定。" : "判定服务返回无效结果，未取得有效判定。", evidence: item.demoJudgingFailure === "timeout" ? "判定服务超时，重试结束后仍失败，无法判定；未重新执行业务。" : "判定服务返回无效结果，重试结束后仍无效，无法判定；未重新执行业务。" }
    const kind = checkKind(c)
    if (kind === "keyword" || kind === "regex") {
      const operator = c.operator || (kind === "regex" ? "regex" : "all")
      if (operator === "exists" || operator === "not_exists") return { ...c, verdict: "unknown", actual: "文本检查方式无效。", evidence: "请检查标准配置。" }
      try {
        const matched = matchEvaluationText(trace.response, c.text, operator)
        const words = [...new Set(normalizeEvaluationText(c.text).split("\n").map(v => v.trim()).filter(Boolean))]
        const included = words.filter(word => normalizeEvaluationText(trace.response).includes(word))
        const actual = kind === "regex" ? `${evaluationRegex(c.text).test(normalizeEvaluationText(trace.response)) ? "匹配到" : "未匹配到"}正则表达式：${c.text}`
          : operator === "none" ? included.length ? `出现禁止关键词：${included.join("、")}` : "未出现任何禁止关键词。"
          : matched ? `包含关键词：${included.join("、")}` : `缺少关键词：${words.filter(word => !included.includes(word)).join("、")}`
        return { ...c, verdict: matched === undefined ? "unknown" : matched ? "passed" : "failed", actual, evidence: `${overall ? "最后一轮" : "本轮"}最终回复：${trace.response || "（空回复）"}` }
      } catch { return { ...c, verdict: "unknown", actual: "正则表达式无效，未完成检查。", evidence: "请检查表达式后重新运行。" } }
    }
    if (kind === "file") {
      const path = c.text.trim()
      const exists = trace.files.includes(path)
      return { ...c, verdict: exists === (c.operator !== "not_exists") ? "passed" : "failed", fileEvidence: { path, exists, checkedAt },
        actual: exists ? `已找到文件：${path}` : `未找到文件：${path}`,
        evidence: `示例在${overall ? "最后一轮" : "本轮"}结束时记录的产物清单：${trace.files.join("、") || "无产物"}。仅检查路径存在性，未检查文件内容。` }
    }
    const judgment = (overall ? item.demoEvidence?.overall : trace.judgments)?.find(j => j.check.text === c.text && (j.check.condition || "") === (c.condition || "") && (j.check.reference || "") === (c.reference || ""))
    return judgment ? { ...c, verdict: judgment.verdict, actual: judgment.actual, evidence: judgment.evidence }
      : { ...c, verdict: "unknown", actual: "这条标准没有对应的示例判定依据。", evidence: "当前原型未连接真实语义判定服务，不能根据预设结果判为通过。" }
  })
}

/** 只摘取当前运行已记录的原因，不重新判定、不读取最新用例。 */
export function resultIssueSummary(result: EvalResult): string {
  const label = verdictLabel(result)
  if (label !== "不通过" && label !== "无法判定") return ""
  const rounds = result.roundResults || []
  const entries = [...rounds.flatMap((turn, index) => (turn.checkResults || []).map(check => ({ check, scope: `第 ${index + 1} 轮` }))), ...(result.checkResults || []).map(check => ({ check, scope: "整体标准" }))]
  const failed = entries.find(({ check }) => check.verdict === "failed")
  const generic = (text: string) => !text.trim() || /^(示例结果|示例判定|未取得完整执行结果|未取得可核验的执行结果)/.test(text)
  if (failed) return `${failed.scope}：${generic(failed.check.actual) ? `未满足“${checkDescription(failed.check)}”；详情见已有证据。` : failed.check.actual}`
  const issue = rounds.find(turn => turn.issue)?.issue
  if (issue) return `${executionIssues[issue].stage}：${executionIssues[issue].reason}。`
  if (result.status === "skipped") return "运行已停止，本用例未执行。"
  if (result.status === "cancelled") return "执行已停止，尚未取得完整结果。"
  const unknown = entries.find(({ check }) => check.verdict === "unknown")
  if (unknown) return `${unknown.scope}：${!generic(unknown.check.actual) ? unknown.check.actual : !generic(unknown.check.evidence) ? unknown.check.evidence : "缺少可核验的执行证据，请查看详情。"}`
  if (entries.length && entries.every(({ check }) => check.verdict === "na")) return "全部标准均不适用，无法形成通过结论。"
  return "未记录具体原因，请查看已有结果与证据。"
}
export function executionLabel(result: EvalResult) {
  if (result.status === "skipped") return "未执行"
  if (result.status === "pending") return "待执行"
  if (result.status === "running") return "运行中"
  if (result.status === "cancelled") return "已停止"
  return result.execution === "error" || result.status === "blocked" ? "执行异常" : "已完成"
}
export function verdictLabel(result: EvalResult) {
  if (result.judging) return "判定中"
  if (["pending", "running"].includes(result.status)) return "待判定"
  if (!result.verdict) return result.status === "passed" ? "通过" : result.status === "failed" ? "不通过" : "无法判定"
  return { passed: "通过", failed: "不通过", unknown: "无法判定" }[result.verdict]
}

export function checkKind(check: EvalCheck): Exclude<CheckKind, "text"> {
  return check.kind === "text" ? (["regex", "not_regex"].includes(check.operator || "") ? "regex" : "keyword") : check.kind || "natural"
}
export function checkDescription(check: EvalCheck): string {
  if (checkKind(check) === "keyword") return `关键词匹配 · ${checkOperators[check.operator || "all"]}：${check.text.split("\n").map(v => v.trim()).filter(Boolean).join("、")}`
  if (checkKind(check) === "regex") return `正则匹配 · ${checkOperators[check.operator || "regex"]}：${check.text}`
  if (check.kind === "file") return `文件存在性 · ${checkOperators[check.operator || "exists"]}：${check.text}`
  return [check.condition?.trim() ? `适用条件：${check.condition.trim()}` : "", check.text,
    check.reference?.trim() ? `预期结果：${check.reference.trim()}` : ""].filter(Boolean).join("\n")
}

export function checkValidation(check: EvalCheck): string {
  if (!check.text.trim()) return check.kind === "file" ? "请填写文件相对路径，不能仅包含空格。" : ["keyword", "regex"].includes(checkKind(check)) ? "请填写匹配内容，不能仅包含空格。" : "请填写评测标准，不能仅包含空格。"
  if (checkKind(check) === "regex") {
    try { evaluationRegex(check.text) } catch { return "正则表达式格式不正确，请检查括号和转义字符。" }
  }
  if (check.kind === "file" && (/^(?:[\\/]|[a-zA-Z]:)/.test(check.text.trim()) || check.text.split(/[\\/]/).includes(".."))) return "请输入工作区内的相对路径，例如 outputs/report.xlsx。"
  return ""
}

/** 明确记录的空回复与未采集到回复分别展示；非空存量回复仍可读取。 */
/** 页面和报告共用实际澄清记录；配置数量不能证明是否发生过澄清。 */
export function clarificationText(turn: Pick<EvalTurnResult, "clarification" | "status">): string {
  if (turn.clarification?.trim()) return turn.clarification
  if (turn.status === "pending" || turn.status === "skipped") return "本轮未执行，无澄清过程。"
  if (turn.status === "running") return "本轮执行中，尚未记录澄清过程。"
  return "未记录澄清过程。"
}

export function responseText(result: { response: string; responseRecorded?: boolean }, translate: (text: string) => string = text => text) {
  if (result.responseRecorded === false) return "未记录实际回复"
  if (result.response) return translate(result.response)
  return result.responseRecorded === true ? "最终回复为空" : "未记录实际回复"
}
export function fileCheckTime(evidence?: FileEvidence): string {
  return evidence?.checkedAt === undefined ? "未记录" : new Date(evidence.checkedAt).toLocaleString("zh-CN", { hour12: false })
}

export const evaluationCheckPolicy = `语义判断：轮次标准读取截至本轮的实际输入、澄清、工具返回及最终回复，不读取后续轮次；整体标准只在业务正常完成后发起，读取完整的实际执行记录；执行异常或用户停止后不发起新的整体判定，已有结论保留，其余为无法判定。仅条件明确未发生时可判不适用，条件证据缺失时无法判定；全部不适用不算通过。附件仅在内容已解析并留存时可作为证据，MVP 不自动读取产物内容。
关键词与正则：轮次检查本轮最终回复，整体检查最后一轮最终回复，不拼入输入、澄清、工具返回或文件内容。保留 Markdown、大小写与空格，仅将 CRLF、CR 统一为 LF。回复缺失为无法判定；明确采集的空回复按空文本检查。
关键词：去除关键词首尾空白，保留内部空格并去重；区分大小写，按字面子串检查全部、任一或不包含任一。
正则：ECMAScript RegExp，默认 flags 为空，查找任意匹配；完整匹配须显式使用锚点。表达式不包含两侧斜杠或外置 flags。
文件存在性：每个用例使用独立工作区，轮次共享；输入附件与产物分开。轮次结束且下一轮开始前检查，整体在最后一轮结束后检查。保存路径、时点与结果；不存在也须成功检查。检查失败、证据缺失或未到检查时点均无法判定，不用停止后的状态替代。
停止或异常：保留已取得的判定，缺失证据的标准无法判定；未开始的轮次未执行，执行不完整的用例不得通过。`;

export function completeStoppedChecks(checks: EvalCheck[], results?: CheckResult[], reason = "运行已停止，缺少所需证据，无法判定。"): CheckResult[] {
  return checks.map(check => results?.find(result => result.id === check.id) || { ...check, verdict: "unknown", actual: "未取得完整判定证据", evidence: reason })
}

/** 手动保存与草稿加入共用的完整性检查。 */
export function caseValidation(value: EvalCase): string {
  if (!value.name.trim()) return "用例名称必填，不能仅包含空白。"
  const turns = turnsOf(value)
  for (const [i, turn] of turns.entries()) {
    if (!turn.input.trim()) return `第 ${i + 1} 轮用户输入必填，不能仅包含空白。`
    if (turn.rules.some(r => !r.match.trim() || !r.responses.join("\n").trim())) return `第 ${i + 1} 轮澄清追问和自动回复不能为空。`
  }
  const checks = [...(value.checks || []), ...turns.flatMap(t => checksOf(t))]
  if (!checks.length) return "请至少添加一条本轮或整体评测标准。"
  return checks.map(checkValidation).find(Boolean) || ""
}
