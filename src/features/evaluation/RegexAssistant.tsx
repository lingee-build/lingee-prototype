import { evaluationRegex, normalizeEvaluationText, suggestEvaluationRegex as suggestRegex } from "@/services/evaluation-text"
import { useId, useState } from "react"
import { BrandButton } from "@/ui"

export { suggestEvaluationRegex as suggestRegex } from "@/services/evaluation-text"

export function RegexAssistant({ apply, close, exclude = false }: { apply: (pattern: string) => void; close: () => void; exclude?: boolean }) {
  const id = useId()
  const [intent, setIntent] = useState("")
  const [result, setResult] = useState<ReturnType<typeof suggestRegex>>()
  const [error, setError] = useState("")
  const [sample, setSample] = useState("")
  const match = result ? evaluationRegex(result.pattern).exec(normalizeEvaluationText(sample)) : null
  return <section className="eval-regex-assistant" aria-label="生成正则表达式">
      <label htmlFor={`${id}-intent`}>{exclude ? "你希望回复中不出现什么格式的内容？" : "你希望回复中包含什么格式的内容？"}</label>
      <textarea id={`${id}-intent`} autoFocus rows={2} value={intent} placeholder="例如：FHTZ- 开头，后接 8 位日期和 3 位流水号的单号" onChange={e => { setIntent(e.target.value); setResult(undefined); setError("") }} />
      <div className="eval-regex-actions"><BrandButton variant="primary" disabled={!intent.trim()} onClick={() => {
        const next = suggestRegex(intent.trim())
        setResult(next)
        setError(next ? "" : "未能生成可用表达式，请检查格式描述，或手动填写并验证；业务含义判断请使用语义判断")
      }}>{result ? "重新生成" : "生成"}</BrandButton></div>
      {error && <p role="alert" className="eval-field-error">{error}</p>}
      {result && <>
        <label htmlFor={`${id}-pattern`}>正则表达式</label>
        <textarea id={`${id}-pattern`} rows={2} readOnly value={result.pattern} className="eval-check-literal" />
        <p className="eval-muted">{result.explanation}</p>
        <label htmlFor={`${id}-sample`}>验证示例</label>
        <textarea id={`${id}-sample`} rows={2} placeholder="输入一段文本，验证能否匹配" value={sample} onChange={e => setSample(e.target.value)} />
        <p className="eval-muted" role="status">{match ? `匹配内容：${match[0] || "（空文本）"}` : sample ? "未匹配到内容" : "当前示例为空文本，未匹配到内容"}</p>
      </>}
      {result && <div className="eval-regex-actions"><BrandButton variant="primary" onClick={() => { if (result) { apply(result.pattern); close() } }}>使用此表达式</BrandButton></div>}
  </section>
}
