import { executionIssues, executionLabel, verdictLabel, type EvalRun } from "./evaluation"

const time = (value?: number) => value ? new Date(value).toLocaleTimeString("zh-CN", { hour12: false }) : "--:--:--"

/**
 * 原始日志：由报告已记录的时间与执行字段整理成排查用的行日志。
 * 只输出记录过的信息，缺失时间显示 --:--:--，不补造工具调用。
 */
export function reportLogLines(run: EvalRun): string[] {
  const lines: string[] = []
  const models = run.models ? `执行 ${run.models.execution?.name || "未记录"} / 评测 ${run.models.judging?.name || "未记录"}` : "模型未记录"
  lines.push(`${time(run.started)} INFO  开始执行 ${run.code || run.id} · 用例集 ${run.caseSnapshot?.version || "历史快照"} · ${models}`)
  for (const result of run.results) {
    const label = [result.code, result.name].filter(Boolean).join(" ")
    lines.push(`${time(result.timing?.started)} RUN   ${label} 开始`)
    ;(result.roundResults || []).forEach((turn, index) => {
      if (turn.tool?.trim()) lines.push(`${time(result.timing?.started)} TOOL  ${label} 第 ${index + 1} 轮调用 ${turn.tool.trim()}`)
      if (turn.issue) lines.push(`${time(result.timing?.started)} WARN  ${label} 第 ${index + 1} 轮${executionIssues[turn.issue].stage}：${executionIssues[turn.issue].reason}`)
    })
    lines.push(`${time(result.timing?.ended)} DONE  ${label} 判定 ${verdictLabel(result)} · 执行 ${executionLabel(result)}`)
  }
  lines.push(`${time(run.ended)} INFO  运行结束 · 状态 ${{ running: "运行中", judging: "判定中", stopping: "停止处理中", stop_unconfirmed: "停止待核实", completed: "已完成", cancelled: "已停止", error: "执行异常" }[run.status]}`)
  return lines
}
