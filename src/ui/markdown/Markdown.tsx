import { useEffect, useMemo, useReducer, useRef } from "react"
import { Marked } from "marked"
import { highlight, highlighted } from "./highlight"
import { iconPaths } from "./markdown-assets.gen"

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

const icon = (path: string, slot: string, viewBox: string) =>
  `<div data-component="icon" data-size="small" data-slot="${slot}"><svg data-slot="icon-svg" fill="none" viewBox="${viewBox}" aria-hidden="true">${path}</svg></div>`

const COPY_BUTTON = `<button type="button" data-component="icon-button" data-variant="secondary" data-size="small" data-slot="markdown-copy-button">${icon(iconPaths.newCopy, "copy-icon", "0 0 12 12")}${icon(iconPaths.check, "check-icon", "0 0 20 20")}</button>`

/**
 * 和线上一样用 marked 产出 HTML，结构也对齐：代码块包一层 markdown-code 并带复制按钮，
 * 表格包一层可横向滚动的容器。代码高亮是异步的：先出纯文本，高亮完成后重渲染一次。
 */
function createParser(onPending: (code: string, lang: string) => void) {
  return new Marked({
    gfm: true,
    renderer: {
      code({ text, lang }) {
        const language = (lang ?? "").trim().split(/\s+/)[0] || "text"
        const html = highlighted(text, language)
        if (!html) onPending(text, language)
        return `<div data-component="markdown-code">${html ?? `<pre class="shiki"><code>${escape(text)}</code></pre>`}${COPY_BUTTON}</div>`
      },
      table(token) {
        const cell = (content: string, tag: "th" | "td", align: string | null) =>
          `<${tag}${align ? ` align="${align}"` : ""}>${content}</${tag}>`
        const head = token.header.map((x) => cell(this.parser.parseInline(x.tokens), "th", x.align)).join("")
        const body = token.rows
          .map((row) => `<tr>${row.map((x) => cell(this.parser.parseInline(x.tokens), "td", x.align)).join("")}</tr>`)
          .join("")
        return `<div data-slot="markdown-table"><div data-slot="markdown-table-scroll"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></div>`
      },
      link({ href, title, tokens }) {
        return `<a href="${href}"${title ? ` title="${title}"` : ""} class="external-link" target="_blank" rel="noopener noreferrer">${this.parser.parseInline(tokens)}</a>`
      },
    },
  })
}

export function Markdown(props: { text: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null)
  const [version, rerender] = useReducer((x: number) => x + 1, 0)
  const html = useMemo(
    () => createParser((code, lang) => highlight(code, lang, rerender)).parse(props.text, { async: false }),
    [props.text, version],
  )

  // 复制按钮用事件委托：HTML 是整段替换的，逐个绑定会丢
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onClick = (event: MouseEvent) => {
      const button = (event.target as Element).closest<HTMLButtonElement>('[data-slot="markdown-copy-button"]')
      const code = button?.closest('[data-component="markdown-code"]')?.querySelector("code")?.textContent
      if (!button || !code) return
      void navigator.clipboard?.writeText(code)
      button.setAttribute("data-copied", "true")
      setTimeout(() => button.removeAttribute("data-copied"), 2000)
    }
    el.addEventListener("click", onClick)
    return () => el.removeEventListener("click", onClick)
  }, [])

  return <div ref={root} data-component="markdown" className={props.className} dangerouslySetInnerHTML={{ __html: html }} />
}
