/** 数据形状参照 @opencode-ai/sdk/v2，只保留原型用得到的字段 */

export interface Project {
  id: string
  worktree: string
  name: string
  git: boolean
  branch?: string
}

export type SessionStatus = "idle" | "running" | "clarification" | "error"

export interface Session {
  id: string
  projectId: string
  title: string
  time: { created: number; updated: number; archived?: number }
  status: SessionStatus
  unread?: boolean
}

export interface TextPart {
  id: string
  type: "text"
  text: string
}

export interface ReasoningPart {
  id: string
  type: "reasoning"
  text: string
  time: { start: number; end?: number }
  display?: "scroll"
}

export interface ToolPart {
  id: string
  type: "tool"
  tool: "mcp" | "read" | "edit" | "write" | "bash" | "grep" | "skill" | "websearch" | "question"
  title: string
  detail?: string
  /** 展开后看到的输出内容 */
  output?: string
  stageGroup?: boolean
  questionAnswers?: Array<{ question: string; answers: string[] }>
  state: "running" | "completed" | "error"
}

export interface ExecutionPlanPart {
  id: string
  type: "execution-plan"
  stages: Array<Array<{ title: string; detail: string }>>
}
export type Part = TextPart | ReasoningPart | ToolPart | ExecutionPlanPart

export interface Message {
  id: string
  sessionId: string
  role: "user" | "assistant"
  time: { created: number; completed?: number }
  parts: Part[]
  agent?: string
  model?: string
}

export interface Todo {
  id: string
  content: string
  status: "pending" | "in_progress" | "completed" | "cancelled"
}

export interface QuestionOption {
  label: string
  description?: string
  recommended?: boolean
}

export interface QuestionInfo {
  question: string
  options: QuestionOption[]
  multiple?: boolean
  /** 是否允许自己输入答案，默认允许 */
  custom?: boolean
}

export interface QuestionRequest {
  id: string
  sessionId: string
  questions: QuestionInfo[]
}

export interface PermissionRequest {
  id: string
  sessionId: string
  permission: string
  patterns: string[]
  /** 带 command 的是危险操作（如执行 shell），不提供「始终允许」 */
  command?: string
}

export type PermissionReply = "once" | "always" | "reject"

export interface Model {
  id: string
  name: string
  provider: string
  version?: string
  modelLevel?: "fast" | "deep" | "expert"
  consumptionCoefficient?: string
}

export interface User {
  userId: string
  displayName: string
  tenantName: string
}

/** 流式回放时推送的事件，命名对齐原工程 event-reducer */
export type SyncEvent =
  | { type: "session.updated"; session: Session }
  | { type: "session.status"; sessionId: string; status: SessionStatus }
  | { type: "message.updated"; message: Message }
  | { type: "message.part.updated"; sessionId: string; messageId: string; part: Part }
  | { type: "todo.updated"; sessionId: string; todos: Todo[] }
  | { type: "question.asked"; request: QuestionRequest }
  | { type: "question.replied"; sessionId: string }
  | { type: "permission.asked"; request: PermissionRequest }
  | { type: "permission.replied"; sessionId: string }
