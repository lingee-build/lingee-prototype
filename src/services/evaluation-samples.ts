import type { EvalAttachment, EvalCase, EvalCheck } from "./evaluation"

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
    checks: [check("natural", "完整完成澄清、查询、核对及汇总，保持跨轮次组织与单据一致，不编造数据"), check("keyword", "outputs/查询汇总.txt", "all"), check("regex", "outputs/[^\\n]+\\.txt", "regex"), check("file", "outputs/查询汇总.txt", "exists"), check("file", "outputs/客户联系方式.txt", "not_exists")],
  }
}
