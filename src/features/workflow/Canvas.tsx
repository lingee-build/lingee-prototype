import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { DropdownMenu, Icon, Tooltip, type IconName } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { autoLayout, defaultNode, NODE_H, NODE_TYPE_ORDER, NODE_W, type WfGraph, type WfNode, type WfNodeType } from "@/mock/fixtures/workflow-graphs"
import type { NodeRunStatus } from "./editor-store"
import { addFreeNode, addNode, connect, edgeLabel, insertOnEdge, joinOf, NODE_DESC, NODE_LABEL, nextTitle, parallelOf, removeEdge, toolName } from "./graph-ops"
import { assigneeLabel as assigneeText } from "./node-config"

export const NODE_ICON: Record<WfNodeType, IconName> = {
  start: "play-circle",
  end: "circle-check",
  agent: "ai-partner",
  tool: "plugin-24",
  code: "code-slash",
  condition: "branch",
  parallel: "git-branch-network",
  join: "fork",
  loop: "refresh",
  human: "user",
}

/** 节点副标题：一眼看出它做什么（与原设计器节点卡片的说明一致） */
export function nodeSummary(node: WfNode, graph?: WfGraph) {
  const c = node.config
  if (node.type === "start") return `${c.params?.length ?? 0} 项业务输入`
  if (node.type === "end") return `${c.results?.length ?? 0} 项最终输出`
  if (node.type === "agent") return c.mode === "single" ? "单次模型 · 不绑定智能体" : `${c.agentRef || "未绑定智能体"} · 完整智能体`
  if (node.type === "tool") return toolName(node) || "未选择 MCP 工具"
  if (node.type === "code") return `${c.language ?? "Python"} · 超时 ${c.timeout ?? 30} 秒`
  if (node.type === "condition") return `首个匹配生效 · ${c.branches?.length ?? 0} 个条件 + 默认出口`
  if (node.type === "parallel") return `${graph?.edges.filter((e) => e.source === node.id).length ?? 0} 条分支同时执行${graph && !joinOf(graph, node.id) ? " · 缺少汇入" : ""}`
  if (node.type === "join") return graph && parallelOf(graph, node.id) ? "全部分支成功后继续" : "未关联并行节点"
  if (node.type === "loop") return `${c.loopMode === "condition" ? `按条件 · 最多 ${c.maxRounds ?? 5} 轮` : `集合 · ${c.concurrency === "parallel" ? "并行" : "顺序"}`} · ${c.body?.length ?? 0} 步`
  if (node.type === "human") return `办理人：${assigneeText(c.assignee)} · ${c.actions?.length ?? 0} 个动作${c.deadline && c.deadline !== "0" ? "" : " · 不限处理时长"}`
  return ""
}

type View = { x: number; y: number; zoom: number }
const DRAG_TYPE = "application/x-workflow-node"

function bounds(graph: WfGraph) {
  const xs = graph.nodes.map((n) => n.x)
  const ys = graph.nodes.map((n) => n.y)
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs) + NODE_W, maxY: Math.max(...ys) + NODE_H }
}

const path = (a: WfNode, b: WfNode, nodes: WfNode[]) => {
  const x1 = a.x + NODE_W / 2
  const y1 = a.y + NODE_H
  const x2 = b.x + NODE_W / 2
  const y2 = b.y
  // 往回连（目标在上方）：从右侧绕上去
  if (y2 <= y1) {
    const side = Math.max(a.x, b.x) + NODE_W + 36
    return { d: `M ${x1} ${y1} C ${x1} ${y1 + 30}, ${side} ${y1 + 30}, ${side} ${y1} L ${side} ${y2} C ${side} ${y2 - 30}, ${x2} ${y2 - 30}, ${x2} ${y2}`, mx: side, my: (y1 + y2) / 2 }
  }
  // 跨层的连线如果会穿过中间的节点，从右侧绕开
  const blocked = nodes.some((n) => n.id !== a.id && n.id !== b.id && n.y > y1 && n.y + NODE_H < y2 && Math.min(x1, x2) < n.x + NODE_W && Math.max(x1, x2) > n.x)
  if (blocked) {
    const side = Math.max(...nodes.filter((n) => n.y > y1 && n.y + NODE_H < y2).map((n) => n.x + NODE_W)) + 36
    return {
      d: `M ${x1} ${y1} C ${x1} ${y1 + 24}, ${side} ${y1 + 8}, ${side} ${y1 + 40} L ${side} ${y2 - 40} C ${side} ${y2 - 8}, ${x2} ${y2 - 34}, ${x2} ${y2}`,
      mx: side,
      my: (y1 + y2) / 2,
    }
  }
  const dy = Math.max(24, (y2 - y1) / 2)
  return { d: `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2 }
}

/** 连线中间「+」的类型菜单 */
function NodeTypeMenu(props: { onPick: (type: WfNodeType) => void; label: string }) {
  return (
    <DropdownMenu placement="right-start" gutter={6}>
      <DropdownMenu.Trigger aria-label={props.label} className="workflow-edge-add">
        <Icon name="plus-16" size="small" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content style={{ minWidth: 140 }}>
          {NODE_TYPE_ORDER.map((type) => (
            <DropdownMenu.Item key={type} className="flex items-center gap-2 cursor-pointer" onSelect={() => props.onPick(type)}>
              <span className="workflow-node-icon is-small" data-tone={type}>
                <Icon name={NODE_ICON[type]} size="small" />
              </span>
              <DropdownMenu.ItemLabel>{NODE_LABEL[type]}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

/** 节点库弹层：从底部操作栏打开；拖到画布上放下节点，或点击插在选中节点之后 */
function NodeLibrary(props: { onPick: (type: WfNodeType) => void; onClose: () => void }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest?.("[data-library-toggle]") && props.onClose()
    const key = (e: KeyboardEvent) => e.key === "Escape" && props.onClose()
    window.addEventListener("pointerdown", down)
    window.addEventListener("keydown", key)
    return () => {
      window.removeEventListener("pointerdown", down)
      window.removeEventListener("keydown", key)
    }
  }, [props])
  return (
    <div ref={ref} className="workflow-library" role="dialog" aria-label={t("proto.wfn.library")} onPointerDown={(e) => e.stopPropagation()}>
      <div className="workflow-library-head">
        <span className="text-[14px] font-[500] text-text-strong">{t("proto.wfn.library")}</span>
        <span className="text-[12px] text-[var(--text-weaker)]">{t("proto.wfn.libraryHint")}</span>
      </div>
      <div className="workflow-library-grid">
        {NODE_TYPE_ORDER.map((type) => (
          <button
            key={type}
            type="button"
            className="workflow-library-item"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DRAG_TYPE, type)
              e.dataTransfer.effectAllowed = "copy"
            }}
            onClick={() => props.onPick(type)}
          >
            <span className="workflow-node-icon" data-tone={type}>
              <Icon name={NODE_ICON[type]} size="small" />
            </span>
            <span className="flex min-w-0 flex-col text-left">
              <span className="text-[13px] font-[500] leading-5 text-text-strong">{NODE_LABEL[type]}</span>
              <span className="truncate text-[12px] leading-4 text-[var(--text-weaker)]">{NODE_DESC[type]}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

export interface CanvasProps {
  graph: WfGraph
  selected?: string
  highlight: string[]
  status: Record<string, NodeRunStatus | undefined>
  /** 试运行中多出口节点实际走的出边：未走的连线不点亮 */
  chosen?: Record<string, string>
  /** 预览助手修改时，标出改动的节点 */
  proposed?: string[]
  /** 校验问题所在节点，显示红点 */
  issues?: Set<string>
  readOnly?: boolean
  /** 头部搜索选中的节点：seq 变化时移到画布中央 */
  focus?: { id: string; seq: number }
  /** 右栏开合会改变画布宽度，变化时重新适应 */
  fitKey: string
  onSelect: (id?: string) => void
  onFlash: (id: string) => void
  onCommit: (graph: WfGraph, change?: string, focus?: string) => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
}

/**
 * 工作流画布：平移、缩放、拖动节点、从下方端口拖出连线、连线中间插入节点。
 * 节点库在底部操作栏，拖到画布空白处放下（不自动连线），或点击插到选中节点之后。样式取 Build token。
 */
export function Canvas(props: CanvasProps) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<View>({ x: 0, y: 40, zoom: 1 })
  const [drag, setDrag] = useState<{ id: string; dx: number; dy: number; moved: boolean }>()
  const [link, setLink] = useState<{ from: string; x: number; y: number }>()
  const [library, setLibrary] = useState(false)
  const [dropping, setDropping] = useState(false)
  const pan = useRef<{ x: number; y: number; vx: number; vy: number }>(undefined)
  const graph = drag ? { ...props.graph, nodes: props.graph.nodes.map((n) => (n.id === drag.id ? { ...n, x: n.x + drag.dx, y: n.y + drag.dy } : n)) } : props.graph
  const byId = new Map(graph.nodes.map((n) => [n.id, n]))

  const fit = useCallback(() => {
    const el = box.current
    if (!el || !props.graph.nodes.length) return
    const b = bounds(props.graph)
    const w = el.clientWidth
    const h = el.clientHeight
    const zoom = Math.min(1.1, Math.max(0.4, Math.min((w - 80) / (b.maxX - b.minX), (h - 140) / (b.maxY - b.minY))))
    setView({ zoom, x: w / 2 - ((b.minX + b.maxX) / 2) * zoom, y: Math.max(60, h / 2 - ((b.minY + b.maxY) / 2) * zoom) })
  }, [props.graph])

  // 首次打开、右栏开合、预览助手修改时重新适应；增删节点不重新适应，避免画面跳动
  const fitRef = useRef(fit)
  fitRef.current = fit
  useLayoutEffect(() => fitRef.current(), [props.fitKey])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => fitRef.current())
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const rect = box.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left - view.x) / view.zoom, y: (e.clientY - rect.top - view.y) / view.zoom }
  }

  /** 把节点移到画布中央并选中 */
  const focusNode = (node: WfNode) => {
    const el = box.current
    if (!el) return
    const zoom = Math.max(view.zoom, 0.9)
    setView({ zoom, x: el.clientWidth / 2 - (node.x + NODE_W / 2) * zoom, y: el.clientHeight / 2 - (node.y + NODE_H / 2) * zoom })
    props.onSelect(node.id)
    props.onFlash(node.id)
  }

  const focusRef = useRef(focusNode)
  focusRef.current = focusNode
  useEffect(() => {
    const node = props.focus && props.graph.nodes.find((n) => n.id === props.focus!.id)
    if (node) focusRef.current(node)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focus?.seq])

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const rect = box.current!.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setView((v) => {
        const zoom = Math.min(2, Math.max(0.3, v.zoom * (e.deltaY > 0 ? 0.92 : 1.08)))
        return { zoom, x: px - ((px - v.x) / v.zoom) * zoom, y: py - ((py - v.y) / v.zoom) * zoom }
      })
    } else setView((v) => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }))
  }

  const onBackgroundDown = (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    pan.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: ReactPointerEvent) => {
    if (pan.current) setView((v) => ({ ...v, x: pan.current!.vx + e.clientX - pan.current!.x, y: pan.current!.vy + e.clientY - pan.current!.y }))
    if (drag) setDrag((d) => d && { ...d, dx: d.dx + e.movementX / view.zoom, dy: d.dy + e.movementY / view.zoom, moved: d.moved || Math.abs(e.movementX) + Math.abs(e.movementY) > 1 })
    if (link) setLink((l) => l && { ...l, ...toLocal(e) })
  }
  const onUp = (e: ReactPointerEvent) => {
    if (pan.current) {
      const moved = Math.abs(e.clientX - pan.current.x) + Math.abs(e.clientY - pan.current.y) > 3
      pan.current = undefined
      if (!moved) props.onSelect(undefined)
    }
    if (drag) {
      if (drag.moved && !props.readOnly) props.onCommit(graph)
      else props.onSelect(drag.id)
      setDrag(undefined)
    }
    if (link) {
      const p = toLocal(e)
      const target = graph.nodes.find((n) => p.x >= n.x && p.x <= n.x + NODE_W && p.y >= n.y - 8 && p.y <= n.y + NODE_H)
      const next = target && connect(props.graph, link.from, target.id)
      // 手工连线保留当前位置，不重新排布
      if (next) props.onCommit(next, `连接「${byId.get(link.from)?.title}」→「${target.title}」`)
      setLink(undefined)
    }
  }

  const insert = (type: WfNodeType, edgeId?: string) => {
    if (edgeId) {
      const node = defaultNode(type, nextTitle(props.graph, type))
      props.onCommit(insertOnEdge(props.graph, edgeId, node), `新增节点「${node.title}」`, node.id)
    } else {
      const { graph: next, node } = addNode(props.graph, type, props.selected)
      props.onCommit(next, `新增节点「${node.title}」`, node.id)
    }
  }

  const onDrop = (e: React.DragEvent) => {
    setDropping(false)
    const type = e.dataTransfer.getData(DRAG_TYPE) as WfNodeType
    if (!type || props.readOnly) return
    e.preventDefault()
    const p = toLocal(e)
    const { graph: next, node } = addFreeNode(props.graph, type, p.x, p.y)
    props.onCommit(next, `新增节点「${node.title}」`, node.id)
    setLibrary(false)
  }

  const zoomBy = (factor: number) => {
    const el = box.current
    if (!el) return
    const px = el.clientWidth / 2
    const py = el.clientHeight / 2
    setView((v) => {
      const zoom = Math.min(2, Math.max(0.3, v.zoom * factor))
      return { zoom, x: px - ((px - v.x) / v.zoom) * zoom, y: py - ((py - v.y) / v.zoom) * zoom }
    })
  }

  const tool = (icon: IconName, label: string, onClick: () => void, disabled?: boolean, flip?: boolean) => (
    <Tooltip value={label} placement="top" gutter={6}>
      <button type="button" className="workflow-tool" aria-label={label} disabled={disabled} onClick={onClick}>
        <Icon name={icon} size="small" className={flip ? "-scale-x-100" : undefined} />
      </button>
    </Tooltip>
  )

  return (
    <div className="workflow-canvas-shell">
      <div
        ref={box}
        className={cx("workflow-canvas", pan.current && "is-panning", dropping && "is-dropping")}
        onWheel={onWheel}
        onPointerDown={onBackgroundDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerLeave={(e) => (pan.current || drag || link) && onUp(e)}
        onDragOver={(e) => {
          if (props.readOnly || !e.dataTransfer.types.includes(DRAG_TYPE)) return
          e.preventDefault()
          e.dataTransfer.dropEffect = "copy"
          setDropping(true)
        }}
        onDragLeave={(e) => e.currentTarget === e.target && setDropping(false)}
        onDrop={onDrop}
      >
        <div className="workflow-viewport" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
          <svg className="workflow-edges" style={{ overflow: "visible" }}>
            {graph.edges.map((edge) => {
              const a = byId.get(edge.source)
              const b = byId.get(edge.target)
              if (!a || !b) return null
              const p = path(a, b, graph.nodes)
              const branch = props.chosen?.[edge.source]
              const active = props.status[edge.source] === "done" && !!props.status[edge.target] && props.status[edge.target] !== "skipped" && (!branch || edge.id === branch)
              return <path key={edge.id} d={p.d} className={cx("workflow-edge", active && "is-active")} markerEnd="url(#wf-arrow)" />
            })}
            {link && byId.get(link.from) && <path className="workflow-edge is-draft" d={`M ${byId.get(link.from)!.x + NODE_W / 2} ${byId.get(link.from)!.y + NODE_H} L ${link.x} ${link.y}`} />}
            <defs>
              <marker id="wf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--neutral-300, #c4c4c4)" />
              </marker>
            </defs>
          </svg>

          {/* 连线标签与中间的操作：悬停时出现「+」插入节点、「×」删除连线；点分支名称打开所属节点的配置 */}
          {graph.edges.map((edge) => {
            const a = byId.get(edge.source)
            const b = byId.get(edge.target)
            if (!a || !b) return null
            const p = path(a, b, graph.nodes)
            const label = edgeLabel(graph, edge)
            const incomplete = a.type === "condition" && a.config.branches?.find((x) => x.id === edge.branch)?.rules.some((r) => !r.left)
            return (
              <div key={edge.id} className="workflow-edge-mid" style={{ left: p.mx, top: p.my }} onPointerDown={(e) => e.stopPropagation()}>
                {label && (
                  <button type="button" className={cx("workflow-edge-label", props.selected === a.id && "is-selected", incomplete && "is-invalid")} onClick={() => props.onSelect(a.id)}>
                    {label}
                  </button>
                )}
                {!props.readOnly && (
                  <span className="workflow-edge-actions">
                    <NodeTypeMenu label={t("proto.wf.insertNode")} onPick={(type) => insert(type, edge.id)} />
                    <button type="button" className="workflow-edge-add" aria-label={t("proto.wf.removeEdge")} onClick={() => props.onCommit(removeEdge(props.graph, edge.id), `删除连线「${a.title}」→「${b.title}」`)}>
                      <Icon name="close-small" size="small" />
                    </button>
                  </span>
                )}
              </div>
            )
          })}

          {graph.nodes.map((node) => {
            const status = props.status[node.id]
            return (
              <div
                key={node.id}
                role="button"
                tabIndex={0}
                aria-label={`${NODE_LABEL[node.type]}：${node.title}`}
                aria-pressed={props.selected === node.id}
                className={cx("workflow-node", props.selected === node.id && "is-selected", props.highlight.includes(node.id) && "is-highlight", props.proposed?.includes(node.id) && "is-proposed", status && `is-${status}`)}
                style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  if (e.button !== 0) return
                  setDrag({ id: node.id, dx: 0, dy: 0, moved: false })
                }}
                onKeyDown={(e) => e.key === "Enter" && props.onSelect(node.id)}
              >
                <span className="workflow-port is-in" aria-hidden="true" />
                <div className="workflow-node-head">
                  <span className="workflow-node-icon" data-tone={node.type}>
                    <Icon name={NODE_ICON[node.type]} size="small" />
                  </span>
                  <span className="workflow-node-title" title={node.title}>
                    {node.title}
                  </span>
                  {status === "running" && <Icon name="loading" size="small" className="animate-spin text-[var(--primary-600)] shrink-0" />}
                  {status === "done" && <Icon name="circle-check-16" size="small" className="text-[var(--success-600,#08a85b)] shrink-0" />}
                  {status === "waiting" && <span className="workflow-node-badge">{t("proto.wf.waiting")}</span>}
                  {status === "error" && <span className="workflow-node-badge is-error">{t("proto.wf.failed")}</span>}
                  {!status && node.type === "tool" && node.config.write && <span className="workflow-node-badge is-write">{t("proto.wf.tool.writeShort")}</span>}
                  {!status && props.issues?.has(node.id) && <span className="workflow-node-dot" aria-label={t("proto.wf.hasIssue")} />}
                </div>
                <div className="workflow-node-sub" title={nodeSummary(node, graph)}>
                  {nodeSummary(node, graph)}
                </div>
                {!props.readOnly && node.type !== "end" && (
                  <Tooltip value={t("proto.wfn.portHint")} placement="bottom" gutter={8}>
                    <span
                      className="workflow-port"
                      aria-label={t("proto.wfn.portHint")}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        setLink({ from: node.id, ...toLocal(e) })
                      }}
                    />
                  </Tooltip>
                )}
              </div>
            )
          })}
        </div>

        {library && !props.readOnly && (
          <NodeLibrary
            onClose={() => setLibrary(false)}
            onPick={(type) => {
              insert(type)
              setLibrary(false)
            }}
          />
        )}

        <div className="workflow-toolbar" onPointerDown={(e) => e.stopPropagation()}>
          {!props.readOnly && (
            <>
              <button type="button" data-library-toggle className={cx("workflow-tool is-text", library && "is-active")} aria-expanded={library} onClick={() => setLibrary((x) => !x)}>
                <Icon name="plus-16" size="small" />
                {t("proto.wfn.addNode")}
              </button>
              <span className="workflow-toolbar-sep" />
              {tool("undo", t("proto.wf.undo"), props.onUndo, !props.canUndo)}
              {tool("undo", t("proto.wf.redo"), props.onRedo, !props.canRedo, true)}
              <span className="workflow-toolbar-sep" />
            </>
          )}
          {tool("dash", t("proto.wf.zoomOut"), () => zoomBy(0.85))}
          <span className="workflow-zoom">{Math.round(view.zoom * 100)}%</span>
          {tool("plus-16", t("proto.wf.zoomIn"), () => zoomBy(1.15))}
          {tool("expand", t("proto.wf.fit"), fit)}
          {!props.readOnly && <span className="workflow-toolbar-sep" />}
          {!props.readOnly &&
            tool("grid-16", t("proto.wf.tidy"), () => {
              props.onCommit(autoLayout(props.graph), "整理布局")
              requestAnimationFrame(() => fitRef.current())
            })}
        </div>
        {!props.readOnly && props.graph.nodes.length <= 2 && <p className="workflow-canvas-hint">{t("proto.wfn.emptyHint")}</p>}
      </div>
    </div>
  )
}
