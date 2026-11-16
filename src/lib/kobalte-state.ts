import { useCallback, useRef } from "react"

/**
 * 样式表沿用 Kobalte 的状态属性（data-expanded / data-closed），而 Radix 输出的是 data-state。
 * 这里把 data-state 镜像成 Kobalte 的写法，让同步过来的 CSS 不用改一个字。
 */
export function useKobalteState<T extends HTMLElement>() {
  const observer = useRef<MutationObserver | null>(null)
  return useCallback((el: T | null) => {
    observer.current?.disconnect()
    if (!el) return
    const sync = () => {
      const state = el.getAttribute("data-state")
      const open = state === "open" || state === "delayed-open" || state === "instant-open" || state === "checked"
      el.toggleAttribute("data-expanded", open)
      el.toggleAttribute("data-closed", state === "closed")
    }
    sync()
    observer.current = new MutationObserver(sync)
    observer.current.observe(el, { attributes: true, attributeFilter: ["data-state"] })
  }, [])
}

export type Placement =
  | "top" | "top-start" | "top-end"
  | "bottom" | "bottom-start" | "bottom-end"
  | "left" | "left-start" | "left-end"
  | "right" | "right-start" | "right-end"

/** Kobalte 的 placement 拆成 Radix 的 side + align */
export function splitPlacement(placement: Placement = "bottom-start") {
  const [side, align = "center"] = placement.split("-") as [
    "top" | "bottom" | "left" | "right",
    ("start" | "end" | "center")?,
  ]
  return { side, align }
}
