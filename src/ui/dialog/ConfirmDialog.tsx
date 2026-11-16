import { Dialog as Radix } from "radix-ui"
import { Dialog } from "./Dialog"
import { useDialogStore } from "./dialog-store"

export function WarningCircleIcon(props: { className?: string }) {
  return (
    <svg className={props.className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M10.0002 0.833008C15.0628 0.833008 19.1668 4.93706 19.1668 9.99967C19.1668 15.0623 15.0628 19.1663 10.0002 19.1663C4.93755 19.1663 0.833496 15.0623 0.833496 9.99967C0.833496 4.93706 4.93755 0.833008 10.0002 0.833008ZM10.0978 12.5827C9.54563 12.5827 9.09778 13.0307 9.09766 13.5828C9.09766 14.1351 9.54555 14.583 10.0978 14.583C10.6501 14.583 11.098 14.1351 11.098 13.5828C11.0979 13.0307 10.65 12.5827 10.0978 12.5827ZM10.0002 5.41634C9.54006 5.41634 9.16705 5.78962 9.16683 6.24967V10.5002C9.16705 10.9602 9.54006 11.3335 10.0002 11.3335C10.4604 11.3335 10.8335 10.9596 10.8335 10.4993V6.24886C10.8331 5.789 10.4601 5.41634 10.0002 5.41634Z"
        fill="currentColor"
      />
    </svg>
  )
}

export interface ConfirmDialogProps {
  title: string
  description: string
  cancelText?: string
  confirmText: string
  variant?: "danger" | "primary"
  /** 标题前图标的颜色：默认橙色警示；info 用主题蓝（编辑 / 提交这类非破坏性确认） */
  tone?: "warning" | "info"
  onConfirm: () => void
  onCancel?: () => void
  onClose?: () => void
}

/** 通用确认弹窗：删除 / 编辑 / 撤回等二次确认都走它 */
export function ConfirmDialog(props: ConfirmDialogProps) {
  const globalClose = useDialogStore((s) => s.close)
  const close = props.onClose ?? globalClose
  return (
    <Dialog fit customHeader className="w-[400px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]">
      <div className="flex flex-col px-5 pt-5 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center">
            <WarningCircleIcon className={props.tone === "info" ? "size-5 text-[var(--primary-600)]" : "size-5 text-[#FF6D37]"} />
          </div>
          <Radix.Title asChild><span className="text-16-medium text-text-strong">{props.title}</span></Radix.Title>
        </div>
        <Radix.Description asChild><p
          className="ml-8 mt-2 text-14-regular text-text-base leading-[22px] break-all"
          style={{ whiteSpace: "pre-line", overflowWrap: "break-word" }}
        >
          {props.description}
        </p></Radix.Description>
        <div className="mt-5 flex items-center justify-end gap-3">
          {props.cancelText && (
            <button
              type="button"
              className="h-[34px] cursor-pointer rounded-[8px] border-none bg-transparent px-3 text-14-regular text-text-base transition-colors hover:bg-surface-base-hover"
              onClick={() => {
                close()
                props.onCancel?.()
              }}
            >
              {props.cancelText}
            </button>
          )}
          <button
            type="button"
            className={
              props.variant === "danger"
                ? "h-[34px] cursor-pointer rounded-[8px] border-none bg-[#E53535] px-4 text-14-regular [color:#fff] transition-opacity hover:opacity-90 disabled:opacity-50"
                : "h-[34px] cursor-pointer rounded-[8px] border-none bg-[var(--brand-button-primary-base)] px-4 text-14-regular [color:#fff] transition-opacity hover:opacity-90 disabled:opacity-50"
            }
            onClick={() => {
              props.onConfirm()
              close()
            }}
          >
            {props.confirmText}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/** 局部受控确认，保留底层配置面板及其未保存状态 */
export function ControlledConfirmDialog(props: ConfirmDialogProps & { open: boolean; onClose: () => void }) {
  return (
    <Radix.Root open={props.open} modal onOpenChange={open => { if (!open) props.onClose() }}>
      <Radix.Portal>
        <Radix.Overlay data-component="dialog-overlay" />
        <ConfirmDialog {...props} />
      </Radix.Portal>
    </Radix.Root>
  )
}
