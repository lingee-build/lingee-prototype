import { devStore } from "../dev-store"
import type { Scenario, ScenarioContext } from "./types"
import { evaluationObjectUnavailable } from "@/services/evaluation"

/** 本地模拟修复始终按会话绑定的 ID 更新；同名对象和提示词不能改变目标。 */
export function skillRepairScenario({ repairTarget, projectId }: ScenarioContext): Scenario {
  return {
    todos: ["核对原技能与评测证据", "保存原技能的模拟修改"],
    steps: [{ todo: 0, text: "正在核对本次修复绑定的原技能与历史评测证据。" }, {
      todo: 1,
      resolve: () => {
        const target = devStore.skills.find(s => s.id === repairTarget?.objectId && s.projectId === projectId)
        if (repairTarget?.objectType !== "skill" || !target || !repairTarget.runId || evaluationObjectUnavailable(`skill:${target.id}`)) return {
          text: "无法确认原技能或其所属项目，已停止修复。请返回评测重新打开修复入口；不会创建同名技能或改动其他对象。",
        }
        devStore.skills = devStore.skills.map(s => s.id === target.id ? { ...s, changed: true } : s)
        return {
          text: `已在原技能「${target.displayName}」上保存模拟修改，技能 ID：${target.id}。未创建新技能，未提交或发布。可通过下方返回运行记录，再使用原对象的最新已保存内容重新运行。\n\n这是原型模拟：标记原技能有修改，用于验收对象绑定；不代表真实技能内容已修复。`,
          card: () => ({ kind: "kdskill", config: { id: target.name, title: target.displayName, directory: `skills/${target.name}` } }),
        }
      },
    }],
  }
}
