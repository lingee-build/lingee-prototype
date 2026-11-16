import type { ReactNode } from "react"
import { create } from "zustand"

interface DialogEntry {
  id: string
  render: () => ReactNode
  onClose?: () => void
  closeOnOverlayClick?: boolean
}

interface DialogState {
  active?: DialogEntry
  show: (render: () => ReactNode, onClose?: () => void, options?: { closeOnOverlayClick?: boolean }) => void
  close: () => void
}

/** 对应原工程的 useDialog()：命令式地弹出/关闭一个全局弹窗 */
export const useDialogStore = create<DialogState>((set, get) => ({
  show: (render, onClose, options) =>
    set({ active: { id: Math.random().toString(36).slice(2), render, onClose, ...options } }),
  close: () => {
    get().active?.onClose?.()
    set({ active: undefined })
  },
}))

export const useDialog = () => ({
  show: useDialogStore((s) => s.show),
  close: useDialogStore((s) => s.close),
})
