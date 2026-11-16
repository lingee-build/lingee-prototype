import { TextShimmer } from "@/ui/text-shimmer/TextShimmer"
import { ProcessStatus } from "./ProcessStatus"
import { useEffect, useState } from "react"
import { Icon, IconButton, Markdown, Tooltip, type IconName } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { useT } from "@/i18n"
import type { ToolPart as ToolPartData } from "@/mock/types"
import { getSkillDisplayName } from "@/features/prompt-input/skill-entries"

const TOOL_META: Record<ToolPartData["tool"], { icon: IconName; labelKey: string; lang?: string }> = {
  mcp: { icon: "plugin-24", labelKey: "proto.process.toolCall" },
  read: { icon: "book-open-24", labelKey: "ui.tool.read" },
  skill: { icon: "plugin-24", labelKey: "ui.tool.skill" },
  bash: { icon: "square-code-24", labelKey: "ui.tool.shell", lang: "bash" },
  edit: { icon: "edit-24", labelKey: "ui.tool.patch" },
  write: { icon: "edit-24", labelKey: "proto.tool.write" },
  grep: { icon: "find-catalog-24", labelKey: "ui.tool.grep", lang: "text" },
  question: { icon: "dialog-box-24", labelKey: "ui.tool.questions" },
  websearch: { icon: "web-search-24", labelKey: "ui.tool.websearch" },
}

const langOf = (part: ToolPartData) => TOOL_META[part.tool].lang ?? (part.title.split(".").pop() === "py" ? "python" : "markdown")

/** 工具调用行：图标 + 工具名 + 参数摘要；有输出时可点击展开。DOM 结构对齐 kcode-ui 的 basic-tool */
export function ToolPart(props: { part: ToolPartData; compact?: boolean; working?: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const { part } = props
  const meta = TOOL_META[part.tool]
  const status = part.state === "running" && part.tool !== "question" && props.working === false ? "error" : part.state
  const [copied, setCopied] = useState(false)
  const expandable = part.tool !== "skill" && (!!part.output || !!part.questionAnswers?.length)
  useEffect(() => { if (part.questionAnswers?.length) setOpen(true) }, [part.questionAnswers?.length])
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer) }, [copied])
  const copyOutput = async () => { await navigator.clipboard?.writeText(part.output ?? ""); setCopied(true) }
  // 加载技能时显示技能的展示名（skill-builder），不是内部触发名（kingdee-skill-creator）
  const title = part.tool === "skill" ? getSkillDisplayName(part.title) : part.title
  return (
    <div data-component="tool-part-wrapper" data-compact={props.compact ? "true" : undefined}>
      <div data-component={status === "error" ? "card" : undefined} data-kind={status === "error" ? "tool-error-card" : undefined} data-variant={status === "error" ? "error" : undefined}>
      <div
        data-component="collapsible"
        data-variant="normal"
        className="tool-collapsible"
        data-tool-kind={part.tool}
        data-open={open ? "true" : "false"}
        data-expanded={open ? "" : undefined}
        data-closed={open ? undefined : ""}
      >
        <div
          data-slot="collapsible-trigger"
          data-hide-details={expandable ? undefined : "true"}
          data-expanded={open ? "" : undefined}
          role={expandable ? "button" : undefined}
          tabIndex={expandable ? 0 : undefined}
          onKeyDown={(e) => { if (expandable && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); setOpen(!open) } }}
          aria-expanded={expandable ? open : undefined}
          onClick={() => expandable && setOpen(!open)}
        >
          <div data-component="tool-trigger" data-tool-kind={part.tool} data-clickable={expandable ? "true" : undefined} data-hide-details={expandable ? undefined : "true"}>
            <div data-slot="basic-tool-tool-trigger-content">
              <div data-slot="basic-tool-tool-indicator" data-tool-status={status}>
                {props.compact ? <ProcessStatus status={status}/> : <Icon name={meta.icon} size="small" />}
              </div>
              <div data-slot="basic-tool-tool-info">
                <div data-slot="basic-tool-tool-info-structured">
                  <div data-slot="basic-tool-tool-info-main">
                    <span data-slot="basic-tool-tool-title"><TextShimmer text={t(meta.labelKey)} active={status === "running"}/></span>
                    {part.tool === "bash" ? <span data-component="shell-submessage"><span data-slot="shell-submessage-width"><span data-slot="shell-submessage-value" title={title}>{title}</span></span></span> : <span data-slot="basic-tool-tool-subtitle" title={title}>{part.tool === "question" && part.questionAnswers ? t("ui.question.subtitle.answered", { count: part.questionAnswers.length }) : part.tool === "mcp" ? `\`${title}\`` : title}</span>}
                    {part.detail && <span data-slot="basic-tool-tool-arg" title={part.detail}>{part.detail}</span>}
                    {part.tool === "skill" && <span data-slot="skill-tool-status">{t(status === "running" ? "proto.process.skillRunning" : status === "error" ? "ui.toolErrorCard.failed" : "proto.process.skillCalled")}</span>}
                  </div>
                </div>
              </div>
            </div>
            {expandable && (
              <div data-slot="collapsible-arrow">
                <span data-slot="collapsible-arrow-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d={inlinePaths.reasoningChevron} fill="currentColor" />
                  </svg>
                </span>
              </div>
            )}
          </div>
        </div>
        {open && expandable && (
          <div data-slot="collapsible-content" data-expanded="">
            {status === "error" ? <div data-slot="tool-error-card-content"><div data-slot="tool-error-card-copy"><Tooltip value={t("ui.toolErrorCard.copyError")}><IconButton icon={copied ? "check" : "copy"} variant="ghost" onClick={() => void copyOutput()} aria-label={t("ui.toolErrorCard.copyError")}/></Tooltip></div><div data-slot="card-description">{part.output ?? t("ui.toolErrorCard.failed")}</div></div> : part.tool === "question" && part.questionAnswers ? <div data-component="question-answers">{part.questionAnswers.map((answer, i) => <div data-slot="question-answer-item" key={i}><div data-slot="question-text">{answer.question}</div><div data-slot="answer-text">{answer.answers.join(", ") || t("ui.question.answer.none")}</div></div>)}</div> : part.tool === "bash" ? <div data-component="bash-output"><div data-slot="bash-copy"><Tooltip value={t(copied ? "ui.message.copied" : "ui.message.copy")}><IconButton icon={copied ? "check" : "copy"} size="small" variant="secondary" onClick={() => void copyOutput()} aria-label={t("ui.message.copy")}/></Tooltip></div><div data-slot="bash-scroll" data-scrollable><pre data-slot="bash-pre"><code>{`$ ${part.title}\n\n${part.output}`}</code></pre></div></div> : <div data-component="tool-output" data-scrollable><Markdown text={part.tool === "write" || part.tool === "edit" || part.tool === "read" ? `\`\`\`${langOf(part)}\n${part.output}\n\`\`\`` : part.output ?? ""}/></div>}
          </div>
        )}
      </div>
      </div>
    </div>
  )
}
