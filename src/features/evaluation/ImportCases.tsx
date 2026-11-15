import { EvaluationSelect } from "./EvaluationSelect"
import { CaseDetail } from "./CaseDetail"
import { useRef, useState } from "react"
import { Button, Icon } from "@/ui"
import { saveCases, useEvaluation, turnsOf, type EvalAttachment } from "@/services/evaluation"
import { saveAttachment, removeEvaluationAttachments } from "@/services/evaluation-attachments"
import type { ImportPreview } from "@/services/evaluation-import"
export function ImportCases({ objectId, close, onImported }: { objectId: string; close: () => void; onImported: () => void }) {
  const [mode, setMode] = useState<"append" | "overwrite">("append")
  const [preview, setPreview] = useState<ImportPreview>()
  const [files, setFiles] = useState<File[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [workbookName, setWorkbookName] = useState("")
  const workbookInput = useRef<HTMLInputElement>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const locked = useRef(false)
  const cleanupPending = useRef<string[]>([])
  const existing = useEvaluation(s => s.cases[objectId]) || []
  const skipped = mode === "append" ? preview?.cases.filter(c => c.businessId && existing.some(e => e.businessId === c.businessId)).length ?? 0 : 0
  const existingIds = new Set(existing.map(item => item.businessId).filter(Boolean))
  const candidates = preview?.cases.filter(item => mode === "overwrite" || !item.businessId || !existingIds.has(item.businessId)) ?? []
  const candidateIds = new Set(candidates.map(item => item.id))
  const requiredNames = [...new Set(preview?.references.filter(ref => candidateIds.has(ref.caseId)).flatMap(ref => ref.names) ?? [])]
  const matches = requiredNames.map(name => ({ name, count: files.filter(file => file.name === name).length }))
  const matchedCount = matches.filter(item => item.count === 1).length
  const attachmentRows = [...new Set([...requiredNames, ...files.map(file => file.name)])].flatMap(name => {
    const selected = files.map((file, index) => ({ file, index })).filter(item => item.file.name === name)
    const status = !requiredNames.includes(name) ? "未引用，不会导入" : selected.length > 1 ? `重名（${selected.length} 个），请只保留一个` : selected.length ? "已匹配" : "待上传"
    return selected.length ? selected.map(({ index }) => ({ name, index, status })) : [{ name, index: -1, status }]
  })
  const attachmentsReady = matchedCount === requiredNames.length
  const selectImportFile = async (file: File) => {
    if (busy) return
    setPreview(undefined); setIssues([]); setFiles([]); setWorkbookName(file.name)
    setBusy(true)
    try {
      const { openEvaluationImport } = await import("@/services/evaluation-import-package")
      const { parseEvaluationWorkbook } = await import("@/services/evaluation-import")
      const bundle = await openEvaluationImport(file, message => message)
      const parsed = await parseEvaluationWorkbook(await bundle.workbook.arrayBuffer())
      setFiles(await bundle.attachments(parsed.references.map(ref => ref.names).flat()))
      setPreview(parsed)
    } catch (error) {
      setIssues([error instanceof Error ? error.message : "无法读取导入文件，请检查文件是否损坏或加密。"])
    } finally { setBusy(false) }
  }
  return <section className="eval-import" aria-label="导入用例">
    <Button variant="ghost" className="eval-return-to-list" disabled={busy} onClick={close}><Icon name="arrow-left" size="small" />返回用例列表</Button>
    <header><h3>导入用例</h3><p className="eval-import-intro">核对预览后确认导入。</p></header>
    <section className="eval-import-files" aria-label="用例文件">
      <div className="eval-import-file-heading"><h4>用例文件</h4>
        <a className="eval-add-action" href={`${import.meta.env.BASE_URL}templates/Build评测-问题集导入模板-v1.0.0.xlsx`} download="Build评测-问题集导入模板-v1.0.0.xlsx"><Icon name="spec-download" size="small" />下载模板</a>
      </div>
      <button type="button" className="eval-import-drop" disabled={busy} aria-describedby="eval-import-formats"
        onClick={() => workbookInput.current?.click()}
        onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = busy ? "none" : "copy" }}
        onDrop={event => {
          event.preventDefault()
          const file = event.dataTransfer.files[0]
          if (!busy && file) void selectImportFile(file)
        }}>
        <Icon name="folder-plus-24" size="medium" />
        <strong>{workbookName ? "更换文件" : "点击或拖拽上传用例文件"}</strong>
        <span id="eval-import-formats" className="eval-muted">Excel（.xlsx）或包含用例和附件的 ZIP</span>
        {workbookName && <span className="eval-import-filename">{workbookName}</span>}
      </button>
      <p className="eval-import-template-note eval-muted">请用自己的用例替换模板示例。</p>
      <input ref={workbookInput} id="eval-import-workbook" className="eval-import-native-input" type="file" accept=".xlsx,.zip" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""
        if (!file) return
        void selectImportFile(file)
      }} />
      {preview && (requiredNames.length > 0 || files.length > 0) && <section className="eval-import-attachments" aria-labelledby="import-attachments-title">
        <div className="eval-import-file-heading"><h4 id="import-attachments-title">引用附件</h4>
          {!!requiredNames.length && <span role="status">已匹配 {matchedCount}/{requiredNames.length}</span>}
        </div>
        {!requiredNames.length ? <p className="eval-muted">{preview.errors.length ? "暂未解析到附件引用，请先修正文件中的校验问题。" : "此文件未引用附件"}</p> : <>
          <p className="eval-muted">根据 Excel 中填写的文件名匹配，可一次选择多个文件。补齐全部引用附件后才能确认导入。</p>
          <ul className="eval-import-match-list" aria-label="附件匹配状态">
            {attachmentRows.map(({ name, index, status }) => <li key={`${name}-${index}`}>
              <span className="eval-import-filename">{name}</span>
              <span className={status === "待上传" || status.startsWith("重名") ? "eval-import-match-error" : "eval-muted"}>{status}</span>
              {index >= 0 ? <Button variant="ghost" disabled={busy} aria-label={`移除附件 ${name} 第 ${index + 1} 个`} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); setIssues([]) }}>移除</Button> : <span className="eval-import-no-action" aria-hidden="true">—</span>}
            </li>)}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={() => attachmentInput.current?.click()}>选择附件</Button>
          <input ref={attachmentInput} className="eval-import-native-input" type="file" aria-label="选择引用附件" multiple disabled={busy} onChange={e => {
            const added = Array.from(e.target.files || []); e.target.value = ""
            setFiles(current => [...current, ...added]); setIssues([])
          }} />
        </>}
      </section>}
    </section>
    <div className="eval-import-mode">
      <label htmlFor="eval-import-mode">导入方式</label>
      <EvaluationSelect
        id="eval-import-mode"
        describedBy="eval-import-mode-hint"
        label="导入方式"
        value={mode}
        options={[
          { value: "append", label: "增量导入" },
          { value: "overwrite", label: "覆盖导入" },
        ]}
        disabled={busy}
        onChange={value => setMode(value === "overwrite" ? "overwrite" : "append")}
      />
      <p id="eval-import-mode-hint" className="eval-muted">
        {mode === "overwrite" ? "替换当前全部用例。" : "自动跳过已有用例 ID。"}
      </p>
    </div>
    {busy && <p role="status">正在处理，请稍候…</p>}
    {!!preview?.ignored.length && <section className="eval-import-ignored" aria-label="以下内容不会导入">
      <strong role="status">以下内容不会导入（{preview.ignored.length}）</strong>
      <p>Build 暂不支持这些字段。确认后只导入受支持的内容。</p>
      <ul>{preview.ignored.map((item, index) => (
        <li key={index}><bdi>{item.field}</bdi><span>Excel 行号 {item.rows.join(", ")}</span></li>
      ))}</ul>
    </section>}
    {!!preview?.errors.length && <ul className="eval-import-errors eval-error" role="alert">{preview.errors.map((e, i) => <li key={i}>第 {e.row} · {e.field}：{e.message}</li>)}</ul>}
    {!!issues.length && <ul className="eval-import-errors eval-error" role="alert">{issues.map((s, i) => <li key={i}>{s}</li>)}</ul>}
    {preview && !preview.errors.length && attachmentsReady && <>
      <section className="eval-import-results">
        <h3>导入预览 · {candidates.length} 条</h3>
        <p role="status">{mode === "overwrite" ? `将替换当前全部用例。 (${existing.length})` : `预计跳过的已有用例 (${skipped})`}</p>
        {candidates.map(c => <details className="eval-import-preview" key={c.id}><summary><Icon name="chevron-down-16" size="small"/><strong>{c.name}</strong><span className="eval-muted">{turnsOf(c).length} 轮</span></summary><CaseDetail value={c} embedded /></details>)}
      </section>
      <footer className="eval-import-footer"><Button variant="primary" disabled={busy || !candidates.length} onClick={async () => {
        if (locked.current) return
        locked.current = true; setBusy(true); setIssues([])
        const before = useEvaluation.getState().cases[objectId]
        const saved: EvalAttachment[] = []
        try {
          if (cleanupPending.current.length) { await removeEvaluationAttachments(cleanupPending.current); cleanupPending.current = [] }
          const { attachmentImportIssues } = await import("@/services/evaluation-import")
          const ids = new Set((before ?? []).map(item => item.businessId).filter(Boolean))
          const items = structuredClone(mode === "overwrite"
            ? preview.cases
            : preview.cases.filter(item => !item.businessId || !ids.has(item.businessId)))
          const importing = new Set(items.map(item => item.id))
          const references = preview.references.filter(ref => importing.has(ref.caseId))
          const errors = attachmentImportIssues({ ...preview, references }, files)
          if (errors.length) { setIssues(errors.map(e => `评测用例 · 第 ${e.row} 行 · ${e.field}：${e.message}`)); return }
          for (const name of new Set(references.flatMap(r => r.names))) saved.push(await saveAttachment(files.find(f => f.name === name)!))
          for (const ref of references) {
            const c = items.find(c => c.id === ref.caseId)!
            const attachments = ref.names.map(name => saved.find(f => f.name === name)!)
            if (ref.turnId) c.turns!.find(t => t.id === ref.turnId)!.attachments = attachments
            else c.attachments = [...(c.attachments||[]),...attachments.filter(a=>!c.attachments?.some(x=>x.id===a.id))]
          }
          for(const c of items)for(const t of c.turns||[]) t.attachments=t.attachments.filter(a=>!c.attachments?.some(x=>x.id===a.id))
          const latest = useEvaluation.getState().cases[objectId]
          if (mode === "overwrite" && (latest !== before))
            throw Error("当前用例列表已变化，请重新预览后确认覆盖。")
          const next = mode === "overwrite" ? items : [
            ...(latest ?? []),
            ...items.filter(c => !c.businessId || !latest?.some(e => e.businessId === c.businessId)),
          ]
          if (!saveCases(objectId, next, mode === "overwrite")) throw Error("用例保存失败，请重试")
          onImported()
        } catch (e) {
          cleanupPending.current = [...new Set([...cleanupPending.current, ...saved.map(f => f.id)])]
          let cleanupError = ""
          try { await removeEvaluationAttachments(cleanupPending.current); cleanupPending.current = [] }
          catch { cleanupError = "新存附件清理尚未完成，请恢复本地存储后重试；重试会先清理残留附件。" }
          setIssues([e instanceof Error ? e.message : "保存失败，请重试", cleanupError].filter(Boolean))
        } finally { locked.current = false; setBusy(false) }
      }}>{mode === "overwrite" ? "确认覆盖导入" : "确认增量导入"}</Button></footer></>}
  </section>
}
