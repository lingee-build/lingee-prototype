import { useRef, useState } from "react"
import { Button, BrandButton } from "@/ui"
import { saveCases, useEvaluation, turnsOf, type EvalAttachment } from "@/services/evaluation"
import { saveAttachment, removeEvaluationAttachments } from "@/services/evaluation-attachments"
import type { ImportPreview } from "@/services/evaluation-import"
export function ImportCases({ objectId, close }: { objectId: string; close: () => void }) {
  const [preview, setPreview] = useState<ImportPreview>()
  const [files, setFiles] = useState<File[]>([])
  const [issues, setIssues] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [workbookName, setWorkbookName] = useState("")
  const workbookInput = useRef<HTMLInputElement>(null)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const locked = useRef(false)
  const cleanupPending = useRef<string[]>([])
  const existing = useEvaluation(s => s.cases[objectId] || [])
  const duplicate = preview?.cases.some(c => existing.some(e => e.name === c.name || e.businessId === c.businessId))
  const requiredNames = [...new Set(preview?.references.flatMap(ref => ref.names) || [])]
  const matches = requiredNames.map(name => ({ name, count: files.filter(file => file.name === name).length }))
  const matchedCount = matches.filter(item => item.count === 1).length
  const attachmentRows = [...new Set([...requiredNames, ...files.map(file => file.name)])].flatMap(name => {
    const selected = files.map((file, index) => ({ file, index })).filter(item => item.file.name === name)
    const status = !requiredNames.includes(name) ? "未引用，不会导入" : selected.length > 1 ? `重名（${selected.length} 个），请只保留一个` : selected.length ? "已匹配" : "待上传"
    return selected.length ? selected.map(({ index }) => ({ name, index, status })) : [{ name, index: -1, status }]
  })
  const attachmentsReady = matchedCount === requiredNames.length
  return <section className="eval-import eval-form" aria-label="导入用例">
    <div className="eval-toolbar"><h3>导入用例</h3><Button variant="ghost" disabled={busy} onClick={close}>关闭导入</Button></div>
    <p>先预览校验，确认后整批新增，不覆盖已有用例、不自动运行。重复导入可能产生同名用例。</p>
    <section className="eval-import-files" aria-labelledby="import-files-title">
      <h4 id="import-files-title">导入文件</h4>
      <div className="eval-import-file-heading"><label htmlFor="eval-import-workbook">用例文件</label>
        <a className="eval-add-action" href={`${import.meta.env.BASE_URL}templates/evaluation-v0.5.xlsx`} download="Build评测用例导入模板.xlsx">下载模板</a>
      </div>
      <p className="eval-muted">支持 .xlsx，请按模板填写</p>
      <div className="eval-import-file-picker">
        <Button variant="secondary" disabled={busy} onClick={() => workbookInput.current?.click()}>{workbookName ? "更换文件" : "选择文件"}</Button>
        <span className="eval-import-filename">{workbookName || "尚未选择文件"}</span>
      </div>
      <input ref={workbookInput} id="eval-import-workbook" className="eval-import-native-input" type="file" accept=".xlsx" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ""
        if (!file) return
        setPreview(undefined); setIssues([]); setFiles([]); setWorkbookName(file.name)
        if (!file.name.toLowerCase().endsWith(".xlsx") || file.size > 20 * 1024 * 1024) { setIssues(["请选择不超过 20 MB 的 .xlsx 模板文件"]); return }
        setBusy(true)
        try { const { parseEvaluationWorkbook } = await import("@/services/evaluation-import"); setPreview(await parseEvaluationWorkbook(await file.arrayBuffer())) }
        catch { setIssues(["无法读取工作簿，请检查文件是否损坏或加密，并使用提供的模板"]); } finally { setBusy(false) }
      }} />
      {preview && <section className="eval-import-attachments" aria-labelledby="import-attachments-title">
        <div className="eval-import-file-heading"><h4 id="import-attachments-title">引用附件</h4>
          {!!requiredNames.length && <span role="status">已匹配 {matchedCount}/{requiredNames.length}</span>}
        </div>
        {!requiredNames.length ? <p className="eval-muted">{preview.errors.length ? "暂未解析到附件引用，请先修正文件中的校验问题。" : "此文件未引用附件"}</p> : <>
          <p className="eval-muted">根据 Excel 中填写的文件名匹配，可一次选择多个文件。补齐全部引用附件后才能确认新增。</p>
          <ul className="eval-import-match-list" aria-label="附件匹配状态">
            {attachmentRows.map(({ name, index, status }) => <li key={`${name}-${index}`}>
              <span className="eval-import-filename">{name}</span>
              <span className={status === "待上传" || status.startsWith("重名") ? "eval-import-match-error" : "eval-muted"}>{status}</span>
              {index >= 0 ? <Button variant="ghost" disabled={busy} aria-label={`移除附件 ${name} 第 ${index + 1} 个`} onClick={() => { setFiles(current => current.filter((_, i) => i !== index)); setIssues([]) }}>移除</Button> : <span className="eval-import-no-action" aria-hidden="true">—</span>}
            </li>)}
          </ul>
          <Button variant="secondary" disabled={busy} onClick={() => attachmentInput.current?.click()}>{files.length ? "继续选择附件" : "选择附件"}</Button>
          <input ref={attachmentInput} className="eval-import-native-input" type="file" aria-label="选择引用附件" multiple disabled={busy} onChange={e => {
            const added = Array.from(e.target.files || []); e.target.value = ""
            setFiles(current => [...current, ...added]); setIssues([])
          }} />
        </>}
      </section>}
    </section>
    {busy && <p role="status">正在处理，请稍候…</p>}
    {preview && <><p>预览：{preview.cases.length} 条用例 · {preview.cases.reduce((n, c) => n + turnsOf(c).length, 0)} 个业务轮次 · {preview.cases.reduce((n, c) => n + (c.checks?.length || 0) + turnsOf(c).reduce((m, t) => m + (t.checks?.length || 0), 0), 0)} 条标准</p>
      {preview.cases.map(c => <details key={c.id}><summary>{c.businessId} · {c.name}（{turnsOf(c).length} 轮）</summary>{turnsOf(c).map((t, i) => <p key={t.id}>第 {i + 1} 轮：{t.input} · 标准 {t.checks?.length || 0} 条 · 澄清回复 {t.rules.length} 组</p>)}<p>整体评测标准 {c.checks?.length || 0} 条</p></details>)}
      {!!preview.errors.length && <ul role="alert">{preview.errors.map((e, i) => <li key={i}>评测用例 · 第 {e.row} 行 · {e.field}：{e.message}</li>)}</ul>}
      {duplicate && <p role="status">已有同编号或同名用例。再次确认将新增独立用例，不覆盖已有内容。</p>}
      <BrandButton variant="primary" disabled={busy || !!preview.errors.length || !preview.cases.length || !attachmentsReady} onClick={async () => {
        if (locked.current) return
        locked.current = true; setBusy(true); setIssues([])
        const saved: EvalAttachment[] = []
        try {
          if (cleanupPending.current.length) { await removeEvaluationAttachments(cleanupPending.current); cleanupPending.current = [] }
          const { attachmentImportIssues } = await import("@/services/evaluation-import")
          const errors = attachmentImportIssues(preview, files)
          if (errors.length) { setIssues(errors.map(e => `评测用例 · 第 ${e.row} 行 · ${e.field}：${e.message}`)); return }
          const items = structuredClone(preview.cases)
          for (const name of new Set(preview.references.flatMap(r => r.names))) saved.push(await saveAttachment(files.find(f => f.name === name)!))
          for (const ref of preview.references) {
            const c = items.find(c => c.id === ref.caseId)!
            const attachments = ref.names.map(name => saved.find(f => f.name === name)!)
            if (ref.turnId) c.turns!.find(t => t.id === ref.turnId)!.attachments = attachments
            else c.attachments = attachments
          }
          if (!saveCases(objectId, [...(useEvaluation.getState().cases[objectId] || []), ...items])) throw Error("用例保存失败，未加入任何用例，请重试")
          close()
        } catch (e) {
          cleanupPending.current = [...new Set([...cleanupPending.current, ...saved.map(f => f.id)])]
          let cleanupError = ""
          try { await removeEvaluationAttachments(cleanupPending.current); cleanupPending.current = [] }
          catch { cleanupError = "新存附件清理尚未完成，请恢复本地存储后重试；重试会先清理残留附件。" }
          setIssues([e instanceof Error ? e.message : "保存失败，请重试", cleanupError].filter(Boolean))
        } finally { locked.current = false; setBusy(false) }
      }}>确认新增 {preview.cases.length} 条用例</BrandButton></>}
    {!!issues.length && <ul role="alert">{issues.map((s, i) => <li key={i}>{s}</li>)}</ul>}
  </section>
}
