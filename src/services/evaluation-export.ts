import ExcelJS from "exceljs"
import { checkKind, checkOperators, checksOf, turnsOf, type EvalCase, type EvalCheck, type EvalTurn } from "./evaluation"
import { importHeaders } from "./evaluation-import"

const kindLabels: Record<ReturnType<typeof checkKind>, string> = { natural: "语义判断", keyword: "关键词匹配", regex: "正则匹配", file: "文件存在性" }
function methodOf(check: EvalCheck): string {
  const kind = checkKind(check)
  return kind === "natural" ? "" : checkOperators[check.operator || (kind === "file" ? "exists" : kind === "regex" ? "regex" : "all")]
}
function clarificationJson(turn: EvalTurn): string {
  if (!turn.rules.length) return ""
  return JSON.stringify(turn.rules.map(scene => ({
    matchDescription: scene.match,
    response: scene.responses.length > 1 ? scene.responses : scene.responses[0] ?? "",
    ...(scene.pickMode && scene.pickMode !== "input" ? { pickMode: scene.pickMode } : {}),
    ...(scene.check?.text.trim() ? { clarifyCheck: { type: kindLabels[checkKind(scene.check)], method: methodOf(scene.check), text: scene.check.text } } : {}),
    ...(scene.post === "clarify" ? { expectedPost: "clarify" } : {}),
    ...(scene.checks?.length ? { outputChecks: scene.checks.map(check => ({ type: kindLabels[checkKind(check)], method: methodOf(check), text: check.text })) } : {}),
  })))
}
const names = (files: { name: string }[] | undefined) => (files || []).map(file => file.name).join("\n")

/** 导出与导入模板同构（11 列）；附件只导出文件名，重新导入时需按名选择本地文件。 */
export async function exportCasesWorkbook(cases: EvalCase[]): Promise<Blob> {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet("评测用例")
  sheet.addRow(importHeaders)
  for (const c of cases) {
    const id = c.businessId || c.code || c.name
    const turns = turnsOf(c)
    for (const [ti, turn] of turns.entries()) {
      const turnChecks = [...checksOf(turn, ti ? turn.inherit ? turns[0].expected : undefined : undefined), ...(turns.length === 1 ? c.checks || [] : [])]
      const rows = turnChecks.length ? turnChecks : [undefined]
      for (const check of rows) {
        sheet.addRow([
          id, c.name, "轮次", ti + 1, turn.input, clarificationJson(turn),
          check ? kindLabels[checkKind(check)] : "", check ? methodOf(check) : "", check?.text ?? "",
          names(c.attachments), names(turn.attachments),
        ])
      }
    }
    for (const check of turns.length === 1 ? [] : c.checks || []) {
      sheet.addRow([id, c.name, "整体", "", "", "", kindLabels[checkKind(check)], methodOf(check), check.text, names(c.attachments), ""])
    }
  }
  sheet.getRow(1).font = { bold: true }
  ;[14, 30, 10, 10, 44, 34, 12, 18, 44, 22, 22].forEach((width, i) => { sheet.getColumn(i + 1).width = width })
  const guide = book.addWorksheet("填写说明")
  guide.addRow(["1. 仅修改“评测用例”工作表的数据区（第 2 行起）；请勿增删列或调整列顺序。"])
  guide.addRow(["2. 用例编号：同一用例的连续行填写相同编号；不填编号的行视为无效。"])
  guide.addRow(["3. 作用范围：业务轮次填“轮次”，整体验收标准填“整体”（对话轮次、用户输入、澄清场景和附件留空）。"])
  guide.addRow(["4. 标准类型：语义判断 / 关键词匹配 / 正则匹配 / 文件存在性；语义判断的“检查方式”留空。"])
  guide.addRow(["5. 澄清场景：JSON 数组，如 [{\"matchDescription\":\"需要查询哪个核算组织？\",\"response\":\"华东公司\"}]；matchDescription 为模拟用户的澄清选择，response 为执行时自动应答的文本。"])
  guide.addRow(["6. 会话附件 / 附件：填写文件名（多个用换行分隔）；导入时需同时选择同名本地文件。"])
  guide.getColumn(1).width = 110
  const buffer = await book.xlsx.writeBuffer()
  return new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}
