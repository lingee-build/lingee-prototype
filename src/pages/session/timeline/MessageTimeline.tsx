import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from "react"
import type { CardClick } from "@/ui"
import type { Message, Session } from "@/mock/types"
import { SessionTurn } from "./SessionTurn"
import { useCardActions } from "./use-card-actions"

/** 把消息流切成「轮」：每条用户消息开启一轮，之后的助手消息归入该轮 */
function toTurns(messages: Message[]) {
  return messages.reduce<Array<{ user: Message; assistants: Message[] }>>((turns, message) => {
    if (message.role === "user") return [...turns, { user: message, assistants: [] }]
    const last = turns[turns.length - 1]
    if (!last) return turns
    return [...turns.slice(0, -1), { ...last, assistants: [...last.assistants, message] }]
  }, [])
}

/** 会话时间线：固定标题 + 可滚动的消息区；流式输出时若用户停在底部则自动跟随 */
export function MessageTimeline(props: { session: Session; messages: Message[]; footer?: ReactNode; titleActions?: ReactNode; titleDescription?: ReactNode; onCardClick?: CardClick }) {
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const turns = useMemo(() => toTurns(props.messages), [props.messages])
  const working = props.session.status === "running"
  const onCardClick = useCardActions(props.session.projectId)

  const content = useRef<HTMLDivElement>(null)
  const frame = useRef<number | undefined>(undefined)
  const animating = useRef(false)
  const stopFollow = useCallback(() => {
    stick.current = false
    animating.current = false
    if (frame.current !== undefined) cancelAnimationFrame(frame.current)
    frame.current = undefined
  }, [])
  const followBottom = useCallback(() => {
    const el = scroller.current
    if (!el || !stick.current || frame.current !== undefined) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollTop = el.scrollHeight
      return
    }
    let previous = performance.now()
    animating.current = true
    const tick = (now: number) => {
      if (!stick.current) { frame.current = undefined; animating.current = false; return }
      const target = Math.max(0, el.scrollHeight - el.clientHeight)
      const delta = target - el.scrollTop
      const elapsed = Math.min(64, now - previous)
      previous = now
      el.scrollTop += delta * (1 - Math.exp(-elapsed / 150))
      if (Math.abs(delta) > 2) frame.current = requestAnimationFrame(tick)
      else {
        el.scrollTop = target
        frame.current = undefined
        // Scroll events are delivered asynchronously after the animation frame.
        requestAnimationFrame(() => { if (frame.current === undefined) animating.current = false })
      }
    }
    frame.current = requestAnimationFrame(tick)
  }, [])
  useLayoutEffect(followBottom, [props.messages, followBottom])
  useEffect(() => {
    const observer = new ResizeObserver(followBottom)
    if (content.current) observer.observe(content.current)
    if (scroller.current) observer.observe(scroller.current)
    followBottom()
    return () => {
      observer.disconnect()
      if (frame.current !== undefined) cancelAnimationFrame(frame.current)
      frame.current = undefined
      animating.current = false
    }
  }, [followBottom])
  useLayoutEffect(() => {
    stick.current = true
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [props.session.id])

  return (
    <div className="relative w-full h-full min-w-0 flex flex-col">
      <div className="px-6">
        <div data-session-title className="bg-background-page relative w-full py-3.5 px-0">
          <div className="h-6 w-full flex items-center justify-center gap-2 relative">
            <div className="flex flex-1 items-center justify-center min-w-0">
              <div className="flex items-center justify-start min-w-0 grow-1">
                <div className="group/title flex items-center min-w-0 shrink">
                  <h1
                    data-slot="session-title-child"
                    className="text-[var(--session-title)] truncate min-w-0 font-[500] text-[16px] leading-[24px]"
                    title={props.session.title}
                  >
                    {props.session.title}
                  </h1>
                </div>
              </div>
            </div>
            {props.titleActions && <div className="shrink-0 flex items-center gap-2">{props.titleActions}</div>}
          </div>
          {props.titleDescription}
        </div>
      </div>
      <div
        ref={scroller}
        className="flex-1 min-h-0 overflow-y-auto px-6 pb-10"
        style={{ overflowAnchor: "none" }}
        onWheel={(e) => { if (e.deltaY < 0) stopFollow() }}
        onTouchMove={stopFollow}
        onPointerDown={(e) => { if (e.target === e.currentTarget) stopFollow() }}
        onKeyDown={(e) => { if (["PageUp", "Home", "ArrowUp"].includes(e.key)) stopFollow() }}
        onScroll={(e) => {
          if (animating.current) return
          const el = e.currentTarget
          // Layout changes and our own scrolling must not be mistaken for user intent.
          if (el.scrollHeight - el.scrollTop - el.clientHeight < 24) stick.current = true
        }}
      >
        <div ref={content} data-slot="session-turn-list" className="w-full md:max-w-[800px] md:mx-auto flex flex-col">
          {turns.map((turn, index) => (
            <SessionTurn
              key={turn.user.id}
              user={turn.user}
              assistants={turn.assistants}
              working={working && index === turns.length - 1}
              onCardClick={props.onCardClick ?? onCardClick}
            />
          ))}
          {props.footer}
        </div>
      </div>
    </div>
  )
}
