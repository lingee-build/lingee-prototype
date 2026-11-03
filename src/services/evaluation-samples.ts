import type { DemoJudgment, EvalAttachment, EvalCase, EvalCheck } from "./evaluation"

const judgment = (text: string, actual: string, evidence: string, verdict: DemoJudgment["verdict"] = "passed"): DemoJudgment => ({ check: { text }, verdict, actual, evidence })

/** 简单正常／失败场景也保留可对照的工具返回与逐项依据。 */
export function basicEvaluationSample(value: Pick<EvalCase, "name" | "input" | "expected" | "source" | "outcome">): EvalCase {
  const failed = value.outcome === "failed"
  const overall = "最终结论与业务数据一致，且有查询结果或业务材料支持。"
  const actual = failed ? "未询问缺失的业务编号，直接使用 DEMO-001 执行。" : "回复中的单号、状态和来源与查询结果一致。"
  const evidence = failed ? "用户输入明确表示编号稍后补充；示例未发生澄清，工具使用 DEMO-001 查询，回复称已完成处理。" : "示例工具返回单号 DEMO-001、状态已完成、来源业务系统；最终回复逐项呈现这些字段。"
  const verdict = failed ? "failed" : "passed"
  return { ...value, id: crypto.randomUUID(), demo: true,
    checks: [],
    turns: [{ id: crypto.randomUUID(), input: value.input, expected: value.expected, attachments: [], rules: [], checks: [{ id: crypto.randomUUID(), text: value.expected, required: true, files: [] }, ...(!failed && value.outcome !== "blocked" ? [{ id: crypto.randomUUID(), kind: "file" as const, operator: "exists" as const, text: "outputs/查询结果.txt", required: true, files: [] }] : [])] }],
    demoEvidence: { turns: [{
      response: failed ? "已按默认编号 DEMO-001 完成处理。" : "业务记录 DEMO-001，状态：已完成，来源：业务系统。查询结果已保存至 outputs/查询结果.txt。",
      tool: `mcp.${value.source}.business_query`,
      toolResult: failed ? "示例请求：业务编号 DEMO-001（用户未提供）。示例返回：记录 DEMO-001，状态已完成；该记录不能证明是用户要查询的业务。" : "示例返回：记录 DEMO-001，状态已完成，来源业务系统。示例保存结果：outputs/查询结果.txt。",
      clarification: "本轮未发生澄清。", files: failed ? [] : ["outputs/查询结果.txt"],
      judgments: [judgment(value.expected, actual, evidence, verdict)],
    }], overall: [judgment(overall, failed ? "查询使用了未经用户确认的编号，结果无法对应到用户的业务。" : actual, evidence, verdict)] },
  }
}

/** 每次生成独立 ID，避免重复添加示例后编辑内容相互影响。 */
export function completeEvaluationSample(name: string): EvalCase {
  const id = () => crypto.randomUUID()
  const check = (kind: EvalCheck["kind"], text: string, operator?: EvalCheck["operator"]): EvalCheck => ({ id: id(), kind, text, operator, required: true, files: [] })
  const attachment = (name: string, content: string): EvalAttachment => ({ id: id(), name, size: new TextEncoder().encode(content).length, data: `data:text/plain;charset=utf-8,${encodeURIComponent(content)}` })
  const rule = (match: string, response: string) => ({ id: id(), match, responses: [response] })
  return {
    id: id(), name: `${name} · 附件、多轮澄清与完整标准示例`, source: "tenant", outcome: "passed", demo: true,
    input: "请按会话附件中的业务要求查询单据，先确认缺少的信息", expected: "先澄清组织和期间，再返回可核验的查询结果",
    attachments: [attachment("业务要求.txt", "核算组织：华东公司\n查询期间：2026年10月\n示例单据：FHTZ-20261030-001\n客户：优品科技\n状态：已审核\n物料A：应发100件、已发60件、未发40件\n最终交付：outputs/查询汇总.txt\n不得输出客户联系方式")],
    turns: [
      {
        id: id(), input: "请根据业务要求查询单据，返回单号、客户和状态。组织和期间请先向我确认", expected: "确认组织、期间后查询单据",
        attachments: [attachment("查询条件.txt", "单据编号：FHTZ-20261030-001\n组织和期间由用户确认后再查询")],
        rules: [rule("需要查询哪个核算组织？", "华东公司"), rule("需要查询哪个期间？", "2026年10月")],
        checks: [check("natural", "查询前确认核算组织和期间，使用华东公司、2026年10月查询"), check("keyword", "FHTZ-20261030-001\n优品科技", "all"), check("regex", "FHTZ-[0-9]{8}-[0-9]{3}", "regex")],
      },
      {
        id: id(), input: "继续核对这张单据的物料数量，依据本轮附件计算未发数量，不要重复询问已确认的组织", expected: "未发数量为40件，并沿用上一轮组织",
        attachments: [attachment("物料明细.csv", "物料,应发数量,已发数量\n物料A,100,60\n")],
        rules: [rule("数量按什么单位展示？", "按件展示")],
        checks: [check("natural", "沿用华东公司上下文，根据100减60得出未发40件"), check("keyword", "未发40件\n未发数量：40", "any"), check("keyword", "手机号\n身份证号", "none"), check("regex", "1[3-9][0-9]{9}", "not_regex")],
      },
      {
        id: id(), input: "将查询结果和未发数量汇总到 outputs/查询汇总.txt，回复文件路径，不要生成包含客户联系方式的文件", expected: "生成汇总文件，并返回路径", attachments: [], rules: [],
        checks: [check("natural", "汇总包含单号、客户、审核状态、应发100件、已发60件和未发40件"), check("keyword", "outputs/查询汇总.txt", "all"), check("file", "outputs/查询汇总.txt", "exists"), check("file", "outputs/客户联系方式.txt", "not_exists")],
      },
    ],
    checks: [check("natural", "完整完成澄清、查询、核对及汇总，保持跨轮次组织与单据一致，不编造数据")],
    demoEvidence: {
      turns: [
        {
          response: "已按确认的华东公司、2026年10月查询：单号 FHTZ-20261030-001，客户：优品科技，状态：已审核。",
          tool: "mcp.tenant.business_query", toolResult: "示例查询参数：组织=华东公司，期间=2026年10月。示例返回：单号=FHTZ-20261030-001，客户=优品科技，状态=已审核。",
          clarification: "示例追问：需要查询哪个核算组织？\n自动回复：华东公司\n\n示例追问：需要查询哪个期间？\n自动回复：2026年10月", files: [],
          judgments: [judgment("查询前确认核算组织和期间，使用华东公司、2026年10月查询", "先确认组织和期间，再使用华东公司、2026年10月查询。", "本轮两次澄清分别回复华东公司和2026年10月；示例工具参数采用这两个值，返回 FHTZ-20261030-001。")],
        },
        {
          response: "沿用华东公司及单号 FHTZ-20261030-001。按本轮物料明细：物料A应发100件，已发60件，未发40件（100－60）。",
          tool: "read_attachment", toolResult: "示例读取本轮附件物料明细.csv：物料A，应发数量100，已发数量60。", files: [],
          clarification: "示例追问：数量按什么单位展示？\n自动回复：按件展示",
          judgments: [judgment("沿用华东公司上下文，根据100减60得出未发40件", "沿用华东公司，将应发100件减去已发60件，得到未发40件。", "第一轮已确认华东公司；本轮只询问数量单位。附件读取结果为100、60，最终回复写明100－60及未发40件。")],
        },
        {
          response: "已生成 outputs/查询汇总.txt。汇总内容：华东公司，FHTZ-20261030-001，优品科技，已审核；物料A应发100件、已发60件、未发40件。未生成客户联系方式文件。",
          tool: "write_file", toolResult: "示例写入参数：outputs/查询汇总.txt；内容为华东公司、FHTZ-20261030-001、优品科技、已审核、应发100件、已发60件、未发40件。示例返回：写入成功。",
          clarification: "本轮未发生澄清。", files: ["outputs/查询汇总.txt"],
          judgments: [judgment("汇总包含单号、客户、审核状态、应发100件、已发60件和未发40件", "汇总写入参数包含单号、客户、审核状态以及100／60／40件。", "本轮 write_file 参数逐项列出汇总字段，返回写入成功；最终回复与前两轮数据一致。未读取或检查产物内容。")],
        },
      ],
      overall: [judgment("完整完成澄清、查询、核对及汇总，保持跨轮次组织与单据一致，不编造数据", "三轮均沿用华东公司与 FHTZ-20261030-001，完成查询、数量核对及汇总写入。", "第1轮确认组织、期间并查询；第2轮读取数量100／60，计算未发40件；第3轮写入相同单号、客户、状态及数量并返回成功。")],
    },
  }
}
