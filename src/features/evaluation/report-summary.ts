import { isActiveRun, resultIssueSummary, verdictLabel, type EvalResult, type EvalRun } from "@/services/evaluation"
import { runStats } from "@/services/evaluation-comparison"

/** 在线报告、离线报告与对象摘要共用同一结论口径。 */
export function reportSummary(run: EvalRun) {
  const total = run.results.length
  const passed = run.results.filter(r => verdictLabel(r) === "通过").length
  const failed = run.results.filter(r => verdictLabel(r) === "不通过").length
  const unknown = run.results.filter(r => verdictLabel(r) === "无法判定").length
  const pending = isActiveRun(run)
  const allUnknown = !pending && total > 0 && unknown === total
  const title = !total ? "本次没有用例结果" : pending ? "运行尚未结束，结果仍在更新"
    : allUnknown ? "本次所有用例均无法判定"
    : failed === total ? `全部 ${total} 条用例不通过`
    : failed ? `${failed} 条用例不通过${unknown ? `，${unknown} 条无法判定` : ""}`
    : unknown ? `${passed} 条用例通过，${unknown} 条无法判定`
    : passed === total ? "本次所选用例全部通过" : "本次评测结果不完整"
  const note = pending ? "" : allUnknown ? "暂不能据此判断对象是否满足要求，请查看原因并处理后重跑。"
    : unknown ? "无法判定的用例需排查执行或判定原因。"
    : failed ? "查看失败证据并分析修复方案。" : ""
  return { title, note, allUnknown, denominator: `通过 ${passed} / 全部 ${total} 条，包含 ${unknown} 条无法判定` }
}

const finishedResults = (run: EvalRun) => run.results.filter(result => ["通过", "不通过", "无法判定"].includes(verdictLabel(result)))

/** 报告顶部总结/意见：只陈述事实与下一步，不做发布与否的判定（原型按结果机械生成，口径与设计稿一致）。 */
export function reportBriefOf(run: EvalRun) {
  const stats = runStats(run)
  const active = isActiveRun(run)
  const running = run.results.find(result => ["pending", "running"].includes(result.status) || result.judging)
  if (active) {
    return {
      summary: `执行中：已完成 ${stats.executed}/${stats.total}${running ? `，当前执行 ${running.code || ""} ${running.name}`.replace(/\s+/g, " ") : ""}`,
      advice: "等本次执行结束后再判断结果；如需中止可点“停止”",
    }
  }
  if (run.status === "error") {
    return {
      summary: `执行中断：${run.stopReason || "运行级故障导致结束"}，已完成 ${stats.executed}/${stats.total}`,
      advice: "先确认模型服务可用性与超时配置，再重新执行",
    }
  }
  if (run.status === "cancelled" || run.status === "stop_unconfirmed") {
    return {
      summary: `已手动停止：执行 ${stats.executed}/${stats.total}，剩余 ${stats.total - stats.executed} 条无结果`,
      advice: "需要完整结果就重新执行；已执行部分可作为参考",
    }
  }
  if (run.status === "completed" && stats.executed < stats.total) {
    return {
      summary: `本次只执行前 ${stats.executed} 条用例：${stats.passed} 条通过，${stats.failed} 条不通过，${stats.unknown} 条无法判定；后 ${stats.total - stats.executed} 条不在本次范围内`,
      advice: `补全未执行用例的预期后，下次把 ${stats.total} 条用例全部纳入执行再判断是否收口`,
    }
  }
  return {
    summary: reportSummary(run).title,
    advice: stats.failed
      ? "优先排查不通过用例的判定依据，修复被测对象后重新执行验证"
      : stats.unknown
        ? "补全无法判定用例的预期或排查执行原因后重跑"
        : "全部用例通过，可按流程继续",
  }
}

export interface ReportIssue {
  sev: "block" | "unk"
  tag: string
  title: string
  cases: EvalResult[]
  symptom: string
  cause: string
  fix: string
}

/** 问题清单：按用例失败记录聚合（现象 + 推断原因 + 修复建议）；推断原因由失败判定依据机械聚合，页面标注“AI 推断”。 */
export function reportIssuesOf(run: EvalRun): ReportIssue[] {
  const done = finishedResults(run)
  const failed = done.filter(result => verdictLabel(result) === "不通过")
  const unknown = done.filter(result => verdictLabel(result) === "无法判定")
  const issues: ReportIssue[] = []
  for (const result of failed) {
    const symptom = resultIssueSummary(result)
    // 取第一条未通过校验，让现象/原因/建议落到具体标准与轮次上，而不是泛泛描述。
    const entries = [
      ...(result.roundResults || []).flatMap((turn, index) => (turn.checkResults || []).map(check => ({ check, scope: `第 ${index + 1} 轮` }))),
      ...(result.checkResults || []).map(check => ({ check, scope: "整体标准" })),
    ]
    const failedCheck = entries.find(({ check }) => check.verdict === "failed")
    const evidence = failedCheck?.check.evidence
    const scope = failedCheck?.scope
    const fix = failedCheck?.check.kind === "file"
      ? "确认产物已生成并保存到用例要求的相对路径后，重跑该用例验证"
      : failedCheck
        ? "补充对应能力或输出要求，修复被测对象后重跑该用例验证"
        : "根据判定依据修复被测对象后，重跑该用例验证"
    issues.push({
      sev: "block",
      tag: "执行未达标",
      title: `${result.code || ""} ${result.name} 未通过预期`.trim(),
      cases: [result],
      symptom: symptom || "回复未满足用例的评测标准",
      cause: evidence ? `根据${scope || "失败记录"}的判定依据推断：${evidence}` : "根据失败记录推断：被测对象未覆盖该用例的业务要求",
      fix,
    })
  }
  if (unknown.length) {
    issues.push({
      sev: "unk",
      tag: "无法判定",
      title: unknown.length === 1 ? "1 条用例缺少预期结果" : `${unknown.length} 条用例无法判定`,
      cases: unknown,
      symptom: unknown.map(result => resultIssueSummary(result)).filter(Boolean).join("；") || "缺少预期结果或执行证据，无法判定",
      cause: "用例未录入预期结果或执行证据不足",
      fix: "补全用例预期或排查执行与判定原因后重新执行",
    })
  }
  return issues
}
