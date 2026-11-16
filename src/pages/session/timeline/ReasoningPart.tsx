import { TextShimmer } from "@/ui/text-shimmer/TextShimmer"
import { useEffect, useRef, useState } from "react"
import { Icon, Markdown } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { useT } from "@/i18n"
import type { ReasoningPart as ReasoningPartData } from "@/mock/types"

/** 思考过程：进行中显示「正在思考」，结束后折叠成一行摘要，点击展开 */
export function ReasoningPart(props: { part: ReasoningPartData }) {
  const t = useT()
  const [expanded, setExpanded] = useState(props.part.display === "scroll" && props.part.time.end === undefined)
  const streaming = props.part.time.end === undefined
  const body = useRef<HTMLDivElement>(null)
  const summaryRef = useRef<HTMLSpanElement>(null)
  const follow = useRef(true)
  const interacted = useRef(false)
  useEffect(() => {
    if (props.part.display === "scroll" && streaming && !interacted.current) setExpanded(true)
  }, [streaming, props.part.display])
  const text = props.part.text.trim()
  const summary = streaming ? text.slice(text.lastIndexOf("\n") + 1).trim() : text.split("\n")[0]
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (summaryRef.current) summaryRef.current.scrollLeft = streaming ? summaryRef.current.scrollWidth : 0
      if (streaming && follow.current && body.current) body.current.scrollTo({ top: body.current.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" })
    })
    return () => cancelAnimationFrame(frame)
  }, [text, streaming, expanded])
  return (
    <div data-component="reasoning-part" data-expanded={expanded} data-auto-scroll={props.part.display === "scroll" || undefined} data-preview={props.part.display === "scroll" && !interacted.current || undefined} data-state={streaming ? "running" : "ok"}>
      <div data-slot="reasoning-header" role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); interacted.current = true; setExpanded(!expanded) } }} aria-expanded={expanded} onClick={() => { interacted.current = true; setExpanded(!expanded) }}>
        {!streaming && (
          <span data-slot="reasoning-icon">
            <Icon name="brain-24" size="small" />
          </span>
        )}
        <span data-slot="reasoning-label">
          <TextShimmer text={t(streaming ? "ui.reasoning.understanding" : "ui.reasoning.thinkingDone")} active={streaming}/>
        </span>
        {!expanded && summary && (
          <>
            <span data-slot="reasoning-summary-separator" aria-hidden="true" />
            <span ref={summaryRef} data-slot="reasoning-summary" title={summary}>
              {summary}
            </span>
          </>
        )}
        <svg data-slot="reasoning-chevron" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d={inlinePaths.reasoningChevron} fill="currentColor" />
        </svg>
      </div>
      {expanded && (
        <div ref={body} data-slot="reasoning-body" data-streaming={streaming} onWheel={(event) => { if (event.deltaY < 0) follow.current = false }} onScroll={() => { if (body.current && body.current.scrollHeight - body.current.scrollTop - body.current.clientHeight < 24) follow.current = true }}>
          <Markdown text={props.part.text} />
        </div>
      )}
    </div>
  )
}
