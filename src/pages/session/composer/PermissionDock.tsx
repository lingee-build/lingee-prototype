import { Button, DockPrompt, Icon } from "@/ui"
import { useT } from "@/i18n"
import type { PermissionReply, PermissionRequest } from "@/mock/types"

/** 权限申请：拒绝 / 始终允许 / 允许一次。带命令的属于危险操作，不提供「始终允许」 */
export function PermissionDock(props: { request: PermissionRequest; onDecide: (reply: PermissionReply) => void }) {
  const t = useT()
  const danger = !!props.request.command
  const title = t(danger ? "notification.permission.dangerTitle" : "notification.permission.title")
  const descriptionKey = `settings.permissions.tool.${props.request.permission}.description`
  const description = t(descriptionKey)

  return (
    <DockPrompt
      kind="permission"
      header={
        <div data-slot="permission-row" data-variant="header">
          <span data-slot="permission-icon">
            <Icon name="warning-triangle" size="normal" />
          </span>
          <div data-slot="permission-header-title" title={title}>
            {title}
          </div>
        </div>
      }
      footer={
        <>
          <div />
          <div data-slot="permission-footer-actions">
            <Button variant="ghost" size="normal" onClick={() => props.onDecide("reject")} title={t("ui.permission.deny")}>
              {t("ui.permission.deny")}
            </Button>
            {!danger && (
              <Button variant="secondary" size="normal" onClick={() => props.onDecide("always")} title={t("ui.permission.allowAlways")}>
                {t("ui.permission.allowAlways")}
              </Button>
            )}
            <Button variant="primary" size="normal" onClick={() => props.onDecide("once")} title={t("ui.permission.allowOnce")}>
              {t("ui.permission.allowOnce")}
            </Button>
          </div>
        </>
      }
    >
      {!danger && description !== descriptionKey && (
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-hint" title={description}>
            {description}
          </div>
        </div>
      )}
      {danger && (
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <code className="text-[12px] leading-[20px] text-[var(--neutral-700)]" title={props.request.command}>
            {props.request.command}
          </code>
        </div>
      )}
      {!danger && props.request.patterns.length > 0 && (
        <div data-slot="permission-row">
          <span data-slot="permission-spacer" aria-hidden="true" />
          <div data-slot="permission-patterns">
            {props.request.patterns.map((pattern) => (
              <code key={pattern} className="text-[12px] leading-[20px] text-[var(--neutral-700)]" title={pattern}>
                {pattern}
              </code>
            ))}
          </div>
        </div>
      )}
    </DockPrompt>
  )
}
