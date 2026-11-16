import { useEffect, useRef, useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { EvaluationPlaceholderSetup, useEvaluationPlaceholderSetup } from "./EvaluationPlaceholderSetup"
import type { EvalCase, EvalRun } from "@/services/evaluation"
import type { EvaluationParameters } from "@/services/evaluation-placeholders"
import { Button, Dialog, DropdownMenu, Icon } from "@/ui"
import { useT } from "@/i18n"
import { useSync } from "@/stores/sync"
import { EvaluationModelSelect } from "./EvaluationModelSelect"
import { resolveEvaluationModels, resolveRerunModels, evaluationModelText, type EvalModelIds, type EvalModelSnapshot, type EvalRunModels } from "@/services/evaluation-models"

const salesDemoObject = "skill:sale-order-management-eval-demo"
const salesDemoParameters: EvaluationParameters["data"] = {
  order: { no: "XSDD-240817-000013", amount: "5.00" },
  product: { name: "绿茶", qty: "2", amount: "4.00" },
}

export function RunEvaluationDialog({ objectId, qualityOnly, cases, sourceRun, name, count, scope, initial, defaults, rerun, originalModels, missingCount, version, breakdown, onClose, onStart }: {
  objectId: string; cases: EvalCase[]; sourceRun?: EvalRun; qualityOnly?: boolean; name: string; count: number; scope: string; initial: EvalModelIds; defaults: EvalModelIds; rerun: boolean; missingCount: number
  originalModels?: EvalRunModels
  version?: string; breakdown?: string
  onClose: () => void; onStart: (models: EvalRunModels, configuration: {concurrency: number; executions: EvalModelSnapshot[]; parameters?: EvaluationParameters}) => void | Promise<void>
}) {
  const t = useT()
  const models = useSync(s => s.models)
  const ready = useSync(s => s.ready)
  const [selection, setSelection] = useState(initial)
  const [concurrency, setConcurrency] = useState(sourceRun?.concurrency ?? 5)
  const [additional, setAdditional] = useState<string[]>([])
  const [starting, setStarting] = useState(false)
  const submitting = useRef(false)
  const returnFocus = useRef(document.activeElement as HTMLElement | null)
  useEffect(() => {
    const trigger = returnFocus.current
    return () => { queueMicrotask(() => { if (trigger?.isConnected) trigger.focus() }) }
  }, [])
  const sources = ["skill:query-sales-order", salesDemoObject].includes(objectId)
    ? ["sit_test", "xkmcp_test"].map(name => ({ name, description: "连接器：金蝶ERP · 领域 scmc" }))
    : []
  const [mcpSource, setMcpSource] = useState(() => sources.length === 1 ? sources[0].name : "")
  const [editorFullscreen, setEditorFullscreen] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [error, setError] = useState("")
  const close = () => { if (!submitting.current) onClose() }
  const modelError = (id: string) => !ready ? undefined : !models.length ? t("proto.eval.models.empty")
    : !id ? t(rerun ? "proto.eval.models.legacy" : "proto.eval.models.required")
    : !models.some(model => model.id === id) ? t("proto.eval.models.unavailable") : undefined
  const resolve = () => rerun ? resolveRerunModels(originalModels, useSync.getState().models) : resolveEvaluationModels(selection, useSync.getState().models)
  const defaultParameters = objectId === salesDemoObject && !qualityOnly && !sourceRun ? salesDemoParameters : undefined
  const placeholders = useEvaluationPlaceholderSetup(qualityOnly ? [] : cases, sourceRun?.placeholderData ?? defaultParameters)
  const valid = Number.isInteger(concurrency) && concurrency >= 1 && concurrency <= 5 && (qualityOnly || placeholders.valid) && ready && !!resolve() && (!!selection.execution || additional.length>0)
  async function start(event: React.FormEvent) {
    event.preventDefault()
    if (submitting.current) return
    setAttempted(true)
    if (!qualityOnly && sources.length > 1 && !mcpSource) {
      document.getElementById("eval-mcp-source")?.focus()
      return
    }
    if (!valid) {
      if (!qualityOnly && !placeholders.valid) {
        const card = document.querySelector<HTMLDetailsElement>(".eval-run-dialog .eval-placeholder-card")
        if (card) card.open = true
        card?.querySelector<HTMLElement>(".cm-content")?.focus()
      }
      return
    }
    const resolved = resolve()
    if (!resolved) { setError(t("proto.eval.models.changed")); return }
    submitting.current = true
    setStarting(true)
    setError("")
    try {
      const executions = [resolved.execution, ...additional.filter(id=>id!==resolved.execution.id).map(id=>resolveEvaluationModels({execution:id,judging:selection.judging},useSync.getState().models)?.execution)]
      if (executions.some(model=>!model)) throw new Error("所选执行模型已不可用，请重新选择。")
      await onStart(resolved, {concurrency, executions: executions as EvalModelSnapshot[], parameters: mcpSource ? { data: placeholders.data ?? {}, mcpSource } : placeholders.parameters})
    }
    catch (error) { setError(error instanceof Error ? error.message : t("proto.eval.models.startFailed")) }
    finally { submitting.current = false; setStarting(false) }
  }
  return <Radix.Root open modal onOpenChange={open => { if (!open) close() }}>
    <Radix.Portal>
      <Radix.Overlay data-component="dialog-overlay" />
      <Dialog fit title={"确认开始评测"} width={`min(${placeholders.affected.length ? 720 : 560}px, calc(100vw - 32px))`} className="eval-run-dialog" onClose={close} onEscapeKeyDown={event => {
        if (!editorFullscreen) return
        event.preventDefault()
        setEditorFullscreen(false)
      }}>
        <form className="eval-run-setup" data-editor-fullscreen={editorFullscreen ? "" : undefined} onSubmit={start} aria-busy={starting}>
          <div className="eval-run-scroll">
          <dl className="eval-run-context">
            <div><dt>被测对象</dt><dd>{name}</dd></div>
            <div><dt>{t("proto.eval.models.scope")}</dt><dd>{qualityOnly ? "待补评用例" : rerun && scope === t("proto.eval.models.rerunAll") ? "全部用例" : scope} · {t("proto.eval.models.count", { count })}</dd></div>
            <div><dt>用例来源</dt><dd>{version || "当前用例"}</dd></div>
          </dl>
          <p className="eval-run-note">{qualityOnly ? "沿用原业务证据，只为缺少有效分数的用例补评。" : rerun ? "使用来源报告的用例快照与最新已保存的对象内容。" : "使用当前用例与最新已保存的对象内容，发起运行时保存本次使用的用例。"}</p>
          {!!missingCount && <p className="eval-run-note" role="status">{t("proto.eval.models.deletedCases", { count: missingCount })}</p>}
          <div className="eval-run-settings">
          {rerun ? (["execution", "judging"] as const).map(role => <div className="eval-model-field" key={role}>
            <span>{t(`proto.eval.models.${role}`)}</span><span className="eval-model-readonly">{evaluationModelText(originalModels?.[role])}</span>
          </div>) : (["execution", "judging"] as const).map(role => <EvaluationModelSelect key={role}
            label={role==="execution"?"执行模型":"判定模型"}
            multiple={role==="execution" ? [selection.execution,...additional].filter(Boolean) : undefined}
            onMultipleChange={ids=>{setSelection(current=>({...current,execution:ids[0]||""}));setAdditional(ids.slice(1))}}
            value={selection[role]} models={models} disabled={starting || !ready}
            defaultId={defaults[role]} defaultLabel={t(`proto.eval.models.${role}Default`)}
            error={modelError(selection[role])}
            onChange={id => { setSelection(current => ({ ...current, [role]: id })); setError("") }} />)}
          <div className="eval-model-field eval-concurrency-field"><label htmlFor="eval-concurrency">并发数</label><div className="eval-concurrency-stepper"><button type="button" aria-label="减少并发数" disabled={starting||concurrency<=1} onClick={()=>setConcurrency(n=>n-1)}>−</button><input id="eval-concurrency" aria-label="并发数" inputMode="numeric" value={concurrency} disabled={starting} onChange={e=>setConcurrency(Math.max(1,Math.min(5,Math.trunc(Number(e.target.value))||1)))}/><button type="button" aria-label="增加并发数" disabled={starting||concurrency>=5} onClick={()=>setConcurrency(n=>n+1)}>+</button></div></div>
          {rerun && <p className="eval-muted">沿用来源报告的执行模型和判定模型，本次不可修改。</p>}
          {rerun && ready && !resolve() && <p role="alert" className="eval-field-error">来源报告模型未记录或已不可用，请从当前用例新建运行。</p>}
          {additional.length>0 && <p className="eval-muted">已选 {additional.length + 1} 个执行模型，将分别运行并生成 {additional.length + 1} 份报告。各模型共享本次评测的并发上限。</p>}
          </div>
          {!qualityOnly && <div className="eval-model-field eval-mcp-source-field">
            <label id="eval-mcp-source-label" htmlFor="eval-mcp-source">MCP 服务来源</label>
            <DropdownMenu placement="bottom-start" gutter={6}>
              <DropdownMenu.Trigger id="eval-mcp-source" className="eval-model-trigger" disabled={starting || !sources.length}
                aria-labelledby="eval-mcp-source-label eval-mcp-source-value" aria-describedby="evaluation-mcp-source-hint"
                aria-invalid={attempted && sources.length > 1 && !mcpSource}>
                <span id="eval-mcp-source-value" className="eval-mcp-source-name" data-placeholder={!mcpSource ? "" : undefined}>{mcpSource || "请选择服务来源"}</span>
                <Icon name="chevron-down" size="small" />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal><DropdownMenu.Content className="kcode-model-selector__popover eval-model-popover eval-mcp-source-popover">
                {sources.map(source => <DropdownMenu.Item key={source.name} role="menuitemradio" aria-checked={mcpSource === source.name}
                  className="kcode-model-selector__model-option eval-mcp-source-option" onSelect={() => setMcpSource(source.name)}>
                  <div className="eval-mcp-source-copy"><span className="eval-mcp-source-name" data-slot="dropdown-menu-item-label">{source.name}</span>
                    <span data-slot="dropdown-menu-item-description">{source.description}</span></div>
                  {mcpSource === source.name && <Icon name="check" size="small" />}
                </DropdownMenu.Item>)}
              </DropdownMenu.Content></DropdownMenu.Portal>
            </DropdownMenu>
            <p id="evaluation-mcp-source-hint" role="status" className={attempted && sources.length > 1 && !mcpSource ? "eval-field-error" : "eval-muted"}>
              {!sources.length ? "当前沙箱没有适用于此评测对象的服务来源。" : attempted && !mcpSource ? "请选择服务来源" : "仅用于本次运行。"}
            </p>
          </div>}
          {!qualityOnly && <EvaluationPlaceholderSetup setup={placeholders} attempted={attempted} fullscreen={editorFullscreen} onFullscreen={() => setEditorFullscreen(value => !value)} />}
          {!ready && <p role="status" className="eval-muted">{t("proto.eval.models.loading")}</p>}
          {error && <p className="eval-field-error" role="alert">{error}</p>}
          </div>
          <div className="eval-run-dialog-actions">
            <button className="eval-run-cancel" type="button" disabled={starting} onClick={close}>取消</button>
            <Button variant="primary" type="submit" disabled={starting || !ready || !count || !models.length}>
              {starting ? "正在开始…" : "开始评测"}
            </Button>
          </div>
        </form>
      </Dialog>
    </Radix.Portal>
  </Radix.Root>
}
