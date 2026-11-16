import { useEffect } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router"
import { buildReportData } from "@/features/evaluation/report-document"
import type { Message, Session } from "@/mock/types"
import { MessageTimeline } from "@/pages/session/timeline/MessageTimeline"
import { loadSalesEvaluationDemo, useEvaluation } from "@/services/evaluation"
import { evidenceFields } from "@/vendor/build-evaluation/evidence-fields"
import { Button } from "@/ui"

export function Component() {
  const { mode, objectId, runId, sessionId } = useParams()
  const [query] = useSearchParams()
  const navigate = useNavigate()
  const key = `${mode}:${objectId}`
  const run = useEvaluation(state => state.runs[key]?.find(item => item.id === runId))
  useEffect(() => { void loadSalesEvaluationDemo(key) }, [key])
  const entry = run && buildReportData(run).cases.find(item => item.sessionId === sessionId)
  const returnTo = `/dev/${mode}/${encodeURIComponent(objectId ?? "")}/evaluation?${query}`
  const back = <Button onClick={() => navigate(returnTo)} variant="ghost" icon="arrow-left">返回评测报告</Button>

  if (!run || !entry || !sessionId) {
    return <div className="p-6">{back}<p role="status">找不到该用例的执行会话。</p></div>
  }
  const session: Session = {
    id: sessionId, projectId: "", title: `执行会话 · ${entry.code}`,
    status: "idle", time: { created: run.started, updated: run.ended ?? run.started },
  }
  const messages = entry.evidence.flatMap((turn): Message[] => {
    const inputRecord = turn.records.find(record => record.kind === "input" && typeof record.value === "string")
    const input = turn.input ?? (typeof inputRecord?.value === "string" ? inputRecord.value : undefined)
    const time = { created: run.started, completed: run.ended ?? run.started }
    const userId = `${turn.id}-user`
    const assistantId = `${turn.id}-assistant`
    return [
      { id: userId, sessionId, role: "user", time, parts: [{ id: userId, type: "text", text: input ?? "未记录实际发送的问题" }] },
      { id: assistantId, sessionId, role: "assistant", time, parts: [{ id: assistantId, type: "text", text: turn.reply ?? "未记录回复" }] },
    ]
  })
  const records = entry.evidence.flatMap(turn => turn.records.flatMap(record => evidenceFields(record.kind, record.value)))
  return <section className="relative h-full min-h-0 bg-background-page" aria-label="执行会话">
    <MessageTimeline session={session} messages={messages} titleActions={back}
      titleDescription={<span className="text-text-weak text-12-regular">{run.code} · {entry.content.name}</span>}
      footer={records.length ? <details className="mx-6 my-4 rounded-xl border border-border-weak-base p-4">
        <summary>工具与澄清记录</summary>
        {records.map((record, index) => <section key={index} className="mt-3">
          <h3>{record.label}</h3><pre className="whitespace-pre-wrap break-all">{record.text}</pre>
        </section>)}
      </details> : !messages.length ? <p role="status">此报告未保存可回看的对话轮次。</p> : undefined} />
  </section>
}
