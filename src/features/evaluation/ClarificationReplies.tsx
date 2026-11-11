import { clarifyPickModes, type EvalTurn } from "@/services/evaluation"

/** 当前用例、历史快照及运行结果共用同一组响应式字段。 */
export function ClarificationReplies({ rules }: { rules: EvalTurn["rules"] }) {
  return <div className="eval-result-reply-list">
    <div className="eval-result-reply-columns" aria-hidden="true"><span /><span>澄清选择</span></div>
    {rules.map((rule, index) => <div className="eval-result-reply-row" key={rule.id} aria-label={`澄清场景 ${index + 1}`}>
      <span className="eval-result-number">{index + 1}</span>
      <div className="eval-result-reply-prompt"><span className="eval-result-mobile-label">澄清选择</span><p>{clarifyPickModes[rule.pickMode || "input"]}：{rule.match}</p></div>
    </div>)}
  </div>
}
