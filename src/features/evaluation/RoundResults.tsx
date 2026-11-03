import { clarificationResponses } from "@/services/evaluation"
import { CheckTypeIcon } from "./CheckTypeIcon"
import { sessionAttachmentTip } from "./attachment-help"
import { AttachmentRow } from "./AttachmentRow"
import { useState } from "react"
import { TurnCard } from "./TurnCard"
import { downloadAttachment } from "@/services/evaluation-attachments"
import { Button, showToast, Icon, Tooltip } from "@/ui"
import { useT } from "@/i18n"
import { clarificationText, responseText, fileCheckTime, executionIssues, checkKind, checkOperators, checkDescription, aggregateChecks, checksOf, executionLabel, verdictLabel, type CheckResult, type EvalCheck, turnsOf, type EvalTurnResult, type EvalTurn, type EvalResult, type EvalAttachment } from "@/services/evaluation"
function resultRounds(result: EvalResult): EvalTurnResult[] {
  return result.roundResults || turnsOf(result).map(turn => ({ ...turn, status: result.status, response: result.response, evidence: result.evidence, clarification: "" }))
}
export function Files({ files, label }: { files: EvalAttachment[]; label: string }) {
  return files.length ? <div className="eval-message"><div className="eval-field-heading"><strong>{label}</strong>{label === "会话附件" && <Tooltip value={sessionAttachmentTip}><button type="button" className="eval-field-help" aria-label={sessionAttachmentTip}><Icon name="help" size="small" /></button></Tooltip>}</div><div className="eval-attachments">{files.map(f => <AttachmentRow key={f.id} file={f} download={() => { void downloadAttachment(f).catch(() => showToast({ variant: "error", title: "附件无法读取" })) }} />)}</div></div> : null
}
const verdicts = { passed: "通过", failed: "不通过", unknown: "无法判定", na: "不适用", skipped: "已跳过" }
export function CheckResults({ checks, results, label }: { checks: EvalCheck[]; results?: CheckResult[]; label: string }) {
  if (!checks.length) return null
  return <section className="eval-check-results"><h3 className="eval-section-title">{label} <span className="eval-section-count">（{checks.length}）</span></h3>
    {checks.some(c => ["keyword", "regex"].includes(checkKind(c))) && <p className="eval-muted">文本检查范围：{label === "整体评测标准" ? "最后一轮最终回复" : "本轮最终回复"}。</p>}
    {checks.some(c => checkKind(c) === "file") && <p className="eval-muted">只检查生成的文件是否存在，不检查文件内容。</p>}
    {checks.map((check, index) => {
    const result = results?.find(c => c.id === check.id)
    const kind = checkKind(check)
    return <details className="eval-result-standard" key={check.id}>
      <summary><span className="eval-result-number">{index + 1}</span><div className="eval-result-check-content">
        <div className="eval-result-check-heading"><span className="eval-result-check-kind"><CheckTypeIcon kind={kind} />{checkTypeNames[kind]}</span>{kind !== "natural" && <span>{checkMethod(check)}</span>}</div>
        {kind === "keyword" ? <div className="eval-result-keywords">{check.text.split("\n").map(v => v.trim()).filter(Boolean).map((v, i) => <span className="eval-keyword" key={i}>{v}</span>)}</div> : <div className={kind === "regex" || kind === "file" ? "eval-check-literal" : undefined}>{kind === "natural" ? checkDescription(check) : check.text}</div>}
      </div><span className="eval-status" data-status={result?.verdict}>{result ? verdicts[result.verdict] : "暂无判定"}</span></summary>
      <dl className="eval-result-evidence"><dt>实际结果</dt><dd>{result?.actual || "未记录逐项评测结果。"}</dd><dt>判定依据</dt><dd>{result?.evidence || "暂无对应证据。"}</dd>{kind === "file" && result?.fileEvidence && <><dt>文件路径</dt><dd>{result.fileEvidence.path}</dd><dt>检查时间</dt><dd>{fileCheckTime(result.fileEvidence)}</dd></>}</dl>
    </details>
  })}</section>
}
const checkTypeNames = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
function checkMethod(check: EvalCheck) {
  const kind = checkKind(check)
  return kind === "natural" ? "按描述判定" : checkOperators[check.operator || (kind === "file" ? "exists" : kind === "regex" ? "regex" : "all")]
}
function checkText(checks: EvalCheck[], results?: CheckResult[]): string {
  return checks.map((c, index) => { const r = results?.find(x => x.id === c.id); return `标准 ${index + 1}\n类型：${checkTypeNames[checkKind(c)]}\n检查方式：${checkMethod(c)}\n内容：${checkKind(c) === "natural" ? checkDescription(c) : c.text}\n判定：${r ? verdicts[r.verdict] : "暂无判定"}\n实际结果：${r?.actual || "无记录"}\n判定依据：${r?.evidence || "无记录"}` }).join("\n\n")
}

function ruleText(rule: EvalTurn["rules"][number], index: number) {
  return `澄清回复配置 ${index + 1}\n预期追问：${rule.match}\n自动回复：${clarificationResponses(rule.responses)}`
}
function turnVerdict(turn: ReturnType<typeof resultRounds>[number], t: (key: string) => string) {
  if (["pending", "running", "cancelled", "skipped"].includes(turn.status)) return t(`proto.eval.${turn.status}`)
  if (turn.status === "blocked") return "无法判定"
  const results = "checkResults" in turn ? turn.checkResults as CheckResult[] | undefined : undefined
  if (results?.length) return verdicts[aggregateChecks(results)]
  return checksOf(turn).length ? "暂无判定" : "已完成"
}
export function RoundResults({ result }: { result: EvalResult }) {
  const t = useT()
  const rounds = resultRounds(result)
  const [expanded, setExpanded] = useState<Record<string, { status: string; open: boolean }>>({})
  const isOpen = (turn: typeof rounds[number]) => expanded[turn.id]?.status === turn.status ? expanded[turn.id].open : ["running", "failed", "blocked"].includes(turn.status) || ("checkResults" in turn && !!(turn.checkResults as CheckResult[] | undefined)?.some(c => ["failed", "unknown"].includes(c.verdict)))
  const allExpanded = rounds.every(isOpen)
  const setAll = (open: boolean) => setExpanded(Object.fromEntries(rounds.map(turn => [turn.id, { status: turn.status, open }])))
  return <div className="eval-conversation">
    <CheckResults label="整体评测标准" checks={result.checks || []} results={result.checkResults} />
    <Files files={result.attachments || []} label="会话附件" />
    <div className="eval-toolbar"><h3>对话轮次（{rounds.length}）</h3><div className="eval-actions">{rounds.length > 1 && <Button variant="ghost" onClick={() => setAll(!allExpanded)}>{allExpanded ? "全部折叠" : "全部展开"}</Button>}</div></div>
    {rounds.map((turn, i) => <TurnCard key={turn.id} turnId={turn.id} number={i + 1} input={turn.input}
      meta={isOpen(turn) ? "" : [turn.attachments.length && `附件 ${turn.attachments.length}`, turn.rules.length && `澄清回复配置 ${turn.rules.length}`, checksOf(turn).length && `评测标准 ${checksOf(turn).length}`].filter(Boolean).join(" · ")}
      status={<span className="eval-status" data-status={{ "通过": "passed", "不通过": "failed", "无法判定": "unknown" }[turnVerdict(turn, t)]}>{turnVerdict(turn, t)}</span>}
      open={isOpen(turn)} toggle={() => setExpanded(prev => ({ ...prev, [turn.id]: { status: turn.status, open: !isOpen(turn) } }))}>

      <div className="eval-input-group"><div className="eval-message"><strong>用户输入</strong><p>{turn.input}</p></div>
      <Files files={turn.attachments} label="附件" /></div>
      {!!turn.rules.length && <details className="eval-result-rules"><summary className="eval-section-title">澄清回复配置 <span className="eval-section-count">（{turn.rules.length}）</span></summary>
        <div className="eval-result-reply-list">
          <div className="eval-result-reply-columns" aria-hidden="true"><span /><span>预期追问</span><span>自动回复</span></div>
          {turn.rules.map((r, ri) => <div className="eval-result-reply-row" key={r.id} aria-label={`澄清回复配置 ${ri + 1}`}>
            <span className="eval-result-number">{ri + 1}</span>
            <div><span className="eval-result-mobile-label">预期追问</span><p>{r.match}</p></div>
            <div className="eval-result-reply-answer"><span className="eval-result-mobile-label">自动回复</span><p>{r.responses.join("\n")}</p></div>
          </div>)}
        </div>
      </details>}
      <details className="eval-message" open><summary>本次澄清过程</summary><p>{clarificationText(turn)}</p></details>
      {"issue" in turn && turn.issue && <div className="eval-message"><strong>执行异常</strong><dl className="eval-result-evidence"><dt>发生阶段</dt><dd>{executionIssues[turn.issue].stage}</dd><dt>原因</dt><dd>{executionIssues[turn.issue].reason}</dd><dt>处理建议</dt><dd>{executionIssues[turn.issue].action}</dd></dl></div>}
      {"tool" in turn && turn.tool && <div className="eval-message"><strong>工具调用</strong><p>{turn.tool}</p></div>}
      {turn.toolResult && <div className="eval-message"><strong>{t("proto.eval.toolResult")}</strong><p>{turn.toolResult}</p></div>}
      <div className="eval-message"><strong>实际回复</strong><p>{responseText(turn, t)}</p></div>
      <CheckResults label="评测标准" checks={checksOf(turn)} results={"checkResults" in turn ? turn.checkResults as CheckResult[] : undefined} />
      {!("checkResults" in turn && (turn.checkResults as CheckResult[] | undefined)?.length) && <div className="eval-message"><strong>判定依据</strong><p>{turn.evidence ? t(turn.evidence) : turn.status === "skipped" ? "本轮未执行。" : turn.status === "cancelled" ? "本轮已停止，未生成判定依据。" : t("proto.eval.waiting")}</p></div>}
    </TurnCard>)}
  </div>
}
export function reportBody(result: EvalResult, t: (key: string) => string) {
  return `${result.name}\n用例编号：${result.id}\n执行：${executionLabel(result)} · 结论：${verdictLabel(result)}\n整体评测标准：\n${checkText(result.checks || [], result.checkResults)}\n会话附件：${(result.attachments || []).map(f => f.name).join("、") || "无"}\n` + resultRounds(result).map((turn, i) => `第 ${i + 1} 轮：${turnVerdict(turn, t)}\n用户输入：${turn.input}\n附件：${turn.attachments.map(f => f.name).join("、") || "无"}\n澄清回复配置：${turn.rules.map(ruleText).join("\n\n") || "无"}\n本次澄清过程：${clarificationText(turn)}\n工具返回：${turn.toolResult || "未记录"}\n回复：${responseText(turn, t)}\n评测标准：\n${checkText(checksOf(turn), "checkResults" in turn ? turn.checkResults as CheckResult[] : undefined)}\n依据：${turn.evidence ? t(turn.evidence) : turn.status === "skipped" ? "本轮未执行。" : turn.status === "cancelled" ? "本轮已停止，未生成判定依据。" : t("proto.eval.waiting")}`).join("\n\n")
}
