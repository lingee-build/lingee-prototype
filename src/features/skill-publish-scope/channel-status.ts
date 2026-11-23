import type { Skill } from "@/mock/fixtures/dev"

/**
 * 本地变更判断（按通道内容比对）：当前内容与该通道远端记录（含撤回）比对，不一致即有未同步修改；
 * 远端无提交记录时按空基准——已有内容即有未同步修改，与是否提交过无关。
 */

/** 企业分发通道是否出现「云」（有未同步修改） */
export const entCloudOf = (skill: Pick<Skill, "entChanged" | "enterpriseStatus">) =>
  skill.enterpriseStatus === "saved" || skill.enterpriseStatus === "withdrawn" || !!skill.entChanged

/** 个人自用通道是否出现「云」（有未同步修改） */
export const perCloudOf = (skill: Pick<Skill, "perChanged" | "personalInstalled">) => !skill.personalInstalled || !!skill.perChanged

/** 是否有未同步修改（任一通道），详情弹窗头部「已保存」标识用 */
export const localChangedOf = (skill: Pick<Skill, "entChanged" | "perChanged" | "enterpriseStatus" | "personalInstalled">) => entCloudOf(skill) || perCloudOf(skill)

export type SubmitKind = "same" | "cover" | "first"

/**
   * 提交成分归属（穷举）：该通道远端无记录=first（首提）；有记录且内容一致=same（一致，重新进入审核）；
 * 有记录且有新内容（含驳回重提）=cover（覆盖，提交最新内容）；
 * 已撤回始终归 cover（撤回后重提 ≠ 重复提交，即使内容未变也需重新进入审核）。
 */
export function submitKindOf(skill: Skill, route: "enterprise" | "personal"): SubmitKind {
  if (route === "personal") {
    if (!skill.personalInstalled) return "first"
    return skill.perChanged ? "cover" : "same"
  }
  if (skill.enterpriseStatus === "saved") return "first"
  if (skill.enterpriseStatus === "withdrawn") return "cover"
  return skill.entChanged ? "cover" : "same"
}

const ENT_BASIS: Record<Exclude<Skill["enterpriseStatus"], "saved">, string> = {
  submitted: "上次提交",
  published: "已发布版本",
  rejected: "驳回版本",
  withdrawn: "撤回时版本",
}
/** 企业通道各状态词（状态行统一词条用） */
const ENT_DESC: Record<Exclude<Skill["enterpriseStatus"], "saved">, string> = {
  submitted: "审核中",
  published: "已发布",
  rejected: "已驳回",
  withdrawn: "已撤回",
}

export type ChannelStatus = { text: string }

/**
 * 通道状态行（需求项 3）：该通道的版本状态 + 以该通道上次提交为基准的比对结论，统一一套词条——
 * 「企业审核中，较上次提交无变化」/「个人已提交，较已提交版本无变化」；
 * 单技能提交弹窗、批量第 1 步、技能详情云 hover 各处直接复用（通道前缀随词条自带）。
 */
export function channelStatusOf(skill: Skill, route: "enterprise" | "personal"): ChannelStatus {
  if (route === "personal") {
    if (!skill.personalInstalled) return { text: "个人待提交" }
    return skill.perChanged
      ? { text: "个人已提交，较已提交版本有变化" }
      : { text: "个人已提交，较已提交版本无变化" }
  }
  if (skill.enterpriseStatus === "saved") return { text: "企业未提交" }
  const desc = ENT_DESC[skill.enterpriseStatus]
  const basis = ENT_BASIS[skill.enterpriseStatus]
  return skill.entChanged
    ? { text: `企业${desc}，较${basis}有变化` }
    : { text: `企业${desc}，较${basis}无变化` }
}
