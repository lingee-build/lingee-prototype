import { type EvalCase, type EvalAttachment, type EvalCheck, type EvalTurn } from "@/services/evaluation"

const standard = (text: string): EvalCheck => ({ id: crypto.randomUUID(), kind: "natural", text, required: true, files: [] })
export function makeDraft(name: string, scenario: string, rule: string, files: EvalAttachment[]): EvalCase {
  const input = scenario === "正常查询" ? `请使用「${name}」处理业务请求，返回结果与依据` : scenario === "信息缺失" ? `请使用「${name}」处理业务请求，具体条件稍后补充` : scenario === "多轮追问" ? `请使用「${name}」查询业务记录` : `请使用「${name}」查询一条不存在的业务记录`
  const scenarioStandard = scenario === "信息缺失" ? "执行查询前先澄清缺失条件，收到回复后继续，不自行编造条件" : scenario === "记录不存在" ? "明确告知未找到记录，不编造单据内容或成功结果" : scenario === "多轮追问" ? "后续追问沿用前文查询对象，明细与首次查询结果一致" : "返回与查询条件一致的业务结果，并说明数据来源"
  const turn: EvalTurn = { id: crypto.randomUUID(), input, expected: "", attachments: [], rules: [], checks: [standard(scenarioStandard), ...(rule && rule !== scenarioStandard ? [standard(rule)] : [])] }
  return { id: crypto.randomUUID(), name: `${name} · ${scenario}`, input, expected: "", source: "none", outcome: "passed", demo: false, attachments: structuredClone(files), checks: [], turns: [turn, ...(scenario === "多轮追问" ? [{ ...structuredClone(turn), id: crypto.randomUUID(), input: "继续查看这条记录的明细，并说明数据来源", checks: [standard(rule)] }] : [])] }
}
