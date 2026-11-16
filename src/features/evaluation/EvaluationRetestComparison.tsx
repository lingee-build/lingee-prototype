import { useId, useState } from "react"
import { Button, Icon } from "@/ui"
import { caseContentKey, turnsOf, type EvalResult, type EvalRun } from "@/services/evaluation"
import { qualityOf } from "@/services/evaluation-quality"

type Result = EvalResult | undefined

function resultStatus(result: Result) {
  if (!result || result.status === "skipped" || result.status === "cancelled") return "not-executed"
  const quality = qualityOf(result)
  if (quality.state === "质量通过") return "pass"
  if (quality.state === "质量未通过") return "fail"
  return "unknown"
}

function resultLabel(result: Result, missing: string) {
  if (!result) return missing
  if (resultStatus(result) === "not-executed") return "未执行"
  return ({pass:"通过",fail:"未通过",unknown:qualityOf(result).state,"not-executed":"未执行"})[resultStatus(result)]
}

export function EvaluationRetestComparison({ source, current, open, onToggle, onSource }: {
  source: EvalRun
  current: EvalRun
  open: boolean
  onToggle: () => void
  onSource: (id?: string) => void
}) {
  const [showAll, setShowAll] = useState(false)
  const [showMissed, setShowMissed] = useState(false)
  const id = useId()
  const old = new Map(source.results.map(item => [item.id, item]))
  const next = new Map(current.results.map(item => [item.id, item]))
  const oldCases = new Map(source.caseSnapshot?.cases.map(item => [item.id, item]))
  const nextCases = new Map(current.caseSnapshot?.cases.map(item => [item.id, item]))
  const rows = [...new Set([...old.keys(), ...next.keys()])].map(id => {
    const before = old.get(id)
    const after = next.get(id)
    const oldCase = oldCases.get(id)
    const newCase = nextCases.get(id)
    const missed = !!before && resultStatus(after) === "not-executed"
    const previous = before && qualityOf(before)
    const quality = after && qualityOf(after)
    const delta = previous?.total != null && quality?.total != null ? quality.total - previous.total : null
    const changed = !!before && !!after && (
      JSON.stringify(turnsOf(before).map(t => t.input)) !== JSON.stringify(turnsOf(after).map(t => t.input)) ||
      !!oldCase && !!newCase && caseContentKey([oldCase]) !== caseContentKey([newCase])
    )
    const resultChanged = !missed && (resultStatus(before) !== resultStatus(after) || !!delta || previous?.issue !== quality?.issue)
    const issue = resultStatus(after) !== "not-executed" && (resultStatus(after) !== "pass" || !!quality?.issue)
    return { id, before, after, missed, delta, changed, resultChanged, issue, improved: resultStatus(before) === "fail" && resultStatus(after) === "pass" }
  })
  const reasons = [
    (source.status !== "completed" || current.status !== "completed") && "评测未完整结束",
    rows.some(row => !row.before || !row.after) && "用例范围不同",
    JSON.stringify(source.models) !== JSON.stringify(current.models) && "执行或评分模型不同",
    (source.checkPolicySnapshot !== current.checkPolicySnapshot || JSON.stringify(source.scoring) !== JSON.stringify(current.scoring)) && "评分或证据采集规则不同",
    rows.some(row => row.changed) && "用例版本、预期或实际输入不同",
    (source.environment !== current.environment || source.concurrency !== current.concurrency) && "执行环境、并发或输入附件不同",
    (!source.models || !source.caseSnapshot || !current.caseSnapshot) && "缺少可验证的评测条件",
  ].filter(Boolean)
  const compared = rows.filter(row => !row.missed)
  const missed = rows.filter(row => row.missed)
  const relevant = (row: typeof rows[number]) => row.changed || row.resultChanged || row.issue
  const canFilter = compared.length > 5 && compared.some(row => !relevant(row))
  const visible = compared.filter(row => !canFilter || showAll || relevant(row))
    .sort((a, b) => Number(b.issue) - Number(a.issue) || Number(b.improved) - Number(a.improved))
  const count = rows.filter(row => row.resultChanged).length
  const status = (result: Result, missing: string) => <span className="eval-diff-result" data-outcome={resultStatus(result)}>
    {resultLabel(result, missing)}{result && qualityOf(result).total != null && <span>{qualityOf(result).total}</span>}
  </span>
  const rowView = (row: typeof rows[number]) => <li key={row.id} className="eval-diff-case eval-diff-columns">
    <span className="eval-diff-name">{(row.after ?? row.before)?.name} <small>{(row.after ?? row.before)?.businessId || (row.after ?? row.before)?.code}</small></span>
    {status(row.before, "未纳入来源评测")}
    <span className="eval-diff-current" data-changed={resultStatus(row.before) !== resultStatus(row.after) || !!row.delta}>{status(row.after, "未纳入本次")}</span>
    <span>{!reasons.length && row.delta ? <strong className="eval-diff-delta" data-direction={row.delta > 0 ? "up" : "down"}>{row.delta > 0 ? "+" : ""}{row.delta}</strong> : row.improved ? "转为通过" : "—"}</span>
    {row.changed && <small className="eval-diff-changed">用例或实际输入有变化</small>}
  </li>
  const renderCases = (items: typeof rows) => <>
    <div className="eval-diff-columns eval-diff-column-labels"><span>评测用例</span><span>来源报告</span><span>本次复测</span><span>质量分差</span></div>
    <ul className="eval-diff-list">{items.map(rowView)}</ul>
  </>
  return <>
    <div className="eval-report-tools"><div className="eval-retest-heading" data-expanded={open}>
      <button type="button" className="eval-retest-disclosure" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span>复测对比</span><span className="eval-retest-headline">{count ? `${count} 条结果有变化` : "评测结果无变化"}{!!missed.length && ` · 未复测 ${missed.length}`}{!!reasons.length && " · 分数不可直接比较"}</span>
        <Icon name="chevron-down" size="small" />
      </button>
      <Button variant="ghost" className="eval-diff-link eval-retest-source-code" aria-label={`打开来源报告 ${source.code}`} onClick={() => onSource()}>来源报告 {source.code}</Button>
    </div></div>
    <section className="eval-retest-panel" hidden={!open}>
    <section id={id} hidden={!open} className="eval-retest" aria-label="复测用例结果对比">
      <div className="eval-diff-summary">
        <span>复测覆盖 <strong>{compared.filter(row => row.before).length}/{source.results.length}</strong></span>
        <span>转为通过 <strong>{rows.filter(row => row.improved).length}</strong></span>
        <span>仍有问题 <strong>{rows.filter(row => row.issue).length}</strong></span>
        <span>未复测 <strong>{missed.length}</strong></span>
      </div>
      {source.objectContentSummary !== current.objectContentSummary && <p className="eval-diff-note">复测使用了新版被测对象</p>}
      {!!reasons.length && <p className="eval-muted">分数不可直接比较 · {reasons.join(" · ")}</p>}
      <div className="eval-diff-toolbar">
        {!visible.length && <p className="eval-diff-note" role="status">暂无变化或待排查问题</p>}
        {canFilter && <Button variant="secondary" className="eval-diff-filter" aria-pressed={!showAll} onClick={() => setShowAll(value => !value)}><span className="eval-diff-filter-indicator" aria-hidden="true" />仅看变化和问题</Button>}
      </div>
      {!!visible.length && renderCases(visible)}
      {!!missed.length && <><Button variant="ghost" aria-expanded={showMissed} onClick={() => setShowMissed(value => !value)}>{showMissed ? "收起未复测用例" : "查看未复测用例"}（{missed.length}）</Button>{showMissed && renderCases(missed)}</>}
    </section>
    </section>
  </>
}
