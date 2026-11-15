import { useEffect, useRef, useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { useLocation } from "react-router"
import { useLocaleStore, useT } from "@/i18n"
import { Dialog, Icon } from "@/ui"
import "./evaluation-guide.css"

const seenKey = "lingee-prototype.evaluation-guide.cinema-v1"
let seen = false

export function EvaluationGuide() {
  const t = useT()
  const location = useLocation()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!location.state?.evaluationOnboarding || seen) return
    try {
      if (localStorage.getItem(seenKey) === "seen") return
    } catch {}
    setOpen(true)
  }, [location.state])

  function close() {
    seen = true
    try { localStorage.setItem(seenKey, "seen") } catch {}
    setOpen(false)
  }

  return <Radix.Root open={open} onOpenChange={value => value ? setOpen(true) : close()}>
    <Radix.Trigger asChild>
      <button type="button" className="evaluation-guide-launcher" title={t("evaluation.guide.watch")} disabled={open}>
        <Icon name="play-triangle" size="small" />{t("evaluation.guide.watch")}
      </button>
    </Radix.Trigger>
    <Radix.Portal>
      <Radix.Overlay data-component="dialog-overlay" />
      <Dialog title={t("evaluation.guide.title")} width="90vw" rootClass="evaluation-guide-dialog" fit onClose={close}>
        <GuidePlayer onClose={close} />
      </Dialog>
    </Radix.Portal>
  </Radix.Root>
}

function GuidePlayer({ onClose }: { onClose: () => void }) {
  const t = useT()
  const locale = useLocaleStore(s => s.locale)
  const frame = useRef<HTMLIFrameElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(false)
  const [size, setSize] = useState({ scale: 1, width: 1068 })
  const [theme] = useState(() => document.documentElement.dataset.colorScheme === "dark" ? "dark" : "light")
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    const view = viewport.current
    const player = frame.current?.contentWindow
    if (!view || !player) return
    const observer = new ResizeObserver(() => {
      const scale = Math.max(0.1, Math.min(view.clientWidth / 1068, view.clientHeight / 980))
      setSize({ scale, width: view.clientWidth / scale })
    })
    observer.observe(view)
    function receive(event: MessageEvent) {
      if (event.source !== player || event.data?.type !== "lingee-evaluation-guide") return
      if (event.data.action === "ready") setLoaded(true)
      if (event.data.action === "escape") close.current()
    }
    window.addEventListener("message", receive)
    return () => {
      observer.disconnect()
      window.removeEventListener("message", receive)
      player.postMessage({ type: "lingee-evaluation-guide", action: "pause" }, "*")
    }
  }, [])

  return <section className="evaluation-guide-player" aria-label={t("evaluation.guide.title")}>
    <header className="evaluation-guide-header">
      <span>{t("evaluation.guide.title")}</span>
      <div>
        <button type="button" disabled={!loaded} onClick={() => frame.current?.contentWindow?.postMessage({ type: "lingee-evaluation-guide", action: "replay" }, "*")}>{t("evaluation.guide.replay")}</button>
        <button type="button" onClick={onClose}>{t("evaluation.guide.skip")}</button>
      </div>
    </header>
    <div className="evaluation-guide-viewport" ref={viewport}>
      <iframe ref={frame} title={t("evaluation.guide.title")} sandbox="allow-scripts" referrerPolicy="no-referrer"
        src={`${import.meta.env.BASE_URL}evaluation-guide/index.html?locale=${encodeURIComponent(locale)}&theme=${theme}`}
        style={{ width: size.width, transform: `translate(-50%, -50%) scale(${size.scale})` }} />
    </div>
  </section>
}
