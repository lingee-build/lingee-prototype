import { Icon, type IconName } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"

const ACTION_BTN =
  "batch-bb-btn flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-[12px] border bg-transparent px-3 text-[14px] transition-colors"

/** 技能页批量操作条：三态全选框 + 已选计数 + 四个动作；0 选中时动作禁用 */
export function BatchActionBar(props: {
  selectedCount: number
  totalCount: number
  onToggleAll: () => void
  onCheck: () => void
  onSubmitEnterprise: () => void
  onSubmitPersonal: () => void
  onDelete: () => void
}) {
  const t = useT()
  const disabled = props.selectedCount === 0
  const state = props.totalCount > 0 && props.selectedCount === props.totalCount ? "all" : props.selectedCount > 0 ? "mid" : "none"
  const action = (label: string, icon: IconName, onClick: () => void, danger = false) => (
    <button
      type="button"
      className={cx(
        ACTION_BTN,
        danger && "batch-bb-btn-del",
        disabled
          ? "cursor-default border-[var(--border-weak-base)] text-text-weak"
          : danger
            ? "cursor-pointer border-[#F12234] text-[#F12234] hover:bg-[rgba(241,34,52,0.06)]"
            : "cursor-pointer border-[var(--border-weak-base)] text-text-strong hover:bg-[var(--surface-base)]",
      )}
      disabled={disabled}
      onClick={onClick}
    >
      <Icon name={icon} size="small" className="size-4" />
      {label}
    </button>
  )

  return (
    <div className="flex h-12 shrink-0 items-center gap-3 rounded-[17px] border border-[var(--neutral-130)] bg-[var(--surface-raised-stronger-non-alpha)] px-4 shadow-[0_3px_6px_rgba(0,0,0,0.03)]">
      <button
        type="button"
        className={cx(
          "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[3.5px] border-[1.33px] transition-colors disabled:cursor-default",
          state === "none" ? "border-[var(--border-weak-base)] bg-[var(--surface-raised-stronger-non-alpha)]" : "border-[#495DFF] bg-[#495DFF]",
        )}
        onClick={props.onToggleAll}
        disabled={props.totalCount === 0}
        aria-label={state === "all" ? "deselect-all" : "select-all"}
      >
        {state === "all" && <span className="block h-[4.5px] w-2 -translate-y-[0.5px] -rotate-45 border-b-[1.8px] border-l-[1.8px] border-[#fff]" />}
        {state === "mid" && <span className="block h-[1.5px] w-2 rounded-[2px] bg-[var(--surface-raised-stronger-non-alpha)]" />}
      </button>
      <span className="text-[14px] leading-[22px] text-[var(--neutral-500)] whitespace-nowrap">
        {t("kcode.skillDev.batch.selected", { count: props.selectedCount })}
      </span>
      <div className="ml-auto flex shrink-0 items-center gap-3">
        {action(t("kcode.skillDev.batch.check"), "grid-16", props.onCheck)}
        {action(t("kcode.skillDev.batch.enterprise"), "submit-upload", props.onSubmitEnterprise)}
        {action(t("kcode.skillDev.batch.personal"), "submit-upload", props.onSubmitPersonal)}
        {action(t("kcode.skillDev.batch.delete"), "delete", props.onDelete, true)}
      </div>
    </div>
  )
}
