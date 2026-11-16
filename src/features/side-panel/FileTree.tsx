import { useState } from "react"
import { FileIcon, Icon } from "@/ui"
import { cx } from "@/lib/cx"
import type { FileDiff } from "@/mock/fixtures/files"
import type { TreeNode } from "./file-tree-model"

type Kind = FileDiff["kind"]

const KIND_COLOR: Record<Kind, string> = {
  add: "var(--icon-diff-add-base)",
  del: "var(--icon-diff-delete-base)",
  mix: "var(--icon-diff-modified-base)",
}
const ROW =
  "w-full min-w-0 h-6 flex items-center justify-start gap-x-1.5 rounded-full px-1.5 py-0 text-left hover:bg-[var(--filetree-row-hover)] active:bg-[var(--filetree-row-hover)] transition-colors cursor-pointer"

const rowPadding = (level: number, type: TreeNode["type"]) => Math.max(0, 8 + level * 12 - (type === "file" ? 24 : 4))

/** 目录有变更 = 其下任一文件有变更（统一按「修改」色显示） */
const kindOf = (node: TreeNode, kinds: Map<string, Kind>): Kind | undefined =>
  node.type === "file" ? kinds.get(node.path) : node.children.some((child) => kindOf(child, kinds)) ? "mix" : undefined

function Label(props: { name: string; kind?: Kind }) {
  return (
    <span
      className={cx("flex-1 min-w-0 text-12-medium whitespace-nowrap truncate", !props.kind && "text-text-weak")}
      style={props.kind ? { color: KIND_COLOR[props.kind] } : undefined}
      title={props.name}
    >
      {props.name}
    </span>
  )
}

function Directory(props: TreeProps & { node: TreeNode; level: number }) {
  // 筛选时默认全部展开，方便直接看到命中的文件
  const [expanded, setExpanded] = useState(props.level === 0 || props.filtering)
  const open = expanded || props.filtering
  return (
    <div data-component="collapsible" data-variant="ghost" className="w-full" data-scope="filetree">
      <button
        type="button"
        className={ROW}
        style={{ paddingLeft: rowPadding(props.level, "directory") }}
        data-path={props.node.path}
        onClick={() => setExpanded(!open)}
      >
        <div className="size-4 flex items-center justify-center text-icon-weak">
          <Icon name={open ? "chevron-down-16" : "chevron-right-16"} size="small" />
        </div>
        <Label name={props.node.name} kind={kindOf(props.node, props.kinds)} />
      </button>
      {open && (
        <div data-slot="collapsible-content" className="relative pt-0.5">
          <div
            className="absolute top-0 bottom-0 w-px pointer-events-none bg-border-weak-base opacity-0 transition-opacity duration-150 ease-out motion-reduce:transition-none group-hover/filetree:opacity-50"
            style={{ left: Math.max(0, 8 + props.level * 12 - 4) + 8 }}
          />
          <Nodes {...props} nodes={props.node.children} level={props.level + 1} />
        </div>
      )}
    </div>
  )
}

interface TreeProps {
  kinds: Map<string, Kind>
  activePath?: string
  filtering: boolean
  onFileClick: (path: string) => void
}

function Nodes(props: TreeProps & { nodes: TreeNode[]; level: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      {props.nodes.map((node) => {
        if (node.type === "directory") return <Directory key={node.path} {...props} node={node} />
        const kind = props.kinds.get(node.path)
        return (
          <button
            key={node.path}
            type="button"
            className={cx(ROW, props.activePath === node.path && "bg-[var(--filetree-row-selected)]")}
            style={{ paddingLeft: rowPadding(props.level, "file") }}
            data-path={node.path}
            onClick={() => props.onFileClick(node.path)}
          >
            <div className="w-4 shrink-0" />
            {kind ? (
              <FileIcon node={node} className="size-4 filetree-icon filetree-icon--mono" style={{ color: KIND_COLOR[kind] }} mono />
            ) : (
              // 平时单色，鼠标移入文件树后整体切成彩色
              <span className="filetree-iconpair size-4">
                <FileIcon node={node} className="size-4 filetree-icon filetree-icon--color opacity-0 group-hover/filetree:opacity-100" />
                <FileIcon node={node} className="size-4 filetree-icon filetree-icon--mono group-hover/filetree:opacity-0" mono />
              </span>
            )}
            <Label name={node.name} kind={kind} />
          </button>
        )
      })}
    </div>
  )
}

/** 文件树：根节点是项目名，文件名按变更类型着色（新增 / 修改 / 删除） */
export function FileTree(props: TreeProps & { rootLabel: string; nodes: TreeNode[] }) {
  return (
    <div className="pt-1 px-1 pb-3">
      <Directory {...props} level={0} node={{ name: props.rootLabel, path: "", type: "directory", children: props.nodes }} />
    </div>
  )
}
