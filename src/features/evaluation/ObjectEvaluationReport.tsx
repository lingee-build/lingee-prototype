import { usePanel } from "@/stores/panel"
import { useParams } from "react-router"
import { useEvaluation, isActiveRun } from "@/services/evaluation"
import { evaluationRepairTarget, useEvaluationRepairs } from "@/services/evaluation-repair"
import { EvaluationPanel } from "./EvaluationPanel"
import { Button } from "@/ui"
import { useNavigate } from "react-router"
import "./evaluation.css"

/** 对象页签与工作区共用报告详情；页签内导航不改变左侧会话。 */
export function ObjectEvaluationReport({ objectId, open }: { objectId: string; open?: (url: string) => void }) {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const runs = useEvaluation(s => s.runs[objectId]) || []
  const repairItems = useEvaluationRepairs(s => s.items)
  const target = sessionId && repairItems[sessionId] ? evaluationRepairTarget(sessionId) : undefined
  const matching = target && `${target.objectType}:${target.objectId}` === objectId
  const reportRequest = usePanel(s => s.evaluationReport)
  const requested = reportRequest?.objectId === objectId ? reportRequest : undefined
  const initialRunId = requested ? requested.runId : matching ? target.runId : runs.find(r => !isActiveRun(r))?.id || runs[0]?.id
  const [kind, id] = objectId.split(":")
  if (!runs.length) return <div className="eval-empty"><p>暂无评测报告，准备好用例后即可运行评测。</p><Button variant="secondary" onClick={() => (open || navigate)(`/dev/${kind}/${encodeURIComponent(id)}/evaluation`)}>进入评测</Button></div>
  return <EvaluationPanel key={`${objectId}:${sessionId || "object"}:${requested?.requestId || "default"}`} objectId={objectId} name={runs[0]?.name || ""} embedded={{ initialRunId, repairSessionId: matching ? sessionId : undefined }} />
}
