import { Popover } from "radix-ui"
import { RegexAssistant } from "./RegexAssistant"
import { EvaluationSelect } from "./EvaluationSelect"
import { CheckTypeIcon } from "./CheckTypeIcon"
import { sessionAttachmentTip } from "./attachment-help"
import { AttachmentRow } from "./AttachmentRow"
import { flushSync } from "react-dom"
import { TurnCard } from "./TurnCard"
import { saveAttachment, downloadAttachment } from "@/services/evaluation-attachments"
import { useCallback, useId, useRef, useState, useLayoutEffect, type TextareaHTMLAttributes } from "react"
import { Button, BrandButton, Icon, Tooltip, ConfirmDialog, DropdownMenu, useDialog } from "@/ui"
import { caseValidation, checkKind, checkOperators, checkValidation, checkDescription, checksOf, turnsOf, type EvalCheck, type EvalCase, type EvalTurn, type EvalAttachment } from "@/services/evaluation"

function useDeleteConfirmation() {
  const dialog = useDialog()
  return (title: string, description: string, onConfirm: () => void, hasContent = true) => {
    if (!hasContent) { onConfirm(); return }
    dialog.show(() => <ConfirmDialog variant="danger" title={title} description={description} cancelText="取消" confirmText="删除" onConfirm={onConfirm} />)
  }
}

export function AttachmentInput({ files, onChange, label, tip, children, onUploadingChange }: { onUploadingChange?: (uploading: boolean) => void; children?: React.ReactNode; files: EvalAttachment[]; onChange: (files: EvalAttachment[]) => void; label: string; tip?: string }) {
  const [error, setError] = useState("")
  const [uploading, setUploading] = useState(false)
  return <div className={`eval-attachments${label === "附件" ? " eval-attachments-inline" : ""}`}><div className="eval-field-heading"><span className="eval-field-label">{children ? "用户输入" : label}</span>{tip && (label === "会话附件" || label === "本轮附件") && <Tooltip value={tip}><button type="button" className="eval-field-help" aria-label={tip}><Icon name="help" size="small" /></button></Tooltip>}</div><label className="eval-upload-trigger eval-add-action">{!uploading && <Icon name="plus-small" size="small" />}<span>{uploading ? "正在保存附件…" : "添加附件"}</span><input aria-label={label} className="eval-file-input" type="file" multiple disabled={uploading} onChange={async e => {
    const chosen = Array.from(e.target.files || []); e.target.value = ""
    setUploading(true)
    onUploadingChange?.(true)
    try {
      const next = await Promise.all(chosen.map(saveAttachment))
      onChange([...files, ...next]); setError("")
    } catch { setError("附件保存失败，请重试。") } finally { setUploading(false); onUploadingChange?.(false) }
  }} /></label>{children && <div className="eval-input-content">{children}</div>}{uploading && <p role="status">正在保存附件…</p>}{error && <p role="alert">{error}</p>}{files.map(f => <AttachmentRow key={f.id} file={f} download={() => { void downloadAttachment(f).catch(() => setError("附件无法读取，请重新添加。")) }} remove={() => onChange(files.filter(x => x.id !== f.id))} />)}</div>
}
function StandardInput(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const resize = () => {
      if (!el.clientWidth) return
      el.style.height = "auto"
      el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
    }
    resize()
    let width = el.clientWidth
    const observer = new ResizeObserver(() => {
      if (width !== el.clientWidth) { width = el.clientWidth; resize() }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [props.value])
  return <textarea {...props} ref={ref} rows={props.rows ?? 1} />
}
function simplifyCheck(check: EvalCheck): EvalCheck {
  return { ...check, kind: checkKind(check), text: !check.kind || check.kind === "natural" ? checkDescription(check) : check.text, condition: undefined, reference: undefined, files: [] }
}
function KeywordInput({ value, onChange, field }: { value: string; onChange: (value: string) => void; field: { id: string } }) {
  const [tokens, setTokens] = useState(() => value.split("\n").map(v => v.trim()).filter(Boolean))
  const [pending, setPending] = useState("")
  const commit = () => {
    const next = [...new Set([...tokens, ...pending.split("\n").map(v => v.trim()).filter(Boolean)])]
    setTokens(next); setPending(""); onChange(next.join("\n"))
  }
  return <div className="eval-keywords">
    {tokens.map((token, i) => <span className="eval-keyword" key={i}>{token}<button type="button" aria-label={`移除关键词 ${token}`} onClick={() => { const next = tokens.filter((_, n) => n !== i); setTokens(next); onChange([...next, pending].filter(Boolean).join("\n")) }}>×</button></span>)}
    <input {...field} data-check-field="true" value={pending} placeholder={tokens.length ? "继续添加关键词" : "可添加多个关键词，按回车确认"} onChange={e => { setPending(e.target.value); onChange([...tokens, e.target.value].filter(Boolean).join("\n")) }} onBlur={commit} onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); commit() } }} />
  </div>
}
function CheckEditor({ label, checks, onChange, fieldProps, fieldError }: {
  label: string; checks: EvalCheck[]; onChange: (v: EvalCheck[]) => void;
  fieldProps: (key: string, label: string, message: string) => { id: string };
  fieldError: (key: string) => React.ReactNode;
}) {
  const confirmDelete = useDeleteConfirmation()
  checks = checks.map(simplifyCheck)
  const [activeRegex, setActiveRegex] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const addedField = useRef<string | undefined>(undefined)
  const patch = (id: string, value: Partial<EvalCheck>) => onChange(checks.map(c => c.id === id ? { ...c, ...value } : c))
  return <section className="eval-check-editor" aria-label={label}>
    <div className="eval-toolbar"><div className="eval-field-heading"><h3 className="eval-section-title">{label} <span className="eval-section-count">（{checks.length}）</span></h3></div>
      <div className="eval-check-add">
        <DropdownMenu open={adding} onOpenChange={setAdding} placement="bottom-end" gutter={4}>
          <DropdownMenu.Trigger className="eval-add-action" data-component="button" data-variant="ghost"><Icon name="plus-small" size="small" />添加标准</DropdownMenu.Trigger>
          <DropdownMenu.Portal><DropdownMenu.Content className="eval-select-menu" onCloseAutoFocus={event => { const id = addedField.current; if (id) { event.preventDefault(); addedField.current = undefined; requestAnimationFrame(() => document.getElementById(id)?.focus()) } }} aria-label="选择标准类型">
            {([['natural', '语义判断'], ['keyword', '关键词匹配'], ['regex', '正则匹配'], ['file', '文件存在性']] as const).map(([kind, name]) => <DropdownMenu.Item key={kind} onSelect={() => {
              const id = crypto.randomUUID()
              addedField.current = fieldProps(id, "", "").id
              flushSync(() => { onChange([...checks, { id, kind, operator: kind === "file" ? "exists" : kind === "regex" ? "regex" : "all", text: "", required: true, files: [] }]); setAdding(false) })
            }}><CheckTypeIcon kind={kind} /><DropdownMenu.ItemLabel>{name}</DropdownMenu.ItemLabel></DropdownMenu.Item>)}
          </DropdownMenu.Content></DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </div>
    {!checks.length && <p className="eval-muted">{label === "整体评测标准" ? "检查整段对话是否完成任务；已有本轮标准时，这里可以不填。" : "写清这一轮怎样才算做对。例如：缺少单号时先询问，不自行编造。"}</p>}
    {checks.some(c => c.kind === "keyword" || c.kind === "regex") && <span className="eval-muted">文本检查范围：{label === "整体评测标准" ? "最后一轮最终回复" : "本轮最终回复"}。</span>}
    {checks.some(c => c.kind === "file") && <span className="eval-muted">文件存在性范围：仅检查产物文件是否存在，不检查内容。</span>}
    {checks.map((check, index) => {
      const props = fieldProps(check.id, `${label} ${index + 1}`, `请填写${label} ${index + 1}，不能仅包含空格。`)
      return <div className="eval-standard-item" key={check.id}>
        <label className="eval-standard-number" htmlFor={props.id}>{index + 1}</label>
        <div className="eval-standard-field" data-kind={check.kind || "natural"}>
          <span className="eval-check-kind"><CheckTypeIcon kind={check.kind || "natural"} />{{ natural: "语义判断", text: "文本检查", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }[check.kind || "natural"]}</span>
          {check.kind && check.kind !== "natural" && <EvaluationSelect label={`标准 ${index + 1} 检查方式`} value={check.operator || (check.kind === "file" ? "exists" : check.kind === "regex" ? "regex" : "all")} onChange={value => patch(check.id, { operator: value as EvalCheck["operator"] })} options={(check.kind === "file" ? ["exists", "not_exists"] as const : check.kind === "regex" ? ["regex", "not_regex"] as const : ["all", "any", "none"] as const).map(op => ({ value: op, label: checkOperators[op] }))} />}
          <div className={`eval-check-value${check.kind === "regex" ? " eval-regex-value" : ""}`}>
            {check.kind === "keyword" ? <KeywordInput key={`${check.id}-keywords`} field={props} value={check.text} onChange={text => patch(check.id, { text })} /> : <StandardInput {...props} required placeholder={check.kind === "file" ? "相对工作区的文件路径，如 outputs/对账报告.xlsx" : check.kind === "regex" ? "输入正则表达式，无需两侧斜杠" : "例如：缺少组织信息时，应先询问用户"} value={check.text} onChange={e => patch(check.id, { text: e.target.value })} />}
            {check.kind === "regex" && <Popover.Root open={activeRegex === check.id} onOpenChange={open => setActiveRegex(open ? check.id : null)}>
              <Popover.Trigger asChild><Button className="eval-regex-generate" variant="ghost">AI 生成</Button></Popover.Trigger>
              <Popover.Portal><Popover.Content className="eval-regex-popover" side="bottom" align="end" sideOffset={8} collisionPadding={12} aria-label="生成正则表达式">
                <RegexAssistant exclude={check.operator === "not_regex"} close={() => setActiveRegex(null)} apply={text => patch(check.id, { text })} />
              </Popover.Content></Popover.Portal>
            </Popover.Root>}
            {fieldError(check.id)}
          </div>
        </div>
        <Tooltip value="删除标准"><button type="button" className="eval-standard-delete" aria-label={`删除${label} ${index + 1}`} onClick={() => confirmDelete(`删除${label} ${index + 1}？`, "将移除这条评测标准，保存用例后生效。", () => onChange(checks.filter(c => c.id !== check.id)), !!(check.text.trim() || check.files?.length))}><Icon name="trash-16" size="small" /></button></Tooltip>
      </div>
    })}
  </section>
}
export function CaseEditor({ draft, update, save, cancel, editing }: { draft: EvalCase; update: (c: EvalCase) => void; save: (c: EvalCase) => void; cancel: () => void; editing: boolean }) {
  const confirmDelete = useDeleteConfirmation()
  const prefix = useId()
  const [uploadingCount, setUploadingCount] = useState(0)
  const onUploadingChange = useCallback((uploading: boolean) => {
    setUploadingCount(count => count + (uploading ? 1 : -1))
  }, [])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const fieldProps = (key: string, label: string, message: string) => ({
    id: `${prefix}-${key}`, name: key, autoComplete: "off", "aria-label": label, "data-required-message": message,
    "aria-invalid": !!errors[`${prefix}-${key}`],
    "aria-describedby": errors[`${prefix}-${key}`] ? `${prefix}-${key}-error` : undefined,
  })
  const fieldError = (key: string) => errors[`${prefix}-${key}`] ? <span className="eval-field-error" id={`${prefix}-${key}-error`} role="alert">{errors[`${prefix}-${key}`]}</span> : null
  const formRef = useRef<HTMLFormElement>(null)
  const currentDraft = useRef(draft)
  currentDraft.current = draft
  const turns = turnsOf(draft).map((t, i, list) => ({ ...t, checks: checksOf(t, i && t.inherit ? list[0].expected : undefined).map(simplifyCheck) }))
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(turns.map((t, i) => [t.id, i === 0])))
  const allExpanded = turns.every(t => expanded[t.id] ?? true)
  const hasTurnErrors = (turn: typeof turns[number]) => [
    `${turn.id}-input`, ...turn.checks.map(c => c.id),
    ...turn.rules.flatMap(r => [`${r.id}-match`, `${r.id}-response`]),
  ].some(key => !!errors[`${prefix}-${key}`])
  const setTurn = (index: number, patch: Partial<EvalTurn>) => update({ ...currentDraft.current, turns: turnsOf(currentDraft.current).map((t, i) => i === index ? { ...t, ...patch } : t) })
  function move(index: number, delta: number) {
    const next = [...turns]; [next[index], next[index + delta]] = [next[index + delta], next[index]]
    next[0] = { ...next[0], inherit: false }; update({ ...draft, turns: next })
  }
  return <form ref={formRef} className="eval-form" noValidate onSubmit={e => {
    e.preventDefault()
    if (uploadingCount > 0 || e.currentTarget.querySelector('input[type="file"]:disabled')) return
    const fields = Array.from(e.currentTarget.querySelectorAll('textarea[required], input[required], input[data-check-field]')) as (HTMLInputElement | HTMLTextAreaElement)[]
    const nextErrors: Record<string, string> = {}
    let firstInvalid: HTMLInputElement | HTMLTextAreaElement | undefined
    const configuredChecks = [...(draft.checks || []), ...turns.flatMap(t => t.checks)]
    for (const f of fields) {
      const check = configuredChecks.find(c => `${prefix}-${c.id}` === f.id)
      f.setCustomValidity(check ? checkValidation(check) : f.value.trim() ? "" : f.dataset.requiredMessage || "请填写此项")
      if (!f.checkValidity()) {
        nextErrors[f.id] = f.validationMessage
        firstInvalid ??= f
      }
    }
    flushSync(() => {
      setErrors(nextErrors)
      const id = firstInvalid?.closest<HTMLElement>("[data-turn-id]")?.dataset.turnId
      if (id) setExpanded(prev => ({ ...prev, [id]: true }))
    })
    if (firstInvalid) {
      firstInvalid.scrollIntoView({ block: "center", behavior: "auto" })
      firstInvalid.focus({ preventScroll: true })
      return
    }
    if (!(draft.checks?.length || turns.some(t => t.checks.length))) {
      setErrors({ ...nextErrors, checks: "请至少添加一条本轮或整体评测标准。" })
      formRef.current?.querySelector<HTMLElement>("[data-global-checks]")?.scrollIntoView({ block: "center" })
      formRef.current?.querySelector<HTMLButtonElement>("[data-global-checks] [data-component=button]")?.focus()
      return
    }
    const validation = caseValidation(draft)
    if (validation) { setErrors({ ...nextErrors, checks: validation }); return }
    const normalized = turns.map(t => ({ ...t, rules: t.rules.map(r => ({ ...r, responses: [r.responses.join("\n")] })), inherit: false, expected: t.checks.map(checkDescription).join("；") }))
    save({ ...draft, name: draft.name.trim(), input: turns[0].input, expected: normalized[0].expected, turns: normalized, checks: draft.checks?.map(simplifyCheck), demo: false })
  }} onInput={e => { const el = e.target as HTMLInputElement
    if (!el.setCustomValidity) return
    el.setCustomValidity("")
    if (el.value.trim()) setErrors(prev => { const next = { ...prev }; delete next[el.id]; return next }) }}>
    <h3>{editing ? "编辑用例" : "新增用例"}</h3>
    <p className="eval-muted">先填写名称、用户输入和至少一条评测标准。附件、澄清回复和多轮对话按需添加。</p>
    <label>用例名称<input {...fieldProps("name", "用例名称", "请填写用例名称，不能仅包含空格。")} name="case-name" required placeholder="例如：缺少单号时先询问" value={draft.name} onChange={e => update({ ...draft, name: e.target.value })} />{fieldError("name")}</label>
    <AttachmentInput onUploadingChange={onUploadingChange} label="会话附件" tip={sessionAttachmentTip} files={draft.attachments || []} onChange={attachments => update({ ...currentDraft.current, attachments })} />
    <div className="eval-toolbar"><h3>对话轮次（{turns.length}）</h3><div className="eval-actions">{turns.length > 1 && <Button onClick={() => setExpanded(Object.fromEntries(turns.map(t => [t.id, !allExpanded])))}>{allExpanded ? "全部折叠" : "全部展开"}</Button>}</div></div>
    {turns.map((turn, index) => <TurnCard key={turn.id} turnId={turn.id} number={index + 1} input={turn.input}
      meta={(expanded[turn.id] ?? true) ? "" : [turn.attachments.length && `附件 ${turn.attachments.length}`, turn.rules.length && `澄清回复 ${turn.rules.length}`, turn.checks.length && `评测标准 ${turn.checks.length}`].filter(Boolean).join(" · ")}
      status={!(expanded[turn.id] ?? true) && hasTurnErrors(turn) ? <span className="eval-field-error">有未填项</span> : null}
      open={expanded[turn.id] ?? true} toggle={() => setExpanded(prev => ({ ...prev, [turn.id]: !(prev[turn.id] ?? true) }))}
      actions={turns.length > 1 ? <><Button disabled={!index} onClick={() => move(index, -1)}>上移</Button><Button disabled={index === turns.length - 1} onClick={() => move(index, 1)}>下移</Button>{turns.length > 1 && <Button onClick={() => confirmDelete(`删除第 ${index + 1} 轮对话？`, "将移除本轮输入、附件、澄清回复及标准，保存用例后生效。", () => { const next = turnsOf(currentDraft.current).filter(t => t.id !== turn.id); if (next.length) { next[0] = { ...next[0], inherit: false }; update({ ...currentDraft.current, turns: next }) } })}>删除轮次</Button>}</> : undefined}>
      <AttachmentInput onUploadingChange={onUploadingChange} label="附件" files={turn.attachments} onChange={attachments => { const i = turnsOf(currentDraft.current).findIndex(t => t.id === turn.id); if (i >= 0) setTurn(i, { attachments }) }}>
        <StandardInput className="eval-user-input" rows={2} {...fieldProps(`${turn.id}-input`, "用户输入", `请填写第 ${index + 1} 轮的用户输入，不能仅包含空格。`)} required value={turn.input} onChange={e => setTurn(index, { input: e.target.value })} />{fieldError(`${turn.id}-input`)}
      </AttachmentInput>
      <section className="eval-clarification-section"><div className="eval-toolbar"><div className="eval-field-heading"><h3 className="eval-section-title">澄清回复</h3></div><Button className="eval-add-action" icon="plus-small" onClick={() => setTurn(index, { rules: [...turn.rules, { id: crypto.randomUUID(), match: "", responses: [""] }] })}>添加澄清回复</Button></div>
      <p className="eval-muted">可选：技能或智能体追问时，让评测按这里的配置自动回答，无需你在运行时逐条回复。</p>
      {turn.rules.length > 0 && <div className="eval-clarification-list">
        <div className="eval-clarification-columns" aria-hidden="true"><span /><span>预期追问</span><span>自动回复</span><span /></div>
        {turn.rules.map((rule, ruleIndex) => <section className="eval-clarification-row" key={rule.id} aria-label={`澄清回复 ${ruleIndex + 1}`}>
          <span className="eval-clarification-number">{ruleIndex + 1}</span>
          <div className="eval-clarification-cell eval-clarification-prompt">
            <label className="eval-clarification-mobile-label" htmlFor={`${prefix}-${rule.id}-match`}>预期追问</label>
            <StandardInput {...fieldProps(`${rule.id}-match`, "预期追问", `请填写第 ${index + 1} 轮澄清回复的追问内容，不能仅包含空格。`)} required value={rule.match} placeholder="例如：需要查询哪个核算组织？" onChange={e => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, match: e.target.value } : r) })} />
            {fieldError(`${rule.id}-match`)}
          </div>
          <div className="eval-clarification-cell eval-clarification-answer">
            <label className="eval-clarification-mobile-label" htmlFor={`${prefix}-${rule.id}-response`}>自动回复</label>
            <StandardInput {...fieldProps(`${rule.id}-response`, "自动回复", `请填写第 ${index + 1} 轮的自动回复，不能仅包含空格。`)} required value={rule.responses.join("\n")} placeholder="例如：华东公司" onChange={e => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: [e.target.value] } : r) })} />
            {fieldError(`${rule.id}-response`)}
          </div>
          <div className="eval-clarification-remove-slot"><Tooltip value="删除澄清回复"><button type="button" className="eval-standard-delete eval-clarification-remove" aria-label={`删除澄清回复 ${ruleIndex + 1}`} onClick={() => confirmDelete(`删除澄清回复 ${ruleIndex + 1}？`, "将移除这组预期追问和自动回复，保存用例后生效。", () => setTurn(index, { rules: turn.rules.filter(r => r.id !== rule.id) }), !!(rule.match.trim() || rule.responses.some(v => v.trim())))}><Icon name="trash-16" size="small" /></button></Tooltip></div>
        </section>)}
      </div>}
      </section>
      <CheckEditor label="评测标准" checks={turn.checks} onChange={checks => setTurn(index, { checks, inherit: false })} fieldProps={fieldProps} fieldError={fieldError} />
    </TurnCard>)}
    <Button className="eval-add-turn eval-add-action" icon="plus-small" onClick={() => {
      const id = crypto.randomUUID()
      flushSync(() => { update({ ...draft, turns: [...turns, { id, input: "", expected: "", attachments: [], rules: [] }] }); setExpanded(prev => ({ ...prev, [id]: true })) })
      formRef.current?.querySelector<HTMLTextAreaElement>(`[data-turn-id="${id}"] textarea`)?.focus()
    }}>添加一轮对话</Button>
    <div data-global-checks><CheckEditor label="整体评测标准" checks={draft.checks || []} onChange={checks => { update({ ...currentDraft.current, checks }); setErrors(prev => ({ ...prev, checks: "" })) }} fieldProps={fieldProps} fieldError={fieldError} />{errors.checks && <p className="eval-field-error" role="alert">{errors.checks}</p>}</div>
    <div className="eval-actions eval-form-footer"><BrandButton type="submit" variant="primary" disabled={uploadingCount > 0}>保存</BrandButton>{uploadingCount > 0 && <span role="status" className="eval-muted">附件上传中，请等待完成后保存</span>}<Button onClick={cancel}>取消</Button></div>
  </form>
}
