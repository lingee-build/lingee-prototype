import type { ManifestToolEntry } from "@/mock/fixtures/skill-detail"

/**
 * 关联工具的分组与徽标推导，照抄线上 packages/kcode-web/src/utils/skill-tool-groups.ts：
 *  - 无 source 的条目（旧技能 / 漏记）不分组、不显示第二行；
 *  - 有 source 的条目按 租户工具 → 第三方工具 → 个人 MCP → 业务组件 → 内置工具 分组；
 *  - project_mcpapps 与 mcpapps 在展示层合并为「业务组件」一组，前者第二行标「本工程」。
 */

export const TOOL_GROUP_ORDER = ["tenant", "third_party", "personal", "mcpapps", "builtin"] as const
export type ToolGroupKey = (typeof TOOL_GROUP_ORDER)[number]

/** 枚举改名前的旧值 → 新值；只做读侧兼容 */
const LEGACY_SOURCE_ALIASES: Record<string, string> = {
  business_component: "mcpapps",
  project_component: "project_mcpapps",
}

export type SkillToolCard = {
  /** 卡片主名：display_name 优先 */
  name: string
  /** 工具编码：第一行的小字灰编码 */
  code: string
  desc: string
  /** manifest 声明的 type（仅记录，不参与展示：无来源记录的旧技能也不显示第二行） */
  type: string
  /** 来源记录值（空串 = 无记录） */
  source: string
  providerType?: string
  serviceName?: string
  /** project_mcpapps：并入业务组件组，徽标标「本工程」 */
  isProjectComponent: boolean
}

export type SkillToolGroup = {
  /** null = 无来源记录的条目，不显示分组标题 */
  key: ToolGroupKey | null
  tools: SkillToolCard[]
}

const clean = (v: unknown) => (v == null ? "" : String(v).trim().replace(/^["']+|["']+$/g, ""))

/** manifest 条目 → 展示卡片字段（source 为空即旧技能条目；旧枚举值读侧归一） */
export function skillToolCards(ta: readonly ManifestToolEntry[]): SkillToolCard[] {
  return ta.map((tool) => {
    const raw = clean(tool.source)
    const source = LEGACY_SOURCE_ALIASES[raw] ?? raw
    return {
      name: tool.display_name || tool.id || "-",
      code: clean(tool.id),
      desc: tool.description || "-",
      type: (tool.type || "-") as string,
      source,
      ...(clean(tool.provider_type) ? { providerType: clean(tool.provider_type) } : {}),
      ...(clean(tool.service_name) ? { serviceName: clean(tool.service_name) } : {}),
      isProjectComponent: source === "project_mcpapps",
    }
  })
}

/** 按来源分组：组序 = TOOL_GROUP_ORDER；无 source / 未知 source 归入 key=null 的首组 */
export function groupSkillTools(cards: readonly SkillToolCard[]): SkillToolGroup[] {
  const buckets = new Map<ToolGroupKey | null, SkillToolCard[]>()
  for (const card of cards) {
    const raw = card.isProjectComponent ? "mcpapps" : card.source
    const key = (TOOL_GROUP_ORDER as readonly string[]).includes(raw) ? (raw as ToolGroupKey) : null
    const bucket = buckets.get(key)
    if (bucket) bucket.push(card)
    else buckets.set(key, [card])
  }
  const groups: SkillToolGroup[] = []
  const legacy = buckets.get(null)
  if (legacy) groups.push({ key: null, tools: legacy })
  for (const key of TOOL_GROUP_ORDER) {
    const list = buckets.get(key)
    if (list) groups.push({ key, tools: list })
  }
  return groups
}

/** provider_type → 供应商文案；字典里没有的值原样显示 */
export function providerTypeName(providerType: string, t: (key: string) => string): string {
  const key = `kcode.skillPreview.providerType.${providerType}`
  const val = t(key)
  return val && val !== key ? val : providerType
}

/** 分组标题已经说明来源的分组：第二行只写 MCP 服务名称，不再重复供应商 */
const GROUP_IMPLIES_PROVIDER: readonly string[] = ["third_party", "personal"]

/** 组名已完整表达来源与范围的分组（内置工具就是平台自带）：第二行整行不显示 */
const HIDES_BADGE: readonly string[] = ["builtin"]

/**
 * 第二行徽标，有才显示，中间用「 · 」连接：
 *  - 本工程业务组件：「项目名称 · 供应商」（工具本身已是组件里的 MCP 工具，服务名不再重复）
 *  - 第三方工具 / 个人 MCP：组名已说明来源，只写 MCP 服务名称
 *  - 内置工具：不显示第二行
 *  - 其余分组：供应商 · 服务
 */
export function toolBadgeText(tool: SkillToolCard, t: (key: string) => string, projectName?: string): string {
  if (!tool.source || HIDES_BADGE.includes(tool.source)) return ""
  if (tool.isProjectComponent) {
    return [projectName || t("kcode.skillPreview.toolGroup.projectTag"), tool.providerType ? providerTypeName(tool.providerType, t) : ""]
      .filter(Boolean)
      .join(" · ")
  }
  const parts: string[] = []
  if (tool.providerType && !GROUP_IMPLIES_PROVIDER.includes(tool.source)) parts.push(providerTypeName(tool.providerType, t))
  if (tool.serviceName) parts.push(tool.serviceName)
  return parts.join(" · ")
}