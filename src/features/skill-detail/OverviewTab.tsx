import type { ReactNode } from "react"
import { Icon, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import type { SkillDetail } from "@/mock/fixtures/skill-detail"
import { ScopeInfoItems } from "@/features/skill-publish-scope/SkillPublishScopeDialog"

function Section(props: { title: string; first?: boolean; children: ReactNode }) {
  return (
    <div className={props.first ? undefined : "mt-5"}>
      <div className="text-[16px] font-medium leading-[24px] text-text-strong mb-3">{props.title}</div>
      {props.children}
    </div>
  )
}

/** 详情里的「概述」页签：技能说明 / 关联工具 / 更多信息 / 核心特性 / 更新日志 */
export function OverviewTab(props: { skill: Skill; detail: SkillDetail }) {
  const t = useT()
  const { skill, detail } = props
  const info: Array<[string, string]> = [
    [t("kcode.skillPreview.info.developer"), detail.developer],
    [t("kcode.skillPreview.info.connector"), detail.connector],
  ]
  return (
    <div className="px-6 pb-4">
      <Section title={t("kcode.skillPreview.section.description")} first>
        <div className="bg-surface-skill-info rounded-[16px] px-5 py-4 text-[14px] leading-[28px] text-[var(--neutral-600)]">{skill.desc}</div>
      </Section>

      {detail.tools.length > 0 && (
        <Section title={t("kcode.skillPreview.section.relatedTools")}>
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {detail.tools.map((tool) => (
              <div key={tool.name} className="flex items-center gap-2 rounded-[16px] border border-[var(--border-weak-base)] bg-surface-base px-3 py-3">
                <div className="size-10 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EBFADC 0%, #D4FCE9 100%)" }}>
                  <Icon name="app-grid" size="small" className="size-5 text-[#34A853]" />
                </div>
                <div className="flex-1 min-w-0 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-text-strong truncate" title={tool.name}>
                      {tool.name}
                    </span>
                    <span className="shrink-0 rounded-[21px] border border-[var(--gray-blue-400)] px-2 py-px text-[12px] leading-[18px] text-[var(--gray-blue-700)]">{tool.type}</span>
                  </div>
                  <Tooltip value={tool.desc} placement="top">
                    <div className="text-[12px] leading-[18px] text-[var(--text-tile-desc)] truncate">{tool.desc}</div>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section title={t("kcode.skillPreview.section.basicInfo")}>
        <div className="bg-surface-skill-info rounded-[16px] px-5 py-4">
          <ul className="grid grid-cols-2 gap-x-9 gap-y-2 list-disc list-inside text-[14px] leading-[28px] text-[var(--neutral-600)]">
            {info.map(([label, value]) => (
              <li key={label}>
                {label}
                {t("kcode.skillPreview.info.separator")}
                {value}
              </li>
            ))}
            {/* 发布范围：从 Console 实时取，未发布的技能不显示 */}
            <ScopeInfoItems skill={skill} />
          </ul>
        </div>
      </Section>

      <Section title={t("kcode.skillPreview.section.features")}>
        <div className="bg-surface-skill-info rounded-[16px] px-5 py-4">
          <ul className="list-disc pl-5 flex flex-col gap-2">
            {detail.features.map((item) => (
              <li key={item} className="text-14-regular text-text-base leading-[22px]">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title={t("kcode.skillPreview.section.changelog")}>
        <div className="flex flex-col">
          {detail.changelog.map((entry, index) => {
            const total = detail.changelog.length
            return (
              <div className="flex gap-[8px]" key={entry.version}>
                <div className="relative w-[7px] shrink-0">
                  <div className="size-[7px] rounded-full mt-[8px] relative z-[1] bg-[var(--blue-500)]" />
                  {total > 1 && (
                    <div
                      className={cx(
                        "absolute left-1/2 -translate-x-1/2 w-px bg-[var(--neutral-200)]",
                        index === 0 ? "top-[11px]" : "top-0",
                        index === total - 1 ? "h-[11px]" : "-bottom-3",
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-14-medium text-text-strong uppercase">{entry.version}</span>
                    <span className="text-12-regular text-text-base truncate">{entry.date}</span>
                    {index === 0 && (
                      <span className="text-[12px] font-medium leading-5 text-[var(--blue-500)] px-2 rounded-[8px] bg-surface-skill-latest truncate">
                        {t("kcode.skillPreview.changelog.latest")}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 bg-surface-skill-info rounded-[16px] p-[12px]">
                    {entry.items.map((item) => (
                      <div key={item} className="text-[14px] text-text-base leading-[22px]">
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
