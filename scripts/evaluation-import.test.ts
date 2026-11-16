import { test, expect } from "bun:test"
import ExcelJS from "exceljs"
import { parseEvaluationWorkbook, loadEvaluationWorkbook, parseClarification, attachmentImportIssues, importHeaders } from "../src/services/evaluation-import"
const fixture = new URL("../public/templates/evaluation-v0.5.xlsx", import.meta.url)
async function workbook(change: (w: ExcelJS.Workbook) => void) {
  const book = await loadEvaluationWorkbook(await Bun.file(fixture).arrayBuffer()); change(book)
  const buffer = await book.xlsx.writeBuffer(); return parseEvaluationWorkbook(buffer as unknown as ArrayBuffer)
}
test("批准的 v0.5 真实合并模板：2 用例、4 轮、14 标准、4 候选；整体不计业务轮次", async () => {
  const preview = await parseEvaluationWorkbook(await Bun.file(fixture).arrayBuffer())
  expect(preview.errors).toEqual([])
  expect(preview.cases).toHaveLength(2)
  const turns = preview.cases.flatMap(c => c.turns!)
  expect(turns).toHaveLength(4)
  expect([...preview.cases.flatMap(c => c.checks!), ...turns.flatMap(t => t.checks!)]).toHaveLength(14)
  expect(turns.flatMap(t => t.rules)).toHaveLength(4)
  expect(turns[0].rules[2].responses).toEqual(["供应商 A", "深圳仓"])
  expect(preview.references).toHaveLength(0)
})
test("普通空白不继承、禁止公式、错误可定位", async () => {
  const empty = await workbook(w => w.getWorksheet("评测用例")!.unMergeCells("A2:A14"))
  expect(empty.errors.some(e => e.row === 3 && e.field === "用例编号")).toBe(true)
  const formula = await workbook(w => { w.getWorksheet("评测用例")!.getCell("I2").value = { formula: '"伪造标准"', result: "伪造标准" } })
  expect(formula.errors.some(e => e.row === 2 && e.message.includes("公式"))).toBe(true)
})
test("跨轮合并、标准合并、整体行有输入、无效正则、无效类型被拒绝", async () => {
  for (const change of [
    (w: ExcelJS.Workbook) => { const s = w.getWorksheet("评测用例")!; s.unMergeCells("F2:F5"); s.unMergeCells("F6:F8"); s.mergeCells("F2:F8") },
    (w: ExcelJS.Workbook) => w.getWorksheet("评测用例")!.mergeCells("I2:I3"),
    (w: ExcelJS.Workbook) => { w.getWorksheet("评测用例")!.getCell("E12").value = "不应有输入" },
    (w: ExcelJS.Workbook) => { w.getWorksheet("评测用例")!.getCell("I5").value = "[" },
    (w: ExcelJS.Workbook) => { w.getWorksheet("评测用例")!.getCell("G2").value = "错误类型" },
  ]) expect((await workbook(change)).errors.length).toBeGreaterThan(0)
})
test("标准枚举、澄清字符串与多个问题顺序答案、缺失和同名附件", async () => {
  expect(importHeaders[5]).toBe("澄清回复")
  expect(parseClarification('[{"matchDescription":"追问","response":"第一行\\n第二行"}]')[0].responses).toEqual(["第一行\n第二行"])
  expect(() => parseClarification('[{"matchDescription":"追问","response":[""]}]')).toThrow()
  const p = await workbook(w => { w.getWorksheet("评测用例")!.getCell("K15").value = "材料.txt" })
  expect(attachmentImportIssues(p, [])).toHaveLength(1)
  const file = new File(["模拟"], "材料.txt")
  expect(attachmentImportIssues(p, [file, file])).toHaveLength(1)
  expect(attachmentImportIssues(p, [file])).toHaveLength(0)
})
test("不合并但重复完整分组信息同样支持；额外数据表不静默忽略", async () => {
  const repeated = await workbook(w => {
    const sheet = w.getWorksheet("评测用例")!
    const values = Array.from({ length: 15 }, (_, r) => Array.from({ length: 11 }, (_, c) => sheet.getCell(r + 1, c + 1).value))
    for (const range of [...sheet.model.merges]) sheet.unMergeCells(range)
    values.forEach((row, r) => row.forEach((value, c) => { sheet.getCell(r + 1, c + 1).value = value }))
  })
  expect(repeated.errors).toEqual([])
  expect(repeated.cases[0].turns).toHaveLength(3)
  expect((await workbook(w => { w.addWorksheet("扩展标准").getCell("A1").value = "不能丢失" })).errors.length).toBeGreaterThan(0)
})
