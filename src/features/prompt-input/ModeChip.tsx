import { Icon } from "@/ui"
import { useT } from "@/i18n"
import { usePrompt } from "@/stores/prompt"

/** 已选模式（Spec / 目标）的胶囊：悬停时前置图标换成关闭按钮 */
export function ModeChip(props: { restoreFocus: () => void }) {
  const t = useT()
  const { mode, setMode } = usePrompt()
  if (mode === "build") return null
  return (
    <span
      className="group inline-flex items-center justify-center rounded-[12px] hover:bg-[var(--neutral-50)] transition-colors"
      style={{ height: 32, maxHeight: 32, padding: "7px 8px", gap: 6 }}
    >
      <span className="flex items-center gap-1">
        <Icon
          name={mode === "spec" ? "spec" : "goal"}
          size="small"
          containerClass="shrink-0 group-hover:hidden"
          className="text-[var(--text-color-secondary-82)]"
        />
        <button
          type="button"
          className="flex items-center justify-center size-[14px] cursor-pointer [--x-color:var(--text-color-secondary-82)] hidden group-hover:flex"
          onClick={() => { setMode("build"); props.restoreFocus() }}
          aria-label={t("common.clear")}
        >
          <Icon name="close-small-fill" containerClass="!size-[14px]" className="shrink-0" style={{ color: "var(--x-color)", transition: "color 0.15s" }} />
        </button>
        <span className="truncate prompt-mode-label text-[var(--text-color-secondary-82)]" style={{ fontSize: 14, fontWeight: 500, lineHeight: "22px" }}>
          {t(`agent.name.${mode}`)}
        </span>
      </span>
    </span>
  )
}
