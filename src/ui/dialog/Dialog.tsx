import type { CSSProperties, ReactNode } from "react"
import { Dialog as Radix } from "radix-ui"
import { cx } from "@/lib/cx"
import { useKobalteState } from "@/lib/kobalte-state"
import { IconButton } from "../button/Button"
import { useDialogStore } from "./dialog-store"

export interface DialogProps {
  title?: ReactNode
  description?: ReactNode
  /** 内容区自带 Radix.Title 和 Radix.Description，保留调用方的布局。 */
  customHeader?: boolean
  action?: ReactNode
  status?: ReactNode
  size?: "normal" | "large" | "x-large"
  className?: string
  rootClass?: string
  style?: CSSProperties
  fit?: boolean
  transition?: boolean
  verticalAlign?: "center" | "top"
  width?: string
  onClose?: () => void
  children?: ReactNode
}

export function Dialog(props: DialogProps) {
  const ref = useKobalteState<HTMLDivElement>()
  const close = useDialogStore((s) => s.close)
  const hasHeader = !!props.title || !!props.action
  return (
    <div
      data-component="dialog"
      className={props.rootClass}
      data-fit={props.fit ? true : undefined}
      data-size={props.size || "normal"}
      data-transition={props.transition ? true : undefined}
      data-vertical-align={props.verticalAlign ?? "center"}
    >
      <div data-slot="dialog-container" style={{ "--dialog-width": props.width } as CSSProperties}>
        <Radix.Content
          ref={ref}
          {...(!props.description && !props.customHeader ? { "aria-describedby": undefined } : {})}
          data-slot="dialog-content"
          data-no-header={hasHeader ? undefined : ""}
          className={cx("relative", props.className)}
          style={props.style}
          onOpenAutoFocus={(e) => {
            const target = e.currentTarget as HTMLElement
            const autofocus = target.querySelector<HTMLElement>("[autofocus], [data-autofocus]")
            e.preventDefault()
            if (autofocus) return autofocus.focus()
            const body = target.querySelector<HTMLElement>("[data-slot='dialog-body']")
            if (!body) return
            if (!body.hasAttribute("tabindex")) body.setAttribute("tabindex", "-1")
            body.focus()
          }}
        >
          {hasHeader ? (
            <div data-slot="dialog-header">
              {props.title && (
                <div data-slot="dialog-title-row">
                  <Radix.Title data-slot="dialog-title">{props.title}</Radix.Title>
                  {props.status && <div data-slot="dialog-status">{props.status}</div>}
                </div>
              )}
              {props.action ?? (
                <IconButton
                  data-slot="dialog-close-button"
                  icon="remove-dialog"
                  variant="ghost"
                  aria-label="Close"
                  onClick={() => (props.onClose ? props.onClose() : close())}
                />
              )}
            </div>
          ) : !props.customHeader ? (
            <Radix.Title className="sr-only">dialog</Radix.Title>
          ) : null}
          {props.description && (
            <Radix.Description data-slot="dialog-description" style={{ marginLeft: -4 }}>
              {props.description}
            </Radix.Description>
          )}
          <div data-slot="dialog-body">{props.children}</div>
        </Radix.Content>
      </div>
    </div>
  )
}

/** 挂在应用根部，渲染当前激活的全局弹窗（对应原工程的 DialogProvider） */
export function DialogHost() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  return (
    <div data-component="dialog-stack">
      {active && (
        <Radix.Root key={active.id} open modal onOpenChange={(open) => !open && close()}>
          <Radix.Portal>
            <Radix.Overlay
              data-component="dialog-overlay"
              onClick={active.closeOnOverlayClick === false ? undefined : close}
            />
            {active.render()}
          </Radix.Portal>
        </Radix.Root>
      )}
    </div>
  )
}
