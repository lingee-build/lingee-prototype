import type { ReactNode } from "react"
import { Icon } from "@/ui"

/** 分组标题：按项目分组和按日期分组共用，保证悬停样式、箭头显隐、间距一致 */
export function GroupHeader(props: { label: string; expanded: boolean; onToggle: () => void; rightSlot?: ReactNode }) {
  return (
    <div className="group/project flex items-center w-full py-2.5 h-8" data-group-header>
      <button
        type="button"
        className="flex items-center transition-colors cursor-pointer min-w-0 flex-1 gap-1 group-hover/project:text-[var(--neutral-600)] text-[var(--neutral-500)]"
        style={{ display: "inline-flex", alignItems: "center", border: "none", padding: 0, overflow: "hidden", background: "none" }}
        onClick={props.onToggle}
      >
        <span className="truncate text-[12px] font-[400] leading-[18px]" title={props.label}>
          {props.label}
        </span>
        <span className="flex items-center opacity-0 group-hover/project:opacity-100 transition-opacity">
          <Icon name={props.expanded ? "chevron-down-16" : "chevron-right-16"} size="small" />
        </span>
      </button>
      {props.rightSlot}
    </div>
  )
}
