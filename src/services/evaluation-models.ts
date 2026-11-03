import type { Model } from "@/mock/types"

/** 运行时保存目录返回的身份与名称；历史展示不再查询当前模型目录。 */
export interface EvalModelSnapshot { id: string; name: string; provider: string; version?: string }
export interface EvalRunModels { execution: EvalModelSnapshot; judging: EvalModelSnapshot }
export interface EvalModelIds { execution: string; judging: string }

// 原型默认判定配置。等级模型保留目录中的等级身份，不猜测背后的具体模型或版本。
export function defaultJudgingModelId(catalog: readonly Model[]): string {
  return (catalog.find(model => model.modelLevel === "expert" || model.id === "lingee-expert")
    ?? catalog.find(model => model.modelLevel === "deep" || model.id === "lingee-deep")
    ?? catalog[0])?.id ?? ""
}

export function evaluationExecutionDefault(catalog: readonly Model[]): string {
  return catalog[0]?.id ?? ""
}

export function initialEvaluationModelIds(defaults: EvalModelIds, latest?: { models?: EvalRunModels }, original?: { models?: EvalRunModels }): EvalModelIds {
  const source = original ?? latest
  // 明确指定历史运行时，缺失字段必须由用户补选，不能补写今天的默认值。
  if (source) return { execution: source.models?.execution?.id ?? "", judging: source.models?.judging?.id ?? "" }
  return { ...defaults }
}

export function resolveEvaluationModels(ids: EvalModelIds, catalog: readonly Model[]): EvalRunModels | undefined {
  const execution = catalog.find(model => model.id === ids.execution)
  const judging = catalog.find(model => model.id === ids.judging)
  if (!execution || !judging) return undefined
  const snapshot = (model: Model): EvalModelSnapshot => ({ id: model.id, name: model.name, provider: model.provider, ...(model.version ? { version: model.version } : {}) })
  return { execution: snapshot(execution), judging: snapshot(judging) }
}

export function evaluationModelText(model?: EvalModelSnapshot, missing = "未记录") {
  if (!model) return missing
  return `${model.name}${model.version ? ` · ${model.version}` : ""}`
}
