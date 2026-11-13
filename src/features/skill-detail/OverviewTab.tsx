import { useT } from "@/i18n"
import type { Agent, Skill } from "@/mock/fixtures/dev"
import type { SkillDetail } from "@/mock/fixtures/skill-detail"
import { SkillScopeInfo } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import { ChangelogSection } from "@/features/agent-config/ChangelogSection"
import "@/features/agent-config/agent-config.css"

const dateOf = (date: string) => `${date.replaceAll(".", "-")}T00:00:00+08:00`

/** 技能概述与智能体详情共用区块卡片和版本时间线。 */
export function OverviewTab(props: { skill: Skill; detail: SkillDetail }) {
  const t = useT()
  const { skill, detail } = props
  const published = !!skill.everPublished || skill.personalInstalled
  const changelog: Agent["changelog"] = {
    pending: skill.changed || (!published && skill.enterpriseStatus === "saved")
      ? [{ createdAt: dateOf(detail.updateTime), operator: detail.developer, summary: published ? "技能内容已修改，待提交发布" : "创建技能，待提交发布" }]
      : [],
    versions: published ? [...detail.changelog].reverse().map(entry => ({
      version: entry.version.replace(/^v/i, ""),
      releasedAt: dateOf(entry.date),
      operator: detail.developer,
      lines: entry.items,
    })) : [],
  }

  return (
    <div className="agent-config-panel agent-detail-cards flex flex-col gap-5 px-6 pb-5">
      <section className="flex flex-col gap-3">
        <h3 className="agent-config-section-title">{t("kcode.skillPreview.section.description")}</h3>
        <div className="agent-config-surface text-[14px] leading-[22px] text-text-base whitespace-pre-wrap break-words">{skill.desc}</div>
      </section>
      <section className="flex flex-col gap-3">
        <h3 className="agent-config-section-title">发布信息</h3>
        <div className="agent-config-surface text-[14px] leading-[22px] text-text-base">
          <SkillScopeInfo skill={skill} />
        </div>
      </section>
      <ChangelogSection changelog={changelog} pendingLabel="未提交修改" publishedLabel="发布版本" />
    </div>
  )
}
