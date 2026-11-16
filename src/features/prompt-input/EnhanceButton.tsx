import { Button, Icon, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import { SmartIdentifierIcon } from "@/source-runtime/SmartIdentifierIcon"
import { LeftRollbackIcon } from "@/source-runtime/LeftRollbackIcon"
import { cx } from "@/lib/cx"

/** React adapter of Build's enhance-button.tsx; orchestration belongs to the composer. */
export function EnhanceButton(props: { state: "disabled" | "idle" | "loading" | "applied"; onClick: () => void }) {
  const t = useT()
  const label = t(props.state === "applied" ? "prompt.enhance.undo" : "prompt.enhance.tooltip")
  return (
    <Tooltip placement="top" value={label}>
      <Button
        data-action="prompt-enhance"
        variant="ghost"
        className={cx("relative overflow-hidden size-9 p-0 rounded-[50%] shrink-0 flex items-center justify-center hover:bg-[var(--neutral-50)] border-none bg-transparent", `enhance-btn--${props.state}`, props.state === "disabled" && "opacity-40 cursor-not-allowed")}
        disabled={props.state === "disabled"}
        onClick={props.onClick}
        aria-label={label}
      >
        {props.state === "loading" ? <Icon name="refresh" containerClass="enhance-spinner" size="small" /> : props.state === "applied" ? <LeftRollbackIcon className="size-5" /> : <SmartIdentifierIcon className="size-5" />}
      </Button>
    </Tooltip>
  )
}
