import { db } from "@/mock/db"
import type { Message } from "@/mock/types"
import type { PromptDraft } from "@/features/prompt-input/PromptInput"
import { createEditSession } from "@/features/dev-page/use-edit-session"
import { usePrompt } from "@/stores/prompt"
import { formatEvaluationTime as runTitle } from "./format-time"
import { EvaluationSplitter, useEvaluationSplit } from "./EvaluationSplitter"
import { sessionService } from "@/services/session"
import { saveEvaluationConversation, useEvaluationConversations } from "@/services/evaluation-conversations"
import { SessionToggleButton } from "@/features/side-panel/SessionToggleButton"
import { DatePicker } from "@/ui/date-picker/DatePicker"
import { basicEvaluationSample, completeEvaluationSample } from "@/services/evaluation-samples"
import { runPoints, pointsText, resumeRunPoints, updateAutomaticPoints } from "@/services/evaluation-points"
import { devStore } from "@/mock/dev-store"
import { evaluationRepairObject, repairDisabledReason, repairPrompt, registerEvaluationRepair, findRepairSession, useEvaluationRepairs } from "@/services/evaluation-repair"
import { EvaluationSelect } from "./EvaluationSelect"
import { RunEvaluationDialog } from "./RunEvaluationDialog"
import { ImportCases } from "./ImportCases"
import { exportTemplateWorkbook } from "@/services/evaluation-export"
import { resolveRerunModels, defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, type EvalModelIds, type EvalRunModels } from "@/services/evaluation-models"
import { useBlocker, useSearchParams, useNavigate, createSearchParams, type SetURLSearchParams } from "react-router"
import { EvaluationChat } from "./EvaluationChat"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useSync } from "@/stores/sync"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"

import { EvaluationDuration, useEvaluationClock } from "./EvaluationDuration"
import { caseDuration, caseDurationNote, runDuration, runDurationNote } from "@/services/evaluation-duration"
import { ReportDetail } from "./ReportDetail"
import { buildReportDocument } from "./report-document"
import { ComparisonPicker } from "./ComparisonPicker"
import { ReportDelta } from "./ReportDelta"
import { useEvaluationComparison } from "@/stores/evaluation-comparison"
import { completedRuns, isCompletedRun, normalizeBaseline, runLabelText, runPassRate, runStats } from "@/services/evaluation-comparison"
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { Empty, SegmentedControl, BrandButton, Button, ConfirmDialog, Tooltip, Icon, useDialog } from "@/ui"
import { useT } from "@/i18n"
import {
  caseBriefOf,
  caseContentKey,
  turnsOf,
  runCases, snapshotRunCases, caseVersionLabel,
  unsuccessfulRunResults,
  currentEvaluationEnvironment,
  environmentLabel,
  type EvalEnvironment,
  executionLabel,
  verdictLabel,
  resultIssueSummary,
  useEvaluation,
  saveCases,
  startRun,
  requestCancelRun,
  cancelRun,
  fillDemoReports,
  isActiveRun,
  finishedCaseCount,
  type EvalCase,
  type EvalRun,
  type Source,
  type Outcome,
} from "@/services/evaluation"
import "./evaluation.css"

export function EvaluationLabel() {
  const t = useT()
  return (
    <span>
      {t("proto.eval.title")}
      <span className="eval-beta">Beta</span>
    </span>
  )
}
/** 导出文件名使用无非法字符的时间编码。 */
function runFileTime(time: number) {
  const value = new Date(time)
  const pad = (part: number, width = 2) => String(part).padStart(width, "0")
  return `${pad(value.getFullYear(), 4)}${pad(value.getMonth() + 1)}${pad(value.getDate())}-${pad(value.getHours())}${pad(value.getMinutes())}${pad(value.getSeconds())}-${pad(value.getMilliseconds(), 3)}`
}
const evaluationDrafts = new Map<string, PromptDraft>()
const sources: Source[] = ["none", "tenant", "thirdParty", "personal"]
export function EvaluationPanel({ objectId, name, heading, onEnvironmentChange, embedded }: { embedded?: { initialRunId?: string; repairSessionId?: string }; objectId: string; name: string; heading?: ReactNode; onEnvironmentChange?: (environment: EvalEnvironment | undefined) => void }) {
  const split = useEvaluationSplit()
  const chatDrafts = useRef(evaluationDrafts)
  const navigate = useNavigate()
  const [openingRepair, setOpeningRepair] = useState(false)
  const repairOpening = useRef(false)
  useEvaluationRepairs(s => s.items) // 关联新修复会话后，列表与详情同步更新入口文案。
  async function repair(run: EvalRun) {
    const target = evaluationRepairObject(objectId)
    if (!target || repairOpening.current || repairDisabledReason(objectId, run, true)) return
    repairOpening.current = true
    setOpeningRepair(true)
    try {
      const draft = repairPrompt(objectId, run)
      const existing = findRepairSession(objectId, run)
      if (embedded?.repairSessionId && existing?.session.id === embedded.repairSessionId) {
        if (useSync.getState().sessions.find(s => s.id === existing.session.id)?.status === "running") { setNotice("请先完成或停止当前修复分析。"); return }
        if (existing.target?.runId !== run.id) {
          registerEvaluationRepair(existing.session, draft, { objectType: target.objectType, objectId: target.objectId, runId: run.id })
          sessionService.prompt(existing.session.id, draft, useSync.getState().apply, usePrompt.getState().modelId)
        } else {
          document.querySelector<HTMLElement>('[data-component="prompt-input"][role="textbox"]')?.focus()
        }
        return
      }
      if (existing && useSync.getState().sessions.find(s => s.id === existing.session.id)?.status === "running" && existing.target?.runId !== run.id) { setNotice("修复会话仍在处理上一轮，请先完成或停止后继续。"); return }
      const session = existing?.session || await createEditSession({ title: `修复 ${name}`, draft: "", projectId: target.projectId, target: target.editTarget, requireProject: true })
      if (!session) { setNotice("对象所属项目不可用，无法打开开发对话"); return }
      const needsAnalysis = !existing || existing.target?.runId !== run.id
      registerEvaluationRepair(session, draft, { objectType: target.objectType, objectId: target.objectId, runId: run.id })
      useSync.getState().apply({ type: "session.updated", session })
      if (!existing) useSync.setState(s => ({ messages: { ...s.messages, [session.id]: [] } }))
      const back = new URLSearchParams({ view: "report", run: run.id })
      if (conversationId) back.set("conversation", conversationId)
      const returnTo = `/dev/${target.objectType}/${encodeURIComponent(target.objectId)}/evaluation?${back}`
      const query = new URLSearchParams({ [target.objectType === "skill" ? "kdskill" : "agent"]: target.objectId, returnTo })
      navigate(`/p/${session.projectId}/session/${session.id}?${query}`)
      if (needsAnalysis) sessionService.prompt(session.id, draft, useSync.getState().apply, usePrompt.getState().modelId)
    } catch (error) { setNotice(error instanceof Error ? error.message : "打开开发对话失败，请重试") }
    finally { repairOpening.current = false; setOpeningRepair(false) }
  }
  const startingRun = useRef(false)
  const t = useT()
  const state = useEvaluation()
  const dialog = useDialog()
  const currentCases = state.cases[objectId] || []
  const runs = state.runs[objectId] || []
  const [routeParams, setRouteParams] = useSearchParams()
  const [localParams, setLocalParams] = useState(() => new URLSearchParams(embedded?.initialRunId ? { run: embedded.initialRunId, view: "report" } : { tab: "reports" }))
  const searchParams = embedded ? localParams : routeParams
  const setSearchParams: SetURLSearchParams = embedded ? (next) => setLocalParams(previous => createSearchParams(typeof next === "function" ? next(previous) : next)) : setRouteParams
  const versionId = searchParams.get("caseRun") || searchParams.get("version")
  const historicalRun = runs.find(r => r.id === versionId)
  const historical = !!versionId
  const cases = historicalRun ? runCases(historicalRun) : historical ? [] : currentCases
  const [chatPreference, setChatPreference] = useState<boolean>()
  const requestedConversationId = searchParams.get("conversation") || undefined
  const conversations = useEvaluationConversations(s => s.items)
  const restoredConversation = Object.values(conversations).filter(c => c.objectId === objectId).sort((a, b) => (b.lastVisited || b.session.time.updated) - (a.lastVisited || a.session.time.updated))[0]
  const conversationRecord = requestedConversationId ? conversations[requestedConversationId] : restoredConversation
  const conversationId = conversationRecord?.objectId === objectId ? conversationRecord.session.id : undefined
  useEffect(() => {
    if (!conversationId || embedded) return
    const record = useEvaluationConversations.getState().items[conversationId]
    if (record) useEvaluationConversations.getState().put({ ...record, lastVisited: Date.now() })
    if (!requestedConversationId) setConversation(conversationId)
  }, [conversationId])
  async function newConversation() {
    if (unsaved) { setNotice("请先保存或取消右侧编辑。"); return }
    const target = evaluationRepairObject(objectId)
    if (!target) return
    const session = await sessionService.create(target.projectId, `评测 ${name}`)
    saveEvaluationConversation({ session, objectId, objectName: name, messages: [], request: "", rule: "", files: [], drafts: [], adopted: {}, lastVisited: Date.now() })
    useSync.getState().apply({ type: "session.updated", session })
    setConversation(session.id)
    setNotice("已开启新评测会话，原会话草稿、用例和报告均已保留。", true)
  }
  function setConversation(id?: string) {
    if (id && !conversationId) {
      const initial = chatDrafts.current.get(`${objectId}:initial`)
      if (initial) chatDrafts.current.set(`${objectId}:${id}`, initial)
    }
    setSearchParams(previous => { const next = new URLSearchParams(previous); if (id) next.set("conversation", id); else next.delete("conversation"); return next }, { replace: true })
  }
  const baseline = useMemo(() => {
    const map = new Map<string, EvalCase>()
    for (const run of runs) for (const c of runCases(run)) if (!map.has(c.id)) map.set(c.id, c)
    return map
  }, [runs])
  const runId = searchParams.get("run") || undefined
  const resultId = searchParams.get("case") || undefined
  const reportRequested = searchParams.get("view") === "report"
  const section = historical || runId || resultId || reportRequested || ["runs", "reports"].includes(searchParams.get("tab") || "") ? "runs" : "cases"
  useEffect(() => {
    if (!conversationId || embedded) return
    const record = useEvaluationConversations.getState().items[conversationId]
    const query = searchParams.toString()
    if (record && record.lastView !== query) useEvaluationConversations.getState().put({ ...record, lastView: query })
  }, [conversationId, searchParams.toString()])
  const draftKey = `${objectId}:${conversationId || "initial"}`
  if (!chatDrafts.current.has(draftKey)) chatDrafts.current.set(draftKey, {})
  const chatOpen = !embedded && (chatPreference ?? true)
  function openView(view: { section: "cases" | "runs" | "reports"; runId?: string; resultId?: string; report?: boolean; conversationId?: string }) {
    const next = new URLSearchParams(searchParams)
    for (const key of ["tab", "run", "case", "view", "focusCase", "version", "scopeRun", "caseRun", "caseFrom"]) next.delete(key)
    if (view.conversationId) next.set("conversation", view.conversationId)
    if (view.section !== "cases") next.set("tab", view.section)
    if (view.runId) {
      next.set("run", view.runId)
      if (view.report) next.set("view", "report")
      else if (view.resultId) next.set("case", view.resultId)
    }
    setSearchParams(next)
  }
  const [runPage, setRunPage] = useState(1)
  const [runRangePreset, setRunRangePreset] = useState("all")
  const [runStatusFilter, setRunStatusFilter] = useState("all")
  const runStatusGroups: Record<string, readonly EvalRun["status"][]> = {
    active: ["running", "judging", "stopping"],
    completed: ["completed"],
    cancelled: ["cancelled"],
    abnormal: ["error", "stop_unconfirmed"],
  }
  function applyRunRange(preset: string) {
    setRunRangePreset(preset)
    setRunPage(1)
    if (preset === "custom") return
    if (preset === "all") { setRunStartDate(""); setRunEndDate(""); return }
    const end = new Date()
    end.setHours(0, 0, 0, 0)
    if (preset === "yesterday") end.setDate(end.getDate() - 1)
    const start = new Date(end)
    if (preset === "7" || preset === "30") start.setDate(start.getDate() - Number(preset) + 1)
    const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    setRunStartDate(localDate(start)); setRunEndDate(localDate(end))
  }
  const [runStartDate, setRunStartDate] = useState("")
  const [runEndDate, setRunEndDate] = useState("")
  const invalidRunRange = !!runStartDate && !!runEndDate && runStartDate > runEndDate
  const startTime = runStartDate ? new Date(`${runStartDate}T00:00:00`).getTime() : -Infinity
  const endTime = runEndDate ? (() => { const end = new Date(`${runEndDate}T00:00:00`); end.setDate(end.getDate() + 1); return end.getTime() })() : Infinity
  const filteredRuns = invalidRunRange ? [] : runs.filter(run => run.started >= startTime && run.started < endTime && (runStatusFilter === "all" || runStatusGroups[runStatusFilter]?.includes(run.status)))
  // 执行中的报告始终置顶，其余按时间倒序（runs 本身已按时间倒序，保持稳定排序）。
  const orderedRuns = [...filteredRuns].sort((a, b) => Number(isActiveRun(b)) - Number(isActiveRun(a)))
  const runPageSize = 10
  const runPageCount = Math.max(1, Math.ceil(orderedRuns.length / runPageSize))
  const currentRunPage = Math.min(runPage, runPageCount)
  const visibleRuns = orderedRuns.slice((currentRunPage - 1) * runPageSize, currentRunPage * runPageSize)
  // 报告对比范围（多选）与基线（唯一，随所选范围自动迁移）。
  const cmpSelection = useEvaluationComparison(s => s.selections[objectId] ?? null)
  const storedBaselineId = useEvaluationComparison(s => s.baselines[objectId])
  const setCmpSelection = useEvaluationComparison(s => s.setSelection)
  const setCmpBaseline = useEvaluationComparison(s => s.setBaseline)
  const completedList = useMemo(() => completedRuns(runs), [runs])
  const comparisonPool = completedList.filter(run => !cmpSelection || cmpSelection.includes(run.id))
  const baselineId = normalizeBaseline(comparisonPool, storedBaselineId)
  const baselineRun = comparisonPool.find(run => run.id === baselineId)
  useEffect(() => {
    if (storedBaselineId !== baselineId) setCmpBaseline(objectId, baselineId)
  }, [baselineId, storedBaselineId, objectId, setCmpBaseline])
  const [caseSearch, setCaseSearch] = useState("")
  const [casePage, setCasePage] = useState(1)
  const caseSetInfo = useEvaluation(s => s.caseSets?.[objectId])
  // 用例执行状态以运行结果为准；修改状态与最近一次含该用例的运行快照逐字段比较。
  // 案例集版本与整体执行状态（对齐设计稿 CASE_SET）：修改/新增案例时版本 +1 且标记未执行，
  // 此时展示新增/已修改标识；执行过案例集中的任意一条后恢复已执行，标识随之消失。
  const latestSnapshot = runs.find(run => run.caseSnapshot)?.caseSnapshot
  const setExecuted = caseSetInfo ? caseSetInfo.executed : !!latestSnapshot && caseContentKey(latestSnapshot.cases) === caseContentKey(cases)
  const setVersion = caseSetInfo?.version ?? (latestSnapshot ? Number(latestSnapshot.version.slice(1)) || 1 : 1)
  const caseChangeState = (c: EvalCase) => {
    if (setExecuted) return "unchanged"
    const previous = caseSetInfo?.baseline?.find(item => item.id === c.id) ?? baseline.get(c.id)
    return !previous ? "new" : JSON.stringify(previous) !== JSON.stringify(c) ? "modified" : "unchanged"
  }
  const [caseFilter, setCaseFilter] = useState("all")
  const caseFilters: [string, string, (c: EvalCase) => boolean][] = [
    ["all", "全部", () => true],
    ["new", "新增", c => caseChangeState(c) === "new"],
    ["modified", "已修改", c => caseChangeState(c) === "modified"],
  ]
  const caseFilterMatch = (c: EvalCase) => (caseFilters.find(([value]) => value === caseFilter) || caseFilters[0])[2](c)
  const casePageSize = 10
  const filteredCases = cases.filter(c => caseFilterMatch(c) && `${c.code || ""} ${c.name}`.toLocaleLowerCase().includes(caseSearch.trim().toLocaleLowerCase()))
  const casePageCount = Math.max(1, Math.ceil(filteredCases.length / casePageSize))
  const currentCasePage = Math.min(casePage, casePageCount)
  const visibleCases = filteredCases.slice((currentCasePage - 1) * casePageSize, currentCasePage * casePageSize)
  const [selected, setSelected] = useState<string[]>([])
  const [runSetup, setRunSetup] = useState<{ cases: EvalCase[]; scope: string; original?: EvalRun; initial: EvalModelIds; defaults: EvalModelIds; missingCount: number; conversationSessionId?: string }>()
  const [expandedCases, setExpandedCases] = useState<string[]>([])
  const [importOpen, setImportOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const draft = state.drafts[objectId]
  const setDraft = (value: EvalCase | undefined) => {
    setEditorOpen(!!value)
    useEvaluation.setState((s) => ({ drafts: { ...s.drafts, [objectId]: value } }))
  }
  const [notice, updateNotice] = useState({ text: "", transient: false })
  function setNotice(text: string, transient = false) { updateNotice({ text, transient }) }
  function hasSelectedText(element: HTMLElement) {
    const selection = window.getSelection()
    return !!selection && !selection.isCollapsed && !!selection.toString()
      && (element.contains(selection.anchorNode) || element.contains(selection.focusNode))
  }
  /** 用例编号置于名称前，变更标记置于名称后；不再展示轮次描述。 */
  function caseCode(c: EvalCase) {
    return c.code ? <span className="eval-case-code">{c.code}</span> : null
  }
  function caseChangedFlag(changed: string) {
    if (!changed || changed === "unchanged") return null
    return <span className="eval-case-flag" data-kind={changed === "new" ? "new" : "mod"}>{changed === "new" ? "新增" : "已修改"}</span>
  }
  /** 案例精要：列表逐条速览，AI 按用例内容生成的总结（原型由前端模拟）。 */
  function caseSummary(c: EvalCase) {
    return <span className="eval-case-sum"><span className="eval-sum-label">案例精要</span><span>{caseBriefOf(c)}</span></span>
  }
  useEffect(() => {
    if (!notice.text || !notice.transient) return
    const timer = setTimeout(() => updateNotice({ text: "", transient: false }), 3000)
    return () => clearTimeout(timer)
  }, [notice])
  const current = runs.find((r) => r.id === runId)
  const focusCase = searchParams.get("focusCase")
  useEffect(() => {
    for (const run of useEvaluation.getState().runs[objectId] || []) resumeRunPoints(objectId, run.id)
    void updateAutomaticPoints()
  }, [objectId, runId])
  const report = !!current
  const durationNow = useEvaluationClock(section === "runs" && (current ? isActiveRun(current) : visibleRuns.some(isActiveRun)))
  useEffect(() => { onEnvironmentChange?.(section === "runs" && current ? current.environment : currentEvaluationEnvironment) }, [section, current?.id, current?.environment, onEnvironmentChange])
  const result = current?.results.find((c) => c.id === resultId)
  const locationError = historical && !historicalRun ? "该次评测记录不存在，请通过“评测报告”页签重新选择。" : !runId && (resultId || reportRequested) ? "详情链接缺少运行编号，请通过“评测报告”页签查看运行记录。"
    : runId && !current ? "指定运行记录不存在或已不可访问，请通过“评测报告”页签查看运行记录。"
    : resultId && !result ? "本次运行中不存在指定用例结果，请通过“评测报告”页签重新选择报告。"
    : ""
  const selectedCases = cases.filter((c) => selected.includes(c.id))
  const selectedOutsideSearch = selectedCases.filter(c => !filteredCases.some(item => item.id === c.id)).length
  const selectionDetails = selectedOutsideSearch ? `搜索结果外 ${selectedOutsideSearch} 条` : ""
  const savedDraft = draft ? cases.find((c) => c.id === draft.id) : undefined
  const draftChanged = !!draft && (savedDraft ? JSON.stringify(draft) !== JSON.stringify(savedDraft) : !!(draft.checks?.length || draft.name.trim() || turnsOf(draft).some(t => t.input.trim() || t.checks?.length || t.expected.trim() || t.attachments.length || t.rules.length) || draft.attachments?.length))
  const unsaved = (editorOpen && draftChanged) || importOpen
  const blocker = useBlocker(unsaved)
  const activeRun = runs.find(isActiveRun)
  const busy = !!activeRun
  const tr = (key: string) => t(`proto.eval.${key}`)
  useEffect(() => {
    if (!unsaved) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [unsaved])
  function configureRun(list: EvalCase[], scope: string, original?: EvalRun, missingCount = 0, conversationSessionId?: string) {
    if (!list.length || busy) return
    const defaults = { execution: evaluationExecutionDefault(useSync.getState().models), judging: defaultJudgingModelId(useSync.getState().models) }
    const setup = { cases: structuredClone(list), scope, original, defaults, missingCount, conversationSessionId, initial: initialEvaluationModelIds(defaults, undefined, original) }
    setRunSetup(setup)
  }
  async function begin(models: EvalRunModels, setup = runSetup) {
    if (!setup || startingRun.current) return
    startingRun.current = true
    try {
    if (useEvaluation.getState().runs[objectId]?.some(isActiveRun)) throw new Error(tr("models.busy"))
    if (setup.original) {
      const locked = resolveRerunModels(setup.original.models, useSync.getState().models)
      if (!locked) throw new Error("来源报告模型未记录或已不可用，请从当前用例新建运行")
      models = locked
    }
    const saved = useEvaluation.getState().cases[objectId] || []
    const list = setup.original ? setup.cases : setup.cases.map(item => saved.find(c => c.id === item.id))
    if (list.some(item => !item)) throw new Error(tr("models.casesChanged"))
    const target = evaluationRepairObject(objectId)
    if (!target) throw new Error("评测对象不可用")
    if (embedded) {
      const id = startRun(objectId, name, list as EvalCase[], currentEvaluationEnvironment, models, setup.original?.id)
      if (!id) throw new Error("评测启动失败，请重试。")
      setRunSetup(undefined)
      openView({ section: "runs", runId: id, report: true })
      return
    }
    const candidate = useEvaluationConversations.getState().items[setup.conversationSessionId || conversationId || ""]
    const existing = candidate?.objectId === objectId ? candidate : undefined
    const session = existing?.session || await sessionService.create(target.projectId, `评测 ${name}`)
    const conversation = existing || { session, objectId, objectName: name, messages: [], request: "", rule: "", files: [], drafts: [], adopted: {} }
    const scopeText = setup.original ? `报告 ${setup.original.code || setup.original.id} 保存的${tr(`models.${setup.scope}`)}` : tr(`models.${setup.scope}`)
    const message = (role: Message["role"], text: string): Message => ({ id: crypto.randomUUID(), sessionId: session.id, role, time: { created: Date.now(), completed: Date.now() }, parts: [{ id: crypto.randomUUID(), type: "text", text }] })
    // 确认后留存操作记录，不替用户伪造聊天指令。
    const userMessage = message("assistant", `已确认运行：${scopeText}，共 ${list.length} 条。`)
    const next = { ...conversation, messages: [...(useSync.getState().messages[session.id] || conversation.messages), userMessage] }
    const publish = () => {
      saveEvaluationConversation(next)
      for (const item of next.messages) if (!db.messages.some(m => m.id === item.id)) db.messages.push(structuredClone(item))
      useSync.getState().apply({ type: "session.updated", session })
      useSync.setState(s => ({ messages: { ...s.messages, [session.id]: next.messages } }))
    }
    publish()
    setChatPreference(true)
    setConversation(session.id)
    const id = startRun(objectId, name, list as EvalCase[], currentEvaluationEnvironment, models, setup.original?.id, session.id)
    if (!id) {
      next.messages = [...next.messages, message("assistant", "本次评测未能启动，请检查运行条件后重试。")]
      publish()
      throw new Error(tr(useEvaluation.getState().error ? "models.storageFailed" : "models.startFailed"))
    }
    const run = useEvaluation.getState().runs[objectId]?.find(r => r.id === id)
    next.runId = undefined
    next.reportContext = [id]
    next.messages = [...next.messages, message("assistant", `已开始评测，共 ${list.length} 条用例，报告 ${run?.code || id}。可在右侧查看运行进度和评测结果。`)]
    publish()
    setRunSetup(undefined)
    setRunPage(1)
    openView({ section: "runs", runId: id, conversationId: session.id })
    } finally { startingRun.current = false }
  }
  function rerun(run: EvalRun, ids = run.results.map(c => c.id), scope = "rerunAll", conversationSessionId?: string) {
    if (!ids.length || busy) return
    configureRun(snapshotRunCases(run, ids), scope, run, 0, conversationSessionId)
  }
  useEffect(() => {
    if (searchParams.get("action") !== "retest" || !current) return
    const next = new URLSearchParams(searchParams); next.delete("action"); setSearchParams(next, { replace: true })
    const ids = unsuccessfulRunResults(current).map(c => c.id)
    rerun(current, ids.length ? ids : current.results.map(c => c.id), ids.length ? "unsuccessful" : "rerunAll")
  }, [current?.id, searchParams.get("action")])
  function removeCases(ids: string[]) {
    dialog.show(() => <ConfirmDialog title={ids.length > 1 ? `删除所选 ${ids.length} 条用例？` : "删除这条用例？"}
      description="删除后无法恢复，已有运行记录和报告保留" cancelText="取消" confirmText="删除" variant="danger"
      onConfirm={() => {
        if (!saveCases(objectId, (useEvaluation.getState().cases[objectId] || []).filter(item => !ids.includes(item.id)))) { setNotice("删除失败，请重试"); return }
        setSelected(current => current.filter(id => !ids.includes(id)))
        setNotice(`已删除 ${ids.length} 条用例`, true)
      }} />)
  }
  function samples() {
    const next: EvalCase[] = (["passed", "failed", "blocked"] as Outcome[]).map((outcome, index) => basicEvaluationSample({
      name: tr(`sample.${outcome}`),
      input: t(`proto.eval.input.${outcome}`, { name }),
      expected: tr(`expected.${outcome}`),
      source: sources[index + 1],
      outcome,
    }))
    const blocked = next.find(c => c.outcome === "blocked")!
    const failures = (["tool_unavailable", "timeout", "clarification_unmatched"] as const).map((demoFailure, index) => ({ ...structuredClone(blocked), id: crypto.randomUUID(), demoFailure, name: ["工具不可用", "执行超时", "澄清回复未匹配"][index] }))
    if (!saveCases(objectId, [...cases, completeEvaluationSample(name), ...next.filter(c => c.outcome !== "blocked"), { ...structuredClone(next[0]), id: crypto.randomUUID(), name: "判定服务超时（业务执行成功）", demoJudgingFailure: "timeout", demoJudgingDelayMs: 3000 }, ...failures])) {
      setNotice("添加示例用例失败：本地存储空间不足或被浏览器禁用，请清理后重试")
      return
    }
    setNotice("已添加 7 条示例用例", true)
  }
  const [exportingTemplate, setExportingTemplate] = useState(false)
  function newCase() {
    setDraft({ id: crypto.randomUUID(), name: "", input: "", expected: "", source: "none", outcome: "passed", turns: [{ id: crypto.randomUUID(), input: "", expected: "", attachments: [], rules: [] }], attachments: [], demo: false })
  }
  async function exportTemplate() {
    setExportingTemplate(true)
    try {
      const blob = await exportTemplateWorkbook()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `评测用例导入模板-${runFileTime(Date.now())}.xlsx`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setNotice("已下载导入模板；按“填写说明”工作表填好后，可通过「导入用例」批量导入", true)
    } catch { setNotice("导出模板失败，请重试") } finally { setExportingTemplate(false) }
  }
  function exportReport(run: EvalRun) {
    if (isActiveRun(run)) return
    const content = buildReportDocument(run, t)
    const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${run.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}-评测报告-${run.code || runFileTime(run.started)}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const caseSearchHint = !!caseSearch.trim() && !!cases.length && !selectedCases.length && !busy
    ? <p className="eval-muted">运行范围包含搜索结果之外的用例，共 {cases.length} 条。</p> : null
  const caseRows = filteredCases.length ? visibleCases.map((c) => historical ? (
    <details className="eval-history-case" key={`${historicalRun?.id}:${c.id}`}>
      <summary onClick={e => { if (e.detail > 0 && hasSelectedText(e.currentTarget)) e.preventDefault() }}>
        <Icon name="chevron-down-16" size="small" />
        <span className="eval-grow">{caseCode(c)}<span className="eval-title eval-case-name" title={c.name}>{c.name}</span>{caseSummary(c)}</span>
      </summary>
      <div className="eval-history-content"><CaseDetail value={c} embedded /></div>
    </details>
  ) : (
    <div className="eval-current-case" key={c.id}><div className="eval-row">
      {!historical && <label className="eval-check">
        <input
          type="checkbox"
          aria-label={`${tr("select")} ${c.name}`}
          checked={selected.includes(c.id)}
          onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))}
        />
      </label>}
      <div className="eval-grow">
        <button type="button" className="eval-list-name eval-title eval-case-toggle" aria-expanded={expandedCases.includes(c.id)} aria-controls={`case-content-${c.id}`} onClick={e => { if (e.detail > 0 && hasSelectedText(e.currentTarget)) return; setExpandedCases(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id]) }}><Icon name="chevron-down-16" size="small" />{caseCode(c)}<span className="eval-case-name" title={c.name}>{c.name}</span>{caseChangedFlag(caseChangeState(c))}</button>
        {caseSummary(c)}
      </div>
      {!historical && <><Button variant="ghost" onClick={() => setDraft(draft?.id === c.id ? draft : structuredClone(c))}>{tr("edit")}</Button>
      <Button variant="ghost" className="eval-danger-action" onClick={() => removeCases([c.id])}>{tr("delete")}</Button></>}
    </div>
    {expandedCases.includes(c.id) && <div id={`case-content-${c.id}`} className="eval-history-content"><CaseDetail value={c} embedded /></div>}
    </div>
  )) : (historical || !!cases.length) && <div className="eval-empty"><Empty description={cases.length ? "未找到匹配的用例" : "还没有评测用例"} /></div>
  const casePagination = !!filteredCases.length && <nav className="eval-pagination" aria-label="评测用例分页">
    <span className="eval-muted">共 {filteredCases.length} 条 · 每页 {casePageSize} 条</span>
    <div className="eval-actions">
      <Button variant="ghost" disabled={currentCasePage === 1} onClick={() => setCasePage(currentCasePage - 1)}>上一页</Button>
      <span aria-live="polite">{currentCasePage} / {casePageCount}</span>
      <Button variant="ghost" disabled={currentCasePage === casePageCount} onClick={() => setCasePage(currentCasePage + 1)}>下一页</Button>
    </div>
  </nav>
  const status = (value: string) => (
    <span className="eval-status" data-status={value}>
      {tr(value)}
    </span>
  )
  function requestRerun(run: EvalRun, unsuccessful = false) {
    if (busy) return
    rerun(run, (unsuccessful ? unsuccessfulRunResults(run) : run.results).map(c => c.id), unsuccessful ? "unsuccessful" : "rerunAll")
  }
  function repairAction(run: EvalRun, variant: "ghost" | "secondary" | "primary") {
    // 已完成报告的分析并修复入口始终展示；当前不可修复时禁用并在气泡中说明原因。
    const reason = repairDisabledReason(objectId, run, !!evaluationRepairObject(objectId))
    const label = findRepairSession(objectId, run) ? "继续修复" : "分析并修复"
    const tip = reason || (openingRepair ? "正在打开开发会话" : "先分析问题与修复方案，确认后修改原对象，再手动复测")
    const button = variant === "primary"
      ? <BrandButton variant="primary" className="eval-repair-action" disabled={!!reason || openingRepair} onClick={() => void repair(run)}>{label}</BrandButton>
      : <Button variant={variant} className="eval-repair-action" disabled={!!reason || openingRepair} onClick={() => void repair(run)}>{label}</Button>
    return <Tooltip value={tip}>{button}</Tooltip>
  }
  // 详情右上角操作：已完成 = 分析并修复（主）+ 重新执行；进行中 = 停止执行；已停止/异常 = 重新执行（主）；后置「下载报告」。
  const currentActions = current && (
                <div className="eval-actions eval-current-actions">
                  {isActiveRun(current) ? (
                    <Button variant="secondary" disabled={["stopping", "stop_unconfirmed"].includes(current.status)} onClick={() => requestCancelRun(objectId, current.id)}>{["stopping", "stop_unconfirmed"].includes(current.status) ? "停止处理中…" : tr("stop")}</Button>
                  ) : current.status === "completed" ? (
                    <>
                      {repairAction(current, "primary")}
                      <Button variant="secondary" disabled={busy} onClick={() => requestRerun(current)}>重新执行</Button>
                    </>
                  ) : (
                    <BrandButton variant="primary" disabled={busy} onClick={() => requestRerun(current)}>重新执行</BrandButton>
                  )}
                  <Button variant="secondary" disabled={isActiveRun(current)} onClick={() => exportReport(current)}>下载报告</Button>
                </div>
  )

  return (
    <div ref={split.container} className={`eval-workbench${embedded ? " eval-embedded-report" : ""}`} data-chat-open={chatOpen || undefined} data-resizing={split.dragging || undefined} style={{ "--eval-chat-width": `${split.width}px` } as CSSProperties}>
      {!embedded && <EvaluationChat onNewConversation={() => void newConversation()} viewDraft={chatDrafts.current.get(draftKey)!} hidden={!chatOpen} objectId={objectId} name={name} key={draftKey} sessionId={conversationId} operation={section} currentRun={historicalRun || current} onSession={setConversation}
        onRepair={repair}
        readOnly={historical} disabled={!!(editorOpen && draft) || importOpen}
        onRerun={(run, ids, sessionId) => {
          const unsuccessful = unsuccessfulRunResults(run)
          const scope = !ids ? "rerunAll" : ids.length === unsuccessful.length && unsuccessful.every(item => ids.includes(item.id)) ? "unsuccessful" : "selected"
          rerun(run, ids, scope, sessionId)
        }} onLocate={(run, id) => openView({ section: "runs", runId: run.id, resultId: id })}
        onReports={() => openView({ section: "reports" })} onRun={(all, ids, sessionId) => {
          const saved = useEvaluation.getState().cases[objectId] || []
          const scope = ids
          configureRun(scope ? saved.filter(c => scope.includes(c.id)) : saved, scope ? "selected" : "all", undefined, 0, sessionId)
        }} onViewRun={run => openView({ section: "runs", runId: run.id, report: !isActiveRun(run) })} />}
    {chatOpen && <EvaluationSplitter {...split.splitter} />}
    <section className="eval-panel" data-view={section} aria-label={tr("title")}>
      {activeRun && <div className="eval-context-strip" role="status">{activeRun.code} 正在运行 <Button variant="ghost" onClick={() => openView({ section: "runs", runId: activeRun.id, report: true })}>查看进度</Button></div>}
      {!embedded && <header className="eval-panel-header"><SessionToggleButton collapsed={!chatOpen} onToggle={() => setChatPreference(!chatOpen)} />{heading || <span>{name}</span>}</header>}
      {runSetup && <RunEvaluationDialog name={name} count={runSetup.cases.length} scope={tr(`models.${runSetup.scope}`)}
        breakdown={runSetup.original && runSetup.scope === "unsuccessful" ? `不通过 ${runSetup.original.results.filter(c => runSetup.cases.some(item => item.id === c.id) && verdictLabel(c) === "不通过").length} 条，无法判定 ${runSetup.original.results.filter(c => runSetup.cases.some(item => item.id === c.id) && verdictLabel(c) === "无法判定").length} 条` : undefined}
        version={runSetup.original ? `${caseVersionLabel(runSetup.original)} · 来源报告 ${runSetup.original.code || runTitle(runSetup.original.started)}` : "当前用例"}
        originalModels={runSetup.original?.models} initial={runSetup.initial} defaults={runSetup.defaults} rerun={!!runSetup.original} missingCount={runSetup.missingCount}
        onClose={() => setRunSetup(undefined)} onStart={begin} />}
      <ControlledConfirmDialog open={blocker.state === "blocked"} title="放弃本次修改？" description="离开后，本次未保存的用例修改将被丢弃" confirmText="放弃并离开" cancelText="继续编辑" variant="danger"
        onConfirm={() => { if (blocker.state === "blocked") { setDraft(undefined); setImportOpen(false); blocker.proceed() } }}
        onClose={() => { if (blocker.state === "blocked") blocker.reset() }} />
      {state.error && <p role="alert">{tr("storageError")}</p>}
      <div aria-live="polite" className="eval-muted">
        {notice.text}
      </div>
          {!embedded && <nav className="eval-tabs light-segmented" aria-label={tr("title")}>
            <SegmentedControl
              value={section}
              onChange={value => {
                if (!unsaved) { setDraft(undefined); setImportOpen(false) }
                openView({ section: value === "runs" ? "reports" : "cases" })
              }}
              items={["cases", "runs"].map(value => ({
                value,
                label: `${value === "cases" ? "评测用例" : "评测报告"} (${value === "cases" ? currentCases.length : runs.length})`,
              }))}
            />
          </nav>}
      {importOpen ? <ImportCases objectId={objectId} close={() => { setImportOpen(false); setNotice("导入已结束，请查看用例列表", true) }} /> : locationError ? (
        <div className="eval-empty"><p role="alert">{locationError}</p></div>
      ) : editorOpen && draft && section === "cases" ? (
        <CaseEditor draft={draft} update={setDraft} editing={!!savedDraft} cancel={() => {
          if (!draftChanged) { setDraft(undefined); return }
          dialog.show(() => <ConfirmDialog title="放弃本次修改？" description="本次未保存的用例修改将被丢弃" cancelText="继续编辑" confirmText="放弃修改" variant="danger" onConfirm={() => setDraft(undefined)} />)
        }} save={value => {
          if (!saveCases(objectId, savedDraft ? cases.map(c => c.id === value.id ? value : c) : [...cases, value])) return
          setDraft(undefined); setNotice(tr("saved"), true)
        }} />
      ) : (
        <>
          {section === "runs" && !historical && activeRun && current?.id !== activeRun.id && <div className="eval-toolbar eval-report-switcher">
            <div className="eval-actions">
            {activeRun && <Button variant="secondary" onClick={() => openView({ section: "runs", runId: activeRun.id })}>查看当前任务进度</Button>}</div>
          </div>}
          {(section === "cases" || historical) && (
            <div className="eval-case-list">
              {historicalRun && <Button variant="ghost" className="eval-return-report" onClick={() => {
                const origin = searchParams.get("caseFrom")
                openView(origin === "report" || origin === "run"
                  ? { section: "reports", runId: historicalRun.id, report: origin === "report" }
                  : { section: "reports" })
              }}><Icon name="arrow-left" size="small" />{["report", "run"].includes(searchParams.get("caseFrom") || "") ? `返回报告 ${historicalRun.code || runTitle(historicalRun.started)}` : "返回报告列表"}</Button>}
              {historical && <div className="eval-toolbar"><h3>本次评测用例（{cases.length}）</h3></div>}
              {historical && <div className="eval-toolbar"><h3>本次评测用例（{cases.length}）</h3></div>}
              {!historical && !!cases.length && <div className="eval-case-setbox">
                <div className="eval-setbox-head">
                  <span className="eval-setbox-title">用例集 · 共 {cases.length} 条</span>
                </div>
                <div className="eval-libbar">
                  <label className="eval-selall">
                    <input
                      type="checkbox"
                      ref={node => { if (node) node.indeterminate = selectedCases.length > 0 && selectedCases.length < cases.length }}
                      checked={!!cases.length && selectedCases.length === cases.length}
                      onChange={(e) => setSelected(e.target.checked ? cases.map(c => c.id) : [])}
                    />
                    <span>全选</span>
                  </label>
                  <div className="eval-fchips" role="group" aria-label="按状态筛选用例">
                    {caseFilters.map(([value, label]) => <button key={value} type="button" className="eval-chip" data-on={caseFilter === value || undefined} onClick={() => { setCaseFilter(value); setCasePage(1) }}>{label}（{cases.filter((caseFilters.find(([key]) => key === value) || caseFilters[0])[2]).length}）</button>)}
                  </div>
                  <input className="eval-libsearch" type="search" aria-label="搜索用例名称或编码" placeholder="搜索用例名称或编码" value={caseSearch} onChange={e => { setCaseSearch(e.target.value); setCasePage(1) }} />
                  {!!selectedCases.length && <>
                    <span className="eval-selcount" aria-live="polite">已选 {selectedCases.length} 条{selectionDetails ? `（${selectionDetails}）` : ""}</span>
                    <Button variant="ghost" onClick={() => setSelected([])}>取消选择</Button>
                    <Button variant="ghost" className="eval-danger-action" onClick={() => removeCases(selectedCases.map(c => c.id))}>删除用例（{selectedCases.length}）</Button>
                  </>}
                </div>
                <div className="eval-setbox-actions">
                  <span className="eval-set-badges">
                    <span className="eval-set-badge" data-version>版本 V{setVersion}</span>
                    <span className="eval-set-badge" data-ok={setExecuted || undefined}>{setExecuted ? "已执行" : "未执行"}</span>
                  </span>
                  <div className="eval-libbtns">
                    <Button variant="secondary" onClick={newCase}>新增用例</Button>
                    <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
                    <Button variant="secondary" disabled={exportingTemplate} onClick={() => void exportTemplate()}>导出模板</Button>
                    <BrandButton variant="primary" disabled={!busy && !cases.length} onClick={() => { if (activeRun) openView({ section: "runs", runId: activeRun.id }); else configureRun(selectedCases.length ? selectedCases : cases, selectedCases.length ? "selected" : "all") }}>
                      {busy ? "查看当前运行" : selectedCases.length ? `运行选中（${selectedCases.length}）` : `运行全部（${cases.length}）`}
                    </BrandButton>
                  </div>
                </div>
                {caseSearchHint}
                {caseRows}
                {casePagination}
              </div>}
              {historical && <>
                {caseSearchHint}
                {caseRows}
                {casePagination}
              </>}
              {!historical && !cases.length && (
                <div className="eval-empty">
                  <Empty description="" />
                  <p className="eval-empty-description">在左侧对话中描述具体要求，AI 会帮你生成评测用例；也可以新增用例或导入已有用例。</p>
                  <div className="eval-actions eval-empty-actions">
                    <Button variant="secondary" onClick={newCase}>新增用例</Button>
                    <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
                  </div>
                </div>
              )}
              {!historical && <details className="eval-prototype-tools" aria-label="原型辅助">
                <summary>原型演示工具</summary>
                <Tooltip value="用于演示，不纳入正式功能"><Button variant="ghost" className="eval-prototype-action" onClick={samples}>
                  {tr("samples")}（仅原型）
                </Button></Tooltip>
              </details>}
            </div>
          )}
          {section === "runs" && !historical && !current && (
            <>
              <div className="eval-date-filter" role="group" aria-label="运行记录筛选">
                <div className="eval-run-status-chips" role="group" aria-label="执行状态快捷筛选">
                  {([["all", "全部", runs.length], ["active", "进行中", runs.filter(run => runStatusGroups.active.includes(run.status)).length], ["completed", "已完成", runs.filter(run => runStatusGroups.completed.includes(run.status)).length], ["cancelled", "已停止", runs.filter(run => runStatusGroups.cancelled.includes(run.status)).length], ["abnormal", "异常中止", runs.filter(run => runStatusGroups.abnormal.includes(run.status)).length]] as const).map(([value, label, count]) =>
                    <button key={value} type="button" className="eval-chip" data-on={runStatusFilter === value || undefined} onClick={() => { setRunStatusFilter(value); setRunPage(1) }}>{label} <span className="eval-chip-count">{count}</span></button>)}
                </div>
                <EvaluationSelect id="eval-run-range" title="按运行开始时间筛选" label="运行开始时间" value={runRangePreset} onChange={applyRunRange} options={[
                  { value: "all", label: "全部时间" }, { value: "today", label: "今天" }, { value: "yesterday", label: "昨天" },
                  { value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "custom", label: "自定义" },
                ]} />
                {runRangePreset === "custom" ? <div className="eval-custom-date-range">
                <DatePicker label="开始日期" value={runStartDate} max={runEndDate || undefined} onChange={value => { setRunStartDate(value); setRunPage(1) }} />
                <span className="eval-muted">至</span>
                <DatePicker label="结束日期" value={runEndDate} min={runStartDate || undefined} onChange={value => { setRunEndDate(value); setRunPage(1) }} />
                <Button variant="ghost" onClick={() => applyRunRange("all")}>清空</Button>
                </div> : runRangePreset !== "all" && <span className="eval-muted">{runStartDate} 至 {runEndDate}</span>}
                <ComparisonPicker dones={completedList} poolIds={comparisonPool.map(run => run.id)} baselineId={baselineId}
                  onSelectionChange={ids => { setCmpSelection(objectId, ids); setRunPage(1) }}
                  onSetBaseline={id => { setCmpBaseline(objectId, id); setNotice(`已将 ${runLabelText(completedList.find(run => run.id === id)!)} 设为基线版本（基线唯一）`, true) }} />
              </div>
              {invalidRunRange && <p id="eval-date-error" className="eval-field-error" role="alert">开始日期不能晚于结束日期</p>}
              {!filteredRuns.length && !invalidRunRange && (
                <div className="eval-empty">
                  <Empty description={runStartDate || runEndDate || runStatusFilter !== "all" ? "暂无符合筛选条件的运行记录" : "还没有运行记录，先到“评测用例”选择用例并运行"} />
                </div>
              )}
              {visibleRuns.map((run) => {
                const stats = runStats(run)
                const rate = runPassRate(run)
                const full = stats.executed >= stats.total
                const denom = run.status === "completed" ? Math.max(stats.executed, 1) : stats.total
                const seg = (count: number) => `${(count / denom * 100).toFixed(2)}%`
                const modelsText = run.models ? (run.models.execution?.id === run.models.judging?.id
                  ? `执行/评测 ${run.models.execution?.name || "未记录"}`
                  : `执行 ${run.models.execution?.name || "未记录"} · 评测 ${run.models.judging?.name || "未记录"}`) : ""
                return (
                <div className="eval-row eval-run-row eval-report-card" key={run.id}
                  onClick={e => { if ((e.target as HTMLElement).closest("button, input, a, label, [role=menu], [role=menuitem]")) return; openView({ section: "runs", runId: run.id, report: !isActiveRun(run) }) }}>
                  <div className="eval-report-heading">
                    <span className="eval-report-code" style={{ userSelect: "text", WebkitUserSelect: "text" }}>{run.code || runTitle(run.started)}</span>
                    <span className="eval-report-state" data-s={run.status}>{status(run.status)}</span>
                    {run.id === runs.find(r => !isActiveRun(r))?.id && <span className="eval-report-latest">最新</span>}
                    {run.id === baselineId && isCompletedRun(run) && <span className="eval-report-latest eval-report-baseline">基线</span>}
                    <span className="eval-report-time">{runTitle(run.started)}</span>
                  </div>
                  <div className="eval-report-rate">
                    <span className="eval-rate-line">
                      {rate === undefined
                        ? <span className="eval-rate-big eval-rate-muted">已执行 {stats.executed}/{stats.total}</span>
                        : <>
                            <span className="eval-rate-big">{rate}%</span>
                            <span className="eval-rate-sub">{stats.passed}/{stats.executed} 通过 · {full ? "全量案例" : "部分案例"}</span>
                          </>}
                      {isActiveRun(run) && <Button variant="ghost" className="eval-run-stop" disabled={["stopping", "stop_unconfirmed"].includes(run.status)} onClick={() => requestCancelRun(objectId, run.id)}>{["stopping", "stop_unconfirmed"].includes(run.status) ? "停止处理中…" : "停止执行"}</Button>}
                    </span>
                    <div className="eval-segbar" title={`通过 ${stats.passed} · 未通过 ${stats.failed} · 无法判定 ${stats.unknown} · 未执行 ${stats.total - stats.executed}`}>
                      <div className="eval-seg eval-seg-pass" style={{ width: seg(stats.passed) }} />
                      <div className="eval-seg eval-seg-fail" style={{ width: seg(stats.failed) }} />
                      <div className="eval-seg eval-seg-unknown" style={{ width: seg(stats.unknown) }} />
                    </div>
                    {!isActiveRun(run) && <Button variant="secondary" className="eval-report-rerun" disabled={busy} onClick={() => requestRerun(run)}>重新执行</Button>}
                  </div>
                  <div className="eval-muted eval-report-metadata">
                    <span>执行明细</span>
                    <span>用例集 {caseVersionLabel(run)}（共 {stats.total} 条）</span>
                    {run.status === "completed" && stats.executed < stats.total && <span>本次执行 {stats.executed}/{stats.total}</span>}
                    {modelsText && <span>{modelsText}</span>}
                    <EvaluationDuration label="耗时" value={runDuration(run, durationNow)} note={runDurationNote} />
                    <span>{pointsText(runPoints(run))}</span>
                    {run.status === "error" && run.stopReason && <span>{run.stopReason}</span>}
                  </div>
                  <div className="eval-report-deltas">
                    {/* 上一版对比取全部已完成报告中时间最近的前一份，不受对比范围选择影响 */}
                    <ReportDelta run={run} pool={completedList} baselineId={baselineId} baselineRun={baselineRun} />
                  </div>
                </div>
                )
              })}
              {!!orderedRuns.length && <p className="eval-hint-foot">重新执行会生成新报告，不覆盖历史报告</p>}
              {!historical && <div className="eval-prototype-inline">
                <Tooltip value="用于演示，不纳入正式功能"><Button variant="ghost" className="eval-prototype-action" onClick={() => {
                  const ok = fillDemoReports(objectId, name)
                  setNotice(ok ? "已填充 6 份示例报告：用例集版本随时间递增，最新一份不小于历史报告；已完成（含部分执行）排在前，已停止/异常中止排在后" : "填充示例报告失败：请先在“评测用例”添加用例，并确认没有正在运行的报告")
                }}>填充示例报告（仅原型）</Button></Tooltip>
              </div>}
              {!!filteredRuns.length && <nav className="eval-pagination" aria-label="运行记录分页">
                <span className="eval-muted">共 {filteredRuns.length} 条 · 每页 {runPageSize} 条</span>
                <div className="eval-actions">
                  <Button variant="ghost" disabled={currentRunPage === 1} onClick={() => setRunPage(currentRunPage - 1)}>上一页</Button>
                  <span aria-live="polite">{currentRunPage} / {runPageCount}</span>
                  <Button variant="ghost" disabled={currentRunPage === runPageCount} onClick={() => setRunPage(currentRunPage + 1)}>下一页</Button>
                </div>
              </nav>}
            </>
          )}
          {current && section === "runs" && (
            <>
              {<Button variant="ghost" className="eval-return-report" onClick={() => openView({ section: "reports" })}><Icon name="arrow-left" size="small" />返回报告列表</Button>}
              <ReportDetail key={current.id} run={current} baselineId={baselineId} baselineRun={baselineRun} actions={currentActions}
                title={current.name}
                initialCaseId={resultId || focusCase || undefined}
                onCaseAction={(action, caseId) => {
                  const snapshotCase = runCases(current).find(item => item.id === caseId)
                  if (!snapshotCase) { setNotice("该用例不在本次报告的用例快照中"); return }
                  if (action === "rerun") { configureRun([snapshotCase], "single", current); return }
                  const editable = currentCases.find(item => item.id === caseId) ?? snapshotCase
                  setDraft(structuredClone(editable))
                  openView({ section: "cases" })
                }} />
            </>
          )}
        </>
      )}
    </section>
    </div>
  )
}
