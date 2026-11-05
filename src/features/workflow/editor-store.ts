import { create } from "zustand"
import type { WfGraph } from "@/mock/fixtures/workflow-graphs"
import { useWorkflowDocs } from "@/stores/workflow-docs"

export type NodeRunStatus = "running" | "done" | "waiting" | "skipped" | "error"

export interface RunStep {
  nodeId: string
  title: string
  status: NodeRunStatus
  startedAt: number
  endedAt?: number
  input?: Array<[string, string]>
  output?: string
  /** 循环每一轮的结果 */
  rounds?: Array<{ label: string; status: "done" | "error"; output: string }>
  write?: boolean
  attempts?: number
  /** 模拟的模型用量 */
  tokens?: number
}

export interface RunRecord {
  id: string
  status: "running" | "waiting" | "failed" | "done" | "stopped"
  steps: RunStep[]
  startedAt: number
  endedAt?: number
  inputs: Record<string, string>
  waitingNode?: string
  failedNode?: string
  /** 多出口节点实际走的出边（edge id） */
  taken: Record<string, string>
  /** 业务结果：结束节点的最终输出 */
  result?: Array<[string, string]>
}

/** 助手在对话里提出的画布修改：先在画布上预览，确认后应用（方案：对话修改先预览、再应用） */
export interface Proposal {
  id: string
  workflowId: string
  graph: WfGraph
  base: WfGraph
  summary: string
  changed: string[]
  status: "pending" | "applied" | "discarded"
}

type Panel = "node" | "trial"

/**
 * 画布的界面状态（不持久化）：选中节点、右栏面板、撤销 / 重做、高亮、试运行记录、待确认的助手修改。
 * 右栏同一时间只放一个面板；都没有时画布占满。
 */
interface EditorState {
  workflowId?: string
  selected?: string
  panel?: Panel
  past: WfGraph[]
  future: WfGraph[]
  /** 与 past / future 一一对应的修改说明：撤销时从「画布有 N 处修改」里去掉，重做时放回 */
  pastChanges: Array<string | undefined>
  futureChanges: Array<string | undefined>
  highlight: string[]
  runs: RunRecord[]
  /** 当前查看的试运行记录 */
  runId?: string
  proposals: Record<string, Proposal>
  /** 头部搜索选中节点后，请画布把它移到中央（seq 递增触发） */
  focus?: { id: string; seq: number }
  requestFocus: (nodeId: string) => void
  open: (workflowId: string) => void
  select: (nodeId?: string) => void
  setPanel: (panel?: Panel) => void
  commit: (graph: WfGraph, change?: string) => void
  undo: () => void
  redo: () => void
  flash: (nodeIds: string[]) => void
  upsertRun: (run: RunRecord) => void
  patchRun: (id: string, fn: (run: RunRecord) => RunRecord) => void
  viewRun: (id?: string) => void
  propose: (proposal: Proposal) => void
  resolveProposal: (id: string, status: "applied" | "discarded") => void
}

let flashTimer: ReturnType<typeof setTimeout> | undefined

export const useWorkflowEditor = create<EditorState>((set, get) => ({
  past: [],
  future: [],
  pastChanges: [],
  futureChanges: [],
  highlight: [],
  runs: [],
  proposals: {},
  open: (workflowId) => get().workflowId !== workflowId && set({ workflowId, selected: undefined, panel: undefined, past: [], future: [], pastChanges: [], futureChanges: [], highlight: [], runs: [], runId: undefined }),
  select: (selected) => set({ selected, panel: selected ? "node" : get().panel === "trial" ? "trial" : undefined }),
  requestFocus: (id) => set((s) => ({ focus: { id, seq: (s.focus?.seq ?? 0) + 1 } })),
  setPanel: (panel) => set({ panel, selected: panel === "node" ? get().selected : undefined }),
  commit(graph, change) {
    const id = get().workflowId
    if (!id) return
    const current = useWorkflowDocs.getState().docs[id]?.graph
    if (current) set((s) => ({ past: [...s.past.slice(-49), current], pastChanges: [...s.pastChanges.slice(-49), change], future: [], futureChanges: [] }))
    useWorkflowDocs.getState().setGraph(id, graph, change)
  },
  undo() {
    const { workflowId: id, past } = get()
    const current = id ? useWorkflowDocs.getState().docs[id]?.graph : undefined
    if (!id || !current || !past.length) return
    const change = get().pastChanges.at(-1)
    if (change) useWorkflowDocs.getState().popPending(id)
    set((s) => ({ past: s.past.slice(0, -1), pastChanges: s.pastChanges.slice(0, -1), future: [current, ...s.future], futureChanges: [change, ...s.futureChanges] }))
    useWorkflowDocs.getState().setGraph(id, past[past.length - 1])
  },
  redo() {
    const { workflowId: id, future } = get()
    const current = id ? useWorkflowDocs.getState().docs[id]?.graph : undefined
    if (!id || !current || !future.length) return
    const change = get().futureChanges[0]
    set((s) => ({ future: s.future.slice(1), futureChanges: s.futureChanges.slice(1), past: [...s.past, current], pastChanges: [...s.pastChanges, change] }))
    useWorkflowDocs.getState().setGraph(id, future[0])
    if (change) useWorkflowDocs.getState().pushPending(id, change)
  },
  flash(nodeIds) {
    clearTimeout(flashTimer)
    set({ highlight: nodeIds })
    flashTimer = setTimeout(() => set({ highlight: [] }), 2600)
  },
  upsertRun: (run) => set((s) => ({ runs: [run, ...s.runs.filter((x) => x.id !== run.id)].slice(0, 10), runId: run.id })),
  patchRun: (id, fn) => set((s) => ({ runs: s.runs.map((x) => (x.id === id ? fn(x) : x)) })),
  viewRun: (runId) => set({ runId }),
  propose: (proposal) => set((s) => ({ proposals: { ...s.proposals, [proposal.id]: proposal } })),
  resolveProposal: (id, status) => set((s) => ({ proposals: s.proposals[id] ? { ...s.proposals, [id]: { ...s.proposals[id], status } } : s.proposals })),
}))

/** 定位到问题：选中节点并高亮 */
export function locate(target: { nodeId?: string; edgeId?: string }) {
  const editor = useWorkflowEditor.getState()
  if (target.nodeId) {
    editor.select(target.nodeId)
    editor.flash([target.nodeId])
  }
}

/** 当前工作流待确认的助手修改（画布进入预览态） */
export const pendingProposal = (state: EditorState, workflowId: string) => Object.values(state.proposals).find((p) => p.workflowId === workflowId && p.status === "pending")
export const currentRun = (state: EditorState) => state.runs.find((r) => r.id === state.runId)
