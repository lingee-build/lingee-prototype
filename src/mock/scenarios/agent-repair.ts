import { currentDisplayName } from "@/stores/auth"
import { evaluationObjectUnavailable } from "@/services/evaluation"
import { devStore } from "../dev-store"
import type { Scenario, ScenarioContext } from "./types"

/** 与技能修复一致，仅模拟原对象的本地修改，不按提示词创建或选择其他智能体。 */
export function agentRepairScenario({ repairTarget, projectId }: ScenarioContext): Scenario {
  return {
    todos: ["核对原智能体与评测证据", "保存原智能体的模拟修改"],
    steps: [{ todo: 0, text: "正在核对本次修复绑定的原智能体、可编辑配置与历史评测证据。" }, {
      todo: 1,
      resolve: () => {
        const target = devStore.agents.find(agent => agent.id === repairTarget?.objectId && agent.projectId === projectId)
        if (repairTarget?.objectType !== "agent" || !target || !repairTarget.runId || evaluationObjectUnavailable(`agent:${target.id}`)) return {
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
          text: `已在原智能体「${target.name}」上保存模拟修改，智能体 ID：${target.id}。未创建新智能体，未提交或发布。请检查下方原对象产物，再返回运行记录手动复测；修复效果以新运行结果为准。\n\n这是原型模拟：记录原智能体有待提交修改，用于体验修复回流；不代表真实智能体内容已修复。`,
          card: () => ({ kind: "ai-partner", config: { id: target.id, title: target.name } }),
        }
      },
    }],
  }
}
