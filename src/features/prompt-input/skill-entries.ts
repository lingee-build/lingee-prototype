import type { IconName } from "@/ui"

/** 输入框下方的技能入口胶囊（顺序与线上一致） */
export const SKILL_TABS: Array<{ name: string; labelKey: string; iconName: IconName }> = [
  { name: "kingdee-skill-creator", labelKey: "kcode.nav.skillDev", iconName: "skill-bolt" },
  { name: "ai-partner-creator", labelKey: "kcode.nav.agentDev", iconName: "ai-partner" },
  { name: "kingdee-design", labelKey: "kcode.starter.app.universal", iconName: "app-prototype" },
  { name: "standalone-build", labelKey: "kcode.starter.app.general", iconName: "app-general" },
  { name: "app-build", labelKey: "kcode.starter.app.erp", iconName: "app-cosmic" },
  { name: "mcp-apps-builder", labelKey: "kcode.starter.app.mcp", iconName: "mcp" },
]

/** 技能触发名 → 胶囊上展示的名字（触发名本身不变） */
const SKILL_DISPLAY_NAME_MAP: Record<string, string> = {
  "evaluation-case-designer": "评测用例设计",
  "app-build": "cosmic-app-builder",
  "kd-frontend-development": "cosmic-kwc-builder",
  "standalone-build": "general-app-builder",
  "kingdee-skill-creator": "skill-builder",
  "ai-partner-creator": "agent-builder",
  "kingdee-design": "prototype-builder",
}

export const getSkillDisplayName = (trigger: string) => SKILL_DISPLAY_NAME_MAP[trigger] ?? trigger

/** "/trigger 正文" → { skill, body }；没有前导斜杠命令则 skill 为空 */
export function parseSlash(text: string) {
  const match = text.match(/^\/(\S+)(\s+[\s\S]*)?$/)
  if (!match) return { skill: undefined, body: text }
  return { skill: match[1], body: match[2]?.trimStart() ?? "" }
}
