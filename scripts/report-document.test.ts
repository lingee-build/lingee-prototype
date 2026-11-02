import { test, expect } from "bun:test"
import { buildReportDocument } from "../src/features/evaluation/report-document"
import { clarificationText, type EvalRun } from "../src/services/evaluation"
import fixture from "../outputs/delivery-demo/模拟结果.json"
const run = fixture.state.runs["skill:sk_delivery"][0] as EvalRun

test("报告总耗时与单例耗时读取同一记录，缺失历史不反推或写成零", () => {
  const value = structuredClone(run)
  value.started = 1000; value.ended = 66000; value.status = "completed"
  value.results = value.results.slice(0, 1)
  value.results[0].timing = { started: 1000, ended: 3500 }
  const html = buildReportDocument(value)
  expect(html).toContain("耗时：<strong>1 分 05 秒</strong>")
  expect(html).toContain('>耗时</th>')
  expect(html).toContain('<td class="duration-cell">2.5 秒</td>')
  expect(html).toContain('耗时：2.5 秒</span>')
  delete value.results[0].timing
  expect(buildReportDocument(value)).toContain('<td class="duration-cell">未记录</td>')
  value.results[0].status = "skipped"
  expect(buildReportDocument(value)).toContain('<td class="duration-cell">未执行</td>')
  delete value.ended
  expect(buildReportDocument(value)).toContain('耗时：<strong>未记录</strong>')
  expect(buildReportDocument(value)).toContain('<dt>结束时间</dt><dd>未记录</dd>')
})

test("已确认未发生澄清时，页面与报告不显示记录缺失，且不依赖配置数量", () => {
  const value = structuredClone(run)
  const result = value.results[0]
  const turn = result.roundResults![0]
  value.results = [result]
  result.roundResults = [turn]
  turn.clarification = "本轮未发生澄清。"
  for (const rules of [turn.rules, []]) {
    turn.rules = rules
    expect(clarificationText(turn)).toBe("本轮未发生澄清。")
    const html = buildReportDocument(value)
    expect(html).toContain("<h4>澄清过程</h4><p>本轮未发生澄清。</p>")
    expect(html).not.toContain("未记录澄清过程")
  }
})

test("澄清实际过程和记录缺失分别保留，不从配置推断未发生", () => {
  const value = structuredClone(run)
  const result = value.results[0]
  const turn = result.roundResults![0]
  value.results = [result]
  result.roundResults = [turn]
  turn.clarification = "实际追问：核算组织？\n已接收回复：华东公司"
  expect(clarificationText(turn)).toBe(turn.clarification)
  expect(buildReportDocument(value)).toContain(turn.clarification)
  turn.clarification = ""
  for (const rules of [turn.rules, []]) {
    turn.rules = rules
    expect(clarificationText(turn)).toBe("未记录澄清过程。")
    const html = buildReportDocument(value)
    expect(html).toContain("<h4>澄清过程</h4><p>未记录澄清过程。</p>")
    expect(html).not.toContain("本轮未发生澄清。")
  }
})

test("尚未执行或正在执行的轮次不冒充已确认未发生澄清", () => {
  for (const status of ["pending", "skipped"] as const) {
    expect(clarificationText({ status, clarification: "" })).toBe("本轮未执行，无澄清过程。")
  }
  expect(clarificationText({ status: "running", clarification: "" })).toBe("本轮执行中，尚未记录澄清过程。")
  expect(clarificationText({ status: "cancelled", clarification: "" })).toBe("未记录澄清过程。")
})

test("报告包含全部轮次、四种标准和模拟标识，不依赖外部资源", () => {
  const html = buildReportDocument(run)
  for (const label of ["评测结论", "问题清单", "用例概览", "详细结果", "语义判断", "关键词匹配", "正则匹配", "文件存在性", "实际回复", "澄清过程", "实际结果", "判定依据"]) expect(html).toContain(label)
  expect(html.match(/<details class="round" open>/g)?.length).toBe(6)
  expect(html).not.toMatch(/<link|src="https?:/)
  expect(html.match(/<script>/g)).toHaveLength(1)
})
test("报告转义用户内容，避免下载 HTML 执行注入", () => {
  const unsafe = structuredClone(run)
  unsafe.name = '</title><script>alert(1)</script>'
  unsafe.results[0].roundResults![0].response = '<img src=x onerror="alert(1)">'
  const html = buildReportDocument(unsafe)
  expect(html).not.toContain('<script>alert(1)</script>')
  expect(html.match(/<script>/g)).toHaveLength(1)
  expect(html).not.toContain('<img src=x')
  expect(html).toContain('&lt;img src=x')
})
test("空运行不宣称全部通过，历史记录不伪造逐轮依据", () => {
  expect(buildReportDocument({ ...run, results: [] })).toContain('本次没有用例结果')
  const legacy = structuredClone(run)
  delete legacy.results[0].roundResults
  expect(buildReportDocument(legacy)).toContain('历史运行未记录逐轮依据')
})

test("报告区分空回复与缺失回复并显示未执行状态和文件检查时点", () => {
  const value = structuredClone(run)
  const turns = value.results[0].roundResults!
  turns[0].response = ""; turns[0].responseRecorded = true
  turns[1].response = ""; turns[1].responseRecorded = false; turns[1].status = "skipped"
  const file = { id: "review-file", kind: "file" as const, operator: "exists" as const, text: "outputs/review.txt", required: true, files: [] }
  turns[0].checks = [file]
  turns[0].checkResults = [{ ...file, verdict: "passed", actual: "存在", evidence: "模拟检查", fileEvidence: { path: file.text, exists: true, checkedAt: 1700000000000 } }]
  const html = buildReportDocument(value)
  expect(html).toContain("最终回复为空")
  expect(html).toContain("未记录实际回复")
  expect(html).toContain("未执行")
  expect(html).toContain("检查时点")
  expect(html).toContain(new Date(1700000000000).toLocaleString("zh-CN", { hour12: false }))
  delete turns[0].checkResults[0].fileEvidence!.checkedAt
  expect(buildReportDocument(value)).toContain("<dt>检查时点</dt><dd>未记录</dd>")
})

test("报告不展示通用判定说明，保留运行快照并展示对象版本", () => {
  const value = structuredClone(run)
  value.checkPolicySnapshot = "当次规则：区分大小写；flags 为空"
  value.objectContentSummary = "对象摘要 <revision-1>"
  let html = buildReportDocument(value)
  expect(html).not.toContain("当次规则：区分大小写；flags 为空")
  expect(value.checkPolicySnapshot).toBe("当次规则：区分大小写；flags 为空")
  expect(html).not.toContain("判定说明")
  expect(html).toContain("对象摘要 &lt;revision-1&gt;")
  delete value.checkPolicySnapshot
  delete value.objectContentSummary
  html = buildReportDocument(value)
  expect(html).not.toContain("历史运行未记录详细判定口径")
  expect(html).toContain("<dt>评测时的对象版本</dt><dd>未记录</dd>")
  expect(html).not.toContain("整体标准检查最后一轮最终回复")
})

test("最终报告区分已停止、执行异常、无法判定与仍在判定", () => {
  const unknown = { ...run, results: run.results.map(c => ({ ...c, verdict: "unknown" as const, judging: false })) }
  for (const status of ["completed", "cancelled", "error"] as const) {
    const html = buildReportDocument({ ...unknown, status })
    expect(html).toContain("判定已结束，存在无法判定的用例")
    expect(html).not.toContain("部分用例尚未完成判定")
    expect(html).not.toContain("运行尚未全部完成")
    expect(html).not.toContain("结果仍在更新")
  }
  expect(buildReportDocument({ ...unknown, status: "cancelled" })).toContain("运行已停止")
  expect(buildReportDocument({ ...unknown, status: "error" })).toContain("运行因执行异常结束")
  expect(buildReportDocument({ ...unknown, status: "judging" })).toContain("运行尚未结束，结果仍在更新")
})

test("报告只展示运行总点数和状态，缺失判定消耗不能当作完整总量", async () => {
  const { pointsText, runPoints, pointsScopeNote } = await import("../src/services/evaluation-points")
  const value = structuredClone(run)
  value.pointsQuery = { status: "missing", amount: { execution: 7, judging: 0, recorded: true, missing: true } }
  const html = buildReportDocument(value)
  expect(html).toContain(pointsText(runPoints(value)))
  expect(html).toContain("已获取消耗点数：7.00 · 统计不完整")
  expect(html).toContain(pointsScopeNote)
  expect(html).not.toContain("<th>消耗点数</th>")
  expect(html).not.toContain("（执行 ")
  const detail = html.slice(html.indexOf('<section id="details">'))
  expect(detail).not.toContain("消耗点数：")
  expect(html.match(/消耗点数：/g)).toHaveLength(1)
})

 test("报告离线交互脚本受 CSP 哈希限制，用户输入不能改变脚本", async () => {
  const { createHash } = await import("node:crypto")
  const html = buildReportDocument(run)
  const script = html.match(/<script>([\s\S]*?)<\/script>/)![1]
  expect(html).toContain("script-src 'sha256-" + createHash("sha256").update(script).digest("base64") + "'")
  const changed = structuredClone(run)
  changed.name = '</script><script>alert(1)</script>'
  expect(buildReportDocument(changed).match(/<script>([\s\S]*?)<\/script>/)![1]).toBe(script)
 })
