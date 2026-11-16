import { create } from "zustand"
import { toastIcons } from "./toast-icons.gen"

export type ToastVariant = "default" | "success" | "error" | "warning" | "loading"

export interface ToastOptions {
  title?: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastItem extends ToastOptions {
  id: number
  closing?: boolean
}

const useToastStore = create<{ items: ToastItem[] }>(() => ({ items: [] }))
let seq = 0

export function dismissToast(id: number) {
  useToastStore.setState((s) => ({ items: s.items.map((x) => (x.id === id ? { ...x, closing: true } : x)) }))
  setTimeout(() => useToastStore.setState((s) => ({ items: s.items.filter((x) => x.id !== id) })), 200)
}

export function showToast(options: ToastOptions | string) {
  const opts = typeof options === "string" ? { description: options } : options
  const id = ++seq
  useToastStore.setState((s) => ({ items: [...s.items, { ...opts, id }] }))
  setTimeout(() => dismissToast(id), opts.duration ?? 3000)
  return id
}

export function ToastRegion() {
  const items = useToastStore((s) => s.items)
  return (
    <div data-component="toast-region" role="region">
      <ol data-slot="toast-list">
        {items.map((item) => (
          <li
            key={item.id}
            data-component="toast"
            data-variant={item.variant ?? "default"}
            data-opened={item.closing ? undefined : ""}
            data-closed={item.closing ? "" : undefined}
          >
            <div
              data-slot="toast-icon"
              dangerouslySetInnerHTML={{
                __html: toastIcons[item.variant === "loading" || !item.variant ? "default" : item.variant],
              }}
            />
            <div data-slot="toast-content">
              {item.title && (
                <div data-slot="toast-title" title={item.title}>
                  {item.title}
                </div>
              )}
              {item.description && (
                <div data-slot="toast-description" title={item.description}>
                  {item.description}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
