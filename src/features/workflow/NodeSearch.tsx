import { useMemo, useState } from "react"
import { Icon, Search } from "@/ui"
import { useT } from "@/i18n"
import type { WfGraph, WfNode } from "@/mock/fixtures/workflow-graphs"
import { NODE_ICON } from "./Canvas"
import { NODE_LABEL, toolName } from "./graph-ops"

/** 头部操作栏里的节点搜索：按名称、类型、绑定的能力匹配，选中后画布定位到节点 */
export function NodeSearch(props: { graph: WfGraph; onPick: (node: WfNode) => void }) {
  const t = useT()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const q = query.trim().toLowerCase()
  const hits = useMemo(
    () => (q ? props.graph.nodes.filter((n) => `${n.title} ${NODE_LABEL[n.type]} ${n.config.agentRef ?? ""} ${toolName(n)}`.toLowerCase().includes(q)).slice(0, 8) : []),
    [props.graph, q],
  )
  const pick = (node: WfNode) => {
    props.onPick(node)
    setOpen(false)
  }
  return (
    <div className="workflow-search" onPointerDown={(e) => e.stopPropagation()} onWheel={(e) => e.stopPropagation()}>
      <Search
        value={query}
        placeholder={t("proto.wfn.search")}
        aria-label={t("proto.wfn.search")}
        onChange={(v) => {
          setQuery(v)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => e.key === "Enter" && hits[0] && pick(hits[0])}
      />
      {open && q && (
        <div className="workflow-search-list" role="listbox">
          {hits.map((n) => (
            <button key={n.id} type="button" role="option" aria-selected={false} className="workflow-search-item" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(n)}>
              <span className="workflow-node-icon is-small" data-tone={n.type}>
                <Icon name={NODE_ICON[n.type]} size="small" />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-text-strong">{n.title}</span>
              <span className="shrink-0 text-[12px] text-[var(--text-weaker)]">{NODE_LABEL[n.type]}</span>
            </button>
          ))}
          {!hits.length && <p className="workflow-hint px-3 py-2">{t("proto.wfn.searchEmpty")}</p>}
        </div>
      )}
    </div>
  )
}
