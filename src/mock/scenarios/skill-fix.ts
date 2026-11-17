import { devStore } from "../dev-store"
import type { Scenario } from "./types"
import { n3KindOf, n3NameOf, type SkillFixEntry } from "@/features/skill-batch/fix-prompt"

/**
 * 去修复会话的回放剧本：助手先修规范 / 安全类问题；资源失败统一在消息流末尾弹澄清卡，
 * 每个资源问题一道题、逐题决策——工具不存在 / 个人源：补齐依赖 / 更换 / 移除；
 * 组件未发布：去发布 / 移除。移除动作统一叫「移除引用」（删的是技能里的引用，不是工具/组件本身）；
 * 三档统一「先补齐依赖、后改技能」：提交校验是保障技能可用，缺依赖先修环境，
 * 移除是破坏性变更、仅在用户明确不再需要时兜底；暂不处理用「跳过」，不设「保留」选项；
 * 选「补齐依赖 / 去发布组件」要等依赖真补齐后重检才通过，暂不改写检查结论。
 */
export function skillFixScenario(entries: SkillFixEntry[]): Scenario {
  const fixGroups = entries
    .map((entry) => ({ name: entry.skill.displayName, items: entry.items.filter((x) => x.checkId !== "N3" && x.reason && x.status !== "warn") }))
    .filter((g) => g.items.length > 0)
  const warnGroups = entries
    .map((entry) => ({ name: entry.skill.displayName, items: entry.items.filter((x) => x.checkId !== "N3" && x.reason && x.status === "warn") }))
    .filter((g) => g.items.length > 0)
  const n3Items = entries.flatMap((entry) =>
    entry.items.filter((x) => x.checkId === "N3").map((item) => ({ skill: entry.skill, item })),
  )
  const fixN = fixGroups.reduce((n, g) => n + g.items.length, 0)
  const list = fixGroups.map((g) => `${g.name}\n${g.items.map((item) => `• [${item.checkId}] ${item.reason}`).join("\n")}`).join("\n")
  // 提示项（warn）不阻断提交：回复里单独归为「已一并优化 / 提交不受影响」，不与必修混排
  const warnDone = warnGroups
    .map((g) => `${g.name}\n${g.items.map((item) => `• [${item.checkId}] ${item.reason} → 已一并优化，提交不受影响`).join("\n")}`)
    .join("\n")

  const resolveResource = (answers: string[][]) => {
    n3Items.forEach((entry, index) => {
      // 用户已确认改技能的（更换/移除引用）不再算不通过；
      // 补齐依赖 / 去发布组件是环境侧动作，依赖补齐前重检仍应拦截，暂不改写检查结论
      const choice = answers[index]?.[0]
      if (!["移除引用", "更换工具"].includes(choice ?? "")) return
      devStore.skills = devStore.skills.map((s) =>
        s.id === entry.skill.id ? { ...s, n3Resolved: true, entChanged: true, perChanged: true } : s,
      )
    })
  }

  const steps: Scenario["steps"] = []

  // 尾步文案按澄清结果动态生成：onAnswer 在尾步渲染前执行，改 tailStep.text 即生效
  const tailStep: Scenario["steps"][number] = { todo: fixGroups.length > 0 ? 1 : 0, text: "" }
  const writeTail = (answers?: string[][]) => {
    const lines: string[] = []
    n3Items.forEach((x, i) => {
      const choice = answers?.[i]?.[0]
      if (!choice) return
      const res = n3NameOf(x.item)
      const name = x.skill.displayName
      if (n3KindOf(x.item) === "unpublished") {
        if (choice === "去发布组件") lines.push(`组件 ${res} 需先在业务组件开发页发布，发布后回到技能列表重新提交。`)
        else if (choice === "移除引用") lines.push(`已移除「${name}」对组件 ${res} 的引用，本地修改已保存，请回到技能列表重新提交。`)
        else lines.push(`收到，按「${choice}」处理组件 ${res}；需要调整直接回复。`)
        return
      }
      if (choice === "补齐依赖") {
        lines.push(
          n3KindOf(x.item) === "personal"
            ? `「${res}」来自个人源，需先将该 MCP 连接器配置到企业环境，配好后回到技能列表重新提交。`
            : `工具「${res}」需先排查去向（跨租户迁移未同步 / 连接器未安装 / 名称不符）并补齐，补齐后回到技能列表重新提交。`,
        )
      } else if (choice === "移除引用") lines.push(`已移除「${name}」对工具「${res}」的引用，本地修改已保存，请回到技能列表重新提交。`)
      else if (choice === "更换工具") {
        // followUp 输入的新工具名拼在该题答案末尾；没填则继续等用户在会话里回复
        const next = answers?.[i]?.[1]?.trim()
        lines.push(
          next
            ? `已把「${name}」引用的工具「${res}」更换为「${next}」，本地修改已保存，请回到技能列表重新提交。`
            : `请回复新的工具名，确认后我再替换「${name}」引用的「${res}」。`,
        )
      } else lines.push(`收到，按「${choice}」处理「${res}」；需要调整直接回复。`)
    })
    tailStep.text = lines.length === 0 ? "全部问题已修复，请回到技能列表重新提交。" : lines.join("\n")
  }
  writeTail()
  const onAnswer = (answers: string[][]) => {
    resolveResource(answers)
    writeTail(answers)
  }
  if (fixGroups.length > 0 || warnGroups.length > 0) {
    const warnN = warnGroups.reduce((n, g) => n + g.items.length, 0)
    const warnList = warnGroups.map((g) => `${g.name}\n${g.items.map((item) => `• [${item.checkId}] ${item.reason}`).join("\n")}`).join("\n")
    steps.push({
      todo: 0,
      reasoning: "逐项核对检查报告，定位每个失败项对应的 SKILL.md 段落与脚本",
      text:
        fixGroups.length > 0
          ? `收到，开始修复 ${fixN} 个规范/安全问题：\n${list}`
          : `收到，开始处理 ${warnN} 个提示项（不阻断提交，可提交后再改）：\n${warnList}`,
    })
    steps.push({
      todo: 0,
      tools: [
        // 纯提示项场景的修复动作是精简/拆分正文，不是补齐合规声明
        {
          tool: "bash",
          title: fixGroups.length > 0 ? "补齐合规声明与 Frontmatter 字段" : "精简 SKILL.md 正文（拆分内容到 references/）",
          detail: "skills/*/SKILL.md",
          output: fixGroups.length > 0 ? "已按规范补齐缺失段落" : "已精简正文并拆出参考文件",
          stageGroup: true,
        },
      ],
      text:
        fixGroups.length > 0
          ? `已修复：\n${fixGroups.map((g) => `${g.name}\n${g.items.map((item) => `• [${item.checkId}] ${item.reason} → 已按规范补齐/修正`).join("\n")}`).join("\n")}${warnDone ? `\n\n提示项（不阻断提交）已一并处理：\n${warnDone}` : ""}`
          : `提示项已一并优化（提交不受影响）：\n${warnDone}`,
    })
  }
  if (n3Items.length > 0) {
    steps.push({
      todo: fixGroups.length > 0 ? 1 : 0,
      text: fixGroups.length > 0 ? "规范/安全类问题已修复。检查中遇到资源问题，需要你确认处理方式——" : "检查中遇到资源问题，需要你确认处理方式——",
      question: n3Items.map((x) =>
        n3KindOf(x.item) === "unpublished"
          ? {
              question: `技能「${x.skill.displayName}」引用的组件 ${n3NameOf(x.item)} 在本地未发布，如何处理呢？`,
              options: [
                { label: "去发布组件", description: "前往业务组件开发页发布该组件，发布后回到技能列表重新提交" },
                { label: "移除引用", description: "移除对该组件的引用，仅当不再需要该功能时选择；否则技能可能将以不完整功能提交发布" },
              ],
              multiple: false,
            }
          : {
              question:
                n3KindOf(x.item) === "personal"
                  ? `技能「${x.skill.displayName}」引用的工具「${n3NameOf(x.item)}」来自个人源，企业环境无法访问，如何处理呢？`
                  : `技能「${x.skill.displayName}」引用的工具「${n3NameOf(x.item)}」不存在，如何处理呢？`,
              options:
                n3KindOf(x.item) === "personal"
                  ? [
                      { label: "补齐依赖", description: "将该 MCP 连接器配置到企业环境，技能引用不动，配好后回到技能列表重新提交" },
                      { label: "更换工具", description: "确认企业环境已有等价工具时替换引用，保持功能可用", followUp: "输入替换后的新工具名" },
                      { label: "移除引用", description: "移除对该工具的引用，仅当不再需要该功能时选择；否则技能可能将以不完整功能提交发布" },
                    ]
                  : [
                      { label: "补齐依赖", description: "先排查工具去向（跨租户迁移未同步 / 连接器未安装 / 名称不符）并补齐，技能引用不动，补齐后回到技能列表重新提交" },
                      { label: "更换工具", description: "确认企业环境已有等价工具时替换引用，保持功能可用", followUp: "输入替换后的新工具名" },
                      { label: "移除引用", description: "移除对该工具的引用，仅当不再需要该功能时选择；否则技能可能将以不完整功能提交发布" },
                    ],
              multiple: false,
            },
      ),
      onAnswer,
    })
  }
  steps.push(tailStep)

  return {
    todos: [
      ...(fixGroups.length > 0 ? ["修复规范/安全检查问题"] : warnGroups.length > 0 ? ["处理提示项（不阻断提交）"] : []),
      ...(n3Items.length > 0 ? ["确认资源处理方式"] : []),
      "引导重新提交",
    ],
    steps,
  }
}
