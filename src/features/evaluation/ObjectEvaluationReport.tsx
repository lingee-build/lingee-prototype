import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import { loadLocalSalesEvaluation, useEvaluation, isActiveRun } from "@/services/evaluation"
import { averageQuality, passRate } from "@/vendor/build-evaluation/outcome"
import { Button } from "@/ui"
import { buildReportData } from "./report-document"
import "./evaluation.css"
import "@/vendor/build-evaluation/evaluation.css"

export function ObjectEvaluationReport({ objectId, open }: { objectId: string; open?: (url: string) => void }) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const request = loadLocalSalesEvaluation(objectId)
    if (!request) { setLoading(false); return }
    let active = true
    setLoading(true)
    void request.finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [objectId])
  const run = useEvaluation(state => state.runs[objectId]?.[0])
  const count = useEvaluation(state => state.cases[objectId]?.length ?? 0)
  const [kind, id] = objectId.split(":")
  const base = `/dev/${kind}/${encodeURIComponent(id)}/evaluation`
  const report = run && buildReportData(run)
  const rate = report ? passRate(report.cases) : null
  const status = run?.awaitingContinueAt ? "待继续" : run?.status === "stop_unconfirmed" ? "运行状态待确认" :
    run?.status === "judging" ? "评分中" : run?.status === "stopping" ? "停止处理中" : run && isActiveRun(run) ? "运行中" : "已结束"
  return <section className="eval-overview bg-surface-skill-info" aria-label="评测" aria-busy={loading}>
    <div className="eval-overview-summary">
      <div className="eval-overview-heading">
        <h3>最近一次评测</h3>
        {run && <span className="eval-status" data-status={report?.state}>{status}</span>}
        <span className="eval-overview-case-count">用例数 <strong>{loading ? "—" : count}</strong></span>
      </div>
      <div className="eval-overview-meta">{run ? run.code : loading ? "—" : "暂无评测报告"}</div>
      {report && <dl className="eval-overview-metrics">
        <div><dt>平均分</dt><dd>{averageQuality(report.cases).score ?? "—"}</dd></div>
        <div><dt>通过率</dt><dd>{rate === null ? "—" : `${(rate * 100).toFixed(0)}%`}</dd></div>
      </dl>}
    </div>
    <div className="eval-overview-actions">
      {run && <Button variant="text" size="large" onClick={() => (open || navigate)(`${base}?tab=reports&run=${encodeURIComponent(run.id)}&view=report`)}>查看报告</Button>}
      <Button variant="primary" size="large" onClick={() => (open || navigate)(base)}>进入评测</Button>
    </div>
  </section>
}
