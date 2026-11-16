import { useMemo, useState } from "react"
import { useT } from "@/i18n"
import { Empty, Icon, Search } from "@/ui"
import type { ManifestToolEntry } from "@/mock/fixtures/skill-detail"
import { groupSkillTools, skillToolCards, toolBadgeText, type SkillToolCard } from "./tool-groups"

/** 搜索框出现阈值：沿用 MCP 工具列表「超过 5 条才显示搜索框」的现状（PRD AC-1 / AC-11） */
const SEARCH_THRESHOLD = 6

const matchesKeyword = (tool: SkillToolCard, query: string) =>
  [tool.name, tool.code, tool.desc].some((value) => value.toLowerCase().includes(query))

/** 关联工具页签（US-2026-101087）：只过滤已加载的条目，不重新请求 */
export function RelatedToolsTab(props: { tools: readonly ManifestToolEntry[]; projectName?: string }) {
  const t = useT()
  const [keyword, setKeyword] = useState("")
  const query = keyword.trim().toLowerCase()

  const cards = useMemo(() => skillToolCards(props.tools), [props.tools])
  const groups = useMemo(() => groupSkillTools(cards), [cards])
  const visible = useMemo(
    () =>
      groups
        .map((group) => ({ ...group, tools: query ? group.tools.filter((tool) => matchesKeyword(tool, query)) : group.tools }))
        .filter((group) => group.tools.length > 0),
    [groups, query],
  )

  return (
    <div className="flex flex-col gap-3 px-6 pb-5">
      {cards.length >= SEARCH_THRESHOLD && (
        <Search
          value={keyword}
          onChange={setKeyword}
          placeholder={t("proto.skillTools.search")}
          style={{ width: "100%" }}
          wrapperStyle={{ width: "100%" }}
        />
      )}
      {visible.length === 0 ? (
        <Empty description={t("proto.skillTools.empty")} />
      ) : (
        <div className="flex flex-col gap-2">
          {visible.map((group) => (
            <div key={group.key ?? "legacy"} className="mb-1 flex flex-col gap-2">
              {group.key && (
                <div className="flex items-center gap-1 px-0.5 text-[13px] font-medium leading-[20px] text-[var(--neutral-700)]">
                  {t(`kcode.skillPreview.toolGroup.${group.key}`)}
                  {group.key === "personal" && (
                    <span className="text-[12px] text-[var(--danger-600)]">{t("kcode.skillPreview.toolGroup.personalNote")}</span>
                  )}
                </div>
              )}
              {group.tools.map((tool) => (
                <ToolCard key={`${tool.code}-${tool.name}`} tool={tool} projectName={props.projectName} />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ToolCard(props: { tool: SkillToolCard; projectName?: string }) {
  const t = useT()
  const { tool, projectName } = props
  // 第二行：有来源记录时按分组去重拼接；无来源记录的旧技能不显示第二行（与分组标题缺省一致）
  const badge = toolBadgeText(tool, t, projectName)
  return (
    <div className="flex flex-col gap-0.5 rounded-[10px] border border-[rgba(0,0,0,0.06)] bg-[#fff] px-2.5 py-[7px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex size-[22px] shrink-0 items-center justify-center rounded-[6px]" style={{ background: "linear-gradient(135deg, #EBFADC 0%, #D4FCE9 100%)" }}>
          <Icon name="app-grid" size="small" className="size-2.5 text-[#34A853]" />
        </div>
        <span className="shrink-0 text-[12px] font-semibold text-text-strong">{tool.name}</span>
        {tool.code && <span className="font-mono text-[9px] break-all text-[var(--neutral-400)]">{tool.code}</span>}
      </div>
      {badge && (
        <div className="flex flex-wrap items-center gap-1.5 pl-[30px]">
          <span className="shrink-0 text-[9px] text-[var(--neutral-500)]">{badge}</span>
        </div>
      )}
      <div className="pl-[30px] text-[11px] leading-[1.5] text-[var(--neutral-600)]">{tool.desc}</div>
    </div>
  )
}