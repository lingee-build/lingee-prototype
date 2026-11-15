import { EvaluationJsonEditor } from "./EvaluationJsonEditor"
import { useRef, useState } from "react"
import { Icon } from "@/ui"
import type { EvalCase } from "@/services/evaluation"
import { previewEvaluationCase, usesEvaluationPlaceholders, type EvaluationParameters } from "@/services/evaluation-placeholders"
import { parsePlaceholderData } from "@/vendor/build-evaluation/placeholders"
import { EvaluationPlaceholderHelp } from "./EvaluationPlaceholderHelp"

export function useEvaluationPlaceholderSetup(cases: EvalCase[], sourceData?: EvaluationParameters["data"]) {
  const [text, setText] = useState(() => sourceData ? JSON.stringify(sourceData, null, 2) : "")
  const affected = cases.filter(usesEvaluationPlaceholders)
  let data: EvaluationParameters["data"] | undefined
  try { data = parsePlaceholderData(text) } catch { /* 编辑时允许暂时无效的 JSON */ }
  const previews = data ? affected.map(item => ({ item, ...previewEvaluationCase(item, data) })) : []
  const errors = [...new Set(previews.flatMap(item => [...item.caseErrors, ...item.turns.flatMap(turn => [...turn.errors, ...turn.expectedErrors])]))]
  const missing = errors.flatMap(error => error.match(/^\{\{diyJson\.?(.*?)\}\}：字段不存在$/)?.[1] || [])
  const otherErrors = errors.filter(error => !/^\{\{diyJson\.?(.*?)\}\}：字段不存在$/.test(error))
  return {
    affected, text, setText, previews, data, missing, otherErrors,
    valid: !!data && !errors.length,
    parameters: data && (affected.length || text.trim()) ? { data } : undefined,
  }
}

export function EvaluationPlaceholderSetup({ setup, attempted, fullscreen, onFullscreen }: { setup: ReturnType<typeof useEvaluationPlaceholderSetup>; attempted: boolean; fullscreen: boolean; onFullscreen: () => void }) {
  const help = useRef<HTMLDialogElement>(null)
  const invalid = !setup.data || (attempted && !setup.valid)
  return <details className="eval-placeholder-card" open={!!setup.affected.length}>
    <summary><strong id="evaluation-placeholder-label">问题占位符</strong><Icon name="chevron-down" size="small" /></summary>
    <div className="eval-placeholder-setup">
      <div className="eval-json-surface" data-fullscreen={fullscreen ? "" : undefined}>
        <div className="eval-placeholder-toolbar">
          {fullscreen && <strong>问题占位符 · JSON</strong>}
          <div className="eval-placeholder-actions">
            <button type="button" disabled={!setup.text.trim() || !setup.data} onClick={() => setup.setText(JSON.stringify(setup.data, null, 2))}><Icon name="code-lines" size="small" />格式化</button>
            <button type="button" aria-label={fullscreen ? "退出全屏" : "全屏"} onClick={onFullscreen}>
              <Icon name={fullscreen ? "fullscreen-exit" : "fullscreen-enter"} className="eval-fullscreen-icon" size="small" />{fullscreen ? "退出全屏" : "全屏"}
            </button>
          </div>
        </div>
        <div className="eval-json-pane">
          <div className="eval-json-editor" data-invalid={invalid}>
            <EvaluationJsonEditor value={setup.text} invalid={invalid} onChange={setup.setText} />
          </div>
          {!setup.data && <p className="eval-field-error" role="alert">请输入有效的 JSON 对象。</p>}
          <div className="eval-placeholder-diagnostics" id="evaluation-placeholder-diagnostics" role="status">
            {!!setup.missing.length && <p className="eval-field-error"><strong>缺少 {setup.missing.length} 个 diyJson 字段</strong> · {setup.missing.join("、")}</p>}
            {setup.otherErrors.map(error => <p key={error} className="eval-field-error">{error}</p>)}
          </div>
          <p className="eval-muted"><span id="evaluation-placeholder-hint">用例引用 diyJson 时，在此填写 JSON。日期、随机数等内置变量会在运行时自动生成。</span>{" "}
            <button type="button" className="eval-placeholder-syntax-link" aria-haspopup="dialog" onClick={() => help.current?.showModal()}><Icon name="help" size="small" /><span>占位符语法</span></button>
          </p>
        </div>
        <EvaluationPlaceholderHelp drawer={help} />
        {!!setup.previews.length && <div className="eval-placeholder-preview">
          <h3 className="eval-preview-heading">占位符预览</h3>
          {setup.previews.map(({ item, turns, expected, caseErrors }) =>
            <details key={item.id} open>
              <summary>
                <Icon name="chevron-down" size="small" />
                <span className="eval-preview-name" title={item.name}>{item.name || "占位符预览"}</span>
                <span className="eval-preview-code">{item.businessId || item.code}</span>
              </summary>
              {turns.length > 1 && <PreviewAnswer criteria={expected} />}
              {turns.length > 1 && !!caseErrors.length && <p className="eval-field-error">标准答案或预期材料有未解析的占位符，无法评分</p>}
              {turns.map((turn, index) => {
                const fields = Object.entries(turn.sourceFields ?? {}).filter(([key]) => /^(session|turn):/.test(key))
                return <section key={index} className="eval-placeholder-round">
                  <strong>第 {index + 1} 轮</strong>
                  <div><b>用户输入</b><p>{turn.value}</p></div>
                  {!!turn.errors.length && <p className="eval-field-error">该轮输入有未解析的占位符，无法发送</p>}
                  <PreviewAnswer criteria={[...turn.expected, ...(turns.length === 1 ? expected : [])]} />
                  {!!fields.length && <div><b>预期材料</b>{fields.map(([key, value]) => <p key={key}>{key} · {value}</p>)}</div>}
                  {(!!turn.expectedErrors.length || (turns.length === 1 && !!caseErrors.length)) && <p className="eval-field-error">标准答案或预期材料有未解析的占位符，无法评分</p>}
                  {!!turn.dynamic.length && <p className="eval-muted">发送前生成 · {[...new Set(turn.dynamic)].join("、")}</p>}
                </section>
              })}
            </details>
          )}
        </div>}
      </div>
    </div>
  </details>
}

function PreviewAnswer({ criteria }: { criteria: { description?: string }[] }) {
  const text = criteria.map(entry => entry.description).filter(value => value?.trim()).join("\n")
  if (!text) return null
  return <div className="eval-preview-answer"><h3>标准答案</h3><div>{text}</div></div>
}
