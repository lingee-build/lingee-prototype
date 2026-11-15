const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined
const text = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value, null, 2))

/** 只呈现冻结记录里的值，不从对象自述补造工具结果或澄清回执。 */
export function evidenceFields(kind: string, value: unknown): { label: string; text: string }[] {
  const record = object(value)
  if (!record) return []
  if (kind === "clarification") {
    if (!Array.isArray(record.questions)) return []
    if (record.status === "unexpected_clarification")
      return record.questions.flatMap((item) => {
        const question = object(item)?.question
        return typeof question === "string" ? [{ label: "实际追问", text: question }] : []
      })
    if (!Array.isArray(record.answers)) return []
    const fields: { label: string; text: string }[] = []
    for (const [index, item] of record.questions.entries()) {
      const question = object(item)
      const answers = record.answers[index]
      if (
        typeof question?.question !== "string" ||
        !Array.isArray(answers) ||
        answers.some((answer) => typeof answer !== "string")
      )
        return []
      fields.push({ label: "实际追问", text: question.question }, { label: "自动回复", text: answers.join("、") })
    }
    const reason = record.fallbackReason
    if (reason === "no_match" || reason === "timeout" || reason === "model_error") {
      const labels = { no_match: "没有匹配的澄清规则", timeout: "澄清匹配超时", model_error: "澄清匹配调用异常" }
      fields.push({ label: "澄清降级", text: labels[reason] + "，未能回填的追问以空答案继续执行。" })
    }
    return fields
  }
  if (kind !== "tool" || typeof record.tool !== "string") return []
  const state = object(record.state)
  return [
    { label: "工具调用", value: record.tool },
    { label: "工具输入", value: state?.input },
    { label: "工具返回", value: state?.output },
    { label: "错误信息", value: state?.error },
  ]
    .filter((field) => field.value !== undefined)
    .map((field) => ({ label: field.label, text: text(field.value) ?? "" }))
}

export function unexpectedClarificationText(evidence?: {
  endReason?: string
  records: { kind: string; value: unknown }[]
}): string {
  if (evidence?.endReason !== "unexpected_clarification") return ""
  return evidence.records.flatMap((record) =>
    record.kind === "clarification" && object(record.value)?.status === "unexpected_clarification"
      ? evidenceFields(record.kind, record.value).map((field) => field.text.trim()).filter(Boolean)
      : [],
  ).join("\n")
}
