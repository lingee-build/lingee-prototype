import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { reportSections } from "./report-document"
import { updateReportDOM } from "./report-dom"

/** 保留独立文档的样式与脚本隔离，全文撑开高度，由评测主内容区统一滚动。 */
export function ReportPreview({ html, actions, status, focusCaseIndex = -1 }: { html: string; actions?: ReactNode; status?: ReactNode; focusCaseIndex?: number }) {
  const [initialHtml] = useState(html)
  const focused = useRef(-1)
  const [cases, setCases] = useState<{id: string; label: string}[]>([])
  const compact = true
  const [navOpen, setNavOpen] = useState(false)
  const heading = useMemo(() => {
    const doc = new DOMParser().parseFromString(html, "text/html")
    return { title: doc.querySelector("h1")?.textContent || "评测报告", meta: doc.querySelector(".report-meta-line")?.outerHTML || "" }
  }, [html])
  const metadataRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!metadataRef.current) return
    const next = new DOMParser().parseFromString(heading.meta, "text/html")
    updateReportDOM(metadataRef.current, next.body)
  }, [heading.meta])
  const navRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!compact || !navOpen) return
    const dismiss = (event: PointerEvent) => {
      if (!navRef.current?.contains(event.target as Node)) setNavOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      setNavOpen(false)
      navRef.current?.querySelector<HTMLButtonElement>(".eval-report-details-trigger")?.focus()
    }
    document.addEventListener("pointerdown", dismiss)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", dismiss)
      document.removeEventListener("keydown", escape)
    }
  }, [compact, navOpen])
  const [active, setActive] = useState("conclusion")
  const frameRef = useRef<HTMLIFrameElement>(null)
  const scrollToTarget = (target: HTMLElement) => {
    const frame = frameRef.current
    const panel = frame?.closest<HTMLElement>(".eval-panel")
    if (!frame || !panel) return
    frame.contentWindow?.scrollTo(0, 0)
    const offset = frame.getBoundingClientRect().top + target.getBoundingClientRect().top - panel.getBoundingClientRect().top - (navRef.current?.offsetHeight || 56) - 12
    panel.scrollBy({ top: offset, behavior: "instant" })
    target.tabIndex = -1
    target.focus({ preventScroll: true })
  }


  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let disconnectDocument = () => {}
    const connectDocument = () => {
      disconnectDocument()
      const document = frame.contentDocument
      if (!document?.body) return
      const updated = new DOMParser().parseFromString(html, "text/html")
      updated.querySelectorAll("script").forEach(script => script.remove())
      updateReportDOM(document.body, updated.body)
      setCases(Array.from(document.querySelectorAll("details.case")).map(item => ({id:item.id,label:(item.querySelector(".case-heading-label") || item.querySelector("summary"))?.textContent || ""})))
      // 预览目录放在主滚动区，保持吸顶；下载文档仍使用自己的目录。
      document.documentElement.dataset.embedded = "true"
      // 测量自然内容高度，不能用至少等于 iframe 高度的 scrollHeight，否则折叠后无法缩短。
      const resize = () => {
        const height = Math.ceil(document.body.getBoundingClientRect().height)
        if (height > 0 && frame.style.height !== `${height}px`) frame.style.height = `${height}px`
      }
      const observer = new ResizeObserver(resize)
      observer.observe(document.body)
      const syncControls = () => {
        document.querySelectorAll<HTMLButtonElement>("[data-cases],[data-rounds]").forEach(button => {
          const all = button.hasAttribute("data-cases")
          const items = Array.from((all ? document : button.closest(".case"))?.querySelectorAll<HTMLDetailsElement>(all ? "details.case" : "details.round") || [])
          const expanded = items.length > 0 && items.every(item => item.open)
          const label = expanded ? "全部折叠" : "全部展开"
          if (button.textContent !== label) button.textContent = label
          button.disabled = items.length === 0
        })
      }
      const navigate = (event: MouseEvent) => {
        const button = (event.target as Element | null)?.closest?.("[data-cases],[data-rounds]") as HTMLElement | null
        if (button) {
          const all = button.hasAttribute("data-cases")
          const scope = all ? document : button.closest(".case")
          const items = Array.from(scope?.querySelectorAll<HTMLDetailsElement>(all ? "details.case" : "details.round") || [])
          const open = !items.every(item => item.open)
          items.forEach(item => { item.open = open })
          syncControls()
          resize()
        }
        const link = (event.target as Element | null)?.closest?.('a[href^="#"]')
        if (!link) return
        const target = document.getElementById(link.getAttribute("href")!.slice(1))
        if (!target) return
        event.preventDefault()
        if (target.matches("details")) (target as HTMLDetailsElement).open = true
        resize()
        scrollToTarget(target)
      }
      let tick = 0
      const trackSection = () => {
        cancelAnimationFrame(tick)
        tick = requestAnimationFrame(() => {
          const offset = frame.getBoundingClientRect().top
          const boundary = frame.closest(".eval-panel")?.getBoundingClientRect().top ?? 0
          const targets = Array.from(document.querySelectorAll<HTMLElement>("main>section[id], details.case[id]"))
          let current = targets[0]?.id || "conclusion"
          for (const item of targets) if (offset + item.getBoundingClientRect().top <= boundary + 100) current = item.id
          setActive(current)
        })
      }
      window.addEventListener("scroll", trackSection, true)
      document.addEventListener("toggle", syncControls, true)
      syncControls()
      document.addEventListener("click", navigate)
      resize()
      if (focusCaseIndex >= 0 && focused.current !== focusCaseIndex) {
        const target = document.getElementById(`case-${focusCaseIndex}`) as HTMLDetailsElement | null
        if (target) { target.open = true; focused.current = focusCaseIndex; requestAnimationFrame(() => scrollToTarget(target)) }
      }
      disconnectDocument = () => {
        window.removeEventListener("scroll", trackSection, true)
        cancelAnimationFrame(tick)
        observer.disconnect()
        document.removeEventListener("toggle", syncControls, true)
        document.removeEventListener("click", navigate)
      }
    }
    frame.addEventListener("load", connectDocument)
    connectDocument()
    return () => {
      frame.removeEventListener("load", connectDocument)
      disconnectDocument()
    }
  }, [html, focusCaseIndex])

  useEffect(() => {
    if (!compact || !navOpen) return
    const frameDocument = frameRef.current?.contentDocument
    const dismiss = () => setNavOpen(false)
    frameDocument?.addEventListener("pointerdown", dismiss)
    return () => frameDocument?.removeEventListener("pointerdown", dismiss)
  }, [compact, navOpen])

  const goTo = (id: string) => {
    const target = frameRef.current?.contentDocument?.getElementById(id)
    if (!target) return
    if (target.matches("details")) (target as HTMLDetailsElement).open = true
    if (compact) setNavOpen(false)
    else if (id.startsWith("case-")) setNavOpen(true)
    // 等目录关闭后定位并将焦点移交正文。
    requestAnimationFrame(() => {
      scrollToTarget(target)
    })
    setActive(id)
  }

  return <div className="eval-report-preview eval-report-unified">
    <header className="eval-report-cover">
      <div className="eval-report-title-row"><h2>{heading.title}</h2>{status}{actions}</div>
      <div className="eval-report-metadata" ref={metadataRef} />
    </header>
    <nav ref={navRef} className="eval-report-nav" aria-label="报告目录">
      <div className="eval-report-nav-heading"><strong>报告目录</strong></div>
      {reportSections.map(section => <div key={section.id} className="eval-report-nav-section">
        <div className="eval-report-section-row">
          {section.id === "details" ? <button type="button" className="eval-report-details-trigger" aria-expanded={navOpen} aria-controls="report-case-navigation" aria-current={active === section.id ? "location" : undefined} onClick={() => setNavOpen(!navOpen)}>
            <span>{section.label}</span><span className="eval-report-nav-toggle" aria-hidden="true" aria-expanded={navOpen} />
          </button> : <a href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined} onClick={event => { event.preventDefault(); goTo(section.id) }}>{section.label}</a>}
        </div>
        {section.id === "details" && <div id="report-case-navigation" className="eval-report-case-group" hidden={!navOpen}>
          {cases.map((item, index) => <a key={item.id} href={`#${item.id}`} title={item.label} className="eval-report-case-link" aria-current={active === item.id ? "location" : undefined} onClick={event => { event.preventDefault(); goTo(item.id) }}>
            <span className="eval-report-nav-number">{index + 1}.</span><span className="eval-report-nav-name">{item.label.replace(/^\d+\.\s*/, "").replace(/ (无法判定|不通过|通过|待判定|判定中)$/, "")}</span><span className="eval-report-nav-status">{item.label.match(/(无法判定|不通过|通过|待判定|判定中)$/)?.[1]}</span>
          </a>)}
        </div>}
      </div>)}
    </nav>
    <iframe ref={frameRef} className="eval-report-document" title="评测报告预览" sandbox="allow-same-origin" srcDoc={initialHtml.replace(/<script>[\s\S]*?<\/script>/g, "")} />
  </div>
}
