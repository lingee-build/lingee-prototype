import { autoLayout, NODE_TYPE_ORDER, type WfGraph, type WfNodeType } from "@/mock/fixtures/workflow-graphs"

/** 工作流定义（DSL）的格式标识：「导出定义」写出这个格式，「导入」读入它 */
export const DSL_FORMAT = "lingee-workflow/v1"

export interface WorkflowDsl {
  format?: string
  name?: string
  desc?: string
  graph: WfGraph
}

const TYPES = new Set<WfNodeType>(["start", "end", ...NODE_TYPE_ORDER])

/** 生成导出内容：名称、说明 + 画布定义 */
export const toDsl = (input: { name: string; desc?: string; graph: WfGraph }): WorkflowDsl => ({ format: DSL_FORMAT, name: input.name, desc: input.desc, graph: input.graph })

/**
 * 解析导入的 DSL 文本。兼容两种写法：完整 DSL（{ format, name, desc, graph }）或只有画布（{ nodes, edges }）。
 * 结构不对时抛出具体原因，界面直接展示给用户。
 */
export function parseDsl(text: string): WorkflowDsl {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("文件不是有效的 JSON")
  }
  if (!data || typeof data !== "object") throw new Error("文件内容为空")
  const raw = data as Partial<WorkflowDsl> & Partial<WfGraph>
  const graph = (raw.graph ?? raw) as Partial<WfGraph>
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw new Error("缺少 nodes 或 edges")

  const ids = new Set<string>()
  for (const node of graph.nodes) {
    if (!node || typeof node.id !== "string" || !node.id) throw new Error("有节点缺少 id")
    if (ids.has(node.id)) throw new Error(`节点 id「${node.id}」重复`)
    ids.add(node.id)
    if (!TYPES.has(node.type)) throw new Error(`节点「${node.title ?? node.id}」的类型「${String(node.type)}」不支持`)
  }
  const starts = graph.nodes.filter((n) => n.type === "start").length
  if (starts !== 1) throw new Error(starts ? "只能有一个开始节点" : "缺少开始节点")
  if (!graph.nodes.some((n) => n.type === "end")) throw new Error("缺少结束节点")
  for (const edge of graph.edges) {
    if (!edge || !ids.has(edge.source) || !ids.has(edge.target)) throw new Error("有连线指向不存在的节点")
  }

  // 补齐缺省字段；没有坐标时自动排布
  const nodes = graph.nodes.map((n) => ({ ...n, title: n.title || n.id, x: Number(n.x) || 0, y: Number(n.y) || 0, config: n.config ?? {} }))
  const edges = graph.edges.map((e, i) => ({ ...e, id: e.id || `e_import_${i}` }))
  const positioned = nodes.some((n) => n.x !== 0 || n.y !== 0)
  const result: WfGraph = positioned ? { nodes, edges } : autoLayout({ nodes, edges })
  return { format: raw.format, name: typeof raw.name === "string" ? raw.name.trim() : undefined, desc: typeof raw.desc === "string" ? raw.desc : undefined, graph: result }
}
