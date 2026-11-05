import { Icon, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"

/** 开发及评测面板共用的会话展开／折叠入口。 */
export function SessionToggleButton({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const t = useT()
  const label = t(collapsed ? "command.session.expand" : "command.session.collapse")
  return <Tooltip placement="bottom" value={label} openDelay={300}>
    <button type="button"
      className={cx("session-preview-header-icon p-0 border-none cursor-pointer inline-flex items-center justify-center outline-none transition-colors active:[--icon-fill:var(--icon-fill-active)]", collapsed ? "bg-[var(--icon-bg-active)] rounded-[6px]" : "bg-transparent")}
      onClick={onToggle} aria-label={label} aria-expanded={!collapsed}>
      <Icon size="small" name="drawer" className={cx(collapsed && "text-[var(--icon-fill-active)]")} />
    </button>
  </Tooltip>
}
