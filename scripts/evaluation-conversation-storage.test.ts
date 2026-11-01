import { expect, test } from "bun:test"
import { useEvaluationConversations as chats, addEvaluationDrafts, type EvaluationConversation } from "../src/services/evaluation-conversations"
import { useEvaluation, saveCases, startRun, type EvalCase } from "../src/services/evaluation"

const chatKey = "lingee.evaluation-conversations.v1"
const evalKey = "lingee.evaluation.v1"
const sample: EvalCase = { id: "case", name: "原用例", input: "原输入", expected: "返回业务结果", source: "none", outcome: "passed" }
const conversation = (): EvaluationConversation => ({ session: { id: "draft-session", projectId: "project", title: "草稿", status: "idle", time: { created: 1, updated: 1 } }, objectId: "skill:subject", objectName: "技能", messages: [], request: "", rule: "", files: [], drafts: [structuredClone(sample)], adopted: {} })
async function withStorage(run: (memory: Map<string, string>, fail: (rule: (key: string) => boolean) => void) => Promise<void> | void) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
  const memory = new Map<string, string>()
  let shouldFail = (_key: string) => false
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => { if (shouldFail(key)) throw new Error("storage unavailable"); memory.set(key, value) },
    removeItem: (key: string) => memory.delete(key),
  } })
  chats.setState({ items: {} })
  useEvaluation.setState({ cases: {}, runs: {}, drafts: {}, deletedObjects: {}, error: false })
  try { await run(memory, rule => { shouldFail = rule }) }
  finally {
    if (descriptor) Object.defineProperty(globalThis, "localStorage", descriptor)
    else Reflect.deleteProperty(globalThis, "localStorage")
  }
}

test("草稿保存失败恢复原记录，刷新不出现假保存，恢复存储后可重试", () => withStorage(async (memory, fail) => {
  const original = conversation()
  expect(chats.getState().put(original)).toBe(true)
  const saved = memory.get(chatKey)
  const edited = { ...original, drafts: [{ ...sample, name: "编辑后" }] }
  fail(key => key === chatKey)
  expect(chats.getState().put(edited)).toBe(false)
  expect(chats.getState().items[original.session.id]).toEqual(original)
  expect(memory.get(chatKey)).toBe(saved)
  expect(edited.drafts[0].name).toBe("编辑后")
  fail(() => false)
  await chats.persist.rehydrate()
  expect(chats.getState().items[original.session.id]).toEqual(original)
  expect(chats.getState().put(edited)).toBe(true)
  await chats.persist.rehydrate()
  expect(chats.getState().items[original.session.id].drafts[0].name).toBe("编辑后")
}))

test("一次性加入标记写入失败时保留正式用例与历史记录", () => withStorage((memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  const existing = { ...sample, id: "existing" }
  saveCases(original.objectId, [existing])
  startRun(original.objectId, "技能", [existing])
  const saved = memory.get(evalKey)
  fail(key => key === chatKey)
  expect(() => addEvaluationDrafts(original.session.id, [sample.id])).toThrow("草稿关联保存失败")
  expect(memory.get(evalKey)).toBe(saved)
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([existing])
  expect(chats.getState().items[original.session.id].adopted).toEqual({})
}))

test("首次加入失败回退标记，恢复后可重试且旧运行不变", () => withStorage(async (memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  const existing = { ...sample, id: "existing" }
  saveCases(original.objectId, [existing])
  startRun(original.objectId, "技能", [existing])
  const history = structuredClone(useEvaluation.getState().runs)
  const savedChat = memory.get(chatKey)
  const savedEval = memory.get(evalKey)
  fail(key => key === evalKey)
  expect(() => addEvaluationDrafts(original.session.id, [sample.id])).toThrow("用例保存失败")
  expect(memory.get(chatKey)).toBe(savedChat)
  expect(memory.get(evalKey)).toBe(savedEval)
  expect(chats.getState().items[original.session.id]).toEqual(original)
  fail(() => false)
  addEvaluationDrafts(original.session.id, [sample.id])
  await chats.persist.rehydrate()
  await useEvaluation.persist.rehydrate()
  expect(chats.getState().items[original.session.id].adopted.case).toBeTruthy()
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([existing, sample])
  expect(useEvaluation.getState().runs).toEqual(history)
}))

test("加入标记回退也失败时明确报错，允许恢复存储后重试", () => withStorage((memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  saveCases(original.objectId, [])
  const savedEval = memory.get(evalKey)
  let disconnected = false
  fail(key => { if (key === evalKey) disconnected = true; return disconnected })
  expect(() => addEvaluationDrafts(original.session.id, [sample.id])).toThrow("关联记录尚未恢复到存储")
  expect(memory.get(evalKey)).toBe(savedEval)
  expect(chats.getState().items[original.session.id]).toEqual(original)
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([])
  fail(() => false)
  addEvaluationDrafts(original.session.id, [sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([sample])
}))

test("重复加入、正式用例编辑与删除后重开会话均不覆盖或重新创建", () => withStorage(async () => {
  const original = conversation()
  chats.getState().put(original)
  addEvaluationDrafts(original.session.id, [sample.id, sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([sample])
  addEvaluationDrafts(original.session.id, [sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toHaveLength(1)
  const edited = { ...sample, name: "列表内修改", input: "新输入" }
  saveCases(original.objectId, [edited])
  addEvaluationDrafts(original.session.id, [sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([edited])
  saveCases(original.objectId, [])
  await chats.persist.rehydrate()
  addEvaluationDrafts(original.session.id, [sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([])
  expect(chats.getState().items[original.session.id].drafts).toEqual([sample])
}))

test("兼容旧加入标记，不因正式用例缺失重新加入", () => withStorage(() => {
  const original = conversation()
  chats.getState().put({ ...original, adopted: { case: JSON.stringify(sample) } })
  saveCases(original.objectId, [])
  addEvaluationDrafts(original.session.id, [sample.id])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([])
}))

test("批量无效或标识冲突整批不写入，生成中不允许加入", () => withStorage(() => {
  const original = conversation()
  const bad = { ...sample, id: "bad", input: " " }
  chats.getState().put({ ...original, drafts: [sample, bad] })
  expect(() => addEvaluationDrafts(original.session.id, [sample.id, bad.id])).toThrow("用户输入")
  expect(useEvaluation.getState().cases[original.objectId]).toBeUndefined()
  expect(chats.getState().items[original.session.id].adopted).toEqual({})
  saveCases(original.objectId, [{ ...sample, name: "已有正式用例" }])
  expect(() => addEvaluationDrafts(original.session.id, [sample.id])).toThrow("未加入或覆盖")
  expect(useEvaluation.getState().cases[original.objectId][0].name).toBe("已有正式用例")
  chats.getState().put({ ...original, session: { ...original.session, status: "running" } })
  expect(() => addEvaluationDrafts(original.session.id, [sample.id])).toThrow("等待生成结束")
}))
