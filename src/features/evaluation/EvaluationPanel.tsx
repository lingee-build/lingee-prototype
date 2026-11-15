import { isInLatestReportBatch, latestReportForExecutionModel } from "@/vendor/build-evaluation/report-batch"
import type { EvaluationParameters } from "@/services/evaluation-placeholders"
import { caseContentKey } from "@/services/evaluation"
import { reportGradeStyle } from "@/vendor/build-evaluation/report-grade-style"
import { reviewCases, reviewPrompt } from '@/mock/evaluation/review'
import { recoverReviewQuality, startRunBatch, simulateAwaitingContinue, continueRun } from '@/services/evaluation'
import { qualityOf, qualitySummary } from "@/services/evaluation-quality"
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
import { runPoints, pointsComplete, pointsText, refreshRunPoints, resumeRunPoints, updateAutomaticPoints } from "@/services/evaluation-points"
import { devStore } from "@/mock/dev-store"
import { evaluationRepairObject, repairableResults, repairDisabledReason, repairPrompt, registerEvaluationRepair, findRepairSession, useEvaluationRepairs } from "@/services/evaluation-repair"
import { EvaluationSelect } from "./EvaluationSelect"
import { EvaluationRetestComparison } from "./EvaluationRetestComparison"
import { RunEvaluationDialog } from "./RunEvaluationDialog"
import { ImportCases } from "./ImportCases"
import { resolveRerunModels, defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, type EvalModelIds, type EvalRunModels } from "@/services/evaluation-models"
import { useBlocker, useSearchParams, useNavigate, createSearchParams, type SetURLSearchParams } from "react-router"
import { EvaluationChat } from "./EvaluationChat"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useSync } from "@/stores/sync"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"

import { useEvaluationClock } from "./EvaluationDuration"
import { ReportProgress } from "./ReportProgress"
import { ReportPreview } from "./ReportPreview"
import { buildReportData, buildReportDocument } from "./report-document"
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { Empty, SegmentedControl, Button, IconButton, ConfirmDialog, Tooltip, DropdownMenu, Icon, useDialog } from "@/ui"
import { useT } from "@/i18n"
import {
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
  isActiveRun,
  finishedCaseCount,
  type EvalCase,
  type EvalRun,
  type Source,
  type Outcome,
} from "@/services/evaluation"
import "./evaluation.css"
import "@/vendor/build-evaluation/evaluation.css"
import "./build-fidelity.css"

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
  const reportSurface = useRef<HTMLDivElement>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const [expandedRetest, setExpandedRetest] = useState<string>()
  useEffect(()=>{ const update=()=>setFullscreen(!!reportSurface.current && document.fullscreenElement === reportSurface.current); document.addEventListener("fullscreenchange",update);return()=>document.removeEventListener("fullscreenchange",update) },[])
  const chatDrafts = useRef(evaluationDrafts)
  const navigate = useNavigate()
  const [openingRepair, setOpeningRepair] = useState(false)
  const repairOpening = useRef(false)
  useEvaluationRepairs(s => s.items) // 关联新修复会话后，列表与详情同步更新入口文案。
  async function repair(run: EvalRun, resultId?: string) {
    const target = evaluationRepairObject(objectId)
    if (!target || repairOpening.current || repairDisabledReason(objectId, run, true, resultId)) return
    repairOpening.current = true
    setOpeningRepair(true)
    try {
      const draft = repairPrompt(objectId, run, resultId)
      const existing = findRepairSession(objectId, run)
      const scopeChanged = !!existing && (existing.target?.runId !== run.id || (existing.target && "resultId" in existing.target ? existing.target.resultId : undefined) !== resultId)
      if (embedded?.repairSessionId && existing?.session.id === embedded.repairSessionId) {
        if (useSync.getState().sessions.find(s => s.id === existing.session.id)?.status === "running") { setNotice("请先完成或停止当前修复分析。"); return }
        if (scopeChanged) {
          registerEvaluationRepair(existing.session, draft, { objectType: target.objectType, objectId: target.objectId, runId: run.id, resultId })
          sessionService.prompt(existing.session.id, draft, useSync.getState().apply, usePrompt.getState().modelId)
        } else {
          document.querySelector<HTMLElement>('[data-component="prompt-input"][role="textbox"]')?.focus()
        }
        return
      }
      if (existing && useSync.getState().sessions.find(s => s.id === existing.session.id)?.status === "running" && scopeChanged) { setNotice("修复会话仍在处理上一轮，请先完成或停止后继续。"); return }
      const session = existing?.session || await createEditSession({ title: `修复 ${name} · ${run.code || run.id} · ${runTitle(run.started)}`, draft: "", projectId: target.projectId, target: target.editTarget, requireProject: true })
      if (!session) { setNotice("对象所属项目不可用，无法打开开发对话"); return }
      const needsAnalysis = !existing || scopeChanged
      registerEvaluationRepair(session, draft, { objectType: target.objectType, objectId: target.objectId, runId: run.id, resultId })
      useSync.getState().apply({ type: "session.updated", session })
      if (!existing) useSync.setState(s => ({ messages: { ...s.messages, [session.id]: [] } }))
      const back = new URLSearchParams({ view: "report", run: run.id })
      if (resultId) back.set("focusCase",resultId)
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
  const baseline = useMemo(() => {
    const previous = new Map<string, EvalCase>()
    for (const run of state.runs[objectId] ?? [])
      for (const item of runCases(run)) if (!previous.has(item.id)) previous.set(item.id, item)
    return previous
  }, [objectId, state.runs])
  const [routeParams, setRouteParams] = useSearchParams()
  const [localParams, setLocalParams] = useState(() => new URLSearchParams(embedded?.initialRunId ? { run: embedded.initialRunId, view: "report" } : { tab: "reports" }))
  const searchParams = embedded ? localParams : routeParams
  const showDemoTools = routeParams.get("demo") === "1"
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
    // 会话归属已从对象恢复，避免在此覆盖运行详情导航。
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
  function viewRunCases(id: string, origin: "list" | "report" | "run") {
    setCaseSearch(""); setCasePage(1); setSelected([])
    const next = new URLSearchParams(searchParams)
    for (const key of ["run", "case", "view", "version", "scopeRun", "caseRun", "caseFrom", "retestReturn"]) next.delete(key)
    next.set("tab", "reports"); next.set("caseRun", id); next.set("caseFrom", origin)
    setSearchParams(next)
  }
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
  function openView(view: { section: "cases" | "runs" | "reports"; runId?: string; resultId?: string; report?: boolean; conversationId?: string; retestReturn?: string }) {
    const next = new URLSearchParams(searchParams)
    for (const key of ["tab", "run", "case", "view", "focusCase", "version", "scopeRun", "caseRun", "caseFrom", "retestReturn"]) next.delete(key)
    if (view.conversationId) next.set("conversation", view.conversationId)
    if (view.section !== "cases") next.set("tab", view.section)
    if (view.runId) {
      next.set("run", view.runId)
      if (view.retestReturn) next.set("retestReturn", view.retestReturn)
      if (view.report) {
        next.set("view", "report")
        if (view.resultId) next.set("focusCase", view.resultId)
      }
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
  const filteredRuns = invalidRunRange ? [] : runs.filter(run => run.started >= startTime && run.started < endTime && (runStatusFilter === "all" || (runStatusFilter === "needs_attention" ? !!run.awaitingContinueAt || run.status === "stop_unconfirmed" : runStatusFilter === "ended" ? !isActiveRun(run) : isActiveRun(run) && !run.awaitingContinueAt && run.status !== "stop_unconfirmed")))
  const runPageSize = 10
  const runPageCount = Math.max(1, Math.ceil(filteredRuns.length / runPageSize))
  const [refreshingReports, setRefreshingReports] = useState(false)
  const currentRunPage = Math.min(runPage, runPageCount)
  const visibleRuns = filteredRuns.slice((currentRunPage - 1) * runPageSize, currentRunPage * runPageSize)
  async function refreshReports() {
    if (refreshingReports) return
    setRefreshingReports(true)
    try {
      for (const run of visibleRuns) {
        const points = runPoints(run)
        if (isActiveRun(run) || !points.recorded || pointsComplete(points)) continue
        await refreshRunPoints(objectId, run.id)
      }
    } finally {
      setRefreshingReports(false)
    }
  }
  const [caseSearch, setCaseSearch] = useState("")
  const [casePage, setCasePage] = useState(1)
  const casePageSize = 10
  const filteredCases = cases.filter(c => `${c.businessId || c.code || ""} ${c.name}`.toLocaleLowerCase().includes(caseSearch.trim().toLocaleLowerCase()))
  const casePageCount = Math.max(1, Math.ceil(filteredCases.length / casePageSize))
  const currentCasePage = Math.min(casePage, casePageCount)
  const visibleCases = filteredCases.slice((currentCasePage - 1) * casePageSize, currentCasePage * casePageSize)
  const [selected, setSelected] = useState<string[]>([])
  const [runSetup, setRunSetup] = useState<{ cases: EvalCase[]; scope: string; qualityOnly?: boolean; original?: EvalRun; initial: EvalModelIds; defaults: EvalModelIds; missingCount: number; conversationSessionId?: string }>()
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
  function caseMeta(c: EvalCase) {
    const prior = baseline.get(c.id)
    const change = historical ? "" : !prior ? " · 新增" : caseContentKey([prior]) !== caseContentKey([c]) ? " · 已修改" : ""
    const code = c.businessId || c.code
    return <>{code && <><span className="eval-case-code">{code}</span>{" · "}</>}{turnsOf(c).length} 轮对话{change}</>
  }
  useEffect(() => {
    if (!notice.text || !notice.transient) return
    const timer = setTimeout(() => updateNotice({ text: "", transient: false }), 3000)
    return () => clearTimeout(timer)
  }, [notice])
  const current = runs.find((r) => r.id === runId)
  const retestReturn = runs.find(run => run.id === searchParams.get("retestReturn"))
  const retestSource = runs.find(run => run.id === current?.sourceRunId)
  const focusCase = searchParams.get("focusCase")
  useEffect(() => {
    for (const run of useEvaluation.getState().runs[objectId] || []) resumeRunPoints(objectId, run.id)
    void updateAutomaticPoints()
  }, [objectId, runId])
  const report = !!current
  const durationNow = useEvaluationClock(section === "runs" && (current ? isActiveRun(current) : visibleRuns.some(isActiveRun)))
  const currentReportHtml = useMemo(
    () => current ? buildReportDocument(current, t, durationNow, "embedded") : "",
    [current, t, durationNow],
  )
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
    const catalog = useSync.getState().models
    const demoModel = objectId === "skill:sale-order-management-eval-demo"
      ? catalog.find(model => model.id === "lg:production/build/fast/default/default") : undefined
    const defaults = { execution: demoModel?.id ?? evaluationExecutionDefault(catalog), judging: demoModel?.id ?? defaultJudgingModelId(catalog) }
    const setup = { cases: structuredClone(list), scope, original, defaults, missingCount, conversationSessionId, initial: initialEvaluationModelIds(defaults, undefined, original) }
    if (document.fullscreenElement === reportSurface.current && reportSurface.current) void document.exitFullscreen().catch(() => {})
    setRunSetup(setup)
  }
  async function begin(models: EvalRunModels, configuration?: {concurrency: number; executions: EvalRunModels["execution"][]; parameters?: EvaluationParameters}, setup = runSetup) {
    if (!setup || startingRun.current) return
    startingRun.current = true
    try {
    if (useEvaluation.getState().runs[objectId]?.some(isActiveRun)) throw new Error(tr("models.busy"))
    if (setup.original) {
      const locked = resolveRerunModels(setup.original.models, useSync.getState().models)
      if (!locked) throw new Error("来源报告模型未记录或已不可用，请从当前用例新建运行")
      models = locked
    }
    if(setup.qualityOnly && setup.original){const id=recoverReviewQuality(objectId,setup.original.id);if(!id)throw Error("没有可恢复的评分，或此报告已恢复。请刷新报告列表。");setRunSetup(undefined);openView({section:"runs",runId:id});return}
    const saved = useEvaluation.getState().cases[objectId] || []
    const list = setup.original ? setup.cases : setup.cases.map(item => saved.find(c => c.id === item.id))
    if (list.some(item => !item)) throw new Error(tr("models.casesChanged"))
    const target = evaluationRepairObject(objectId)
    if (!target) throw new Error("评测对象不可用")
    if (embedded) {
      const id = startRunBatch(objectId, name, list as EvalCase[], currentEvaluationEnvironment, (configuration?.executions || [models.execution]).map(execution=>({...models,execution})), configuration?.concurrency || 1, setup.original?.id, undefined, configuration?.parameters)?.[0]
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
    if (!conversationId && chatDrafts.current.has(draftKey)) chatDrafts.current.set(objectId+":"+session.id,chatDrafts.current.get(draftKey)!)
    const id = startRunBatch(objectId, name, list as EvalCase[], currentEvaluationEnvironment, (configuration?.executions || [models.execution]).map(execution=>({...models,execution})), configuration?.concurrency || 1, setup.original?.id, session.id, configuration?.parameters)?.[0]
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
    const sample = completeEvaluationSample(name)
    const finalTurn = sample.turns?.at(-1)
    if (finalTurn && sample.checks?.length) {
      finalTurn.checks = [...(finalTurn.checks ?? []), ...sample.checks]
      finalTurn.expected = [finalTurn.expected, ...sample.checks.map(check => check.text)].filter(Boolean).join("\n")
      sample.checks = []
      const evidence = sample.demoEvidence?.turns.at(-1)
      if (evidence && sample.demoEvidence?.overall) {
        evidence.judgments.push(...sample.demoEvidence.overall)
        sample.demoEvidence.overall = []
      }
    }
    const clarificationFailures = (["timeout", "model_error"] as const).map((reason) => ({
      ...structuredClone(blocked),
      id: crypto.randomUUID(),
      name: reason === "timeout" ? "澄清匹配超时" : "澄清匹配调用异常",
      demoFailure: "clarification_unmatched" as const,
      demoEvidence: { overall: [], turns: [{
        response: "", files: [], judgments: [],
        clarification: "实际追问：请确认查询所用的核算组织",
        clarificationFailure: reason,
      }] },
    }))
    if (!saveCases(objectId, [...cases, sample, ...next.filter(c => c.outcome !== "blocked"), { ...structuredClone(next[0]), id: crypto.randomUUID(), name: "判定服务超时（业务执行成功）", demoJudgingFailure: "timeout", demoJudgingDelayMs: 3000 }, ...failures, ...clarificationFailures])) return
    setNotice("已添加 9 条示例用例", true)
  }
  async function exportReviewBundle(run: EvalRun) {
    if (isActiveRun(run)) return
    try {
      const {default: JSZip} = await import("jszip")
      const zip = new JSZip()
      zip.file("评测报告.html", buildReportDocument(run, t))
      zip.file("运行快照.json", JSON.stringify(run, null, 2))
      zip.file("用例快照.json", JSON.stringify(run.caseSnapshot || {cases:runCases(run)}, null, 2))
      zip.file("说明.txt", "内部复核资料包 · 原型模拟数据\n包含冻结用例、逐轮执行证据、八维评分与运行配置；不是 Foundation 接口上传包。对外归档请使用 HTML 报告。")
      const url = URL.createObjectURL(await zip.generateAsync({type:"blob"}))
      const a = document.createElement("a"); a.href=url; a.download=`${run.code || run.id}-内部复核资料.zip`; a.click()
      setTimeout(()=>URL.revokeObjectURL(url),1000)
      setNotice("已导出内部复核资料包（原型模拟数据）。",true)
    } catch { setNotice("复核资料包导出失败，请重试。") }
  }
  function exportReport(run: EvalRun) {
    if (isActiveRun(run)) return
    const content = buildReportDocument(run, t)
    const url = URL.createObjectURL(new Blob([content], { type: "text/html;charset=utf-8" }))
    const a = document.createElement("a")
    a.href = url
    a.download = `${run.name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_")}-评测报告-${run.code || runFileTime(run.started)}.html`
    a.click()
    setNotice("如需归档，可在 Foundation 的「上传评测报告」选择 HTML 原件，并按接收方要求填写关联信息。", true)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const status = (value: string) => (
    <span className="eval-status" data-status={value}>
      {tr(value)}
    </span>
  )
  function requestRerun(run: EvalRun, unsuccessful = false) {
    if (busy) return
    rerun(run, (unsuccessful ? unsuccessfulRunResults(run) : run.results).map(c => c.id), unsuccessful ? "unsuccessful" : "rerunAll")
  }
  function rerunMenu(run: EvalRun, primary = false, outlined = false) {
    const unsuccessful = unsuccessfulRunResults(run)
    const label = <>重新运行 <Icon name="chevron-down" size="small" /></>
    return <DropdownMenu placement="bottom-end">
      <DropdownMenu.Trigger asChild>
        <Button variant={primary ? "primary" : outlined ? "secondary" : "ghost"} size="large" className="eval-menu-trigger" disabled={busy}>{label}</Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal container={fullscreen ? reportSurface.current : undefined}><DropdownMenu.Content>
        {!run.stopRequestedAt && run.results.some(r=>r.demoQualityFailure && r.reviewTrace && r.quality?.state==="评分未完成") && <DropdownMenu.Item onSelect={()=>{configureRun(runCases(run),"all",run);setRunSetup(previous=>previous?{...previous,qualityOnly:true,cases:previous.cases.filter(c=>run.results.some(r=>r.id===c.id && r.quality?.state==="评分未完成"))}:previous)}}>使用原证据恢复评分</DropdownMenu.Item>}
        <DropdownMenu.Item onSelect={() => requestRerun(run)}>重新运行全部（{run.results.length}）</DropdownMenu.Item>
        <DropdownMenu.Item disabled={!unsuccessful.length} onSelect={() => requestRerun(run, true)}>重跑未通过用例（{unsuccessful.length}）</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu>
  }
  function repairAction(run: EvalRun, variant: "ghost" | "secondary") {
    if (repairDisabledReason(objectId, run, !!evaluationRepairObject(objectId))) return null
    const issues=repairableResults(run)
    if(issues.length>1) return <DropdownMenu placement="bottom-end"><DropdownMenu.Trigger asChild><Button variant={variant} disabled={openingRepair}>{variant === "ghost" ? "修复" : "分析并修复"}</Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content>
      <DropdownMenu.Item onSelect={()=>void repair(run)}>全部问题（{issues.length}）</DropdownMenu.Item>
      {issues.map(c=><DropdownMenu.Item key={c.id} onSelect={()=>void repair(run,c.id)}>{c.code} · {c.name}</DropdownMenu.Item>)}
    </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu>
    return <Tooltip value={openingRepair ? "正在打开开发会话" : "先分析问题与修复方案，确认后修改原对象，再手动复测"}>
      <Button variant={variant} className="eval-repair-action" disabled={openingRepair} onClick={() => void repair(run)}>{variant === "ghost" ? "修复" : "分析并修复"}</Button>
    </Tooltip>
  }
  const currentActions = current && (
                <div className="eval-actions eval-current-actions">
                  {retestReturn && <Button variant="secondary" onClick={() => openView({section:"runs",runId:retestReturn.id,report:true})}>返回本次复测</Button>}
                  <DropdownMenu placement="bottom-end"><DropdownMenu.Trigger asChild><button type="button" className="eval-menu-trigger">更多 <Icon name="chevron-down" size="small" /></button></DropdownMenu.Trigger><DropdownMenu.Portal container={fullscreen ? reportSurface.current : undefined}><DropdownMenu.Content>
                    <DropdownMenu.Item onSelect={() => viewRunCases(current.id, "report")}>查看用例</DropdownMenu.Item>
                    <DropdownMenu.Item disabled={isActiveRun(current)} onSelect={() => exportReport(current)}>下载报告</DropdownMenu.Item>
                    <DropdownMenu.Item disabled={isActiveRun(current)} onSelect={() => void exportReviewBundle(current)}>内部复核资料包</DropdownMenu.Item>
                  </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu>

                  {current.awaitingContinueAt && !current.stopRequestedAt && <Button variant="secondary" onClick={()=>continueRun(objectId,current.id)}>继续评测</Button>}
                  {current.status === "stop_unconfirmed" && <Button variant="secondary" onClick={()=>{cancelRun(objectId,current.id);setNotice("已在原型执行器中核实终止；保留此前记录。真实环境须以实际执行器和账单状态为准。",true)}}>刷新运行状态</Button>}
                  {repairAction(current, "secondary")}
                  {isActiveRun(current) ? (
                    <Button variant="secondary" disabled={["stopping", "stop_unconfirmed"].includes(current.status)} onClick={() => requestCancelRun(objectId, current.id)}>{current.stopRequestedAt || ["stopping", "stop_unconfirmed"].includes(current.status) ? "已请求结束" : "结束本次评测"}</Button>
                  ) : (
                    <>

                      {rerunMenu(current, true)}
                    </>
                  )}
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
    <section className="eval-panel eval-build-panel report-grade-theme" data-view={section} aria-label="评测工作区">
      {activeRun && !current && <div className="eval-context-strip" role="status">{activeRun.code} 正在运行 <Button variant="ghost" onClick={() => openView({ section: "runs", runId: activeRun.id, report: true })}>查看进度</Button></div>}
      {!embedded && <header className="eval-panel-header"><SessionToggleButton collapsed={!chatOpen} onToggle={() => setChatPreference(!chatOpen)} />{heading || <span>{name}</span>}</header>}
      {runSetup && <RunEvaluationDialog objectId={objectId} cases={runSetup.cases} sourceRun={runSetup.original} qualityOnly={runSetup.qualityOnly} name={name} count={runSetup.cases.length} scope={tr(`models.${runSetup.scope}`)}
        breakdown={runSetup.original && runSetup.scope === "unsuccessful" ? `未通过或未评分 ${runSetup.cases.length} 条（按八维质量结论筛选）` : undefined}
        version={runSetup.original ? `${runSetup.original.code || runTitle(runSetup.original.started)}` : "当前用例"}
        originalModels={runSetup.original?.models} initial={runSetup.initial} defaults={runSetup.defaults} rerun={!!runSetup.original} missingCount={runSetup.missingCount}
        onClose={() => setRunSetup(undefined)} onStart={begin} />}
      <ControlledConfirmDialog open={blocker.state === "blocked"} title="放弃本次修改？" description="离开后，本次未保存的用例修改将被丢弃" confirmText="放弃并离开" cancelText="继续编辑" variant="danger"
        onConfirm={() => { if (blocker.state === "blocked") { setDraft(undefined); setImportOpen(false); blocker.proceed() } }}
        onClose={() => { if (blocker.state === "blocked") blocker.reset() }} />
      <style>{reportGradeStyle}</style><div className="eval-page-content">
      {state.error && <p role="alert">{tr("storageError")}</p>}
      <div aria-live="polite" className="eval-muted">
        {notice.text}
      </div>
      {!embedded && <div className="eval-tabs">
        <SegmentedControl className="dev-page-tabs" aria-label="评测页签" value={section}
          items={[{value:"cases",label:`评测用例 (${currentCases.length})`,disabled:editorOpen},{value:"runs",label:`评测报告 (${runs.length})`,disabled:editorOpen}]}
          onChange={value => {
            setImportOpen(false)
            if (value === "cases") { setCaseSearch(""); setCasePage(1) }
            openView({ section: value === "cases" ? "cases" : "reports" })
          }} />
      </div>}
      {importOpen ? <ImportCases objectId={objectId} close={() => setImportOpen(false)} onImported={() => { setImportOpen(false); setSelected([]); setCasePage(1) }} /> : locationError ? (
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

          {(section === "cases" || historical) && (
            <div className="eval-case-list">
              {historicalRun && <header className="eval-case-history-header">
                <Button variant="ghost" className="eval-case-history-back" onClick={() => {
                  const origin = searchParams.get("caseFrom")
                  openView(origin === "report" || origin === "run"
                    ? { section: "reports", runId: historicalRun.id, report: origin === "report" }
                    : { section: "reports" })
                }}><Icon name="arrow-left" size="small" />{searchParams.get("caseFrom") === "list" ? "返回报告列表" : "返回报告详情"}</Button>
                <h3>本次评测用例 <span className="eval-case-history-code">{historicalRun.code}</span></h3>
              </header>}
              <div className="eval-case-controls" data-current={!historical || undefined}>
              {!!cases.length && !historical && <div className="eval-toolbar eval-case-toolbar">
                <div className="eval-actions eval-case-toolbar-actions">
                  <Button variant="secondary" size="large" onClick={() => setImportOpen(true)}>导入用例</Button>
                  <Button variant="primary" size="large" disabled={!busy && !cases.length} onClick={() => { if (activeRun) openView({ section: "runs", runId: activeRun.id }); else configureRun(selectedCases.length ? selectedCases : cases, selectedCases.length ? "selected" : "all") }}>
                    {busy ? "查看当前运行" : selectedCases.length ? `运行选中（${selectedCases.length}）` : `运行全部（${cases.length}）`}
                  </Button>
                </div>
              </div>}
              {!!cases.length && !historical && <input className="eval-case-search" type="search" aria-label="搜索用例名称或编码" placeholder="搜索用例名称或编码" value={caseSearch} onChange={e => { setCaseSearch(e.target.value); setCasePage(1) }} />}
              </div>
              {!!cases.length && !historical && <>
                  <div className="eval-selection-bar"><label className="eval-check">
                    <input
                      type="checkbox"
                      ref={node => { if (node) node.indeterminate = selectedCases.length > 0 && selectedCases.length < cases.length }}
                      disabled={!cases.length}
                      checked={!!cases.length && selectedCases.length === cases.length}
                      onChange={(e) => setSelected(e.target.checked ? cases.map(c => c.id) : [])}
                    />
                    {tr("selectAll")}
                  </label>

                  {!!selectedCases.length && <><span aria-live="polite">已选 {selectedCases.length} 条{selectionDetails ? `（${selectionDetails}）` : ""}</span><Button variant="ghost" onClick={() => setSelected([])}>取消选择</Button></>}
                  <Button variant="ghost" className="eval-danger-action" disabled={!selectedCases.length} onClick={() => removeCases(selectedCases.map(c => c.id))}>删除</Button>
                  </div>
              </>}{caseSearch.trim() && !!cases.length && !selectedCases.length && !busy && <p className="eval-muted">运行范围包含搜索结果之外的用例，共 {cases.length} 条。</p>}
              {filteredCases.length ? (
                <>
                  {visibleCases.map((c) => (
                    <div className="eval-current-case" data-selected={selected.includes(c.id) || undefined} key={c.id}><div className="eval-row">
                      {!historical && <label className="eval-check">
                        <input
                          type="checkbox"
                          aria-label={`${tr("select")} ${c.businessId || c.code || c.name}`}
                          checked={selected.includes(c.id)}
                          onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))}
                        />
                      </label>}
                      <div className="eval-grow">
                        <button type="button" className="eval-list-name eval-title eval-case-toggle" aria-expanded={expandedCases.includes(c.id)} aria-controls={`case-content-${c.id}`} onClick={e => { if (e.detail > 0 && hasSelectedText(e.currentTarget)) return; setExpandedCases(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id]) }}><Icon name="chevron-down-16" size="small" /><span className="eval-case-name" title={c.name}>{c.name}</span></button>
                        <div className="eval-current-meta eval-muted">{caseMeta(c)}</div>
                      </div>
                      {!historical && <><Button variant="ghost" onClick={() => setDraft(draft?.id === c.id ? draft : structuredClone(c))}>{tr("edit")}</Button>
                      <Button variant="ghost" className="eval-danger-action" onClick={() => removeCases([c.id])}>{tr("delete")}</Button></>}
                    </div>
                    {expandedCases.includes(c.id) && <div id={`case-content-${c.id}`} className="eval-history-content"><CaseDetail value={c} embedded history={historicalRun ? buildReportData(historicalRun).cases[historicalRun.results.findIndex(item => item.id === c.id)] : undefined} /></div>}
                    </div>
                  ))}
                </>
              ) : (
                <div className="eval-empty">
                  {!cases.length && !historical ? <>
                    <Empty description="" />
                    <p className="eval-empty-description">在左侧对话中描述具体要求，AI 会帮你生成评测用例；也可以导入已有用例。</p>
                    <div className="eval-actions eval-empty-actions">
                      <Button variant="secondary" size="large" onClick={() => setImportOpen(true)}>导入用例</Button>
                    </div>
                  </> : <Empty description={cases.length ? "未找到匹配的用例" : "还没有评测用例"} />}
                </div>
              )}

              {!!filteredCases.length && <nav className="eval-pagination" aria-label="评测用例分页">
                <span className="eval-muted">共 {filteredCases.length} 条 · 每页 {casePageSize} 条</span>
                <div className="eval-actions">
                  <Button variant="ghost" disabled={currentCasePage === 1} onClick={() => setCasePage(currentCasePage - 1)}>上一页</Button>
                  <span aria-live="polite">{currentCasePage} / {casePageCount}</span>
                  <Button variant="ghost" disabled={currentCasePage === casePageCount} onClick={() => setCasePage(currentCasePage + 1)}>下一页</Button>
                </div>
              </nav>}
              {showDemoTools && !historical && <details className="eval-prototype-tools" aria-label="原型辅助">
                <summary>原型演示工具</summary>
                <Tooltip value="用于演示，不纳入正式功能"><Button variant="ghost" className="eval-prototype-action" onClick={samples}>
                  {tr("samples")}（仅原型）
                </Button></Tooltip>
                {reviewPrompt(objectId) && <Button variant="ghost" disabled={busy} onClick={()=>{
                  const sample=reviewCases(objectId)[0]
                  if(saveCases(objectId,[...currentCases,{...sample,name:sample.name+"（模拟评分中断）",demoQualityFailure:true}])) setNotice("示例就绪。运行后可在报告中恢复质量评分。",true)
                }}>添加评分中断用例（仅原型）</Button>}
                {!!state.reviewFixes?.[objectId]?.length && <Button variant="ghost" disabled={busy} onClick={()=>{
                  useEvaluation.setState(s=>({reviewFixes:{...s.reviewFixes,[objectId]:[]}}))
                  setNotice("示例已切回修复前的表现，已有用例和报告保留。",true)
                }}>重演修复前的示例</Button>}
              </details>}
            </div>
          )}
          {section === "runs" && !historical && !current && (
            <>
              <div className="eval-date-filter" role="group" aria-label="运行记录筛选">
                <EvaluationSelect id="eval-run-status" title="按运行状态筛选" label="运行状态" value={runStatusFilter}
                  onChange={value => { setRunStatusFilter(value); setRunPage(1) }}
                  options={[
                    { value: "all", label: "全部状态" },
                    { value: "active", label: "进行中" },
                    { value: "needs_attention", label: "待处理" },
                    { value: "ended", label: "已结束" },
                  ]} />
                <EvaluationSelect id="eval-run-range" title="按运行开始时间筛选" label="运行开始时间" value={runRangePreset} onChange={applyRunRange} options={[
                  { value: "all", label: "全部时间" }, { value: "today", label: "今天" }, { value: "yesterday", label: "昨天" },
                  { value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "custom", label: "自定义" },
                ]} />
                {runRangePreset === "custom" ? <div className="eval-custom-date-range">
                <DatePicker label="开始日期" value={runStartDate} max={runEndDate || undefined} onChange={value => { setRunStartDate(value); setRunPage(1) }} />
                <span className="eval-muted">至</span>
                <DatePicker label="结束日期" value={runEndDate} min={runStartDate || undefined} onChange={value => { setRunEndDate(value); setRunPage(1) }} />
                <Button variant="ghost" onClick={() => applyRunRange("all")}>清除筛选</Button>
                </div> : runRangePreset !== "all" && <span className="eval-muted">{runStartDate} 至 {runEndDate}</span>}
                <IconButton icon="refresh" variant="ghost" className="eval-report-refresh" title="刷新报告列表" aria-label="刷新报告列表" disabled={refreshingReports} aria-busy={refreshingReports} onClick={() => void refreshReports()} />
              </div>
              {invalidRunRange && <p id="eval-date-error" className="eval-field-error" role="alert">开始日期不能晚于结束日期</p>}
              {!filteredRuns.length && !invalidRunRange && (
                <div className="eval-empty">
                  <Empty description={runStartDate || runEndDate || runStatusFilter !== "all" ? "暂无符合筛选条件的运行记录" : "还没有运行记录，先到“评测用例”选择用例并运行"} />
                </div>
              )}
              {visibleRuns.map((run) => {
                const points = run.buildReport ? undefined : runPoints(run)
                const billing = run.buildReport?.billing ?? {
                  knownTotal: points?.recorded ? points.execution + points.judging : null,
                  complete: !!points && pointsComplete(points),
                }
                const batch = {id:run.id,batchId:run.batchId,executionModel:run.models ? {configId:run.models.execution.id} : undefined}
                const latest = latestReportForExecutionModel(batch, runs.map(item => ({
                  id:item.id,batchId:item.batchId,executionModel:item.models ? {configId:item.models.execution.id} : undefined,
                })))
                return (
                <div className="eval-row eval-run-row eval-report-card" key={run.id}>
                  <div className="eval-report-heading">
                    <button
                      type="button"
                      className="eval-report-code"
                      aria-label={`${isActiveRun(run) ? "查看进度" : "查看报告"} ${run.code || runTitle(run.started)}`}
                      onClick={() => openView({ section: "runs", runId: run.id, report: !isActiveRun(run) })}
                    >
                      {run.code || runTitle(run.started)}
                    </button>
                    <span className="eval-status" data-status={!isActiveRun(run) ? "ended" : run.status}>{run.awaitingContinueAt ? "待继续" : !isActiveRun(run)?"已结束":run.status==="stop_unconfirmed"?"运行状态待确认":run.status==="judging"?"评分中":status(run.status)}</span>
                    {isInLatestReportBatch(batch, latest) && <span className="eval-report-latest">{run.models?.execution ? `${evaluationModelText(run.models.execution)} · 最新` : "最新"}</span>}
                    {run.sourceRunId && !run.recovery && <span className="eval-report-latest eval-report-retest">复测</span>}
                    {isActiveRun(run) && <strong className="eval-report-completion">已结束 {finishedCaseCount(run)}/{run.results.length}</strong>}
                  </div>
                  {isActiveRun(run) && run.results.length > 0 && <ReportProgress run={run} inList onCase={id => openView({section:"runs",runId:run.id,resultId:id,report:true})} />}
                  <div className="eval-report-result">
                    <div className="eval-report-kpi"><span>平均分</span><div className="eval-report-kpi-value"><strong>{qualitySummary(run.results).mean ?? "—"}</strong>{qualitySummary(run.results).grade && <span className={`grade grade-${qualitySummary(run.results).grade}`}>{qualitySummary(run.results).grade}</span>}</div></div>
                    <div className="eval-report-kpi"><span>通过率</span><div className="eval-report-kpi-value"><strong>{qualitySummary(run.results).count ? `${Math.round(qualitySummary(run.results).passed/qualitySummary(run.results).count*100)}%` : "—"}</strong>{qualitySummary(run.results).count>0 && <span>{qualitySummary(run.results).passed}/{qualitySummary(run.results).count}</span>}</div></div>
                    <div className="eval-report-findings">
                      {run.results.filter(r=>qualityOf(r).state==="质量未通过").sort((a,b)=>(qualityOf(a).total??100)-(qualityOf(b).total??100)).slice(0,1).map(r=><div key={r.id} className="eval-report-lowest"><span>最低分 {r.code} · {qualityOf(r).total}</span><span className="eval-report-reason">{qualityOf(r).issue}</span></div>)}
                      {qualitySummary(run.results).count<run.results.length && <div className="eval-report-lowest">已评分 {qualitySummary(run.results).count}/{run.results.length} · 当前结论仅基于已评分用例。</div>}
                      <div className="eval-report-outcomes">{run.results.filter(r=>qualityOf(r).state==="质量未通过").length>0 && <span className="eval-metric-failed">未通过 {run.results.filter(r=>qualityOf(r).state==="质量未通过").length}</span>}{qualitySummary(run.results).blocked>0 && <span className="eval-metric-unknown">环境阻塞 {qualitySummary(run.results).blocked}</span>}{run.results.some(r=>qualityOf(r).total==null) && <span className="eval-status">{isActiveRun(run)?"待评分":"未评分"} {run.results.length-qualitySummary(run.results).count}</span>}</div>
                    </div>
                  </div>
                  <div className="eval-report-details">
                    <div className="eval-report-models">{run.models?.execution && <span title={run.models.execution.name}>执行模型 <strong>{evaluationModelText(run.models.execution)}</strong></span>}{run.models?.judging && <span title={run.models.judging.name}>判定模型 {evaluationModelText(run.models.judging)}</span>}</div>
                    <div className="eval-muted eval-report-metadata"><button className="eval-report-case-link" onClick={()=>viewRunCases(run.id,"list")}>{run.results.length} 条用例</button><span title="秒（包含中断及等待）">总耗时 {run.ended === undefined && !isActiveRun(run) ? "—" : `${Math.round(Math.max(0, (run.ended ?? durationNow) - run.started) / 1000)} 秒`}</span><span>总点数 {billing.knownTotal?.toFixed(2) ?? "未记录"}{billing.knownTotal !== null && !billing.complete && " · 统计未完整"}</span></div>
                  </div>
                  <div className="eval-run-actions eval-report-secondary"><span className="eval-report-time">{runTitle(run.started)}</span>{repairAction(run,"ghost")}{!isActiveRun(run) && rerunMenu(run,false,true)}<Button variant="primary" size="large" className="eval-report-open" onClick={()=>openView({section:"runs",runId:run.id,report:!isActiveRun(run)})}>{isActiveRun(run)?"查看进度":"查看报告"}</Button></div>
                </div>
                )
              })}
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
            <div className="eval-report-surface" ref={reportSurface}>
              <div className="eval-report-toolbar">
                <Button variant="ghost" className="eval-return-to-list" onClick={()=>openView({section:"reports"})}><Icon name="arrow-left" size="small"/>返回报告列表</Button>
                {document.fullscreenEnabled && <Button variant="ghost" className="eval-report-fullscreen-toggle" aria-label={t(fullscreen ? "wiki.mermaid.exitFullscreen" : "wiki.mermaid.fullscreen")} title={t(fullscreen ? "wiki.mermaid.exitFullscreen" : "wiki.mermaid.fullscreen")} onClick={()=>{void (fullscreen ? document.exitFullscreen() : reportSurface.current?.requestFullscreen())}}><Icon name={fullscreen?"fullscreen-exit":"fullscreen-enter"} size="small" className="eval-fullscreen-icon"/></Button>}
              </div>
              <section className="eval-report-preview eval-report-unified">
                <header className="eval-report-cover"><div className="eval-report-title-row">
                  <div className="eval-report-identity">
                    <h2>{name} 评测报告</h2>
                    <div className="eval-report-identity-meta"><span className="eval-report-identity-code">{current.code}</span>
                      {!isActiveRun(current) && <span className="eval-status" data-status="ended">已结束</span>}
                    </div>
                  </div>
                  {currentActions}
                </div>
                {isActiveRun(current) && <ReportProgress run={current} onCase={id=>{openView({section:"runs",runId:current.id,resultId:id})}}/>}
                </header>
                {current.awaitingContinueAt && <p className="eval-notice" role="status">运行恢复后等待确认，已取得的证据保持不变。点击“继续评测”执行剩余用例。</p>}
                {current.status==="cancelled" && <p className="eval-notice">本地评测已停止，活动名额已释放。远端请求和计费的未知状态仍保留，不代表远端已确认结束。</p>}
                {!retestSource || !!retestReturn || current.status !== "completed" || current.recovery ? <div className="eval-report-tools" /> :
                  <EvaluationRetestComparison key={`retest-${current.id}`} source={retestSource} current={current}
                    open={expandedRetest === current.id} onToggle={() => setExpandedRetest(expandedRetest === current.id ? undefined : current.id)}
                    onSource={id => openView({section:"runs",runId:retestSource.id,resultId:id,report:true,retestReturn:current.id})}
                  />}
                <ReportPreview key={`preview-${current.id}`} html={currentReportHtml} focusCaseIndex={current.results.findIndex(c=>c.id===(resultId||focusCase))} onSession={id => {
                  const cases = buildReportData(current).cases
                  const index = cases.findIndex(item => item.sessionId === id)
                  if (index < 0) return
                  const [kind, target] = objectId.split(":")
                  const base = `/dev/${kind}/${encodeURIComponent(target)}/evaluation`
                  const query = new URLSearchParams(searchParams)
                  query.set("tab", "runs")
                  query.set("run", current.id)
                  query.set("view", "report")
                  if (current.results[index]) query.set("focusCase", current.results[index].id)
                  navigate(`${base}/execution/${encodeURIComponent(current.id)}/${encodeURIComponent(id)}?${query}`)
                }} />
              </section>
              {showDemoTools && isActiveRun(current) && <details className="eval-prototype-tools"><summary>异常恢复演示（仅原型）</summary><Button variant="ghost" onClick={()=>simulateAwaitingContinue(objectId,current.id)}>模拟重启后待继续</Button><Button variant="ghost" onClick={()=>requestCancelRun(objectId,current.id,true)}>模拟停止待核实</Button></details>}
            </div>
          )}
        </>
      )}
      </div>
    </section>
    </div>
  )
}
