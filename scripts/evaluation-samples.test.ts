import { test, expect } from "bun:test"
import { completeEvaluationSample } from "../src/services/evaluation-samples"
import { checkValidation, checkKind } from "../src/services/evaluation"

test("完整示例覆盖表单字段、四类标准和全部检查方式，附件具有实际内容", () => {
  const sample = completeEvaluationSample("发货通知单查询")
  expect(sample.name.trim()).not.toBe("")
  expect(sample.turns!.length).toBe(3)
  expect(sample.attachments!.length).toBeGreaterThan(0)
  expect(sample.turns!.flatMap(t => t.attachments).length).toBeGreaterThan(0)
  expect(sample.turns!.flatMap(t => t.rules).length).toBeGreaterThan(1)
  for (const turn of sample.turns!) {
    expect(turn.input.trim()).not.toBe("")
    for (const rule of turn.rules) {
      expect(rule.match.trim()).not.toBe("")
      expect(rule.responses[0].trim()).not.toBe("")
    }
  }
  const checks = [...sample.checks!, ...sample.turns!.flatMap(t => t.checks!)]
  expect(new Set(checks.map(checkKind)).size).toBe(4)
  expect(new Set(sample.checks!.map(checkKind)).size).toBe(4)
  expect(new Set(checks.map(c => c.operator).filter(Boolean)).size).toBe(7)
  for (const c of checks) expect(checkValidation(c)).toBe("")
  for (const f of [...sample.attachments!, ...sample.turns!.flatMap(t => t.attachments)]) {
    const text = decodeURIComponent(f.data.split(',').slice(1).join(','))
    expect(new TextEncoder().encode(text).length).toBe(f.size)
  }
  const next = completeEvaluationSample("发货通知单查询")
  expect(next.id).not.toBe(sample.id)
  expect(next.turns![0].id).not.toBe(sample.turns![0].id)
})
