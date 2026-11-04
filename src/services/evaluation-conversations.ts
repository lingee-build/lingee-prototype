import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Message, Session } from "@/mock/types"
import { caseValidation, evaluationObjectUnavailable, saveCases, useEvaluation, type EvalAttachment, type EvalCase } from "./evaluation"

export interface EvaluationConversation {
  repair?: { runId: string; focus: string; stage: "planned" | "completed"; summary: string }
  /** 仅兼容旧记录，不再作为会话绑定依据。 */
  runId?: string
  reportContext?: string[]
  reportTurns?: { id: string; createdAt: number; prompt: string; source: string; reportIds: string[]; reports: ReturnType<typeof import('@/features/evaluation/report-context').reportEvidence>[]; response: string }[]
  session: Session
  objectId: string
  objectName: string
  messages: Message[]
  request: string
  rule: string
  files: EvalAttachment[]
  drafts: EvalCase[]
  adopted: Record<string, string>
}
interface ConversationState {
  items: Record<string, EvaluationConversation>
  put: (value: EvaluationConversation) => boolean
  remove: (id: string) => boolean
}

/** 一次响应基于最新列表生成，保存失败不覆盖原列表；会话失败回滚本次用例修改。 */
export function saveEvaluationConversation(value: EvaluationConversation, cases?: EvalCase[]) {
  if (evaluationObjectUnavailable(value.objectId)) throw new Error("评测对象已删除，无法保存。")
  const previous = useEvaluation.getState().cases[value.objectId] || []
  if (cases) {
    for (const item of cases) {
      const error = caseValidation(item)
      if (error) throw new Error(`${item.name}：${error}`)
    }
    if (!saveCases(value.objectId, structuredClone(cases))) throw new Error("用例保存失败，原内容和输入已保留，请重试。")
  }
  if (!useEvaluationConversations.getState().put(value)) {
    if (cases && !saveCases(value.objectId, previous)) throw new Error("会话保存失败且用例回退失败，请恢复存储并核对当前列表后重试。")
    throw new Error("会话保存失败，请恢复存储后重试。")
  }
}
let writeSucceeded = true
export const useEvaluationConversations = create<ConversationState>()(persist((set, get) => {
  const commit = (items: ConversationState["items"]) => {
    const previous = get().items
    set({ items })
    if (writeSucceeded) return true
    // localStorage 单次写入失败不会替换旧值；内存也恢复原记录。
    set({ items: previous })
    return false
  }
  return {
    items: {},
    put: value => commit({ ...get().items, [value.session.id]: structuredClone(value) }),
    remove: id => commit(Object.fromEntries(Object.entries(get().items).filter(([key]) => key !== id))),
  }
}, {
  name: "lingee.evaluation-conversations.v1",
  partialize: ({ items }) => ({ items }),
  storage: {
    getItem: key => {
      try { return JSON.parse(localStorage.getItem(key) || "null") } catch { return null }
    },
    setItem: (key, value) => {
      try { localStorage.setItem(key, JSON.stringify(value)); writeSucceeded = true }
      catch { writeSucceeded = false }
    },
    removeItem: key => localStorage.removeItem(key),
  },
}))
