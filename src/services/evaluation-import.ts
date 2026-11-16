import JSZip from "jszip"
import ExcelJS from "exceljs"
import { caseValidation, checkValidation, checkOperators, type EvalCase, type EvalTurn, type EvalCheck } from "./evaluation"
export const importHeaders = ["用例编号", "用例名称", "作用范围", "对话轮次", "用户输入", "澄清回复", "标准类型", "检查方式", "评测标准", "会话附件", "附件"]
export interface ImportIssue { row: number; field: string; message: string }
export interface ImportPreview { cases: EvalCase[]; errors: ImportIssue[]; references: { row: number; field: string; names: string[]; caseId: string; turnId?: string }[] }
export function parseClarification(value: string): EvalTurn["rules"] {
  if (!value.trim()) return []
  const data: unknown = JSON.parse(value)
  if (!Array.isArray(data)) throw Error("须填写 JSON 数组")
  return data.map(item => {
    if (!item || typeof item.matchDescription !== "string" || !item.matchDescription.trim()) throw Error("matchDescription 须为非空字符串")
    const responses = typeof item.response === "string" ? [item.response] : item.response
    if (!Array.isArray(responses) || !responses.length || responses.some(v => typeof v !== "string" || !v.trim())) throw Error("response 须为非空字符串或非空字符串数组（多个问题的顺序答案）")
    return { id: crypto.randomUUID(), match: item.matchDescription, responses }
  })
}
/** 模板使用合法的 x: 命名空间前缀；ExcelJS 需要无前缀的 SpreadsheetML 标签。仅规范标签，不改变单元格文本。 */
export async function loadEvaluationWorkbook(data: ArrayBuffer) {
  const zip = await JSZip.loadAsync(data)
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
  const sheet = book.getWorksheet("评测用例")
  const result: ImportPreview = { cases: [], errors: [], references: [] }
  const error = (row: number, col: number, message: string) => result.errors.push({ row, field: importHeaders[col - 1] || "表结构", message })
  if (!sheet) { error(1, 0, "缺少“评测用例”工作表，请下载模板"); return result }
  if (book.worksheets.some(s => !["评测用例", "填写说明"].includes(s.name) && s.actualRowCount)) error(1, 0, "仅支持评测用例数据表与填写说明，请勿将标准或澄清回复另放工作表")
  if (sheet.rowCount > 10001) { error(1, 0, "最多支持 10000 行数据"); return result }
  const value = (row: number, col: number) => {
    const cell = sheet.getCell(row, col)
    const master = cell.isMerged ? cell.master : cell
    const v = master.value
    if (v == null) return ""
    if (typeof v === "string" || typeof v === "number") return String(v)
    error(row, col, "不支持公式、链接或其他复杂单元格值，请填写文本或数字")
    return ""
  }
  for (let c = 1; c <= 11; c++) if (value(1, c) !== importHeaders[c - 1]) error(1, c, `表头须为“${importHeaders[c - 1]}”`)
  if (sheet.getRow(1).values && sheet.getRow(1).cellCount > 11) error(1, 0, "模板仅支持固定的 11 列，请移除额外表头")
  if (result.errors.length) return result
  const rows: string[][] = []
  for (let r = 2; r <= sheet.rowCount; r++) rows.push(Array.from({ length: 11 }, (_, c) => value(r, c + 1)))
  for (const range of sheet.model.merges || []) {
    const m = range.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/)
    if (!m) continue
    const [, first, top, last, bottom] = m
    const col = first.charCodeAt(0) - 64, start = Number(top), end = Number(bottom)
    if (first !== last || ![1, 2, 3, 4, 5, 6, 10, 11].includes(col) || start < 2) { error(start, col, "仅允许分组字段在数据区纵向合并，标准字段不得合并"); continue }
    const groups = rows.slice(start - 2, end - 1).map(row => [row[0], ...([1, 2, 10].includes(col) ? [] : [row[2], row[3]])].join("\u0000"))
    if (new Set(groups).size > 1) error(start, col, "合并范围跨越不同用例或轮次")
  }
  const groups = new Map<string, { item: EvalCase; rows: Map<number, { turn: EvalTurn; signature: string }>; session: string; overall: boolean; row: number }>()
  let lastId = ""
  const seen = new Set<string>()
  rows.forEach((row, i) => {
    const r = i + 2
    if (!row.some(v => v.trim())) return
    const [id, name, scope, round, input, clarification, type, method, standard, session, attachment] = row
    if (!id.trim()) { error(r, 1, "用例编号不能为空；普通空白不会继承上一行"); return }
    if (id !== lastId && seen.has(id)) error(r, 1, "同一用例必须连续填写")
    seen.add(id); lastId = id
    let group = groups.get(id)
    if (!group) {
      const item: EvalCase = { id: crypto.randomUUID(), businessId: id, name, input: "", expected: "", source: "none", outcome: "passed", turns: [], checks: [], attachments: [], demo: false }
      group = { item, rows: new Map(), session, overall: false, row: r }; groups.set(id, group); result.cases.push(item)
      if (session.trim()) result.references.push({ row: r, field: "会话附件", names: session.split(/\r?\n/).map(v => v.trim()).filter(Boolean), caseId: item.id })
    }
    if (name !== group.item.name || session !== group.session) error(r, 2, "同一用例的名称、会话附件须一致（可纵向合并）")
    if (!name.trim()) error(r, 2, "用例名称不能为空")
    let turn: EvalTurn | undefined
    if (scope === "整体") {
      group.overall = true
      if ([round, input, clarification, attachment].some(v => v.trim())) error(r, 3, "整体标准的对话轮次、用户输入、澄清回复和附件须留空")
    } else if (scope === "轮次") {
      if (group.overall) error(r, 3, "整体标准须放在该用例末尾")
      const number = Number(round)
      if (!/^[1-9]\d*$/.test(round)) { error(r, 4, "对话轮次须为从 1 开始的连续正整数"); return }
      const signature = JSON.stringify([input, clarification, attachment])
      const previous = group.rows.get(number)
      if (previous) {
        if (previous.signature !== signature) error(r, 5, "同一轮次的用户输入、澄清回复和附件须一致")
        if (number !== group.rows.size) error(r, 4, "同一轮次须连续填写")
        turn = previous.turn
      } else {
        if (number !== group.rows.size + 1) error(r, 4, "对话轮次须从 1 连续递增")
        turn = { id: crypto.randomUUID(), input, expected: "", checks: [], rules: [], attachments: [] }
        if (!input.trim()) error(r, 5, "用户输入不能为空")
        try { turn.rules = parseClarification(clarification) } catch (e) { error(r, 6, e instanceof Error ? e.message : "JSON 格式错误") }
        group.rows.set(number, { turn, signature }); group.item.turns!.push(turn)
        if (attachment.trim()) result.references.push({ row: r, field: "附件", names: attachment.split(/\r?\n/).map(v => v.trim()).filter(Boolean), caseId: group.item.id, turnId: turn.id })
      }
    } else { error(r, 3, "作用范围须为“轮次”或“整体”"); return }
    if (!type && !method && !standard && turn) return
    const kind = ({ 语义判断: "natural", 关键词匹配: "keyword", 正则匹配: "regex", 文件存在性: "file" } as const)[type as "语义判断" | "关键词匹配" | "正则匹配" | "文件存在性"]
    if (!kind) { error(r, 7, "标准类型无效"); return }
    const operator = (Object.keys(checkOperators) as (keyof typeof checkOperators)[]).find(k => checkOperators[k] === method)
    const allowed = kind === "keyword" ? ["all", "any", "none"] : kind === "regex" ? ["regex", "not_regex"] : ["exists", "not_exists"]
    if (kind === "natural" ? !!method : !operator || !allowed.includes(operator)) error(r, 8, "检查方式与标准类型不匹配；语义判断须留空")
    const check: EvalCheck = { id: crypto.randomUUID(), kind, operator, text: standard, required: true, files: [] }
    const issue = checkValidation(check); if (issue) error(r, 9, issue)
    ;(turn ? turn.checks! : group.item.checks!).push(check)
  })
  for (const { item, row } of groups.values()) {
    item.input = item.turns?.[0]?.input || ""
    if (!item.turns?.length) error(row, 4, "至少需要一个业务轮次")
    const issue = caseValidation(item); if (issue) error(row, 9, issue)
  }
  if (!result.cases.length && !result.errors.length) error(2, 1, "没有可导入用例")
  return result
}
export function attachmentImportIssues(preview: ImportPreview, files: File[]): ImportIssue[] {
  return preview.references.flatMap(ref => ref.names.flatMap(name => {
    const matches = files.filter(file => file.name === name)
    return matches.length === 1 ? [] : [{ row: ref.row, field: ref.field, message: matches.length ? `附件“${name}”有重名，无法唯一匹配` : `缺少附件“${name}”` }]
  }))
}
