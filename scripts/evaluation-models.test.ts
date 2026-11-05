import { expect, test } from "bun:test"
import { defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, resolveEvaluationModels, resolveRerunModels } from "../src/services/evaluation-models"
import type { Model } from "../src/mock/types"

const catalog: Model[] = [
  { id: "exec", name: "执行 A", provider: "供应方 A", version: "v1" },
  { id: "judge", name: "判定 B", provider: "供应方 B" },
]
const defaults = { execution: "exec", judging: "judge" }

test("新测采用默认模型，重跑锁定来源报告且缺失记录不回退默认值", () => {
  const first = initialEvaluationModelIds(defaults)
  expect(first).toEqual(defaults)
  const original = { models: resolveEvaluationModels(defaults, catalog)! }
  const latest = { models: resolveEvaluationModels({ execution: "judge", judging: "exec" }, catalog)! }
  expect(initialEvaluationModelIds(defaults, latest)).toEqual(defaults)
  expect(initialEvaluationModelIds(defaults, latest, original)).toEqual(defaults)
  expect(initialEvaluationModelIds(defaults, latest, {})).toEqual({ execution: "", judging: "" })
  expect(defaults).toEqual({ execution: "exec", judging: "judge" })
})

test("模型下线或默认项无法解析时拒绝启动，不静默替换，两个角色可以使用同一模型", () => {
  expect(resolveEvaluationModels(defaults, catalog.slice(0, 1))).toBeUndefined()
  expect(resolveEvaluationModels({ execution: "", judging: "judge" }, catalog)).toBeUndefined()
  expect(resolveEvaluationModels({ execution: "exec", judging: "exec" }, catalog)?.judging.id).toBe("exec")
  expect(evaluationExecutionDefault(catalog)).toBe("exec")
  expect(evaluationExecutionDefault([...catalog].reverse())).toBe("judge")
  expect(evaluationExecutionDefault([])).toBe("")
})

test("模型记录与目录隔离，记录可得版本，缺失历史明确显示未记录", () => {
  const mutable = structuredClone(catalog)
  const models = resolveEvaluationModels(defaults, mutable)!
  mutable[0].name = "新名称"
  mutable[0].version = "v2"
  expect(evaluationModelText(models.execution)).toBe("执行 A · v1")
  expect(evaluationModelText(models.judging)).toBe("判定 B")
  expect(models.judging.version).toBeUndefined()
  expect(evaluationModelText()).toBe("未记录")
})

test("默认判定模型始终取列表首项，空列表不伪造模型", () => {
  const first: Model = { id: "first", name: "首项", provider: "p" }
  const deep: Model = { id: "custom-deep", name: "深度", provider: "p", modelLevel: "deep" }
  const expert: Model = { id: "custom-expert", name: "专家", provider: "p", modelLevel: "expert" }
  expect(defaultJudgingModelId([first, deep, expert])).toBe(first.id)
  expect(defaultJudgingModelId([first, deep])).toBe(first.id)
  expect(defaultJudgingModelId([first, catalog[0]])).toBe(first.id)
  expect(defaultJudgingModelId([])).toBe("")
  expect(defaultJudgingModelId([{ ...first, id: "lingee-expert" }])).toBe("lingee-expert")
  const original = { models: resolveEvaluationModels(defaults, catalog)! }
  const updatedDefaults = { execution: first.id, judging: defaultJudgingModelId([first, deep, expert]) }
  expect(initialEvaluationModelIds(updatedDefaults, undefined, original)).toEqual(defaults)
})

test("重跑保留模型快照，下线、供应方或版本变化时不可启动", () => {
  const original = resolveEvaluationModels(defaults, catalog)!
  const changedDefaults = { execution: "judge", judging: "exec" }
  expect(initialEvaluationModelIds(changedDefaults, undefined, { models: original })).toEqual(defaults)
  const resolved = resolveRerunModels(original, [...catalog].reverse())!
  expect(resolved).toEqual(original)
  resolved.execution.name = "不能改写来源"
  expect(original.execution.name).toBe("执行 A")
  expect(resolveRerunModels(undefined, catalog)).toBeUndefined()
  expect(resolveRerunModels(original, catalog.slice(1))).toBeUndefined()
  expect(resolveRerunModels(original, catalog.map(m => ({ ...m, version: "v2" })))).toBeUndefined()
  expect(resolveRerunModels(original, catalog.map(m => ({ ...m, provider: "other" })))).toBeUndefined()
})
