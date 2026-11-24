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
            ) :             segment.kind === "kdapp-local-test" ? (
              <McpAppLocalTestRenderer key={index} config={segment.config} />
            ) : segment.kind === "kdapp-artifact" && segment.config.autoOpenDrawer === "true" ? (
              <AutoDrawerRenderCard key={index} kind={segment.kind} config={segment.config} onCardClick={props.onCardClick} />
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
 
/**
 * 从 render card config 解析 appCode 并渲染 McpAppInlineCard。
 *
 * 普通会话中（autoOpenDrawer=true）自动打开右侧抽屉展示组件详情和测试入口：
 * - 未上传沙箱（无 sandboxPreview）：仅触发抽屉，不渲染内联卡片
 * - 已上传沙箱（有 sandboxPreview）：渲染内联卡片 + 自动开抽屉
 * - 同一会话多个组件：最后一个自动打开；用户可手动点卡片切换
 *
 * 错误态由场景通过 config.errorKind 传入（不同路径触发不同错误态）。
 */
function McpAppLocalTestRenderer(props: { config: Record<string, string> }) {
  const appCode = props.config.appCode ?? ""
  const app = devStore.mcpApps.find((x) => x.appCode === appCode)
  const autoOpenDrawer = props.config.autoOpenDrawer === "true"
  const sandboxPreview = props.config.sandboxPreview === "true"

  // 普通会话中渲染组件卡片时自动打开抽屉（仅在 mount 时触发，不干扰用户手动切换）
  useEffect(() => {
    if (!autoOpenDrawer || !app) return
    const panel = usePanel.getState()
    if (panel.view === "drawer" && panel.drawer?.kind === "kdapp-artifact" && panel.drawer.id === app.appCode) return
    usePanel.setState({ view: "drawer", drawer: { kind: "kdapp-artifact", id: app.appCode, title: app.appName } })
  }, [appCode, autoOpenDrawer])

  // 未上传沙箱：仅触发抽屉自动打开，不渲染内联卡片
  if (autoOpenDrawer && !sandboxPreview) return null

  // 组件不存在（技能引用了已删除的组件）：渲染 notFound 错误卡片
  if (!app) {
    if (props.config.errorKind === "notFound") {
      return <McpAppErrorCard kind="notFound" appCode={appCode} />
    }
    return null
  }

  const connectors = app.info ? (app.info as Record<string, unknown>).mcpConnector : undefined
  const hasTools = Array.isArray(connectors) && connectors.length > 0
  const toolNames = Array.isArray(connectors)
    ? connectors
        .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
        .flatMap((conn) =>
          (Array.isArray(conn.relateTools) ? conn.relateTools : [])
            .map((tool) => (tool && typeof tool === "object" ? (tool as Record<string, unknown>).name : undefined))
            .filter((name): name is string => typeof name === "string" && name.length > 0),
        )
    : []

  const errorKind = props.config.errorKind as "notFound" | "remoteOnly" | "notBuilt" | "sandboxUnavailable" | "capacityFull" | "contentUpdated" | undefined

  return <McpAppInlineCard app={app} hasTools={hasTools} toolNames={toolNames} errorKind={errorKind} sandboxPreview={sandboxPreview} />
}

/**
 * kdapp-artifact 卡片包装：普通会话中 autoOpenDrawer=true 时自动打开右侧抽屉。
 * 与 McpAppLocalTestRenderer 的 autoOpenDrawer 逻辑一致，但卡片本身走 vendor RenderCard。
 * - 已上传沙箱（phase=preview）：卡片带「预览」「详情」按钮 + 自动开抽屉
 * - 未上传沙箱：卡片只有箭头 + 自动开抽屉（抽屉里展示组件详情和测试入口）
 * - 同一会话多个组件：最后一个自动打开；用户可手动点卡片切换
 */
function AutoDrawerRenderCard(props: { kind: string; config: Record<string, string>; onCardClick?: CardClick }) {
  const appCode = props.config.appCode ?? ""
  const app = devStore.mcpApps.find((x) => x.appCode === appCode)

  useEffect(() => {
    if (!app) return
    const panel = usePanel.getState()
    if (panel.view === "drawer" && panel.drawer?.kind === "kdapp-artifact" && panel.drawer.id === app.appCode) return
    usePanel.setState({ view: "drawer", drawer: { kind: "kdapp-artifact", id: app.appCode, title: app.appName } })
  }, [appCode])

  return <RenderCard kind={props.kind} config={props.config} onCardClick={props.onCardClick} />
}
import { McpAppInlineCard, McpAppErrorCard } from "@/features/mcp-app-detail/McpAppInlineCard"
import { devStore } from "@/mock/dev-store"
import { usePanel } from "@/stores/panel"
