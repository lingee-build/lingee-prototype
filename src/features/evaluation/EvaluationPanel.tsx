import { DatePicker } from "@/ui/date-picker/DatePicker"
import { basicEvaluationSample, completeEvaluationSample } from "@/services/evaluation-samples"
import { runPoints, pointsText, resumeRunPoints, updateAutomaticPoints } from "@/services/evaluation-points"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { devStore } from "@/mock/dev-store"
import { evaluationRepairObject, repairPrompt, repairDisabledReason, registerEvaluationRepair } from "@/services/evaluation-repair"
import { EvaluationSelect } from "./EvaluationSelect"
import { RunEvaluationDialog } from "./RunEvaluationDialog"
import { ImportCases } from "./ImportCases"
import { defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, type EvalModelIds, type EvalRunModels } from "@/services/evaluation-models"
import { useBlocker, useNavigate, useSearchParams } from "react-router"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useSync } from "@/stores/sync"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"
import { RoundResults } from "./RoundResults"
import { RunPointsSummary } from "./RunPointsSummary"
import { EvaluationDuration, useEvaluationClock } from "./EvaluationDuration"
import { caseDuration, caseDurationNote, runDuration, runDurationNote } from "@/services/evaluation-duration"
import { ReportPreview } from "./ReportPreview"
import { buildReportDocument } from "./report-document"
import { useEffect, useState } from "react"
import { Empty, SegmentedControl, BrandButton, Button, IconButton, ConfirmDialog, Tooltip, DropdownMenu, Icon, useDialog } from "@/ui"
import { useT, useLocaleStore } from "@/i18n"
import {
  turnsOf,
  latestRunCases,
  failedRunResults,
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
const sources: Source[] = ["none", "tenant", "thirdParty", "personal"]
export function EvaluationPanel({ objectId, name, onEnvironmentChange, onDetailChange }: { objectId: string; name: string; onEnvironmentChange?: (environment: EvalEnvironment | undefined) => void; onDetailChange?: (detail: boolean) => void }) {
  const editSession = useEditSession()
  const [openingRepair, setOpeningRepair] = useState(false)
  async function repair(run: EvalRun, resultId?: string) {
    const target = evaluationRepairObject(objectId)
    const draft = repairPrompt(objectId, run, resultId)
    if (!target || !draft || openingRepair || repairDisabledReason(objectId, run, !!target, resultId)) return
    setOpeningRepair(true)
    try {
      const session = await editSession({ title: `修复评测问题 · ${name}`, draft, projectId: target.projectId, requireProject: true, target: target.editTarget })
      if (session) registerEvaluationRepair(session, draft, { objectType: target.objectType, objectId: target.objectId, runId: run.id, resultId })
      else setNotice("评测对象所属项目不存在或不可用，请恢复所属项目后重试")
    } catch { setNotice(`无法打开${objectId.startsWith("agent:") ? "智能体" : "技能"}开发会话，请重试`) }
    finally { setOpeningRepair(false) }
  }
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const state = useEvaluation()
  const dialog = useDialog()
  const cases = state.cases[objectId] || []
  const runs = state.runs[objectId] || []
  const [searchParams, setSearchParams] = useSearchParams()
  const runId = searchParams.get("run") || undefined
  const resultId = searchParams.get("case") || undefined
  const reportHome = searchParams.get("tab") === "reports" && !runId
  const reportRequested = searchParams.get("view") === "report" || reportHome
  const section = runId || resultId || reportRequested || searchParams.get("tab") === "runs" ? "runs" : "cases"
  function openView(view: { section: "cases" | "runs" | "reports"; runId?: string; resultId?: string; report?: boolean }) {
    const next = new URLSearchParams(searchParams)
    for (const key of ["tab", "run", "case", "view", "focusCase"]) next.delete(key)
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
  const filteredCases = cases.filter(c => c.name.toLocaleLowerCase().includes(caseSearch.trim().toLocaleLowerCase()))
  const casePageCount = Math.max(1, Math.ceil(filteredCases.length / casePageSize))
  const currentCasePage = Math.min(casePage, casePageCount)
  const visibleCases = filteredCases.slice((currentCasePage - 1) * casePageSize, currentCasePage * casePageSize)
  const [selected, setSelected] = useState<string[]>([])
  const [runSetup, setRunSetup] = useState<{ cases: EvalCase[]; scope: string; original?: EvalRun; initial: EvalModelIds; defaults: EvalModelIds; missingCount: number }>()
  const [locatedCase, setLocatedCase] = useState<{ id: string }>()
  useEffect(() => {
    if (!locatedCase) return
    const timer = setTimeout(() => setLocatedCase(undefined), 3000)
    return () => clearTimeout(timer)
  }, [locatedCase])
  const navigate = useNavigate()
  const startGeneration = () => {
    const target = objectId.startsWith("skill:") ? devStore.skills.find(s => `skill:${s.id}` === objectId) : devStore.agents.find(a => `agent:${a.id}` === objectId)
    const project = useSync.getState().projects.find(p => p.id === target?.projectId)
    if (!project) { setNotice("评测对象所属项目不存在或不可用，请先恢复所属项目后重试"); return }
    navigate(`/p/${project.id}/session?evaluation=${encodeURIComponent(objectId)}`)
  }
  const [viewCaseId, setViewCaseId] = useState<string>()
  const viewCase = cases.find(c => c.id === viewCaseId)
  const [importOpen, setImportOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const draft = state.drafts[objectId]
  const setDraft = (value: EvalCase | undefined) => {
    setEditorOpen(!!value)
    useEvaluation.setState((s) => ({ drafts: { ...s.drafts, [objectId]: value } }))
  }
  const [notice, updateNotice] = useState({ text: "", transient: false })
  function setNotice(text: string, transient = false) { updateNotice({ text, transient }) }
  useEffect(() => {
    if (!notice.text || !notice.transient) return
    const timer = setTimeout(() => updateNotice({ text: "", transient: false }), 3000)
    return () => clearTimeout(timer)
  }, [notice])
  const current = reportHome ? runs.find(r => !isActiveRun(r)) : runs.find((r) => r.id === runId)
  const focusCase = searchParams.get("focusCase")
  useEffect(() => {
    if (!focusCase || !current || resultId || reportRequested) return
    const row = document.getElementById(`eval-case-result-${focusCase}`)
    if (row) {
      setLocatedCase({ id: focusCase })
      row.scrollIntoView({ block: "center", behavior: "instant" })
      row.focus({ preventScroll: true })
    }
  }, [focusCase, current?.id, resultId, reportRequested])
  useEffect(() => {
    for (const run of useEvaluation.getState().runs[objectId] || []) resumeRunPoints(objectId, run.id)
    void updateAutomaticPoints()
  }, [objectId, runId])
  const report = reportRequested && !!current && !isActiveRun(current)
  const durationNow = useEvaluationClock(section === "runs" && !report && (current ? isActiveRun(current) : visibleRuns.some(isActiveRun)))
  useEffect(() => { onEnvironmentChange?.(section === "runs" && current ? current.environment : currentEvaluationEnvironment) }, [section, current?.id, current?.environment, onEnvironmentChange])
  const detailOpen = section === "cases" ? !!viewCase || !!(editorOpen && draft) : !!current
  useEffect(() => { onDetailChange?.(detailOpen); return () => onDetailChange?.(false) }, [detailOpen, onDetailChange])
  const result = current?.results.find((c) => c.id === resultId)
  const locationError = !runId && !reportHome && (resultId || reportRequested) ? "详情链接缺少运行编号，请返回运行记录列表。"
    : runId && !current ? "指定运行记录不存在或已不可访问，请返回运行记录列表。"
    : resultId && !result ? "本次运行中不存在指定用例结果，请返回本次运行。"
    : ""
  const repairReason = openingRepair ? "正在打开开发会话" : current ? repairDisabledReason(objectId, current, !!evaluationRepairObject(objectId), result?.id) : ""
  const selectedCases = cases.filter((c) => selected.includes(c.id))
  const selectedOutsideSearch = selectedCases.filter(c => !filteredCases.some(item => item.id === c.id)).length
  const selectedOnOtherPages = selectedCases.filter(c => filteredCases.some(item => item.id === c.id) && !visibleCases.some(item => item.id === c.id)).length
  const selectionDetails = [selectedOutsideSearch && `搜索结果外 ${selectedOutsideSearch} 条`, selectedOnOtherPages && `其他页 ${selectedOnOtherPages} 条`].filter(Boolean).join("，")
  const savedDraft = draft ? cases.find((c) => c.id === draft.id) : undefined
  const draftChanged = !!draft && (savedDraft ? JSON.stringify(draft) !== JSON.stringify(savedDraft) : !!(draft.checks?.length || draft.name.trim() || turnsOf(draft).some(t => t.input.trim() || t.checks?.length || t.expected.trim() || t.attachments.length || t.rules.length) || draft.attachments?.length))
  const unsaved = (editorOpen && draftChanged) || importOpen
  const blocker = useBlocker(unsaved)
  const activeRun = runs.find(isActiveRun)
  const busy = !!activeRun
  const tr = (key: string) => t(`proto.eval.${key}`)
  const date = (time: number) =>
    new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "short", timeStyle: "medium" }).format(time)
  useEffect(() => {
    if (!unsaved) return
    const handler = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [unsaved])
  function configureRun(list: EvalCase[], scope: string, original?: EvalRun, missingCount = 0) {
    if (!list.length || busy) return
    const defaults = { execution: evaluationExecutionDefault(useSync.getState().models), judging: defaultJudgingModelId(useSync.getState().models) }
    const latest = runs.find(run => run.models)
    setRunSetup({ cases: list, scope, original, defaults, missingCount, initial: initialEvaluationModelIds(defaults, latest, original) })
  }
  function begin(models: EvalRunModels) {
    if (!runSetup) return
    if (useEvaluation.getState().runs[objectId]?.some(isActiveRun)) throw new Error(tr("models.busy"))
    const saved = useEvaluation.getState().cases[objectId] || []
    const list = runSetup.cases.map(item => saved.find(c => c.id === item.id))
    if (list.some(item => !item)) throw new Error(tr("models.casesChanged"))
    const id = startRun(objectId, name, list as EvalCase[], currentEvaluationEnvironment, models)
    if (!id) throw new Error(tr(useEvaluation.getState().error ? "models.storageFailed" : "models.startFailed"))
    setRunSetup(undefined)
    setRunPage(1)
    openView({ section: "runs", runId: id })
  }
  function rerun(run: EvalRun, ids = run.results.map(c => c.id), scope = "rerunAll") {
    if (!ids.length || busy) return
    const latest = latestRunCases(objectId, run, ids)
    if (!latest.cases.length) {
      dialog.show(() => <ConfirmDialog title="无法重新运行" description="所选范围内的用例已全部删除，请返回用例列表选择用例" confirmText="返回用例列表" cancelText="取消" onConfirm={() => openView({ section: "cases" })} />)
      return
    }
    configureRun(latest.cases, scope, run, latest.missing.length)
  }
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
    a.download = `评测报告-${run.id}.html`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const status = (value: string) => (
    <span className="eval-status" data-status={value}>
      {tr(value)}
    </span>
  )
  const currentActions = current && (
                <div className="eval-actions">
                  {!result && <Tooltip value={repairReason || "携带失败证据进入原对象开发对话，检查修改后手动复测"}>
                    <Button variant="secondary" className="eval-repair-action" aria-disabled={!!repairReason} onClick={() => { if (!repairReason) void repair(current) }}>修复问题</Button>
                  </Tooltip>}
                  {isActiveRun(current) ? (
                    <Button variant="secondary" disabled={["stopping", "stop_unconfirmed"].includes(current.status)} onClick={() => requestCancelRun(objectId, current.id)}>{["stopping", "stop_unconfirmed"].includes(current.status) ? "停止处理中…" : tr("stop")}</Button>
                  ) : (
                    <>
                      {report ? <Button variant="secondary" onClick={() => exportReport(current)}>下载报告</Button> : <Button variant="secondary"
                        onClick={() => openView({ section: "runs", runId: current.id, report: true })}
                      >
                        {tr("report")}
                      </Button>}
                      {!result && <DropdownMenu placement="bottom-end">
                        <DropdownMenu.Trigger asChild>
                          <BrandButton variant="primary" disabled={busy} title={busy ? "当前对象有活动评测，请等待结束" : "选择范围，使用最新已保存内容运行"}>重新运行 <Icon name="chevron-down" size="small" /></BrandButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal><DropdownMenu.Content>
                          <DropdownMenu.Item onSelect={() => rerun(current)}>本次全部用例（{current.results.length}）</DropdownMenu.Item>
                          <DropdownMenu.Item disabled={!failedRunResults(current).length} onSelect={() => rerun(current, failedRunResults(current).map(c => c.id), "failed")}>不通过用例（{failedRunResults(current).length}）</DropdownMenu.Item>
                        </DropdownMenu.Content></DropdownMenu.Portal>
                      </DropdownMenu>}
                    </>
                  )}
                </div>
  )

  return (
    <section className="eval-panel" data-view={section} aria-label={tr("title")}>
      {runSetup && <RunEvaluationDialog name={name} count={runSetup.cases.length} scope={tr(`models.${runSetup.scope}`)}
        initial={runSetup.initial} defaults={runSetup.defaults} rerun={!!runSetup.original} missingCount={runSetup.missingCount}
        onClose={() => setRunSetup(undefined)} onStart={begin} />}
      <ControlledConfirmDialog open={blocker.state === "blocked"} title="放弃本次修改？" description="离开后，本次未保存的用例修改将被丢弃" confirmText="放弃并离开" cancelText="继续编辑" variant="danger"
        onConfirm={() => { if (blocker.state === "blocked") { setDraft(undefined); setImportOpen(false); blocker.proceed() } }}
        onClose={() => { if (blocker.state === "blocked") blocker.reset() }} />
      {state.error && <p role="alert">{tr("storageError")}</p>}
      <div aria-live="polite" className="eval-muted">
        {notice.text}
      </div>
      {importOpen ? <ImportCases objectId={objectId} close={() => { setImportOpen(false); setNotice("导入已结束，请查看用例列表", true) }} /> : locationError ? (
        <div className="eval-empty"><p role="alert">{locationError}</p><Button variant="ghost" onClick={() => openView({ section: "runs", runId: current?.id })}>{current ? "返回本次运行" : "返回运行记录"}</Button></div>
      ) : editorOpen && draft && section === "cases" ? (
        <CaseEditor draft={draft} update={setDraft} editing={!!savedDraft} cancel={() => {
          if (!draftChanged) { setDraft(undefined); return }
          dialog.show(() => <ConfirmDialog title="放弃本次修改？" description="本次未保存的用例修改将被丢弃" cancelText="继续编辑" confirmText="放弃修改" variant="danger" onConfirm={() => setDraft(undefined)} />)
        }} save={value => {
          if (!saveCases(objectId, savedDraft ? cases.map(c => c.id === value.id ? value : c) : [...cases, value])) return
          setDraft(undefined); setNotice(tr("saved"), true)
        }} />
      ) : viewCase && section === "cases" ? (
        <CaseDetail value={viewCase} back={() => setViewCaseId(undefined)} edit={() => {
          setDraft(draft?.id === viewCase.id ? draft : structuredClone(viewCase))
        }} />
      ) : (
        <>
          <nav className="eval-tabs light-segmented" aria-label={tr("title")}>
            <SegmentedControl
              value={section}
              onChange={value => openView({ section: value === "runs" ? "reports" : "cases" })}
              items={["cases", "runs"].map(value => ({
                value,
                label: `${value === "cases" ? "评测用例" : "评测报告"} (${value === "cases" ? cases.length : runs.length})`,
              }))}
            />
          </nav>
          {section === "runs" && <div className="eval-toolbar eval-report-switcher">
            {reportHome ? <strong>最新报告</strong> : report ? <div className="eval-actions"><Button variant="ghost" onClick={() => openView({ section: "runs" })}>返回历史报告</Button><span>历史报告</span></div> : <strong>历史报告</strong>}
            <div className="eval-actions"><Button variant="ghost" onClick={() => openView({ section: reportHome ? "runs" : "reports" })}>{reportHome ? "查看历史报告" : "最新报告"}</Button>
            {activeRun && <Button variant="secondary" onClick={() => openView({ section: "runs", runId: activeRun.id })}>查看当前任务进度</Button>}</div>
          </div>}
          {reportHome && !current && <div className="eval-empty"><p>暂无已结束的评测报告</p><Button onClick={() => openView({ section: "cases" })}>准备并运行用例</Button></div>}
          {section === "cases" && (
            <div className="eval-case-list">
              {!!cases.length && <><div className="eval-toolbar eval-case-toolbar">
                  <input className="eval-case-search" type="search" aria-label="搜索用例名称" placeholder="搜索用例名称" value={caseSearch}
                    onChange={e => { setCaseSearch(e.target.value); setCasePage(1) }} />
                <div className="eval-actions eval-case-toolbar-actions">
                  <div className="eval-actions eval-case-create-actions"><Button variant="secondary" onClick={startGeneration}>AI生成</Button>
                  <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
                  </div>
                  <BrandButton variant="primary" disabled={!busy && !cases.length} onClick={() => { if (activeRun) openView({ section: "runs", runId: activeRun.id }); else configureRun(selectedCases.length ? selectedCases : cases, selectedCases.length ? "selected" : "all") }}>
                    {busy ? "查看当前运行" : selectedCases.length ? `运行选中（${selectedCases.length}）` : `运行全部（${cases.length}）`}
                  </BrandButton>
                </div>
              </div>
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
                  {visibleCases.map((c) => (
                    <div className="eval-row" key={c.id}>
                      <label className="eval-check">
                        <input
                          type="checkbox"
                          aria-label={`${tr("select")} ${c.name}`}
                          checked={selected.includes(c.id)}
                          onChange={(e) => setSelected(e.target.checked ? [...selected, c.id] : selected.filter((id) => id !== c.id))}
                        />
                      </label>
                      <div className="eval-grow">
                        <button type="button" className="eval-list-name eval-title" onClick={() => setViewCaseId(c.id)}>{c.name}</button>
                        <p className="eval-muted">{turnsOf(c).length} 轮对话</p>
                      </div>
                      <Button variant="ghost" onClick={() => setDraft(draft?.id === c.id ? draft : { ...c })}>{tr("edit")}</Button>
                      <Button variant="ghost" className="eval-danger-action" onClick={() => removeCases([c.id])}>{tr("delete")}</Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="eval-empty">
                  <Empty description={cases.length ? "未找到匹配的用例" : "还没有评测用例"} />
                  {!cases.length && <div className="eval-actions eval-empty-actions">
                    <BrandButton variant="primary" onClick={startGeneration}>AI生成</BrandButton>
                    <Button variant="secondary" onClick={() => setImportOpen(true)}>导入用例</Button>
                  </div>}
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
              <details className="eval-prototype-tools" aria-label="原型辅助">
                <summary>原型演示工具</summary>
                <Tooltip value="用于演示，不纳入正式功能"><Button variant="ghost" className="eval-prototype-action" onClick={samples}>
                  {tr("samples")}（仅原型）
                </Button></Tooltip>
              </details>
            </div>
          )}
          {section === "runs" && !current && !reportHome && (
            <>
              <div className="eval-date-filter" role="group" aria-label="运行记录筛选">
                <EvaluationSelect id="eval-run-range" title="按运行开始时间筛选" label="运行开始时间" value={runRangePreset} onChange={applyRunRange} options={[
                  { value: "all", label: "全部时间" }, { value: "today", label: "今天" }, { value: "yesterday", label: "昨天" },
                  { value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "custom", label: "自定义" },
                ]} />
                <EvaluationSelect id="eval-run-status" title="按运行状态筛选" label="运行状态" value={runStatusFilter}
                  onChange={value => { setRunStatusFilter(value); setRunPage(1) }}
                  options={[
                    { value: "all", label: "全部状态" },
                    { value: "active", label: "进行中" },
                    { value: "completed", label: "已完成" },
                    { value: "cancelled", label: "已停止" },
                    { value: "abnormal", label: "异常" },
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
                <div className="eval-row eval-run-row" key={run.id}>
                  <div className="eval-grow">
                    <button className="eval-title eval-list-name" onClick={() => openView({ section: "runs", runId: run.id, report: !isActiveRun(run) })}>{date(run.started)}</button>
                    <p className="eval-muted eval-meta-line">
                      <span>{run.results.length} {tr("caseUnit")} · {run.results.filter((c) => verdictLabel(c) === "通过").length} {tr("passed")} · {run.results.filter(c => verdictLabel(c) === "不通过").length} 不通过 · {run.results.filter(c => verdictLabel(c) === "无法判定").length} 无法判定</span>
                      <span>{pointsText(runPoints(run))}</span>
                      <EvaluationDuration label="耗时" value={runDuration(run, durationNow)} note={runDurationNote} />
                    </p>
                  </div>
                  <div className="eval-run-actions">
                  {status(run.status)}
                  <Button variant="ghost"
                    onClick={() => openView({ section: "runs", runId: run.id, report: !isActiveRun(run) })}
                  >
                    {tr("view")}
                  </Button>
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
              <div className="eval-toolbar" hidden={report}>
                {!reportHome && <IconButton icon="arrow-left" variant="ghost" className="!text-[var(--text-weak)]" iconClass="!text-[var(--text-weak)]"
                  aria-label={resultId || reportRequested ? "返回本次运行" : "返回运行记录"} title={resultId || reportRequested ? "返回本次运行" : "返回运行记录"}
                  onClick={() => openView({ section: "runs", runId: resultId || (reportRequested && !reportHome) ? current.id : undefined })}
                />}
                {!report && currentActions}
              </div>
              {reportRequested && isActiveRun(current) && <p role="status">评测尚未结束，暂不能查看最终报告；当前显示本次运行进度。</p>}
              {!report && <div className="eval-summary">
                <div className="eval-toolbar" style={{ margin: 0 }}>
                  <h3>{date(current.started)}</h3>
                  <div className="eval-actions">
                    {status(current.status)}
                  </div>
                </div>
                {current.status === "judging" && <p role="status">业务执行已结束，正在完成标准判定；判定结束前不能重跑或下载最终报告。</p>}
                {current.status === "stopping" && <p role="status">正在停止执行与判定任务，保留已有证据；确认停止前不能重跑。</p>}
                {current.stopReason && <p role="status">{current.status === "cancelled" ? "已确认运行停止。" : current.stopReason}</p>}
                <details className="eval-muted"><summary>运行信息</summary><p>评测时的{current.objectType === "agent" ? "智能体" : "技能"}版本：{current.objectContentSummary || "未记录"}</p>
                  <p>{tr("models.execution")}：{evaluationModelText(current.models?.execution, tr("models.unrecorded"))}</p>
                  <p>{tr("models.judging")}：{evaluationModelText(current.models?.judging, tr("models.unrecorded"))}</p>
                  <p>运行编号：{current.id}</p></details>
                <p className="eval-muted">{current.objectType === "agent" ? "智能体" : current.objectType === "skill" ? "技能" : "评测对象"} · {current.name} · {environmentLabel(current.environment)}</p>
                <RunPointsSummary key={current.id} objectId={objectId} run={current} duration={<EvaluationDuration label="耗时" value={runDuration(current, durationNow)} note={runDurationNote} />} />
                <div className="eval-counts">
                  {["通过", "不通过", "无法判定"].map((s) => (
                    <span key={s}>
                      <strong>{current.results.filter((c) => verdictLabel(c) === s).length}</strong>
                      {s}
                    </span>
                  ))}
                </div>
                {!result && current.results.length > 0 && (
                  <div>
                    <p aria-live="polite">
                      {finishedCaseCount(current)} / {current.results.length}{" "}
                      {tr("completedCases")}
                    </p>
                    <nav className="eval-case-progress" aria-label="用例运行进度">
                      {current.results.map((c, index) => {
                        const label = ["pending", "running", "cancelled", "skipped"].includes(c.status) ? executionLabel(c) : verdictLabel(c)
                        const color = ["pending", "running", "cancelled", "skipped"].includes(c.status) ? c.status : c.verdict || (c.status === "blocked" ? "unknown" : c.status)
                        return <Tooltip key={c.id} className="eval-progress-segment" value={`${c.name} · ${label}`}>
                          <button type="button" className="eval-progress-link" data-status={color}
                            aria-label={`定位第 ${index + 1} 条用例：${c.name}，${label}`}
                            onClick={() => {
                              setLocatedCase({ id: c.id })
                              const row = document.getElementById(`eval-case-result-${c.id}`)
                              row?.scrollIntoView({ block: "center", behavior: "instant" })
                              row?.focus({ preventScroll: true })
                            }}><span aria-hidden="true" /></button>
                        </Tooltip>
                      })}
                    </nav>
                  </div>
                )}
              </div>}
              {report && !isActiveRun(current) && <ReportPreview html={buildReportDocument(current, t)} actions={currentActions} />}
              {!report && !result &&
                current.results.map((c) => (
                  <div key={c.id} id={`eval-case-result-${c.id}`} tabIndex={-1} data-located={locatedCase?.id === c.id || undefined} className="eval-row eval-result-row">
                    <div className="eval-grow">
                      <button
                        className="eval-title"
                        onClick={() => openView({ section: "runs", runId: current.id, resultId: c.id })}
                      >
                        {c.name}
                      </button>
                      {resultIssueSummary(c) && <p className="eval-result-summary">{resultIssueSummary(c)}</p>}
                      <p className="eval-muted"><EvaluationDuration label="耗时" value={caseDuration(c, current, durationNow)} note={caseDurationNote} /></p>
                    </div>
                    <div className="eval-result-state">
                      <span className="eval-status" data-status={c.verdict || c.status}>{verdictLabel(c)}</span>
                      {executionLabel(c) !== "已完成" && <span className="eval-muted">{executionLabel(c)}</span>}
                    </div>
                    <div className="eval-actions eval-result-actions">
                      <Button variant="ghost" onClick={() => openView({ section: "runs", runId: current.id, resultId: c.id })}>{tr("view")}</Button>
                      {!isActiveRun(current) && verdictLabel(c) !== "通过" && <Button variant="ghost" disabled={busy} onClick={() => rerun(current, [c.id], "single")} title={busy ? "当前对象有活动评测，请等待结束" : `仅重新运行：${c.name}`}>重新运行</Button>}
                    </div>
                  </div>
                ))}
              {!report && result && (
                <>
                  <div className="eval-toolbar">
                    <div className="eval-grow">
                      <h3>{result.name}</h3>
                      <p className="eval-muted"><EvaluationDuration label="耗时" value={caseDuration(result, current, durationNow)} note={caseDurationNote} /></p>
                    </div>
                    <div className="eval-actions">
                      <span className="eval-status" data-status={result.verdict || result.status}>{verdictLabel(result)}</span>
                    </div>
                  </div>
                  <RoundResults result={result} />
                </>
              )}
              {!report && isActiveRun(current) && <details className="eval-prototype-tools" aria-label="运行状态演示">
                <summary>运行状态演示（仅原型）</summary>
                {["running", "judging"].includes(current.status) && <Button variant="ghost" className="eval-prototype-action" onClick={() => requestCancelRun(objectId, current.id, true)}>模拟停止无响应（仅原型）</Button>}
                {current.status === "stop_unconfirmed" && <><Button variant="ghost" className="eval-prototype-action" onClick={() => cancelRun(objectId, current.id)}>模拟核实已停止（仅原型）</Button><Button variant="ghost" className="eval-prototype-action" onClick={() => cancelRun(objectId, current.id, "error")}>模拟核实运行异常（仅原型）</Button></>}
              </details>}
            </>
          )}
        </>
      )}
    </section>
  )
}
