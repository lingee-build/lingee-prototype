import { useEffect, useRef, useState } from "react"
import { Dialog, useDialog } from "@/ui"
import { useT } from "@/i18n"

/** 重命名弹窗：项目和会话共用，只是标题与标签文案不同 */
export function RenameDialog(props: { title: string; label: string; value: string; onSubmit: (value: string) => void }) {
  const t = useT()
  const dialog = useDialog()
  const [value, setValue] = useState(props.value)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => input.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (trimmed && trimmed !== props.value) props.onSubmit(trimmed)
    dialog.close()
  }

  return (
    <Dialog fit className="dialog-rename-reset">
      <div className="flex w-[456px] p-5 flex-col items-start gap-6 rounded-[24px] bg-[var(--rename-bg)]">
        <div className="flex justify-between items-center self-stretch">
          <span className="text-[var(--neutral-800)] text-[20px] leading-[30px] font-[600]">{props.title}</span>
          <button
            type="button"
            onClick={dialog.close}
            className="flex w-7 h-7 -m-1.5 items-center justify-center rounded-lg bg-transparent border-none cursor-pointer p-0 text-[var(--icon-fill)] transition-colors hover:bg-[var(--icon-bg-hover)] active:bg-[var(--icon-bg-active)] active:text-[var(--icon-fill-active)]"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M7 7L17 17M17 7L7 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="flex flex-col gap-2 self-stretch">
          <label className="text-[14px] font-[400] align-left text-[var(--neutral-600)]">{props.label}</label>
          <input
            ref={input}
            type="text"
            value={value}
            onChange={(e) => setValue(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit()
            }}
            className="flex h-10 px-3 py-2.5 justify-between items-center self-stretch rounded-xl border border-[var(--input-border-color)] hover:border-[var(--neutral-300))] bg-[var(--input-bg)] text-[var(--neutral-800))] text-[14px] font-normal leading-[22px] outline-none w-full box-border transition-[border-color] duration-150 ease-in-out focus:border-[var(--primary-600)] rounded-[12px]"
          />
        </div>
        <div className="flex justify-end items-center gap-3 self-stretch">
          <button
            type="button"
            onClick={dialog.close}
            className="flex px-4 py-2 justify-center items-center gap-1 shrink-0 rounded-lg bg-transparent border-none cursor-pointer text-sm font-normal leading-[22px] whitespace-nowrap !text-[var(--button-text-text)] transition-colors hover:bg-[var(--icon-bg-hover)] active:bg-[var(--icon-bg-active)]"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={submit}
            className="flex px-4 py-2 justify-center items-center gap-1 shrink-0 rounded-lg !bg-[var(--button-primary-bg)] hover:!bg-[var(--button-primary-bg-hover)] active:!bg-[var(--button-primary-bg-active)] text-[var(--button-primary-text)] border-none cursor-pointer text-sm font-medium leading-5"
          >
            {t("common.ok")}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
