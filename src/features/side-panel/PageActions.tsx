import { Icon, Tooltip, type IconName } from "@/ui"
import { useT } from "@/i18n"
import { usePanel, type PreviewView } from "@/stores/panel"

const ICON_BUTTON =
  "session-preview-header-icon p-0 border-none bg-transparent cursor-pointer inline-flex items-center justify-center outline-none text-[var(--icon-fill)] hover:bg-[var(--icon-background-hover)] active:[--icon-fill:var(--icon-fill-active)] active:bg-[var(--icon-background-hover)] transition-colors"

function ActionButton(props: { icon: IconName; label: string; view: Exclude<PreviewView, "drawer"> }) {
  const current = usePanel((s) => s.view)
  const toggleView = usePanel((s) => s.toggleView)
  const selected = current === props.view
  return (
    <Tooltip placement="bottom" value={props.label}>
      <button
        type="button"
        className={ICON_BUTTON}
        data-selected={selected ? "" : undefined}
        onClick={() => toggleView(props.view)}
        aria-label={props.label}
        aria-expanded={selected}
      >
        <Icon size="small" name={props.icon} />
      </button>
    </Tooltip>
  )
}

/** 会话页右上角的图标栏：切换右侧预览面板显示「审查」还是「文件树」（两者互斥，再点一次收起） */
export function PageActions(props: { inSession: boolean }) {
  const t = useT()
  return (
    <div className="pointer-events-none absolute right-6 top-3 z-40 flex">
      <div className="pointer-events-auto flex items-center gap-1.5">
        {/* 审查是会话级的，新任务页还没有可审查的内容 */}
        {props.inSession && <ActionButton icon="session-review" label={t("command.review.toggle")} view="review" />}
        <ActionButton icon="session-files" label={t("command.fileTree.toggle")} view="fileTree" />
        <ActionButton icon="wiki" label={t("command.wiki.toggle")} view="wiki" />
      </div>
    </div>
  )
}
