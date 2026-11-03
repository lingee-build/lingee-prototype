import { clarificationResponses } from "@/services/evaluation"
import { useState } from "react"
import { BrandButton, Button, IconButton } from "@/ui"
import { checkKind, checkDescription, checkOperators, checksOf, turnsOf, type EvalCase, type EvalCheck } from "@/services/evaluation"
import { Files } from "./RoundResults"
import { TurnCard } from "./TurnCard"
import { CheckTypeIcon } from "./CheckTypeIcon"

const names = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
function Standards({ checks, label }: { checks: EvalCheck[]; label: string }) {
  if (!checks.length) return null
  return <section className="eval-check-results"><h3 className="eval-section-title">{label} <span className="eval-section-count">（{checks.length}）</span></h3>
    {checks.map((check, i) => {
      const kind = checkKind(check)
      const method = kind === "natural" ? "" : checkOperators[check.operator || (kind === "file" ? "exists" : kind === "regex" ? "regex" : "all")]
      return <div className="eval-case-detail-standard" key={check.id}><span className="eval-result-number">{i + 1}</span><div className="eval-result-check-content"><div className="eval-result-check-heading"><span className="eval-result-check-kind"><CheckTypeIcon kind={kind} />{names[kind]}</span>{method && <span>{method}</span>}</div><p>{kind === "natural" ? checkDescription(check) : check.text}</p></div></div>
    })}
  </section>
}

export function CaseDetail({ value, back, edit, editLabel = "编辑", editDisabled = false }: { value: EvalCase; back: () => void; edit: () => void; editLabel?: string; editDisabled?: boolean }) {
  const rounds = turnsOf(value)
  const [collapsed, setCollapsed] = useState<string[]>([])
  const allOpen = collapsed.length === 0
  return <div className="eval-conversation eval-case-detail" aria-label="用例详情">
    <div className="eval-toolbar"><div className="eval-actions"><IconButton icon="arrow-left" variant="ghost" aria-label="返回用例列表" title="返回用例列表" onClick={back} /><h3>用例详情</h3></div><BrandButton variant="primary" disabled={editDisabled} onClick={edit}>{editLabel}</BrandButton></div>
    <div className="eval-message"><strong>用例名称</strong><p>{value.name}</p></div>
    <Files files={value.attachments || []} label="会话附件" />
    <div className="eval-toolbar"><h3>对话轮次（{rounds.length}）</h3>{rounds.length > 1 && <Button variant="ghost" onClick={() => setCollapsed(allOpen ? rounds.map(r => r.id) : [])}>{allOpen ? "全部折叠" : "全部展开"}</Button>}</div>
    {rounds.map((turn, i) => <TurnCard key={turn.id} turnId={turn.id} number={i + 1} input={turn.input} meta="" status={null} open={!collapsed.includes(turn.id)} toggle={() => setCollapsed(ids => ids.includes(turn.id) ? ids.filter(id => id !== turn.id) : [...ids, turn.id])}>
      <div className="eval-input-group"><div className="eval-message"><strong>用户输入</strong><p>{turn.input}</p></div><Files files={turn.attachments} label="附件" /></div>
      {!!turn.rules.length && <section><h3 className="eval-section-title">澄清回复 <span className="eval-section-count">（{turn.rules.length}）</span></h3><div className="eval-result-reply-list">
        <div className="eval-result-reply-columns" aria-hidden="true"><span /><span>预期追问</span><span>自动回复</span></div>
        {turn.rules.map((rule, ri) => <div className="eval-result-reply-row" key={rule.id}><span className="eval-result-number">{ri + 1}</span><div><span className="eval-result-mobile-label">预期追问</span><p>{rule.match}</p></div><div><span className="eval-result-mobile-label">自动回复</span><p>{clarificationResponses(rule.responses)}</p></div></div>)}
      </div></section>}
      <Standards label="评测标准" checks={checksOf(turn)} />
    </TurnCard>)}
    <Standards label="整体评测标准" checks={value.checks || []} />
  </div>
}
