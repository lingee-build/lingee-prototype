import { useEvaluationConversations } from "@/services/evaluation-conversations"
import { Navigate } from "react-router"
/** 旧生成会话统一进入评测工作区，不用旧草稿覆盖当前列表。 */
export function EvaluationSession({ sessionId, objectId }: { projectId: string; sessionId?: string; objectId: string }) {
  const conversation = useEvaluationConversations(s => sessionId ? s.items[sessionId] : undefined)
  const query = new URLSearchParams()
  if (sessionId) query.set("conversation", sessionId)
  if (conversation?.objectId === objectId && (conversation.reportContext?.length || conversation.runId)) query.set("tab", "reports")
  const [mode, id] = objectId.split(":")
  return <Navigate replace to={`/dev/${mode}/${encodeURIComponent(id)}/evaluation${query.size ? `?${query}` : ""}`} />
}
