import { autoLayout, DEFAULT_BRANCH, defaultNode, fieldLabel, newId, NODE_H, NODE_W, producesOf, RULE_OPS, type WfEdge, type WfGraph, type WfNode, type WfNodeType, type WfRule } from "@/mock/fixtures/workflow-graphs"
import { snapshot } from "@/stores/workflow-docs"

const edgeId = (source: string, target: string) => `e_${source}_${target}_${Math.random().toString(36).slice(2, 6)}`

export const NODE_LABEL: Record<WfNodeType, string> = {
  start: "开始",
  end: "结束",
  agent: "智能体",
  tool: "MCP 工具",
  code: "代码",
  condition: "条件",
  parallel: "并行",
  join: "并行汇入",
  loop: "循环",
  human: "人工输入",
}

/** 节点库里每种节点的一句话说明 */
export const NODE_DESC: Partial<Record<WfNodeType, string>> = {
  agent: "调用智能体或单次模型处理任务",
  tool: "调用 MCP 服务提供的工具",
  code: "运行一段 Python 函数",
  condition: "按条件选择分支，首个命中生效",
  parallel: "多条分支同时执行",
  join: "等待并行分支全部完成后继续",
  human: "交给办理人填写表单并选择动作",
  loop: "按集合逐项或按条件重复执行",
}

/** 新节点默认名称：同类型已有时追加序号 */
export function nextTitle(graph: WfGraph, type: WfNodeType) {
  const base = type === "tool" ? "调用工具" : NODE_LABEL[type]
  let title = base
  for (let i = 2; graph.nodes.some((n) => n.title === title); i++) title = `${base} ${i}`
  return title
}

/** 节点的出口：多出口节点每个分支一个，其他节点只有一个（id 为 undefined） */
export interface Outlet {
  id?: string
  label: string
  edge?: WfEdge
}

export function outletsOf(graph: WfGraph, node: WfNode): Outlet[] {
  const out = graph.edges.filter((e) => e.source === node.id)
  const find = (id: string) => out.find((e) => e.branch === id)
  const c = node.config
  if (node.type === "end") return []
  if (node.type === "parallel") return out.map((e) => ({ id: e.id, label: e.label ?? "", edge: e }))
  if (node.type === "condition") return [...(c.branches ?? []).map((b) => ({ id: b.id, label: b.label, edge: find(b.id) })), { id: DEFAULT_BRANCH, label: "默认", edge: find(DEFAULT_BRANCH) }]
  if (node.type === "human") return (c.actions ?? []).map((a) => ({ id: a.id, label: a.name, edge: find(a.id) }))
  if (node.type === "agent" && c.intent) return (c.candidates ?? []).map((x, i) => ({ id: x.id, label: x.guide || `候选 ${i + 1}`, edge: find(x.id) }))
  return [{ label: "下一步", edge: out[0] }]
}

/** 画布连线上显示的名称 */
export function edgeLabel(graph: WfGraph, edge: WfEdge) {
  const source = graph.nodes.find((n) => n.id === edge.source)
  if (!source) return undefined
  if (source.type === "parallel") return edge.label
  if (!edge.branch) return undefined
  if (edge.branch === DEFAULT_BRANCH) return "默认"
  return outletsOf(graph, source).find((o) => o.id === edge.branch)?.label
}

const reaches = (graph: WfGraph, from: string, to: string) => {
  const seen = new Set<string>()
  const stack = [from]
  while (stack.length) {
    const id = stack.pop()!
    if (id === to) return true
    if (seen.has(id)) continue
    seen.add(id)
    stack.push(...graph.edges.filter((e) => e.source === id).map((e) => e.target))
  }
  return false
}

/** 「下一步 / 命中后前往」可选的目标：不能是自己、开始，也不能成环 */
export function nextOptions(graph: WfGraph, nodeId: string) {
  return graph.nodes.filter((n) => n.id !== nodeId && n.type !== "start" && !reaches(graph, n.id, nodeId))
}

/** 设置某个出口的目标；target 为空表示「未连接」 */
export function setNext(graph: WfGraph, nodeId: string, branch: string | undefined, target: string): WfGraph {
  const rest = graph.edges.filter((e) => !(e.source === nodeId && (branch === undefined ? !e.branch : e.branch === branch)))
  if (!target) return { ...graph, edges: rest }
  return { ...graph, edges: [...rest, { id: edgeId(nodeId, target), source: nodeId, target, branch }] }
}

/** 新节点自己的出边：多出口节点接到第一个出口（条件接默认出口） */
const outEdgeFor = (node: WfNode, target: string): WfEdge => {
  const id = edgeId(node.id, target)
  if (node.type === "condition") return { id, source: node.id, target, branch: DEFAULT_BRANCH }
  if (node.type === "human") return { id, source: node.id, target, branch: node.config.actions?.[0]?.id }
  if (node.type === "parallel") return { id, source: node.id, target, label: "分支 1" }
  return { id, source: node.id, target }
}

/** 在一条连线中间插入节点：原连线的分支信息留在上半段 */
export function insertOnEdge(graph: WfGraph, id: string, node: WfNode): WfGraph {
  const target = graph.edges.find((e) => e.id === id)
  if (!target) return graph
  const edges = graph.edges.flatMap((e) => (e.id === id ? [{ ...e, id: edgeId(e.source, node.id), target: node.id }, outEdgeFor(node, target.target)] : [e]))
  return autoLayout({ nodes: [...graph.nodes, node], edges })
}

export function insertAfter(graph: WfGraph, afterId: string, node: WfNode): WfGraph {
  const out = graph.edges.find((e) => e.source === afterId)
  if (out) return insertOnEdge(graph, out.id, node)
  return autoLayout({ nodes: [...graph.nodes, node], edges: [...graph.edges, { id: edgeId(afterId, node.id), source: afterId, target: node.id }] })
}

/** 没指定位置时插在「结束」之前 */
export function insertBeforeEnd(graph: WfGraph, node: WfNode): WfGraph {
  const end = graph.nodes.find((n) => n.type === "end")
  const into = end ? graph.edges.find((e) => e.target === end.id) : undefined
  return into ? insertOnEdge(graph, into.id, node) : autoLayout({ nodes: [...graph.nodes, node], edges: graph.edges })
}

export function addNode(graph: WfGraph, type: WfNodeType, after?: string, title?: string) {
  const node = defaultNode(type, title ?? nextTitle(graph, type))
  const anchor = after && graph.nodes.find((n) => n.id === after && n.type !== "end")
  return { graph: anchor ? insertAfter(graph, anchor.id, node) : insertBeforeEnd(graph, node), node }
}

/** 从节点库拖到画布空白处：只放下节点，不自动连线，由用户从端口拖出连线 */
export function addFreeNode(graph: WfGraph, type: WfNodeType, x: number, y: number) {
  const node = { ...defaultNode(type, nextTitle(graph, type)), x: x - NODE_W / 2, y: y - NODE_H / 2 }
  return { graph: { ...graph, nodes: [...graph.nodes, node] }, node }
}

/** 删除节点：上游接到它的第一个下游，并清掉下游对它输出的引用 */
export function removeNode(graph: WfGraph, id: string): WfGraph {
  const incoming = graph.edges.filter((e) => e.target === id)
  const next = graph.edges.find((e) => e.source === id)?.target
  const rest = graph.edges.filter((e) => e.source !== id && e.target !== id)
  const bridges = next ? incoming.filter((a) => !rest.some((e) => e.source === a.source && e.target === next)).map((a) => ({ ...a, id: edgeId(a.source, next), target: next })) : []
  const unref = (inputs?: { name: string; source?: string; value?: string }[]) => inputs?.map((i) => (i.source?.startsWith(`${id}.`) ? { ...i, source: undefined } : i))
  const nodes = graph.nodes.filter((n) => n.id !== id).map((n) => ({ ...n, config: { ...n.config, inputs: unref(n.config.inputs), results: unref(n.config.results) } }))
  return autoLayout({ nodes, edges: [...rest, ...bridges] })
}

/**
 * 从端口拖出连线：
 * - 单出口节点：替换原来的下一步
 * - 并行：新增一条分支
 * - 条件 / 人工输入 / 按意图选下一步的智能体：接到第一个未连接的出口，没有就新增一个出口
 * 不连自己、不重复、不成环、结束不能连出、开始不能被连入。
 */
export function connect(graph: WfGraph, source: string, target: string): WfGraph | undefined {
  const s = graph.nodes.find((n) => n.id === source)
  const t = graph.nodes.find((n) => n.id === target)
  if (!s || !t || source === target || s.type === "end" || t.type === "start") return undefined
  if (graph.edges.some((e) => e.source === source && e.target === target) || reaches(graph, target, source)) return undefined
  if (s.type === "parallel") {
    const count = graph.edges.filter((e) => e.source === source).length
    return { ...graph, edges: [...graph.edges, { id: edgeId(source, target), source, target, label: `分支 ${count + 1}` }] }
  }
  const c = s.config
  const multi = s.type === "condition" || s.type === "human" || (s.type === "agent" && c.intent)
  if (!multi) return setNext(graph, source, undefined, target)
  const free = outletsOf(graph, s).find((o) => !o.edge && o.id)
  if (free) return setNext(graph, source, free.id, target)
  const id = newId("br")
  const patch =
    s.type === "condition"
      ? { branches: [...(c.branches ?? []), { id, label: `分支 ${(c.branches?.length ?? 0) + 1}`, logic: "and" as const, rules: [{ left: "", op: "is" as const, right: "" }] }] }
      : s.type === "human"
        ? { actions: [...(c.actions ?? []), { id, name: `动作 ${(c.actions?.length ?? 0) + 1}` }] }
        : { candidates: [...(c.candidates ?? []), { id, guide: "" }] }
  return setNext(patchNode(graph, source, { config: patch }), source, id, target)
}

export function removeEdge(graph: WfGraph, id: string): WfGraph {
  return { ...graph, edges: graph.edges.filter((e) => e.id !== id) }
}

export function patchEdge(graph: WfGraph, id: string, patch: Partial<WfEdge>): WfGraph {
  return { ...graph, edges: graph.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)) }
}

export function patchNode(graph: WfGraph, id: string, patch: Partial<WfNode>): WfGraph {
  return { ...graph, nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...patch, config: { ...n.config, ...patch.config } } : n)) }
}

/** 删除多出口节点的一个出口：同时删掉它的连线 */
export function removeOutlet(graph: WfGraph, nodeId: string, outletId: string, patch: Partial<WfNode["config"]>): WfGraph {
  const next = patchNode(graph, nodeId, { config: patch })
  return { ...next, edges: next.edges.filter((e) => !(e.source === nodeId && e.branch === outletId)) }
}

/* ---------- 并行段：分支 → 汇入 ---------- */

/** 沿一条并行分支往下走，直到遇到并行汇入；返回分支内的节点和汇入节点 */
export function branchPath(graph: WfGraph, edge: WfEdge) {
  const nodes: WfNode[] = []
  let current = graph.nodes.find((n) => n.id === edge.target)
  const seen = new Set<string>()
  while (current && current.type !== "join" && !seen.has(current.id)) {
    seen.add(current.id)
    nodes.push(current)
    const next = graph.edges.find((e) => e.source === current!.id)
    current = next ? graph.nodes.find((n) => n.id === next.target) : undefined
  }
  return { nodes, join: current?.type === "join" ? current : undefined }
}

/** 并行节点对应的唯一汇入节点 */
export function joinOf(graph: WfGraph, parallelId: string) {
  for (const e of graph.edges.filter((x) => x.source === parallelId)) {
    const join = branchPath(graph, e).join
    if (join) return join
  }
  return undefined
}

/** 并行汇入所属的并行节点 */
export function parallelOf(graph: WfGraph, joinId: string) {
  return graph.nodes.find((n) => n.type === "parallel" && joinOf(graph, n.id)?.id === joinId)
}

/** 在某条分支末尾（汇入之前）加一个节点 */
export function appendToBranch(graph: WfGraph, branchEdgeId: string, type: WfNodeType) {
  const edge = graph.edges.find((e) => e.id === branchEdgeId)
  if (!edge) return undefined
  const { nodes, join } = branchPath(graph, edge)
  const last = nodes[nodes.length - 1]
  const into = last && join ? graph.edges.find((e) => e.source === last.id && e.target === join.id) : join ? edge : undefined
  if (!into) return undefined
  const node = defaultNode(type, nextTitle(graph, type))
  return { graph: insertOnEdge(graph, into.id, node), node }
}

/** 增加一条并行分支：并行 → 新智能体节点 → 汇入 */
export function addParallelBranch(graph: WfGraph, parallelId: string) {
  const join = joinOf(graph, parallelId)
  if (!join) return undefined
  const count = graph.edges.filter((e) => e.source === parallelId).length
  const node = defaultNode("agent", nextTitle(graph, "agent"))
  return {
    graph: autoLayout({
      nodes: [...graph.nodes, node],
      edges: [...graph.edges, { id: edgeId(parallelId, node.id), source: parallelId, target: node.id, label: `分支 ${count + 1}` }, { id: edgeId(node.id, join.id), source: node.id, target: join.id }],
    }),
    node,
  }
}

/** 减少一条并行分支：删除最后一条分支及分支内的节点 */
export function removeParallelBranch(graph: WfGraph, parallelId: string) {
  const out = graph.edges.filter((e) => e.source === parallelId)
  const last = out[out.length - 1]
  if (!last || out.length <= 2) return undefined
  const ids = new Set(branchPath(graph, last).nodes.map((n) => n.id))
  return autoLayout({ nodes: graph.nodes.filter((n) => !ids.has(n.id)), edges: graph.edges.filter((e) => e.id !== last.id && !ids.has(e.source) && !ids.has(e.target)) })
}

/* ---------- 引用 ---------- */

/** 所有上游节点（可被引用输出的节点） */
export function upstream(graph: WfGraph, id: string): WfNode[] {
  const seen = new Set<string>()
  const stack = graph.edges.filter((e) => e.target === id).map((e) => e.source)
  while (stack.length) {
    const next = stack.pop()!
    if (seen.has(next)) continue
    seen.add(next)
    stack.push(...graph.edges.filter((e) => e.target === next).map((e) => e.source))
  }
  return graph.nodes.filter((n) => seen.has(n.id))
}

/** 引用选项：上游每个节点的每个输出字段，显示为「节点 · 字段」 */
export function refOptions(graph: WfGraph, id: string) {
  return upstream(graph, id).flatMap((n) => producesOf(n).map((f) => ({ value: `${n.id}.${f}`, label: `${n.title} · ${fieldLabel(n, f)}`, desc: n.type === "start" ? "业务输入" : NODE_LABEL[n.type] })))
}

export function refLabel(graph: WfGraph, ref?: string) {
  if (!ref) return ""
  const [nodeId, ...rest] = ref.split(".")
  const node = graph.nodes.find((n) => n.id === nodeId)
  return node ? `${node.title} · ${fieldLabel(node, rest.join("."))}` : `${ref}（已失效）`
}

export const ruleText = (graph: WfGraph, rule: WfRule) => `${refLabel(graph, rule.left) || "未选择"} ${RULE_OPS.find((x) => x.value === rule.op)?.label ?? ""} ${rule.right || "—"}`

export interface Issue {
  nodeId?: string
  edgeId?: string
  message: string
}

/**
 * 校验分两档（方案 5.3）：
 * - light：保存时。名称必填、需要选能力的节点已选
 * - full：试运行、提交时。追加：至少一个步骤、连线完整、出口都已连接、分支条件、必填入参说明、引用有效、人工输入表单、循环配置
 */
export function validate(graph: WfGraph, level: "light" | "full"): Issue[] {
  const issues: Issue[] = []
  for (const node of graph.nodes) {
    const c = node.config
    if (!node.title.trim()) issues.push({ nodeId: node.id, message: `有一个${NODE_LABEL[node.type]}节点没有名称` })
    if (node.type === "agent" && c.mode !== "single" && !c.agentRef) issues.push({ nodeId: node.id, message: `「${node.title}」未绑定智能体` })
    if (node.type === "tool" && (!c.mcpServer || !c.mcpTool)) issues.push({ nodeId: node.id, message: `「${node.title}」未选择 MCP 服务或工具` })
  }
  if (level === "light") return issues

  if (!graph.nodes.some((n) => !["start", "end"].includes(n.type))) issues.push({ message: "至少需要一个步骤" })
  for (const node of graph.nodes) {
    const c = node.config
    if (node.type !== "start" && !graph.edges.some((e) => e.target === node.id)) issues.push({ nodeId: node.id, message: `「${node.title}」未连接到开始路径` })
    for (const outlet of outletsOf(graph, node))
      if (!outlet.edge) issues.push({ nodeId: node.id, message: outlet.id ? `「${node.title}」的出口「${outlet.label}」未连接` : `「${node.title}」缺少后续连接` })
    if (node.type === "start")
      for (const p of c.params ?? []) if (p.required && !p.desc.trim()) issues.push({ nodeId: node.id, message: `必填入参「${p.name}」缺少参数说明` })
    const valid = new Set(refOptions(graph, node.id).map((o) => o.value))
    for (const input of [...(c.inputs ?? []), ...(c.results ?? [])])
      if (input.source && !valid.has(input.source)) issues.push({ nodeId: node.id, message: `「${node.title}」的输入「${input.name}」引用已失效` })
    if (node.type === "condition")
      for (const b of c.branches ?? []) if (!b.rules.length || b.rules.some((r) => !r.left)) issues.push({ nodeId: node.id, message: `「${node.title}」的分支「${b.label}」条件不完整` })
    if (node.type === "agent" && c.intent && !c.candidates?.length) issues.push({ nodeId: node.id, message: `「${node.title}」没有候选出口` })
    if (node.type === "parallel") {
      if (graph.edges.filter((e) => e.source === node.id).length < 2) issues.push({ nodeId: node.id, message: `「${node.title}」至少需要两条分支` })
      if (!joinOf(graph, node.id)) issues.push({ nodeId: node.id, message: `「${node.title}」没有对应的并行汇入` })
    }
    if (node.type === "human") {
      if (!c.fields?.length) issues.push({ nodeId: node.id, message: `「${node.title}」没有表单字段` })
      if (!c.actions?.length) issues.push({ nodeId: node.id, message: `「${node.title}」没有动作` })
    }
    if (node.type === "loop") {
      if (c.loopMode !== "condition" && !c.collection) issues.push({ nodeId: node.id, message: `「${node.title}」未选择集合输入` })
      if (c.loopMode === "condition" && !c.exitLeft) issues.push({ nodeId: node.id, message: `「${node.title}」未设置退出条件` })
      if (!c.body?.length) issues.push({ nodeId: node.id, message: `「${node.title}」内部流程没有步骤` })
    }
  }
  return issues
}

export const writeSteps = (graph: WfGraph) => graph.nodes.filter((n) => n.type === "tool" && n.config.write)
export const humanSteps = (graph: WfGraph) => graph.nodes.filter((n) => n.type === "human")
export const toolName = (node: WfNode) => [node.config.mcpServer, node.config.mcpTool].filter(Boolean).join(" · ")

/** 依赖对象：引用的智能体、技能、MCP 工具（提交清单里标明不重复审核） */
export function dependencies(graph: WfGraph) {
  const list: Array<{ name: string; kind: string }> = []
  const add = (name: string | undefined, kind: string) => name && !list.some((x) => x.name === name) && list.push({ name, kind })
  for (const n of graph.nodes) {
    if (n.type === "agent" && n.config.mode !== "single") {
      add(n.config.agentRef, "智能体")
      add(n.config.skillRef, "技能")
    }
    if (n.type === "tool") add(toolName(n), "MCP 工具")
    for (const s of n.config.body ?? []) if (s.type !== "code") add(s.ref, s.type === "agent" ? "智能体" : "MCP 工具")
  }
  return list
}

/** 两版定义的差异，用于提交清单的变更说明 */
export function diff(before: WfGraph | undefined, after: WfGraph): string[] {
  if (!before) return ["首次提交"]
  const lines: string[] = []
  const prev = new Map(before.nodes.map((n) => [n.id, n]))
  const next = new Map(after.nodes.map((n) => [n.id, n]))
  for (const n of after.nodes) if (!prev.has(n.id)) lines.push(`新增节点「${n.title}」`)
  for (const n of before.nodes) if (!next.has(n.id)) lines.push(`删除节点「${n.title}」`)
  for (const n of after.nodes) {
    const p = prev.get(n.id)
    if (p && snapshot({ nodes: [p], edges: [] }) !== snapshot({ nodes: [n], edges: [] })) lines.push(n.type === "start" ? "调整流程入参" : `修改节点「${n.title}」`)
  }
  const edgeKey = (g: WfGraph) => JSON.stringify(g.edges.map(({ id: _id, ...e }) => e).sort((a, b) => `${a.source}${a.target}`.localeCompare(`${b.source}${b.target}`)))
  if (edgeKey(before) !== edgeKey(after)) lines.push("调整节点连接或出口")
  return lines
}

export function paramsChanged(before: WfGraph | undefined, after: WfGraph) {
  const params = (g?: WfGraph) => JSON.stringify(g?.nodes.find((n) => n.type === "start")?.config.params ?? [])
  return !!before && params(before) !== params(after)
}
