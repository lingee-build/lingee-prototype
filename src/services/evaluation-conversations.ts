import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Message, Session } from "@/mock/types"
import { saveCases, type EvalAttachment, type EvalCase } from "./evaluation"

export interface EvaluationConversation {
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

/** 先保存加入关联，正式用例保存失败时恢复关联，不留下“已加入”的假状态。 */
export function saveDraftAdoption(value: EvaluationConversation, cases: EvalCase[]) {
  const store = useEvaluationConversations.getState()
  const previous = store.items[value.session.id]
  if (!previous || !store.put(value)) throw new Error("草稿关联保存失败，原用例、草稿和选择已保留，请重试。")
  if (saveCases(value.objectId, cases)) return
  if (!store.put(previous)) {
    // 本次业务操作已失败，内存展示原关联；持久化恢复失败必须明确告知。
    useEvaluationConversations.setState(s => ({ items: { ...s.items, [previous.session.id]: previous } }))
    throw new Error("用例保存失败，原用例、草稿和选择已保留；关联记录尚未恢复到存储，请恢复存储后重试。")
  }
  throw new Error("用例保存失败，原用例、草稿和选择已保留，请重试。")
}
