import type { Session, Message } from "@/mock/types"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"
import { devStore } from "@/mock/dev-store"
import { useEvaluation, failedRunResults, evaluationObjectUnavailable, verdictLabel, type EvalRun } from "./evaluation"

export type EvaluationRepairTarget = { objectType: "skill" | "agent"; objectId: string; runId: string; resultId?: string }
type StoredRepairTarget = EvaluationRepairTarget | { skillId: string; runId: string }

export const useEvaluationRepairs = create<{ links: Record<string, string>; items: Record<string, { session: Session; messages: Message[]; draft: string; owned?: boolean; target?: StoredRepairTarget }> }>()(persist(() => ({ links: {}, items: {} }), { name: "lingee.evaluation-repairs.v1", storage: createJSONStorage(() => ({ getItem: key => localStorage.getItem(key), setItem: (key, value) => localStorage.setItem(key, value), removeItem: key => localStorage.removeItem(key) })) }))

/** 复用原对象的开发入口，不按显示名称查找或回退到其他项目。 */
export function evaluationRepairObject(key: string) {
  if (evaluationObjectUnavailable(key)) return undefined
  const skill = devStore.skills.find(item => `skill:${item.id}` === key)
  if (skill) return { objectType: "skill" as const, objectId: skill.id, projectId: skill.projectId, editTarget: { kdskill: skill.id } }
  const agent = devStore.agents.find(item => `agent:${item.id}` === key)
  if (agent) return { objectType: "agent" as const, objectId: agent.id, projectId: agent.projectId, editTarget: { agent: agent.id } }
}

export function registerEvaluationRepair(session: Session, draft: string, target: EvaluationRepairTarget, owned = true) {
  useEvaluationRepairs.setState(s => ({
    items: { ...s.items, [session.id]: { session, messages: s.items[session.id]?.messages || [], draft, target, owned } },
    links: { ...s.links, [session.id]: `/dev/${target.objectType}/${encodeURIComponent(target.objectId)}/evaluation?view=report&run=${encodeURIComponent(target.runId)}${target.resultId ? `&focusCase=${encodeURIComponent(target.resultId)}` : ""}` },
  }))
}

/** 仅从结构化会话关联恢复目标，旧记录兼容可信返回链接；不解析用户提示词。 */
export function evaluationRepairTarget(sessionId: string): EvaluationRepairTarget | undefined {
  const { items, links } = useEvaluationRepairs.getState()
  const item = items[sessionId]
  const target = item?.target
  if (target) {
    if ("skillId" in target) return { objectType: "skill", objectId: target.skillId, runId: target.runId }
    if ((target.objectType === "skill" || target.objectType === "agent") && typeof target.objectId === "string" && typeof target.runId === "string") return target
    return { objectType: "skill", objectId: "", runId: "" }
  }
  const link = links[sessionId]
  if (!item && !link) return undefined
  const match = link?.match(/^\/dev\/(skill|agent)\/([^/?]+)\/evaluation\?run=([^&#]+)$/)
  try {
    if (match) return { objectType: match[1] as EvaluationRepairTarget["objectType"], objectId: decodeURIComponent(match[2]), runId: decodeURIComponent(match[3]) }
  } catch { /* 无法恢复的修复记录禁止退回新建流程。 */ }
  return { objectType: "skill", objectId: "", runId: "" }
}

export function repairPrompt(objectId: string, run: EvalRun, resultId?: string) {
  const kind = objectId.split(":")[0]
  if (kind !== "skill" && kind !== "agent") return ""
  const label = kind === "agent" ? "智能体" : "技能"
  const creator = kind === "agent" ? "ai-partner-creator" : "kingdee-skill-creator"
  const scope = kind === "agent" ? "不默认改写所挂载技能或知识源；涉及这些对象的问题应在分析中说明。" : ""
  const results = failedRunResults(run).filter(r => !resultId || r.id === resultId)
  if (!results.length) return ""
  return `/${creator} 请根据评测报告 ${run.code || run.id}，分析${label}「${run.name}」的 ${results.length} 条不通过用例，先说明原因与修复方案，等我确认后再修改文件。先核对目标对象及当前内容与评测时的差异，只修改确认属于当前对象的问题，不放宽用例标准。${scope}修改后说明变更，由我检查后手动复测。`

}

export function repairDisabledReason(objectId: string, run: EvalRun, editable: boolean, resultId?: string): string {
  if (!/^(skill|agent):/.test(objectId)) return "不支持此类型的评测对象"
  if (!editable || evaluationObjectUnavailable(objectId)) return `${objectId.startsWith("agent:") ? "智能体" : "技能"}已删除或当前不可编辑`
  if (["running", "judging", "stopping", "stop_unconfirmed"].includes(run.status)) return "评测结束后可修复"
  if (useEvaluation.getState().runs[objectId]?.some(r => ["running", "judging", "stopping", "stop_unconfirmed"].includes(r.status))) return "当前有活动评测，请等待结束后修复"
  const latest = useEvaluation.getState().runs[objectId]?.find(r => !["running", "judging", "stopping", "stop_unconfirmed"].includes(r.status))
  if (latest && latest.id !== run.id) return "仅最新报告支持修复，请查看最新报告"
  const result = resultId ? run.results.find(r => r.id === resultId) : undefined
  if (resultId && !result) return "未找到此用例的评测结果"
  if (result) {
    if (verdictLabel(result) === "不通过") return ""
    if (verdictLabel(result) === "通过") return "此用例已通过，无需修复"
    return "暂无明确的不通过依据，请先检查执行结果"
  }
  return failedRunResults(run).length > 0 ? "" : "本次运行没有可修复的不通过用例"
}

/** 从来源报告读取快照，不从提示文本推断或改用最新运行。 */
export function evaluationRepairEvidence(target: EvaluationRepairTarget, projectId: string) {
  const key = `${target.objectType}:${target.objectId}`
  const object = evaluationRepairObject(key)
  const run = useEvaluation.getState().runs[key]?.find(r => r.id === target.runId)
  if (!object || object.projectId !== projectId || !run || repairDisabledReason(key, run, true)) return undefined
  return { object, run, failures: failedRunResults(run) }
}
