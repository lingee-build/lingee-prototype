import { expect, test } from "bun:test"
import { useEvaluationConversations as chats, saveEvaluationConversation, type EvaluationConversation } from "../src/services/evaluation-conversations"
import { useEvaluation, saveCases, startRun, type EvalCase } from "../src/services/evaluation"

const chatKey = "lingee.evaluation-conversations.v1"
const evalKey = "lingee.evaluation.v1"
const sample: EvalCase = { id: "case", code: "EC-0001", name: "原用例", input: "原输入", expected: "返回业务结果", source: "none", outcome: "passed" }
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

test("对话直接保存当前用例，刷新恢复且历史快照不变", () => withStorage(async () => {
  const chat = conversation(); saveCases(chat.objectId, [sample])
  startRun(chat.objectId, "技能", [sample])
  const history = structuredClone(useEvaluation.getState().runs)
  const edited = [{ ...sample, name: "修改后" }]
  saveEvaluationConversation({ ...chat, drafts: edited }, edited)
  await chats.persist.rehydrate(); await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().cases[chat.objectId]).toEqual(edited)
  expect(chats.getState().items[chat.session.id].drafts).toEqual(edited)
  expect(useEvaluation.getState().runs).toEqual(history)
}))

test("用例写入失败保留输入与原列表，会话写入失败回退列表", () => withStorage(async (_, fail) => {
  const chat = conversation(); saveCases(chat.objectId, [sample]); chats.getState().put(chat)
  const edited = [{ ...sample, input: "修改后" }]
  fail(key => key === evalKey)
  expect(() => saveEvaluationConversation({ ...chat, drafts: edited }, edited)).toThrow("用例保存失败")
  expect(useEvaluation.getState().cases[chat.objectId]).toEqual([sample])
  fail(key => key === chatKey)
  expect(() => saveEvaluationConversation({ ...chat, drafts: edited }, edited)).toThrow("会话保存失败")
  expect(useEvaluation.getState().cases[chat.objectId]).toEqual([sample])
  expect(chats.getState().items[chat.session.id]).toEqual(chat)
  fail(() => false)
  saveEvaluationConversation({ ...chat, drafts: edited }, edited)
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().cases[chat.objectId]).toEqual(edited)
  expect(edited[0].input).toBe("修改后")
}))

test("无效内容整批不保存，回退失败明确说明", () => withStorage((_, fail) => {
  const chat = conversation(); saveCases(chat.objectId, [sample]); chats.getState().put(chat)
  expect(() => saveEvaluationConversation(chat, [{ ...sample, input: " " }])).toThrow("用户输入")
  expect(useEvaluation.getState().cases[chat.objectId]).toEqual([sample])
  let disconnected = false
  fail(key => { if (key === chatKey) disconnected = true; return disconnected })
  expect(() => saveEvaluationConversation(chat, [{ ...sample, input: "新值" }])).toThrow("回退失败")
}))


test("普通开发对话生成直接保存，多个对象先澄清且跳过不写入", () => withStorage(async () => {
  const { evaluationGenerateScenario } = await import("../src/mock/scenarios/evaluation-generate")
  const { devStore } = await import("../src/mock/dev-store")
  const skill = devStore.skills[0]
  const scenario = evaluationGenerateScenario({ projectId: skill.projectId, prompt: `为 ${skill.id} 生成评测用例，正常查询返回明细` })
  const result = scenario.steps[1].resolve!()
  expect(result.text).toContain("已保存")
  expect(useEvaluation.getState().cases[`skill:${skill.id}`]).toHaveLength(1)
  expect(result.card!().config.id).toBe(`skill:${skill.id}`)
  const ambiguous = evaluationGenerateScenario({ projectId: skill.projectId, prompt: "生成评测用例" })
  expect(ambiguous.steps[0].question?.[0].options.length).toBeGreaterThan(1)
  const before = structuredClone(useEvaluation.getState().cases)
  ambiguous.steps[0].onAnswer!([])
  expect(ambiguous.steps[1].resolve!().card).toBeUndefined()
  expect(useEvaluation.getState().cases).toEqual(before)
}))
