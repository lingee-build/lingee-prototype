import { useEffect, useRef, useState, type CSSProperties } from "react"
import { reportSections } from "./report-document"

/** 保留独立文档的样式与脚本隔离，全文撑开高度，由评测主内容区统一滚动。 */
export function ReportPreview({ html }: { html: string }) {
  const [cases, setCases] = useState<{id: string; label: string}[]>([])
  const [navOpen, setNavOpen] = useState(true)
  const [active, setActive] = useState("conclusion")
  const [navWidth, setNavWidth] = useState(240)
  const dragRef = useRef<{ x: number; width: number } | null>(null)
  const changeWidth = (width: number) => setNavWidth(Math.min(420, Math.max(200, width)))
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    let disconnectDocument = () => {}
    const connectDocument = () => {
      disconnectDocument()
      const document = frame.contentDocument
      if (!document?.body) return
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
          button.textContent = expanded ? "全部折叠" : "全部展开"
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
        target.scrollIntoView({ block: "start" })
        target.tabIndex = -1
        target.focus({ preventScroll: true })
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
  }, [html])

  const goTo = (id: string) => {
    const target = frameRef.current?.contentDocument?.getElementById(id)
    if (!target) return
    if (target.matches("details")) (target as HTMLDetailsElement).open = true
    if (id.startsWith("case-")) setNavOpen(true)
    target.scrollIntoView({ block: "start" })
    target.tabIndex = -1
    target.focus({ preventScroll: true })
    setActive(id)
  }

  return <div className="eval-report-preview" style={{ "--report-nav-width": `${navWidth}px` } as CSSProperties}>
    <nav className="eval-report-nav" aria-label="报告目录">
      <div className="eval-report-nav-heading"><strong>报告目录</strong></div>
      {reportSections.map(section => <div key={section.id}>
        <div className="eval-report-section-row">
          <a href={`#${section.id}`} aria-current={active === section.id ? "location" : undefined} onClick={event => { event.preventDefault(); goTo(section.id) }}>{section.label}</a>
          {section.id === "details" && <button className="eval-report-nav-toggle" aria-label={navOpen ? "收起用例目录" : "展开用例目录"} aria-expanded={navOpen} aria-controls="report-case-navigation" onClick={() => setNavOpen(!navOpen)}>{navOpen ? "⌄" : "›"}</button>}
        </div>
        {section.id === "details" && <div id="report-case-navigation" className="eval-report-case-group" hidden={!navOpen}>
          {cases.map((item, index) => <a key={item.id} href={`#${item.id}`} title={item.label} className="eval-report-case-link" aria-current={active === item.id ? "location" : undefined} onClick={event => { event.preventDefault(); goTo(item.id) }}>
            <span className="eval-report-nav-number">{index + 1}.</span><span className="eval-report-nav-name">{item.label.replace(/^\d+\.\s*/, "").replace(/ (无法判定|不通过|通过|待判定|判定中)$/, "")}</span><span className="eval-report-nav-status">{item.label.match(/(无法判定|不通过|通过|待判定|判定中)$/)?.[1]}</span>
          </a>)}
        </div>}
      </div>)}
    </nav>
    <div className="eval-report-resizer" role="separator" tabIndex={0} aria-label="调整报告目录宽度" aria-orientation="vertical" aria-valuemin={200} aria-valuemax={420} aria-valuenow={navWidth} title="拖动调整目录宽度；方向键微调，双击复位"
      onPointerDown={event => { if (event.button !== 0) return; dragRef.current = { x: event.clientX, width: navWidth }; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault() }}
      onPointerMove={event => { if (dragRef.current) changeWidth(dragRef.current.width + event.clientX - dragRef.current.x) }}
      onPointerUp={event => { dragRef.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId) }}
      onPointerCancel={() => { dragRef.current = null }} onLostPointerCapture={() => { dragRef.current = null }} onDoubleClick={() => changeWidth(240)}
      onKeyDown={event => { const widths: Record<string, number> = { ArrowLeft: navWidth - 20, ArrowRight: navWidth + 20, Home: 200, End: 420 }; if (event.key in widths) { event.preventDefault(); changeWidth(widths[event.key]) } }} />
    <iframe ref={frameRef} className="eval-report-document" title="评测报告预览" sandbox="allow-same-origin" srcDoc={html.replace(/<script>[\s\S]*?<\/script>/g, "")} />
  </div>
}
