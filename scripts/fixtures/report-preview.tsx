import React, { useState } from "react"
import { createRoot } from "react-dom/client"
import { ReportPreview } from "../../src/features/evaluation/ReportPreview"
import { buildReportDocument } from "../../src/features/evaluation/report-document"
import type { EvalRun } from "../../src/services/evaluation"

const started = Date.now() - 1000
const turn = { id: "turn-1", input: "查询单据", expected: "显示查询结果", attachments: [], rules: [], checks: [], status: "passed" as const, response: "证据文字保持选中", evidence: "已取得返回", clarification: "" }
const result = { id: "case-1", code: "EC-0001", name: "稳定证据", input: turn.input, expected: turn.expected, source: "none" as const, outcome: "passed" as const, status: "passed" as const, verdict: "passed" as const, response: turn.response, evidence: turn.evidence, tool: "", turns: [turn, { ...turn, id: "turn-2" }], roundResults: [turn, { ...turn, id: "turn-2" }], timing: { started, ended: started + 100 } }
const initial = { id: "run-1", code: "ER-0001", name: "报告刷新验证", status: "running", started, results: [result, { ...result, id: "case-2", code: "EC-0002", name: "执行中的用例", status: "running", verdict: undefined, timing: { started }, roundResults: [{ ...turn, status: "running", response: "", evidence: "" }] }], snapshot: { version: "v1", capturedAt: started, cases: [result] }, models: { execution: { id: "model", name: "执行模型", provider: "测试" }, judging: { id: "model", name: "判定模型", provider: "测试" } } } as EvalRun

function App() {
  const [run, setRun] = useState(initial)
  const [, tick] = useState(0)
  // 浏览器回归通过同一组件模拟计时、异步证据及终态消息，不依赖业务 fixture。
  Object.assign(window, { refreshReport: (finish = false) => {
    if (finish) setRun(current => ({ ...current, status: "completed", ended: Date.now(), results: current.results.map(item => ({ ...item, status: "failed", verdict: "failed", roundResults: item.roundResults?.map(t => ({ ...t, status: "failed", tool: "新增工具调用", toolResult: "新增工具结果" })) })) }))
    else tick(n => n + 1)
  } })
  return <div className="eval-panel" style={{ height: "95vh", overflow: "auto" }}><ReportPreview html={buildReportDocument(run)} /></div>
}
createRoot(document.getElementById("root")!).render(<App />)
