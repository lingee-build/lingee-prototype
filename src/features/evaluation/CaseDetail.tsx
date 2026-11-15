import { evaluationExecutionReason } from "@/vendor/build-evaluation/presentation"
import type { ReportHtmlData } from "@/vendor/build-evaluation/report-html"
import { ClarificationReplies } from "./ClarificationReplies"
import { useState } from "react"
import { BrandButton, Button, Icon, showToast } from "@/ui"
import { checkKind, checkDescription, checkOperators, checksOf, turnsOf, type EvalCase, type EvalCheck } from "@/services/evaluation"
import { downloadAttachment } from "@/services/evaluation-attachments"
import type { EvalAttachment } from "@/services/evaluation"
import { TurnCard } from "./TurnCard"


type ReportCase = ReportHtmlData["cases"][number]
type ReportCriterion = ReportCase["content"]["criteria"][number]

function reportCheck(criterion: ReportCriterion): EvalCheck {
  const kind = criterion.kind === "keyword" || criterion.kind === "regex" || criterion.kind === "file"
    ? criterion.kind : "natural"
  const operator = criterion.mode && Object.prototype.hasOwnProperty.call(checkOperators, criterion.mode)
    ? criterion.mode as EvalCheck["operator"] : undefined
  return {
    id: criterion.id,
    kind,
    operator,
    text: criterion.values?.join("、") ?? criterion.pattern ?? criterion.path ?? criterion.description ?? "",
    required: true,
    files: [],
  }
}

const names = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
function Standards({ checks }: { checks: EvalCheck[] }) {
  if (!checks.length) return null
  const answer = checks.filter(check => checkKind(check) === "natural").map(checkDescription).filter(text => text.trim()).join("\n")
  return <section className="eval-check-editor">
    <h3 className="eval-section-title">标准答案</h3>
    {answer && <div className="eval-readonly-field">{answer}</div>}
    {checks.filter(check => checkKind(check) !== "natural").map(check => {
      const kind = checkKind(check)
      const method = checkOperators[check.operator || (kind === "file" ? "exists" : kind === "regex" ? "regex" : "all")]
      return <p key={check.id} className="eval-muted">{names[kind]} · {method} {check.text}</p>
    })}
  </section>
}
function Attachments({ files, label }: { files: EvalAttachment[]; label: string }) {
  if (!files.length) return null
  return <div className="eval-attachment-list"><span className="eval-muted">{label}</span>
    {files.map(file => <button key={file.id} type="button" className="eval-attachment-chip" onClick={() => {
      void downloadAttachment(file).catch(() => showToast({ variant: "error", title: "附件无法读取" }))
    }}><Icon name="attachment" size="small" />{file.name}</button>)}
  </div>
}

export function CaseDetail({ value, history, embedded = false, edit, editLabel = "编辑", editDisabled = false }: { value: EvalCase; history?: ReportCase; embedded?: boolean; edit?: () => void; editLabel?: string; editDisabled?: boolean }) {
  const rounds = turnsOf(value)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const allOpen = collapsed.length === 0
  return <div className="eval-conversation eval-case-detail" aria-label="用例详情">
    {!embedded && <div className="eval-toolbar"><h3>{value.code} {value.name}</h3>{edit && <BrandButton variant="primary" disabled={editDisabled} onClick={edit}>{editLabel}</BrandButton>}</div>}
    <Attachments files={value.attachments || []} label="会话附件" />
    <div className="eval-toolbar"><h3>对话轮次（{rounds.length}）</h3>{rounds.length > 1 && <Button variant="ghost" onClick={() => setCollapsed(allOpen ? rounds.map(r => r.id) : [])}>{allOpen ? "全部折叠" : "全部展开"}</Button>}</div>
    {rounds.map((turn, i) => {
      const evidence = history?.evidence.find(item => item.turn === i)
      const unsent = !!history && (!evidence || evidence.endReason === "placeholder_error")
      const previousClarification = history?.evidence.some(item => item.turn < i && item.endReason === "unexpected_clarification")
      const reason = evidence?.error ?? (previousClarification ? "用例未配置追问应答" : history?.reason
        ? evaluationExecutionReason(history.reason) : history?.state === "ended" ? "未记录发送原因" : "尚无发送记录")
      const reportTurn = history?.content.turns[i]
      const input = unsent ? turn.input : evidence?.input ?? reportTurn?.input ?? turn.input
      const checks = reportTurn
        ? [...reportTurn.criteria, ...(rounds.length === 1 ? history?.content.criteria ?? [] : [])].map(reportCheck)
        : [...checksOf(turn), ...(rounds.length === 1 ? value.checks || [] : [])]
      const rules = reportTurn?.clarifications.map((rule, index) => ({
        id: `${turn.id}-${index}`, match: rule.question, responses: rule.answers,
      })) ?? turn.rules
      return <TurnCard key={turn.id} turnId={turn.id} number={i + 1} input={input} meta="" status={null} open={!collapsed.includes(turn.id)} toggle={() => setCollapsed(ids => ids.includes(turn.id) ? ids.filter(id => id !== turn.id) : [...ids, turn.id])}>
      <section className="eval-input-group"><h3 className="eval-section-title">{unsent ? "模板" : history ? "实际发送的问题" : "用户输入"}</h3>{unsent && <p className="eval-muted">本轮未发送 · {reason}</p>}<div className="eval-readonly-field">{input}</div></section>
      <Attachments files={turn.attachments} label="本轮附件" />
      {!!rules.length && <section className="eval-clarification-section"><h3 className="eval-section-title">澄清规则 <span className="eval-section-count">（{rules.length}）</span></h3><ClarificationReplies rules={rules} readOnlyField /></section>}
      <Standards checks={checks} />
    </TurnCard>
    })}
  </div>
}
