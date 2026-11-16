import { useEffect, useRef } from "react"
import { Icon, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { SlashCommand } from "@/mock/fixtures/prompt"

export type PopoverItem = { type: "file"; key: string; path: string } | { type: "slash"; key: string; command: SlashCommand }

const ROW = "w-full flex items-center rounded-full h-8 px-2"
const GROUP_HEADER = "sticky -top-1 z-10 flex items-center gap-1.5 px-2 py-1 bg-surface-raised-stronger-non-alpha"

function SlashRow(props: { command: SlashCommand; active: boolean; onSelect: () => void; onHover: () => void }) {
  const t = useT()
  const { command } = props
  const description = command.descriptionKey ? t(command.descriptionKey) : command.description
  return (
    <button
      data-popover-key={command.id}
      className={cx(ROW, "justify-between gap-4", props.active && "bg-surface-raised-base-hover")}
      onClick={props.onSelect}
      onMouseEnter={props.onHover}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-14-regular text-text-strong whitespace-nowrap">{command.title}</span>
        {description && (
          <span className="text-14-regular text-text-weak truncate" title={description}>
            {description}
          </span>
        )}
      </div>
      {command.scope && (
        <div className="flex items-center gap-2 shrink-0">
          <span className={cx("kcode-slash-badge", `kcode-slash-badge--${command.scope}`)}>{t(`prompt.slash.badge.${command.scope}`)}</span>
        </div>
      )}
    </button>
  )
}

/**
 * 输入框上方的补全弹层："/" 列出技能与指令（分组），"@" 列出可引用的文件。
 * 键盘导航由 PromptInput 统一处理，这里只负责渲染和把选中项滚进可视区。
 */
export function PromptPopover(props: {
  type: "slash" | "at"
  items: PopoverItem[]
  activeKey?: string
  newSession: boolean
  onSelect: (item: PopoverItem) => void
  onActive: (key: string) => void
}) {
  const t = useT()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (props.activeKey) root.current?.querySelector(`[data-popover-key="${CSS.escape(props.activeKey)}"]`)?.scrollIntoView({ block: "nearest" })
  }, [props.activeKey])

  const slashItems = props.items.filter((x) => x.type === "slash")
  const groups = (["skill", "command"] as const)
    .map((kind) => ({ kind, items: slashItems.filter((x) => x.command.kind === kind) }))
    .filter((group) => group.items.length > 0)

  return (
    <div
      ref={root}
      className={cx(
        "absolute left-0 -top-2 -translate-y-full origin-bottom-left min-h-10 z-[200] overflow-auto no-scrollbar flex flex-col rounded-[20px] p-1 bg-surface-raised-stronger-non-alpha shadow-[var(--shadow-lg-border-base)]",
        props.newSession ? "max-h-64 w-[420px] max-w-full" : "inset-x-0 max-h-80",
      )}
      // 点击弹层不能让输入框失焦，否则触发词的选区会丢
      onMouseDown={(e) => e.preventDefault()}
    >
      {props.type === "at" && (
        <div className="flex flex-col gap-0.5">
          {props.items.length === 0 && <div className="text-text-weak px-2 py-1">{t("prompt.popover.emptyResults")}</div>}
          {props.items.map((item) => {
            if (item.type !== "file") return null
            const slash = item.path.lastIndexOf("/")
            return (
              <button
                key={item.key}
                data-popover-key={item.key}
                className={cx(ROW, "gap-x-2", props.activeKey === item.key && "bg-surface-raised-base-hover")}
                onClick={() => props.onSelect(item)}
                onMouseEnter={() => props.onActive(item.key)}
              >
                <Icon name="session-files" size="small" className="shrink-0 size-4 text-icon-weak" />
                <div className="flex items-center text-14-regular min-w-0" title={item.path}>
                  <span className="text-text-weak whitespace-nowrap truncate min-w-0">{item.path.slice(0, slash + 1)}</span>
                  <span className="text-text-strong whitespace-nowrap">{item.path.slice(slash + 1)}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}

      {props.type === "slash" && groups.length === 0 && (
        <div className="flex items-center text-text-weak px-2 min-h-10">{t("prompt.popover.emptyCommands")}</div>
      )}
      {props.type === "slash" &&
        groups.map((group) => (
          <div className="flex flex-col gap-0.5" key={group.kind}>
            <div className={GROUP_HEADER}>
              <span className="text-12-medium text-text-weak">{t(group.kind === "skill" ? "prompt.slash.group.skills" : "prompt.slash.group.commands")}</span>
              {group.kind === "skill" && (
                <Tooltip placement="top" contentClass="max-w-[280px] text-13-regular" value={t("prompt.slash.skills.tooltip")}>
                  <Icon name="info" size="small" className="text-icon-weak cursor-help" />
                </Tooltip>
              )}
            </div>
            {group.items.map((item) => (
              <SlashRow
                key={item.key}
                command={item.command}
                active={props.activeKey === item.key}
                onSelect={() => props.onSelect(item)}
                onHover={() => props.onActive(item.key)}
              />
            ))}
          </div>
        ))}
    </div>
  )
}
