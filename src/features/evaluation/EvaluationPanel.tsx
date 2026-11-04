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
import { resolveRerunModels, defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, type EvalModelIds, type EvalRunModels } from "@/services/evaluation-models"
import { useBlocker, useSearchParams, useNavigate, createSearchParams, type SetURLSearchParams } from "react-router"
import { EvaluationChat } from "./EvaluationChat"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useSync } from "@/stores/sync"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"

import { EvaluationDuration, useEvaluationClock } from "./EvaluationDuration"
import { caseDuration, caseDurationNote, runDuration, runDurationNote } from "@/services/evaluation-duration"
import { ReportPreview } from "./ReportPreview"
import { buildReportDocument } from "./report-document"
import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from "react"
import { Empty, SegmentedControl, BrandButton, Button, ConfirmDialog, Tooltip, DropdownMenu, Icon, useDialog } from "@/ui"
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
  function viewRunCases(id: string, origin: "list" | "report" | "run") {
    setCaseSearch(""); setCasePage(1); setSelected([])
    const next = new URLSearchParams(searchParams)
    for (const key of ["run", "case", "view", "version", "scopeRun", "caseRun", "caseFrom"]) next.delete(key)
    next.set("tab", "reports"); next.set("caseRun", id); next.set("caseFrom", origin)
    setSearchParams(next)
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
  const runPageSize = 10
  const runPageCount = Math.max(1, Math.ceil(filteredRuns.length / runPageSize))
  const currentRunPage = Math.min(runPage, runPageCount)
  const visibleRuns = filteredRuns.slice((currentRunPage - 1) * runPageSize, currentRunPage * runPageSize)
  const [caseSearch, setCaseSearch] = useState("")
  const [casePage, setCasePage] = useState(1)
  const casePageSize = 10
  const filteredCases = cases.filter(c => `${c.code || ""} ${c.name}`.toLocaleLowerCase().includes(caseSearch.trim().toLocaleLowerCase()))
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
  function caseMeta(c: EvalCase, changed = "") {
    return <span className="eval-case-meta eval-muted">
      {c.code && <><span className="eval-case-code">{c.code}</span><span aria-hidden="true">·</span></>}
      <span>{turnsOf(c).length} 轮对话{changed}</span>
    </span>
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
    if (!saveCases(objectId, [...cases, completeEvaluationSample(name), ...next.filter(c => c.outcome !== "blocked"), { ...structuredClone(next[0]), id: crypto.randomUUID(), name: "判定服务超时（业务执行成功）", demoJudgingFailure: "timeout", demoJudgingDelayMs: 3000 }, ...failures])) return
    setNotice("已添加 7 条示例用例", true)
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
        {primary ? <BrandButton variant="primary" disabled={busy}>{label}</BrandButton> : <Button variant={outlined ? "secondary" : "ghost"} disabled={busy}>{label}</Button>}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal><DropdownMenu.Content>
        <DropdownMenu.Item onSelect={() => requestRerun(run)}>本次全部用例（{run.results.length}）</DropdownMenu.Item>
        <DropdownMenu.Item disabled={!unsuccessful.length} onSelect={() => requestRerun(run, true)}>不通过及无法判定用例（{unsuccessful.length}）</DropdownMenu.Item>
      </DropdownMenu.Content></DropdownMenu.Portal>
    </DropdownMenu>
  }
  function repairAction(run: EvalRun, variant: "ghost" | "secondary") {
    if (repairDisabledReason(objectId, run, !!evaluationRepairObject(objectId))) return null
    return <Tooltip value={openingRepair ? "正在打开开发会话" : "先分析问题与修复方案，确认后修改原对象，再手动复测"}>
      <Button variant={variant} className="eval-repair-action" disabled={openingRepair} onClick={() => void repair(run)}>{findRepairSession(objectId, run) ? "继续修复" : "分析并修复"}</Button>
    </Tooltip>
  }
  const currentActions = current && (
                <div className="eval-actions eval-current-actions">
                  <DropdownMenu placement="bottom-end"><DropdownMenu.Trigger asChild><Button variant="ghost">更多 <Icon name="chevron-down" size="small" /></Button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content>
                    <DropdownMenu.Item onSelect={() => viewRunCases(current.id, "report")}>查看用例</DropdownMenu.Item>
                    <DropdownMenu.Item disabled={isActiveRun(current)} onSelect={() => exportReport(current)}>下载报告</DropdownMenu.Item>
                  </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu>
                  {repairAction(current, "secondary")}
                  {isActiveRun(current) ? (
                    <Button variant="secondary" disabled={["stopping", "stop_unconfirmed"].includes(current.status)} onClick={() => requestCancelRun(objectId, current.id)}>{["stopping", "stop_unconfirmed"].includes(current.status) ? "停止处理中…" : tr("stop")}</Button>
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
              <div className="eval-case-controls" data-current={!historical || undefined}>
              {!!cases.length && !historical && <div className="eval-toolbar eval-case-toolbar">
                <div className="eval-actions eval-case-toolbar-actions">
                  <div className="eval-actions eval-case-create-actions">
                  <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
                  </div>
                  <BrandButton variant="primary" disabled={!busy && !cases.length} onClick={() => { if (activeRun) openView({ section: "runs", runId: activeRun.id }); else configureRun(selectedCases.length ? selectedCases : cases, selectedCases.length ? "selected" : "all") }}>
                    {busy ? "查看当前运行" : selectedCases.length ? `运行选中（${selectedCases.length}）` : `运行全部（${cases.length}）`}
                  </BrandButton>
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

                  {!!selectedCases.length && <><span aria-live="polite">已选 {selectedCases.length} 条{selectionDetails ? `（${selectionDetails}）` : ""}</span><Button variant="ghost" onClick={() => setSelected([])}>取消选择</Button><Button variant="ghost" className="eval-danger-action" onClick={() => removeCases(selectedCases.map(c => c.id))}>删除</Button></>}
                  </div>
              </>}{caseSearch.trim() && !!cases.length && !selectedCases.length && !busy && <p className="eval-muted">运行范围包含搜索结果之外的用例，共 {cases.length} 条。</p>}
              {filteredCases.length ? (
                <>
                  {visibleCases.map((c) => historical ? (
                    <details className="eval-history-case" key={`${historicalRun?.id}:${c.id}`}>
                      <summary onClick={e => { if (e.detail > 0 && hasSelectedText(e.currentTarget)) e.preventDefault() }}>
                        <Icon name="chevron-down-16" size="small" />
                        <span className="eval-grow"><span className="eval-title eval-case-name" title={c.name}>{c.name}</span>{caseMeta(c)}</span>
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
                        <button type="button" className="eval-list-name eval-title eval-case-toggle" aria-expanded={expandedCases.includes(c.id)} aria-controls={`case-content-${c.id}`} onClick={e => { if (e.detail > 0 && hasSelectedText(e.currentTarget)) return; setExpandedCases(ids => ids.includes(c.id) ? ids.filter(id => id !== c.id) : [...ids, c.id]) }}><Icon name="chevron-down-16" size="small" /><span className="eval-case-name" title={c.name}>{c.name}</span></button>
                        <div className="eval-current-meta">{caseMeta(c, (() => { const previous = baseline.get(c.id); return !previous ? " · 新增" : JSON.stringify(previous) !== JSON.stringify(c) ? " · 已修改" : "" })())}</div>
                      </div>
                      {!historical && <><Button variant="ghost" onClick={() => setDraft(draft?.id === c.id ? draft : structuredClone(c))}>{tr("edit")}</Button>
                      <Button variant="ghost" className="eval-danger-action" onClick={() => removeCases([c.id])}>{tr("delete")}</Button></>}
                    </div>
                    {expandedCases.includes(c.id) && <div id={`case-content-${c.id}`} className="eval-history-content"><CaseDetail value={c} embedded /></div>}
                    </div>
                  ))}
                </>
              ) : (
                <div className="eval-empty">
                  {!cases.length && !historical ? <>
                    <Empty description="" />
                    <p className="eval-empty-description">在左侧对话中描述具体要求，AI 会帮你生成评测用例；也可以导入已有用例。</p>
                    <div className="eval-actions eval-empty-actions">
                      <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
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
                <EvaluationSelect id="eval-run-status" title="按运行状态筛选" label="运行状态" value={runStatusFilter}
                  onChange={value => { setRunStatusFilter(value); setRunPage(1) }}
                  options={[
                    { value: "all", label: "全部状态" },
                    { value: "active", label: "进行中" },
                    { value: "completed", label: "已完成" },
                    { value: "cancelled", label: "已停止" },
                    { value: "abnormal", label: "异常" },
                  ]} />
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
              </div>
              {invalidRunRange && <p id="eval-date-error" className="eval-field-error" role="alert">开始日期不能晚于结束日期</p>}
              {!filteredRuns.length && !invalidRunRange && (
                <div className="eval-empty">
                  <Empty description={runStartDate || runEndDate || runStatusFilter !== "all" ? "暂无符合筛选条件的运行记录" : "还没有运行记录，先到“评测用例”选择用例并运行"} />
                </div>
              )}
              {visibleRuns.map((run) => (
                <div className="eval-row eval-run-row eval-report-card" key={run.id}>
                  <div className="eval-report-heading">
                    <span className="eval-report-code" style={{ userSelect: "text", WebkitUserSelect: "text" }}>{run.code || runTitle(run.started)}</span>
                    <span className="eval-report-state">{status(run.status)}</span>
                    {run.id === runs.find(r => !isActiveRun(r))?.id && <span className="eval-report-latest">最新</span>}
                  </div>
                  <Button variant="ghost" className="eval-report-primary" onClick={() => openView({ section: "runs", runId: run.id, report: !isActiveRun(run) })}>
                    {isActiveRun(run) ? "查看进度" : "查看报告"}
                  </Button>
                  <div className="eval-report-metrics">
                    <span><strong>{run.results.length}</strong> 条用例</span>
                    {(["通过", "不通过", "无法判定"] as const).map(label => {
                      const count = run.results.filter(c => verdictLabel(c) === label).length
                      return <span key={label} className={count ? label === "不通过" ? "eval-metric-failed" : label === "无法判定" ? "eval-metric-unknown" : "" : "eval-metric-zero"}>{label} <strong>{count}</strong></span>
                    })}
                  </div>
                  <div className="eval-muted eval-report-metadata">
                    <span>{runTitle(run.started)}</span>
                    <EvaluationDuration label="耗时" value={runDuration(run, durationNow)} note={runDurationNote} />
                    <span>{pointsText(runPoints(run))}</span>
                  </div>
                  <div className="eval-run-actions eval-report-secondary">
                  <Button variant="ghost" onClick={() => viewRunCases(run.id, "list")}>查看用例</Button>
                  {!isActiveRun(run) && rerunMenu(run)}
                  {repairAction(run, "ghost")}

                  </div>
                </div>
              ))}
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
              <ReportPreview key={current.id} html={buildReportDocument(current, t)} actions={currentActions} status={status(current.status)} focusCaseIndex={current.results.findIndex(c => c.id === (resultId || focusCase))} />
            </>
          )}
        </>
      )}
    </section>
    </div>
  )
}
