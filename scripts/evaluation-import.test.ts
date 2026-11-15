import { test, expect } from "bun:test"
import { parseEvaluationWorkbook, loadEvaluationWorkbook, attachmentImportIssues } from "../src/services/evaluation-import"
import type ExcelJS from "exceljs"
const file = (name:string) => Bun.file(new URL("../public/templates/"+name,import.meta.url)).arrayBuffer()
async function edit(change:(s:ExcelJS.Worksheet)=>void) {
  const w=await loadEvaluationWorkbook(await file("roll-dice.xlsx"))
  change(w.getWorksheet("评测用例总表")!)
  return parseEvaluationWorkbook(await w.xlsx.writeBuffer() as ArrayBuffer)
}
test("两份原件：模板的说明行不是用例；掷骰子保留四个来源 ID、五轮和澄清条件",async()=>{
  const template=await parseEvaluationWorkbook(await file("foundation-question-set.xlsx"))
  expect(template.errors).toEqual([]); expect(template.cases.map(c=>c.turns?.length)).toEqual([1,2])
  expect(template.cases[1].turns![0].rules[0].responses).toEqual(["深圳XX公司","2025年第一季度"])
  const sample=await parseEvaluationWorkbook(await file("roll-dice.xlsx"))
  expect(sample.errors).toEqual([]); expect(sample.cases.map(c=>c.turns?.length)).toEqual([1,1,1,2])
  expect(sample.cases[2].businessId).toBe('FD-RD-003'); expect(sample.cases[2].turns![0].rules[0].responses[0]).toContain("随机")
})
test("空预期继承最近填写的答案；忽略 L4 并保留附件归属，阻止缺件和重名",async()=>{
  const result=await edit(s=>{s.getCell("C7").value="继续";s.getCell("C8").value="再继续";s.getCell("D7").value="新的预期";s.getCell("D6").value=null;s.getCell("B5").value="L4";s.getCell("G5").value="会话.csv";s.getCell("F6").value="本轮.csv,本轮.csv"})
  expect(result.errors).toEqual([]);const c=result.cases[3];expect(c.difficulty).toBeUndefined();expect(c.turns![1].expected).toBe(c.turns![0].expected);expect(c.turns![3].expected).toBe("新的预期")
  expect(result.references.map(r=>[r.names,r.caseId,r.turnId])).toEqual([[["会话.csv"],c.id,undefined],[["本轮.csv"],c.id,c.turns![1].id]])
  const files=["会话.csv","本轮.csv"].map(n=>new File(["x"],n))
  expect(attachmentImportIssues(result,files)).toEqual([]);expect(attachmentImportIssues(result,[])).toHaveLength(2);expect(attachmentImportIssues(result,[...files,files[1]])[0].row).toBe(6)
})
test("不接受错误表头、无主续行、公式、重复 ID、错误澄清及无法保留的执行控制",async()=>{
  for (const [address,value,row] of [["A1","用例编号",1],["A2",null,2],["C2",{formula:"1+1", result:2},2],["A3","FD-RD-001",3],["E4","{}",4]] as const) {
    expect((await edit(s=>{s.getCell(address).value=value})).errors.some(e=>e.row===row)).toBe(true)
  }
  const extra = await edit(s => {
    s.getCell("I1").value = "ERP工具"
    s.getCell("I2").value = "总账"
    s.getCell("J1").value = "空列"
  })
  expect(extra.errors).toEqual([])
  expect(extra.ignored).toContainEqual({ field: "ERP工具", rows: [2] })
  expect(extra.ignored.some(field => field.field === "空列")).toBe(false)
})

test('共同模板忽略扩展字段和难度，列出填写行号',async()=>{
 const result=await edit(s=>{s.getCell('I1').value='是否开启联网搜索';s.getCell('I2').value='是';s.getCell('J1').value='turn:业务域';s.getCell('J2').value='供应链';s.getCell('B2').value='自定义难度'})
 expect(result.errors).toEqual([])
 expect(result.cases[0].difficulty).toBeUndefined()
 expect(result.cases[0].turns![0].sourceFields).toBeUndefined()
 expect(result.ignored).toContainEqual({ field: "是否开启联网搜索", rows: [2] })
 expect(result.ignored).toContainEqual({ field: "turn:业务域", rows: [2] })
})

test("Foundation 三种澄清回复格式导入后保留题目层级", async () => {
  const responses = ["甲", ["甲", "乙"], [["甲", "乙"], "2025Q1"]]
  const parsed = await edit(sheet => {
    sheet.getCell("E2").value = JSON.stringify(responses.map((response, i) => ({ matchDescription: String(i), response })))
  })
  expect(parsed.errors).toEqual([])
  expect(parsed.cases[0].turns![0].rules.map(rule => rule.responses)).toEqual([["甲"], ["甲", "乙"], [["甲", "乙"], "2025Q1"]])
})
