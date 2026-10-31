import { expect, test } from "bun:test"
import { useEvaluationConversations as chats, saveDraftAdoption, type EvaluationConversation } from "../src/services/evaluation-conversations"
import { useEvaluation, saveCases, startRun, draftRelation, type EvalCase } from "../src/services/evaluation"

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

test("加入关联写入失败时不覆盖正式用例和历史记录", () => withStorage((memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  saveCases(original.objectId, [sample])
  startRun(original.objectId, "技能", [sample])
  const saved = memory.get(evalKey)
  const edited = { ...sample, name: "新草稿", input: "新输入" }
  fail(key => key === chatKey)
  expect(() => saveDraftAdoption({ ...original, drafts: [edited], adopted: { case: JSON.stringify(edited) } }, [edited])).toThrow("草稿关联保存失败")
  expect(memory.get(evalKey)).toBe(saved)
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([sample])
  expect(chats.getState().items[original.session.id].adopted).toEqual({})
}))

test("正式用例写入失败回退加入关联，恢复后加入成功且旧运行不变", () => withStorage(async (memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  saveCases(original.objectId, [sample])
  startRun(original.objectId, "技能", [sample])
  const history = structuredClone(useEvaluation.getState().runs)
  const savedChat = memory.get(chatKey)
  const savedEval = memory.get(evalKey)
  const edited = { ...sample, name: "新草稿", input: "新输入" }
  const adopted = { ...original, drafts: [edited], adopted: { case: JSON.stringify(edited) } }
  fail(key => key === evalKey)
  expect(() => saveDraftAdoption(adopted, [edited])).toThrow("用例保存失败")
  expect(memory.get(chatKey)).toBe(savedChat)
  expect(memory.get(evalKey)).toBe(savedEval)
  expect(chats.getState().items[original.session.id]).toEqual(original)
  fail(() => false)
  saveDraftAdoption(adopted, [edited])
  await chats.persist.rehydrate()
  await useEvaluation.persist.rehydrate()
  expect(draftRelation(edited, chats.getState().items[original.session.id].adopted.case, useEvaluation.getState().cases[original.objectId][0])).toBe("已加入")
  expect(useEvaluation.getState().runs).toEqual(history)
}))

test("关联回退也遇到存储故障时明确报错，保留原用例并允许恢复后重试", () => withStorage((memory, fail) => {
  const original = conversation()
  chats.getState().put(original)
  saveCases(original.objectId, [sample])
  const savedEval = memory.get(evalKey)
  const edited = { ...sample, name: "新草稿" }
  const adopted = { ...original, drafts: [edited], adopted: { case: JSON.stringify(edited) } }
  let disconnected = false
  fail(key => { if (key === evalKey) disconnected = true; return disconnected })
  expect(() => saveDraftAdoption(adopted, [edited])).toThrow("关联记录尚未恢复到存储")
  expect(memory.get(evalKey)).toBe(savedEval)
  expect(chats.getState().items[original.session.id]).toEqual(original)
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([sample])
  fail(() => false)
  saveDraftAdoption(adopted, [edited])
  expect(useEvaluation.getState().cases[original.objectId]).toEqual([edited])
}))
