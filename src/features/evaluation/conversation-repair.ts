import { evaluationRepairObject, repairDisabledReason, registerEvaluationRepair } from '@/services/evaluation-repair'
import type { EvaluationConversation } from '@/services/evaluation-conversations'
import type { EvalRun } from '@/services/evaluation'
import { skillRepairScenario } from '@/mock/scenarios/skill-repair'
import { agentRepairScenario } from '@/mock/scenarios/agent-repair'

/** 对话中的修复始终绑定来源报告，复用原对象修复流程。 */
export function respondToRepair(next: EvaluationConversation, run: EvalRun | undefined, text: string, confirm = false) {
  const object = evaluationRepairObject(next.objectId)
  if (!run || !object) return '请先选择有效的评测报告。'
  const reason = repairDisabledReason(next.objectId, run, true)
  if (reason) return reason
  if (confirm && (!next.repair || next.repair.runId !== run.id)) return '请先说“修复这次评测的问题”，查看修复方案后再确认。'
  if (confirm && next.repair?.stage === 'completed') return next.repair.summary
  const target = { objectType: object.objectType, objectId: object.objectId, runId: run.id }
  const context = { repairTarget: target, projectId: object.projectId, prompt: text }
  const scenario = object.objectType === 'skill' ? skillRepairScenario(context) : agentRepairScenario(context)
  const plan = scenario.steps[1].resolve?.()
  if (!confirm) {
    const focus = [next.repair?.runId === run.id ? next.repair.focus : '', text].filter(Boolean).join('\n')
    const summary = `${plan?.text || '暂时无法生成修复方案。'}\n\n本次补充要求：${focus}\n\n可继续补充要求，或回复“确认修复”。`
    next.repair = { runId: run.id, focus, stage: 'planned', summary }
    return summary
  }
  registerEvaluationRepair(next.session, next.repair!.focus, target, false)
  plan?.onAnswer?.([['确认修复']])
  const result = scenario.steps[2].resolve?.()
  const summary = result?.text?.replace('请检查下方原对象产物，再返回来源报告手动复测', '请检查原对象，再在当前对话中发起复测') || '修复未完成，请检查对象与报告状态。'
  next.repair = { ...next.repair!, stage: 'completed', summary }
  return summary
}
