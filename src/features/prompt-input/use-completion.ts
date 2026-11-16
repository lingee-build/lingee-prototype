import { useMemo, useState, type KeyboardEvent } from "react"
import { projectFiles, slashCommands } from "@/mock/fixtures/prompt"
import type { Trigger } from "./Editor"
import type { PopoverItem } from "./PromptPopover"

/** 补全弹层的状态：按触发词过滤候选、维护高亮项、处理方向键 / 回车 / Tab / Esc */
export function useCompletion(projectId: string, onSelect: (item: PopoverItem) => void) {
  const [trigger, setTriggerState] = useState<Trigger | null>(null)
  const [activeKey, setActiveKey] = useState<string>()

  const items = useMemo<PopoverItem[]>(() => {
    if (!trigger) return []
    const query = trigger.query.toLowerCase()
    if (trigger.type === "at")
      return (projectFiles[projectId] ?? [])
        .filter((path) => path.toLowerCase().includes(query))
        .slice(0, 10)
        .map((path) => ({ type: "file", key: path, path }))
    return slashCommands
      .filter((command) => `${command.title} ${command.id} ${command.description ?? ""}`.toLowerCase().includes(query))
      .map((command) => ({ type: "slash", key: command.id, command }))
  }, [trigger, projectId])

  const active = items.find((x) => x.key === activeKey) ?? items[0]

  return {
    trigger,
    items,
    activeKey: active?.key,
    setActiveKey,
    setTrigger(next: Trigger | null) {
      setTriggerState(next)
      if (!next) setActiveKey(undefined)
    },
    /** 返回 true 表示按键已被弹层消费，输入框不要再处理 */
    intercept(event: KeyboardEvent) {
      if (!trigger) return false
      if (event.key === "Escape") {
        event.preventDefault()
        setTriggerState(null)
        return true
      }
      if (items.length === 0) return false
      const index = items.findIndex((x) => x.key === active?.key)
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault()
        const step = event.key === "ArrowDown" ? 1 : -1
        setActiveKey(items[(index + step + items.length) % items.length].key)
        return true
      }
      if ((event.key === "Enter" && !event.shiftKey) || event.key === "Tab") {
        event.preventDefault()
        if (active) onSelect(active)
        return true
      }
      return false
    },
  }
}
