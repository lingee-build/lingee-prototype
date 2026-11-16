import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router"
import { BrandButton, Dialog, Icon, useDialog } from "@/ui"
import { inlinePaths } from "@/ui/icon/inline-paths.gen"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"
import { byUpdated, formatSessionTime, sessionPath } from "./helpers"

function HighlightText(props: { text: string; query: string }) {
  const q = props.query.trim().toLowerCase()
  if (!q) return <span>{props.text}</span>
  const parts: Array<{ text: string; hl: boolean }> = []
  for (let rest = props.text; rest; ) {
    const index = rest.toLowerCase().indexOf(q)
    if (index < 0) {
      parts.push({ text: rest, hl: false })
      break
    }
    if (index > 0) parts.push({ text: rest.slice(0, index), hl: false })
    parts.push({ text: rest.slice(index, index + q.length), hl: true })
    rest = rest.slice(index + q.length)
  }
  return (
    <span>
      {parts.map((part, i) =>
        part.hl ? (
          <mark key={i} style={{ background: "none", color: "var(--primary-600)", fontStyle: "normal", fontWeight: 600 }}>
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </span>
  )
}

function snippetOf(text: string, query: string, context = 40) {
  const index = text.toLowerCase().indexOf(query)
  const start = Math.max(0, index - context)
  const end = Math.min(text.length, index + query.length + context)
  return (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "")
}

/** 搜索会话：标题命中优先，其次正文命中；支持方向键导航和回车跳转（⌘K 打开） */
export function SearchDialog(props: { onNewTask: () => void }) {
  const t = useT()
  const dialog = useDialog()
  const navigate = useNavigate()
  const { sessions, projects, messages } = useSync()
  const [raw, setRaw] = useState("")
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(-1)
  const list = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(raw)
      setActive(-1)
    }, 150)
    return () => clearTimeout(timer)
  }, [raw])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    const projectName = (id: string) => projects.find((x) => x.id === id)?.name ?? ""
    const all = [...sessions].sort(byUpdated).map((session) => ({ session, projectName: projectName(session.projectId) }))
    if (!q) return all.map((x) => ({ ...x, score: 0, snippet: undefined as string | undefined }))
    return all
      .flatMap((item) => {
        if (item.session.title.toLowerCase().includes(q)) return [{ ...item, score: 2, snippet: undefined as string | undefined }]
        const hit = (messages[item.session.id] ?? [])
          .flatMap((message) => message.parts)
          .find((part) => part.type === "text" && part.text.toLowerCase().includes(q))
        return hit && hit.type === "text" ? [{ ...item, score: 1, snippet: snippetOf(hit.text, q) }] : []
      })
      .sort((a, b) => b.score - a.score || byUpdated(a.session, b.session))
  }, [query, sessions, projects, messages])

  useEffect(() => {
    if (active < 0) return
    list.current?.querySelector<HTMLElement>(`[data-search-idx="${active}"]`)?.scrollIntoView({ block: "nearest" })
  }, [active])

  const select = (index: number) => {
    const hit = results[index]
    if (!hit) return
    navigate(sessionPath(hit.session))
    dialog.close()
  }

  return (
    <Dialog width="560px">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 mx-5 mt-3 mb-3 shrink-0">
          <Icon name="search-16" className="size-5 shrink-0 text-[var(--neutral-400)]" />
          <input
            data-autofocus
            type="text"
            placeholder={t("kcode.search.placeholder")}
            className="flex-1 bg-transparent outline-none text-[15px] font-[400] leading-[22px] text-[var(--neutral-900)] placeholder:text-[var(--neutral-400)]"
            value={raw}
            onChange={(e) => setRaw(e.currentTarget.value)}
            onKeyDown={(e) => {
              // 输入法组合输入中（如拼音未确认）时，按键交给输入法，不做导航/跳转
              if (e.nativeEvent.isComposing || results.length === 0) return
              if (e.key === "ArrowDown") {
                e.preventDefault()
                setActive((i) => (i + 1) % results.length)
              }
              if (e.key === "ArrowUp") {
                e.preventDefault()
                setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
              }
              if (e.key === "Enter") {
                e.preventDefault()
                select(Math.max(active, 0))
              }
            }}
          />
          <button
            type="button"
            className="flex items-center justify-center w-9 h-9 shrink-0 rounded-[8px] hover:bg-[var(--surface-base)] text-[var(--neutral-400)] hover:text-[var(--neutral-600)] transition-colors cursor-pointer"
            onClick={dialog.close}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <path d="M6 6L14 14M14 6L6 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="h-px bg-[var(--neutral-100)] shrink-0" />

        <div className="relative flex flex-col flex-1 min-h-0 pt-3">
          <div ref={list} className="flex-1 overflow-y-auto pb-2 custom-scroll-native">
            {results.length === 0 && !query && (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <Icon name="empty-box" containerClass="size-10" />
                <span className="text-[14px] text-[var(--neutral-500)] leading-[20px]">{t("kcode.search.emptyHint")}</span>
                <BrandButton
                  variant="primary"
                  size="normal"
                  onClick={() => {
                    props.onNewTask()
                    dialog.close()
                  }}
                >
                  {t("kcode.search.newSession")}
                </BrandButton>
              </div>
            )}
            {results.length === 0 && query && (
              <div className="flex flex-col items-center gap-3 px-5 py-8 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden="true">
                  <path fillRule="evenodd" clipRule="evenodd" d={inlinePaths.searchEmpty} fill="url(#search-no-result-grad)" />
                  <defs>
                    <linearGradient id="search-no-result-grad" x1="27.9997" y1="4.66666" x2="27.9997" y2="51.3331" gradientUnits="userSpaceOnUse">
                      <stop stopOpacity="0.28" />
                      <stop offset="1" stopOpacity="0.12" />
                    </linearGradient>
                  </defs>
                </svg>
                <span className="text-[14px] text-[var(--neutral-400)] leading-[20px]">{t("kcode.search.noResultsHint")}</span>
              </div>
            )}
            {results.map((hit, index) => (
              <div className="mx-3" key={hit.session.id}>
                <button
                  type="button"
                  data-search-idx={index}
                  className={cx(
                    "w-full rounded-[20px] flex flex-col gap-0.5 px-4 py-2 cursor-pointer text-left transition-colors",
                    active === index && "bg-[var(--surface-base)]",
                  )}
                  onClick={() => select(index)}
                  onMouseEnter={() => setActive(index)}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="flex-1 min-w-0 truncate text-[14px] font-[400] leading-[20px] text-[var(--neutral-900)]" title={hit.session.title}>
                      <HighlightText text={hit.session.title} query={query} />
                    </span>
                    <span className="shrink-0 text-[12px] text-[var(--neutral-400)] leading-[18px]">
                      {formatSessionTime(hit.session.time.updated, t)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 w-full min-w-0">
                    <span className="shrink-0 text-[12px] text-[var(--neutral-400)] leading-[18px]">{hit.projectName}</span>
                    {hit.snippet && (
                      <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--neutral-400)] leading-[18px]">
                        · <HighlightText text={hit.snippet} query={query} />
                      </span>
                    )}
                  </div>
                </button>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-[var(--neutral-0)] to-transparent" />
        </div>
      </div>
    </Dialog>
  )
}
