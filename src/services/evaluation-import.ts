import JSZip from "jszip"
import ExcelJS from "exceljs"
import { type EvalCase, type EvalTurn } from "./evaluation"
export const importHeaders = ["用例ID", "对话脚本（逐轮）", "每轮关键验证点（标准答案）", "澄清规则", "turn附件", "session附件"]
export interface ImportIssue { row: number; field: string; message: string }
export interface ImportPreview { cases: EvalCase[]; errors: ImportIssue[]; ignored: { field: string; rows: number[] }[]; references: { row: number; field: string; names: string[]; caseId: string; turnId?: string }[] }
export function parseClarification(value: string): EvalTurn["rules"] {
  if (!value.trim()) return []
  const data: unknown = JSON.parse(value)
  if (!Array.isArray(data)) throw Error("须填写 JSON 数组")
  return data.map(item => {
    if (!item || typeof item.matchDescription !== "string" || !item.matchDescription.trim()) throw Error("matchDescription 须为非空字符串")
    const responses = typeof item.response === "string" ? [item.response] : item.response
    if (!Array.isArray(responses) || !responses.length || responses.some(v => Array.isArray(v) ? !v.length || v.some(option => typeof option !== "string" || !option.trim()) : typeof v !== "string" || !v.trim())) throw Error("response 须为非空文本或按题序填写的数组，多选题使用嵌套文本数组")
    return { id: crypto.randomUUID(), match: item.matchDescription, responses }
  })
}
/** 模板使用合法的 x: 命名空间前缀；ExcelJS 需要无前缀的 SpreadsheetML 标签。仅规范标签，不改变单元格文本。 */
export async function loadEvaluationWorkbook(data: ArrayBuffer) {
  if(data.byteLength>20*1024*1024) throw Error("用例文件不能超过 20MB")
  const zip = await JSZip.loadAsync(data)
  const entries=Object.values(zip.files)
  if(entries.length>10000 || entries.reduce((n,e)=>n+((e as unknown as {_data?:{uncompressedSize?:number}})._data?.uncompressedSize||0),0)>40*1024*1024) throw Error("解压后的用例文件过大")
  if(entries.some(e=>/vbaProject|externalLinks/i.test(e.name))) throw Error("不支持宏或外部链接")
  for (const entry of Object.values(zip.files)) {
    if (!entry.name.endsWith(".xml") || !entry.name.startsWith("xl/")) continue
    let xml = await entry.async("string")
    const declaration = xml.match(/xmlns:([A-Za-z_][\w.-]*)="http:\/\/schemas.openxmlformats.org\/spreadsheetml\/2006\/main"/)
    if (!declaration) continue
    const prefix = declaration[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    xml = xml.replace(new RegExp(`(<\\/?)(?:${prefix}):`, "g"), "$1").replace(declaration[0], 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"')
    zip.file(entry.name, xml)
  }
  const book = new ExcelJS.Workbook()
  await book.xlsx.load(await zip.generateAsync({ type: "arraybuffer" }))
  return book
}
export async function parseEvaluationWorkbook(data: ArrayBuffer): Promise<ImportPreview> {
  const book = await loadEvaluationWorkbook(data)
  const result: ImportPreview = { cases: [], errors: [], ignored: [], references: [] }
  const fail = (row: number, field: string, message: string) => result.errors.push({ row, field, message })
  const sheet = book.getWorksheet("评测用例总表") || book.getWorksheet("问题集")
  if (!sheet || (sheet.rowCount > 10001 || sheet.columnCount>256)) { fail(1, "表结构", sheet ? "最多支持 10000 行数据" : "缺少“评测用例总表”，请使用共用问题集模板"); return result }
  const headers = new Map<string, number>()
  const unsupported: { field: string; index: number; rows: number[] }[] = []
  for (let index = 1; index <= sheet.columnCount; index++) {
    const cell = sheet.getRow(1).getCell(index)
    const h = cell.text.trim()
    if (!importHeaders.includes(h)) {
      unsupported.push({ field: h || cell.address.replace(/1$/, ""), index, rows: [] })
      continue
    }
    if (headers.has(h)) fail(1, h, "列名重复")
    headers.set(h, index)
  }
  for (const h of importHeaders) if (!headers.has(h)) fail(1, h, "模板缺少此列")
  if (result.errors.length) return result
  const seen = new Set<string>()
  let current: EvalCase | undefined
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r)
    const value = (h: string) => {
      if(!headers.has(h)) return ""
      const cell = row.getCell(headers.get(h)!)
      if (cell.isMerged && cell.master.address !== cell.address) return ""
      if (cell.value == null) return ""
      if (!["string","number"].includes(typeof cell.value)) { fail(r,h,"请填写文本或数字，不能使用公式"); return "" }
      return String(cell.value).trim()
    }
    const [id,input,expected,clarification,turnFiles,sessionFiles] = importHeaders.map(value)
    if (id === '不清楚每一列含义时，请查看"模版规则说明"sheet' && !input) continue
    for (const column of unsupported) {
      const cell = row.getCell(column.index)
      if (cell.isMerged && cell.master.address !== cell.address) continue
      if (cell.value != null && (typeof cell.value !== "string" || cell.value.trim())) column.rows.push(r)
    }
    if (![id,input,expected,clarification,turnFiles,sessionFiles].some(Boolean)) continue
    if (id) {
      if (seen.has(id)) fail(r,"用例ID",id+" 在本文件中重复")
      seen.add(id)

      current = { id:crypto.randomUUID(),businessId:id,name:input || id,input,expected:"",source:"none",outcome:"passed",turns:[],checks:[],attachments:[] }
      result.cases.push(current)
    } else if (!current) { fail(r,"用例ID","首条用例缺少 ID，续行没有所属用例"); continue }

    if (!current) continue
    const issue = (field: string, message: string) => fail(r,field,current!.businessId+"："+message)
    if (!input) issue("对话脚本（逐轮）","缺少本轮输入")
    const standard = expected || current.turns!.at(-1)?.expected || ""
    if (!standard) issue("每轮关键验证点（标准答案）","请填写可核对的预期")
    const turn: EvalTurn = { id:crypto.randomUUID(),input,expected:standard,checks:standard?[{id:crypto.randomUUID(),kind:"natural",text:standard,required:true,files:[]}]:[],rules:[],attachments:[] }
    try { turn.rules = parseClarification(clarification) } catch(e) { issue("澄清规则",e instanceof Error?e.message:"请检查规则") }
    current.turns!.push(turn)
    if(current.turns!.length>100)issue("对话脚本（逐轮）","每条用例最多支持 100 轮")
    const names = (s:string) => [...new Set(s.split(/[,，\n]/).map(n=>n.trim()).filter(Boolean))]
    if (sessionFiles) result.references.push({row:r,field:"session附件",names:names(sessionFiles),caseId:current.id})
    if (turnFiles) result.references.push({row:r,field:"turn附件",names:names(turnFiles),caseId:current.id,turnId:turn.id})
  }
  result.ignored = unsupported.filter(column => column.rows.length).map(({ field, rows }) => ({ field, rows }))
  if (!result.cases.length && !result.errors.length) fail(2,"用例ID","没有可导入用例")
  return result
}
export function attachmentImportIssues(preview: ImportPreview, files: File[]): ImportIssue[] {
  return preview.references.flatMap(ref => ref.names.flatMap(name => {
    const matches = files.filter(file => file.name === name)
    return matches.length === 1 ? [] : [{ row: ref.row, field: ref.field, message: matches.length ? `附件“${name}”有重名，无法唯一匹配` : `缺少附件“${name}”` }]
  }))
}
