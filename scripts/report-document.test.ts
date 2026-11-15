import { expect, test } from "bun:test"
import { buildReportDocument } from "../src/features/evaluation/report-document"
import type { EvalRun } from "../src/services/evaluation"
import fixture from "../outputs/delivery-demo/模拟结果.json"
const run = fixture.state.runs["skill:sk_delivery"][0] as EvalRun

test("报告分别显示三种澄清降级原因", () => {
  for (const [reason, label] of [
    ["no_match", "没有匹配的澄清规则"],
    ["timeout", "澄清匹配超时"],
    ["model_error", "澄清匹配调用异常"],
  ] as const) {
    const value = structuredClone(run)
    const round = value.results[0].roundResults![0]
    round.clarification = "请确认核算组织\n模拟过程说明"
    round.clarificationFallbackReason = reason
    const html = buildReportDocument(value)
    expect(html).toContain("<dt>澄清降级</dt><dd>" + label + "，未能回填的追问以空答案继续执行。</dd>")
    expect(html).toContain("<dt>实际追问</dt><dd>请确认核算组织</dd>")
  }
})

test("报告目录与正文逐项对应，逐例入口使用当次输入", () => {
  const html = buildReportDocument(run)
  const toc=html.split('<nav class="sidebar"')[1].split('</nav>')[0]
  for(const match of toc.matchAll(/href="#([^"]+)"/g))expect(html.includes('id="'+match[1]+'"')).toBe(true)
  expect(toc.match(/<summary>/g)).toHaveLength(4)
  expect(html.match(/class="case-card"/g)).toHaveLength(run.results.length)
  for(const r of run.results) expect(html.includes(r.roundResults?.[0]?.input || r.input)).toBe(true)
})

test("离线报告安全显示不可信的对象名与实际输出", () => {
  const value = structuredClone(run)
  value.name = "</title><script>alert(1)</script>"
  value.results[0].roundResults![0].responseRecorded = true
  value.results[0].roundResults![0].response = '<img src=x onerror="alert(1)">'
  const html = buildReportDocument(value)
  expect(html).not.toContain("<script>")
  expect(html).not.toContain("<img src=x")
  expect(html).toContain("&lt;img src=x")
  expect(html).toContain("default-src 'none'")
})

test("全用例性能表与指标口径相符，缺失的观测值不作为零消耗", () => {
  const html = buildReportDocument(run)
  const table = html.split('id="metrics"')[1].split("</table>")[0]
  expect(table.match(/<th(?:\s[^>]*)?>/g)).toHaveLength(20)
  expect(table).toContain("<td>—</td>")
  expect(buildReportDocument({...run,results:[]}).includes("已评分 0/0")).toBe(true)
})


test('相同原因问题合并但保留每条证据，质量通过的扣分不标为用例不通过',async()=>{
  const {groupedFindings}=await import('../src/features/evaluation/report-quality')
  const item={id:'a',code:'EC-1',name:'库存',status:'failed',verdict:'failed',evidence:'证据 A',reviewTrace:{scenario:'SCM-001'},quality:{state:'质量通过',scores:[16,14,16,10,14,10,8,6],evidence:'证据 A',issue:'缺少仓库列'}} as any
  const html=groupedFindings([item,{...item,id:'b',code:'EC-2',evidence:'证据 B'}])
  expect(html).toContain('影响 2 条用例')
  expect(html).toContain('#case-0'); expect(html).toContain('#case-1')
  expect(html).toContain('质量改进'); expect(html).not.toContain('用例不通过')
})
