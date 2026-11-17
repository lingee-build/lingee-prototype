import type { Skill } from "@/mock/fixtures/dev"

/** 一个技能的去修复条目：技能 + 失败的检查项（checkId / 原因 / 修复指引）。checkId 弹性：向导传检查项 key（N1/N3…），技能详情「检查」页签传规则名；status 标记 warn 时为提示项（不阻断提交，指令里单独标注） */
export interface SkillFixEntry {
  skill: Skill
  items: Array<{ checkId: string; reason?: string; detail?: string; status?: "fail" | "warn" }>
}

/** N3 资源失败的三档（按 reason 判）：工具不存在 / 个人源工具（企业环境不可达）/ 引用组件未发布 */
export type N3Kind = "missing" | "personal" | "unpublished"
export const n3KindOf = (item: { reason?: string; detail?: string }): N3Kind => {
  if (/个人源/.test(item.reason ?? "")) return "personal"
  if (/组件/.test(item.reason ?? "")) return "unpublished"
  return "missing"
}
/** 从 N3 指引里抠工具 / 组件名，抠不出用指引原文兜底 */
export const n3NameOf = (item: { reason?: string; detail?: string }) => {
  const detail = item.detail ?? ""
  return (
    detail.match(/未找到\s*(?:MCP\s*)?工具\s*(.+)$/)?.[1]?.trim() ??
    detail.match(/MCP\s*工具\s*(\S+?)\s*来自/)?.[1]?.trim() ??
    detail.match(/业务组件\s*'([^']+)'/)?.[1]?.trim() ??
    detail ??
    item.reason ??
    "资源"
  )
}

/**
 * 去修复指令（分层）：只拼规范 / 安全类失败，多技能按技能名分段——技能名一行、其下「• [检查项] 原因 （修复指引）」逐条；
 * 资源失败（N3）不进修复列表，在指令末尾分三档逐条点名（工具不存在 / 个人源 / 组件未发布），由助手在会话里分档处理；
 * 提示项（status=warn，不阻断提交）与必修分开成段并明示「可一并处理或提交后再改」，避免被当成必修项。
 * 三档统一「先补齐依赖、后改技能」：提交校验是保障技能可用，不是让技能为过校验牺牲完整性——
 * 缺失优先排查环境（迁移未同步 / 连接器未装 / 名称不符），移除仅在用户明确不再需要时兜底。
 */
export function buildBatchFixPrompt(entries: SkillFixEntry[]) {
  const fixGroups = entries
    .map((entry) => ({
      name: entry.skill.displayName,
      items: entry.items.filter((x) => x.checkId !== "N3" && x.reason && x.status !== "warn"),
    }))
    .filter((g) => g.items.length > 0)
  const warnGroups = entries
    .map((entry) => ({
      name: entry.skill.displayName,
      items: entry.items.filter((x) => x.checkId !== "N3" && x.reason && x.status === "warn"),
    }))
    .filter((g) => g.items.length > 0)
  const resEntries = entries.filter((entry) => entry.items.some((x) => x.checkId === "N3"))
  const resGroups = resEntries.flatMap((entry) =>
    entry.items.filter((x) => x.checkId === "N3").map((item) => ({ name: entry.skill.displayName, kind: n3KindOf(item), res: n3NameOf(item) })),
  )

  const lines: string[] = []
  if (fixGroups.length > 0) {
    lines.push(`技能「${fixGroups.map((g) => g.name).join("、")}」规范和安全检查未通过，请帮我修复：`)
    fixGroups.forEach((group) => {
      lines.push(group.name)
      group.items.forEach((item) => lines.push(`• [${item.checkId}] ${item.reason}${item.detail ? ` （${item.detail}）` : ""}`))
    })
  }
  if (warnGroups.length > 0) {
    if (lines.length > 0) lines.push("")
    lines.push("另有提示项（不阻断提交，可一并处理或提交后再改）：")
    warnGroups.forEach((group) => {
      lines.push(group.name)
      group.items.forEach((item) => lines.push(`• [${item.checkId}] ${item.reason}${item.detail ? ` （${item.detail}）` : ""}`))
    })
  }
  if (resGroups.length > 0) {
    if (lines.length > 0) lines.push("")
    lines.push("有引用资源检查问题，请向用户澄清并确认处理方式：")
    resGroups.forEach((group) => {
      if (group.kind === "unpublished")
        lines.push(`• 技能「${group.name}」引用的组件「${group.res}」在本地未发布——需先发布组件（指引：业务组件开发页），或确认移除`)
      else if (group.kind === "personal")
        lines.push(`• 技能「${group.name}」引用的工具「${group.res}」来自个人源（企业环境无法访问）——先引导把该连接器配置到企业环境，或更换等价企业工具；用户明确不再需要才移除`)
      else lines.push(`• 技能「${group.name}」引用的工具「${group.res}」不存在——先排查原因（跨租户迁移未同步/连接器未安装/名称不符）并补齐依赖，或更换等价工具；用户明确不再需要才移除`)
    })
  }
  return { prompt: lines.join("\n"), resEntries }
}
