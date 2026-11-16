import { useEvaluation, isActiveRun, deletingEvaluationObjects } from "./evaluation"
import { useEvaluationConversations } from "./evaluation-conversations"
import { evaluationRepairTarget, useEvaluationRepairs } from "./evaluation-repair"
import { removeEvaluationAttachments } from "./evaluation-attachments"
import { db } from "@/mock/db"
import { useSync } from "@/stores/sync"
import { usePrompt } from "@/stores/prompt"

export const evaluationDeletionNotice = "同时永久删除该对象的评测用例、运行记录、报告、草稿、评测生成及修复会话和专用附件，无法恢复。已下载到本地的报告不受影响。有活动评测或相关会话正在生成时，请先停止并确认结束。"
const omit = <T>(items: Record<string, T>, ids: Set<string>) => Object.fromEntries(Object.entries(items).filter(([id]) => !ids.has(id)))
function attachmentIds(value: unknown, result = new Set<string>()): Set<string> {
  if (!value || typeof value !== "object") return result
  const item = value as Record<string, unknown>
  if (typeof item.id === "string" && typeof item.name === "string" && typeof item.size === "number") result.add(item.id)
  for (const child of Object.values(item)) attachmentIds(child, result)
  return result
}

/** 原型跨存储清理。正式服务须以同一删除事务及任务锁实现。 */
export async function deleteObjectEvaluations(keys: string[]) {
  const targets = new Set(keys)
  if (keys.some(key => deletingEvaluationObjects.has(key))) throw new Error("正在删除，请勿重复提交")
  const state = useEvaluation.getState()
  if (keys.some(key => state.runs[key]?.some(isActiveRun))) throw new Error("对象有活动评测，请先停止并确认结束后再删除")
  const chats = useEvaluationConversations.getState()
  const repairs = useEvaluationRepairs.getState()
  const sessions = new Set(Object.entries(chats.items).filter(([, item]) => targets.has(item.objectId)).map(([id]) => id))
  const repairBindings = new Set<string>()
  for (const id of new Set([...Object.keys(repairs.links), ...Object.keys(repairs.items)])) {
    const target = evaluationRepairTarget(id)
    if (target && targets.has(`${target.objectType}:${target.objectId}`)) { repairBindings.add(id); if (repairs.items[id]?.owned !== false) sessions.add(id) }
  }
  const active = [...db.sessions, ...useSync.getState().sessions, ...Object.values(chats.items).map(item => item.session), ...Object.values(repairs.items).map(item => item.session)]
  if (active.some(session => sessions.has(session.id) && ["running", "clarification"].includes(session.status))) throw new Error("相关评测会话尚未结束，请先停止生成或处理待答请求")
  keys.forEach(key => deletingEvaluationObjects.add(key))
  const nextEval = { cases: omit(state.cases, targets), runs: omit(state.runs, targets), drafts: omit(state.drafts, targets), deletedObjects: { ...state.deletedObjects, ...Object.fromEntries(keys.map(key => [key, true as const])) } }
  const nextChats = { items: omit(chats.items, sessions) }
  const nextRepairs = { items: omit(repairs.items, repairBindings), links: omit(repairs.links, repairBindings) }
  const retained = attachmentIds([nextEval, nextChats, nextRepairs])
  const removed = [...attachmentIds([keys.map(key => [state.cases[key], state.runs[key], state.drafts[key]]), [...sessions].map(id => [chats.items[id], repairs.items[id]])])].filter(id => !retained.has(id))
  const records: [string, unknown][] = [["lingee.evaluation.v1", nextEval], ["lingee.evaluation-conversations.v1", nextChats], ["lingee.evaluation-repairs.v1", nextRepairs]]
  const previous = new Map<string, string | null>()
  try {
    // 先验证元数据可持久化，再删除附件；附件事务失败则还原持久化记录。
    for (const [key, value] of records) {
      previous.set(key, localStorage.getItem(key))
      localStorage.setItem(key, JSON.stringify({ state: value, version: 0 }))
    }
    await removeEvaluationAttachments(removed)
  } catch (error) {
    for (const [key, value] of previous) {
      try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value) } catch { /* 原始失败向调用方反馈，不能显示删除成功。 */ }
    }
    keys.forEach(key => deletingEvaluationObjects.delete(key))
    throw error
  }
  // 保留等待附件事务期间其他对象的最新状态。
  useEvaluation.setState(s => ({ cases: omit(s.cases, targets), runs: omit(s.runs, targets), drafts: omit(s.drafts, targets), deletedObjects: { ...s.deletedObjects, ...nextEval.deletedObjects } }))
  useEvaluationConversations.setState(s => ({ items: omit(s.items, sessions) }))
  useEvaluationRepairs.setState(s => ({ items: omit(s.items, repairBindings), links: omit(s.links, repairBindings) }))
  db.sessions = db.sessions.filter(item => !sessions.has(item.id))
  db.messages = db.messages.filter(item => !sessions.has(item.sessionId))
  useSync.setState(s => ({ sessions: s.sessions.filter(item => !sessions.has(item.id)), messages: omit(s.messages, sessions), todos: omit(s.todos, sessions), questions: omit(s.questions, sessions), permissions: omit(s.permissions, sessions) }))
  if (sessions.has(usePrompt.getState().draft.sessionId || "")) usePrompt.getState().setDraft("")
  keys.forEach(key => deletingEvaluationObjects.delete(key))
}
