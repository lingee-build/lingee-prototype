import { DEFAULT_BRANCH, fieldLabel, producesOf, type WfGraph, type WfNode, type WfRule } from "@/mock/fixtures/workflow-graphs"
import { useWorkflowEditor, type RunRecord, type RunStep } from "./editor-store"
import { outletsOf, refLabel, toolName } from "./graph-ops"

/**
 * 试运行的本地模拟（沙箱）：按连线推进，分支并行；条件按有序分支取首个命中，否则走默认出口；
 * 人工输入停下等待办理，按所选动作走对应出口；写操作工具若绑定的是只读账号会失败，可「重试该步骤并继续」。
 * 智能体和单次模型步骤按模拟用量记 Token。不调用任何真实 MCP 服务或模型。
 */
interface Controller {
  runId: string
  alive: boolean
  resumeHuman?: (output: Record<string, string>) => void
  retry?: () => void
}

let current: Controller | undefined
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const uid = () => `run_${Date.now().toString(36)}`
const between = (min: number, max: number) => Math.round(min + Math.random() * (max - min))

export interface RunOptions {
  graph: WfGraph
  inputs: Record<string, string>
  /** 读取最新的运行绑定：失败后改了账号再重试要生效 */
  runtime: () => Record<string, string>
  handlerOf: (node: WfNode) => string
  onFinish: (run: RunRecord) => void
}

export function stopRun() {
  const c = current
  if (!c) return
  c.alive = false
  useWorkflowEditor.getState().patchRun(c.runId, (run) => ({
    ...run,
    status: "stopped",
    endedAt: Date.now(),
    waitingNode: undefined,
    steps: run.steps.map((s) => (s.status === "running" || s.status === "waiting" ? { ...s, status: "error", output: "已停止", endedAt: Date.now() } : s)),
  }))
  current = undefined
}

/** 人工输入办理：values 里的 __action 是所选动作 id */
export const handleHumanTask = (values: Record<string, string>) => current?.resumeHuman?.(values)
export const retryFailed = () => current?.retry?.()

function evaluate(rule: WfRule, values: Map<string, string>) {
  const left = values.get(rule.left) ?? ""
  const num = (x: string) => Number.parseFloat(x.replace(/[^\d.-]/g, ""))
  switch (rule.op) {
    case "is":
    case "eq":
      return left === rule.right
    case "isNot":
    case "neq":
      return left !== rule.right
    case "gt":
      return num(left) > num(rule.right)
    case "lt":
      return num(left) < num(rule.right)
    case "gte":
      return num(left) >= num(rule.right)
    case "lte":
      return num(left) <= num(rule.right)
  }
}

/** 本步骤的模拟 Token 用量：完整智能体 > 单次模型；循环按轮次累计内部智能体步骤 */
function tokensOf(node: WfNode, rounds = 0) {
  if (node.type === "agent") return node.config.mode === "single" ? between(600, 1100) : between(1800, 3200)
  if (node.type === "loop") return rounds * (node.config.body ?? []).filter((b) => b.type === "agent").length * between(700, 1000)
  return 0
}

export function startRun(options: RunOptions) {
  if (current) stopRun()
  const { graph, inputs, runtime } = options
  const controller: Controller = { runId: uid(), alive: true }
  current = controller
  const editor = useWorkflowEditor.getState()
  editor.upsertRun({ id: controller.runId, status: "running", steps: [], startedAt: Date.now(), inputs, taken: {} })
  const patch = (fn: (run: RunRecord) => RunRecord) => useWorkflowEditor.getState().patchRun(controller.runId, fn)
  const patchStep = (nodeId: string, p: Partial<RunStep>) => patch((run) => ({ ...run, steps: run.steps.map((s) => (s.nodeId === nodeId ? { ...s, ...p } : s)) }))

  const values = new Map<string, string>() // 节点id.字段 → 值
  const takenEdge = new Map<string, boolean>()
  const started = new Set<string>()
  const incoming = (id: string) => graph.edges.filter((e) => e.target === id)
  const outgoing = (id: string) => graph.edges.filter((e) => e.source === id)
  const valueOf = (source?: string, fixed?: string) => (source ? (values.get(source) ?? `（${refLabel(graph, source)} 无值）`) : (fixed ?? ""))
  const resolve = (node: WfNode): Array<[string, string]> => [...(node.config.inputs ?? []), ...(node.config.results ?? [])].map((i) => [i.name, valueOf(i.source, i.value)])

  const settle = (node: WfNode, chosenEdge?: string) => {
    for (const e of outgoing(node.id)) takenEdge.set(e.id, chosenEdge === undefined || e.id === chosenEdge)
    if (chosenEdge) patch((run) => ({ ...run, taken: { ...run.taken, [node.id]: chosenEdge } }))
    for (const e of outgoing(node.id)) tryStart(e.target)
  }

  const finish = (result: Array<[string, string]>) => {
    if (!controller.alive) return
    const endedAt = Date.now()
    patch((run) => ({ ...run, status: "done", endedAt, result }))
    current = undefined
    const run = useWorkflowEditor.getState().runs.find((r) => r.id === controller.runId)
    if (run) options.onFinish(run)
  }

  const tryStart = (id: string) => {
    if (started.has(id) || !controller.alive) return
    const node = graph.nodes.find((n) => n.id === id)
    if (!node) return
    const edges = incoming(id)
    if (edges.some((e) => !takenEdge.has(e.id))) return
    started.add(id)
    if (edges.length && !edges.some((e) => takenEdge.get(e.id))) {
      patch((run) => ({ ...run, steps: [...run.steps, { nodeId: id, title: node.title, status: "skipped", startedAt: Date.now(), endedAt: Date.now() }] }))
      for (const e of outgoing(id)) takenEdge.set(e.id, false)
      outgoing(id).forEach((e) => tryStart(e.target))
      return
    }
    void runNode(node)
  }

  /** 写入节点输出的模拟值，供下游引用 */
  const produce = (node: WfNode) => {
    for (const o of node.config.outputs ?? []) if (!values.has(`${node.id}.${o.name}`)) values.set(`${node.id}.${o.name}`, o.example ?? node.config.sample ?? `${node.title}的${o.name}`)
    for (const f of producesOf(node)) if (!values.has(`${node.id}.${f}`)) values.set(`${node.id}.${f}`, node.config.sample ?? f)
  }

  const runNode = async (node: WfNode, attempt = 1): Promise<void> => {
    const c = node.config
    const input = resolve(node)
    const step: RunStep = { nodeId: node.id, title: node.title, status: "running", startedAt: Date.now(), input, write: node.type === "tool" && c.write, attempts: attempt, tokens: 0 }
    patch((run) => ({ ...run, status: "running", failedNode: undefined, steps: run.steps.some((s) => s.nodeId === node.id) ? run.steps.map((s) => (s.nodeId === node.id ? step : s)) : [...run.steps, step] }))

    if (node.type === "human") {
      await sleep(500)
      if (!controller.alive) return
      patchStep(node.id, { status: "waiting", output: `等待 ${options.handlerOf(node)} 办理` })
      patch((run) => ({ ...run, status: "waiting", waitingNode: node.id }))
      const form = await new Promise<Record<string, string>>((r) => (controller.resumeHuman = r))
      controller.resumeHuman = undefined
      if (!controller.alive) return
      const { __action: actionId, ...fields } = form
      for (const [k, v] of Object.entries(fields)) values.set(`${node.id}.${k}`, v)
      const action = c.actions?.find((a) => a.id === actionId) ?? c.actions?.[0]
      const edge = outgoing(node.id).find((e) => e.branch === action?.id)
      const summary = Object.entries(fields).map(([k, v]) => `${fieldLabel(node, k)}：${v || "—"}`).join("；")
      patchStep(node.id, { status: "done", output: `动作「${action?.name ?? ""}」${summary ? `；${summary}` : ""}`, endedAt: Date.now() })
      patch((run) => ({ ...run, status: "running", waitingNode: undefined }))
      return settle(node, edge?.id)
    }

    if (node.type === "loop") {
      const total = c.loopMode === "condition" ? Math.min(Number(c.maxRounds) || 3, 3) : 6
      const rounds: NonNullable<RunStep["rounds"]> = []
      for (let i = 1; i <= total && controller.alive; i++) {
        await sleep(450)
        const failed = c.loopMode !== "condition" && i === 4 && attempt === 1
        rounds.push({ label: c.loopMode === "condition" ? `第 ${i} 轮` : `第 ${i} 项`, status: failed ? "error" : "done", output: failed ? "票据不全，审核不通过" : (c.body ?? []).map((b) => `${b.title} 完成`).join("，") || "完成" })
        patchStep(node.id, { rounds: [...rounds], output: `进行中 ${i}/${total}` })
      }
      if (!controller.alive) return
      const tokens = tokensOf(node, total)
      const failedCount = rounds.filter((r) => r.status === "error").length
      if (failedCount && c.onError === "block") {
        patchStep(node.id, { status: "error", output: "第 4 项失败，循环受阻，等待处理", endedAt: Date.now(), tokens })
        return fail(node, attempt)
      }
      produce(node)
      const note = failedCount ? (c.onError === "null" ? `（${failedCount} 项失败，结果保留为空值）` : `（${failedCount} 项失败，已排除）`) : ""
      patchStep(node.id, { status: "done", output: `${c.sample ?? "循环完成"}${note}`, endedAt: Date.now(), tokens })
      return settle(node)
    }

    await sleep(["start", "end", "parallel", "join", "condition"].includes(node.type) ? 350 : 800 + Math.random() * 500)
    if (!controller.alive) return

    // 写操作工具绑定了只读账号：模拟一次真实的失败
    if (node.type === "tool" && c.write && runtime()[`mcp:${node.id}`] === "readonly") {
      patchStep(node.id, { status: "error", output: `MCP 工具「${toolName(node)}」所选账号没有写入权限`, endedAt: Date.now() })
      return fail(node, attempt)
    }

    let chosen: string | undefined
    let output = c.sample ?? ""
    if (node.type === "start") {
      for (const [k, v] of Object.entries(inputs)) values.set(`start.${k}`, v)
      output = Object.entries(inputs).map(([k, v]) => `${k}=${v || "—"}`).join("；")
    }
    if (node.type === "condition") {
      const hit = (c.branches ?? []).find((b) => b.rules.length && (b.logic === "or" ? b.rules.some((r) => evaluate(r, values)) : b.rules.every((r) => evaluate(r, values))))
      const branch = hit?.id ?? DEFAULT_BRANCH
      chosen = outgoing(node.id).find((e) => e.branch === branch)?.id
      output = `命中「${hit?.label ?? "默认出口"}」`
    }
    if (node.type === "agent" && c.intent) {
      const first = outletsOf(graph, node).find((o) => o.edge)
      chosen = first?.edge?.id
      output = `${c.sample ?? "已处理"}；依据处理意图选择「${first?.label ?? ""}」`
    }
    if (node.type === "parallel") output = `${outgoing(node.id).length} 条分支同时执行`
    if (node.type === "join") output = "全部分支成功，继续"
    produce(node)
    if (node.type === "end") {
      const result = (c.results ?? []).map((r): [string, string] => [r.name, valueOf(r.source, r.value)])
      patchStep(node.id, { status: "done", output: result.map(([k, v]) => `${k}：${v}`).join("\n") || "流程结束", endedAt: Date.now() })
      return finish(result)
    }
    patchStep(node.id, { status: "done", output, endedAt: Date.now(), tokens: tokensOf(node) })
    settle(node, chosen)
  }

  const fail = (node: WfNode, attempt: number) => {
    patch((run) => ({ ...run, status: "failed", failedNode: node.id }))
    controller.retry = () => {
      controller.retry = undefined
      void runNode(node, attempt + 1)
    }
  }

  const start = graph.nodes.find((n) => n.type === "start")
  if (start) tryStart(start.id)
  return controller.runId
}

/** 一次运行的 Token 合计 */
export const runTokens = (run: RunRecord) => run.steps.reduce((sum, s) => sum + (s.tokens ?? 0), 0)
export const formatTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
