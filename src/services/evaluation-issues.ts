import { checkKind, executionIssues, resultIssueSummary, turnsOf, verdictLabel, type EvalResult, type EvalRun, type EvalTurnResult } from "./evaluation"

/** 聚合问题：按「失败类型 + 关联资源」把同一类失败归并，便于研发一次定位一类原因。 */
export interface IssueSource { id: string; code?: string; name: string; index: number; verdict: string }
export interface IssueGroup {
  key: string
  kind: string
  resource?: string
  count: number
  summary: string
  cause: string
  advice: string
  sources: IssueSource[]
}

const kindLabels: Record<string, string> = {
  natural: "语义判断未通过",
  text: "文本内容未通过",
  keyword: "关键词匹配未通过",
  regex: "正则匹配未通过",
  file: "产物文件未通过",
}

const causes: Record<string, string> = {
  natural: "回复与评测标准的语义描述存在偏差，可能是内容不完整、口径理解不同或遗漏关键前提。",
  text: "回复文本与期望文本不一致，可能是表达改写或信息缺失。",
  keyword: "回复未包含要求的全部关键词，可能是模型改写措辞或遗漏关键信息。",
  regex: "回复格式未匹配预期规则，可能是单号、日期、金额等格式不一致。",
  file: "未在预期路径发现产物文件，可能是执行未生成文件或保存路径不同。",
}

const advices: Record<string, string> = {
  natural: "对照该用例每项的判定依据，确认是回复缺失还是标准描述不清，必要时拆分标准。",
  text: "核对期望文本是否过严；若为表达差异，改为语义判断。",
  keyword: "检查回复中关键信息的表述，必要时改为语义判断或调整关键词集合。",
  regex: "核对实际输出的字段格式，调整正则或明确输出格式要求。",
  file: "检查执行过程是否生成文件、保存路径是否与用例约定一致。",
}

interface Signal { kind: string; resource?: string; cause?: string; advice?: string }

function signalsOf(result: EvalResult): Signal[] {
  const signals: Signal[] = []
  const rounds: EvalTurnResult[] = result.roundResults ?? turnsOf(result).map(turn => ({ ...turn, status: result.status, response: "", evidence: "", clarification: "", checkResults: undefined }))
  rounds.forEach(turn => {
    if (turn.issue) {
      const issue = executionIssues[turn.issue]
      signals.push({ kind: issue.stage, resource: turn.tool?.trim() || undefined, cause: issue.reason, advice: issue.action })
      return
    }
    for (const check of turn.checkResults || []) {
      if (check.verdict !== "failed") continue
      const kind = checkKind(check)
      const resource = check.fileEvidence?.path || (kind === "file" ? check.text : undefined)
      signals.push({ kind: kindLabels[kind] || "校验未通过", resource, cause: causes[kind], advice: advices[kind] })
    }
  })
  for (const check of result.checkResults || []) {
    if (check.verdict !== "failed") continue
    const kind = checkKind(check)
    signals.push({ kind: `${kindLabels[kind] || "校验未通过"}（整体验收）`, resource: check.fileEvidence?.path, cause: causes[kind], advice: advices[kind] })
  }
  return signals
}

export function aggregateRunIssues(run: EvalRun): IssueGroup[] {
  const groups = new Map<string, IssueGroup>()
  run.results.forEach((result, index) => {
    const verdict = verdictLabel(result)
    if (!["不通过", "无法判定"].includes(verdict)) return
    const signals = signalsOf(result)
    const list: Signal[] = signals.length ? signals : [{ kind: "判定未通过", cause: "用例未能通过判定，逐轮依据未记录到具体失配项。", advice: "查看该用例的逐轮实际回复与判定依据，补充可核对的评测标准。" }]
    for (const signal of list) {
      const key = `${signal.kind}|${signal.resource || ""}`
      const group = groups.get(key) ?? { key, kind: signal.kind, resource: signal.resource, count: 0, summary: "", cause: signal.cause || "", advice: signal.advice || "", sources: [] }
      group.count += 1
      if (!group.summary) group.summary = resultIssueSummary(result) || verdict
      group.sources.push({ id: result.id, code: result.code, name: result.name, index, verdict })
      groups.set(key, group)
    }
  })
  return [...groups.values()].sort((a, b) => b.count - a.count)
}
