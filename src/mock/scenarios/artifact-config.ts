import { configTarget, useArtifactConfig } from "@/features/artifact-config/config-state"
import type { Scenario, ScenarioContext } from "./types"

export function artifactConfigScenario(ctx: ScenarioContext): Scenario | undefined {
  const bound = ctx.sessionId ? useArtifactConfig.getState().sessions[ctx.sessionId] : undefined
  if (!bound || !/(修复|更新|补齐)/.test(ctx.prompt)) return
  const target = configTarget(bound.kind, bound.id)
  if (!target || target.projectId !== ctx.projectId) return {
    todos: [], steps: [{ text: "无法确认原产物或所属项目，本次未修改文件。请返回列表重新打开。" }],
  }
  const creator = target.kind === "agent" ? "agent_build" : target.kind === "skill" ? "skill_build" : "mcpapp_build"
  const file = target.kind === "agent" ? "agent.yaml" : target.kind === "skill" ? "skill.yaml" : "i18n/zh-CN.json"
  return {
    pacing: { textChunk: 40, textDelayMs: 12, textHoldMs: 60, toolDelayMs: 250, stepPauseMs: 100 },
    todos: ["检查现有文件与配置", "按现有内容修复配置", "校验完整性"],
    steps: [
      { todo: 0, tools: [{ tool: "skill", title: creator, output: "已加载产物开发规范" }, { tool: "read", title: `检查「${target.name}」的包内文件`, output: "已有能力文件可读取；部分标准配置文件缺失。" }], text: `已检查「${target.name}」的现有文件，接下来根据已有内容修复配置。` },
      { todo: 1, tools: [{ tool: "bash", title: "运行配置补齐脚本", output: `根据已有内容生成 ${file}；反向核对原文件的名称、描述和引用，保留已存在的业务配置。` }] },
      { todo: 2, tools: [{ tool: "bash", title: "校验产物配置完整性", output: "文件完整性与双向引用校验通过；原有能力未改变。" }],
        resolve: () => {
          if (!configTarget(target.kind, target.id)) return { text: "原产物已被移除，本次未保存修复结果。" }
          return { text: `已修复「${target.name}」的产物配置，原有能力保持不变。现在可以从下方产物卡片打开详情，重新发起测试、提交或导出。`,
            card: (): { kind: string; config: Record<string, string> } => target.kind === "agent" ? { kind: "ai-partner", config: { id: target.id, title: target.name } }
              : target.kind === "skill" ? { kind: "kdskill", config: { id: target.id, title: target.name } }
              : { kind: "kdapp-artifact", config: { appCode: target.id, title: target.name } },
          }
        },
      },
    ],
  }
}
