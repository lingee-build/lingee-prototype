import { IconButton, Tooltip } from "@/ui"
import { Markdown, RenderCard, splitRenderBlocks, type CardClick } from "@/ui"
import { memo, useEffect, useMemo, useState } from "react"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"
import type { Message } from "@/mock/types"
import { ToolStageGroup, TurnProcessGroup, MergedReasoning } from "./ProcessGroup"
import { stageParts, splitFinalParts } from "./process-groups"
import { ExecutionPlan } from "./ExecutionPlan"
import { ToolPart } from "./ToolPart"
import { UserMessage } from "./UserMessage"
import { WorkflowChangeCard } from "@/features/workflow/proposals"

/** 一轮对话 = 一条用户消息 + 其后的助手回复。结构对齐 kcode-ui 的 session-turn */
/** 一段正文：普通文字走 Markdown，其中的 :::render:kind {...}::: 指令渲染成产物卡片 */
const TextPart = memo(function TextPart(props: { text: string; breaks?: boolean; metadata?: string; onCardClick?: CardClick; onEvaluate?: () => void }) {
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])
  const segments = useMemo(() => splitRenderBlocks(props.text), [props.text])
  return (
    <div data-component="text-part">
      <div data-slot="text-part-body">
        {segments.map((segment, index) =>
          segment.type === "render" ? (
            // 原型新增：工作流的画布修改卡片（应用 / 放弃），其余产物卡片走 Build 原有 RenderCard
            segment.kind === "kd-workflow-change" ? (
              <WorkflowChangeCard key={index} config={segment.config} />
            ) : (
            <RenderCard key={index} kind={segment.kind} config={segment.config} onCardClick={props.onCardClick} />
            )
          ) : (
            segment.content.trim() && <Markdown key={index} text={segment.content} breaks={props.breaks} />
          ),
        )}
      </div>
      {props.onEvaluate && <div data-slot="text-part-copy-wrapper">
        <span data-slot="text-part-copy-actions">
          <IconButton variant="ghost" icon={copied ? "check" : "copy"} className="w-7 h-7" aria-label={copied ? "已复制" : "复制回复"}
            onClick={() => void navigator.clipboard.writeText(props.text).then(() => setCopied(true)).catch(() => setCopied(false))} />
          <Tooltip value="去评测 · 关联整个测试会话" placement="top" gutter={4}>
            <IconButton variant="ghost" icon="checklist" className="w-7 h-7" aria-label="去评测" data-action="evaluate-session"
              onMouseDown={event => event.preventDefault()} onClick={props.onEvaluate} />
          </Tooltip>
        </span>
        {props.metadata && <span data-slot="text-part-meta" className="text-12-regular text-text-weak">{props.metadata}</span>}
      </div>}
    </div>
  )
})

export function SessionTurn(props: { user: Message; assistants: Message[]; last?: boolean; preserveLineBreaks?: boolean; working: boolean; onCardClick?: CardClick; onEvaluate?: (messageId: string) => void }) {
  const t = useT()
  const parts = props.assistants.flatMap((message) => message.parts)
  const { process, final } = splitFinalParts(parts, props.assistants.some(message => message.time.completed === undefined))
  const groups = stageParts(process)
  const assistant = props.assistants.at(-1)
  const model = useSync(state => state.models.find(item => item.id === assistant?.model))
  const metadata = assistant && model && ["Build", model.name,
    assistant.time.completed ? `${Math.round((assistant.time.completed - props.user.time.created) / 1000)}s` : undefined,
  ].filter(Boolean).join(" · ")
  return (
    <div data-component="session-turn">
      <div data-slot="session-turn-content">
        <div>
          <div data-message={props.user.id} data-slot="session-turn-message-container">
            <div data-slot="session-turn-message-content" aria-live="off">
              <UserMessage message={props.user} assistant={props.assistants[0]} localTest={props.preserveLineBreaks} />
            </div>
            {parts.length > 0 && (
              <div data-slot="session-turn-assistant-content">
                <div data-component="assistant-parts" data-last-message={props.last && props.onEvaluate ? "true" : undefined}>
                  {process.length > 0 && <TurnProcessGroup messages={props.assistants} working={props.working}>
                    {groups.map((group, index) => <div data-component="assistant-part-group" key={group.key}>
                      {group.type === "stage" ? <ToolStageGroup parts={group.parts} working={props.working} busy={props.working && index === groups.length - 1 && !final.length} hasFollowingText={groups.slice(index + 1).some(g => g.parts.some(p => p.type === 'text')) || final.length > 0}/> : group.type === "reasoning" ? <MergedReasoning parts={group.parts}/> : group.parts[0].type === "text" ? <TextPart text={group.parts[0].text} onCardClick={props.onCardClick}/> : group.parts[0].type === "tool" ? <div className="tool-single-step"><ToolPart part={group.parts[0]} compact working={props.working}/></div> : group.parts[0].type === "execution-plan" ? <ExecutionPlan part={group.parts[0]}/> : null}
                    </div>)}
                  </TurnProcessGroup>}
                  {final.map((part, index) => part.type === "text" && <TextPart key={part.id} text={part.text} breaks={props.preserveLineBreaks}
                    metadata={metadata || undefined} onCardClick={props.onCardClick}
                    onEvaluate={props.onEvaluate && !props.working && index === final.length - 1
                      ? () => props.onEvaluate?.(props.user.id) : undefined} />)}
                </div>
              </div>
            )}
            {props.working && parts.length === 0 && (
              <div data-slot="session-turn-thinking" data-state="running" role="status" aria-live="polite">
                <span data-slot="session-turn-thinking-summary">{t("ui.reasoning.understanding")}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
