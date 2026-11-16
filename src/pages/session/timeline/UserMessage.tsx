import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Icon, IconButton, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"
import type { Message } from "@/mock/types"
import { getSkillDisplayName, parseSlash } from "@/features/prompt-input/skill-entries"

const timeOf = (ms: number) => {
  const d = new Date(ms)
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

/** 用户消息气泡：前导的 "/技能名" 渲染成技能标签，下方是时间与复制按钮 */
export function UserMessage(props: { message: Message; assistant?: Message }) {
  const t = useT()
  const models = useSync((s) => s.models)
  const model = models.find((m) => m.id === props.assistant?.model || m.modelLevel === props.assistant?.model)
  const modelLabel = model ? (model.modelLevel ? t(`model.displayName.${model.modelLevel}`) : model.name) : props.assistant?.model
  const raw = props.message.parts.flatMap((part) => (part.type === "text" ? [part.text] : [])).join("\n")
  const { skill, body } = parseSlash(raw)
  const inner = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false),2000); return () => clearTimeout(timer) }, [copied])
  const [expanded, setExpanded] = useState(false)
  const [overflow, setOverflow] = useState(false)

  // 长消息默认折叠，超出时才出现展开按钮
  useLayoutEffect(() => {
    const el = inner.current
    if (!el) return
    const update = () => { if (!expanded) setOverflow(el.scrollHeight > el.clientHeight + 1) }
    const observer = new ResizeObserver(update)
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    update()
    return () => observer.disconnect()
  }, [raw, expanded])
  return (
    <div data-component="user-message">
      <div data-slot="user-message-body">
        <div
          data-slot="user-message-text"
          data-expanded={expanded ? "true" : undefined}
          data-has-expand={overflow || expanded ? "true" : undefined}
        >
          <div data-slot="user-message-text-inner" ref={inner}>
            {skill ? (
              <div data-slot="user-message-inline">
                <span data-slot="user-message-skill" className="text-[var(--primary-600)] font-[500] mr-2">
                  {getSkillDisplayName(skill)}
                </span>
                {body}
              </div>
            ) : (
              raw
            )}
          </div>
          {(overflow || expanded) && (
            <button
              type="button"
              data-slot="user-message-expand"
              onClick={() => setExpanded(!expanded)}
              aria-label={t(expanded ? "ui.message.collapse" : "ui.message.expand")}
            >
              <Icon name={expanded ? "collapse-message" : "expand-message"} size="small" />
            </button>
          )}
        </div>
      </div>
      <div data-slot="user-message-copy-wrapper">
        <span data-slot="user-message-meta-wrap">
          {props.assistant && <span data-slot="user-message-meta" className="text-12-regular text-text-weak cursor-default">Build{modelLabel ? ` · ${modelLabel}` : ''}</span>}
          {props.assistant && <span data-slot="user-message-meta-sep" className="text-12-regular text-text-weak cursor-default">{'\u00A0·\u00A0'}</span>}
          <span data-slot="user-message-meta-tail" className="text-12-regular text-text-weak cursor-default">{timeOf(props.message.time.created)}</span>
        </span>
        <Tooltip value={t(copied ? "ui.message.copied" : "ui.message.copyMessage")} placement="top" gutter={4}>
          <IconButton
            icon={copied ? "check" : "copy"}
            size="normal"
            variant="ghost"
            className="w-7 h-7"
            onClick={() => {
              void navigator.clipboard?.writeText(raw)
              setCopied(true)
            }}
            aria-label={t("ui.message.copyMessage")}
          />
        </Tooltip>
      </div>
    </div>
  )
}
