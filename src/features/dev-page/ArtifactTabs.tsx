import { createContext, useContext, useState, type KeyboardEvent } from "react"
import { useNavigate } from "react-router"
import { showToast } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { ARTIFACT_TABS, loadArtifactOrder, saveArtifactOrder, type ArtifactMode } from "@/features/sidebar/nav-config"

/** 在「产物」页签下时为 true：各开发页的页面标题由页签替代，不再重复显示 */
export const InArtifactTabsContext = createContext(false)
export const useInArtifactTabs = () => useContext(InArtifactTabsContext)

const GRIP = (
  // 尺寸、定位、默认隐藏直接写在元素上：样式表没加载到时也不会撑成大图标
  <svg
    className="artifact-tab__grip"
    width="8"
    height="14"
    viewBox="0 0 10 16"
    fill="currentColor"
    aria-hidden="true"
    style={{ position: "absolute", left: -12, top: "50%", marginTop: -7, width: 8, height: 14, opacity: 0, pointerEvents: "none" }}
  >
    <circle cx="3" cy="4" r="1.2" /><circle cx="7" cy="4" r="1.2" />
    <circle cx="3" cy="8" r="1.2" /><circle cx="7" cy="8" r="1.2" />
    <circle cx="3" cy="12" r="1.2" /><circle cx="7" cy="12" r="1.2" />
  </svg>
)

/**
 * 产物类型页签（技能 / 智能体 / 工作流 / 应用 / MCP 应用）。
 * 拖动页签调整顺序：鼠标停留约 1 秒在左侧淡出 ⋮⋮ 手柄，落点按页签左右半边判断插到前面还是后面；顺序按用户保存。
 */
export function ArtifactTabs(props: { active: ArtifactMode }) {
  const t = useT()
  const navigate = useNavigate()
  const [order, setOrder] = useState(loadArtifactOrder)
  const [dragging, setDragging] = useState<ArtifactMode | null>(null)
  const [mark, setMark] = useState<{ key: ArtifactMode; after: boolean } | null>(null)
  const label = (k: ArtifactMode) => t(ARTIFACT_TABS.find((x) => x.id === k)!.labelKey)

  const reset = () => {
    setDragging(null)
    setMark(null)
  }
  const drop = (to: ArtifactMode, after: boolean) => {
    if (!dragging || to === dragging) return reset()
    const next = order.filter((k) => k !== dragging)
    next.splice(next.indexOf(to) + (after ? 1 : 0), 0, dragging)
    reset()
    if (next.join() === order.join()) return
    setOrder(next)
    saveArtifactOrder(next)
    showToast({ variant: "success", title: t("proto.artifact.reordered") })
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
    e.preventDefault()
    const i = order.indexOf(props.active)
    const next = order[(i + (e.key === "ArrowRight" ? 1 : -1) + order.length) % order.length]
    navigate(`/dev/${next}`)
    requestAnimationFrame(() => document.getElementById(`artifact-tab-${next}`)?.focus())
  }

  return (
    <div className="shrink-0 w-full">
      <div className="mx-auto w-full" style={{ maxWidth: 1200, padding: "0 40px 0 24px" }}>
        <div className="artifact-tabs flex items-center gap-6" style={{ height: 52, marginBottom: 8 }} role="tablist" aria-label={t("proto.artifact.tabsLabel")} onKeyDown={onKeyDown}>
          {order.map((k) => (
            <button
              key={k}
              id={`artifact-tab-${k}`}
              type="button"
              role="tab"
              aria-selected={props.active === k}
              tabIndex={props.active === k ? 0 : -1}
              draggable
              // 文字沿用开发页原标题的样式（dev-page-title / text-text-strong），未选中用 text-text-weak
              className={cx(
                "artifact-tab text-[18px] leading-9",
                props.active === k ? "dev-page-title text-text-strong" : "font-[500] text-text-weak hover:text-text-strong",
                dragging === k && "is-dragging",
                mark?.key === k && (mark.after ? "is-after" : "is-before"),
              )}
              onClick={() => navigate(`/dev/${k}`)}
              onDragStart={(e) => {
                setDragging(k)
                e.dataTransfer.effectAllowed = "move"
                e.dataTransfer.setData("text/plain", k)
              }}
              onDragOver={(e) => {
                if (!dragging) return
                e.preventDefault()
                const r = e.currentTarget.getBoundingClientRect()
                const after = e.clientX > r.left + r.width / 2
                if (k === dragging) setMark(null)
                else if (mark?.key !== k || mark.after !== after) setMark({ key: k, after })
              }}
              onDrop={(e) => {
                e.preventDefault()
                drop(k, mark?.key === k ? mark.after : false)
              }}
              onDragEnd={reset}
            >
              {GRIP}
              {label(k)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
