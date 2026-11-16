import { devStore } from "../dev-store"
import { useEvaluation, isActiveRun } from "@/services/evaluation"
import { registerEvaluationRepair, evaluationRepairEvidence, type EvaluationRepairTarget } from "@/services/evaluation-repair"
import type { Session } from "../types"
import type { Scenario } from "./types"
import { skillRepairScenario } from "./skill-repair"
import { agentRepairScenario } from "./agent-repair"

/** 当前对话发起修复：明确核对对象与来源报告，候选不唯一时先澄清。 */
export function conversationRepairScenario(session: Session, prompt: string): Scenario {
  const objects = [
    ...devStore.skills.filter(s => s.projectId === session.projectId).map(s => ({ objectType: "skill" as const, objectId: s.id, name: s.displayName })),
    ...devStore.agents.filter(a => a.projectId === session.projectId).map(a => ({ objectType: "agent" as const, objectId: a.id, name: a.name })),
  ]
  const named = objects.filter(o => prompt.includes(o.objectId) || prompt.includes(o.name))
  const candidates = (named.length ? named : objects).flatMap(o => {
    const reports = (useEvaluation.getState().runs[`${o.objectType}:${o.objectId}`] || []).filter(r => !isActiveRun(r))
    const specified = reports.filter(r => prompt.includes(r.id))
    return (specified.length ? specified : /最新|最近/.test(prompt) ? reports.slice(0, 1) : reports).map(r => ({ ...o, runId: r.id, label: `${o.name} · ${o.objectType === "skill" ? "技能" : "智能体"} ${o.objectId} · ${new Date(r.started).toLocaleString("zh-CN")} · ${r.id}` }))
  })
  let chosen: EvaluationRepairTarget | undefined
  let repairScenario: Scenario | undefined
  return { todos: ["核对评测对象和来源报告", "分析报告中的不通过用例"], steps: [
    candidates.length ? { todo: 0, question: [{ question: "请确认要修复的对象和来源评测报告。继续使用当前对话。", options: candidates.map(c => ({ label: c.label, description: "读取这份报告的全部不通过用例；不会自动复测或发布" })), multiple: false }], onAnswer: answers => {
      const c = candidates.find(c => c.label === answers[0]?.[0]); if (c) chosen = { objectType: c.objectType, objectId: c.objectId, runId: c.runId }
    } } : { text: "未找到可定位的已结束评测报告。请补充当前项目内的对象类型、对象编号和运行编号，或先从对象评测页完成一次评测；当前没有修改任何对象。" },
    { todo: 1, resolve: () => {
      if (!chosen || !evaluationRepairEvidence(chosen, session.projectId)) return { text: "未确认有效目标，或报告没有明确不通过用例；本次未修改对象。可在当前对话补充对象与报告信息后重试。" }
      registerEvaluationRepair(session, prompt, chosen, false)
      repairScenario = chosen.objectType === "skill" ? skillRepairScenario({ prompt, projectId: session.projectId, repairTarget: chosen }) : agentRepairScenario({ prompt, projectId: session.projectId, repairTarget: chosen })
      return repairScenario.steps[1].resolve!()
    } },
    { todo: 1, resolve: () => repairScenario?.steps[2].resolve?.() || { text: "未确认方案，本次未修改对象。" } },
  ] }
}
