import * as fixtures from "./fixtures/projects"
import type { Message, Project, Session } from "./types"

/** 内存数据库：刷新页面即恢复初始数据，方便反复演示 */
export const db = {
  user: fixtures.user,
  models: fixtures.models,
  projects: structuredClone(fixtures.projects) as Project[],
  sessions: structuredClone(fixtures.sessions) as Session[],
  messages: structuredClone(fixtures.messages) as Message[],
}

// Restore evaluation authoring sessions into the shared session list and timeline.
try {
  const saved = JSON.parse(localStorage.getItem("lingee.evaluation-conversations.v1") || "null")
  for (const item of Object.values(saved?.state?.items || {}) as { session: Session; messages: Message[] }[]) {
    if (item.session?.id && Array.isArray(item.messages)) {
      db.sessions.push(item.session)
      db.messages.push(...item.messages)
    }
  }
} catch { /* Ignore unavailable or malformed browser storage. */ }

try {
  const saved = JSON.parse(localStorage.getItem("lingee.evaluation-repairs.v1") || "null")
  for (const item of Object.values(saved?.state?.items || {}) as { session: Session; messages: Message[] }[]) {
    if (item.session?.id && Array.isArray(item.messages)) {
      db.sessions.push({ ...item.session, status: "idle" })
      db.messages.push(...item.messages)
    }
  }
} catch { /* Ignore unavailable or malformed browser storage. */ }
