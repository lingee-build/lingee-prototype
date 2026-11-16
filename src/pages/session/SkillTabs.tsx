import { Icon } from "@/ui"
import { useT } from "@/i18n"
import { SKILL_TABS } from "@/features/prompt-input/skill-entries"

/** 新任务页输入框下方的技能入口：点击后在输入框里插入对应的技能胶囊 */
export function SkillTabs(props: { onPick: (name: string) => void }) {
  const t = useT()
  return (
    <div className="relative shrink-0" style={{ paddingTop: 24 }}>
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        {SKILL_TABS.map((tab) => (
          <button
            key={tab.name}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => props.onPick(tab.name)}
            className="inline-flex items-center gap-1 px-3 py-2 h-[36px] rounded-[999px] text-[13px] font-[400] leading-[20px] cursor-pointer transition-colors border whitespace-nowrap text-[var(--neutral-700)] border-[var(--neutral-100,rgba(0,0,0,0.06))] bg-[var(--white-46)] hover:bg-[var(--white-94)] active:bg-[var(--white-94)] hover:text-[var(--black-94)] active:text-[var(--black-94)] hover:[&_[data-slot=icon-svg]]:text-[var(--black-94)] active:[&_[data-slot=icon-svg]]:text-[var(--black-94)]"
          >
            <Icon name={tab.iconName} size="small" className="size-4 shrink-0 text-[var(--neutral-700)]" />
            <span>{t(tab.labelKey)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
