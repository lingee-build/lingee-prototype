import { db } from "@/mock/db"
import { latency, uid } from "@/mock/latency"
import { templateGraph, type WfGraph } from "@/mock/fixtures/workflow-graphs"
import { workflowSeeds, type Workflow, type WorkflowTemplate } from "@/mock/fixtures/workflows"
import type { Message, SyncEvent } from "@/mock/types"
import { currentDisplayName } from "@/stores/auth"
import { lastSaved, useWorkflowDocs } from "@/stores/workflow-docs"

/**
 * 工作流开发的数据服务（mock）。列表元信息与画布内容（stores/workflow-docs）都存在 localStorage，刷新不丢；
 * 关联的会话在内存数据库里，刷新后会重新建一个。审核在 Console 进行，Build 侧只到「已提交」。
 */
const LIST_KEY = "lingee-prototype.workflows.v3"

function read(): Workflow[] {
  try {
    const raw = localStorage.getItem(LIST_KEY)
    if (raw) return JSON.parse(raw) as Workflow[]
  } catch {
    /* 存储不可用或数据损坏时回到演示数据 */
  }
  return structuredClone(workflowSeeds)
}

let cache = read()

function write(list: Workflow[]) {
  cache = list
  try {
    localStorage.setItem(LIST_KEY, JSON.stringify(list))
  } catch {
    /* 原型：存储不可用时只保留内存态 */
  }
}

const patch = (id: string, fn: (item: Workflow) => Workflow) => write(cache.map((x) => (x.id === id ? fn(x) : x)))
const now = () => new Date().toISOString()

/** 下一个版本号：已发布 1.2.0 → 1.3.0；从未发布 → 1.0.0；驳回后重提沿用同一版本号 */
export function nextVersion(item: Workflow) {
  if (item.pendingVersion) return item.pendingVersion
  if (!item.publishedVersion) return "1.0.0"
  const [major, minor] = item.publishedVersion.split(".").map(Number)
  return `${major}.${minor + 1}.0`
}

export const workflowService = {
  list: () => latency(cache, 300),
  get: (id: string) => latency(cache.find((x) => x.id === id), 80),
  find: (id: string) => cache.find((x) => x.id === id),
  exists: (id: string) => cache.some((x) => x.id === id),
  bySession: (sessionId: string) => cache.find((x) => x.sessionId === sessionId),
  names: () => cache.map((x) => x.name),
  /** 已有同名工作流时追加序号（列表里不允许重名） */
  uniqueName(name: string) {
    let next = name
    for (let i = 2; cache.some((x) => x.name === next); i++) next = `${name} ${i}`
    return next
  },
  /** 同步创建：会话剧本在产物卡片推出时落库，需要立即拿到 id */
  createNow(input: { name: string; desc: string; template: WorkflowTemplate; sessionId?: string; projectId?: string }, graph?: WfGraph) {
    const item: Workflow = { id: uid("wf"), ...input, status: "saved", creator: currentDisplayName(), createdAt: now(), updatedAt: now() }
    write([item, ...cache])
    useWorkflowDocs.getState().ensure(item, graph)
    return item
  },
  /** 从 DSL 导入：新建一条「已保存」的工作流，导入的画布作为第 1 次保存 */
  importDsl(dsl: { name?: string; desc?: string; graph: WfGraph }) {
    return latency(this.createNow({ name: this.uniqueName(dsl.name || "导入的工作流"), desc: dsl.desc || "从 DSL 导入的工作流。", template: "blank" }, dsl.graph))
  },
  linkSession(id: string, sessionId: string, projectId: string) {
    patch(id, (x) => ({ ...x, sessionId, projectId }))
  },
  update(id: string, input: { name: string; desc: string }) {
    patch(id, (x) => ({ ...x, ...input, updatedAt: now() }))
    return latency(true)
  },
  touch(id: string) {
    patch(id, (x) => ({ ...x, updatedAt: now() }))
  },
  /** 保存：已发布 → 已保存；已驳回保存后仍是已驳回（方案 10.1） */
  save(id: string) {
    const record = useWorkflowDocs.getState().save(id)
    patch(id, (x) => ({ ...x, status: x.status === "published" ? "saved" : x.status, updatedAt: now() }))
    return latency(record, 300)
  },
  submit(id: string, version: string) {
    useWorkflowDocs.getState().markSubmitted(id)
    patch(id, (x) => ({ ...x, status: "submitted", pendingVersion: version, rejectReason: undefined, updatedAt: now() }))
    return latency(true, 600)
  },
  /** 撤回提交：回到已保存，已提交基线回退到本次提交之前 */
  withdraw(id: string) {
    useWorkflowDocs.getState().withdraw(id)
    patch(id, (x) => ({ ...x, status: "saved", pendingVersion: undefined, updatedAt: now() }))
    return latency(true, 300)
  },
  duplicate(id: string) {
    const source = cache.find((x) => x.id === id)
    if (!source) return latency(undefined)
    const copy: Workflow = { ...source, id: uid("wf"), name: this.uniqueName(`${source.name} 副本`), status: "saved", publishedVersion: undefined, pendingVersion: undefined, rejectReason: undefined, sessionId: undefined, creator: currentDisplayName(), createdAt: now(), updatedAt: now() }
    useWorkflowDocs.getState().ensure(source)
    useWorkflowDocs.getState().duplicate(id, copy.id)
    write([copy, ...cache])
    return latency(copy, 200)
  },
  remove(id: string) {
    write(cache.filter((x) => x.id !== id))
    useWorkflowDocs.getState().remove(id)
    return latency(true)
  },
  /** 列表卡片上的节点数：以最近一次保存为准；还没打开过的种子数据按模板计算 */
  nodeCount: (id: string) => {
    const doc = useWorkflowDocs.getState().docs[id]
    if (doc) return (lastSaved(doc) ?? doc.graph).nodes.length
    const item = cache.find((x) => x.id === id)
    return item ? templateGraph(item.template).nodes.length : undefined
  },
  /**
   * 试运行结束后，在关联会话里追加一轮：用户侧记一条「试运行了…」，助手侧给结果摘要（不经过剧本回放）。
   * 时间线按「用户消息 + 助手回复」成轮显示，单独的助手消息不会出现。
   */
  appendSessionMessage(sessionId: string, ask: string, text: string, emit: (event: SyncEvent) => void) {
    if (!db.sessions.some((x) => x.id === sessionId)) return
    const at = Date.now()
    const user: Message = { id: uid("msg"), sessionId, role: "user", time: { created: at, completed: at }, parts: [{ id: uid("prt"), type: "text", text: ask }] }
    const reply: Message = { id: uid("msg"), sessionId, role: "assistant", agent: "build", time: { created: at + 1, completed: at + 1 }, parts: [{ id: uid("prt"), type: "text", text }] }
    for (const message of [user, reply]) {
      db.messages.push(message)
      emit({ type: "message.updated", message: structuredClone(message) })
    }
  },
}
