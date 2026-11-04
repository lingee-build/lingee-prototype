import { evaluationRepairEvidence } from "@/services/evaluation-repair"
import { devStore } from "../dev-store"
import type { Scenario, ScenarioContext } from "./types"
import { evaluationObjectUnavailable } from "@/services/evaluation"

/** 本地模拟修复始终按会话绑定的 ID 更新；同名对象和提示词不能改变目标。 */
export function skillRepairScenario({ repairTarget, projectId }: ScenarioContext): Scenario {
  let confirmed = false
  return {
    todos: ["核对原技能与评测证据", "保存原技能的模拟修改"],
    steps: [{ todo: 0, text: "正在核对本次修复绑定的原技能与历史评测证据。" }, {
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

        const target = devStore.skills.find(s => s.id === repairTarget?.objectId && s.projectId === projectId)
        if (repairTarget?.objectType !== "skill" || !target || !evaluationRepairEvidence(repairTarget, projectId) || evaluationObjectUnavailable(`skill:${target.id}`)) return {
          text: "无法确认原技能或其所属项目，已停止修复。请返回评测重新打开修复入口；不会创建同名技能或改动其他对象。",
        }
        devStore.skills = devStore.skills.map(s => s.id === target.id ? { ...s, changed: true } : s)
        return {
          text: `已在原技能「${target.displayName}」上保存模拟修改，技能 ID：${target.id}。未创建新技能，未提交或发布。请检查下方原对象产物，再返回来源报告手动复测；修复效果以新运行结果为准。\n\n这是原型模拟：标记原技能有修改，用于验收对象绑定；不代表真实技能内容已修复。`,
          card: () => ({ kind: "kdskill", config: { id: target.name, title: target.displayName, directory: `skills/${target.name}` } }),
        }
      },
    }],
  }
}
