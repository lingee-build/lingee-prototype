/** 文本检查保留 Markdown、空格和大小写，仅统一换行符。 */
export function normalizeEvaluationText(value: string): string {
  return value.replace(/\r\n?/g, "\n")
}
export function evaluationRegex(pattern: string): RegExp {
  return new RegExp(pattern)
}
export function matchEvaluationText(value: string | undefined, content: string, operator: "all" | "any" | "none" | "regex" | "not_regex"): boolean | undefined {
  if (value === undefined) return undefined
  const text = normalizeEvaluationText(value)
  if (operator === "regex" || operator === "not_regex") {
    const matched = evaluationRegex(content).test(text)
    return operator === "regex" ? matched : !matched
  }
  const keywords = [...new Set(normalizeEvaluationText(content).split("\n").map(v => v.trim()).filter(Boolean))]
  if (!keywords.length) return undefined
  const matches = keywords.map(keyword => text.includes(keyword))
  return operator === "all" ? matches.every(Boolean) : operator === "any" ? matches.some(Boolean) : !matches.some(Boolean)
}

// 原型格式生成器：依据输入生成，接入后由真实模型服务替换。
export function suggestEvaluationRegex(intent: string): { pattern: string; explanation: string } | undefined {
  const prefix = intent.match(/\b([A-Za-z][A-Za-z0-9]*-)(?:\s|开头|后)/)?.[1]
  const counts = [...intent.matchAll(/(\d+)\s*位/g)].map(m => Number(m[1]))
  if (prefix && counts.length && counts.every(n => Number.isSafeInteger(n) && n > 0)) {
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = `\\b${escaped}${counts.map(n => `[0-9]{${n}}`).join("-")}\\b`
    try { evaluationRegex(pattern) } catch { return undefined }
    return { pattern, explanation: `${prefix} 后依次匹配 ${counts.join("、")} 位数字，各段用连字符分隔；日期仅检查位数，不验证日期有效性` }
  }
  if (/手机号|手机号码/.test(intent)) return { pattern: "(?<![0-9])1[3-9][0-9]{9}(?![0-9])", explanation: "匹配中国大陆 11 位手机号码格式，不验证号码是否真实有效" }
  if (/邮箱|电子邮件/.test(intent)) return { pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", explanation: "匹配常见邮箱格式，不验证邮箱是否存在" }
  if (/日期/.test(intent) && /YYYY-MM-DD|年-月-日|2026-10-31/i.test(intent)) return { pattern: "\\b[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])\\b", explanation: "匹配 YYYY-MM-DD 格式，限制月份为 01–12、日期为 01–31，不校验闰年或每月天数" }
  return undefined
}
