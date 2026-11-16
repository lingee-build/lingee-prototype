import { create } from "zustand"
import type { Message, Model, PermissionRequest, Project, QuestionRequest, Session, SyncEvent, Todo, User } from "@/mock/types"
import { modelService, projectService, sessionService, userService } from "@/services"

interface SyncState {
  ready: boolean
  user?: User
  models: Model[]
  projects: Project[]
  sessions: Session[]
  /** sessionId → 已加载的消息；未加载过的会话没有这个 key */
  messages: Record<string, Message[]>
  todos: Record<string, Todo[]>
  /** 待用户回答的提问 / 待用户确认的权限申请，按会话存 */
  questions: Record<string, QuestionRequest | undefined>
  permissions: Record<string, PermissionRequest | undefined>
  bootstrap: () => Promise<void>
  loadMessages: (sessionId: string) => Promise<void>
  apply: (event: SyncEvent) => void
  setProjects: (projects: Project[]) => void
  setSessions: (update: (sessions: Session[]) => Session[]) => void
}

const upsert = <T extends { id: string }>(list: T[], item: T) =>
  list.some((x) => x.id === item.id) ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item]

/**
 * 全局同步仓库：对应原工程的 global-sync。
 * 所有服务端数据都落在这里，事件经 apply() 归并，组件只订阅自己关心的切片。
 */
export const useSync = create<SyncState>((set, get) => ({
  ready: false,
  models: [],
  projects: [],
  sessions: [],
  messages: {},
  todos: {},
  questions: {},
  permissions: {},

  async bootstrap() {
    const [user, models, projects, sessions] = await Promise.all([
      userService.current(),
      modelService.list(),
      projectService.list(),
      sessionService.list(),
    ])
    set({ ready: true, user, models, projects, sessions })
  },

  async loadMessages(sessionId) {
    if (get().messages[sessionId]) return
    const messages = await sessionService.messages(sessionId)
    set((s) => ({ messages: { ...s.messages, [sessionId]: s.messages[sessionId] ?? messages } }))
  },

  apply(event) {
    if (event.type === "session.updated") return set((s) => ({ sessions: upsert(s.sessions, event.session) }))
    if (event.type === "session.status")
      return set((s) => ({
        sessions: s.sessions.map((x) => (x.id === event.sessionId ? { ...x, status: event.status } : x)),
      }))
    if (event.type === "message.updated")
      return set((s) => ({
        messages: {
          ...s.messages,
          [event.message.sessionId]: upsert(s.messages[event.message.sessionId] ?? [], event.message),
        },
      }))
    if (event.type === "todo.updated") return set((s) => ({ todos: { ...s.todos, [event.sessionId]: event.todos } }))
    if (event.type === "question.asked")
      return set((s) => ({ questions: { ...s.questions, [event.request.sessionId]: event.request } }))
    if (event.type === "question.replied") return set((s) => ({ questions: { ...s.questions, [event.sessionId]: undefined } }))
    if (event.type === "permission.asked")
      return set((s) => ({ permissions: { ...s.permissions, [event.request.sessionId]: event.request } }))
    if (event.type === "permission.replied")
      return set((s) => ({ permissions: { ...s.permissions, [event.sessionId]: undefined } }))
    set((s) => ({
      messages: {
        ...s.messages,
        [event.sessionId]: (s.messages[event.sessionId] ?? []).map((message) =>
          message.id === event.messageId ? { ...message, parts: upsert(message.parts, event.part) } : message,
        ),
      },
    }))
  },

  setProjects: (projects) => set({ projects }),
  setSessions: (update) => set((s) => ({ sessions: update(s.sessions) })),
}))
