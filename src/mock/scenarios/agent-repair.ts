import { evaluationRepairEvidence } from "@/services/evaluation-repair"
import { currentDisplayName } from "@/stores/auth"
import { evaluationObjectUnavailable } from "@/services/evaluation"
import { devStore } from "../dev-store"
import type { Scenario, ScenarioContext } from "./types"

/** 与技能修复一致，仅模拟原对象的本地修改，不按提示词创建或选择其他智能体。 */
export function agentRepairScenario({ repairTarget, projectId }: ScenarioContext): Scenario {
  let confirmed = false
  return {
    todos: ["核对原智能体与评测证据", "保存原智能体的模拟修改"],
    steps: [{ todo: 0, text: "正在核对本次修复绑定的原智能体、可编辑配置与历史评测证据。" }, {
      todo: 1,
      resolve: () => {
        const evidence = repairTarget && evaluationRepairEvidence(repairTarget, projectId)
        if (!evidence) return { text: "无法读取最新报告的有效失败证据，本次不修改对象。" }
        return {
          text: `已读取 ${evidence.failures.length} 条不通过用例：\n${evidence.failures.map(c => `- ${c.name}：${c.evidence || "请结合逐项标准查看失败依据"}`).join("\n")}\n\n修复方案：先核对当前对象与评测时的差异，针对明确失败补充处理约束；不改用例标准。原型仅模拟保存变更标记，确认后执行。`,
          question: [{ question: "是否按上述方案修改被测对象？", options: [{ label: "确认修复", description: "修改当前对象，完成后手动复测" }, { label: "暂不修改", description: "保留分析，本次不修改对象" }], multiple: false }],
          onAnswer: answers => { confirmed = answers[0]?.[0] === "确认修复" },
        }
      },
    }, {
      todo: 1,
      resolve: () => {
        if (!confirmed) return { text: "尚未确认修复方案，本次未修改对象。" }

        const target = devStore.agents.find(agent => agent.id === repairTarget?.objectId && agent.projectId === projectId)
        if (repairTarget?.objectType !== "agent" || !target || !evaluationRepairEvidence(repairTarget, projectId) || evaluationObjectUnavailable(`agent:${target.id}`)) return {
          text: "无法确认原智能体或其所属项目，已停止修复。请返回评测重新打开修复入口；不会创建同名智能体或改动其他对象。",
        }
        devStore.agents = devStore.agents.map(agent => agent.id === target.id ? {
          ...agent,
          status: "saved",
          isChanged: !!agent.backendStatus,
          changelog: { ...agent.changelog, pending: [...agent.changelog.pending, {
            createdAt: new Date().toISOString(), operator: currentDisplayName(),
            summary: `评测问题修复（原型模拟，运行 ${repairTarget.runId}）`,
          }] },
        } : agent)
        return {
          text: `已在原智能体「${target.name}」上保存模拟修改，智能体 ID：${target.id}。未创建新智能体，未提交或发布。请检查下方原对象产物，再返回来源报告手动复测；修复效果以新运行结果为准。\n\n这是原型模拟：记录原智能体有待提交修改，用于体验修复回流；不代表真实智能体内容已修复。`,
          card: () => ({ kind: "ai-partner", config: { id: target.id, title: target.name } }),
        }
      },
    }],
  }
}
