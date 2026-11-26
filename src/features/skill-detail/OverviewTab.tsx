import { useT } from "@/i18n"
import type { Agent, Skill } from "@/mock/fixtures/dev"
import type { SkillDetail } from "@/mock/fixtures/skill-detail"
import { SkillScopeInfo } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import { ChangelogSection } from "@/features/agent-config/ChangelogSection"
import "@/features/agent-config/agent-config.css"

/** 技能概述与智能体详情共用区块卡片和版本时间线。 */
export function OverviewTab(props: { skill: Skill; detail: SkillDetail }) {
  const t = useT()
  const { skill, detail } = props
  const changelog: Agent["changelog"] = {
    pending: detail.changelog.pending,
    versions: detail.changelog.versions.map(entry => ({
      version: entry.version.replace(/^v/i, ""),
      releasedAt: entry.releasedAt,
      operator: entry.operator,
      lines: entry.summary,
      channel: entry.channel,
      status: entry.status,
      withdrawnAt: entry.withdrawnAt,
    })),
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
      {detail.location && (
        <section className="flex flex-col gap-3">
          <h3 className="agent-config-section-title">{t("kcode.skillPreview.section.directory")}</h3>
          <div className="agent-config-surface text-[14px] leading-[22px] text-text-base">
            <button
              type="button"
              className="font-mono text-[13px] text-primary-base break-all hover:underline cursor-pointer inline-flex items-center gap-1"
              title="点击打开文件夹"
              onClick={() => window.alert(`打开文件夹：${detail.location}`)}
            >
              {detail.location}
            </button>
          </div>
        </section>
      )}
      <ChangelogSection changelog={changelog} pendingLabel="本地修改" />
    </div>
  )
}
