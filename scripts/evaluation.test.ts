import { test, expect, beforeEach, afterAll } from "bun:test"
import { basicEvaluationSample } from "../src/services/evaluation-samples"
import type { EvalCase } from "../src/services/evaluation"
const memory = new Map<string, string>()
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  },
  configurable: true,
})
const { useEvaluation, saveCases, startRun, cancelRun, advanceRuns } = await import("../src/services/evaluation")
const realNow = Date.now
let now = 100000
Date.now = () => now
afterAll(() => {
  Date.now = realNow
})
beforeEach(() => {
  now = 100000
  useEvaluation.setState({ cases: {}, runs: {}, error: false })
})
const sample = {
  id: "case-1",
  name: "Original",
  input: "Request",
  expected: "Ask first",
  source: "tenant" as const,
  outcome: "failed" as const,
}
// 状态机测试显式提供执行材料；缺证据的用例继续验证无法判定。
const demoSample = (outcome: "passed" | "failed") => ({ ...basicEvaluationSample({ ...sample, outcome }), id: sample.id })
const stateEvidence = (verdict: "passed" | "failed", files: string[] = []): EvalCase["demoEvidence"] => ({
  turns: [0, 1, 2].map(() => ({ response: verdict === "passed" ? "已满足标准" : "未满足标准", clarification: "本轮未发生澄清。", files,
    judgments: [{ check: { text: "标准" }, verdict, actual: "已记录标准检查结果", evidence: "状态机测试的固定执行材料" }] })), overall: [],
})
test("运行持久化两个模型，重载与重跑不修改原运行或开发对话配置", async () => {
  const { initialEvaluationModelIds, resolveEvaluationModels } = await import("../src/services/evaluation-models")
  const { usePrompt } = await import("../src/stores/prompt")
  const conversationModel = usePrompt.getState().modelId
  const catalog = [
    { id: "execution-a", name: "执行 A", provider: "provider-a", version: "2026-11" },
    { id: "judging-b", name: "判定 B", provider: "provider-b" },
  ]
  const selected = { execution: "execution-a", judging: "judging-b" }
  const models = resolveEvaluationModels(selected, catalog)!
  const snapshot = structuredClone(models)
  const key = "skill:model-test"
  saveCases(key, [sample])
  startRun(key, "Skill", [sample], "sandbox", models)
  models.execution.name = "不能污染旧记录"
  now += 4000; advanceRuns()
  const original = structuredClone(useEvaluation.getState().runs[key][0])
  expect(original.models).toEqual(snapshot)
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().runs[key][0].models).toEqual(snapshot)
  const ids = initialEvaluationModelIds({ execution: "other", judging: "other" }, undefined, original)
  expect(ids).toEqual(selected)
  saveCases(key, [{ ...sample, input: "最新输入" }])
  const { latestRunCases } = await import("../src/services/evaluation")
  startRun(key, "Skill", latestRunCases(key, original).cases, "sandbox", resolveEvaluationModels(ids, catalog))
  const rerun = useEvaluation.getState().runs[key][0]
  expect(rerun.models).toEqual(snapshot)
  expect(rerun.results[0].input).toBe("最新输入")
  expect(useEvaluation.getState().runs[key][1]).toEqual(original)
  expect(usePrompt.getState().modelId).toBe(conversationModel)
})

test("模型配置无效或运行记录无法持久化时不创建运行", () => {
  const model = { id: "a", name: "A", provider: "provider" }
  expect(startRun("invalid-model", "Skill", [sample], "sandbox", { execution: model, judging: { ...model, id: "" } })).toBeUndefined()
  expect(useEvaluation.getState().runs["invalid-model"]).toBeUndefined()
  const write = localStorage.setItem
  try {
    localStorage.setItem = () => { throw new Error("QuotaExceededError") }
    expect(startRun("storage-failure", "Skill", [sample], "sandbox", { execution: model, judging: model })).toBeUndefined()
    expect(useEvaluation.getState().runs["storage-failure"]).toBeUndefined()
    expect(useEvaluation.getState().error).toBe(true)
  } finally {
    localStorage.setItem = write
    useEvaluation.setState({ error: false })
  }
})
test("selected cases are snapshotted; edits and reruns do not replace prior records", () => {
  saveCases("skill:1", [sample, { ...sample, id: "case-2" }])
  const id = startRun("skill:1", "Skill", [sample])!
  saveCases("skill:1", [{ ...sample, input: "Changed" }])
  expect(useEvaluation.getState().runs["skill:1"][0].results).toHaveLength(1)
  expect(useEvaluation.getState().runs["skill:1"][0].results[0].input).toBe("Request")
  expect(startRun("skill:1", "Skill", [sample])).toBeUndefined()
  now += 3000
  advanceRuns()
  const original = useEvaluation.getState().runs["skill:1"][0]
  expect(original.status).toBe("completed")
  expect(original.results[0].status).toBe("failed")
  const second = startRun("skill:1", "Skill", original.results)
  expect(second).not.toBe(id)
  expect(useEvaluation.getState().runs["skill:1"]).toHaveLength(2)
  expect(useEvaluation.getState().runs["skill:1"][1]).toEqual(original)
})
test("objects are isolated and stopped cases cannot later complete", () => {
  const id = startRun("agent:1", "Agent", [sample, { ...sample, id: "case-2" }])!
  expect(useEvaluation.getState().runs["skill:1"]).toBeUndefined()
  now += 2500
  advanceRuns()
  cancelRun("agent:1", id)
  now += 10000
  advanceRuns()
  const run = useEvaluation.getState().runs["agent:1"][0]
  expect(run.status).toBe("cancelled")
  expect(run.results.map((c) => c.status)).toEqual(["failed", "cancelled"])
})
test("persisted records rehydrate and retain snapshots after case deletion", async () => {
  saveCases("skill:1", [sample])
  startRun("skill:1", "Skill", [sample])
  now += 3000
  advanceRuns()
  saveCases("skill:1", [])
  const saved = memory.get("lingee.evaluation.v1")!
  useEvaluation.setState({ cases: {}, runs: {} })
  memory.set("lingee.evaluation.v1", saved)
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().cases["skill:1"]).toEqual([])
  expect(useEvaluation.getState().runs["skill:1"][0].results[0].expected).toBe("Ask first")
})
test("all outcomes remain distinct and empty runs are rejected", () => {
  expect(startRun("skill:1", "Skill", [])).toBeUndefined()
  startRun(
    "skill:1",
    "Skill",
    ["passed", "failed", "blocked"].map((outcome, i) => ({
      ...sample,
      id: String(i),
      outcome: outcome as "passed" | "failed" | "blocked",
    })),
  )
  advanceRuns()
  expect(useEvaluation.getState().runs["skill:1"][0].results[0].status).toBe("running")
  now += 8000
  advanceRuns()
  expect(useEvaluation.getState().runs["skill:1"][0].results.map((c) => c.status)).toEqual(["passed", "failed", "blocked"])
})

test("in-flight runs and editing drafts survive rehydration", async () => {
  useEvaluation.setState({ drafts: { "skill:1": sample } })
  startRun("skill:1", "Skill", [sample])
  const saved = memory.get("lingee.evaluation.v1")!
  useEvaluation.setState({ drafts: {}, runs: {} })
  memory.set("lingee.evaluation.v1", saved)
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().drafts["skill:1"]?.input).toBe("Request")
  now += 3000
  advanceRuns()
  const run = useEvaluation.getState().runs["skill:1"][0]
  expect(run.status).toBe("completed")
  cancelRun("skill:1", run.id)
  expect(useEvaluation.getState().runs["skill:1"][0].status).toBe("completed")
})

test("multi-turn run snapshots rules and advances each round independently", () => {
  const c = { ...sample, outcome: "passed" as const, turns: [
    { id: "t1", input: "first", expected: "expected", attachments: [], rules: [{ id: "r1", match: "organization", responses: ["company"] }] },
    { id: "t2", input: "follow-up", expected: "", inherit: true, attachments: [], rules: [] },
  ] }
  startRun("skill:multi", "Multi", [c])
  c.turns[0].rules[0].responses[0] = "changed"
  now += 2500; advanceRuns()
  let result = useEvaluation.getState().runs["skill:multi"][0].results[0]
  expect(result.roundResults?.[0].status).toBe("passed")
  expect(result.roundResults?.[1].status).toBe("running")
  expect(result.roundResults?.[0].rules[0].responses[0]).toBe("company")
  expect(result.roundResults?.[1].expected).toBe("expected")
  now += 2500; advanceRuns()
  expect(useEvaluation.getState().runs["skill:multi"][0].status).toBe("completed")
})

test("custom checks preserve reference isolation and never pass without evidence", () => {
  const check = { id: "check", text: "Approve", required: true, reference: "approved", files: [{ id: "answer", name: "answer.xlsx", data: "", size: 1 }] }
  startRun("skill:1", "Skill", [{ ...sample, checks: [check] }])
  check.reference = "changed"
  now += 3000; advanceRuns()
  const run = useEvaluation.getState().runs["skill:1"][0]
  expect(run.results[0].checks?.[0].reference).toBe("approved")
  expect(run.results[0].attachments).toBeUndefined()
  expect(run.results[0].verdict).toBe("unknown")
  expect(run.results[0].execution).toBe("completed")
  const id = startRun("skill:1", "Skill", run.results)!
  const next = useEvaluation.getState().runs["skill:1"].find(r => r.id === id)!
  expect(next.results[0].verdict).toBeUndefined()
  expect(next.results[0].roundResults?.[0].checkResults).toBeUndefined()
})

test("critical failure cannot be hidden by passes and unassessed cases stay unknown", async () => {
  const { aggregateChecks, checksOf } = await import("../src/services/evaluation")
  const c = { id: "check", text: "Approve", required: true, files: [], actual: "", evidence: "" }
  expect(aggregateChecks([{ ...c, verdict: "passed" }, { ...c, verdict: "failed" }, { ...c, verdict: "unknown" }])).toBe("failed")
  expect(aggregateChecks([{ ...c, verdict: "na" }])).toBe("unknown")
  expect(aggregateChecks([{ ...c, verdict: "passed" }, { ...c, verdict: "unknown" }])).toBe("unknown")
  expect(checksOf({ id: "old", expected: "legacy answer", input: "", attachments: [], rules: [] })[0].text).toBe("legacy answer")
  expect(checksOf({ id: "old", checks: [], expected: "legacy answer", input: "", attachments: [], rules: [] })).toEqual([])
})

test("all criteria use the same verdict policy regardless of legacy required flag", async () => {
  const { aggregateChecks } = await import("../src/services/evaluation")
  const c = { id: "check", text: "Business criterion", required: false, files: [], actual: "", evidence: "" }
  expect(aggregateChecks([{ ...c, verdict: "failed" }, { ...c, verdict: "unknown" }])).toBe("failed")
  expect(aggregateChecks([{ ...c, verdict: "passed" }, { ...c, verdict: "na" }])).toBe("passed")
  expect(aggregateChecks([])).toBe("unknown")
})


test("typed checks validate regex and relative paths without losing rule semantics", async () => {
  const { checkValidation, checkDescription } = await import("../src/services/evaluation")
  const base = { id: "typed", text: "[", required: true, files: [], kind: "text" as const, operator: "regex" as const }
  expect(checkValidation(base)).toContain("正则")
  expect(checkValidation({ ...base, text: "客户.*状态" })).toBe("")
  const file = { ...base, kind: "file" as const, operator: "not_exists" as const, text: "../report.xlsx" }
  expect(checkValidation(file)).toContain("相对路径")
  expect(checkValidation({ ...file, text: "outputs/report.xlsx" })).toBe("")
  expect(checkDescription({ ...file, text: "outputs/report.xlsx" })).toBe("文件存在性 · 不存在：outputs/report.xlsx")
  expect(checkDescription({ ...base, operator: "none", text: " 错误\n失败 " })).toBe("关键词匹配 · 不包含任一关键词：错误、失败")
})


test("legacy text checks map by operator without altering historical data", async () => {
  const { checkKind, checkDescription, checkValidation } = await import("../src/services/evaluation")
  const legacy = { id: "legacy", kind: "text" as const, operator: "not_regex" as const, text: "客户.*状态", required: true, files: [] }
  expect(checkKind(legacy)).toBe("regex")
  expect(checkDescription(legacy)).toBe("正则匹配 · 不匹配正则表达式：客户.*状态")
  expect(legacy.kind).toBe("text")
  expect(checkKind({ ...legacy, operator: "all" })).toBe("keyword")
  expect(checkValidation({ ...legacy, kind: "regex", text: "[" })).toContain("正则")
})

test("rerun resolves latest selected cases and reports deletions without changing history", async () => {
  const { latestRunCases } = await import("../src/services/evaluation")
  saveCases("skill:test", [sample, { ...sample, id: "deleted" }])
  startRun("skill:test", "Test", [sample, { ...sample, id: "deleted" }], "sandbox")
  const original = useEvaluation.getState().runs["skill:test"][0]
  cancelRun("skill:test", original.id)
  saveCases("skill:test", [{ ...sample, input: "Updated" }, { ...sample, id: "new" }])
  const latest = latestRunCases("skill:test", original)
  expect(latest.cases.map(c => c.id)).toEqual([sample.id])
  expect(latest.cases[0].input).toBe("Updated")
  expect(latest.missing.map(c => c.id)).toEqual(["deleted"])
  startRun("skill:test", "Test", latest.cases, "sandbox")
  const runs = useEvaluation.getState().runs["skill:test"]
  expect(runs[0].environment).toBe("sandbox")
  expect(runs[1].environment).toBe("sandbox")
  expect(runs[1].results[0].input).toBe("Request")
  saveCases("skill:test", [])
  expect(latestRunCases("skill:test", original).cases).toHaveLength(0)
})

test("execution failures stay unknown, stop later rounds and appear in report", async () => {
  const { executionIssues } = await import("../src/services/evaluation")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  for (const demoFailure of Object.keys(executionIssues) as (keyof typeof executionIssues)[]) {
    const turn = { id: "t1", input: "查询", expected: "返回结果", rules: [], attachments: [] }
    const key = `skill:${demoFailure}`
    startRun(key, "Test", [{ ...sample, demo: true, outcome: "blocked", demoFailure, turns: [turn, { ...turn, id: "t2" }] }])
    now += 3000
    advanceRuns()
    const run = useEvaluation.getState().runs[key][0]
    expect(run.results[0].verdict).toBe("unknown")
    expect(run.results[0].roundResults?.[0].issue).toBe(demoFailure)
    expect(run.results[0].roundResults?.[1].status).toBe("skipped")
    expect(run.results[0].roundResults?.[1].tool).toBe("")
    const html = buildReportDocument(run)
    expect(html).toContain(executionIssues[demoFailure].reason)
    expect(html).toContain(executionIssues[demoFailure].action)
    expect(run.environment).toBe("sandbox")
    expect(html).not.toContain("<dt>运行环境</dt>")
  }
})

test("file evidence distinguishes existence, missing artifacts and unavailable execution", async () => {
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  for (const [key, demo, operator] of [["exists", true, "exists"], ["absent", true, "not_exists"], ["unknown", false, "exists"]] as const) {
    startRun(key, "File", [{ ...sample, demo, demoEvidence: stateEvidence("passed", key === "exists" ? ["outputs/result.txt"] : []), outcome: "passed", checks: [{ id: "file", kind: "file", operator, text: "outputs/result.txt", required: true, files: [] }] }])
    now += 3000; advanceRuns()
    const run = useEvaluation.getState().runs[key][0]
    const check = run.results[0].checkResults![0]
    if (!demo) {
      expect(check.verdict).toBe("unknown")
      expect(check.fileEvidence).toBeUndefined()
    } else {
      expect(check.fileEvidence?.path).toBe("outputs/result.txt")
      expect(check.fileEvidence?.exists).toBe(operator === "exists")
      expect(buildReportDocument(run)).not.toContain("下载文件")
    }
  }
})

test("repair handoff selects failed snapshots and excludes binary attachments", async () => {
  const { repairPrompt } = await import("../src/services/evaluation-repair")
  startRun("skill:repair", "技能", [{ ...demoSample("failed"), attachments: [{ id: "a", name: "单据.txt", size: 4, data: "binary-secret" }] }, { ...demoSample("passed"), id: "passed" }])
  now += 6000; advanceRuns()
  const run = useEvaluation.getState().runs["skill:repair"][0]
  const prompt = repairPrompt("skill:repair", run)
  expect(prompt).toContain("/kingdee-skill-creator")
  expect(prompt).not.toContain("单据.txt")
  expect(prompt.length).toBeLessThan(500)
  expect(prompt).not.toContain("binary-secret")
  expect(prompt).toContain("不放宽用例标准")
  expect(prompt).not.toContain("不默认改写所挂载技能或知识源")
  expect(prompt).not.toContain('"用例编号": "passed"')
  expect(repairPrompt("skill:repair", run, "passed")).toBe("")
  expect(repairPrompt("skill:repair", run, "missing")).toBe("")
})

test("repair availability covers running, passed, unknown, stopped and unsupported targets", async () => {
  const { repairDisabledReason } = await import("../src/services/evaluation-repair")
  startRun("skill:r", "技能", [demoSample("failed")])
  let run = useEvaluation.getState().runs["skill:r"][0]
  expect(repairDisabledReason("skill:r", run, true)).toBe("评测结束后可修复")
  now += 3000; advanceRuns()
  run = useEvaluation.getState().runs["skill:r"][0]
  expect(repairDisabledReason("skill:r", run, true)).toBe("")
  expect(repairDisabledReason("skill:r", { ...run, status: "cancelled" }, true)).toBe("")
  expect(repairDisabledReason("agent:r", { ...run, objectType: "agent" }, true)).toBe("")
  expect(repairDisabledReason("mcpapp:r", run, true)).toContain("不支持")
  expect(repairDisabledReason("skill:r", run, false)).toContain("不可编辑")
  for (const verdict of ["passed", "unknown"] as const) {
    const other = { ...run, results: [{ ...run.results[0], verdict }] }
    expect(repairDisabledReason("skill:r", other, true)).toContain("没有可修复")
    expect(repairDisabledReason("skill:r", other, true, sample.id)).toBe(verdict === "passed" ? "此用例已通过，无需修复" : "暂无明确的不通过依据，请先检查执行结果")
  }
})

test("points aggregate rounds and judging without treating missing records as zero", async () => {
  const { runPoints, casePoints, pointsText } = await import("../src/services/evaluation-points")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const c = { ...sample, demo: true, outcome: "passed" as const, checks: [{ id: "overall", text: "正确", required: true, files: [] }], turns: [
    { id: "one", input: "查询", expected: "正确", rules: [], attachments: [] },
    { id: "two", input: "继续", expected: "正确", rules: [], attachments: [] },
  ] }
  startRun("points", "Test", [c]); now += 3000; advanceRuns()
  const running = useEvaluation.getState().runs.points[0]
  expect(runPoints(running).execution).toBeCloseTo(0.48)
  cancelRun("points", running.id)
  expect(runPoints(useEvaluation.getState().runs.points[0])).toEqual(runPoints(running))
  startRun("points", "Test", [c]); now += 6000; advanceRuns()
  const run = useEvaluation.getState().runs.points[0]
  expect(runPoints(run).execution).toBeCloseTo(0.76)
  expect(runPoints(run).judging).toBeCloseTo(0.24)
  expect(pointsText(runPoints(run))).toBe("消耗点数：1.00")
  expect(buildReportDocument(run)).toContain("消耗点数：1.00")
  const legacy = { ...run.results[0], overallJudgingPoints: undefined, roundResults: run.results[0].roundResults!.map(t => ({ ...t, points: undefined })) }
  expect(pointsText(casePoints(legacy))).toBe("消耗点数：暂未获取")
  expect(pointsText(runPoints({ ...run, results: [run.results[0], legacy] }))).toBe("已获取消耗点数：1.00 · 统计不完整")
})

test("停止保留前轮失败，后续未开始轮次标记未执行，修复入口可用", async () => {
  const { verdictLabel } = await import("../src/services/evaluation")
  const { repairDisabledReason } = await import("../src/services/evaluation-repair")
  const turn = (id: string) => ({ id, input: "输入", expected: "", attachments: [], rules: [], checks: [{ id: id + "-check", text: "标准", required: true, files: [] }] })
  const id = startRun("skill:stop", "测试", [{ ...sample, demo: true, demoEvidence: stateEvidence("failed"), turns: [turn("a"), turn("b"), turn("c")] }])!
  now += 2500; advanceRuns()
  expect(useEvaluation.getState().runs["skill:stop"][0].results[0].roundResults?.[1].status).toBe("running")
  cancelRun("skill:stop", id)
  const run = useEvaluation.getState().runs["skill:stop"][0]
  expect(run.results[0].roundResults?.map(t => t.status)).toEqual(["failed", "cancelled", "skipped"])
  expect(verdictLabel(run.results[0])).toBe("不通过")
  expect(repairDisabledReason("skill:stop", run, true)).toBe("")
  now += 20000; advanceRuns()
  expect(useEvaluation.getState().runs["skill:stop"][0]).toEqual(run)
})

test("停止未出现失败的用例不能通过，未启动用例为未执行", async () => {
  const { verdictLabel } = await import("../src/services/evaluation")
  const turn = (id: string) => ({ id, input: "输入", expected: "标准", attachments: [], rules: [] })
  const id = startRun("skill:stop-pass", "测试", [{ ...sample, demo: true, demoEvidence: stateEvidence("passed"), outcome: "passed", turns: [turn("a"), turn("b")] }, { ...sample, id: "later" }])!
  now += 2500; advanceRuns(); cancelRun("skill:stop-pass", id)
  const results = useEvaluation.getState().runs["skill:stop-pass"][0].results
  expect(verdictLabel(results[0])).toBe("无法判定")
  expect(results[0].roundResults?.[0].checkResults?.[0].verdict).toBe("passed")
  expect(results[1].status).toBe("skipped")
})

test("文件证据按各轮与整体时点记录，后续推进不改写前轮", () => {
  const check = { id: "file", kind: "file" as const, operator: "exists" as const, text: "outputs/result.txt", required: true, files: [] }
  const turn = (id: string) => ({ id, input: "输入", expected: "", attachments: [], rules: [], checks: [{ ...check, id }] })
  startRun("skill:time", "测试", [{ ...sample, outcome: "passed", demo: true, demoEvidence: stateEvidence("passed", ["outputs/result.txt"]), checks: [check], turns: [turn("a"), turn("b")] }])
  now += 2500; advanceRuns()
  const first = useEvaluation.getState().runs["skill:time"][0].results[0].roundResults![0].checkResults![0]
  expect(first.fileEvidence?.checkedAt).toBe(102400)
  now += 2500; advanceRuns()
  const result = useEvaluation.getState().runs["skill:time"][0].results[0]
  expect(result.roundResults![0].checkResults![0]).toEqual(first)
  expect(result.roundResults![1].checkResults![0].fileEvidence?.checkedAt).toBe(104800)
  expect(result.checkResults![0].fileEvidence?.checkedAt).toBe(104800)
})

test("完整性校验保留必填规则，不使用未确认的长度或容量限制", async () => {
  const { caseValidation } = await import("../src/services/evaluation")
  const attachment = (id: string, mb: number) => ({ id, name: id, size: mb * 1024 * 1024, data: "" })
  const value = { ...sample, attachments: [attachment("a", 15), attachment("b", 15)] }
  expect(caseValidation(value)).toBe("")
  value.attachments = [attachment("a", 20)]
  expect(caseValidation(value)).toBe("")
  expect(caseValidation({ ...value, name: " " })).toContain("用例名称")
  expect(caseValidation({ ...value, expected: "" })).toContain("至少添加")
  const turn = { id: "t", input: "请求", expected: "标准", attachments: [attachment("c", 21)], rules: [] }
  expect(caseValidation({ ...value, turns: [turn] })).toBe("")
  const long = { ...value, name: "名".repeat(121), turns: [{ ...turn, input: "输入".repeat(5001) }] }
  expect(caseValidation(long)).toBe("")
  expect(caseValidation({ ...long, turns: [{ ...turn, input: " " }] })).toContain("用户输入")
  expect(caseValidation({ ...value, turns: [{ ...turn, attachments: [], rules: [{ id: "r", match: "问题", responses: [" "] }] }] })).toContain("澄清")
})

test("P2 停止补齐逐项终态并保留已有失败，报告读取相同证据", async () => {
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const check = { id: "check", text: "要求", required: true, files: [] }
  const value = { ...sample, checks: [{ ...check, id: "overall" }], turns: [{ id: "turn", input: "请求", expected: "", attachments: [], rules: [], checks: [check] }] }
  const id = startRun("skill:p2", "对象", [value])!
  cancelRun("skill:p2", id)
  const run = useEvaluation.getState().runs["skill:p2"][0]
  expect(run.results[0].checkResults![0].verdict).toBe("unknown")
  expect(run.results[0].roundResults![0].checkResults![0].evidence).toContain("运行已停止")
  expect(buildReportDocument(run)).not.toContain("暂无判定")
  expect(buildReportDocument(run)).toContain("运行已停止，缺少所需证据")
  const { completeStoppedChecks } = await import("../src/services/evaluation")
  const failed = { ...check, verdict: "failed" as const, actual: "失败", evidence: "已有证据" }
  expect(completeStoppedChecks([check], [failed])[0]).toEqual(failed)
})

test("production and unknown environments cannot create runs", () => {
  expect(startRun("skill:1", "Skill", [sample], "production")).toBeUndefined()
  expect(startRun("skill:1", "Skill", [sample], "unknown" as any)).toBeUndefined()
  expect(useEvaluation.getState().runs["skill:1"]).toBeUndefined()
})

test("stop request blocks new runs until acknowledgment and survives rehydration", async () => {
  const { requestCancelRun } = await import("../src/services/evaluation")
  const id = startRun("skill:1", "Skill", [sample])!
  requestCancelRun("skill:1", id)
  expect(useEvaluation.getState().runs["skill:1"][0].status).toBe("stopping")
  expect(startRun("skill:1", "Skill", [sample])).toBeUndefined()
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().runs["skill:1"][0].status).toBe("stopping")
  advanceRuns()
  expect(useEvaluation.getState().runs["skill:1"][0].status).toBe("cancelled")
  now += 10000
  advanceRuns()
  expect(useEvaluation.getState().runs["skill:1"][0].status).toBe("cancelled")
})

test("failed persistence keeps saved cases unchanged and allows retry", () => {
  expect(saveCases("skill:1", [sample])).toBe(true)
  const write = localStorage.setItem
  localStorage.setItem = () => { throw new Error("quota") }
  try {
    expect(saveCases("skill:1", [{ ...sample, name: "Edited" }])).toBe(false)
    expect(useEvaluation.getState().cases["skill:1"][0].name).toBe("Original")
    expect(useEvaluation.getState().error).toBe(true)
  } finally { localStorage.setItem = write }
  expect(saveCases("skill:1", [{ ...sample, name: "Edited" }])).toBe(true)
  expect(useEvaluation.getState().error).toBe(false)
  expect(JSON.parse(memory.get("lingee.evaluation.v1")!).state.cases["skill:1"][0].name).toBe("Edited")
})

test("tool failure finalizes unexecuted round checks as unknown in results and report", async () => {
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const check = { id: "check", kind: "natural" as const, text: "应返回查询结果", required: true, files: [] }
  const turn = { id: "t1", input: "查询", expected: "", attachments: [], rules: [], checks: [check] }
  startRun("skill:1", "Skill", [{ ...sample, demo: true, outcome: "blocked", demoFailure: "tool_unavailable", turns: [turn, { ...turn, id: "t2" }] }])
  now += 10000
  advanceRuns()
  const run = useEvaluation.getState().runs["skill:1"][0]
  const next = run.results[0].roundResults![1]
  expect(next.status).toBe("skipped")
  expect(next.checkResults![0].verdict).toBe("unknown")
  expect(next.checkResults![0].evidence).toContain("前序轮次执行异常")
  const report = buildReportDocument(run, (s: string) => s)
  expect(report).toContain("前序轮次执行异常")
  expect(report).not.toContain("暂无判定")
})

test("judging is active and cancelling it preserves completed execution", async () => {
  const { isActiveRun, requestCancelRun, verdictLabel, executionLabel } = await import("../src/services/evaluation")
  const check = { id: "overall", kind: "natural" as const, text: "满足要求", required: true, files: [] }
  const id = startRun("skill:judge", "Skill", [{ ...sample, demo: true, outcome: "passed", checks: [check], demoJudgingDelayMs: 3000 }])!
  now += 2500
  advanceRuns()
  const run = useEvaluation.getState().runs["skill:judge"][0]
  expect(run.status).toBe("judging")
  expect(isActiveRun(run)).toBe(true)
  expect(verdictLabel(run.results[0])).toBe("判定中")
  expect(executionLabel(run.results[0])).toBe("已完成")
  expect(startRun("skill:judge", "Skill", [sample])).toBeUndefined()
  requestCancelRun("skill:judge", id)
  advanceRuns()
  const stopped = useEvaluation.getState().runs["skill:judge"][0]
  expect(stopped.status).toBe("cancelled")
  expect(executionLabel(stopped.results[0])).toBe("已完成")
  expect(stopped.results[0].checkResults![0].verdict).toBe("unknown")
  now += 10000
  advanceRuns()
  expect(useEvaluation.getState().runs["skill:judge"][0]).toEqual(stopped)
})

test("unconfirmed stop survives refresh and only verified termination unlocks", async () => {
  const { requestCancelRun, isActiveRun } = await import("../src/services/evaluation")
  const id = startRun("skill:verify", "Skill", [sample])!
  requestCancelRun("skill:verify", id, true)
  now += 1500
  advanceRuns()
  await useEvaluation.persist.rehydrate()
  const run = useEvaluation.getState().runs["skill:verify"][0]
  expect(run.status).toBe("stop_unconfirmed")
  expect(isActiveRun(run)).toBe(true)
  now += 100000
  advanceRuns()
  expect(startRun("skill:verify", "Skill", [sample])).toBeUndefined()
  cancelRun("skill:verify", id, "error")
  expect(useEvaluation.getState().runs["skill:verify"][0].status).toBe("error")
  expect(startRun("skill:verify", "Skill", [sample])).toBeDefined()
})

test("simulated judge failure preserves execution and permits later rounds", () => {
  const check = { id: "judge", kind: "natural" as const, text: "业务要求", required: true, files: [] }
  const turn = { id: "one", input: "查询", expected: "", attachments: [], rules: [], checks: [check] }
  startRun("skill:failure", "Skill", [{ ...sample, demo: true, demoEvidence: stateEvidence("passed"), outcome: "passed", demoJudgingFailure: "timeout", turns: [turn, { ...turn, id: "two" }] }])
  now += 6000
  advanceRuns()
  const run = useEvaluation.getState().runs["skill:failure"][0]
  expect(run.status).toBe("completed")
  expect(run.results[0].execution).toBe("completed")
  expect(run.results[0].roundResults!.map(t => t.status)).toEqual(["passed", "passed"])
  expect(run.results[0].verdict).toBe("unknown")
  expect(run.results[0].roundResults![0].checkResults![0].evidence).toContain("重试结束")
})

test("point queries preserve results and failed refresh keeps last successful query time", async () => {
  const { refreshRunPoints, pointsText, runPoints } = await import("../src/services/evaluation-points")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const id = startRun("credits", "Skill", [{ ...sample, demo: true }])!
  now += 4000; advanceRuns()
  const original = structuredClone(useEvaluation.getState().runs.credits[0])
  const querying = refreshRunPoints("credits", id)
  expect(useEvaluation.getState().runs.credits[0].pointsQuery?.status).toBe("loading")
  await querying
  const completed = useEvaluation.getState().runs.credits[0]
  const queriedAt = completed.pointsQuery!.queriedAt
  expect(completed.pointsQuery?.status).toBe("complete")
  const downloaded = buildReportDocument(completed)
  now += 1000
  await refreshRunPoints("credits", id, "unavailable")
  const failed = useEvaluation.getState().runs.credits[0]
  expect(failed.pointsQuery!.queriedAt).toBe(queriedAt)
  expect(pointsText(runPoints(failed))).toContain("统计不完整")
  expect(failed.results[0].verdict).toBe(original.results[0].verdict)
  expect(failed.results[0].checkResults).toEqual(original.results[0].checkResults)
  expect(failed.status).toBe(original.status)
  expect(useEvaluation.getState().runs.credits).toHaveLength(1)
  expect(downloaded).toContain("点数更新时间")
  expect(downloaded).not.toContain("暂不可获取")
  await refreshRunPoints("credits", id, "pending")
  expect(pointsText(runPoints(useEvaluation.getState().runs.credits[0]))).toContain("统计中")
  await refreshRunPoints("credits", id, "exhausted")
  expect(pointsText(runPoints(useEvaluation.getState().runs.credits[0]))).toContain("统计不完整")
})

test("point status distinguishes complete zero, missing and failed query", async () => {
  const { pointsText } = await import("../src/services/evaluation-points")
  const zero = { execution: 0, judging: 0, recorded: true, missing: false }
  expect(pointsText(zero)).toBe("消耗点数：0.00")
  expect(pointsText({ ...zero, recorded: false, status: "loading" })).toBe("消耗点数：统计中")
  expect(pointsText({ ...zero, recorded: false, status: "unavailable" })).toBe("消耗点数：暂未获取")
  expect(pointsText({ ...zero, missing: true, status: "pending" })).toContain("统计中")
})

test("point query transient loading is recoverable from storage and legacy state", async () => {
  const { refreshRunPoints } = await import("../src/services/evaluation-points")
  const id = startRun("reload-points", "Skill", [{ ...sample, demo: true }])!
  now += 4000; advanceRuns()
  await refreshRunPoints("reload-points", id)
  const before = useEvaluation.getState().runs["reload-points"][0].pointsQuery!
  const pending = refreshRunPoints("reload-points", id)
  const stored = memory.get("lingee.evaluation.v1")!
  expect(JSON.parse(stored).state.runs["reload-points"][0].pointsQuery.status).toBe("unavailable")
  await pending
  memory.set("lingee.evaluation.v1", stored)
  await useEvaluation.persist.rehydrate()
  const restored = useEvaluation.getState().runs["reload-points"][0].pointsQuery!
  expect(restored.status).toBe("unavailable")
  expect(restored.amount).toEqual(before.amount)
  expect(restored.queriedAt).toBe(before.queriedAt)
  await refreshRunPoints("reload-points", id)
  expect(useEvaluation.getState().runs["reload-points"][0].pointsQuery?.status).toBe("complete")
  const old = JSON.parse(memory.get("lingee.evaluation.v1")!)
  old.state.runs["reload-points"][0].pointsQuery = { status: "loading", queriedAt: 123 }
  memory.set("lingee.evaluation.v1", JSON.stringify(old))
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().runs["reload-points"][0].pointsQuery?.status).toBe("unavailable")
  expect(useEvaluation.getState().runs["reload-points"][0].pointsQuery?.queriedAt).toBeUndefined()
  await refreshRunPoints("reload-points", id)
  expect(useEvaluation.getState().runs["reload-points"][0].pointsQuery?.status).toBe("complete")
})

test("point snapshot amount and time stay paired while execution advances", async () => {
  const { refreshRunPoints, runPoints, casePoints, turnPointsText, liveRunPoints } = await import("../src/services/evaluation-points")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const id = startRun("snapshot-points", "Skill", [{ ...sample, demo: true }])!
  advanceRuns()
  await refreshRunPoints("snapshot-points", id)
  const before = useEvaluation.getState().runs["snapshot-points"][0]
  const savedPoints = runPoints(before)
  const savedCase = casePoints(before.results[0])
  const savedTurn = turnPointsText(before.results[0].roundResults![0])
  now += 4000; advanceRuns()
  const after = useEvaluation.getState().runs["snapshot-points"][0]
  expect(liveRunPoints(after).execution).toBeGreaterThan(savedPoints.execution)
  expect(runPoints(after)).toEqual(savedPoints)
  expect(casePoints(after.results[0])).toEqual(savedCase)
  expect(turnPointsText(after.results[0].roundResults![0])).toBe(savedTurn)
  expect(after.pointsQuery).toEqual(before.pointsQuery)
  const downloaded = buildReportDocument(after)
  await refreshRunPoints("snapshot-points", id)
  const refreshed = useEvaluation.getState().runs["snapshot-points"][0]
  expect(refreshed.pointsQuery!.queriedAt).toBeGreaterThan(before.pointsQuery!.queriedAt!)
  expect(runPoints(refreshed).execution).toBe(liveRunPoints(refreshed).execution)
  expect(downloaded).toContain("消耗点数：0.12")
  expect(buildReportDocument(refreshed)).not.toContain("消耗点数：0.12")
})

test("finished case progress excludes judging and includes terminal unknown or stopped cases", async () => {
  const { finishedCaseCount } = await import("../src/services/evaluation")
  const id = startRun("progress", "Skill", [{ ...sample, demo: true, demoJudgingDelayMs: 3000 }])!
  now += 2500; advanceRuns()
  expect(finishedCaseCount(useEvaluation.getState().runs.progress[0])).toBe(0)
  cancelRun("progress", id)
  expect(finishedCaseCount(useEvaluation.getState().runs.progress[0])).toBe(1)
  const run = useEvaluation.getState().runs.progress[0]
  expect(finishedCaseCount({ ...run, results: [{ ...run.results[0], status: "passed", judging: false, verdict: "unknown" }] })).toBe(1)
})


test("partial round usage retains independent overall snapshot through failure and reload", async () => {
  const { refreshRunPoints, overallPoints, overallPointsText, runPoints } = await import("../src/services/evaluation-points")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const key = "partial-overall"
  const check = { id: "overall", kind: "natural" as const, text: "满足要求", required: true, files: [] }
  const id = startRun(key, "Skill", [{ ...sample, demo: true, checks: [check] }])!
  now += 4000; advanceRuns()
  useEvaluation.setState(s => ({ runs: { ...s.runs, [key]: s.runs[key].map(r => ({ ...r, results: r.results.map(c => ({ ...c, overallJudgingPoints: 0.08, roundResults: c.roundResults!.map(t => ({ ...t, points: undefined })) })) })) } }))
  await refreshRunPoints(key, id)
  const saved = useEvaluation.getState().runs[key][0]
  expect(runPoints(saved).missing).toBe(true)
  expect(overallPoints(saved.results[0])).toBe(0.08)
  expect(overallPointsText(saved.results[0])).toBe("消耗点数：0.08")
  expect(buildReportDocument(saved)).toContain("已获取消耗点数：0.08 · 统计不完整")
  expect(buildReportDocument(saved)).not.toContain("<h4>整体标准判定</h4>")
  useEvaluation.setState(s => ({ runs: { ...s.runs, [key]: s.runs[key].map(r => ({ ...r, results: r.results.map(c => ({ ...c, overallJudgingPoints: 0.16 })) })) } }))
  await refreshRunPoints(key, id, "unavailable")
  await useEvaluation.persist.rehydrate()
  expect(overallPoints(useEvaluation.getState().runs[key][0].results[0])).toBe(0.08)
  expect(useEvaluation.getState().runs[key][0].pointsQuery!.queriedAt).toBe(saved.pointsQuery!.queriedAt)
  now += 1000
  await refreshRunPoints(key, id)
  expect(overallPoints(useEvaluation.getState().runs[key][0].results[0])).toBe(0.16)
  const result = saved.results[0]
  expect(overallPointsText({ ...result, overallPointsSnapshot: { complete: false } })).toBe("消耗点数：暂未获取")
  expect(overallPointsText({ ...result, overallPointsSnapshot: { amount: 0, complete: true } })).toBe("消耗点数：0.00")
  // 旧的部分快照不从当前实时值补写，须成功刷新后恢复明细。
  expect(overallPoints({ ...result, overallPointsSnapshot: undefined })).toBeUndefined()
})

test("first query failure never claims a successful snapshot, later failure retains its source", async () => {
  const { refreshRunPoints, pointsSourceText, pointsText, runPoints } = await import("../src/services/evaluation-points")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const key = "first-query-source"
  const id = startRun(key, "Skill", [{ ...sample, demo: true }])!
  now += 4000; advanceRuns()
  expect(pointsSourceText(useEvaluation.getState().runs[key][0])).toBe("")
  const first = refreshRunPoints(key, id, "unavailable")
  expect(pointsSourceText(useEvaluation.getState().runs[key][0])).not.toContain("已查询点数快照")
  await first
  await useEvaluation.persist.rehydrate()
  const failed = useEvaluation.getState().runs[key][0]
  expect(pointsSourceText(failed)).toBe("")
  expect(pointsText(runPoints(failed))).not.toContain("已查询点数")
  expect(failed.pointsQuery!.queriedAt).toBeUndefined()
  expect(buildReportDocument(failed)).toContain("统计不完整")
  await refreshRunPoints(key, id)
  const saved = useEvaluation.getState().runs[key][0].pointsQuery!
  expect(pointsSourceText(useEvaluation.getState().runs[key][0])).toContain("更新于")
  const second = refreshRunPoints(key, id, "unavailable")
  expect(pointsSourceText(useEvaluation.getState().runs[key][0])).toContain("更新于")
  await second
  expect(pointsSourceText(useEvaluation.getState().runs[key][0])).toContain("更新于")
  expect(useEvaluation.getState().runs[key][0].pointsQuery!.amount).toEqual(saved.amount)
  expect(useEvaluation.getState().runs[key][0].pointsQuery!.queriedAt).toBe(saved.queriedAt)
  const unknown = { ...failed, pointsQuery: undefined, results: [] }
  expect(pointsSourceText(unknown)).toBe("")
})

test("repair context updates original ID even with duplicate names and misleading prompt", async () => {
  const { registerEvaluationRepair, evaluationRepairTarget, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const { pickScenario } = await import("../src/mock/scenarios")
  const { devStore } = await import("../src/mock/dev-store")
  const { latestRunCases } = await import("../src/services/evaluation")
  const originalSkills = structuredClone(devStore.skills)
  try {
    const skill = devStore.skills[0]
    const duplicate = { ...structuredClone(skill), id: "duplicate-id", name: "duplicate-name", changed: false }
    devStore.skills = [{ ...skill, changed: false }, duplicate]
    const key = `skill:${skill.id}`
    saveCases(key, [demoSample("failed")])
    const runId = startRun(key, skill.displayName, useEvaluation.getState().cases[key])!
    now += 4000; advanceRuns()
    const oldRun = structuredClone(useEvaluation.getState().runs[key][0])
    const session = { id: "repair-binding", projectId: skill.projectId, title: "修复", status: "idle" as const, time: { created: now, updated: now } }
    registerEvaluationRepair(session, "原提示", { objectType: "skill", objectId: skill.id, runId })
    await useEvaluationRepairs.persist.rehydrate()
    expect(evaluationRepairTarget(session.id)).toEqual({ objectType: "skill", objectId: skill.id, runId })
    const scenario = pickScenario({ projectId: skill.projectId, repairTarget: evaluationRepairTarget(session.id), prompt: "/ai-partner-creator 请新建采购价格异常预警，编辑【duplicate-name】" })
    const result = scenario.steps.at(-1)!.resolve!()
    expect(devStore.skills).toHaveLength(2)
    expect(devStore.skills.find(s => s.id === skill.id)?.changed).toBe(true)
    expect(devStore.skills.find(s => s.id === duplicate.id)).toEqual(duplicate)
    expect(result.card!().config.id).toBe(skill.name)
    expect(useEvaluationRepairs.getState().links[session.id]).toBe(`/dev/skill/${encodeURIComponent(skill.id)}/evaluation?view=report&run=${runId}`)
    saveCases(key, [{ ...sample, demo: true, input: "最新内容" }])
    const nextId = startRun(key, skill.displayName, latestRunCases(key, oldRun).cases)
    expect(nextId).not.toBe(runId)
    expect(useEvaluation.getState().runs[key][0].results[0].input).toBe("最新内容")
    expect(useEvaluation.getState().runs[key][1]).toEqual(oldRun)
    expect(useEvaluation.getState().runs[`skill:${duplicate.id}`]).toBeUndefined()
  } finally { devStore.skills = originalSkills }
})

test("legacy repair binding restores from original route and missing targets never create skills", async () => {
  const { evaluationRepairTarget, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const { pickScenario } = await import("../src/mock/scenarios")
  const { devStore } = await import("../src/mock/dev-store")
  const before = structuredClone(devStore.skills)
  useEvaluationRepairs.setState({ items: {}, links: { legacy: "/dev/skill/original%20id/evaluation?run=run%201", invalid: "/invalid" } })
  expect(evaluationRepairTarget("legacy")).toEqual({ objectType: "skill", objectId: "original id", runId: "run 1" })
  expect(evaluationRepairTarget("normal")).toBeUndefined()
  for (const target of [evaluationRepairTarget("invalid")!, { objectType: "skill" as const, objectId: "missing", runId: "r" }, { objectType: "skill" as const, objectId: before[0].id, runId: "r" }]) {
    const scenario = pickScenario({ prompt: "创建技能", projectId: "wrong-project", repairTarget: target })
    const result = scenario.steps.at(-1)!.resolve!()
    expect(result.text).toContain("已停止修复")
    expect(result.card).toBeUndefined()
    expect(devStore.skills).toEqual(before)
  }
})

test("智能体修复选择失败证据、遵循同一可用条件并打开原对象入口", async () => {
  const { repairPrompt, repairDisabledReason, evaluationRepairObject } = await import("../src/services/evaluation-repair")
  const { devStore } = await import("../src/mock/dev-store")
  const agent = devStore.agents[0]
  const key = `agent:${agent.id}`
  const failed = { ...demoSample("failed"), attachments: [{ id: "file", name: "业务材料.txt", size: 1, data: "binary-secret" }] }
  startRun(key, agent.name, [failed, { ...demoSample("passed"), id: "passed" }, { ...failed, id: "second-failure" }])
  let run = useEvaluation.getState().runs[key][0]
  for (const status of ["running", "judging", "stopping", "stop_unconfirmed"] as const) {
    expect(repairDisabledReason(key, { ...run, status }, true)).toBe("评测结束后可修复")
  }
  now += 10000; advanceRuns()
  run = useEvaluation.getState().runs[key][0]
  expect(repairDisabledReason(key, run, true)).toBe("")
  expect(repairDisabledReason(key, run, false)).toBe("智能体已删除或当前不可编辑")
  expect(repairDisabledReason(key, run, true, "passed")).toBe("此用例已通过，无需修复")
  expect(repairDisabledReason(key, { ...run, results: [{ ...run.results[0], verdict: "unknown" }] }, true)).toContain("没有可修复")
  const prompt = repairPrompt(key, run)
  expect(prompt).toStartWith("/ai-partner-creator 请根据当前关联的评测报告，分析并修复智能体")
  expect(prompt).toContain(agent.name)
  expect(prompt).not.toContain("业务材料.txt")
  expect(prompt).toContain("2 条不通过用例")
  expect(prompt).not.toContain('"用例编号": "passed"')
  expect(prompt).not.toContain("binary-secret")
  expect(prompt).toContain("不放宽用例标准")
  expect(prompt).toContain("不默认改写所挂载技能或知识源")
  expect(repairPrompt(key, run, sample.id)).not.toContain('"用例编号": "second-failure"')
  expect(repairPrompt(key, run, "passed")).toBe("")
  expect(evaluationRepairObject(key)).toEqual({ objectType: "agent", objectId: agent.id, projectId: agent.projectId, editTarget: { agent: agent.id } })
  expect(evaluationRepairObject("agent:missing")).toBeUndefined()
})

test("智能体修复恢复后仍只修改原对象，卡片及重跑保持原关联", async () => {
  const { registerEvaluationRepair, evaluationRepairTarget, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const { pickScenario } = await import("../src/mock/scenarios")
  const { devStore } = await import("../src/mock/dev-store")
  const { latestRunCases } = await import("../src/services/evaluation")
  const originalAgents = structuredClone(devStore.agents)
  const originalSkills = structuredClone(devStore.skills)
  try {
    const agent = structuredClone(devStore.agents[0])
    const duplicate = { ...structuredClone(agent), id: "duplicate-agent", isChanged: false }
    devStore.agents = [agent, duplicate]
    const key = `agent:${agent.id}`
    saveCases(key, [demoSample("failed")])
    const runId = startRun(key, agent.name, useEvaluation.getState().cases[key])!
    now += 4000; advanceRuns()
    const oldRun = structuredClone(useEvaluation.getState().runs[key][0])
    const session = { id: "agent-repair-binding", projectId: agent.projectId, title: "修复", status: "idle" as const, time: { created: now, updated: now } }
    const target = { objectType: "agent" as const, objectId: agent.id, runId }
    registerEvaluationRepair(session, "预填的历史证据", target)
    await useEvaluationRepairs.persist.rehydrate()
    expect(evaluationRepairTarget(session.id)).toEqual(target)
    expect(useEvaluationRepairs.getState().items[session.id].messages).toHaveLength(0)
    const result = pickScenario({ projectId: agent.projectId, repairTarget: evaluationRepairTarget(session.id), prompt: `/kingdee-skill-creator 新建采购价格异常预警，编辑【${duplicate.name}】` }).steps.at(-1)!.resolve!()
    const updated = devStore.agents.find(item => item.id === agent.id)!
    expect(devStore.agents).toHaveLength(2)
    expect(updated.status).toBe("saved")
    expect(updated.isChanged).toBe(!!agent.backendStatus)
    expect(updated.backendStatus).toBe(agent.backendStatus)
    expect(updated.changelog.pending).toHaveLength(agent.changelog.pending.length + 1)
    expect(updated.changelog.versions).toEqual(agent.changelog.versions)
    expect(updated.role).toBe(agent.role)
    expect(updated.skills).toEqual(agent.skills)
    expect(updated.knowledge).toEqual(agent.knowledge)
    expect(devStore.agents.find(item => item.id === duplicate.id)).toEqual(duplicate)
    expect(devStore.skills).toEqual(originalSkills)
    expect(result.card!()).toEqual({ kind: "ai-partner", config: { id: agent.id, title: agent.name } })
    expect(useEvaluationRepairs.getState().links[session.id]).toBe(`/dev/agent/${encodeURIComponent(agent.id)}/evaluation?view=report&run=${runId}`)
    saveCases(key, [{ ...sample, demo: true, input: "最新智能体用例输入" }])
    expect(startRun(key, agent.name, latestRunCases(key, oldRun).cases)).not.toBe(runId)
    expect(useEvaluation.getState().runs[key][0].results[0].input).toBe("最新智能体用例输入")
    expect(useEvaluation.getState().runs[key][1]).toEqual(oldRun)
  } finally { devStore.agents = originalAgents }
})

test("修复兼容旧技能绑定和两类返回链接，智能体目标失效时禁止修改或新建", async () => {
  const { evaluationRepairTarget, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const { pickScenario } = await import("../src/mock/scenarios")
  const { devStore } = await import("../src/mock/dev-store")
  const agent = devStore.agents[0]
  const session = { id: "old-skill", projectId: "p", title: "修复", status: "idle" as const, time: { created: now, updated: now } }
  useEvaluationRepairs.setState({ items: { "old-skill": { session, messages: [], draft: "", target: { skillId: "original-skill", runId: "r" } } }, links: { "old-agent": "/dev/agent/agent%20id/evaluation?run=run%201" } })
  expect(evaluationRepairTarget("old-skill")).toEqual({ objectType: "skill", objectId: "original-skill", runId: "r" })
  expect(evaluationRepairTarget("old-agent")).toEqual({ objectType: "agent", objectId: "agent id", runId: "run 1" })
  const before = structuredClone(devStore)
  for (const target of [{ objectId: "missing", runId: "r" }, { objectId: agent.id, runId: "r" }, { objectId: agent.id, runId: "" }]) {
    const result = pickScenario({ projectId: "wrong-project", repairTarget: { objectType: "agent", ...target }, prompt: "/ai-partner-creator 创建智能体" }).steps.at(-1)!.resolve!()
    expect(result.text).toContain("已停止修复")
    expect(result.card).toBeUndefined()
  }
  useEvaluation.setState({ deletedObjects: { [`agent:${agent.id}`]: true } })
  const stopped = pickScenario({ projectId: agent.projectId, repairTarget: { objectType: "agent", objectId: agent.id, runId: "r" }, prompt: "修复" }).steps.at(-1)!.resolve!()
  expect(stopped.text).toContain("已停止修复")
  expect(devStore).toEqual(before)
  useEvaluation.setState({ deletedObjects: {} })
})

test("三轮用例中断不新建整体判定，保留失败且后续轮次未执行", () => {
  const overall = { id: "overall", text: "整体要求", required: true, files: [] }
  const interrupted = { ...sample, demo: true, outcome: "blocked" as const, checks: [overall], turns: [0, 1, 2].map(i => ({ id: `t${i}`, input: "input", expected: "", attachments: [], rules: [], checks: [{ ...overall, id: `c${i}` }] })) }
  const id = startRun("skill:interrupt", "Skill", [interrupted])!
  useEvaluation.setState(s => ({ runs: { ...s.runs, "skill:interrupt": s.runs["skill:interrupt"].map(r => ({ ...r, results: r.results.map(c => ({ ...c, roundResults: c.roundResults?.map((t, i) => i ? t : { ...t, checkResults: [{ ...overall, id: "c0", verdict: "failed", actual: "已确认违反要求", evidence: "原证据" }] }) })) })) } }))
  now += 2500; advanceRuns()
  const result = useEvaluation.getState().runs["skill:interrupt"][0].results[0]
  expect(result.verdict).toBe("failed")
  expect(result.checkResults?.[0].verdict).toBe("unknown")
  expect(result.overallJudgingPoints).toBe(0)
  expect(result.roundResults?.map(t => t.status)).toEqual(["blocked", "skipped", "skipped"])
  expect(result.roundResults?.[0].checkResults?.[0].evidence).toBe("原证据")
  const stopped = startRun("skill:stop-overall", "Skill", [{ ...interrupted, outcome: "passed" }])!
  cancelRun("skill:stop-overall", stopped)
  now += 20000; advanceRuns()
  const after = useEvaluation.getState().runs["skill:stop-overall"][0].results[0]
  expect(after.checkResults?.[0].verdict).toBe("unknown")
  expect(after.overallJudgingPoints).toBe(0)
})

test("rerun scopes share repair failures and only detect deletions inside selected scope", async () => {
  const { latestRunCases, failedRunResults } = await import("../src/services/evaluation")
  const { repairPrompt, registerEvaluationRepair, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const key = "skill:sk_delivery"
  const source = ["passed", "failed", "unknown"].map((verdict, i) => ({ ...sample, id: `scope-${i}`, name: verdict, demo: true }))
  saveCases(key, source)
  const id = startRun(key, "测试", source)!
  const run = structuredClone(useEvaluation.getState().runs[key][0])
  run.status = "completed"
  run.results.forEach((r, i) => { r.status = "passed"; r.verdict = ["passed", "failed", "unknown"][i] as "passed" | "failed" | "unknown" })
  const failures = failedRunResults(run).map(c => c.id)
  expect(failures).toEqual(["scope-1"])
  expect(repairPrompt(key, run)).toContain("1 条不通过用例")
  expect(repairPrompt(key, run)).not.toContain('"用例编号": "scope-2"')
  saveCases(key, source.slice(1).map(c => ({ ...c, input: "latest" })))
  expect(latestRunCases(key, run).missing.map(c => c.id)).toEqual(["scope-0"])
  expect(latestRunCases(key, run, failures).missing).toEqual([])
  expect(latestRunCases(key, run, failures).cases[0].input).toBe("latest")
  expect(latestRunCases(key, run, ["scope-2"]).cases.map(c => c.id)).toEqual(["scope-2"])
  saveCases(key, [])
  expect(latestRunCases(key, run, failures).cases).toEqual([])
  expect(latestRunCases(key, run, failures).missing).toHaveLength(1)
  const session = { id: "single-return", projectId: "project", title: "修复", status: "idle" as const, time: { created: now, updated: now } }
  registerEvaluationRepair(session, "修复", { objectType: "skill", objectId: "sk_delivery", runId: id, resultId: "scope-1" })
  expect(useEvaluationRepairs.getState().links[session.id]).toEndWith(`?view=report&run=${id}&focusCase=scope-1`)
})

test("自动点数更新有上限，重新进入恢复查询且不创建运行", async () => {
  const { updateAutomaticPoints, resumeRunPoints } = await import("../src/services/evaluation-points")
  const id = startRun("auto-points", "Skill", [{ ...sample, demo: true }])!
  await Promise.all([updateAutomaticPoints(now), updateAutomaticPoints(now)])
  expect(useEvaluation.getState().runs['auto-points'][0].pointsQuery?.status).toBe("pending")
  now += 4000; advanceRuns()
  // 模拟缺失的历史点数，不能凭空补成零。
  useEvaluation.setState(s => ({ runs: { ...s.runs, 'auto-points': s.runs['auto-points'].map(r => ({ ...r, results: r.results.map(c => ({ ...c, overallJudgingPoints: undefined })) })) } }))
  for (let i = 0; i < 3; i++) { now += 6000; await updateAutomaticPoints(now) }
  const run = structuredClone(useEvaluation.getState().runs['auto-points'][0])
  expect(run.pointsQuery?.status).toBe("missing")
  now += 6000; await updateAutomaticPoints(now)
  expect(useEvaluation.getState().runs['auto-points'][0].pointsQuery?.queriedAt).toBe(run.pointsQuery?.queriedAt)
  resumeRunPoints('auto-points', id)
  await updateAutomaticPoints(now)
  expect(useEvaluation.getState().runs['auto-points'][0].pointsQuery?.queriedAt).toBe(now)
  expect(useEvaluation.getState().runs['auto-points']).toHaveLength(1)
  expect(useEvaluation.getState().runs['auto-points'][0].results[0].response).toBe(run.results[0].response)
})

test("点数演示保持选定状态，恢复后自动查询且不改变运行结论", async () => {
  const { refreshRunPoints, updateAutomaticPoints, resumeRunPoints } = await import("../src/services/evaluation-points")
  const key = "points-demo"
  const id = startRun(key, "Skill", [{ ...sample, demo: true }])!
  await updateAutomaticPoints(now)
  now += 4000; advanceRuns()
  const original = structuredClone(useEvaluation.getState().runs[key][0])
  for (const mode of ["pending", "unavailable", "exhausted"] as const) {
    await refreshRunPoints(key, id, mode)
    const snapshot = structuredClone(useEvaluation.getState().runs[key][0].pointsQuery)
    now += 20000
    await updateAutomaticPoints(now)
    expect(useEvaluation.getState().runs[key][0].pointsQuery).toEqual(snapshot)
    expect(snapshot?.status).toBe(mode)
  }
  resumeRunPoints(key, id)
  await updateAutomaticPoints(now)
  expect(useEvaluation.getState().runs[key][0].pointsQuery?.status).toBe("complete")
  await refreshRunPoints(key, id, "unavailable")
  await refreshRunPoints(key, id, "normal")
  const restored = useEvaluation.getState().runs[key][0]
  expect(restored.pointsQuery?.status).toBe("complete")
  expect(restored.results[0].verdict).toBe(original.results[0].verdict)
  expect(restored.results[0].checkResults).toEqual(original.results[0].checkResults)
  expect(useEvaluation.getState().runs[key]).toHaveLength(1)
})

test("新运行记录单例起止时间，整体按最后完成时点；重载与重跑保留旧记录", async () => {
  const key = "duration"
  startRun(key, "Skill", [{ ...sample, demoJudgingDelayMs: 6000 }, { ...sample, id: "second" }])!
  advanceRuns()
  expect(useEvaluation.getState().runs[key][0].results.map(c => c.timing)).toEqual([{ started: 100000, ended: undefined }, {}])
  now = 102500; advanceRuns()
  let run = useEvaluation.getState().runs[key][0]
  expect(run.results[0].judging).toBe(true)
  expect(run.results[1].timing?.started).toBe(102400)
  now = 110000; advanceRuns()
  run = useEvaluation.getState().runs[key][0]
  expect(run.ended).toBe(108400)
  expect(run.results.map(c => c.timing)).toEqual([{ started: 100000, ended: 108400 }, { started: 102400, ended: 104900 }])
  const original = structuredClone(run)
  await useEvaluation.persist.rehydrate()
  expect(useEvaluation.getState().runs[key][0].results.map(c => c.timing)).toEqual(original.results.map(c => c.timing))
  startRun(key, "Skill", original.results)
  expect(useEvaluation.getState().runs[key][0].results.every(c => c.timing?.started === undefined && c.timing?.ended === undefined)).toBe(true)
  expect(useEvaluation.getState().runs[key][1]).toEqual(original)
})

test("停止确认固定已开始用例耗时，未开始的不写零耗时；异常按实际中断时点结束", () => {
  const key = "stopped-duration"
  const id = startRun(key, "Skill", [sample, { ...sample, id: "second" }])!
  advanceRuns()
  now += 1200
  cancelRun(key, id)
  const stopped = structuredClone(useEvaluation.getState().runs[key][0])
  expect(stopped.ended).toBe(101200)
  expect(stopped.results[0].timing).toEqual({ started: 100000, ended: 101200 })
  expect(stopped.results[1].status).toBe("skipped")
  expect(stopped.results[1].timing).toEqual({})
  now += 20000; advanceRuns()
  expect(useEvaluation.getState().runs[key][0]).toEqual(stopped)
  const start = now
  const turns = [0, 1, 2].map(i => ({ id: `turn-${i}`, input: "请求", expected: "结果", attachments: [], rules: [] }))
  startRun("blocked-duration", "Skill", [{ ...sample, demo: true, outcome: "blocked", turns }])
  now += 3000; advanceRuns()
  const blocked = useEvaluation.getState().runs["blocked-duration"][0]
  expect(blocked.ended).toBe(start + 2400)
  expect(blocked.results[0].timing).toEqual({ started: start, ended: start + 2400 })
})

test("首轮多个硬规则失败均留证据，跳过语义、后轮和整体，其他用例继续且历史不变", async () => {
  const { completeEvaluationSample } = await import("../src/services/evaluation-samples")
  const { buildReportDocument } = await import("../src/features/evaluation/report-document")
  const failed = completeEvaluationSample("硬规则失败")
  failed.demoEvidence!.turns[0].response = "不满足任何格式"
  const following = demoSample("passed")
  startRun("skill:short-circuit", "硬规则验证", [failed, following])
  now += 2500; advanceRuns()
  let run = useEvaluation.getState().runs["skill:short-circuit"][0]
  expect(run.results[0].verdict).toBe("failed")
  expect(run.results[0].roundResults!.slice(1).map(t => t.status)).toEqual(["skipped", "skipped"])
  expect(run.results[0].roundResults![0].checkResults!.filter(c => c.kind === "natural").every(c => c.verdict === "skipped")).toBe(true)
  expect(run.results[0].roundResults![0].checkResults!.filter(c => c.verdict === "failed").length).toBeGreaterThan(1)
  expect(run.results[0].checkResults!.every(c => c.verdict === "skipped")).toBe(true)
  expect(run.results[1].status).toBe("running")
  expect(run.results[0].timing!.ended! - run.results[0].timing!.started!).toBe(2400)
  now += 3000; advanceRuns()
  run = useEvaluation.getState().runs["skill:short-circuit"][0]
  expect(run.status).toBe("completed")
  expect(run.results[1].verdict).toBe("passed")
  expect(buildReportDocument(run)).toContain("已跳过")
  const snapshot = JSON.stringify(run); now += 10000; advanceRuns()
  expect(JSON.stringify(useEvaluation.getState().runs["skill:short-circuit"][0])).toBe(snapshot)
})

test("已有对话修复先确认候选，读取指定旧报告；报告失效不修改", async () => {
  const { conversationRepairScenario } = await import("../src/mock/scenarios/evaluation-repair-dialog")
  const { evaluationRepairEvidence, evaluationRepairTarget, useEvaluationRepairs } = await import("../src/services/evaluation-repair")
  const { devStore } = await import("../src/mock/dev-store")
  const skill = devStore.skills[0]
  const key = `skill:${skill.id}`
  startRun(key, skill.displayName, [demoSample("failed")]); now += 3000; advanceRuns()
  const oldRun = useEvaluation.getState().runs[key][0]
  startRun(key, skill.displayName, [demoSample("passed")]); now += 3000; advanceRuns()
  const session = { id: "existing-repair", projectId: skill.projectId, title: "已有对话", status: "idle" as const, time: { created: now, updated: now } }
  const scenario = conversationRepairScenario(session, `修复评测 ${skill.id} ${oldRun.id}`)
  expect(scenario.steps[0].question![0].options).toHaveLength(1)
  expect(scenario.steps[1].resolve!().card).toBeUndefined()
  scenario.steps[0].onAnswer!([[scenario.steps[0].question![0].options[0].label]])
  const changed = skill.changed
  try {
    expect(scenario.steps[1].resolve!().card).toBeDefined()
    expect(evaluationRepairTarget(session.id)?.runId).toBe(oldRun.id)
    expect(useEvaluationRepairs.getState().items[session.id].owned).toBe(false)
    expect(evaluationRepairEvidence(evaluationRepairTarget(session.id)!, skill.projectId)?.failures).toHaveLength(1)
    useEvaluation.setState({ runs: {} })
    expect(scenario.steps[1].resolve!().card).toBeUndefined()
  } finally { devStore.skills = devStore.skills.map(s => s.id === skill.id ? { ...s, changed } : s) }
})
