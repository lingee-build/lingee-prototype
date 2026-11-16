import type { ReactNode } from "react"
import { useT } from "@/i18n"
import { Icon } from "../icon/Icon"

/** 空状态。不传 description 时用通用文案 */
export function Empty(props: { icon?: ReactNode; description?: string; className?: string }) {
  const t = useT()
  return (
    <div data-component="empty" className={props.className}>
      <div data-slot="empty-icon">{props.icon ?? <Icon name="empty-box" />}</div>
      <span data-slot="empty-description">{props.description ?? t("ui.empty.description")}</span>
    </div>
  )
}
