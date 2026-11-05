import { create } from "zustand"
import { persist } from "zustand/middleware"
import { templateGraph, type WfGraph } from "@/mock/fixtures/workflow-graphs"
import type { Workflow } from "@/mock/fixtures/workflows"
import { currentDisplayName } from "@/stores/auth"

/** 一次保存的快照（设计历史，可恢复） */
export interface WfSave {
  seq: number
  savedAt: string
  operator: string
  graph: WfGraph
}

/**
 * 一条工作流的编辑内容。两条基线分离（方案 10.2）：
 * - saves 的最后一条 = 已保存基线：判断有无未保存改动
 * - submitted = 已提交基线：计算提交差异；撤回时回退到提交前的快照
 * runtime：试运行时实例化的绑定（连接器账号、智能体版本、办理人），不进入模板
 * pending：用户在画布上手动做的修改，下次在会话里发消息时告诉助手
 */
export interface WorkflowDoc {
  graph: WfGraph
  saves: WfSave[]
  submitted?: WfGraph
  /** 撤回时恢复的「上一次已提交基线」 */
  submittedBefore?: WfGraph
  runtime: Record<string, string>
  pending: string[]
}

interface DocsState {
  docs: Record<string, WorkflowDoc>
  /** 第一次打开时建档；initial 是导入的画布，不传按模板生成 */
  ensure: (meta: Workflow, initial?: WfGraph) => WorkflowDoc
  setGraph: (id: string, graph: WfGraph, change?: string) => void
  save: (id: string) => WfSave | undefined
  markSubmitted: (id: string) => void
  withdraw: (id: string) => void
  setRuntime: (id: string, key: string, value: string) => void
  clearPending: (id: string) => void
  /** 撤销时去掉最后一条修改记录，重做时补回 */
  popPending: (id: string) => string | undefined
  pushPending: (id: string, change: string) => void
  duplicate: (from: string, to: string) => void
  remove: (id: string) => void
}

/** 只比较内容，节点位置不算修改 */
export const snapshot = (graph?: WfGraph) => (graph ? JSON.stringify({ n: graph.nodes.map(({ x: _x, y: _y, ...rest }) => rest), e: graph.edges }) : "")

export const lastSaved = (doc?: WorkflowDoc) => doc?.saves.at(-1)?.graph
export const isDirty = (doc?: WorkflowDoc) => !!doc && snapshot(doc.graph) !== snapshot(lastSaved(doc))

export const useWorkflowDocs = create<DocsState>()(
  persist(
    (set, get) => ({
      docs: {},
      ensure(meta, initial) {
        const existing = get().docs[meta.id]
        if (existing) return existing
        const graph = initial ?? templateGraph(meta.template)
        const doc: WorkflowDoc = {
          graph,
          saves: [{ seq: 1, savedAt: meta.updatedAt, operator: meta.creator, graph }],
          // 已发布 / 已驳回的种子数据：已提交基线就是当前内容
          submitted: meta.status !== "saved" ? graph : undefined,
          runtime: {},
          pending: [],
        }
        set((s) => ({ docs: { ...s.docs, [meta.id]: doc } }))
        return doc
      },
      setGraph(id, graph, change) {
        set((s) => {
          const doc = s.docs[id]
          if (!doc) return s
          const pending = change ? [...doc.pending.filter((x) => x !== change), change] : doc.pending
          return { docs: { ...s.docs, [id]: { ...doc, graph, pending } } }
        })
      },
      save(id) {
        const doc = get().docs[id]
        if (!doc) return undefined
        const record: WfSave = { seq: (doc.saves.at(-1)?.seq ?? 0) + 1, savedAt: new Date().toISOString(), operator: currentDisplayName(), graph: structuredClone(doc.graph) }
        set((s) => ({ docs: { ...s.docs, [id]: { ...doc, saves: [...doc.saves, record].slice(-30) } } }))
        return record
      },
      markSubmitted(id) {
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, submittedBefore: doc.submitted, submitted: structuredClone(lastSaved(doc) ?? doc.graph) } } } : s
        })
      },
      withdraw(id) {
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, submitted: doc.submittedBefore, submittedBefore: undefined } } } : s
        })
      },
      setRuntime(id, key, value) {
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, runtime: { ...doc.runtime, [key]: value } } } } : s
        })
      },
      popPending(id) {
        const last = get().docs[id]?.pending.at(-1)
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, pending: doc.pending.slice(0, -1) } } } : s
        })
        return last
      },
      pushPending(id, change) {
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, pending: [...doc.pending, change] } } } : s
        })
      },
      clearPending(id) {
        set((s) => {
          const doc = s.docs[id]
          return doc ? { docs: { ...s.docs, [id]: { ...doc, pending: [] } } } : s
        })
      },
      duplicate(from, to) {
        const doc = get().docs[from]
        if (doc) set((s) => ({ docs: { ...s.docs, [to]: { graph: structuredClone(doc.graph), saves: [{ seq: 1, savedAt: new Date().toISOString(), operator: currentDisplayName(), graph: structuredClone(doc.graph) }], runtime: {}, pending: [] } } }))
      },
      remove(id) {
        set((s) => {
          const docs = { ...s.docs }
          delete docs[id]
          return { docs }
        })
      },
    }),
    { name: "lingee-prototype.workflow-docs.v3" },
  ),
)
