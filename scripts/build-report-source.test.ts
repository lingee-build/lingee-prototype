import { createHash } from "node:crypto"
import { expect, test } from "bun:test"
import { reportRuntime, runtimeIntegrity } from "../src/vendor/build-evaluation/foundation-report-runtime"
import { evaluationReportHtml, evaluationReportPreviewHtml, type ReportHtmlData } from "../src/vendor/build-evaluation/report-html"
const report: ReportHtmlData = {
  code: "ER-test",
  state: "ended",
  revision: 3,
  generatedAt: 1794456000000,
  startedAt: 1000,
  endedAt: 3500,
  executionModel: { name: "MaaS-execution" },
  judgeModel: { name: "MaaS-judge" },
  intervals: [],
  billing: { knownTotal: null, complete: false },
  cases: [
    {
      code: "EC-test",
      state: "ended",
      startedAt: 1000,
      endedAt: 3500,
      quality: { status: "complete", score: 88, grade: "B", blocked: false, version: "v1", dimensions: [] },
      content: {
        name: "<script>alert(1)</script>",
        attachments: [],
        criteria: [],
        turns: [
          {
            input: "<img src=x onerror=alert(1)>",
            attachments: [],
            clarifications: [],
            criteria: [{ id: "a", kind: "semantic", description: "金额为73.00" }],
          },
        ],
      },
      results: [{ criterionId: "a", reason: "金额正确", evidenceRefs: ["e"] }],
      evidence: [{ id: "e", turn: 0, reply: "73.00", complete: true, records: [] }],
    },
  ],
}
test("离线报告使用冻结结果、四节结构及性能记录", () => {
  const html = evaluationReportHtml(report)
  for (const text of [
    "一、关键发现与改进建议",
    "二、评测概览",
    "三、详细分析",
    "四、评分标准",
    "通过率 100.0%",
    "通用执行性能记录",
    "金额为73.00",
  ])
    expect(html).toContain(text)
  expect(html).not.toContain("Build 耗时明细")
  expect(html).not.toContain("点数： 0")
  expect(html).toContain("default-src 'none'")
  expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;")
  expect(html).not.toContain("<script>")
  expect(html).not.toContain("<img src=x")
})
test("环境阻塞用例按统一口径单列，用例结论标签来自八维评分", () => {
  const value = structuredClone(report)
  value.cases[0].quality = {
    status: "complete",
    version: "v1",
    score: 0,
    grade: "D",
    blocked: true,
    dimensions: [{ id: "Q1", score: 0, reason: "沙箱凭据失效，未取得结果", deductions: [] }],
  }
  const html = evaluationReportHtml(value)
  expect(html).toContain('<span class="case-status case-status-env">环境阻塞</span>')
  expect(html).toContain("env-block-banner")
  expect(html).toContain("沙箱凭据失效，未取得结果")
  expect(html).toContain("恢复环境后请重跑该用例")
  expect(html).toContain("通过率 0.0%")
  expect(html).toContain("环境阻塞 1")
  expect(html).not.toContain("无法判定")
})
test("进行中的运行不能生成最终离线报告", () => {
  expect(() => evaluationReportHtml({ ...report, state: "running" })).toThrow("EVALUATION_REPORT_NOT_FINAL")
})
test("报告正文隐藏中断诊断，区分空回复和未记录", () => {
  const value = structuredClone(report)
  value.intervals = [{ kind: "interrupted", start: 1500, end: 2500, startEstimated: true }]
  value.cases[0].evidence[0].reply = ""
  const html = evaluationReportHtml(value)
  expect(html).not.toContain("中断起点为估算")
  expect(html).toContain("（空回复）")
  expect(html).not.toContain("回复未记录")
  value.cases[0].evidence[0].reply = null
  expect(evaluationReportHtml(value)).toContain("回复未记录")
})
test("报告在输出和评分区域保留各自的失败信息", () => {
  const value = structuredClone(report)
  value.cases[0].evidence = []
  value.cases[0].reason = "Error: EVALUATION_EXECUTION_FAILED · APIError · HTTP 502"
  value.cases[0].quality = { status: "incomplete", reason: "Error: EVALUATION_MAAS_HTTP_503" }
  const html = evaluationReportHtml(value)
  expect(html).toContain("EVALUATION_EXECUTION_FAILED · APIError · HTTP 502")
  expect(html).toContain("评分服务暂不可用 (HTTP 503)")
  expect(html).not.toContain("回复未记录")
})
test("离线附件名称来自冻结元数据并转义，不添加下载链接", () => {
  const value = structuredClone(report)
  value.cases[0].content.attachments = ["attachment-id"]
  value.attachmentNames = { "attachment-id": "价格<校验>.txt" }
  const html = evaluationReportHtml(value)
  expect(html).toContain("价格&lt;校验&gt;.txt")
  expect(html).not.toContain('href="attachment-id"')
})
test("运行级计时诊断不进入报告正文", () => {
  const html = evaluationReportHtml({ ...report, endedAt: 500 })
  expect(html).not.toContain("整体耗时：")
  expect(html).not.toContain("整体耗时： 0 秒")
})
test("HTML 使用可读的真实澄清记录并转义问题内容", () => {
  const value = structuredClone(report)
  value.cases[0].evidence[0].records = [{ id: "q", kind: "clarification", value: { questions: [{ question: "数量<script>？" }], answers: [["7"]], receivedAt: 1794228903000 } }]
  const html = evaluationReportHtml(value)
  expect(html).toContain("<dt>实际追问</dt>")
  expect(html).toContain("数量&lt;script&gt;？")
  expect(html).toContain("<dt>自动回复</dt><dd>7</dd>")
  expect(html).not.toContain("回复时间")
  expect(html).toMatch(/灵基实际输出（第 1 轮）<\/strong><div class="io-text md-rendered"><div class="io-clarification-group">.*?澄清过程.*?<\/dl><\/div><div class="io-final-reply">.*?最终回复<\/strong><p>/)
})

test("失败澄清匹配诊断保留问题、候选及错误并转义模型原文", () => {
  const value = structuredClone(report)
  value.cases[0].clarificationDiagnostics = [{
    requestId: "que_failed", status: "failed", questions: [{ question: "是否改为单颗？" }],
    configured: [{ question: "是否改为只掷 1 颗 6 面骰", answers: ["改为掷 1 颗 6 面骰"] }],
    error: "EVALUATION_CLARIFICATION_MATCH_PROTOCOL_INVALID", selections: [{ raw: "<script>unsafe</script>" }],
  }]
  const html = evaluationReportHtml(value)
  expect(html).not.toContain("澄清匹配诊断")
  expect(html).not.toContain("que_failed")
  expect(html).not.toContain("<script>unsafe")
})

test("旧核查结果不再展示，工具证据链接定位原始对话轮次", () => {
  const value = structuredClone(report)
  value.cases[0].results![0].actualResult = "旧核查结果"
  value.cases[0].results![0].evidenceSummary = "旧核查依据"
  value.cases[0].evidence[0].records = [{id:"tool-record",kind:"tool",value:{tool:"bash",callID:"private-call"}}]
  value.cases[0].quality = {status:"complete",version:"v1",score:99,grade:"S",blocked:false,dimensions:[{id:"Q6",score:9,reason:"遗漏",deductions:[{points:1,problem:"遗漏",cause:"漏展示工具结果",suggestion:"展示结果",severity:"low",evidenceRefs:["tool-record"]}]}]}
  const html = evaluationReportHtml(value)
  for(const text of ["Build 判定依据","工具调用证据","旧核查结果","旧核查依据","<dt>实际结果</dt>","<dt>判定依据</dt>","private-call","质量评分模型"]) expect(html.includes(text)).toBe(false)
  expect(html.includes('href="#turn-0-0"')).toBe(true)
  expect(html.includes('id="turn-0-0"')).toBe(true)
  expect(html).toContain('<div class="report-standard"><strong>标准答案</strong>')
  delete value.cases[0].results
  expect(evaluationReportHtml(value).includes("金额为73.00")).toBe(true)
})

test("同一追问的两个答案按原序显示，问题清单的两处证据分别定位", () => {
  const value = structuredClone(report)
  const item=value.cases[0], e=item.evidence[0]
  const rule={question:"组织和期间？",answers:["深圳XX公司","2025年第一季度"]}
  item.content.turns[0].clarifications=[rule]
  e.records=[{id:"asked",kind:"clarification",value:{questions:[{question:rule.question}],answers:[rule.answers]}},
    {id:"said",kind:"reply",value:"已核对"}]
  item.quality={status:"complete",score:99,version:"Lingee-eval v1.0",grade:"S",blocked:false,dimensions:[{id:"Q6",score:9,reason:"解释冗长",deductions:[{points:1,problem:"重复",cause:"重复说明",suggestion:"精简",severity:"low",evidenceRefs:["asked","said"]}]}]}
  const html=evaluationReportHtml(value)
  expect(html).toContain("<dd>深圳XX公司、2025年第一季度</dd>")
  expect(html).toContain('class="evidence-citation"')
  expect(html).toContain('title="EC-test · 第 1 轮 · 实际回复 · 已核对"')
  expect(html).toContain('「已核对」<sup')
  for(const i of [0,1]){
    expect(html).toContain('href="#record-0-0-'+i+'"')
    expect(html).toContain('id="record-0-0-'+i+'"')
  }
})

test("按维度和严重度归并问题并保留不同根因与证据", () => {
  const value = structuredClone(report)
  const first = value.cases[0]
  const loss = {points:1,problem:"未说明期间",cause:"期间未校验",suggestion:"查询前核对期间",severity:"medium",evidenceRefs:["e"]}
  first.quality = {status:"complete",version:"v1",score:99,grade:"S",blocked:false,dimensions:[{
    id:"Q6",score:9,reason:"缺期间",deductions:[loss],
  }]}
  const second = structuredClone(first)
  second.code="EC-B"
  second.evidence[0].artifacts=[{id:"file-id",path:"库存.csv",text:"sku,stock"}]
  const dimensions = second.quality!.status==="complete" ? second.quality!.dimensions : []
  dimensions[0].deductions = [
    {...loss,cause:"没有核验会计期间",suggestion:"读取前确认期间",groupRef:JSON.stringify([loss.cause,loss.severity,loss.suggestion]),evidenceRefs:["e","file-id"]},
    {...loss,cause:"缺少组织标识",suggestion:"补充组织参数"},
  ]
  value.cases.push(second)
  const html = evaluationReportHtml(value)
  const issues = html.slice(html.indexOf('<section id="issues">'),html.indexOf('<h3 id="strengths">'))
  expect(issues).toContain("期间未校验")
  expect(issues).toContain('<span class="issue-card-case-code">EC-test、</span><span class="issue-card-case-code">EC-B</span>')
  expect(issues).toContain("P1 × 1")
  expect(issues).toContain("缺少组织标识")
  expect(issues).toContain("没有核验会计期间")
  expect(issues).toContain('href="#turn-1-0"')
  expect(issues).toContain('href="#artifact-1-0-0"')
  expect(html).toContain('id="artifact-1-0-0"')
  expect(html).toContain("没有核验会计期间")
})

test("运行预览沿用最终报告目录，等待评分时不提前给出通过率", () => {
  const run = structuredClone(report)
  run.state = "judging"
  run.cases[0].state = "judging"
  run.cases[0].quality = { status: "pending", reason: "等待评分回执" }
  const preview = evaluationReportPreviewHtml(run)
  expect(preview).toContain("EC-test 评分中")
  expect(preview).toContain('<span class="case-score-area"><span class="case-status case-status-active">评分中</span></span>')
  run.cases[0].state = "ended"
  expect(evaluationReportPreviewHtml(run)).toContain(
    '<span class="case-score-area"><span class="case-status case-status-neutral">未评分</span></span>',
  )
  expect(preview).toContain("通过率 <b>—</b>")
  expect(preview).toContain("评测进行中，问题清单持续更新")
  const toc = (html: string) => html.match(/<nav .*?<\/nav>/s)?.[0]
  expect(toc(preview)).toBe(toc(evaluationReportHtml(report)))
  expect(evaluationReportPreviewHtml(report)).toBe(evaluationReportHtml(report))
})

test("嵌入预览在执行期间使用运行时钟，结束后固定耗时并显示最新结算点数", () => {
  const startedAt = Date.now() - 12_000
  const run = {
    ...report, state: "running", startedAt, endedAt: undefined, lastActivityAt: startedAt + 1000,
    billing: { knownTotal: 10, complete: false },
  }
  const preview = evaluationReportPreviewHtml(run, "", undefined, "embedded")
  expect(preview).toContain(`<dt>总耗时</dt><dd><span data-elapsed-since="${startedAt}">`)
  expect(preview).toContain("<dt>总点数</dt><dd>10.00<small>统计未完整</small></dd>")
  const final = evaluationReportPreviewHtml({
    ...run, state: "ended", endedAt: startedAt + 20_000, billing: { knownTotal: 15, complete: true },
  }, "", undefined, "embedded")
  expect(final).toContain("<dt>总耗时</dt><dd>20.0 秒</dd>")
  expect(final).toContain("<dt>总点数</dt><dd>15.00</dd>")
})

test("雷达得分率使用未舍入的维度均分，同时保留分档和逐轮 Markdown", () => {
  const run = structuredClone(report)
  run.cases = [16, 16, 16, 11].map((score, i) => {
    const item = structuredClone(report.cases[0])
    item.code = "回归-" + i
    item.quality = {
      status: "complete", version: "v1", score, grade: "D", blocked: false,
      dimensions: [{ id: "Q1", score, reason: "评分依据", deductions: [] }],
    }
    item.evidence[0].reply = "**掷出 5 点** <img src=x onerror=alert(1)>"
    return item
  })
  const html = evaluationReportHtml(run)
  const config = html.match(/id="radarQualityChart" data-chart="([^"]+)"/)
  expect(JSON.parse(config![1].replaceAll("&quot;", '"')).data.datasets[0].data[0]).toBe(92.2)
  const radarLabels = JSON.parse(config![1].replaceAll("&quot;", '"')).data.labels
  expect(radarLabels[0]).toBe("Skill遵循度")
  expect(radarLabels[1]).toEqual(["意图识别与", "技能路由"])
  expect(html).toContain("<strong>掷出 5 点</strong>")
  expect(html).not.toContain("<img src=x")
  expect(html).toContain("15-16完全遵循")
})

test("评分超时的报告显示原因，有效零分仍绘图", () => {
  const run = structuredClone(report)
  run.cases[0].quality = {status:"incomplete", reason:"TimeoutError: The operation timed out."}
  const html = evaluationReportHtml(run)
  expect(html).toContain("评分服务超时（1 条用例）")
  expect(html).toContain("已评分 0/1")
  expect(html).not.toContain('id="caseBarChart" data-chart=')
  run.cases[0].quality = {status:"complete", version:"v1", score:0, grade:"D", blocked:true, dimensions:[]}
  expect(evaluationReportHtml(run)).toContain('id="caseBarChart" data-chart=')
})

test("客户端内提供执行会话回看入口，离线报告隐藏该入口", () => {
  const run = structuredClone(report)
  run.cases[0].sessionId = "ses_case1"
  const embedded = evaluationReportPreviewHtml(run, "", undefined, "embedded")
  expect(embedded).toContain('data-eval-session="ses_case1"')
  expect(embedded).toContain("查看会话")
  const standalone = evaluationReportHtml(run)
  expect(standalone).not.toContain('data-eval-session="ses_case1"')
  expect(standalone).not.toContain("查看会话")
  expect(standalone).not.toContain("ses_case1")
})

test("报告内置脚本的 CSP 哈希随内容更新，否则图表和实时刷新会被静默拦截", () => {
  expect("sha256-" + createHash("sha256").update(reportRuntime).digest("base64")).toBe(runtimeIntegrity)
  expect(reportRuntime).toContain("evaluation-session-open")
})

const summaryOf = (html: string) => html.slice(html.indexOf('<section id="conclusion">'), html.indexOf('<section id="issues">'))
test("下载版与页面共用报告基础信息和目录", () => {
  const run = { ...report, generatedAt: report.endedAt ?? report.startedAt, targetKind: "skill" as const }
  const name = "掷骰子"
  const download = evaluationReportHtml(run, name)
  const page = evaluationReportPreviewHtml(run, name, undefined, "embedded")
  const header = (html: string) => html.slice(html.indexOf('<main class="main">'), html.indexOf('<section id="conclusion">'))
  const toc = (html: string) => html.slice(html.indexOf('<nav class="sidebar"'), html.indexOf('</nav>'))
  expect(header(download)).toBe(header(page))
  expect(toc(download)).toBe(toc(page))
  expect(header(download)).toContain("<dt>类型</dt><dd>技能</dd>")
  expect(header(download)).toContain("生成时间")
})
test("客户端直接展示运行配置和用量，评分结果集中在评测结论", () => {
  const html = evaluationReportPreviewHtml({...report, targetKind: "agent"}, "掷骰子", undefined, "embedded")
  const header = html.slice(html.indexOf('<main class="main">'), html.indexOf('<section id="conclusion">'))
  for (const label of ["执行模型", "判定模型", "总耗时", "总点数", "执行耗时", "判定点数"]) {
    expect(header).toContain(`<dt>${label}</dt>`)
  }
  expect(header).toContain("<dt>类型</dt><dd>智能体</dd>")
  for (const label of ["评测对象", "平台", "评分方式"]) expect(header).not.toContain(`<dt>${label}</dt>`)
  expect(header).not.toContain("<details")
  expect(header).not.toContain("综合得分")
  expect(header).not.toContain("已评分")
  expect(summaryOf(html)).toContain("综合得分")
})

test("结论卡性能按逐用例均值汇总，与质量评分覆盖范围独立", () => {
  const run = structuredClone(report)
  run.cases = [88, 0, null].map((score, i) => ({...structuredClone(report.cases[0]), code:`EC-${i}`,
    quality: score === null ? {status:'incomplete' as const,reason:'timeout'} : {...report.cases[0].quality as Extract<NonNullable<ReportHtmlData['cases'][number]['quality']>,{status:'complete'}>, score, blocked:score===0},
    evidence: [{...report.cases[0].evidence[0], ...(i === 2 ? {} : {observation:{start:1000,end:i===0?3000:7000,calls:1,tools:i===0?1:9,toolSuccess:i===0?1:0}})}]
  }))
  const summary = summaryOf(evaluationReportHtml(run))
  for (const text of ['通过率 <b>50.0%</b>','质量均分 <b>44.0/100</b>','平均E2E耗时 <b>4.0s</b>','平均工具成功率 <b>50.0%</b>','有效记录 2/3','已评分 2/3','环境阻塞 1','当前结论仅基于已评分用例。']) expect(summary.includes(text)).toBe(true)
})
test("无观测不伪造性能；无工具调用按平台区分逐例与汇总", () => {
  const missing = summaryOf(evaluationReportHtml(report))
  expect(missing.includes('平均E2E耗时 <b>—</b>')).toBe(true)
  expect(missing.includes('平均工具成功率 <b>—</b>')).toBe(true)
  const run = structuredClone(report)
  run.cases[0].evidence[0].observation = {start:1000,end:1000,calls:1,tools:0,toolSuccess:0}
  const summary = summaryOf(evaluationReportHtml(run))
  expect(summary.includes('平均E2E耗时 <b>0.0s</b>')).toBe(true)
  expect(summary.includes('平均工具成功率 <b>0.0%</b>')).toBe(true)
})
test("多用例结论汇总实际问题和优势维度，并转义模型输出", () => {
  const run = structuredClone(report)
  run.cases = [0,1].map(i=>({...structuredClone(report.cases[0]),code:`EC-${i}`,quality:{status:'complete',score:74,grade:'B',version:'v1',blocked:false,dimensions:[
    {id:'Q1',score:16,reason:'遵循',deductions:[]},
    {id:'Q2',score:10,reason:'路由错误',deductions:[{points:4,problem:'选错工具',cause:'<script>路由错误</script>',suggestion:'核验路由',severity:'high',evidenceRefs:['e']}]}
  ]}}))
  const summary = summaryOf(evaluationReportHtml(run))
  for (const text of ['本次评测结论','质量均分 74.0/100','P0 · 问题数 1','核验路由','&lt;script&gt;路由错误&lt;/script&gt;','优势维度：Q1','16.0/16']) expect(summary.includes(text)).toBe(true)
  expect(summary.includes('<script>')).toBe(false)
})

test("平台问题汇总区分环境阻塞、未通过和维度短板", () => {
  const run = structuredClone(report)
  const original = run.cases[0]
  run.cases = [
    {...original, code:"failed", quality:{status:"complete",score:55,grade:"D",blocked:false,version:"test",dimensions:[
      {id:"Q1",score:7,reason:"",deductions:[]}, {id:"Q2",score:9,reason:"",deductions:[]},
      {id:"Q3",score:12,reason:"",deductions:[]},
    ]}},
    {...original, code:"blocked", quality:{status:"complete",score:0,grade:"D",blocked:true,version:"test",dimensions:[]}},
    {...original, code:"pending", quality:{status:"incomplete",reason:"timeout"}},
  ]
  const html = evaluationReportHtml(run)
  const issues = html.slice(html.indexOf('<section id="issues">'), html.indexOf('<h3 id="strengths">'))
  for (const text of ["P0 × 2", "P1 × 1", "P2 × 1", "1 个用例总分未达 60 分", "1 个用例因环境阻塞全维度计 0 分", "系统性短板 · Q1", "维度待提升 · Q2"])
    expect(issues.includes(text)).toBe(true)
  expect(issues.includes("维度待提升 · Q3")).toBe(false)
  expect(issues.includes(">pending<")).toBe(false)
})

 test("report source preserves optional host version without unsafe HTML", () => {
  for (const version of [undefined, "", "   "]) {
    const html = evaluationReportHtml({ ...report, sourceAppVersion: version })
    expect(html).toContain('<strong>灵基Build</strong>')
    expect(html).toContain('class="report-source"')
  }
  expect(evaluationReportHtml({ ...report, sourceAppVersion: " V1.9.1 " })).toContain('<strong>灵基Build V1.9.1</strong>')
  expect(evaluationReportHtml({ ...report, sourceAppVersion: '<img src=x onerror=alert(1)>' })).toContain('V&lt;img')
  expect(evaluationReportPreviewHtml({ ...report, sourceAppVersion: "1.9.1" }, "", undefined, "embedded")).toContain('<strong>灵基Build V1.9.1</strong>')
})

test("未应答追问作为实际输出展示，并标明未执行轮次", () => {
  const value = structuredClone(report)
  const item = value.cases[0]
  const question = "一次只能掷一颗六面骰，要分三次掷吗？"
  Object.assign(item.evidence[0], {
    reply: "",
    complete: false,
    endReason: "unexpected_clarification",
    records: [{ id: "q", kind: "clarification", value: {
      status: "unexpected_clarification", questions: [{ question }],
    } }],
  })
  const single = evaluationReportHtml(value)
  expect(single).toContain(question)
  expect(single).toContain('id="record-0-0-0"')
  expect(single).toContain("已根据追问内容和工具记录完成评分")
  expect(single).not.toContain("（空回复）")

  item.content.turns.push(structuredClone(item.content.turns[0]))
  item.quality = { status: "incomplete", reason: "用例未配置追问应答" }
  const multi = evaluationReportHtml(value)
  expect(multi).toContain("第 1 轮，模型发起追问")
  expect(multi).toContain("本轮未执行")
})

test("评分失败展示校验原因，缺少追问应答归为未评分", () => {
  const value = structuredClone(report)
  value.cases[0].quality = { status: "incomplete", reason: "Error: EVALUATION_QUALITY_INVALID · Q3 得分与扣分明细不符" }
  const failed = evaluationReportHtml(value)
  expect(failed).toContain('<strong>评分失败</strong>')
  expect(failed).toContain("Q3 得分与扣分明细不一致，本次评分未采纳。")
  value.cases[0].quality = { status: "incomplete", reason: "用例未配置追问应答" }
  const skipped = evaluationReportHtml(value)
  expect(skipped).toContain("未评分 · 用例未配置追问应答")
  expect(skipped).not.toContain("<strong>评分失败</strong>")
})

test("导入编号作为报告用例编号，澄清配置错误给出可操作提示且不改写结果", () => {
  const value = structuredClone(report)
  value.cases[0].content.externalCaseId = "LG-EC-0003<script>"
  value.cases[0].reason = "Error: EVALUATION_CLARIFICATION_INVALID_OPTION"
  delete value.cases[0].quality
  const frozen = structuredClone(value)
  for (const html of [evaluationReportHtml(value), evaluationReportPreviewHtml(value)]) {
    expect(html).toContain('<span class="case-id">LG-EC-0003&lt;script&gt;</span>')
    expect(html).toContain('href="#case-0" title="LG-EC-0003&lt;script&gt; ')
    expect(html).not.toContain("来源用例 ID")
    expect(html).toContain("调整用例澄清规则后重新运行")
    expect(html).not.toContain("EVALUATION_CLARIFICATION_INVALID_OPTION")
    expect(html).toContain("未评分")
  }
  expect(value).toEqual(frozen)
})

test("报告逐轮显示冻结的澄清规则，即使用例未发生实际追问", () => {
  const input = structuredClone(report)
  input.cases[0].content.turns[0].clarifications = [
    { question: "<客户>", answers: [["甲", "乙"], "丙"] },
  ]
  for (const html of [evaluationReportHtml(input, "测试"), evaluationReportPreviewHtml(input, "测试")]) {
    expect(html).toContain("澄清规则配置")
    expect(html).toContain("<dt>预期追问</dt><dd>&lt;客户&gt;</dd>")
    expect(html).toContain("<li>甲 &amp; 乙</li><li>丙</li>")
    expect(html).not.toContain(">澄清过程</strong>")
  }
})
