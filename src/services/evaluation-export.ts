import ExcelJS from "exceljs"
import { importHeaders } from "./evaluation-import"

/** 导出用例导入模板：与导入格式同构（11 列）的空表，附填写说明；附件列填文件名，导入时需同时选择同名本地文件。 */
export async function exportTemplateWorkbook(): Promise<Blob> {
  const book = new ExcelJS.Workbook()
  const sheet = book.addWorksheet("评测用例")
  sheet.addRow(importHeaders)
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
