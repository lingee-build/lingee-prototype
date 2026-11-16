import { checksOf, turnsOf, type EvalCase, type EvalCheck } from "./evaluation"
import { caseUsesPlaceholders, previewCase } from "@/vendor/build-evaluation/placeholder-preview"
import { renderPlaceholders, type PlaceholderData } from "@/vendor/build-evaluation/placeholders"

export interface EvaluationParameters {
  data: PlaceholderData
  reuse?: boolean
  mcpSource?: string
}

function placeholderContent(item: EvalCase) {
  const criterion = (check: EvalCheck) => ({ description: check.text })
  return {
    criteria: (item.checks ?? []).map(criterion),
    turns: turnsOf(item).map((turn, index) => ({
      input: turn.input,
      criteria: checksOf(turn, turn.inherit && index ? turnsOf(item)[0].expected : undefined).map(criterion),
      sourceFields: turn.sourceFields,
    })),
  }
}

export const usesEvaluationPlaceholders = (item: EvalCase) => caseUsesPlaceholders(placeholderContent(item))
export const previewEvaluationCase = (item: EvalCase, data: PlaceholderData) => previewCase(placeholderContent(item), data)

export function resolveEvaluationCase(item: EvalCase, data: PlaceholderData, now: number, batchNo: string, source?: EvalCase) {
  if (!usesEvaluationPlaceholders(item)) return item
  const vars: Record<string, string> = {}
  const expected = (value: string) => renderPlaceholders(value, { mode: "expected", data }).value
  const check = (value: EvalCheck) => ({ ...value, text: expected(value.text) })
  const turns = turnsOf(item).map((turn, index) => {
    const sent = renderPlaceholders(turn.input, {
      mode: "send",
      context: { data, now, batchNo, sessionCode: item.businessId ?? item.code ?? item.id, turnIndex: index + 1, vars },
    })
    const reused = source && turnsOf(source)[index]
    return {
      ...turn,
      input: reused?.input ?? sent.value,
      placeholderError: reused ? reused.placeholderError : sent.errors.join("；") || (!sent.value.trim() ? "替换后的问题为空" : undefined),
      expected: expected(turn.expected),
      checks: turn.checks?.map(check),
      sourceFields: turn.sourceFields && Object.fromEntries(Object.entries(turn.sourceFields).map(([key, value]) => [
        key, /^(session|turn):/.test(key) ? expected(value) : value,
      ])),
    }
  })
  return { ...item, input: turns[0].input, expected: expected(item.expected), checks: item.checks?.map(check), turns }
}
