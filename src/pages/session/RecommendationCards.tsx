import { useMemo, useState } from "react"
import { Icon } from "@/ui"
import { useLocaleStore, useT } from "@/i18n"
import syncedCards from "@/mock/fixtures/recommendation-cards.gen"
import { RECOMMENDATION_ICON_HTML as SYNCED_ICON_HTML } from "@/mock/fixtures/recommendation-icons.gen"
import { WORKFLOW_CASES } from "@/mock/fixtures/workflow-cases"
import { icons, iconViewBox } from "@/ui/icon/icons.gen"
import { SKILL_TABS } from "@/features/prompt-input/skill-entries"

/** 原型新增的「工作流开发」场景模板：与线上同步来的模板同一结构，追加在后面 */
const WORKFLOW_TYPE_KEY = "proto.nav.workflowDev"
const cards = [
  ...syncedCards,
  ...WORKFLOW_CASES.map((item) => ({
    title: { ...item.title, zht: item.title.zh },
    prompt: { ...item.prompt, zht: item.prompt.zh },
    typeKey: WORKFLOW_TYPE_KEY,
    devMode: "workflow",
  })),
]
const RECOMMENDATION_ICON_HTML: Record<string, string> = {
  ...SYNCED_ICON_HTML,
  [WORKFLOW_TYPE_KEY]: `<svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="${iconViewBox("git-branch-network")}" fill="none" style="color:#2970FF">${icons["git-branch-network"]}</svg>`,
}

const pick = (pool: number, previous: number[]) => {
  const candidates = Array.from({ length: pool }, (_, i) => i).filter((i) => !previous.includes(i))
  const source = candidates.length >= 3 ? candidates : Array.from({ length: pool }, (_, i) => i)
  return [...source].sort(() => Math.random() - 0.5).slice(0, 3)
}

/** 推荐模板：每次展示 3 张，「换一批」随机换；输入框里有技能胶囊时只推该类型 */
export function RecommendationCards(props: { skill?: string; onApply: (prompt: string) => void }) {
  const t = useT()
  const locale = useLocaleStore((s) => s.locale)
  const [selection, setSelection] = useState<number[]>([])
  const typeKey = SKILL_TABS.find((tab) => tab.name === props.skill)?.labelKey
  const filtered = useMemo(() => (typeKey ? cards.filter((card) => card.typeKey === typeKey) : cards), [typeKey])
  const visible = selection.length > 0 ? selection.flatMap((i) => (filtered[i] ? [filtered[i]] : [])) : filtered.slice(0, 3)
  const shown = visible.length > 0 ? visible : filtered.slice(0, 3)

  return (
    <div className="w-full px-6 md:px-0 md:max-w-[710px] md:mx-auto mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[14px] leading-[22px] font-[400] text-text-strong dark:text-[rgba(255,255,255,0.92)]">
          {t("kcode.session.recommendedTemplates")}
        </span>
        <button
          className="flex items-center gap-1 text-[14px] leading-[22px] font-[400] text-text-weak hover:text-text-strong dark:text-[rgba(255,255,255,0.46)] dark:hover:text-[rgba(255,255,255,0.86)] [--icon-fill:currentColor] transition-colors cursor-pointer bg-transparent border-0 p-0"
          onClick={() => setSelection(pick(filtered.length, selection))}
        >
          {t("kcode.session.refreshBatch")}
          <Icon name="refresh" size="small" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3 items-stretch">
        {shown.map((card) => (
          <div
            key={card.title.zh}
            className="flex flex-col gap-1.5 p-3 rounded-xl bg-[var(--neutral-0,#fff)] hover:shadow-sm transition-all cursor-pointer dark:bg-[var(--neutral-850,#1a1a1a)] h-[90px] overflow-hidden"
            onClick={() => props.onApply(card.prompt[locale])}
          >
            <span className="inline-flex items-center gap-1 px-0 py-0 rounded-[999px] text-[14px] font-[700] leading-[22px] whitespace-nowrap w-fit border-0 bg-transparent text-text-strong dark:text-[rgba(255,255,255,0.94)]">
              <span
                className="flex size-[19px] shrink-0 items-center justify-center dark:opacity-80"
                dangerouslySetInnerHTML={{ __html: RECOMMENDATION_ICON_HTML[card.typeKey] ?? "" }}
              />
              {t(card.typeKey)}
            </span>
            <div className="text-[12px] leading-[18px] font-[400] text-text-base dark:text-[rgba(255,255,255,0.64)] line-clamp-2" title={card.title[locale]}>
              {card.title[locale]}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
