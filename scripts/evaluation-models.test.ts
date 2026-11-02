import { expect, test } from "bun:test"
import { defaultJudgingModelId, evaluationExecutionDefault, evaluationModelText, initialEvaluationModelIds, resolveEvaluationModels } from "../src/services/evaluation-models"
import type { Model } from "../src/mock/types"

const catalog: Model[] = [
  { id: "exec", name: "执行 A", provider: "供应方 A", version: "v1" },
  { id: "judge", name: "判定 B", provider: "供应方 B" },
]
const defaults = { execution: "exec", judging: "judge" }

test("首次采用默认配置，后续采用上次选择，历史重跑优先原运行", () => {
  const first = initialEvaluationModelIds(defaults)
  expect(first).toEqual(defaults)
  const original = { models: resolveEvaluationModels(defaults, catalog)! }
  const latest = { models: resolveEvaluationModels({ execution: "judge", judging: "exec" }, catalog)! }
  expect(initialEvaluationModelIds(defaults, latest)).toEqual({ execution: "judge", judging: "exec" })
  expect(initialEvaluationModelIds(defaults, latest, original)).toEqual(defaults)
  expect(initialEvaluationModelIds(defaults, latest, {})).toEqual({ execution: "", judging: "" })
  expect(defaults).toEqual({ execution: "exec", judging: "judge" })
})

test("模型下线或默认项无法解析时拒绝启动，不静默替换，两个角色可以使用同一模型", () => {
  expect(resolveEvaluationModels(defaults, catalog.slice(0, 1))).toBeUndefined()
  expect(resolveEvaluationModels({ execution: "", judging: "judge" }, catalog)).toBeUndefined()
  expect(resolveEvaluationModels({ execution: "exec", judging: "exec" }, catalog)?.judging.id).toBe("exec")
  expect(evaluationExecutionDefault("exec", "expert")).toBe("lingee-expert")
  expect(evaluationExecutionDefault("exec", "fast")).toBe("lingee-fast")
  expect(evaluationExecutionDefault("exec", "auto")).toBe("exec")
  expect(evaluationExecutionDefault("exec")).toBe("exec")
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

test("默认判定模型按专家、深度、原列表首项回退，空列表不伪造模型", () => {
  const first: Model = { id: "first", name: "首项", provider: "p" }
  const deep: Model = { id: "custom-deep", name: "深度", provider: "p", modelLevel: "deep" }
  const expert: Model = { id: "custom-expert", name: "专家", provider: "p", modelLevel: "expert" }
  expect(defaultJudgingModelId([first, deep, expert])).toBe(expert.id)
  expect(defaultJudgingModelId([first, deep])).toBe(deep.id)
  expect(defaultJudgingModelId([first, catalog[0]])).toBe(first.id)
  expect(defaultJudgingModelId([])).toBe("")
  expect(defaultJudgingModelId([{ ...first, id: "lingee-expert" }])).toBe("lingee-expert")
  const original = { models: resolveEvaluationModels(defaults, catalog)! }
  const updatedDefaults = { execution: first.id, judging: defaultJudgingModelId([first, deep, expert]) }
  expect(initialEvaluationModelIds(updatedDefaults, undefined, original)).toEqual(defaults)
})
