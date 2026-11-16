import { exportText } from "./export-text"
import type { Quality } from "./quality-report"

export const passLine = 60
export type CaseOutcome = "pass" | "fail" | "blocked" | "unscored"

/** 用例级结论只由八维评分决定；环境阻塞已被强制归零，仍单列展示以免与能力缺陷混同。 */
export function caseOutcome(quality?: Quality) {
  if (quality?.status !== "complete") return "unscored" as const
  if (quality.blocked) return "blocked" as const
  return quality.score >= passLine ? ("pass" as const) : ("fail" as const)
}

export const outcomeLabels: Record<CaseOutcome, string> = {
  pass: "通过",
  fail: "未通过",
  blocked: "环境阻塞",
  unscored: "评分未完成",
}

export function outcomeCounts(cases: { quality?: Quality }[]) {
  const counts: Record<CaseOutcome, number> = { pass: 0, fail: 0, blocked: 0, unscored: 0 }
  for (const item of cases) counts[caseOutcome(item.quality)]++
  return counts
}

/** 环境阻塞用例按 0 分照常计入分母，与评测 skill 的通过率口径一致。 */
export function passRate(cases: { quality?: Quality }[]) {
  const counts = outcomeCounts(cases)
  const scored = counts.pass + counts.fail + counts.blocked
  return scored ? counts.pass / scored : null
}

export function qualityGrade(score: number) {
  return score >= 90 ? "S" : score >= 80 ? "A" : score >= 70 ? "B" : score >= 60 ? "C" : "D"
}

export function averageQuality(cases: { quality?: Quality }[]) {
  const scores = cases.flatMap((item) => (item.quality?.status === "complete" ? [item.quality.score] : []))
  const score = scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1)) : null
  return { score, grade: score === null ? null : qualityGrade(score), scored: scores.length }
}

export const scoringLabels = {
  scoring: "评分中",
  scoring_failed: "评分失败",
  not_scored: "未评分",
} as const

export function scoringStatus(item: { state?: string; quality?: Quality }) {
  if (item.quality?.status === "complete") return
  // Older reports also used incomplete when a missing clarification prevented scoring.
  if (item.quality?.status === "incomplete" && item.quality.reason !== "用例未配置追问应答")
    return "scoring_failed"
  if (item.state === "judging") return "scoring"
  if (item.state === "ended" || item.state === undefined) return "not_scored"
}

export function scoringFailureReason(reason: string, translate: (value: string) => string = value => value) {
  const status = /\bEVALUATION_MAAS_HTTP_([1-5]\d{2})\b/.exec(reason)?.[1]
  if (status?.startsWith("5")) return `${translate("评分服务暂不可用")} (HTTP ${status})`
  if (status) return `HTTP ${status}`
  if (/timeout|timed out/i.test(reason)) return translate("评分服务超时")
  if (/SyntaxError.*JSON|JSON Parse error/i.test(reason)) return translate("评分模型返回的结果格式有误，无法读取分数。")
  const validation = reason.replace(/^(?:ZodError|Error):\s*/, "").trim()
  if (/^\[\s*\{/.test(validation) && /"code"\s*:/.test(validation) && /"path"\s*:\s*\[/.test(validation)) {
    if (/"deductions"\s*,\s*\d+\s*,\s*"(?:points|problem)"/.test(validation)) {
      return translate("评分模型返回的扣分值或问题描述缺失或格式有误，本次评分未采纳。")
    }
    return translate("评分模型返回的结果格式有误，无法读取分数。")
  }
  const mismatch = /EVALUATION_QUALITY_INVALID · (Q[1-8]) 得分与扣分明细不符/.exec(reason)?.[1]
  if (mismatch) return `${mismatch} ${translate("得分与扣分明细不一致，本次评分未采纳。")}`
  return exportText(reason.replace(/^Error: EVALUATION_QUALITY_INVALID · /, "")).trim()
}
