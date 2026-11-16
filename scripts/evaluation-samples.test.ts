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
  expect(sample.checks).toHaveLength(1)
  expect(checkKind(sample.checks![0])).toBe("natural")
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

import { basicEvaluationSample } from "../src/services/evaluation-samples"
import { startRun, advanceRuns, useEvaluation, resultIssueSummary, type EvalCase, type EvalRun } from "../src/services/evaluation"
import { matchEvaluationText } from "../src/services/evaluation-text"
import { buildReportDocument } from "../src/features/evaluation/report-document"

function finishSample(value: EvalCase): EvalRun {
  const key = `skill:sample-${crypto.randomUUID()}`
  startRun(key, "示例证据核对", [value])
  const started = useEvaluation.getState().runs[key][0].started
  const realNow = Date.now
  try { Date.now = () => started + 30000; advanceRuns() } finally { Date.now = realNow }
  return useEvaluation.getState().runs[key][0]
}

const basic = (outcome: "passed" | "failed") => basicEvaluationSample({ name: "明确需求", input: "具体编号稍后补充", expected: "缺少编号应先询问", source: "tenant", outcome })

test("完整示例逐轮回复满足全部文本标准，页面与报告保留具体工具依据", () => {
  const run = finishSample(completeEvaluationSample("发货通知单查询"))
  const result = run.results[0]
  expect(result.verdict).toBe("passed")
  expect(result.roundResults![0].response).toContain("FHTZ-20261030-001")
  expect(result.roundResults![0].response).toContain("优品科技")
  expect(result.roundResults![1].response).toContain("未发40件")
  expect(result.roundResults![2].response).toContain("outputs/查询汇总.txt")
  for (const turn of result.roundResults!) {
    for (const check of turn.checkResults!) {
      expect(check.verdict).toBe("passed")
      if (checkKind(check) === "keyword" || checkKind(check) === "regex") {
        expect(matchEvaluationText(turn.response, check.text, check.operator as "all")).toBe(true)
        expect(check.evidence).toContain(turn.response)
      }
    }
  }
  const report = buildReportDocument(run)
  expect(report).toContain(result.roundResults![0].toolResult!)
  expect(report).toContain("100／60")
  expect(report).not.toContain("示例结果满足这条标准")
  expect(resultIssueSummary(result)).toBe("")
})

test("预设通过不能覆盖缺少关键词、正则不匹配，整体文本不读取前轮回复", () => {
  const sample = completeEvaluationSample("反例")
  sample.demoEvidence!.turns[0].response = "已完成请求。业务记录 DEMO-001。仅第一轮出现"
  sample.checks!.push({ id: "last-only", kind: "keyword", operator: "all", text: "仅第一轮出现", required: true, files: [] })
  const result = finishSample(sample).results[0]
  const checks = result.roundResults![0].checkResults!
  expect(checks.find(c => c.kind === "keyword")!.verdict).toBe("failed")
  expect(checks.find(c => c.kind === "regex")!.verdict).toBe("failed")
  expect(result.checkResults!.find(c => c.id === "last-only")!.verdict).toBe("skipped")
  expect(result.verdict).toBe("failed")
  expect(resultIssueSummary(result)).toContain("第 1 轮：缺少关键词：FHTZ-20261030-001、优品科技")
})

test("文件存在性由对应时点产物清单决定，否定检查也不能从预设结果倒推", () => {
  const sample = completeEvaluationSample("文件反例")
  sample.demoEvidence!.turns[2].files = ["outputs/客户联系方式.txt"]
  const result = finishSample(sample).results[0]
  const files = result.roundResults![2].checkResults!.filter(c => c.kind === "file")
  expect(files.map(c => c.verdict)).toEqual(["failed", "failed"])
  expect(files.map(c => c.fileEvidence!.exists)).toEqual([false, true])
  expect(result.checkResults!.map(c => c.verdict)).toEqual(["skipped"])
})

test("语义依据只匹配原标准，未知标准、编辑后及旧版示例均不假通过", () => {
  const modified = completeEvaluationSample("未知语义")
  modified.turns![0].checks![0].text = "还必须审批通过"
  expect(finishSample(modified).results[0].roundResults![0].checkResults![0].verdict).toBe("unknown")
  const custom = completeEvaluationSample("编辑后")
  custom.demo = false
  const customResult = finishSample(custom).results[0]
  expect(customResult.verdict).toBe("unknown")
  expect(customResult.roundResults![0].responseRecorded).toBe(false)
  const legacy = completeEvaluationSample("旧示例")
  delete legacy.demoEvidence
  const oldResult = finishSample(legacy).results[0]
  expect(oldResult.verdict).toBe("unknown")
  expect(resultIssueSummary(oldResult)).toContain("添加新版示例")
})

test("摘要区分业务失败、工具异常和判定超时；明确失败优先且活动状态不显示问题摘要", () => {
  const run = finishSample(basic("failed"))
  const failed = run.results[0]
  expect(resultIssueSummary(failed)).toBe("第 1 轮：未询问缺失的业务编号，直接使用 DEMO-001 执行。")
  const blocked = finishSample({ ...basic("passed"), outcome: "blocked", demoFailure: "tool_unavailable" }).results[0]
  expect(resultIssueSummary(blocked)).toContain("工具调用：当前环境未提供所需工具")
  const unknown = finishSample({ ...basic("passed"), demoJudgingFailure: "timeout" }).results[0]
  expect(unknown.verdict).toBe("unknown")
  expect(resultIssueSummary(unknown)).toContain("未取得有效判定")
  expect(resultIssueSummary({ ...failed, status: "running" })).toBe("")
  expect(resultIssueSummary({ ...failed, judging: true })).toBe("")
  const interrupted = structuredClone(failed)
  interrupted.roundResults![0].issue = "timeout"
  interrupted.status = "cancelled"
  expect(resultIssueSummary(interrupted)).toBe(resultIssueSummary(failed))
  expect(buildReportDocument(run)).toContain(resultIssueSummary(failed))
})

test("修正示例并新建运行，不改写已有运行；缺失历史原因不补写示例事实", () => {
  const sample = completeEvaluationSample("保留历史")
  const run = finishSample(sample)
  const snapshot = JSON.stringify(run)
  sample.demoEvidence!.turns[0].response = "已改变的回复"
  const next = finishSample(sample)
  expect(next.results[0].verdict).toBe("failed")
  expect(JSON.stringify(run)).toBe(snapshot)
  const legacy = { ...run.results[0], verdict: "unknown" as const, roundResults: undefined, checkResults: undefined }
  expect(resultIssueSummary(legacy)).toBe("未记录具体原因，请查看已有结果与证据。")
})

// No implicit overall evaluation: verdict is aggregated from configured standards.
test("单轮和多轮无整体标准均按轮次汇总，报告不显示空整体区", () => {
  for (const sample of [basic("passed"), { ...completeEvaluationSample("多轮无整体"), checks: [] }]) {
    const run = finishSample(sample)
    expect(run.results[0].verdict).toBe("passed")
    expect(run.results[0].checkResults).toEqual([])
    expect(run.results[0].overallJudgingPoints).toBe(0)
    expect(buildReportDocument(run)).not.toContain("整体验收标准")
  }
})
test("已有单轮整体标准继续参与判定，不能因只有一轮而忽略失败", () => {
  const sample = basic("passed")
  sample.checks = [{ id: "legacy", kind: "keyword", operator: "all", text: "不存在的关键词", required: true, files: [] }]
  const run = finishSample(sample)
  expect(run.results[0].verdict).toBe("failed")
  expect(run.results[0].checkResults![0].verdict).toBe("failed")
  expect(buildReportDocument(run)).toContain("整体验收标准")
})

test("多轮整体失败影响最终结论", () => {
  const sample = completeEvaluationSample("整体失败")
  sample.demoEvidence!.overall![0].verdict = "failed"
  const result = finishSample(sample).results[0]
  expect(result.roundResults!.flatMap(t => t.checkResults!).every(c => c.verdict === "passed")).toBe(true)
  expect(result.verdict).toBe("failed")
})
