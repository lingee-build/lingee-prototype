import { reportSummary } from "./report-summary"
import { useNavigate } from "react-router"
import { Button } from "@/ui"
import { useEvaluation, isActiveRun, verdictLabel } from "@/services/evaluation"
import { runDuration, durationText } from "@/services/evaluation-duration"
import { runPoints, pointsText } from "@/services/evaluation-points"
import "./evaluation.css"
export function ObjectEvaluationReport({ objectId, open }: { objectId: string; open?: (url: string) => void }) {
  const navigate = useNavigate()
  const runs = useEvaluation(s => s.runs[objectId]) || []
  const latest = runs.find(r => !isActiveRun(r))
  const summary = latest ? reportSummary(latest) : undefined
  const active = runs.find(isActiveRun)
  const [kind, id] = objectId.split(":")
  const go = (query: string) => (open || navigate)(`/dev/${kind}/${encodeURIComponent(id)}/evaluation${query}`)
  const counts = ["通过", "不通过", "无法判定"].map(label => ({ label, count: latest?.results.filter(r => verdictLabel(r) === label).length || 0 }))
  return <section className="eval-panel eval-object-report" aria-label="对象评测报告">
    <div className="eval-object-report-heading">
      <div><h3>{latest ? "最近一次评测" : "暂无评测报告"}</h3>{latest && <time dateTime={new Date(latest.started).toISOString()}>{new Date(latest.started).toLocaleString("zh-CN")}</time>}</div>
      {runs.length > 0 && <Button variant="ghost" onClick={() => go("?tab=runs")}>历史报告</Button>}
    </div>
    {latest && summary ? <>
      <p className={summary.allUnknown ? "eval-object-report-notice" : ""}><strong>{summary.title}</strong></p>
      {summary.note && <p className={summary.allUnknown ? "eval-object-report-notice" : "eval-muted"}>{summary.note}</p>}
      {latest.status !== "completed" && <p className="eval-object-report-notice">本次评测未完整结束</p>}
      <dl className="eval-object-report-metrics">
        <div className="eval-object-report-rate"><dt>通过率</dt><dd>{latest.results.length ? Math.round(counts[0].count / latest.results.length * 100) : 0}<span>%</span></dd><small>{summary.denominator}</small></div>
        {counts.map((c, i) => <div key={c.label} data-verdict={["pass", "fail", "unknown"][i]}><dt>{c.label}</dt><dd>{c.count}</dd></div>)}
      </dl>
      <div className="eval-object-report-meta"><span>耗时：{durationText(runDuration(latest))}</span><span>{pointsText(runPoints(latest))}</span></div>
    </> : <p className="eval-object-report-empty">运行评测后，可在这里查看通过率、问题分布和完整报告。</p>}
    <div className="eval-object-report-footer">
      <div>{active && <Button variant="ghost" onClick={() => go(`?run=${encodeURIComponent(active.id)}`)}>查看当前任务进度</Button>}</div>
      <div className="eval-actions"><Button variant="secondary" onClick={() => go("")}>发起评测</Button>{latest && <Button variant="primary" onClick={() => go(`?run=${encodeURIComponent(latest.id)}&view=report`)}>查看完整报告</Button>}</div>
    </div>
  </section>
}
