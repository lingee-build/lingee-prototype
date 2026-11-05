import { isActiveRun, verdictLabel, type EvalRun } from "@/services/evaluation"

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
