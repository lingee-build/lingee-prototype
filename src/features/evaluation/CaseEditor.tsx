import { flushSync } from "react-dom"
import { useRef, useState, useCallback } from "react"
import { BrandButton, Button, Icon, ConfirmDialog, useDialog } from "@/ui"
import { saveAttachment } from "@/services/evaluation-attachments"
import { caseBriefOf, caseValidation, checkKind, checkValidation, checkDescription, checksOf, turnsOf, expectedResponseLabels, overallCategories, isClarifyTurn, scenesOf, sceneChecksOf, clarifyChecksOf, clarifyPickModes, clarifySceneNames, maxClarifyScenes, type CheckKind, type ClarifyPickMode, type EvalCheck, type EvalCase, type EvalClarifyScene, type EvalTurn, type EvalAttachment, type OverallCategory } from "@/services/evaluation"

/** 设计稿的类型下拉：一项对应 kind + operator 的组合。 */
const typeOptions = [
  { key: "natural", label: "语义判断" },
  { key: "keyword:all", label: "关键词包含" },
  { key: "keyword:any", label: "关键词包含任一" },
  { key: "keyword:none", label: "关键词不包含" },
  { key: "regex", label: "正则匹配" },
  { key: "regex:not_regex", label: "正则不匹配" },
  { key: "file:exists", label: "文件存在" },
  { key: "file:not_exists", label: "文件不存在" },
] as const
function checkTypeKey(check: EvalCheck): string {
  const kind = checkKind(check)
  if (kind === "natural") return "natural"
  return `${kind}:${check.operator || (kind === "file" ? "exists" : kind === "regex" ? "regex" : "all")}`
}
function applyCheckType(check: EvalCheck, key: string): EvalCheck {
  if (key === "natural") return { ...check, kind: "natural", operator: undefined }
  const [kind, operator] = key.split(":")
  return { ...check, kind: kind as CheckKind, operator: operator as EvalCheck["operator"] }
}
const typePlaceholder = (key: string) => key === "natural" ? "例如：缺少组织信息时，应先询问用户"
  : key.startsWith("keyword") ? "每行一个关键词" : key.startsWith("regex") ? "输入正则表达式，无需两侧斜杠" : "相对工作区的文件路径，如 outputs/对账报告.xlsx"

function UploadField({ label, files, onChange, onUploadingChange }: { label: string; files: EvalAttachment[]; onChange: (files: EvalAttachment[]) => void; onUploadingChange?: (uploading: boolean) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return <div className="eval-upl">
    <label className="eval-upbtn">{busy ? "正在保存…" : "+ 上传文件"}<input aria-label={label} type="file" multiple hidden disabled={busy} onChange={async e => {
      const chosen = Array.from(e.target.files || []); e.target.value = ""
      setBusy(true); onUploadingChange?.(true)
      try { onChange([...files, ...await Promise.all(chosen.map(saveAttachment))]); setError("") }
      catch { setError("附件保存失败，请重试。") }
      finally { setBusy(false); onUploadingChange?.(false) }
    }} /></label>
    {files.map(f => <span className="eval-fchip" key={f.id}>{f.name}<button type="button" aria-label={`移除附件 ${f.name}`} onClick={() => onChange(files.filter(x => x.id !== f.id))}>×</button></span>)}
    {error && <span role="alert" className="eval-form-error" style={{ margin: 0 }}>{error}</span>}
  </div>
}

function useDeleteConfirmation() {
  const dialog = useDialog()
  return (title: string, description: string, onConfirm: () => void, hasContent = true) => {
    if (!hasContent) { onConfirm(); return }
    dialog.show(() => <ConfirmDialog variant="danger" title={title} description={description} cancelText="取消" confirmText="删除" onConfirm={onConfirm} />)
  }
}

/** 一条校验：类型下拉 + 判据输入，设计稿 ckr-set 形态。 */
function CheckRow({ check, index, label, onChange, onDelete, error, leading }: {
  check: EvalCheck; index: number; label: string; onChange: (check: EvalCheck) => void; onDelete: () => void; error?: string; leading?: React.ReactNode
}) {
  const key = checkTypeKey(check)
  return <div className="eval-ckr-set">
    <div className="eval-ckr">
      {leading}
      <select className="eval-sel" aria-label={`${label} ${index + 1} 类型`} value={key} onChange={e => onChange(applyCheckType(check, e.target.value))}>
        {typeOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <input className="eval-inp" aria-label={`${label} ${index + 1} 判据`} placeholder={typePlaceholder(key)} value={check.text}
        onChange={e => onChange({ ...check, text: e.target.value })} />
      <button type="button" aria-label={`删除${label} ${index + 1}`} className="eval-nx" onClick={onDelete}><Icon name="trash-16" size="small" /></button>
    </div>
    {error && <p className="eval-form-error" role="alert">{error}</p>}
  </div>
}

/** 澄清场景页签：编号连续、场景间互为「或」，多于一个时可删除。 */
function SceneTabs({ scenes, active, onSelect, onAdd, onDelete }: {
  scenes: EvalClarifyScene[]; active: number; onSelect: (index: number) => void; onAdd: () => void; onDelete: (index: number) => void
}) {
  return <div className="eval-sc-tabs">
    {scenes.map((scene, index) => <span className="eval-sc-tabwrap" key={scene.id}>
      {index > 0 && <span className="eval-sc-or">或</span>}
      <button type="button" className="eval-sc-tab" data-on={index === active || undefined} onClick={() => onSelect(index)}>场景{clarifySceneNames[index]}</button>
      {scenes.length > 1 && <span role="button" tabIndex={0} className="eval-scx" title="删除该场景" onClick={() => onDelete(index)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onDelete(index) } }}>×</span>}
    </span>)}
    {scenes.length < maxClarifyScenes && <button type="button" className="eval-sc-addtab" onClick={onAdd}>+ 添加场景</button>}
  </div>
}

export function CaseEditor({ draft, update, save, cancel, editing }: { draft: EvalCase; update: (c: EvalCase) => void; save: (c: EvalCase) => void; cancel: () => void; editing: boolean }) {
  const confirmDelete = useDeleteConfirmation()
  const [uploadingCount, setUploadingCount] = useState(0)
  const onUploadingChange = useCallback((uploading: boolean) => setUploadingCount(count => count + (uploading ? 1 : -1)), [])
  const [formError, setFormError] = useState("")
  const [checkErrors, setCheckErrors] = useState<Record<string, string>>({})
  const currentDraft = useRef(draft)
  currentDraft.current = draft
  const turns = turnsOf(draft)
  const setTurn = (index: number, patch: Partial<EvalTurn>) => update({ ...currentDraft.current, turns: turnsOf(currentDraft.current).map((t, i) => i === index ? { ...t, ...patch } : t) })
  const [activeScene, setActiveScene] = useState<Record<string, number>>({})
  const blankScene = (): EvalClarifyScene => ({ id: crypto.randomUUID(), match: "", responses: [""], pickMode: "input", post: "output", checks: [] })
  const setScenes = (index: number, scenes: EvalClarifyScene[]) => setTurn(index, { rules: scenes })
  const setScene = (index: number, sceneIndex: number, patch: Partial<EvalClarifyScene>) =>
    setScenes(index, scenesOf(turnsOf(currentDraft.current)[index]).map((scene, i) => i === sceneIndex ? { ...scene, ...patch } : scene))
  const addScene = (index: number) => {
    const current = scenesOf(turnsOf(currentDraft.current)[index])
    if (current.length >= maxClarifyScenes) return
    setScenes(index, [...current, blankScene()])
    setActiveScene(prev => ({ ...prev, [turnsOf(currentDraft.current)[index].id]: current.length }))
  }
  const removeScene = (index: number, sceneIndex: number) => {
    const current = scenesOf(turnsOf(currentDraft.current)[index])
    if (current.length <= 1) return
    setScenes(index, current.filter((_, i) => i !== sceneIndex))
    setActiveScene(prev => ({ ...prev, [turnsOf(currentDraft.current)[index].id]: Math.max(Math.min(sceneIndex, current.length - 2), 0) }))
  }
  const expectResponse = (index: number, value: "output" | "clarify") => {
    const turn = turnsOf(currentDraft.current)[index]
    setTurn(index, value === "clarify" && !turn.rules.length
      ? { expectedResponse: value, rules: [blankScene()] }
      : { expectedResponse: value })
  }
  const addCheck = (target: "overall" | number) => {
    const id = crypto.randomUUID()
    const check: EvalCheck = { id, kind: "natural", text: "", required: true, files: [] }
    if (target === "overall") update({ ...currentDraft.current, checks: [...(currentDraft.current.checks || []), check] })
    else setTurn(target, { checks: [...checksOf(turnsOf(currentDraft.current)[target]), check] })
    return id
  }
  function removeTurn(index: number) {
    const next = turnsOf(currentDraft.current).filter((_, i) => i !== index)
    if (next.length) { next[0] = { ...next[0], inherit: false }; update({ ...currentDraft.current, turns: next }) }
  }
  function move(index: number, delta: number) {
    const next = [...turnsOf(currentDraft.current)]
    ;[next[index], next[index + delta]] = [next[index + delta], next[index]]
    next[0] = { ...next[0], inherit: false }
    update({ ...currentDraft.current, turns: next })
  }
  /** 一个澄清场景卡：澄清校验（澄清提问 / 澄清选择）+ 期望澄清后响应 + 该场景输出校验。 */
  function sceneCard(turn: EvalTurn, index: number, scene: EvalClarifyScene, si: number, active: boolean) {
    const ask = scene.check || { id: `${scene.id}-ask`, kind: "natural" as const, text: "", required: true, files: [] }
    const sceneChecks = sceneChecksOf(turn, scene)
    const label = `第 ${index + 1} 轮场景${clarifySceneNames[si] || si + 1}输出校验`
    const name = `场景${clarifySceneNames[si] || si + 1}`
    const writeChecks = (checks: EvalCheck[]) => setScene(index, si, { checks })
    return <div className="eval-scard" key={scene.id} hidden={!active}>
      <div className="eval-glab">澄清校验</div>
      <div className="eval-nrow"><span className="eval-nk">澄清提问</span>
        <div className="eval-ckr">
          <select className="eval-sel" aria-label={`${name}澄清提问类型`} value={checkTypeKey(ask)} onChange={e => setScene(index, si, { check: applyCheckType(ask, e.target.value) })}>
            {typeOptions.map(option => <option key={option.key} value={option.key}>{option.label}</option>)}
          </select>
          <input className="eval-inp" aria-label={`${name}澄清提问判据`} placeholder="期望 AI 先澄清什么" value={ask.text}
            onChange={e => setScene(index, si, { check: { ...ask, text: e.target.value } })} />
        </div>
      </div>
      {checkErrors[ask.id] && <p className="eval-form-error" role="alert">{checkErrors[ask.id]}</p>}
      <div className="eval-nrow"><span className="eval-nk">澄清选择</span>
        <div className="eval-ckr">
          <select className="eval-sel" aria-label={`${name}澄清选择方式`} value={scene.pickMode || "input"} onChange={e => setScene(index, si, { pickMode: e.target.value as ClarifyPickMode })}>
            {(Object.keys(clarifyPickModes) as ClarifyPickMode[]).map(key => <option key={key} value={key}>{clarifyPickModes[key]}</option>)}
          </select>
          <input className="eval-inp" aria-label={`${name}澄清选择`} placeholder="模拟用户的选择或补充" value={scene.match}
            onChange={e => setScene(index, si, { match: e.target.value, responses: [e.target.value] })} />
        </div>
      </div>
      <div className="eval-nrow"><span className="eval-nk">期望澄清后响应</span>
        <div className="eval-response-seg" role="radiogroup" aria-label={`${name}期望澄清后响应`}>
          {(["output", "clarify"] as const).map(value => <button key={value} type="button" role="radio" aria-checked={(scene.post || "output") === value} className="eval-response-seg-item" data-on={(scene.post || "output") === value || undefined} onClick={() => setScene(index, si, { post: value })}>{value === "output" ? "内容输出" : "继续澄清"}</button>)}
        </div>
      </div>
      <div className="eval-glab">输出校验</div>
      <div className="eval-ckr-list">
        {sceneChecks.map((check, checkIndex) => <CheckRow key={check.id} check={check} index={checkIndex} label={label} error={checkErrors[check.id]}
          onChange={next => writeChecks(sceneChecks.map(c => c.id === next.id ? next : c))}
          onDelete={() => confirmDelete(`删除${name}校验 ${checkIndex + 1}？`, "将移除这条校验，保存用例后生效。", () => writeChecks(sceneChecks.filter(c => c.id !== check.id)), !!check.text.trim())} />)}
      </div>
      <button type="button" className="eval-nadd" onClick={() => {
        const check: EvalCheck = { id: crypto.randomUUID(), kind: "natural", text: "", required: true, files: [] }
        writeChecks([...sceneChecks, check])
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="${label} ${sceneChecks.length + 1} 判据"]`)?.focus())
      }}>+ 添加一条校验</button>
    </div>
  }
  function submit() {
    if (uploadingCount > 0) { setFormError("附件上传中，请等待完成后保存"); return }
    setFormError(""); setCheckErrors({})
    const turnsValue = turnsOf(draft)
    const errors: Record<string, string> = {}
    if (!draft.name.trim()) { setFormError("用例名称必填，不能仅包含空格。"); return }
    for (const [i, turn] of turnsValue.entries()) {
      if (!turn.input.trim()) { setFormError(`第 ${i + 1} 轮用户输入必填，不能仅包含空格。`); return }
      for (const [si, scene] of scenesOf(turn).entries()) {
        if (!scene.match.trim()) { setFormError(`第 ${i + 1} 轮场景${clarifySceneNames[si] || si + 1}的澄清选择不能为空。`); return }
      }
      if (isClarifyTurn(turn) && !scenesOf(turn).length) { setFormError(`第 ${i + 1} 轮期望澄清，请至少添加一个澄清场景。`); return }
      for (const check of isClarifyTurn(turn) ? clarifyChecksOf(turn) : checksOf(turn)) { const issue = checkValidation(check); if (issue) errors[check.id] = issue }
    }
    for (const check of draft.checks || []) { const issue = checkValidation(check); if (issue) errors[check.id] = issue }
    if (Object.keys(errors).length) { setCheckErrors(errors); setFormError("请先修正校验项的填写问题。"); return }
    const normalizeScene = (scene: EvalClarifyScene): EvalClarifyScene => ({
      ...scene,
      check: scene.check?.text.trim() ? scene.check : undefined,
      checks: (scene.checks || []).filter(check => check.text.trim()),
      // 澄清选择即执行时的自动应答文本，保存时保持一致。
      responses: [scene.match.trim()],
    })
    const normalized = turnsValue.map((t, i) => {
      const scenes = scenesOf(t).map(normalizeScene)
      const own = scenes.length ? scenes.flatMap(scene => [...(scene.check ? [scene.check] : []), ...(scene.checks || [])]) : checksOf(t)
      return { ...t, inherit: false, rules: scenes, expected: (own.length ? own : checksOf(t, i ? t.inherit ? turnsValue[0].expected : undefined : undefined)).map(checkDescription).join("；") }
    })
    const saved: EvalCase = { ...draft, name: draft.name.trim(), input: turnsValue[0].input, expected: normalized[0].expected, turns: normalized, checks: draft.checks?.length ? draft.checks : undefined, background: draft.background?.length ? draft.background : undefined, demo: false }
    const validation = caseValidation(saved)
    if (validation) { setFormError(validation); return }
    save({ ...saved, summary: caseBriefOf(saved) })
  }
  return <div className="eval-ovlay" onClick={e => { if (e.target === e.currentTarget) cancel() }}>
    <form className="eval-ncard" noValidate onSubmit={e => { e.preventDefault(); submit() }}>
      <div className="eval-nh"><b>{editing ? "编辑用例" : "新增用例"}</b><span className="eval-libsp" /><button type="button" className="eval-nx" aria-label="关闭" onClick={cancel}>×</button></div>
      <div className="eval-nlab">用例名称</div>
      <input className="eval-inp" required aria-label="用例名称" placeholder="如：提交超预算采购申请" value={draft.name} onChange={e => update({ ...draft, name: e.target.value })} />
      <div className="eval-nlab">案例背景知识</div>
      <UploadField label="案例背景知识" files={draft.background || []} onChange={background => update({ ...currentDraft.current, background })} onUploadingChange={onUploadingChange} />
      <div className="eval-nlab">对话</div>
      {turns.map((turn, index) => {
        const scenes = scenesOf(turn)
        const active = Math.min(activeScene[turn.id] || 0, Math.max(scenes.length - 1, 0))
        const clarify = isClarifyTurn(turn)
        return <div className="eval-nrd" key={turn.id}>
        <div className="eval-rno">第 {index + 1} 轮
          {turns.length > 1 && <button type="button" className="eval-del" onClick={() => confirmDelete(`删除第 ${index + 1} 轮对话？`, "将移除本轮输入、背景知识、澄清场景及校验，保存用例后生效。", () => removeTurn(index), !!turn.input.trim() || !!turn.attachments?.length || !!turn.rules.length || !!checksOf(turn).length)}>删除本轮</button>}
        </div>
        <div className="eval-nrow"><span className="eval-nk">固定输入</span>
          <textarea className="eval-inp" rows={2} required aria-label={`第 ${index + 1} 轮用户输入`} placeholder="用户说出口的话" value={turn.input} onChange={e => setTurn(index, { input: e.target.value })} />
        </div>
        <div className="eval-nrow"><span className="eval-nk">本轮背景知识</span>
          <UploadField label="本轮背景知识" files={turn.attachments} onChange={attachments => setTurn(index, { attachments })} onUploadingChange={onUploadingChange} />
        </div>
        <div className="eval-cks">
          <div className="eval-rno">校验内容</div>
          <div className="eval-nrow"><span className="eval-nk">期望响应</span>
            <div className="eval-response-seg" role="radiogroup" aria-label={`第 ${index + 1} 轮期望响应`}>
              {(["output", "clarify"] as const).map(value => <button key={value} type="button" role="radio" aria-checked={clarify === (value === "clarify")} className="eval-response-seg-item" data-on={clarify === (value === "clarify") || undefined} onClick={() => expectResponse(index, value)}>{expectedResponseLabels[value]}</button>)}
            </div>
          </div>
          {clarify ? <>
            <SceneTabs scenes={scenes} active={active}
              onSelect={si => setActiveScene(prev => ({ ...prev, [turn.id]: si }))}
              onAdd={() => addScene(index)}
              onDelete={si => confirmDelete(`删除场景${clarifySceneNames[si]}？`, "将移除该场景的澄清校验与输出校验，保存用例后生效。", () => removeScene(index, si), !!(scenes[si]?.match.trim() || scenes[si]?.check?.text.trim()))} />
            {scenes.map((scene, si) => sceneCard(turn, index, scene, si, si === active))}
          </> : <>
            <div className="eval-glab">输出校验</div>
            <div className="eval-ckr-list">
              {checksOf(turn).map((check, checkIndex) => <CheckRow key={check.id} check={check} index={checkIndex} label={`第 ${index + 1} 轮输出校验`} error={checkErrors[check.id]}
                onChange={check => setTurn(index, { checks: checksOf(turn).map(c => c.id === check.id ? check : c) })}
                onDelete={() => confirmDelete(`删除第 ${index + 1} 轮校验 ${checkIndex + 1}？`, "将移除这条校验，保存用例后生效。", () => setTurn(index, { checks: checksOf(turn).filter(c => c.id !== check.id) }), !!check.text.trim())} />)}
            </div>
            <button type="button" className="eval-nadd" onClick={() => { addCheck(index); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="第 ${index + 1} 轮输出校验 ${checksOf(turn).length + 1} 判据"]`)?.focus()) }}>+ 添加一条校验</button>
          </>}
        </div>
        {turns.length > 1 && <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <Button variant="ghost" disabled={!index} onClick={() => move(index, -1)}>上移</Button>
          <Button variant="ghost" disabled={index === turns.length - 1} onClick={() => move(index, 1)}>下移</Button>
        </div>}
      </div> })}
      <button type="button" className="eval-nadd" onClick={() => {
        const id = crypto.randomUUID()
        update({ ...draft, turns: [...turnsOf(draft), { id, input: "", expected: "", attachments: [], rules: [], checks: [] }] })
        requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>(`[aria-label="第 ${turns.length + 1} 轮用户输入"]`)?.focus())
      }}>+ 添加一轮</button>
      <div className="eval-nlab">案例整体校验</div>
      {(draft.checks || []).length ? (draft.checks || []).map((check, index) => <CheckRow key={check.id} check={check} index={index} label="案例整体校验" error={checkErrors[check.id]}
        leading={<select className="eval-sel" aria-label={`案例整体校验 ${index + 1} 分类`} value={check.overall || "final"} onChange={e => update({ ...currentDraft.current, checks: (draft.checks || []).map(c => c.id === check.id ? { ...c, overall: e.target.value as OverallCategory } : c) })}>
          {(Object.keys(overallCategories) as OverallCategory[]).map(key => <option key={key} value={key}>{overallCategories[key]}</option>)}
        </select>}
        onChange={check => update({ ...currentDraft.current, checks: (currentDraft.current.checks || []).map(c => c.id === check.id ? check : c) })}
        onDelete={() => confirmDelete(`删除案例整体校验 ${index + 1}？`, "将移除这条校验，保存用例后生效。", () => update({ ...currentDraft.current, checks: (currentDraft.current.checks || []).filter(c => c.id !== check.id) }), !!check.text.trim())} />
      ) : null}
      <button type="button" className="eval-nadd" onClick={() => { addCheck("overall"); requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[aria-label="案例整体校验 ${(draft.checks || []).length + 1} 判据"]`)?.focus()) }}>+ 添加一条</button>
      {formError && <p className="eval-form-error" role="alert">{formError}</p>}
      <div className="eval-nfoot">
        <Button variant="secondary" onClick={cancel}>取消</Button>
        <BrandButton type="submit" variant="primary" disabled={uploadingCount > 0}>{editing ? "保存" : "创建用例"}</BrandButton>
      </div>
      {uploadingCount > 0 && <p role="status" className="eval-sc-note">附件上传中，请等待完成后保存</p>}
    </form>
  </div>
}
