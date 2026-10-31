import { useEvaluationRepairs } from "./evaluation-repair"
import { useEvaluationConversations } from "./evaluation-conversations"
import { db } from "@/mock/db"
import { latency, uid } from "@/mock/latency"
import { abortStream, resumeStream, runAssistantStream } from "@/mock/stream-engine"
import type { Message, PermissionReply, Session, SyncEvent } from "@/mock/types"

export const sessionService = {
  list: () => latency(db.sessions.filter((x) => !x.time.archived)),
  messages: (sessionId: string) => latency(db.messages.filter((x) => x.sessionId === sessionId), 250),

  create(projectId: string, title: string) {
    const now = Date.now()
    const session: Session = { id: uid("ses"), projectId, title, time: { created: now, updated: now }, status: "idle" }
    db.sessions.push(session)
    return latency(session, 80)
  },

  update(id: string, patch: Partial<Pick<Session, "title" | "projectId" | "unread">>) {
    const session = db.sessions.find((x) => x.id === id)
    if (session) Object.assign(session, patch)
    const repair = useEvaluationRepairs.getState().items[id]
    if (repair && session) useEvaluationRepairs.setState(s => ({ items: { ...s.items, [id]: { ...repair, session: structuredClone(session) } } }))
    const evalChat = useEvaluationConversations.getState().items[id]
    if (evalChat && session) useEvaluationConversations.getState().put({ ...evalChat, session: structuredClone(session) })
    return latency(session, 60)
  },

  archive(id: string) {
    const session = db.sessions.find((x) => x.id === id)
    if (session) session.time.archived = Date.now()
    const repair = useEvaluationRepairs.getState().items[id]
    if (repair && session) useEvaluationRepairs.setState(s => ({ items: { ...s.items, [id]: { ...repair, session: structuredClone(session) } } }))
    const evalChat = useEvaluationConversations.getState().items[id]
    if (evalChat && session) useEvaluationConversations.getState().put({ ...evalChat, session: structuredClone(session) })
    return latency(true, 60)
  },

  remove(id: string) {
    useEvaluationRepairs.setState(s => ({ items: Object.fromEntries(Object.entries(s.items).filter(([key]) => key !== id)), links: Object.fromEntries(Object.entries(s.links).filter(([key]) => key !== id)) }))
    useEvaluationConversations.getState().remove(id)
    db.sessions = db.sessions.filter((x) => x.id !== id)
    db.messages = db.messages.filter((x) => x.sessionId !== id)
    return latency(true, 60)
  },

  /** 发送一条用户消息，随后由回放引擎持续推送助手回复事件 */
  prompt(sessionId: string, text: string, emit: (event: SyncEvent) => void, model?: string) {
    const now = Date.now()
    const message: Message = {
      id: uid("msg"),
      sessionId,
      role: "user",
      time: { created: now, completed: now },
      parts: [{ id: uid("prt"), type: "text", text }],
    }
    db.messages.push(message)
    const session = db.sessions.find((x) => x.id === sessionId)
    if (session) session.time.updated = now
    emit({ type: "message.updated", message: structuredClone(message) })
    if (session) emit({ type: "session.updated", session: structuredClone(session) })
    void runAssistantStream(sessionId, text, emit, model)
  },

  abort: abortStream,

  /** 回答提问：每道题一个答案数组；传空数组表示全部跳过 */
  replyQuestion: (sessionId: string, answers: string[][]) => resumeStream(sessionId, answers),
  replyPermission: (sessionId: string, reply: PermissionReply) => resumeStream(sessionId, reply),
}
