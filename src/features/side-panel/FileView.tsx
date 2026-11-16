import { useEffect, useReducer, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { IconButton, Markdown } from "@/ui"
import { highlight, highlighted } from "@/ui/markdown/highlight"
import { useT } from "@/i18n"
import { fileService } from "@/services"

const LANGS: Record<string, string> = { py: "python", ts: "typescript", tsx: "tsx", js: "javascript", json: "json", md: "markdown", css: "css" }
const langOf = (path: string) => LANGS[path.split(".").pop() ?? ""] ?? "text"
const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** 带行号的只读源码视图（高亮与会话里的代码块同一套主题） */
function SourceView(props: { code: string; lang: string }) {
  const [, rerender] = useReducer((x: number) => x + 1, 0)
  const html = highlighted(props.code, props.lang)
  useEffect(() => {
    if (!html) highlight(props.code, props.lang, rerender)
  }, [props.code, props.lang, html])
  const lines = props.code.split("\n").length

  return (
    <div className="flex min-h-full text-[13px] leading-[22px] font-mono">
      <div className="shrink-0 select-none py-3 pl-4 pr-3 text-right text-text-weaker" aria-hidden="true">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <div
        className="min-w-0 flex-1 overflow-x-auto py-3 pr-4 select-text [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!text-[13px] [&_code]:!leading-[22px]"
        dangerouslySetInnerHTML={{ __html: html ?? `<pre><code>${escape(props.code)}</code></pre>` }}
      />
    </div>
  )
}

/** 文件标签的内容区：顶部是路径，Markdown 默认看渲染后的预览，可用右侧图标切回源码 */
export function FileView(props: { projectId: string; path: string; headerAccessory?: ReactNode }) {
  const t = useT()
  const markdown = props.path.endsWith(".md")
  const [showPreview, setShowPreview] = useState(markdown)
  const file = useQuery({ queryKey: ["file", props.projectId, props.path], queryFn: () => fileService.read(props.projectId, props.path) })
  const code = (file.data ?? "").trimEnd()
  const toggleLabel = t(showPreview ? "file.viewSource" : "file.preview")

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center pl-6 pr-4 py-1.5 gap-1.5 shrink-0">
        {props.headerAccessory}
        <div className="text-11-regular text-text-weaker select-text truncate flex-1 min-w-0" title={props.path}>
          {props.path}
        </div>
        {markdown && (
          <IconButton
            icon={showPreview ? "edit-doc-16" : "eye"}
            variant="ghost"
            size="small"
            className="size-6 rounded-md shrink-0"
            aria-label={toggleLabel}
            title={toggleLabel}
            onClick={() => setShowPreview(!showPreview)}
          />
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {file.isPending ? (
          <div className="px-6 py-4 text-14-regular text-text-weak">{t("common.loading")}</div>
        ) : markdown && showPreview ? (
          <div data-file-preview className="px-6 py-4 select-text">
            {/* front matter 不属于正文，预览时去掉 */}
            <Markdown text={code.replace(/^---\n[\s\S]*?\n---\n/, "")} />
          </div>
        ) : (
          <SourceView code={code} lang={langOf(props.path)} />
        )}
      </div>
    </div>
  )
}
