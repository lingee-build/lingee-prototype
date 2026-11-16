import type { KeyboardEventHandler, ReactNode } from "react"
import { DockShell, DockTray } from "../dock-surface/DockSurface"

/** 提问 / 权限申请共用的 dock 外壳：上面是内容卡片，下面是按钮托盘 */
export function DockPrompt(props: {
  kind: "question" | "permission"
  header?: ReactNode
  children: ReactNode
  footer: ReactNode
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>
}) {
  const slot = (name: string) => `${props.kind}-${name}`
  return (
    <div data-component="dock-prompt" data-kind={props.kind} onKeyDown={props.onKeyDown}>
      <DockShell data-slot={slot("body")}>
        <div data-slot={slot("header")}>{props.header}</div>
        <div data-slot={slot("content")}>{props.children}</div>
      </DockShell>
      <DockTray data-slot={slot("footer")}>{props.footer}</DockTray>
    </div>
  )
}
