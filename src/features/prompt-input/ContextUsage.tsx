import { Popover } from "radix-ui"
import { useNavigate } from "react-router"
import { Button } from "@/ui"
import { useT } from "@/i18n"

/** Same empty-data state as Build: the prototype has no provider token telemetry. */
export function ContextUsage(props: { projectId: string; restoreFocus: () => void }) {
  const t = useT()
  const navigate = useNavigate()
  return (
    <div data-component="prompt-context-usage-control" className="shrink-0 size-7 flex items-center justify-center rounded-[8px] transition-colors hover:bg-[var(--prompt-input-trigger-bg)] text-[var(--prompt-input-trigger-text)]">
      <Popover.Root>
        <Popover.Trigger className="size-full flex items-center justify-center rounded-[8px] transition-colors cursor-pointer data-[state=open]:bg-[var(--neutral-50)]" aria-label={t("context.usage.view")}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" data-component="progress-circle" aria-hidden="true">
            <circle cx="8" cy="8" r="7" strokeWidth="2" data-slot="progress-circle-background" />
            <circle cx="8" cy="8" r="7" strokeWidth="2" strokeDasharray={2 * Math.PI * 7} strokeDashoffset={2 * Math.PI * 7} data-slot="progress-circle-progress" />
          </svg>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" align="end" sideOffset={4} collisionPadding={8} data-component="popover-content" className="!min-w-0 !max-w-70 p-4 z-[200]" style={{ borderRadius: 24, border: "none", background: "var(--neutral-0, var(--surface-raised-stronger-non-alpha, #fff))", boxShadow: "0 4px 12px 0 var(--session-context-shadow-color, rgba(0,0,0,0.08))" }} onCloseAutoFocus={(event) => { event.preventDefault(); props.restoreFocus() }}>
            <div className="flex flex-col gap-3">
              <div className="w-[224px] text-[14px] leading-[22px] text-[var(--text-strong)]">{t("context.usage.empty")}</div>
              <div className="grid grid-cols-2 gap-2 border-t pt-3 border-[var(--border-weak-base)]">
                <Button size="small" variant="secondary" className="min-w-0" disabled title={t("context.usage.compactCurrentSession")}><span className="truncate">{t("context.usage.compactCurrentSession")}</span></Button>
                <Button size="small" variant="secondary" className="min-w-0" onClick={() => navigate(`/p/${props.projectId}/session`)}><span className="truncate">{t("command.session.new")}</span></Button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
