import type { ExecutionPlanPart, PermissionRequest, QuestionInfo, ToolPart } from "../types"

export interface ScenarioStep {
  /** 进入这一步时，把第几条待办标为进行中（之前的都算完成） */
  resolve?: () => Partial<ScenarioStep>
  onAnswer?: (answers: string[][]) => void
  todo?: number
  reasoning?: string
  reasoningUnit?: "sentence"
  reasoningDelayMs?: number
  reasoningDisplay?: "scroll"
  tools?: Array<Pick<ToolPart, "tool" | "title" | "detail" | "output" | "stageGroup">>
  /** 向用户提问，回放暂停直到用户回答或跳过。目前三套开发剧本都不提问，一路做到底；需要演示提问时再加 */
  question?: QuestionInfo[]
  /** 申请权限，回放暂停直到用户允许或拒绝。同上，默认剧本不用 */
  permission?: Pick<PermissionRequest, "permission" | "patterns" | "command">
  text?: string
  plan?: ExecutionPlanPart["stages"]
  /** 这一步结束时在回复里追加一张产物卡片（技能 / 智能体 / 业务组件）。走到这一步才执行，产物也在这时落库 */
  card?: () => { kind: string; config: Record<string, string> }
}

export interface Scenario {
  /** Presentation cadence, scoped to this scenario; omitted values retain the normal playback speed. */
  pacing?: {
    textUnit?: "paragraph"
    textChunk: number
    textDelayMs: number
    textHoldMs: number
    toolDelayMs: number
    stepPauseMs: number
  }
  todos: string[]
  steps: ScenarioStep[]
}

export interface ScenarioContext {
  prompt: string
  projectId: string
  sessionId?: string
}

/** 从提示词里猜一个产物名：优先取「」或【】里的字，否则取第一句的前几个字 */
export function entityName(prompt: string, fallback: string) {
  const body = prompt.replace(/^\/\S+\s*/, "").trim()
  const quoted = body.match(/[「【“"]([^」】”"]{2,20})[」】”"]/)?.[1]
  if (quoted) return quoted
  const first = body
    .split(/[，。,.；;：:\n]/)[0]
    .replace(/^(请|帮我|帮忙|我想|我要|需要)?(创建|新建|开发|做|写|生成|设计)?(一个|个)?/, "")
    .trim()
  return first.slice(0, 14) || `新建${fallback}`
}

/** 给产物起一个英文编码：名字里有英文就用它，否则用前缀加时间戳后几位 */
export function slugOf(name: string, prefix: string) {
  const ascii = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return ascii.length >= 3 ? ascii : `${prefix}-${Date.now().toString(36).slice(-5)}`
}
