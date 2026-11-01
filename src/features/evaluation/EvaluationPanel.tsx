import { DatePicker } from "@/ui/date-picker/DatePicker"
import { completeEvaluationSample } from "@/services/evaluation-samples"
import { casePoints, runPoints, pointsText, pointsSourceText, refreshRunPoints, resumeRunPoints, updateAutomaticPoints } from "@/services/evaluation-points"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { devStore } from "@/mock/dev-store"
import { evaluationRepairObject, repairPrompt, repairDisabledReason, registerEvaluationRepair } from "@/services/evaluation-repair"
import { EvaluationSelect } from "./EvaluationSelect"
import { useBlocker, useNavigate, useSearchParams } from "react-router"
import { ControlledConfirmDialog } from "@/ui/dialog/ConfirmDialog"
import { useSync } from "@/stores/sync"
import { CaseDetail } from "./CaseDetail"
import { CaseEditor } from "./CaseEditor"
import { RoundResults } from "./RoundResults"
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
  const reportRequested = searchParams.get("view") === "report"
  const section = runId || resultId || reportRequested || searchParams.get("tab") === "runs" ? "runs" : "cases"
  function openView(view: { section: "cases" | "runs"; runId?: string; resultId?: string; report?: boolean }) {
    const next = new URLSearchParams(searchParams)
    for (const key of ["tab", "run", "case", "view", "focusCase"]) next.delete(key)
    if (view.section === "runs") next.set("tab", "runs")
    if (view.runId) {
      next.set("run", view.runId)
      if (view.report) next.set("view", "report")
      else if (view.resultId) next.set("case", view.resultId)
    }
    setSearchParams(next)
  }
  const [runPage, setRunPage] = useState(1)
  const [runRangePreset, setRunRangePreset] = useState("all")
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
  const filteredRuns = invalidRunRange ? [] : runs.filter(run => run.started >= startTime && run.started < endTime)
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
  const current = runs.find((r) => r.id === runId)
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
  useEffect(() => { onEnvironmentChange?.(section === "runs" && current ? current.environment : currentEvaluationEnvironment) }, [section, current?.id, current?.environment, onEnvironmentChange])
  const detailOpen = section === "cases" ? !!viewCase || !!(editorOpen && draft) : !!current
  useEffect(() => { onDetailChange?.(detailOpen); return () => onDetailChange?.(false) }, [detailOpen, onDetailChange])
  const result = current?.results.find((c) => c.id === resultId)
  const locationError = !runId && (resultId || reportRequested) ? "详情链接缺少运行编号，请返回运行记录列表。"
    : runId && !current ? "指定运行记录不存在或已不可访问，请返回运行记录列表。"
    : resultId && !result ? "本次运行中不存在指定用例结果，请返回本次运行。"
    : ""
  const repairReason = openingRepair ? "正在打开开发会话" : current ? repairDisabledReason(objectId, current, !!evaluationRepairObject(objectId), result?.id) : ""
  const selectedCases = cases.filter((c) => selected.includes(c.id))
  const savedDraft = draft ? cases.find((c) => c.id === draft.id) : undefined
  const draftChanged = !!draft && (savedDraft ? JSON.stringify(draft) !== JSON.stringify(savedDraft) : !!(draft.checks?.length || draft.name.trim() || turnsOf(draft).some(t => t.input.trim() || t.checks?.length || t.expected.trim() || t.attachments.length || t.rules.length) || draft.attachments?.length))
  const unsaved = editorOpen && draftChanged
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
  function begin(list: EvalCase[]) {
    const id = startRun(objectId, name, list)
    if (!id) { setNotice("无法启动：评测仅允许在沙箱运行，且同一对象不能重复启动任务"); return }
    if (id) {
      setRunPage(1)
      openView({ section: "runs", runId: id })
    }
  }
  function rerun(run: EvalRun, ids = run.results.map(c => c.id)) {
    if (!ids.length || busy) return
    const latest = latestRunCases(objectId, run, ids)
    if (!latest.cases.length) {
      dialog.show(() => <ConfirmDialog title="无法重新运行" description="所选范围内的用例已全部删除，请返回用例列表选择用例" confirmText="返回用例列表" cancelText="取消" onConfirm={() => openView({ section: "cases" })} />)
      return
    }
    const execute = () => begin(latest.cases)
    if (latest.missing.length) {
      dialog.show(() => <ConfirmDialog title="部分用例已删除" description={`已删除 ${latest.missing.length} 条：${latest.missing.map(c => c.name).join("、")}。将使用其余 ${latest.cases.length} 条用例的最新内容运行`} confirmText="运行剩余用例" cancelText="取消" onConfirm={execute} />)
    } else execute()
  }
  function removeCases(ids: string[]) {
    dialog.show(() => <ConfirmDialog title={ids.length > 1 ? `删除所选 ${ids.length} 条用例？` : "删除这条用例？"}
      description="删除后无法恢复，已有运行记录和报告保留" cancelText="取消" confirmText="删除" variant="danger"
      onConfirm={() => {
        if (!saveCases(objectId, (useEvaluation.getState().cases[objectId] || []).filter(item => !ids.includes(item.id)))) { setNotice("删除保存失败，请重试"); return }
        setSelected(current => current.filter(id => !ids.includes(id)))
        setNotice(`已删除 ${ids.length} 条用例`, true)
      }} />)
  }
  function samples() {
    const next: EvalCase[] = (["passed", "failed", "blocked"] as Outcome[]).map((outcome, index) => ({
      id: crypto.randomUUID(),
      name: tr(`sample.${outcome}`),
      input: t(`proto.eval.input.${outcome}`, { name }),
      expected: tr(`expected.${outcome}`),
      source: sources[index + 1],
      outcome,
      demo: true,
      checks: [{ id: crypto.randomUUID(), text: "最终结论与业务数据一致，且有查询结果或业务材料支持。", required: true, files: [] }],
      turns: [{ id: crypto.randomUUID(), input: t(`proto.eval.input.${outcome}`, { name }), expected: tr(`expected.${outcome}`), attachments: [], rules: [], checks: [{ id: crypto.randomUUID(), text: tr(`expected.${outcome}`), required: true, files: [] }] }],
    }))
    next[0].checks!.push({ id: crypto.randomUUID(), kind: "file", operator: "exists", text: "outputs/查询结果.txt", required: true, files: [] })
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
  return (
    <section className="eval-panel" data-view={section} aria-label={tr("title")}>
      <ControlledConfirmDialog open={blocker.state === "blocked"} title="放弃本次修改？" description="离开后，本次未保存的用例修改将被丢弃" confirmText="放弃并离开" cancelText="继续编辑" variant="danger"
        onConfirm={() => { if (blocker.state === "blocked") { setDraft(undefined); blocker.proceed() } }}
        onClose={() => { if (blocker.state === "blocked") blocker.reset() }} />
      {state.error && <p role="alert">{tr("storageError")}</p>}
      <div aria-live="polite" className="eval-muted">
        {notice.text}
      </div>
      {locationError ? (
        <div className="eval-empty"><p role="alert">{locationError}</p><Button onClick={() => openView({ section: "runs", runId: current?.id })}>{current ? "返回本次运行" : "返回运行记录"}</Button></div>
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
              onChange={value => openView({ section: value === "runs" ? "runs" : "cases" })}
              items={["cases", "runs"].map(value => ({
                value,
                label: `${tr(value)} (${value === "cases" ? cases.length : runs.length})`,
              }))}
            />
          </nav>
          {section === "cases" && (
            <div className="eval-case-list">
              <div className="eval-toolbar eval-case-toolbar">
                  <input className="eval-case-search" type="search" aria-label="搜索用例名称" placeholder="搜索用例名称" value={caseSearch}
                    onChange={e => { setCaseSearch(e.target.value); setCasePage(1); setSelected([]) }} />
                <div className="eval-actions eval-case-toolbar-actions">
                  <DropdownMenu placement="bottom-start">
                    <DropdownMenu.Trigger asChild>
                      <BrandButton variant="auxiliary" className="eval-create-action">{tr("add")}<Icon name="chevron-down" size="small" /></BrandButton>
                    </DropdownMenu.Trigger>
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content className="eval-create-menu">
                        <DropdownMenu.Item onSelect={startGeneration}>
                          <svg className="eval-create-menu-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 2.5h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H6l-3.5 2v-2H3a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1Z"/><path d="M5 5.5h6M5 8h4"/></svg>
                          <div><div className="eval-create-menu-title">对话生成</div><p>描述业务场景，生成多条用例</p></div>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item onSelect={() => setDraft({ id: crypto.randomUUID(), name: "", input: "", expected: "", source: "none", outcome: "passed" })}>
                          <svg className="eval-create-menu-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9.5 3.5 3 3M2.5 13.5l3.5-1 7.25-7.25a1.6 1.6 0 0 0-3-3L3 9.5l-.5 4ZM8 13.5h5.5"/></svg>
                          <div><div className="eval-create-menu-title">手动创建</div><p>填写一条用例</p></div>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu>
                  <BrandButton variant="primary" disabled={!busy && !cases.length} onClick={() => { if (activeRun) openView({ section: "runs", runId: activeRun.id }); else begin(selectedCases.length ? selectedCases : cases) }}>
                    {busy ? "查看当前运行" : selectedCases.length ? `运行所选 (${selectedCases.length})` : `运行全部 ${cases.length} 条`}
                  </BrandButton>
                </div>
              </div>
                  <div className="eval-selection-bar"><label className="eval-check">
                    <input
                      type="checkbox"
                      ref={node => { if (node) node.indeterminate = visibleCases.some(c => selected.includes(c.id)) && !visibleCases.every(c => selected.includes(c.id)) }}
                      disabled={!visibleCases.length}
                      checked={!!visibleCases.length && visibleCases.every((c) => selected.includes(c.id))}
                      onChange={(e) => setSelected(current => e.target.checked ? [...new Set([...current, ...visibleCases.map(c => c.id)])] : current.filter(id => !visibleCases.some(c => c.id === id)))}
                    />
                    全选本页
                  </label>
                  <Button disabled={!selectedCases.length} onClick={() => removeCases(selectedCases.map(c => c.id))}>删除</Button>
                  {!!selectedCases.length && <><span aria-live="polite">共选 {selectedCases.length} 条{selectedCases.some(c => !visibleCases.some(v => v.id === c.id)) ? `（其他页 ${selectedCases.filter(c => !visibleCases.some(v => v.id === c.id)).length} 条）` : ""}</span><Button onClick={() => setSelected([])}>取消选择</Button></>}
                  </div>
              {caseSearch.trim() && !selectedCases.length && !busy && <p className="eval-muted">运行范围包含搜索结果之外的用例，共 {cases.length} 条。</p>}
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
                      <Button onClick={() => setDraft(draft?.id === c.id ? draft : { ...c })}>{tr("edit")}</Button>
                      <Button onClick={() => removeCases([c.id])}>{tr("delete")}</Button>
                    </div>
                  ))}
                </>
              ) : (
                <div className="eval-empty">
                  <Empty description={caseSearch.trim() ? "未找到匹配的用例" : tr("emptyCases")} />
                </div>
              )}

              {!!filteredCases.length && <nav className="eval-pagination" aria-label="评测用例分页">
                <span className="eval-muted">共 {filteredCases.length} 条 · 每页 {casePageSize} 条</span>
                <div className="eval-actions">
                  <Button disabled={currentCasePage === 1} onClick={() => setCasePage(currentCasePage - 1)}>上一页</Button>
                  <span aria-live="polite">{currentCasePage} / {casePageCount}</span>
                  <Button disabled={currentCasePage === casePageCount} onClick={() => setCasePage(currentCasePage + 1)}>下一页</Button>
                </div>
              </nav>}
              <div className="eval-prototype-tools" aria-label="原型辅助">
                <span className="eval-muted">原型辅助</span>
                <Tooltip value="用于演示，不纳入正式功能"><Button className="eval-prototype-action" onClick={samples}>
                  {tr("samples")}（仅原型）
                </Button></Tooltip>
              </div>
            </div>
          )}
          {section === "runs" && !current && (
            <>
              <div className="eval-date-filter" role="group" aria-label="运行开始时间筛选">
                <EvaluationSelect id="eval-run-range" title="按运行开始时间筛选" label="运行开始时间" value={runRangePreset} onChange={applyRunRange} options={[
                  { value: "all", label: "全部时间" }, { value: "today", label: "今天" }, { value: "yesterday", label: "昨天" },
                  { value: "7", label: "最近 7 天" }, { value: "30", label: "最近 30 天" }, { value: "custom", label: "自定义" },
                ]} />
                {runRangePreset === "custom" ? <div className="eval-custom-date-range">
                <DatePicker label="开始日期" value={runStartDate} max={runEndDate || undefined} onChange={value => { setRunStartDate(value); setRunPage(1) }} />
                <span className="eval-muted">至</span>
                <DatePicker label="结束日期" value={runEndDate} min={runStartDate || undefined} onChange={value => { setRunEndDate(value); setRunPage(1) }} />
                <Button onClick={() => applyRunRange("all")}>清空</Button>
                </div> : runRangePreset !== "all" && <span className="eval-muted">{runStartDate} 至 {runEndDate}</span>}
              </div>
              {invalidRunRange && <p id="eval-date-error" className="eval-field-error" role="alert">开始日期不能晚于结束日期</p>}
              {!filteredRuns.length && !invalidRunRange && (
                <div className="eval-empty">
                  <Empty description={runStartDate || runEndDate ? "该时间范围内暂无运行记录" : tr("emptyRuns")} />
                </div>
              )}
              {visibleRuns.map((run) => (
                <div className="eval-row" key={run.id}>
                  <div className="eval-grow">
                    <button className="eval-title eval-list-name" onClick={() => openView({ section: "runs", runId: run.id })}>{date(run.started)}</button>
                    <p className="eval-muted">
                      {run.results.length} {tr("caseUnit")} · {run.results.filter((c) => verdictLabel(c) === "通过").length} {tr("passed")} · {pointsText(runPoints(run))}
                    </p>
                  </div>
                  {status(run.status)}
                  <Button
                    onClick={() => openView({ section: "runs", runId: run.id })}
                  >
                    {tr("view")}
                  </Button>
                </div>
              ))}
              {!!filteredRuns.length && <nav className="eval-pagination" aria-label="运行记录分页">
                <span className="eval-muted">共 {filteredRuns.length} 条 · 每页 {runPageSize} 条</span>
                <div className="eval-actions">
                  <Button disabled={currentRunPage === 1} onClick={() => setRunPage(currentRunPage - 1)}>上一页</Button>
                  <span aria-live="polite">{currentRunPage} / {runPageCount}</span>
                  <Button disabled={currentRunPage === runPageCount} onClick={() => setRunPage(currentRunPage + 1)}>下一页</Button>
                </div>
              </nav>}
            </>
          )}
          {current && section === "runs" && (
            <>
              <div className="eval-toolbar">
                <IconButton icon="arrow-left" variant="ghost" className="!text-[var(--text-weak)]" iconClass="!text-[var(--text-weak)]"
                  aria-label={resultId || reportRequested ? "返回本次运行" : "返回运行记录"} title={resultId || reportRequested ? "返回本次运行" : "返回运行记录"}
                  onClick={() => openView({ section: "runs", runId: resultId || reportRequested ? current.id : undefined })}
                />
                <div className="eval-actions">
                  <Tooltip value={repairReason} inactive={!repairReason}>
                    <Button className="eval-repair-action" aria-disabled={!!repairReason} onClick={() => { if (!repairReason) void repair(current, result?.id) }}>{result ? "去修复" : "修复问题"}</Button>
                  </Tooltip>
                  {isActiveRun(current) ? (
                    <Button disabled={["stopping", "stop_unconfirmed"].includes(current.status)} onClick={() => requestCancelRun(objectId, current.id)}>{["stopping", "stop_unconfirmed"].includes(current.status) ? "停止处理中…" : tr("stop")}</Button>
                  ) : (
                    <>
                      {report ? <Button onClick={() => exportReport(current)}>下载报告</Button> : <Button
                        onClick={() => openView({ section: "runs", runId: current.id, report: true })}
                      >
                        {tr("report")}
                      </Button>}
                      {!result && !report && <DropdownMenu placement="bottom-end">
                        <DropdownMenu.Trigger asChild>
                          <BrandButton variant="primary" disabled={busy} title={busy ? "当前对象有活动评测，请等待结束" : "选择范围，使用最新已保存内容运行"}>重新运行 <Icon name="chevron-down" size="small" /></BrandButton>
                        </DropdownMenu.Trigger>
                        <DropdownMenu.Portal><DropdownMenu.Content>
                          <DropdownMenu.Item onSelect={() => rerun(current)}>本次全部用例（{current.results.length}）</DropdownMenu.Item>
                          <DropdownMenu.Item disabled={!failedRunResults(current).length} onSelect={() => rerun(current, failedRunResults(current).map(c => c.id))}>不通过用例（{failedRunResults(current).length}）</DropdownMenu.Item>
                        </DropdownMenu.Content></DropdownMenu.Portal>
                      </DropdownMenu>}
                    </>
                  )}
                </div>
              </div>
              {reportRequested && isActiveRun(current) && <p role="status">评测尚未结束，暂不能查看最终报告；当前显示本次运行进度。</p>}
              {!report && <div className="eval-summary">
                <div className="eval-toolbar" style={{ margin: 0 }}>
                  <h3>{date(current.started)}</h3>
                  {status(current.status)}
                </div>
                {current.status === "judging" && <p role="status">业务执行已结束，正在完成标准判定；判定结束前不能重跑或下载最终报告。</p>}
                {current.status === "stopping" && <p role="status">正在停止执行与判定任务，保留已有证据；确认停止前不能重跑。</p>}
                {current.stopReason && <p role="status">{current.status === "cancelled" ? "已确认运行停止。" : current.stopReason}</p>}
                <details className="eval-muted"><summary>运行信息</summary><p>评测时的{current.objectType === "agent" ? "智能体" : "技能"}版本：{current.objectContentSummary || "未记录"}</p><p>运行编号：{current.id}</p></details>
                <p className="eval-muted">{current.objectType === "agent" ? "智能体" : current.objectType === "skill" ? "技能" : "评测对象"} · {current.name} · {environmentLabel(current.environment)}</p>
                <p className="eval-muted">{pointsText(runPoints(current), true)}{pointsSourceText(current) && ` · ${pointsSourceText(current)}`}</p>
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
              {report && !isActiveRun(current) && <ReportPreview html={buildReportDocument(current, t)} />}
              {!report && <details className="eval-prototype-tools" aria-label="点数状态演示"><summary>原型演示工具</summary>{([ ["pending", "统计中"], ["unavailable", "查询失败"], ["exhausted", "查询重试结束"] ] as const).map(([mode, label]) => <Button key={mode} className="eval-prototype-action" disabled={current.pointsQuery?.status === "loading"} onClick={() => void refreshRunPoints(objectId, current.id, mode)}>模拟{label}（仅原型）</Button>)}</details>}
              {!report && isActiveRun(current) && <div className="eval-prototype-tools" aria-label="运行状态演示">
                <span>原型辅助</span>
                {["running", "judging"].includes(current.status) && <Button className="eval-prototype-action" onClick={() => requestCancelRun(objectId, current.id, true)}>模拟停止无响应（仅原型）</Button>}
                {current.status === "stop_unconfirmed" && <><Button className="eval-prototype-action" onClick={() => cancelRun(objectId, current.id)}>模拟核实已停止（仅原型）</Button><Button className="eval-prototype-action" onClick={() => cancelRun(objectId, current.id, "error")}>模拟核实运行异常（仅原型）</Button></>}
              </div>}
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
                    </div>
                    <span className="eval-muted">{pointsText(casePoints(c))}</span>
                    {executionLabel(c) !== "已完成" && <span className="eval-muted">{executionLabel(c)}</span>}<span className="eval-status" data-status={c.verdict || c.status}>{verdictLabel(c)}</span>
                    {!report && <Button
                      onClick={() => openView({ section: "runs", runId: current.id, resultId: c.id })}
                    >
                      {tr("view")}
                    </Button>}
                    {!isActiveRun(current) && verdictLabel(c) !== "通过" && <Button disabled={busy} onClick={() => rerun(current, [c.id])} title={busy ? "当前对象有活动评测，请等待结束" : `仅重新运行：${c.name}`}>重新运行</Button>}
                  </div>
                ))}
              {!report && result && (
                <>
                  <div className="eval-toolbar">
                    <h3>{result.name}</h3>
                    <span className="eval-status" data-status={result.verdict || result.status}>{verdictLabel(result)}</span>
                  </div>
                  <RoundResults result={result} />
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  )
}
