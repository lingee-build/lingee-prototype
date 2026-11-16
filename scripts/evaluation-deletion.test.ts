import { beforeEach, expect, test } from "bun:test"
const memory = new Map<string, string>()
let failStorage = false
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failStorage) throw new Error("storage unavailable"); memory.set(key, value) },
  removeItem: (key: string) => memory.delete(key),
} })
const blobs = new Set<string>()
let failAttachments = false
Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: { open: () => {
  const request: any = {}
  queueMicrotask(() => {
    request.result = { close() {}, transaction() {
      const removed: string[] = []
      const tx: any = { error: new Error("attachment failed"), objectStore: () => ({ delete: (id: string) => removed.push(id) }) }
      queueMicrotask(() => { if (failAttachments) tx.onabort(); else { removed.forEach(id => blobs.delete(id)); tx.oncomplete() } })
      return tx
    } }
    request.onsuccess()
  }); return request
} } })
const { useEvaluation, startRun, saveCases, cancelRun, advanceRuns } = await import("../src/services/evaluation")
const { useEvaluationConversations: chats } = await import("../src/services/evaluation-conversations")
const { useEvaluationRepairs: repairs } = await import("../src/services/evaluation-repair")
const { deleteObjectEvaluations: remove } = await import("../src/services/evaluation-deletion")
const { db } = await import("../src/mock/db")
const { useSync } = await import("../src/stores/sync")
const { skillService, agentService } = await import("../src/services/dev")
const { devStore } = await import("../src/mock/dev-store")
const { createEditSession } = await import("../src/features/dev-page/use-edit-session")
const sample = { id: "case", name: "Case", input: "input", expected: "expected", source: "none" as const, outcome: "passed" as const }
const session = (id: string) => ({ id, projectId: "p", title: id, status: "idle" as const, time: { created: 1, updated: 1 } })
beforeEach(() => {
  failStorage = false; failAttachments = false; blobs.clear(); memory.clear()
  useEvaluation.setState({ cases: {}, runs: {}, drafts: {}, deletedObjects: {}, error: false })
  chats.setState({ items: {} }); repairs.setState({ items: {}, links: {} })
  db.sessions = []; db.messages = []
  useSync.setState({ ready: true, sessions: [], messages: {}, projects: [{ id: "other", name: "Other", worktree: "", git: false, branch: "" }] })
})
test("删除全部评测数据及会话，保留其他对象、共享附件，刷新不复活", async () => {
  const own = { id: "own", name: "own.txt", size: 1, data: "" }, shared = { ...own, id: "shared" }
  blobs.add("own"); blobs.add("shared")
  saveCases("skill:delete", [{ ...sample, attachments: [own, shared] }]); saveCases("agent:keep", [{ ...sample, attachments: [shared] }])
  const run = startRun("skill:delete", "Delete", useEvaluation.getState().cases["skill:delete"])!
  cancelRun("skill:delete", run)
  useEvaluation.setState({ drafts: { "skill:delete": sample, "agent:keep": sample } })
  chats.getState().put({ session: session("generate"), objectId: "skill:delete", objectName: "Delete", messages: [], request: "", rule: "", files: [], drafts: [sample], adopted: {} })
  repairs.setState({ items: { repair: { session: session("repair"), messages: [], draft: "evidence" } }, links: { repair: `/dev/skill/delete/evaluation?run=${run}` } })
  db.sessions = [session("generate"), session("repair"), session("ordinary")]; useSync.setState({ sessions: [...db.sessions] })
  await remove(["skill:delete"])
  expect(useEvaluation.getState().cases["skill:delete"]).toBeUndefined()
  expect(useEvaluation.getState().runs["skill:delete"]).toBeUndefined()
  expect(useEvaluation.getState().drafts["skill:delete"]).toBeUndefined()
  expect(useEvaluation.getState().cases["agent:keep"]).toHaveLength(1)
  expect(db.sessions.map(s => s.id)).toEqual(["ordinary"])
  expect(useSync.getState().sessions.map(s => s.id)).toEqual(["ordinary"])
  expect(repairs.getState().links).toEqual({}); expect(chats.getState().items).toEqual({})
  expect([...blobs]).toEqual(["shared"])
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().deletedObjects?.["skill:delete"]).toBe(true)
  expect(saveCases("skill:delete", [sample])).toBe(false)
  expect(startRun("skill:delete", "Deleted", [sample])).toBeUndefined()
  advanceRuns(); expect(useEvaluation.getState().runs["skill:delete"]).toBeUndefined()
})
test("批量删除遇到活动任务或停止待核实整批阻断", async () => {
  saveCases("skill:a", [sample]); startRun("agent:b", "B", [sample])
  await expect(remove(["skill:a", "agent:b"])).rejects.toThrow("活动评测")
  expect(useEvaluation.getState().cases["skill:a"]).toHaveLength(1)
  useEvaluation.setState(s => ({ runs: { "agent:b": s.runs["agent:b"].map(r => ({ ...r, status: "stop_unconfirmed" })) } }))
  await expect(remove(["agent:b"])).rejects.toThrow("活动评测")
})
test("存储或附件失败不移除技能，恢复后可重试", async () => {
  const id = devStore.skills[0].id
  saveCases(`skill:${id}`, [{ ...sample, attachments: [{ id: "own", name: "a", size: 1, data: "" }] }]); blobs.add("own")
  failStorage = true; await expect(skillService.remove([id])).rejects.toThrow()
  failStorage = false; failAttachments = true; await expect(skillService.remove([id])).rejects.toThrow()
  expect(devStore.skills.some(s => s.id === id)).toBe(true)
  expect(useEvaluation.getState().cases[`skill:${id}`]).toHaveLength(1); expect(blobs.has("own")).toBe(true)
  failAttachments = false; await skillService.remove([id])
  expect(await skillService.get(id)).toBeUndefined(); expect(blobs.has("own")).toBe(false)
})
test("智能体删除也清理评测，生成中的会话阻止删除", async () => {
  const id = devStore.agents[0].id
  saveCases(`agent:${id}`, [sample])
  chats.getState().put({ session: { ...session("busy"), status: "running" }, objectId: `agent:${id}`, objectName: "Agent", messages: [], request: "", rule: "", files: [], drafts: [], adopted: {} })
  await expect(agentService.remove(id)).rejects.toThrow("会话尚未结束")
  chats.getState().remove("busy"); await agentService.remove(id)
  expect(await agentService.get(id)).toBeUndefined(); expect(useEvaluation.getState().cases[`agent:${id}`]).toBeUndefined()
})
test("修复项目缺失不创建会话或回退，恢复后进入原项目且不发送", async () => {
  const options = { title: "repair", draft: "evidence", projectId: "missing", requireProject: true, target: { kdskill: "s" } }
  expect(await createEditSession(options)).toBeUndefined(); expect(db.sessions).toHaveLength(0)
  useSync.setState(s => ({ projects: [...s.projects, { id: "missing", name: "Restored", worktree: "", git: false, branch: "" }] }))
  expect((await createEditSession(options))?.projectId).toBe("missing"); expect(db.messages).toHaveLength(0)
})

test("智能体修复关联参与活动阻断与删除，保留其他对象会话", async () => {
  const { registerEvaluationRepair } = await import("../src/services/evaluation-repair")
  const id = devStore.agents[0].id
  const originalAgents = structuredClone(devStore.agents)
  try {
    saveCases(`agent:${id}`, [sample])
    registerEvaluationRepair(session("agent-repair"), "evidence", { objectType: "agent", objectId: id, runId: "run" })
    registerEvaluationRepair(session("skill-repair"), "evidence", { objectType: "skill", objectId: "keep", runId: "run" })
    repairs.setState(s => ({ items: { ...s.items, "agent-repair": { ...s.items["agent-repair"], session: { ...session("agent-repair"), status: "running" } } } }))
    await expect(agentService.remove(id)).rejects.toThrow("会话尚未结束")
    expect(devStore.agents.some(a => a.id === id)).toBe(true)
    // 只有结构化绑定、返回链接丢失时也应清理关联会话。
    repairs.setState(s => ({ links: { "skill-repair": s.links["skill-repair"] }, items: { ...s.items, "agent-repair": { ...s.items["agent-repair"], session: session("agent-repair") } } }))
    db.sessions = [session("agent-repair"), session("skill-repair"), session("ordinary")]
    await agentService.remove(id)
    expect(repairs.getState().items["agent-repair"]).toBeUndefined()
    expect(repairs.getState().items["skill-repair"]).toBeDefined()
    expect(db.sessions.map(s => s.id)).toEqual(["skill-repair", "ordinary"])
    expect(useEvaluation.getState().runs[`agent:${id}`]).toBeUndefined()
    await useEvaluation.persist.rehydrate()
    expect(useEvaluation.getState().deletedObjects?.[`agent:${id}`]).toBe(true)
  } finally { devStore.agents = originalAgents }
})

test("智能体修复会话仅进入所属项目且不自动发送", async () => {
  const options = { title: "修复智能体", draft: "/ai-partner-creator evidence", projectId: "agent-project", requireProject: true, target: { agent: "original-agent" } }
  expect(await createEditSession(options)).toBeUndefined()
  expect(db.sessions).toHaveLength(0)
  useSync.setState(s => ({ projects: [...s.projects, { id: "agent-project", name: "Agent", worktree: "", git: false, branch: "" }] }))
  const created = await createEditSession(options)
  expect(created?.projectId).toBe("agent-project")
  expect(db.messages).toHaveLength(0)
})

test("已有普通开发对话参与报告修复后，删除对象只清除报告关联而不删除对话", async () => {
  const { registerEvaluationRepair } = await import("../src/services/evaluation-repair")
  const ordinary = session("ordinary-existing")
  db.sessions.push(ordinary); useSync.setState({ sessions: [ordinary] })
  const message = { id: "keep-message", sessionId: ordinary.id, role: "user" as const, parts: [], time: { created: 1 } }
  db.messages.push(message)
  registerEvaluationRepair(ordinary, "修复评测问题", { objectType: "skill", objectId: "delete-existing", runId: "old-report" }, false)
  await remove(["skill:delete-existing"])
  expect(db.sessions.some(s => s.id === ordinary.id)).toBe(true)
  expect(db.messages.some(m => m.id === message.id)).toBe(true)
  expect(repairs.getState().links[ordinary.id]).toBeUndefined()
})
