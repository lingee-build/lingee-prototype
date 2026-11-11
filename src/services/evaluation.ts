import { evaluationRegex, matchEvaluationText, normalizeEvaluationText } from "./evaluation-text"
import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { EvalRunModels } from "./evaluation-models"
import { objectSnapshotOf, type ObjectSnapshot } from "./evaluation-snapshot"
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
/** 整体验收标准分类：最终结果只看任务完成情况，全程贯穿约束整个过程，跨轮一致要求各轮信息一致。 */
export type OverallCategory = "final" | "throughout" | "consistent"
export const overallCategories: Record<OverallCategory, string> = { final: "最终结果", throughout: "全程贯穿", consistent: "跨轮一致" }
export const expectedResponseLabels = { output: "内容输出", clarify: "澄清" } as const
export interface EvalCheck { kind?: CheckKind; operator?: keyof typeof checkOperators; overall?: OverallCategory; id: string; text: string; required: boolean; condition?: string; reference?: string; files: EvalAttachment[] }
export interface FileEvidence { path: string; exists: boolean; checkedAt?: number; content?: string }
export interface CheckResult extends EvalCheck { fileEvidence?: FileEvidence; verdict: "passed" | "failed" | "unknown" | "na" | "skipped"; actual: string; evidence: string }
/** 仅原型：预先编写的执行材料与语义依据，不从预期结论倒推回复或文件。 */
export interface DemoJudgment { check: Pick<EvalCheck, "text" | "condition" | "reference">; verdict: CheckResult["verdict"]; actual: string; evidence: string }
export interface DemoTurnEvidence { response: string; tool?: string; toolResult?: string; clarification: string; files: string[]; judgments: DemoJudgment[] }
/** 澄清选择方式：语义输入按澄清选择自由补充，固定文本按预设文本应答。 */
export type ClarifyPickMode = "input" | "fixed"
export const clarifyPickModes: Record<ClarifyPickMode, string> = { input: "语义输入", fixed: "固定文本" }
export const clarifySceneNames = ["一", "二", "三"] as const
export const maxClarifyScenes = clarifySceneNames.length
/**
 * 一个澄清场景：期望被测对象先提出追问（澄清校验），按澄清回复自动应答，
 * 再按期望澄清后响应校验该场景的输出校验。同一轮的多个场景互为「或」。
 */
export interface EvalClarifyScene {
  id: string
  /** 澄清校验：期望被测对象提出的追问。 */
  check?: EvalCheck
  /** 澄清选择：模拟用户的选择或补充。 */
  match: string
  /** 澄清选择方式：语义输入 / 固定文本。 */
  pickMode?: ClarifyPickMode
  /** 执行时按澄清选择自动应答的文本；界面与 match 保持一致。 */
  responses: string[]
  /** 期望澄清后响应：内容输出（默认）或继续澄清。 */
  post?: "output" | "clarify"
  /** 该场景的输出校验；未单独配置时沿用轮次校验。 */
  checks?: EvalCheck[]
}
export interface EvalTurn {
  checks?: EvalCheck[]; id: string; input: string; expected: string; inherit?: boolean;
  /** 期望响应：内容输出（默认）或澄清回复。期望澄清时按澄清场景自动应答，输出校验校验澄清后的响应。 */
  expectedResponse?: "output" | "clarify";
  attachments: EvalAttachment[];
  /** 澄清场景，每个场景互为「或」；有场景即视为期望澄清。 */
  rules: EvalClarifyScene[];
}
/** 期望澄清：显式标记优先，未标记时已配置澄清场景即视为澄清轮（兼容历史用例数据）。 */
export function isClarifyTurn(turn: Pick<EvalTurn, "expectedResponse" | "rules">): boolean {
  if (turn.expectedResponse) return turn.expectedResponse === "clarify"
  return !!turn.rules?.length
}
export function scenesOf(turn: EvalTurn): EvalClarifyScene[] {
  return turn.rules || []
}
/** 场景的输出校验：优先场景自身配置，历史数据沿用轮次校验。 */
export function sceneChecksOf(turn: EvalTurn, scene?: EvalClarifyScene): EvalCheck[] {
  return scene?.checks?.length ? scene.checks : checksOf(turn)
}
/** 执行判定：按命中的第一个澄清场景判定澄清提问与该场景输出校验，其余场景视为未执行。 */
export function executedChecksOf(turn: EvalTurn, inherited?: string): EvalCheck[] {
  if (!isClarifyTurn(turn)) return checksOf(turn, inherited)
  const scene = scenesOf(turn)[0]
  return scene ? [...(scene.check ? [scene.check] : []), ...sceneChecksOf(turn, scene)] : checksOf(turn, inherited)
}
/** 澄清场景涉及的校验总数（澄清提问 + 输出校验）。 */
export function clarifyChecksOf(turn: EvalTurn): EvalCheck[] {
  return scenesOf(turn).flatMap(scene => [...(scene.check ? [scene.check] : []), ...sceneChecksOf(turn, scene)])
}
export function turnsOf(c: EvalCase): EvalTurn[] {
  return c.turns?.length ? c.turns : [{ id: c.id + "-turn", input: c.input, expected: c.expected, attachments: [], rules: [] }]
}
export interface EvalCase {
  code?: string
  /** 案例背景知识：全程对被测对象可用，与轮次附件区分。 */
  background?: EvalAttachment[]
  /** 案例精要：保存时按用例内容生成的一句话总结（原型模拟 AI），仅用于列表速览。 */
  summary?: string
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
export interface CaseSnapshot { version: string; capturedAt: number; cases: EvalCase[] }
export interface EvalRun {
  code?: string
  conversationId?: string
  caseSnapshot?: CaseSnapshot
  sourceRunId?: string
  hardRuleStop?: boolean
  models?: EvalRunModels
  pointsQuery?: { status: PointsStatus; queriedAt?: number; valueComplete?: boolean; amount?: PointsAmount }
  objectContentSummary?: string
  /** 运行时冻结的被测配置快照（提示词/知识库/技能/工具），历史报告缺失时按未记录展示。 */
  objectSnapshot?: ObjectSnapshot
  /** 执行人；原型未接入账号上下文的报告留空，按未记录展示。 */
  executor?: string
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
  reportSequences?: Record<string, number>
  caseCodes?: Record<string, Record<string, string>>
  /** 用例集状态：案例修改/新增时 version+1 且 executed=false；执行任意一条后 executed=true（对齐设计稿 CASE_SET）。 */
  caseSets?: Record<string, { version: number; executed: boolean; baseline?: EvalCase[] }>
  deletedObjects?: Record<string, true>
  drafts: Record<string, EvalCase | undefined>
  cases: Record<string, EvalCase[]>
  runs: Record<string, EvalRun[]>
  error: boolean
}
/** 字段顺序不影响内容；用例顺序保留，运行结果字段不参与版本比较。 */
export function caseContentKey(cases: EvalCase[]): string {
  // summary 由内容派生，不参与版本比较，避免归档版本无意义 +1。
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key, v]) => v !== undefined && key !== "outcome" && key !== "code" && key !== "summary").sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)])) : value
  return JSON.stringify(canonical(cases))
}
/** 内存中共享不可变快照，旧记录按内容合并，报告编号及结果不变。 */
export function normalizeCaseVersions(runs: Record<string, EvalRun[]>): Record<string, EvalRun[]> {
  return Object.fromEntries(Object.entries(runs).map(([key, records]) => {
    const versions = new Map<string, CaseSnapshot>()
    const snapshots = new Map<string, CaseSnapshot>()
    for (const run of [...records].sort((a, b) => a.started - b.started || (Number(a.caseSnapshot?.version.slice(1)) || 0) - (Number(b.caseSnapshot?.version.slice(1)) || 0))) {
      if (!run.caseSnapshot) continue
      const content = caseContentKey(run.caseSnapshot.cases)
      let snapshot = versions.get(content)
      if (!snapshot) {
        snapshot = { ...run.caseSnapshot, version: `V${versions.size + 1}` }
        versions.set(content, snapshot)
      }
      snapshots.set(run.id, snapshot)
    }
    return [key, records.map(run => snapshots.has(run.id) ? { ...run, caseSnapshot: snapshots.get(run.id) } : run)]
  }))
}
/** 持久化仅保存一份版本内容，运行通过引用关联；兼容旧的内嵌快照。 */
export function packCaseVersions(runs: Record<string, EvalRun[]>) {
  const snapshots: Record<string, CaseSnapshot> = {}
  const packed = Object.fromEntries(Object.entries(runs).map(([key, records]) => [key, records.map(run => {
    if (!run.caseSnapshot) return run
    const ref = JSON.stringify([key, run.caseSnapshot.version])
    snapshots[ref] = run.caseSnapshot
    const { caseSnapshot: _snapshot, ...rest } = run
    return { ...rest, caseSnapshotRef: ref }
  })]))
  return { runs: packed, snapshots }
}
export function unpackCaseVersions(runs: Record<string, EvalRun[]>, snapshots: Record<string, CaseSnapshot> = {}) {
  const restored = Object.fromEntries(Object.entries(runs).map(([key, records]) => [key, records.map(record => {
    const { caseSnapshotRef, ...run } = record as EvalRun & { caseSnapshotRef?: string }
    return caseSnapshotRef && snapshots[caseSnapshotRef] ? { ...run, caseSnapshot: snapshots[caseSnapshotRef] } : run
  })]))
  return normalizeCaseVersions(restored)
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
// 本地原型按用户要求一次性清空既有运行；新运行及当前用例继续保留。
const localRunReset = "20261104-clear-runs-1"
const isLocalPrototype = () => typeof window !== "undefined" && ["127.0.0.1", "localhost", "[::1]"].includes(window.location.hostname)
export const useEvaluation = create<State>()(
  persist((): State => ({ drafts: {}, cases: {}, runs: {}, error: false }), {
    name: "lingee.evaluation.v1",
    partialize: ({ cases, runs, drafts, deletedObjects, caseCodes, reportSequences, caseSets }) => ({ reportSequences, caseCodes, cases, ...packCaseVersions(restorePointQueries(runs)), drafts, deletedObjects, caseSets }),
    storage: {
      getItem: (key) => {
        try {
          const value = localStorage.getItem(key)
          if (!value) return null
          const saved = JSON.parse(value)
          if (isLocalPrototype() && saved.localRunReset !== localRunReset) {
            saved.state = { ...saved.state, runs: {}, snapshots: {} }
            saved.localRunReset = localRunReset
            localStorage.setItem(key, JSON.stringify(saved))
          }
          if (saved.state?.runs) saved.state.runs = restorePointQueries(unpackCaseVersions(saved.state.runs, saved.state.snapshots))
          if (saved.state) {
            const state = saved.state as State
            state.caseCodes ||= {}
            state.reportSequences ||= {}
            state.caseSets ||= {}
            for (const key of new Set([...Object.keys(state.cases || {}), ...Object.keys(state.runs || {})])) {
              const registry = state.caseCodes[key] ||= {}
              let sequence = Math.max(state.reportSequences[key] || 0, ...(state.runs[key] || []).map(r => Number(r.code?.slice(3)) || 0))
              for (const run of [...(state.runs[key] || [])].sort((a, b) => a.started - b.started)) {
                run.code ||= `ER-${String(++sequence).padStart(4, "0")}`
              }
              state.reportSequences[key] = sequence
              for (const run of [...(state.runs[key] || [])].reverse()) {
                if (run.caseSnapshot) run.caseSnapshot.cases = assignCaseCodes(run.caseSnapshot.cases, registry)
                run.results = assignCaseCodes(run.results, registry)
              }
              if (state.cases[key]) state.cases[key] = assignCaseCodes(state.cases[key], registry)
            }
          }
          return saved
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(key, JSON.stringify(isLocalPrototype() ? { ...value, localRunReset } : value))
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
/** 注册表保留已删除 ID，确保编码不会被重新分配。导入携带的编码不作为分配依据。 */
export function assignCaseCodes<T extends EvalCase>(cases: T[], registry: Record<string, string>): T[] {
  let sequence = Math.max(0, ...Object.values(registry).map(code => Number(code.slice(3)) || 0))
  return cases.map(item => {
    registry[item.id] ||= `EC-${String(++sequence).padStart(4, "0")}`
    return { ...item, code: registry[item.id] }
  })
}
export function saveCases(key: string, cases: EvalCase[]) {
  if (evaluationObjectUnavailable(key)) return false
  const previous = useEvaluation.getState()
  const registry = { ...previous.caseCodes?.[key] }
  const assigned = assignCaseCodes(cases, registry)
  // 用例集内容变化时版本 +1 并标记未执行（执行任意一条后恢复已执行，见 startRun）。
  const set = previous.caseSets?.[key]
  const changed = caseContentKey(previous.cases[key] || []) !== caseContentKey(assigned)
  const nextSet = changed
    ? { version: (set?.version ?? latestSnapshotVersion(key, previous)) + 1, executed: false, baseline: set?.baseline }
    : set ?? { version: latestSnapshotVersion(key, previous), executed: false }
  useEvaluation.setState(s => ({ cases: { ...s.cases, [key]: assigned }, caseCodes: { ...s.caseCodes, [key]: registry }, caseSets: { ...s.caseSets, [key]: nextSet } }))
  if (!storageWriteSucceeded) {
    useEvaluation.setState({ cases: previous.cases, caseCodes: previous.caseCodes, caseSets: previous.caseSets, error: true })
    return false
  }
  useEvaluation.setState({ error: false })
  return true
}
/** 用例集当前版本号：优先取已记录的 caseSets，其次回退到最近一次运行快照的版本号。 */
function latestSnapshotVersion(key: string, state: { caseSets?: State["caseSets"]; runs: State["runs"] }) {
  return state.caseSets?.[key]?.version
    ?? (Number(state.runs[key]?.find(run => run.caseSnapshot)?.caseSnapshot?.version.slice(1)) || 1)
}
export function failedRunResults(run: EvalRun) {
  return run.results.filter(c => verdictLabel(c) === "不通过")
}
/** 重跑未通过的终态用例；修复仍使用 failedRunResults。 */
export function unsuccessfulRunResults(run: EvalRun) {
  return run.results.filter(c => ["不通过", "无法判定"].includes(verdictLabel(c)))
}
/** 历史结果保留了输入字段；旧记录可查看，但不虚构版本编号。 */
export function runCases(run: EvalRun): EvalCase[] {
  return structuredClone((run.caseSnapshot ? run.results.flatMap(result => run.caseSnapshot!.cases.filter(c => c.id === result.id)) : undefined) ?? run.results.map(c => ({
    id: c.id, code: c.code, businessId: c.businessId, name: c.name, input: c.input, expected: c.expected,
    source: c.source, outcome: c.outcome, turns: c.turns, attachments: c.attachments, checks: c.checks,
    background: c.background, summary: c.summary,
    demo: c.demo, demoEvidence: c.demoEvidence, demoFailure: c.demoFailure,
    demoJudgingFailure: c.demoJudgingFailure, demoJudgingDelayMs: c.demoJudgingDelayMs,
  })))
}
export function caseVersionLabel(run: EvalRun) {
  return run.caseSnapshot?.version ?? `历史快照 · ${new Date(run.started).toLocaleString("zh-CN")}`
}
export function snapshotRunCases(run: EvalRun, ids = run.results.map(c => c.id)) {
  return runCases(run).filter(c => ids.includes(c.id))
}
/** 只展示当前会话发起的运行；旧运行不推断归属。 */
export function latestConversationRun(runs: EvalRun[], conversationId?: string) {
  return conversationId ? runs.find(run => run.conversationId === conversationId) : undefined
}
export function startRun(key: string, name: string, cases: EvalCase[], environment: EvalEnvironment = currentEvaluationEnvironment, models?: EvalRunModels, sourceRunId?: string, conversationId?: string) {
  if (evaluationObjectUnavailable(key) || environment !== "sandbox" || !cases.length || useEvaluation.getState().runs[key]?.some(isActiveRun)) return undefined
  if (models && [models.execution, models.judging].some(model => !model?.id?.trim() || !model.name?.trim() || !model.provider?.trim())) return undefined
  const registry = { ...useEvaluation.getState().caseCodes?.[key] }
  cases = assignCaseCodes(cases, registry)
  useEvaluation.setState(s => ({ caseCodes: { ...s.caseCodes, [key]: registry } }))
  const previous = useEvaluation.getState().runs
  const records = normalizeCaseVersions({ [key]: previous[key] || [] })[key]
  const source = sourceRunId ? records.find(run => run.id === sourceRunId) : undefined
  if (sourceRunId && !source) return undefined
  const candidate = assignCaseCodes(source?.caseSnapshot?.cases ?? (source ? runCases(source) : useEvaluation.getState().cases[key] || cases), registry)
  // 调用方提供的实际范围必须与所选版本内容一致。
  const fullCases = cases.every(c => candidate.some(saved => saved.id === c.id && caseContentKey([saved]) === caseContentKey([c]))) ? candidate : cases
  if (source && fullCases === cases && caseContentKey(cases) !== caseContentKey(candidate.filter(c => cases.some(item => item.id === c.id)))) return undefined
  const content = caseContentKey(fullCases)
  const existing = records.find(run => run.caseSnapshot && caseContentKey(run.caseSnapshot.cases) === content)?.caseSnapshot
  const snapshot = existing ?? { version: `V${Math.max(0, ...records.map(run => Number(run.caseSnapshot?.version.slice(1)) || 0)) + 1}`, capturedAt: Date.now(), cases: structuredClone(fullCases) }
  const sequence = Math.max(useEvaluation.getState().reportSequences?.[key] || 0, ...records.map(r => Number(r.code?.slice(3)) || 0)) + 1
  const run: EvalRun = {
    code: `ER-${String(sequence).padStart(4, "0")}`,
    id: crypto.randomUUID(),
    caseSnapshot: snapshot,
    sourceRunId,
    conversationId,
    ...(models ? { models: structuredClone(models) } : {}),
    environment,
    objectType: key.startsWith("agent:") ? "agent" : "skill",
    objectSnapshot: objectSnapshotOf(key),
    name,
    hardRuleStop: true,
    checkPolicySnapshot: evaluationCheckPolicy,
    ruleSnapshot: "任一标准不通过，用例不通过；无不通过但存在无法判定，或所有标准均不适用时，用例无法判定；执行完整且所有适用标准通过，用例通过；执行异常或停止时保留已确定的不通过，否则无法判定。",
    started: Date.now(),
    status: "running",
    results: cases.map((c) => ({ ...structuredClone(c), timing: {}, overallJudgingPoints: c.demo ? 0 : undefined, verdict: undefined, execution: undefined, checkResults: undefined, roundResults: structuredClone(turnsOf(c)).map((turn, i) => ({ ...turn, points: c.demo ? { execution: 0, judging: 0 } : undefined, checkResults: undefined, expected: i && turn.inherit ? turnsOf(c)[0].expected : turn.expected, status: "pending", responseRecorded: false, response: "", evidence: "", clarification: "" })), status: "pending", responseRecorded: false, response: "", evidence: "", tool: "" })),
  }
  useEvaluation.setState((s) => ({
    reportSequences: { ...s.reportSequences, [key]: sequence },
    runs: { ...s.runs, [key]: [run, ...records] },
    // 执行过案例集（任意一条）即恢复已执行状态，并记录本次执行的用例内容作为新增/修改标识的比对基线。
    caseSets: { ...s.caseSets, [key]: { ...(s.caseSets?.[key] ?? { version: latestSnapshotVersion(key, s) }), executed: true, baseline: structuredClone(fullCases) } },
  }))
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
                    checkResults: completeStoppedChecks(executedChecksOf(t), t.checkResults),
                    evidence: t.evidence || (t.status === "pending" ? "运行已停止，本轮未执行。" : "本轮已停止，已取得的证据保留。"),
                  } : t) }
              }),
            }
          : r,
      ),
    },
  }))
}
const demoEvidenceText = { passed: "示例报告：回复与预期一致，关键结果完整。", failed: "示例报告：回复缺少预期中的关键结果。", unknown: "示例报告：缺少判定依据，无法判定。" } as const

/** 原型兜底：澄清轮缺少实际澄清记录时，按用例配置生成澄清校验内容（澄清提问 + 澄清选择）。 */
function mockClarificationOf(turn: EvalTurn): string {
  const scene = scenesOf(turn)[0]
  if (!isClarifyTurn(turn) || !scene) return "本轮未发生澄清。"
  return `澄清提问：${scene.check?.text.trim() ? checkDescription(scene.check) : "需要确认哪些关键信息？"}\n澄清选择：${scene.match || "按用例预设选择"}`
}

function demoCheckResults(checks: EvalCheck[] | undefined, kind: "passed" | "failed" | "unknown"): CheckResult[] | undefined {
  if (!checks?.length) return undefined
  const actual = kind === "failed" ? "示例判定：回复缺少预期中的关键结果。" : kind === "unknown" ? "未取得可核验的执行结果（示例）" : "回复与标准一致（示例）"
  return checks.map(check => ({ ...structuredClone(check), verdict: kind, actual, evidence: demoEvidenceText[kind] }))
}

/** 原型演示：按当前用例集填充 6 份示例报告（不带真实执行）；用例集版本随时间递增，最新一份不小于之前任何一份。 */
export function fillDemoReports(key: string, name: string) {
  if (evaluationObjectUnavailable(key)) return false
  const state = useEvaluation.getState()
  const cases = state.cases[key] || []
  if (!cases.length || state.runs[key]?.some(isActiveRun)) return false
  const previous = state.runs
  const registry = { ...state.caseCodes?.[key] }
  const snapshotCases = assignCaseCodes(structuredClone(cases), registry)
  const total = snapshotCases.length
  // 演示版本随时间递增（早期 V(n+1) → 最新 V(n+3)），最新一份的用例集版本不小于之前任何一份。
  const prevMax = Math.max(0, ...(previous[key] || []).map(run => Number(run.caseSnapshot?.version.slice(1)) || 0))
  const mkSnapshot = (step: number, minutesAgo: number, mutate?: (cs: EvalCase[]) => void): CaseSnapshot => {
    const casesB = structuredClone(snapshotCases)
    mutate?.(casesB)
    return { version: `V${prevMax + step}`, capturedAt: Date.now() - minutesAgo * 60_000, cases: casesB }
  }
  const snapV1 = mkSnapshot(1, 295, cs => { if (cs[0]) cs[0].expected = `${cs[0].expected}（早期口径示例）` })
  const snapV2 = mkSnapshot(2, 175, cs => { if (cs[0]) cs[0].expected = `${cs[0].expected}（上一轮口径示例）` })
  const snapV3 = mkSnapshot(3, 4)
  const demoModels: EvalRunModels = {
    execution: { id: "demo-exec", name: "deepseek-v3.2（演示）", provider: "demo" },
    judging: { id: "demo-judge", name: "deepseek-v3.2（演示）", provider: "demo" },
  }
  type DemoKind = "passed" | "failed" | "unknown" | "skip"
  const plan = (kinds: DemoKind[]): DemoKind[] => [...kinds.slice(0, total), ...Array(Math.max(0, total - kinds.length)).fill("skip") as DemoKind[]]
  const demoResult = (c: EvalCase, kind: DemoKind): EvalResult => {
    const verdict = kind === "skip" ? undefined : kind
    const status = kind === "skip" ? "skipped" : kind === "unknown" ? "blocked" : kind
    const turnStatus = kind === "skip" ? "skipped" : kind === "unknown" ? "blocked" : kind
    return {
      ...structuredClone(c), timing: {}, judging: false,
      verdict: verdict as EvalResult["verdict"],
      execution: kind === "skip" ? undefined : "completed",
      checkResults: demoCheckResults(c.checks, kind === "skip" ? "unknown" : kind),
      status: status as EvalResult["status"], responseRecorded: kind !== "skip",
      response: kind === "skip" ? "" : "（示例回复）已按用例输入生成结果。",
      evidence: kind === "skip" ? "示例报告：本用例未执行。" : demoEvidenceText[kind as "passed"],
      tool: "",
      roundResults: turnsOf(c).map(turn => {
        // 澄清轮的示例澄清记录带上澄清提问内容，供「澄清校验」前的模型输出展示。
        const scene = isClarifyTurn(turn) ? scenesOf(turn)[0] : undefined
        return {
          ...structuredClone(turn), status: turnStatus as EvalTurnResult["status"], responseRecorded: kind !== "skip",
          response: kind === "skip" ? "" : "（示例回复）已按本轮输入生成结果。",
          evidence: kind === "skip" ? "示例报告：本轮未执行。" : demoEvidenceText[kind as "passed"],
          clarification: kind === "skip" || !scene ? "本轮未发生澄清。"
            : `示例澄清提问：${scene.check?.text.trim() ? checkDescription(scene.check) : "需要确认哪些关键信息？"}\n澄清选择：${scene.match || "按用例预设选择"}`,
          checkResults: demoCheckResults(executedChecksOf(turn), kind === "skip" ? "unknown" : kind),
        }
      }),
    }
  }
  const demoRun = (kinds: DemoKind[], status: EvalRun["status"], minutesAgo: number, extra: Partial<EvalRun> = {}, models: EvalRunModels = demoModels, caseSnapshot: CaseSnapshot): EvalRun => ({
    id: crypto.randomUUID(),
    caseSnapshot: structuredClone(caseSnapshot),
    models: structuredClone(models),
    environment: currentEvaluationEnvironment,
    objectType: key.startsWith("agent:") ? "agent" : "skill",
    objectSnapshot: objectSnapshotOf(key),
    name,
    hardRuleStop: true,
    checkPolicySnapshot: evaluationCheckPolicy,
    started: Date.now() - minutesAgo * 60_000,
    ended: Date.now() - (minutesAgo - 1) * 60_000,
    status,
    results: snapshotCases.map((c, index) => demoResult(c, kinds[index])),
    ...extra,
  })
  const demoRuns: EvalRun[] = [
    // 按时间从旧到新：版本 V(n+1) → V(n+2) → V(n+3)，最新一份版本不小于之前任何一份。
    // ER-0001 异常中止（最早）。
    demoRun(plan(Array.from({ length: Math.max(1, Math.floor(total * 0.4)) }, (_, index) => (index === 0 ? "failed" : "passed") as DemoKind)), "error", 300, { stopReason: "模型调用超时（示例）" }, demoModels, snapV1),
    // ER-0002 手动停止。
    demoRun(plan(Array.from({ length: Math.max(1, Math.floor(total * 0.5)) }, () => "passed" as DemoKind)), "cancelled", 240, {}, demoModels, snapV1),
    // ER-0003 全量完成，多条不通过 + 无法判定，演示问题清单聚合。
    demoRun(plan(Array.from({ length: total }, (_, index) => ((index === 1 || index === 3) ? "failed" : index === 5 ? "unknown" : "passed") as DemoKind)), "completed", 180, {}, demoModels, snapV2),
    // ER-0004 部分执行已完成（70%），参与对比。
    demoRun(plan(Array.from({ length: Math.max(1, Math.floor(total * 0.7)) }, (_, index) => (index === 0 ? "failed" : index === Math.max(1, Math.floor(total * 0.7)) - 1 ? "unknown" : "passed") as DemoKind)), "completed", 130, {}, demoModels, snapV2),
    // ER-0005 全量完成，两条不通过。
    demoRun(plan(Array.from({ length: total }, (_, index) => (index === 2 || index === 4 ? "failed" : "passed") as DemoKind)), "completed", 65, {}, demoModels, snapV3),
    // ER-0006 最新：全量完成，多条不通过 + 无法判定。
    demoRun(plan(Array.from({ length: total }, (_, index) => ((index === 1 || index === 3) ? "failed" : index === 5 ? "unknown" : "passed") as DemoKind)), "completed", 5, {}, demoModels, snapV3),
  ]
  const sequence = Math.max(state.reportSequences?.[key] || 0, ...(previous[key] || []).map(run => Number(run.code?.slice(3)) || 0))
  const ordered = [...demoRuns].sort((a, b) => a.started - b.started)
  ordered.forEach((run, index) => { run.code = `ER-${String(sequence + index + 1).padStart(4, "0")}` })
  const before = useEvaluation.getState()
  useEvaluation.setState(s => ({
    caseCodes: { ...s.caseCodes, [key]: registry },
    reportSequences: { ...s.reportSequences, [key]: sequence + ordered.length },
    runs: { ...s.runs, [key]: [...ordered.reverse(), ...(s.runs[key] || [])] },
    caseSets: { ...s.caseSets, [key]: { ...(s.caseSets?.[key] ?? { version: latestSnapshotVersion(key, s) }), version: Math.max(s.caseSets?.[key]?.version ?? 0, prevMax + 3), executed: true, baseline: structuredClone(cases) } },
  }))
  if (!storageWriteSucceeded) {
    useEvaluation.setState({ runs: before.runs, caseCodes: before.caseCodes, reportSequences: before.reportSequences, caseSets: before.caseSets, error: true })
    return false
  }
  useEvaluation.setState({ error: false })
  return true
}

// Demo execution is clock-driven so leaving the panel does not lose a run.
// A browser reload preserves the run and completes the remaining simulated steps.
export function advanceRuns() {  // 模拟执行器已停止确认；真实接入须等待确认，不得按定时器推定。
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
          let completion = item.demo && item.outcome === "blocked" ? beginning + 2400 : offset + (item.demoJudgingDelayMs ?? 100)
          if (elapsed < beginning) { completedAt = Math.max(completedAt, run.started + completion); return item }
          const timing = item.timing ? { started: item.timing.started ?? run.started + beginning, ended: elapsed >= completion ? item.timing.ended ?? run.started + completion : undefined } : undefined
          if (timing?.started !== item.timing?.started || timing?.ended !== item.timing?.ended) changed = true
          if (item.demo && item.outcome === "blocked" && elapsed >= beginning + 2400) {
            completedAt = Math.max(completedAt, run.started + completion)
            const issue = item.demoFailure || "tool_unavailable"
            const detail = executionIssues[issue]
            const evidence = `${detail.stage}：${detail.reason}。${detail.action}`
            if (item.status !== "blocked") changed = true
            return { ...item, timing, judging: false, status: "blocked", execution: "error", verdict: [...(item.checkResults || []), ...(rounds || []).flatMap(t => t.checkResults || [])].some(c => c.verdict === "failed") ? "failed" : "unknown", response: "", evidence, tool: "",
              checkResults: completeStoppedChecks(item.checks || [], item.checkResults, evidence),
              roundResults: rounds?.map((turn, index) => ({ ...turn, points: { execution: index ? 0 : 0.18, judging: 0 }, status: index ? "skipped" : "blocked", issue: index ? undefined : issue,
                responseRecorded: false, response: "", tool: "", clarification: !index && issue === "clarification_unmatched" ? "实际追问：请确认查询所用的核算组织\n未找到匹配的自动回复" : "",
                evidence: index ? "前序轮次执行异常，本轮未执行" : evidence, checkResults: completeStoppedChecks(executedChecksOf(turn), turn.checkResults, index ? "前序轮次执行异常，本轮未执行，缺少所需证据，无法判定。" : evidence) })) }
          }
          let status: EvalResult["status"] = elapsed < offset ? "running" : item.outcome
          let hardFailedAt = -1
          const roundResults = rounds?.map((turn, index): EvalTurnResult => {
            if (hardFailedAt >= 0) {
              if (turn.status === "skipped") return turn
              changed = true
              return { ...turn, status: "skipped", response: "", responseRecorded: false, clarification: "", tool: undefined, toolResult: undefined, points: item.demo ? { execution: 0, judging: 0 } : undefined,
                evidence: "前序轮次硬规则不通过，本轮未执行。", checkResults: skippedChecks(executedChecksOf(turn), "前序轮次硬规则不通过，本轮未执行。") }
            }
            const turnStatus = elapsed < beginning + index * 2400 ? "pending" : elapsed < beginning + (index + 1) * 2400 ? "running" : item.outcome
            if (turnStatus === turn.status) {
              if (run.hardRuleStop && hasHardFailure(turn.checkResults || [])) hardFailedAt = index
              return turn
            }
            changed = true
            const finished = !["running", "pending"].includes(turnStatus)
            const trace = item.demo ? item.demoEvidence?.turns[index] : undefined
            const evaluated = finished ? evaluateChecks(executedChecksOf(turn, index && turn.inherit ? rounds?.[0].expected : undefined), item, run.started + beginning + (index + 1) * 2400, trace, false, !!run.hardRuleStop) : undefined
            if (run.hardRuleStop && hasHardFailure(evaluated || [])) hardFailedAt = index
            return { ...turn, status: hardFailedAt === index ? "failed" : turnStatus,
              points: item.demo ? { execution: finished ? Number((0.36 + turn.rules.length * 0.12 + index * 0.04).toFixed(2)) : 0.12, judging: finished ? (evaluated || []).filter(c => checkKind(c) === "natural" && c.verdict !== "skipped").length * 0.08 : 0 } : undefined,
              tool: finished ? trace?.tool : undefined,
              toolResult: finished ? trace?.toolResult : undefined,
              checkResults: evaluated,
              responseRecorded: finished && !!trace,
              response: finished ? trace?.response ?? "" : "",
              evidence: finished ? trace?.toolResult || "未取得可核验的执行证据。" : "",
              clarification: finished ? trace?.clarification || mockClarificationOf(turn) : "" }
          })
          if (hardFailedAt >= 0) {
            offset = beginning + (hardFailedAt + 1) * 2400
            completion = offset
            status = "failed"
            if (timing) timing.ended = run.started + completion
          }
          completedAt = Math.max(completedAt, run.started + completion)
          if (status !== item.status) changed = true
          const judging = hardFailedAt < 0 && status !== "running" && elapsed < offset + (item.demoJudgingDelayMs ?? 100)
          if (judging !== !!item.judging) changed = true
          const finalTrace = item.demo ? item.demoEvidence?.turns[hardFailedAt >= 0 ? hardFailedAt : count - 1] : undefined
          const checkResults = hardFailedAt >= 0 ? skippedChecks(item.checks || [], "本轮硬规则不通过，当前用例结束，整体判定跳过。") : status === "running" || judging ? undefined : item.checks?.length ? evaluateChecks(item.checks, item, run.started + offset, finalTrace, true, !!run.hardRuleStop) : []
          const allChecks = [...(checkResults || []), ...(roundResults || []).flatMap(t => t.checkResults || [])]
          return { ...item, timing, roundResults, status, checkResults, judging,
            overallJudgingPoints: item.demo ? status === "running" ? 0 : (checkResults || []).filter(c => checkKind(c) === "natural" && c.verdict !== "skipped").length * 0.08 : undefined,
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
  if (!checks.some(c => c.verdict !== "na") || checks.some(c => c.verdict === "unknown" || c.verdict === "skipped")) return "unknown"
  return "passed"
}
export function skippedChecks(checks: EvalCheck[], reason: string): CheckResult[] {
  return checks.map(c => ({ ...c, verdict: "skipped", actual: "未执行", evidence: reason }))
}
export function hasHardFailure(checks: CheckResult[]) {
  return checks.some(c => checkKind(c) !== "natural" && c.verdict === "failed")
}
export function evaluateChecks(checks: EvalCheck[], item: EvalCase, checkedAt: number, trace?: DemoTurnEvidence, overall = false, hardFirst = true): CheckResult[] {
  if (hardFirst) {
    const hard = evaluateChecks(checks.filter(c => checkKind(c) !== "natural"), item, checkedAt, trace, overall, false)
    const semantic = checks.filter(c => checkKind(c) === "natural")
    const results = [...hard, ...(hasHardFailure(hard) ? skippedChecks(semantic, "同一范围的硬规则不通过，跳过语义判定。") : evaluateChecks(semantic, item, checkedAt, trace, overall, false))]
    return checks.map(c => results.find(r => r.id === c.id)!)
  }
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

export const evaluationCheckPolicy = `硬规则优先：本轮关键词、正则、文件存在性均检查；任一明确不通过，跳过本轮语义判定、后续业务轮次和整体判定，结束当前用例为不通过，其他用例继续。语义不通过不阻止后续轮次；硬规则无法判定不等同明确失败。整体标准同样先检查硬规则。
语义判断：轮次标准读取截至本轮的实际输入、澄清、工具返回及最终回复，不读取后续轮次；整体标准只在业务正常完成后发起，读取完整的实际执行记录；执行异常或用户停止后不发起新的整体判定，已有结论保留，其余为无法判定。仅条件明确未发生时可判不适用，条件证据缺失时无法判定；全部不适用不算通过。附件仅在内容已解析并留存时可作为证据，MVP 不自动读取产物内容。
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
    for (const [si, scene] of scenesOf(turn).entries()) {
      if (!scene.match.trim()) return `第 ${i + 1} 轮场景${clarifySceneNames[si] || si + 1}的澄清选择不能为空。`
    }
    if (isClarifyTurn(turn) && !scenesOf(turn).length) return `第 ${i + 1} 轮期望澄清，请至少添加一个澄清场景。`
  }
  const checks = [...(value.checks || []), ...turns.flatMap(t => isClarifyTurn(t) ? clarifyChecksOf(t) : checksOf(t))]
  if (!checks.length) return "请至少添加一条评测标准。"
  return checks.map(checkValidation).find(Boolean) || ""
}

export function clarificationResponses(responses: string[]): string {
  return responses.length > 1 ? responses.map((answer, i) => `问题 ${i + 1}：${answer}`).join("\n") : responses[0] || ""
}

const briefClip = (text: string, limit: number) => {
  const value = text.replace(/\s+/g, " ").trim()
  return value.length > limit ? `${value.slice(0, limit)}…` : value
}

/** 案例精要：对案例内容的一句话精要总结（业务做什么 + 期望结果 + 澄清要点），保存用例时写入；原型由前端按内容模拟 AI 生成。 */
export function caseBriefOf(c: EvalCase): string {
  const turns = turnsOf(c)
  const scenario = briefClip(c.input || turns[0]?.input || "", 26).replace(/[。；.]+$/, "")
  const goal = briefClip(c.expected || turns[0]?.expected || "", 34).replace(/[。；.]+$/, "")
  const clarify = turns.some(turn => isClarifyTurn(turn) && scenesOf(turn).some(scene => scene.match.trim()))
  const parts = [scenario, goal].filter(Boolean)
  return parts.length ? `${parts.join("：")}${clarify ? "（含澄清场景）" : ""}。` : "案例内容待补充。"
}
