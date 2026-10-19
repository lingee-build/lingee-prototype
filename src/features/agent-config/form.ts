import type { Translate } from "@/i18n"
import type { Agent, ModelLevel } from "@/mock/fixtures/dev"
import { domainI18nKeys } from "@/vendor/kcode-web/src/utils/agent-domain"

export { domainI18nKeys }

/** 缺失即默认：允许切换模型、默认「自动」 */
export const MODEL_POLICY_DEFAULTS: { allowModelSwitch: boolean; defaultModelLevel: ModelLevel } = {
  allowModelSwitch: true,
  defaultModelLevel: "auto",
}

/** 配置面板里可编辑的字段 */
export type AgentForm = Pick<Agent, "name" | "desc" | "domain" | "avatar" | "role" | "skills" | "knowledge"> & {
  allowModelSwitch: boolean
  defaultModelLevel: ModelLevel
}

export type SetForm = (patch: Partial<AgentForm>) => void

export interface TabProps {
  form: AgentForm
  set: SetForm
  readonly?: boolean
}

export const formOf = (agent: Agent): AgentForm => ({
  name: agent.name,
  desc: agent.desc,
  domain: agent.domain || "general",
  avatar: agent.avatar,
  role: agent.role,
  skills: agent.skills.map((x) => ({ ...x })),
  knowledge: agent.knowledge.map((x) => ({ ...x })),
  allowModelSwitch: agent.allowModelSwitch ?? MODEL_POLICY_DEFAULTS.allowModelSwitch,
  defaultModelLevel: agent.defaultModelLevel ?? MODEL_POLICY_DEFAULTS.defaultModelLevel,
})

const AVATAR_PRESETS = ["/preset-agent-avatar-1.png", "/preset-agent-avatar-2.png", "/preset-agent-avatar-3.png"]

/** 根据编码确定性选取预设头像，同一智能体始终显示同一图标 */
export function pickAvatar(seed: string) {
  const hash = Array.from(seed).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0)
  return AVATAR_PRESETS[Math.abs(hash) % AVATAR_PRESETS.length]
}

const clip = (value: string) => (value.length > 24 ? `${value.slice(0, 24)}…` : value)

/** 比较保存前后的表单，生成更新日志里的改动摘要（文案 key 与线上的变更记录一致） */
export function diffChanges(before: AgentForm, after: AgentForm, t: Translate) {
  const field = (key: string, value: string) => t(`kcode.agentChangelog.event.fieldValue.${key}`, { value })
  const names = (list: string[]) => list.join(t("kcode.agentChangelog.nameSeparator"))
  const skillNames = (from: AgentForm, to: AgentForm) => from.skills.filter((x) => !to.skills.some((y) => y.id === x.id)).map((x) => x.name)
  const knowledgeNames = (from: AgentForm, to: AgentForm) =>
    from.knowledge
      .filter((x) => !to.knowledge.some((y) => y.id === x.id))
      .map((x) => `${t(`kcode.agentChangelog.event.knowledge.kind.${x.kind}`)}「${x.name}」`)
  const domainName = (value: string) => (domainI18nKeys[value] ? t(domainI18nKeys[value]) : value)

  return [
    before.name !== after.name && field("name", clip(after.name)),
    before.desc !== after.desc && field("desc", clip(after.desc)),
    before.avatar !== after.avatar && field("avatar", ""),
    before.domain !== after.domain && field("domain", domainName(after.domain)),
    before.role !== after.role && field("role", clip(after.role.replace(/\s+/g, " "))),
    before.defaultModelLevel !== after.defaultModelLevel && field("defaultModelLevel", t(`kcode.agentConfig.basic.modelPolicy.level.${after.defaultModelLevel}`)),
    before.allowModelSwitch !== after.allowModelSwitch &&
      field("allowModelSwitch", t(`kcode.agentConfig.basic.modelPolicy.${after.allowModelSwitch ? "switchOn" : "switchOff"}`)),
    skillNames(after, before).length > 0 && t("kcode.agentChangelog.event.skill.added", { names: names(skillNames(after, before)) }),
    skillNames(before, after).length > 0 && t("kcode.agentChangelog.event.skill.removed", { names: names(skillNames(before, after)) }),
    knowledgeNames(after, before).length > 0 && t("kcode.agentChangelog.event.knowledge.added", { names: names(knowledgeNames(after, before)) }),
    knowledgeNames(before, after).length > 0 && t("kcode.agentChangelog.event.knowledge.removed", { names: names(knowledgeNames(before, after)) }),
  ].filter((x): x is string => typeof x === "string")
}
