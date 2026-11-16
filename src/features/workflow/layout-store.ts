import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { PointerEvent as ReactPointerEvent } from "react"

/**
 * 工作流页面三栏的宽度比例：会话 / 画布 / 右栏，默认 1:1:1，可以拖动分隔线调整（记在本地）。
 * chat = 会话占整行的比例；side = 右栏占画布区域的比例。
 */
interface LayoutState {
  chat: number
  side: number
  /** 拖动中：会话区关掉宽度过渡，跟手 */
  dragging: boolean
  set: (patch: Partial<Pick<LayoutState, "chat" | "side" | "dragging">>) => void
}

export const useWorkflowLayout = create<LayoutState>()(
  persist(
    (set) => ({
      chat: 1 / 3,
      side: 1 / 2,
      dragging: false,
      set: (patch) => set(patch),
    }),
    { name: "lingee-prototype.workflow-layout", partialize: (s) => ({ chat: s.chat, side: s.side }) },
  ),
)

/**
 * 按住分隔线拖动：container 是计算比例的参照区域，toRatio 把指针位置换成比例并做最小宽度限制。
 * 双击恢复默认。
 */
export function startResize(e: ReactPointerEvent, container: HTMLElement | null | undefined, toRatio: (x: number, rect: DOMRect) => number, apply: (ratio: number) => void) {
  if (!container || e.button !== 0) return
  e.preventDefault()
  const rect = container.getBoundingClientRect()
  useWorkflowLayout.getState().set({ dragging: true })
  const prev = document.body.style.cursor
  document.body.style.cursor = "col-resize"
  document.body.style.userSelect = "none"
  const move = (ev: PointerEvent) => apply(toRatio(ev.clientX, rect))
  const up = () => {
    window.removeEventListener("pointermove", move)
    window.removeEventListener("pointerup", up)
    document.body.style.cursor = prev
    document.body.style.userSelect = ""
    useWorkflowLayout.getState().set({ dragging: false })
  }
  window.addEventListener("pointermove", move)
  window.addEventListener("pointerup", up)
}

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
