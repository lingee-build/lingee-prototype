import { clarificationResponses, type EvalTurn } from "@/services/evaluation"

/** 当前用例、历史快照及运行结果共用同一组响应式字段。 */
export function ClarificationReplies({ rules }: { rules: EvalTurn["rules"] }) {
  return <div className="eval-result-reply-list">
    <div className="eval-result-reply-columns" aria-hidden="true"><span /><span>预期追问</span><span>自动回复</span></div>
    {rules.map((rule, index) => <div className="eval-result-reply-row" key={rule.id} aria-label={`澄清回复配置 ${index + 1}`}>
      <span className="eval-result-number">{index + 1}</span>
      <div className="eval-result-reply-prompt"><span className="eval-result-mobile-label">预期追问</span><p>{rule.match}</p></div>
      <div className="eval-result-reply-answer"><span className="eval-result-mobile-label">自动回复</span><p>{clarificationResponses(rule.responses)}</p></div>
    </div>)}
  </div>
}
