import { sessionAttachmentTip } from "./attachment-help"
import { AttachmentRow } from "./AttachmentRow"
import { flushSync } from "react-dom"
import { TurnCard } from "./TurnCard"
import { saveAttachment, downloadAttachment } from "@/services/evaluation-attachments"
import { useCallback, useId, useRef, useState, useLayoutEffect, type TextareaHTMLAttributes } from "react"
import { Button, BrandButton, Icon, Tooltip, ConfirmDialog, useDialog } from "@/ui"
import { caseValidation, checkKind, checkValidation, checkDescription, checksOf, turnsOf, type EvalCheck, type EvalCase, type EvalTurn, type EvalAttachment } from "@/services/evaluation"

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
function ExpectedAnswer({ label, checks, onChange }: {
  label: string
  checks: EvalCheck[]
  onChange: (value: EvalCheck[]) => void
}) {
  checks = checks.map(simplifyCheck)
  const natural = checks.filter(check => !check.kind || check.kind === "natural")
  const legacy = checks.filter(check => check.kind && check.kind !== "natural")
  const answer = natural.map(check => check.text).filter(text => text.trim()).join("\n")
  return <section className="eval-check-editor" aria-label={label}>
    <h3 className="eval-section-title">{label}</h3>
    <p className="eval-muted">写下本轮预期结果，多项要求可分行填写。</p>
    <div className="eval-standard-field" data-kind="natural">
      <StandardInput rows={3} aria-label={label} value={answer} onChange={event => {
        const text = event.target.value
        onChange(text.trim() ? [{ id: natural[0]?.id ?? crypto.randomUUID(), kind: "natural", text, required: true, files: [] }, ...legacy] : legacy)
      }} />
    </div>
    {legacy.map(check => <p key={check.id} className="eval-muted">{checkDescription(check)}</p>)}
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
  const turns = turnsOf(draft).map((t, i, list) => ({ ...t, checks: [...checksOf(t, i && t.inherit ? list[0].expected : undefined), ...(list.length === 1 ? draft.checks || [] : [])].map(simplifyCheck) }))
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => Object.fromEntries(turns.map((t, i) => [t.id, i === 0])))
  const allExpanded = turns.every(t => expanded[t.id] ?? true)
  const hasTurnErrors = (turn: typeof turns[number]) => [
    `${turn.id}-input`, ...turn.checks.map(c => c.id),
    ...turn.rules.flatMap(r => [`${r.id}-match`, ...r.responses.flatMap((answer, n) => (Array.isArray(answer) ? answer : [answer]).map((_, k) => `${r.id}-response-${n}-${k}`))]),
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
      flushSync(() => { setErrors({ ...nextErrors, checks: "请至少添加一个检查点。" }); setExpanded(prev => ({ ...prev, [turns[0].id]: true })) })
      formRef.current?.querySelector<HTMLElement>(".eval-check-editor")?.scrollIntoView({ block: "center" })
      formRef.current?.querySelector<HTMLTextAreaElement>(".eval-check-editor textarea")?.focus()
      return
    }
    const validation = caseValidation(draft)
    if (validation) { setErrors({ ...nextErrors, checks: validation }); return }
    const normalized = turns.map(t => ({ ...t, inherit: false, expected: t.checks.map(checkDescription).join("；") }))
    save({ ...draft, name: draft.name.trim(), input: turns[0].input, expected: normalized[0].expected, turns: normalized, checks: turns.length === 1 ? [] : draft.checks?.map(simplifyCheck), demo: false })
  }} onInput={e => { const el = e.target as HTMLInputElement
    if (!el.setCustomValidity) return
    el.setCustomValidity("")
    if (el.value.trim()) setErrors(prev => { const next = { ...prev }; delete next[el.id]; return next }) }}>
    <h3>{editing ? "编辑用例" : "新增用例"}</h3>
    <p className="eval-muted">先填写名称、用户输入和至少一个检查点。附件、澄清回复和多轮对话按需添加。</p>
    <div className="eval-case-identity"><label>用例名称<input {...fieldProps("name", "用例名称", "请填写用例名称，不能仅包含空格。")} name="case-name" required placeholder="例如：缺少单号时先询问" value={draft.name} onChange={e => update({ ...draft, name: e.target.value })} />{fieldError("name")}</label>{draft.businessId && <label>来源用例 ID<input readOnly value={draft.businessId} /></label>}{draft.sourceProject && <label>来源项目<input readOnly value={draft.sourceProject} /></label>}{draft.difficulty!==undefined && <label>难度<input aria-label="难度" value={draft.difficulty} onChange={e=>update({...draft,difficulty:e.target.value})}/>{/^(L?4|专家)$/i.test(draft.difficulty) && <small>L4 专家难度按原值保留，不改变八维标尺。</small>}</label>}</div>
    <AttachmentInput onUploadingChange={onUploadingChange} label="会话附件" tip={sessionAttachmentTip} files={draft.attachments || []} onChange={attachments => update({ ...currentDraft.current, attachments })} />
    <div className="eval-toolbar"><h3>对话轮次（{turns.length}）</h3><div className="eval-actions">{turns.length > 1 && <Button variant="ghost" onClick={() => setExpanded(Object.fromEntries(turns.map(t => [t.id, !allExpanded])))}>{allExpanded ? "全部折叠" : "全部展开"}</Button>}</div></div>
    {turns.map((turn, index) => <TurnCard key={turn.id} turnId={turn.id} number={index + 1} input={turn.input}
      meta={(expanded[turn.id] ?? true) ? "" : [turn.attachments.length && `附件 ${turn.attachments.length}`, turn.rules.length && `澄清回复 ${turn.rules.length}`, turn.checks.length && "已填写标准答案"].filter(Boolean).join(" · ")}
      status={!(expanded[turn.id] ?? true) && hasTurnErrors(turn) ? <span className="eval-field-error">有未填项</span> : null}
      open={expanded[turn.id] ?? true} toggle={() => setExpanded(prev => ({ ...prev, [turn.id]: !(prev[turn.id] ?? true) }))}
      actions={turns.length > 1 ? <><Button variant="ghost" disabled={!index} onClick={() => move(index, -1)}>上移</Button><Button variant="ghost" disabled={index === turns.length - 1} onClick={() => move(index, 1)}>下移</Button>{turns.length > 1 && <Button variant="ghost" className="eval-danger-action" onClick={() => confirmDelete(`删除第 ${index + 1} 轮对话？`, "将移除本轮输入、附件、澄清回复及标准，保存用例后生效。", () => { const next = turnsOf(currentDraft.current).filter(t => t.id !== turn.id); if (next.length) { next[0] = { ...next[0], inherit: false }; update({ ...currentDraft.current, turns: next }) } })}>删除轮次</Button>}</> : undefined}>
      <AttachmentInput onUploadingChange={onUploadingChange} label="附件" files={turn.attachments} onChange={attachments => { const i = turnsOf(currentDraft.current).findIndex(t => t.id === turn.id); if (i >= 0) setTurn(i, { attachments }) }}>
        <StandardInput className="eval-user-input" rows={2} {...fieldProps(`${turn.id}-input`, "用户输入", `请填写第 ${index + 1} 轮的用户输入，不能仅包含空格。`)} required value={turn.input} onChange={e => setTurn(index, { input: e.target.value })} />{fieldError(`${turn.id}-input`)}
      </AttachmentInput>
      {Object.entries(turn.sourceFields||{}).map(([key,value])=><label className="eval-source-field" key={key}><span>{key}{/^(turn|session):/.test(key) && <small>来源字段仅作预期材料，需要核对的要求请写入标准答案。</small>}</span><StandardInput aria-label={key} value={value} onChange={e=>setTurn(index,{sourceFields:{...turn.sourceFields,[key]:e.target.value}})}/></label>)}
      <section className="eval-clarification-section"><div className="eval-toolbar"><div className="eval-field-heading"><h3 className="eval-section-title">澄清回复</h3></div><Button variant="ghost" className="eval-add-action" icon="plus-small" onClick={() => setTurn(index, { rules: [...turn.rules, { id: crypto.randomUUID(), match: "", responses: [""] }] })}>添加澄清回复</Button></div>
      <p className="eval-muted">技能或智能体追问时，让评测按这里的配置自动回答，无需你在运行时逐条回复。</p>
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
            {rule.responses.map((response, answerIndex) => <div key={answerIndex}>
              {rule.responses.length > 1 && <span className="eval-muted">问题 {answerIndex + 1} 的答案</span>}
              {(Array.isArray(response) ? response : [response]).map((option, optionIndex) => {
                const key = `${rule.id}-response-${answerIndex}-${optionIndex}`
                return <div key={key}>
                  <StandardInput {...fieldProps(key, `自动回复 ${answerIndex + 1} · ${optionIndex + 1}`, "请填写自动回复，不能仅包含空格。")} required value={option} placeholder="例如：华东公司" onChange={e => {
                    const text = e.target.value
                    setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: r.responses.map((v, n) => n !== answerIndex ? v : Array.isArray(v) ? v.map((x, k) => k === optionIndex ? text : x) : text) } : r) })
                  }} />
                  {fieldError(key)}
                  {Array.isArray(response) && response.length > 1 && <Button variant="ghost" onClick={() => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: r.responses.map((v, n) => n === answerIndex ? (response.length === 2 ? response[1 - optionIndex] : response.filter((_, k) => k !== optionIndex)) : v) } : r) })}>移除此选项</Button>}
                </div>
              })}
              <Button variant="ghost" onClick={() => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: r.responses.map((v, n) => n === answerIndex ? [...(Array.isArray(v) ? v : [v]), ""] : v) } : r) })}>为此题添加选项</Button>
              {rule.responses.length > 1 && <Button variant="ghost" onClick={() => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: r.responses.filter((_, n) => n !== answerIndex) } : r) })}>删除此答案</Button>}
            </div>)}
            <Button variant="ghost" onClick={() => setTurn(index, { rules: turn.rules.map(r => r.id === rule.id ? { ...r, responses: [...r.responses, ""] } : r) })}>添加答案</Button>
            <p className="eval-muted">一次提出多个问题时，按问题顺序分别填写答案。</p>
          </div>
          <div className="eval-clarification-remove-slot"><Tooltip value="删除澄清回复"><button type="button" className="eval-standard-delete eval-clarification-remove" aria-label={`删除澄清回复 ${ruleIndex + 1}`} onClick={() => confirmDelete(`删除澄清回复 ${ruleIndex + 1}？`, "将移除这组预期追问和自动回复，保存用例后生效。", () => setTurn(index, { rules: turn.rules.filter(r => r.id !== rule.id) }), !!(rule.match.trim() || rule.responses.flat().some(v => v.trim())))}><Icon name="trash-16" size="small" /></button></Tooltip></div>
        </section>)}
      </div>}
      </section>
      <ExpectedAnswer label={turns.length > 1 ? "本轮标准答案" : "标准答案"} checks={turn.checks} onChange={checks => turns.length === 1 ? update({ ...currentDraft.current, checks: [], turns: [{ ...turn, checks, inherit: false }] }) : setTurn(index, { checks, inherit: false })} />
    </TurnCard>)}
    <Button variant="ghost" className="eval-add-turn eval-add-action" icon="plus-small" onClick={() => {
      const id = crypto.randomUUID()
      flushSync(() => { update({ ...draft, checks: turns.length === 1 ? [] : draft.checks, turns: [...turns, { id, input: "", expected: "", attachments: [], rules: [] }] }); setExpanded(prev => ({ ...prev, [id]: true })) })
      formRef.current?.querySelector<HTMLTextAreaElement>(`[data-turn-id="${id}"] textarea`)?.focus()
    }}>添加一轮对话</Button>
    {errors.checks && <p className="eval-field-error" role="alert">{errors.checks}</p>}
    <div className="eval-actions eval-form-footer"><BrandButton type="submit" variant="primary" disabled={uploadingCount > 0}>保存</BrandButton>{uploadingCount > 0 && <span role="status" className="eval-muted">附件上传中，请等待完成后保存</span>}<Button variant="ghost" onClick={cancel}>取消</Button></div>
  </form>
}
