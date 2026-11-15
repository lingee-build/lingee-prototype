/** Local time, shared by the report UI and downloaded report. */
export function evaluationTime(value: number) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "—"
  const pad = (part: number) => String(part).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** Prefer the imported ID, including for cases saved before import reused it as the code. */
export function evaluationCaseCode(item: { code: string; content?: { externalCaseId?: string } }) {
  return item.content?.externalCaseId?.trim() || item.code
}

/** Generated names sometimes already contain their assigned EC code. */
export function evaluationCaseTitle(code: string, name: string) {
  const title = name.trim()
  if (title === code || (title.startsWith(code) && /^[\s:：·-]/.test(title.slice(code.length)))) return title
  return `${code} ${title}`.trim()
}

/** Hide only known tracing identifiers in narrative text; keep business IDs and frozen evidence intact. */
export function evaluationNarrative(
  text: string,
  evidence: { id: string; records: { id: string; kind: string; value: unknown }[] }[],
  translate: (text: string) => string = (text) => text,
) {
  const ids = new Map<string, string>()
  for (const item of evidence) {
    ids.set(item.id, "证据记录")
    for (const record of item.records) {
      ids.set(record.id, record.kind === "tool" ? "工具调用" : "证据记录")
      if (record.kind !== "tool" || !record.value || typeof record.value !== "object") continue
      const tool = record.value as Record<string, unknown>
      for (const key of ["callID", "sessionID", "messageID"])
        if (typeof tool[key] === "string" && tool[key]) ids.set(tool[key], "工具调用")
    }
  }
  if (!ids.size) return text
  const pattern = [...ids.keys()].filter(Boolean).sort((a, b) => b.length - a.length)
    .map((id) => id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")
  if (!pattern) return text
  return text
    .replace(new RegExp(`(?:（(?:${pattern})）|\\((?:${pattern})\\))`, "g"), "")
    .replace(new RegExp(`(?<![\\w:-])(?:${pattern})(?![\\w:-])`, "g"), (id) => translate(ids.get(id)!))
}

/** Translate known execution blockers without changing stored evidence or outcomes. */
export function evaluationExecutionReason(reason: string, translate: (value: string) => string = value => value) {
  const code = reason.replace(/^Error:\s*/, "").trim()
  if (code === "EVALUATION_CLARIFICATION_INVALID_OPTION")
    return translate("预设澄清答案不在实际问题的可选项中，或为单选题配置了多个答案。请查看执行会话，调整用例澄清规则后重新运行。")
  if (code === "EVALUATION_CLARIFICATION_AUTH_FORBIDDEN")
    return translate("执行中需要登录或授权，评测不会自动填写凭据。请先完成环境配置，再重新运行。")
  return reason
}
