import { exportText } from "./export-text"
import { evidenceFields, unexpectedClarificationText } from "./evidence-fields"
import { averageQuality, outcomeCounts, passRate, qualityGrade, scoringFailureReason, scoringLabels, scoringStatus } from "./outcome"
import { evaluationCaseCode } from "./presentation"
import { foundationQualityScale } from "./foundation-quality-scale"
export const rubric = [
  ["Q1","Skill 遵循度",16], ["Q2","意图识别与技能路由",14], ["Q3","流程准确与完整性",16],
  ["Q4","产物质量与规范性",16], ["Q5","数据准确与一致性",14], ["Q6","交互与表达规范性",10],
  ["Q7","幻觉检测与事实约束",8], ["Q8","错误与异常处理",6],
] as const
export type Quality = {status:"complete";analysis?:{conclusion:string;evidenceRefs:string[]};version:string;score:number;grade:string;blocked:boolean;dimensions:{
  id:string;score:number;reason:string;deductions:{groupRef?:string|null;points:number;problem:string;cause:string;suggestion:string;severity:string;evidenceRefs:string[]}[]
}[]} | {status:"pending"|"incomplete";reason:string}
export function canRestoreQuality(item: {
  quality?: { status: string }
  content: { turns: readonly unknown[] }
  evidence: readonly { complete: boolean; endReason?: string; records?: { kind: string; value: unknown }[] }[]
}) {
  return item.quality?.status !== "complete" && item.content.turns.length > 0
    && item.evidence.length === item.content.turns.length
    && item.evidence.every(turn => turn.complete || (
      item.content.turns.length === 1 && turn.records && unexpectedClarificationText({ endReason: turn.endReason, records: turn.records })
    ))
}
export type Observation = {start:number;end:number;errors?:number;recovered?:number;networkMs?:number;rounds?:number;input?:number;output?:number;cacheRead?:number;llmMs?:number;firstTokenMs?:number;calls:number;tools:number;toolSuccess:number;toolMs?:number}
export const metricLabels = ["E2E 耗时(ms)","TTFT(ms)","LLM 耗时(ms)","网络耗时(ms)","turn 耗时(ms)","上下文 Token","输出 Token","总 Token","点数消耗","缓存率(%)","LLM 次数","工具次数","工具成功率(%)","平均工具耗时(ms)","工具总耗时(ms)","round 数","turn 数","错误恢复率(%)"]
export const metricDefinitions = [
  "从本次用例首轮开始到末轮结束的时间。",
  "各轮首个有效首 Token 耗时的平均值。",
  "本用例业务模型请求的耗时之和。",
  "已观测的业务模型和远程 MCP 请求耗时之和。",
  "各业务轮次执行耗时之和。",
  "输入 Token，计入缓存读取与写入。",
  "执行模型记录的输出 Token。",
  "上下文 Token 与输出 Token 之和。",
  "本用例业务执行的已结算点数。",
  "缓存读取 Token 占上下文 Token 的百分比。",
  "业务模型实际发起的请求次数。",
  "已记录的工具调用次数。",
  "成功工具调用占全部工具调用的百分比，无调用时按指标说明记 100%。",
  "工具总耗时除以工具调用次数，无调用时记 0。",
  "各次工具调用耗时之和。",
  "各业务轮次中模型交互 round 数之和。",
  "本次用例实际执行的业务轮次。",
  "错误后成功恢复的 round 占错误 round 的百分比，无错误时记 100%。",
]

export function metrics(evidence: {observation?: Observation}[], credits?: number): (number | undefined)[] {
  const observations = evidence.flatMap(turn => turn.observation ? [turn.observation] : [])
  if (!observations.length || observations.length !== evidence.length)
    return metricLabels.map((_, i) => i === 8 ? credits : undefined)

  function sum(key: keyof Observation) {
    if (observations.some(turn => turn[key] === undefined)) return undefined
    return observations.reduce((total, turn) => total + turn[key]!, 0)
  }
  const input = sum("input"), output = sum("output"), cache = sum("cacheRead")
  const toolCount = sum("tools")!, toolMs = sum("toolMs"), succeeded = sum("toolSuccess")
  const errors = sum("errors"), recovered = sum("recovered")
  const firstTokens = observations.flatMap(turn => turn.firstTokenMs && turn.firstTokenMs > 0 ? [turn.firstTokenMs] : [])
  return [
    observations.at(-1)!.end - observations[0].start,
    firstTokens.length ? firstTokens.reduce((a,b) => a+b) / firstTokens.length : undefined,
    sum("llmMs"), sum("networkMs"),
    observations.reduce((total,turn) => total + turn.end - turn.start, 0),
    input, output, input !== undefined && output !== undefined ? input + output : undefined, credits,
    cache === undefined || input === undefined ? undefined : input > 0 ? 100 * cache / input : 0,
    sum("calls"), toolCount,
    toolCount === 0 ? 100 : succeeded === undefined ? undefined : Number((100 * succeeded / toolCount).toFixed(1)),
    toolCount === 0 ? 0 : toolMs === undefined ? undefined : toolMs / toolCount,
    toolMs, sum("rounds"), observations.length,
    errors === undefined || recovered === undefined ? undefined : errors ? 100 * recovered / errors : 100,
  ]
}

const reportMetricLabels = ["E2E耗时(s)", "TTFT(s)", "LLM耗时(s)", "网络耗时(s)", "turn耗时(s)", "上下文Token", "输出Token", "总Token", "点数消耗(点)", "缓存率(%)", "LLM次数", "工具次数", "工具成功率(%)", "平均工具耗时(s)", "工具总耗时(s)", "round数", "turn数", "错误恢复率(%)"]
function displayMetric(value:number | undefined, index:number, withUnit = false) {
  if (value === undefined) return "—"
  if (reportMetricLabels[index].endsWith("(s)")) return String(Number((value / 1000).toFixed(2)))
  if (index >= 5 && index <= 7) return value.toLocaleString("en-US")
  if ([9,12,17].includes(index)) return value.toFixed(index === 9 ? 2 : 1) + (withUnit ? "%" : "")
  return String(value) + (index === 8 && withUnit ? "点" : "")
}

export function qualitySections(items:{code:string;state?:string;content?:{externalCaseId?:string};executionCredits?:number;quality?:Quality;evidence:{id:string;turn:number;reply?:string|null;records:{id:string;kind?:string;value?:unknown}[];artifacts?:{id?:string;path:string;text?:string}[];observation?:Observation}[]}[], t:(text:string)=>string, escape:(text:unknown)=>string, translate:(text:string)=>string = text => text) {
  const scored = items.flatMap(item=>item.quality?.status==="complete"?[item.quality]:[])
  const mean = (values:number[])=>values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1):"—"
  const citationNumbers = new Map<string, number>()
  const excerpt = (text: string, limit: number) => {
    const normalized = exportText(text).replace(/\s+/g, " ").trim()
    return normalized.length > limit ? normalized.slice(0, limit) + "…" : normalized
  }
  const link = (index: number, ref: string) => {
    const item = items[index]
    const caseCode = evaluationCaseCode(item)
    const evidence = item.evidence.find(turn =>
      turn.id === ref || turn.records.some(record => record.id === ref) || turn.artifacts?.some(file => file.id === ref),
    )
    if (!evidence) return `<a href="#case-${index}">${escape(caseCode)}</a>`

    const recordIndex = evidence.records.findIndex(record => record.id === ref)
    const artifactIndex = evidence.artifacts?.findIndex(file => file.id === ref) ?? -1
    const record = evidence.records[recordIndex]
    const artifact = evidence.artifacts?.[artifactIndex]
    const visibleRecord = ["input", "reply", "clarification"].includes(record?.kind ?? "")
    const turnAnchor = `turn-${index}-${evidence.turn}`
    const anchor = artifact ? `artifact-${index}-${evidence.turn}-${artifactIndex}`
      : visibleRecord ? `record-${index}-${evidence.turn}-${recordIndex}` : turnAnchor

    const fields = record ? evidenceFields(record.kind ?? "", record.value) : []
    const tool = fields.find(field => field.label === "工具调用")?.text
    const detail = artifact?.text
      ?? (typeof record?.value === "string" ? record.value : undefined)
      ?? fields.find(field => field.label === "错误信息")?.text
      ?? fields.find(field => field.label === "工具返回")?.text
      ?? (record?.kind === "clarification" ? fields.map(field => `${translate(field.label)} ${field.text}`).join(" · ") : undefined)
      ?? (record?.kind === "reply" || !record ? evidence.reply : undefined)
      ?? ""
    const kind = artifact ? artifact.path
      : record?.kind === "input" ? translate("用户输入")
      : record?.kind === "tool" ? tool ?? translate("工具调用")
      : record?.kind === "clarification" ? translate("本次澄清过程")
      : translate("实际回复")
    const label = `${caseCode} · ${translate("第")} ${evidence.turn + 1} ${translate("轮")} · ${excerpt(kind, 100)}`
    const preview = excerpt(detail, 120)
    const description = [label, excerpt(detail, 320)].filter(Boolean).join(" · ")
    const key = JSON.stringify([index, ref])
    const number = citationNumbers.get(key) ?? citationNumbers.size + 1
    citationNumbers.set(key, number)
    return `${escape(label)}${preview ? ` 「${escape(preview)}」` : ""}<sup class="evidence-citation"><a href="#${anchor}" title="${escape(description)}" aria-label="${escape(description)}">[${number}]</a></sup>`
  }
  const findings = new Map<string, {
    problem: string; causes: Set<string>; suggestions: Set<string>; severity: string
    cases: Set<number>; links: Set<string>; dimensions: Set<string>
  }>()
  function addFinding(key: string, severity: string, problem: string, dimension: string, indices: number[],
    evidence: string[], cause: string, suggestion: string) {
    const group = findings.get(key) ?? {
      problem, severity, causes: new Set<string>(), suggestions: new Set<string>(),
      cases: new Set<number>(), links: new Set<string>(), dimensions: new Set<string>(),
    }
    if (cause) group.causes.add(cause)
    if (suggestion) group.suggestions.add(suggestion)
    group.dimensions.add(dimension)
    for (const i of indices) group.cases.add(i)
    for (const entry of evidence) group.links.add(entry)
    findings.set(key, group)
  }
  const scoredCases = items.flatMap((item, index) => item.quality?.status === "complete" ? [{ index, quality: item.quality }] : [])
  const abilityCases = scoredCases.filter(({quality}) => !quality.blocked)
  for (const {index, quality} of abilityCases) {
    for (const dimension of quality.dimensions) for (const loss of dimension.deductions) {
      addFinding(JSON.stringify([dimension.id, loss.severity]), loss.severity, loss.problem, dimension.id,
        [index], loss.evidenceRefs.map(ref => link(index, ref)), loss.cause, loss.suggestion)
    }
  }
  const blockedCases = scoredCases.filter(({quality}) => quality.blocked)
  if (blockedCases.length) {
    addFinding("environment", "high", `${blockedCases.length} ${translate("个用例因环境阻塞全维度计 0 分")}`, translate("环境阻塞"),
      blockedCases.map(entry => entry.index), blockedCases.map(({index,quality}) =>
        `${link(index, quality.dimensions[0]?.deductions[0]?.evidenceRefs[0] ?? "")} · ${escape(quality.dimensions[0]?.reason ?? "")}`),
      translate("评测环境或被测服务运行异常"), translate("修复环境后重新运行受影响用例"))
  }
  const failedCases = abilityCases.filter(({quality}) => quality.score < 60)
  if (failedCases.length) {
    addFinding("failed", "high", `${failedCases.length} ${translate("个用例总分未达 60 分")}`, translate("综合得分"),
      failedCases.map(entry => entry.index), failedCases.map(({index,quality}) => `${link(index, "")} · ${quality.score}/100`),
      translate("用例质量得分未达到及格线"), translate("查看逐例薄弱维度并修复后复测"))
  }
  const abilityDimensions = rubric.flatMap(([id, label, max]) => {
    const cases = abilityCases.flatMap(entry => {
      const dimension = entry.quality.dimensions.find(d => d.id === id)
      return dimension ? [{...entry, score: dimension.score}] : []
    })
    if (!cases.length) return []
    const average = cases.reduce((total, entry) => total + entry.score, 0) / cases.length
    return [{id, label, max, average, rate: average / max, cases}]
  })
  for (const dimension of abilityDimensions) {
    if (dimension.rate >= 0.7) continue
    const critical = dimension.rate < 0.5
    addFinding(`dimension-${dimension.id}`, critical ? "medium" : "low",
      `${translate(critical ? "系统性短板" : "维度待提升")} · ${dimension.id} ${translate(dimension.label)} · ${(dimension.rate * 100).toFixed(1)}%`,
      dimension.id, dimension.cases.map(entry => entry.index),
      [`${t("平均分")} ${dimension.average.toFixed(2)}/${dimension.max}`],
      translate("该维度平均得分偏低"), translate("对照高低分用例的扣分证据，优先修复重复问题"))
  }
  const detail=(i:number)=>{
    const item=items[i]
    const observed=metrics(item.evidence,item.executionCredits)
    const metricTable = (offset:number) => `<table class="perf-record-table"><tbody>${reportMetricLabels.slice(offset,offset+9).map((label,n)=>`<tr><td>${t(label)}</td><td class="val">${displayMetric(observed[offset+n],offset+n,true)}</td></tr>`).join("")}</tbody></table>`
    const perf = `<h4>② ${t("通用执行性能记录")}<span class="record-banner">${t("仅记录实际数据，不参与评分")}</span></h4><div class="grid-2">${metricTable(0)}${metricTable(9)}</div>`
    const qualityHeading = `<h4>③ ${t("场景业务质量评分明细（8维度 / 100分 / 单次LLM Judge）")}</h4>`
    const q=item.quality
    if(q?.status!=="complete") {
      const status = scoringStatus(item) ?? "not_scored"
      if (status !== "scoring_failed" || q?.status !== "incomplete")
        return `${perf}${qualityHeading}<p>${t(scoringLabels[status])}${q?.status === "incomplete" ? " · " + t(q.reason) : ""}</p>`
      const reason = scoringFailureReason(q.reason, translate)
      return `${perf}${qualityHeading}<div class="quality-warning" role="status"><strong>${t(scoringLabels.scoring_failed)}</strong>${reason ? `<p>${escape(reason)}</p>` : ""}</div>`
    }
    const rows = q.dimensions.map(dim => {
      const descriptor = rubric.find(([id])=>id===dim.id)
      const max = descriptor?.[2] ?? 0
      const pct = max ? dim.score/max*100 : 0
      return `<tr><td style="text-align:left;font-weight:600">${escape(dim.id)} ${t(descriptor?.[1] ?? "")}</td><td>${max}</td><td>${dim.score}</td><td>${pct.toFixed(1)}%</td><td><span class="grade grade-${grade(pct)}">${grade(pct)}</span></td><td class="explanation">${escape(dim.reason)}</td></tr>`
    }).join("")
    const deductions = q.dimensions.map(dim => `<div class="deduction-block"><div class="deduction-head"><span>${escape(dim.id)} ${t(rubric.find(([id])=>id===dim.id)?.[1] ?? "")}</span><span class="score-chip">${dim.score}/${rubric.find(([id])=>id===dim.id)?.[2] ?? "—"}</span>${dim.deductions.length ? `<span style="font-size:11px;color:var(--danger);font-weight:600">扣分点 × ${dim.deductions.length}</span>` : '<span style="font-size:11px;color:var(--success);font-weight:600">无扣分</span>'}</div><div class="deduction-body"><div class="deduction-explain"><b>得分说明：</b>${escape(dim.reason)}</div>${dim.deductions.length ? dim.deductions.map(loss=>`<div class="deduction-item"><span class="deduct-badge">扣 ${loss.points.toFixed(1)} 分</span><span class="deduct-point">扣分点：${escape(loss.problem)}</span><div class="deduct-evidence"><b>扣分证据：</b>${loss.evidenceRefs.map(ref=>link(i,ref)).join("、")}</div></div>`).join("") : '<div class="deduction-item none">无扣分点（该维度表现符合标尺要求）。</div>'}</div></div>`).join("")
    const issues = q.dimensions.flatMap(dim=>dim.deductions.map(loss=>({dim,loss}))).map(({dim,loss})=>{
      const priority = ({high:"P0",medium:"P1",low:"P2"} as Record<string,string>)[loss.severity] ?? escape(loss.severity)
      return `<div class="case-issue ${priority.toLowerCase()}"><div class="case-issue-title"><span class="priority-badge priority-${priority}">${priority}</span> ${escape(loss.problem)}</div><div class="case-issue-meta">关联维度：${escape(dim.id)} ${t(rubric.find(([id])=>id===dim.id)?.[1] ?? "")}</div><div><b>证据：</b>${loss.evidenceRefs.map(ref=>link(i,ref)).join("、") || "—"}</div><div><b>根因分析：</b>${escape(loss.cause)}</div><div><b>修改建议：</b>${escape(loss.suggestion)}</div></div>`}).join("")
    return `${perf}${qualityHeading}<div class="table-wrap"><table class="dim-detail-table"><thead><tr>${["评测维度","满分","得分","得分率","等级","得分说明"].map(text=>`<th>${t(text)}</th>`).join("")}</tr></thead><tbody>${rows}${totalRow(q.score.toFixed(1),q.grade)}</tbody></table></div><h4>④ ${t("逐维度扣分点与扣分证据")}</h4>${deductions}${issues ? `<h4>⑤ ${t("该用例问题清单")}</h4>`+issues : ""}`

  }
  const averages = rubric.map(([id, label, max]) => {
    const scores = scored.flatMap(q => q.dimensions.filter(d => d.id === id).map(d => d.score))
    const avg = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : null
    return {id, label:label.replace("Skill ", "Skill"), max, value:avg?.toFixed(1) ?? "—",
      pct:avg === null ? null : Number((100 * avg / max).toFixed(1)),
      count:scores.length, strong:scores.filter(score => score >= max * 0.9).length}
  })
  const grade = qualityGrade
  const qualityAverage = averageQuality(items)
  const average = qualityAverage.score?.toFixed(1) ?? "—"
  const rank = qualityAverage.grade ?? "—"
  const gradeClass = (value:string) => value === "—" ? "grade-none" : "grade-" + value
  function totalRow(score:string, rank:string) {
    return `<tr class="total-row"><td style="text-align:left">${t("质量总分")}</td><td colspan="3"></td><td><span class="grade ${gradeClass(rank)}">${escape(rank)}</span></td><td style="text-align:left;font-size:12px">${score}/100（通用执行性能不参与）</td></tr>`
  }
  const canvas = (id:string, config:object) => `<canvas role="img" aria-label="${t(id==="radarQualityChart"?"八维得分率，明细见各维度得分表":"逐用例质量总分，明细见逐例评测详情")}" id="${id}" data-chart="${escape(JSON.stringify(config))}"></canvas>`
  const incomplete = items.filter(item => scoringStatus(item) === "scoring_failed")
  const timedOut = incomplete.filter(item => item.quality?.status === "incomplete" && /timeout|timed out/i.test(item.quality.reason))
  const emptyChart = `<p class="muted" role="status">${t("暂无八维评分数据")} · ${t("已评分")} 0/${items.length}${timedOut.length ? `<br>${t("评分服务超时")}（${timedOut.length} ${t("条用例")}）` : incomplete.length ? `<br>${t(scoringLabels.scoring_failed)}（${incomplete.length} ${t("条用例")}）` : ""}</p>`
  const missingScores = items.flatMap((item,i) => item.quality?.status === "complete" ? [] : [
    `<a href="#case-${i}">${escape(evaluationCaseCode(item))}</a>`,
  ])
  const partialNotice = scored.length && missingScores.length
    ? `<p class="muted" role="status">${t("已评分")} ${scored.length}/${items.length} · ${t("尚无质量分")}：${missingScores.join("、")}</p>` : ""
  const radarLabel = (label: string) => {
    const join = label.indexOf("与")
    return label.length > 6 && join > 0 ? [label.slice(0, join + 1), label.slice(join + 1)] : label
  }
  const radar = canvas("radarQualityChart", {
    type:"radar", data:{labels:averages.map(d=>radarLabel(d.label.replace("Skill ","Skill"))), datasets:[{
      label:"质量得分率", data:averages.map(d=>d.pct),
      backgroundColor:"rgba(49,103,234,0.12)",borderColor:"#3167ea",pointBackgroundColor:"#3167ea",borderWidth:2
    }]}, options:{responsive:true,maintainAspectRatio:true,layout:{padding:8},scales:{r:{
      beginAtZero:true,max:100,ticks:{stepSize:20,font:{size:11}},pointLabels:{font:{size:11},padding:6}
    }},plugins:{legend:{display:false}}}
  })
  const colors:Record<string,string> = {S:"#008966",A:"#3167ea",B:"#00869d",C:"#b87908",D:"#d24b72"}
  const bars = canvas("caseBarChart", {type:"bar", data:{labels:items.map(evaluationCaseCode), datasets:[{
    label:"质量总分",data:items.map(item=>item.quality?.status==="complete"?item.quality.score:null),
    backgroundColor:items.map(item=>item.quality?.status==="complete"?colors[item.quality.grade]:"#999"),borderRadius:4
  }]},options:{indexAxis:"y",maintainAspectRatio:false,scales:{x:{beginAtZero:true,max:100}},plugins:{legend:{display:false}}}})
  const qualityOverview = `<div class="card" id="dimensions"><h3 style="margin-top:0">${t("场景业务质量各维度得分（100分制）")}</h3><div class="table-wrap"><table>
    <thead><tr><th style="text-align:left">${t("评测维度")}</th><th>${t("均分")}</th><th>${t("满分")}</th><th>${t("得分率")}</th><th>${t("等级")}</th><th style="text-align:left">${t("概要说明")}</th></tr></thead><tbody>
    <tr style="background:var(--bg)"><td colspan="6" style="text-align:left;font-weight:600;color:var(--text-secondary)">场景业务质量 (100分) · LLM Judge 单次评分</td></tr>
    ${averages.map(d=>`<tr><td style="text-align:left;padding-left:20px">${d.id} ${t(d.label)}</td><td>${d.value}</td><td>${d.max}</td><td>${d.pct?.toFixed(1) ?? "—"}${d.pct===null?"":"%"}</td><td>${d.pct===null?"—":`<span class="grade grade-${grade(d.pct)}">${grade(d.pct)}</span>`}</td><td style="text-align:left;font-size:12px;color:var(--text-secondary)">${d.count?`${d.strong}/${d.count} ${t("个用例的本维度得分达到满分的 90% 或以上")}`:"—"}</td></tr>`).join("")}
    ${totalRow(average,rank)}</tbody></table></div>
    <p class="summary-note">${t("各维度仅统计已有完整质量评分且有该维度分数的用例。环境阻塞用例按 0 分计入。")}</p></div>
    <div class="grid-2" id="radar" style="scroll-margin-top:16px"><div class="card"><h3 style="margin-top:0">${t("场景业务质量雷达（8维度得分率）")}</h3>${scored.length ? `<div class="chart-container-centered">${radar}</div>` : emptyChart}</div>
    <div class="card"><h3 style="margin-top:0">${t("逐用例质量总分")}</h3>${scored.length ? `<div class="chart-container" style="height:${Math.min(420, Math.max(120, items.length * 24 + 36))}px">${bars}</div>${partialNotice}` : emptyChart}</div></div>`
  const blocked = scored.filter(q=>q.blocked).length
  const unblocked = scored.filter(q => !q.blocked)
  const adjusted = blocked ? `<p>${t("环境阻塞")} ${blocked} ${t("条用例")} · ${t("剔除阻塞后均分")} ${unblocked.length ? mean(unblocked.map(q=>q.score)) : t("无可统计用例")}</p>` : ""
  const counts = outcomeCounts(items)
  const rate = passRate(items)
  const rateText = rate === null ? "—" : `${(rate * 100).toFixed(1)}%`
  const observed = items.map(item => metrics(item.evidence, item.executionCredits))
  const averageMetric = (index: number, unit: string, divisor = 1) => {
    const values = observed.flatMap(row => {
      // 平台逐例表对无工具调用显示 100%，汇总使用采集值 0%。
      const value = index === 12 && row[11] === 0 ? 0 : row[index]
      return value !== undefined && Number.isFinite(value) && value >= 0 ? [value / divisor] : []
    })
    return `<b>${values.length ? mean(values) + unit : "—"}</b><span class="summary-note">（${t("仅记录")}）${values.length < items.length ? ` · ${t("有效记录")} ${values.length}/${items.length}` : ""}</span>`
  }
  // 平台亮点按八维顺序挑选，剔除环境阻塞；阈值判断使用未舍入均值。
  const strengthCases = abilityCases.map(entry => ({...entry, item: items[entry.index]}))
  const strengthDimensions = abilityDimensions.filter(d => d.rate >= 0.9).map(d => ({
    id: d.id, label: d.label.replace("Skill ", "Skill"), max: d.max,
    value: Number(d.average.toFixed(2)), pct: d.rate * 100, count: d.cases.length,
    cases: d.cases.filter(entry => entry.score >= d.max * 0.9).map(entry => ({...entry, item: items[entry.index]})),
  }))
  const strengthLink = (entry: {item:typeof items[number]; index:number}) => `<a href="#case-${entry.index}">${escape(evaluationCaseCode(entry.item))}</a>`
  const strengthNote = blocked ? ` · ${t("亮点统计已剔除环境阻塞用例")} ${blocked}` : ""
  const strengthCards = strengthDimensions.map(d => `<div class="strength-card">
    <div class="strength-card-title">${escape(d.id)} ${t(d.label)}：${t("平均分")} ${d.value}/${d.max}，${t("得分率")} ${d.pct.toFixed(1)}%，${t("表现稳定优秀")}</div>
    <div class="strength-card-evidence">${d.cases.length}/${d.count} ${t("个用例的本维度得分达到满分的 90% 或以上")}${strengthNote}${d.count < strengthCases.length ? ` · ${t("有效维度评分")} ${d.count}/${strengthCases.length}` : ""}
    ${d.cases.length ? `<br>${t("关联用例")}：${d.cases.slice(0,5).map(strengthLink).join("、")}${d.cases.length > 5 ? ` · ${t("更多用例见逐例评测详情")}` : ""}` : ""}</div></div>`)
  const benchmarks = strengthCases.filter(entry => entry.quality.score >= 90)
  if (benchmarks.length) strengthCards.push(`<div class="strength-card"><div class="strength-card-title">${t("S级标杆用例（≥90分）")}：${benchmarks.length}</div><div class="strength-card-evidence">${benchmarks.map(entry => `${strengthLink(entry)}（${entry.quality.score}/100）`).join("、")}${strengthNote}</div></div>`)
  const scoringSummary = Object.entries(scoringLabels).flatMap(([status, label]) => {
    const count = items.filter(item => scoringStatus(item) === status).length
    return count ? [`${t(label)} ${count}`] : []
  }).join(" · ")
  const strengths = `${counts.unscored ? `<p class="summary-status" role="status">${t("已评分")} ${scored.length}/${items.length} · ${t("当前结论仅基于已评分用例。")}</p>` : ""}${strengthCards.slice(0,3).join("") || `<p class="card muted">${t("暂未识别到显著优势。")}${strengthNote}</p>`}`
  const highlights = strengthDimensions.slice(0,2)
  const priorities = ["high", "medium", "low"] as const
  const summaryFindings = priorities.flatMap(severity => {
    const groups = [...findings.values()].filter(g => g.severity === severity)
    if (!groups.length) return []
    return [`<li><b>${{high:"P0",medium:"P1",low:"P2"}[severity]} · ${t("问题数")} ${groups.length}</b>：${escape([...groups[0].causes][0] ?? "")}${groups[0].suggestions.size ? `；${t("改进建议")}：${escape([...groups[0].suggestions][0])}` : ""}</li>`]
  }).join("")
  const summary = `<div class="executive-summary"><div class="summary-heading"><span class="grade grade-lg ${gradeClass(rank)}">${rank}</span><div class="summary-content">
    <div style="font-size:20px;font-weight:700">${t("综合得分")} ${average} <span style="font-size:13px;font-weight:400;color:var(--text-secondary)">/ 100（${t("场景业务质量")}）</span></div>
    <div class="summary-metrics"><span>${t("通过")} <b class="summary-pass">${counts.pass}/${scored.length}</b></span><span>${t("质量均分")} <b>${scored.length ? average + "/100" : "—"}</b></span><span>${t("通过率")} <b>${rateText}</b></span><span class="summary-performance">${t("平均E2E耗时")} ${averageMetric(0,"s",1000)}</span><span class="summary-performance">${t("平均工具成功率")} ${averageMetric(12,"%")}</span></div></div></div>
    <p class="summary-status${counts.unscored ? " summary-pending" : ""}"${counts.unscored ? ' role="status"' : ""}>${t("已评分")} ${scored.length}/${items.length} · ${t("未通过")} ${counts.fail} · ${t("环境阻塞")} ${counts.blocked}${counts.unscored ? `${scoringSummary ? " · " + scoringSummary : ""} · ${t("当前结论仅基于已评分用例。")}` : ""}</p>${adjusted}
    <p>${scored.length ? `${t("本次评测结论")}：${t("场景业务质量")} ${rank} · ${t("质量均分")} ${average}/100；${t("已评分")} ${scored.length}/${items.length}，${t("通过")} ${counts.pass}/${scored.length}，${t("通过率")} ${rateText}（${t("通过标准：质量总分≥60，且非环境阻塞。")}）` : t("暂无已完成的质量评分，暂不生成评测结论。")}</p>
    ${scored.length === 1 && scored[0].analysis ? `<p>${escape(scored[0].analysis.conclusion)}</p>` : ""}
    ${summaryFindings ? `<ul class="summary-findings">${summaryFindings}</ul>` : ""}
    ${highlights.length ? `<p>${t("优势维度")}：${highlights.map(d => `${escape(d.id)} ${t(d.label)} ${d.value.toFixed(1)}/${d.max}`).join("；")}</p>` : ""}
    <p class="summary-note">${t("综合得分与等级由场景业务质量八维评分判定。通用执行性能指标只作实际数据记录。")}</p>
    <p class="summary-note">${t("质量统计基于已评分用例，环境阻塞按0分计入；性能均值基于有效记录。无工具调用时，逐例工具成功率显示100%，汇总按0%计。")}</p></div>`
  const performance = `<div class="card" id="metrics" style="scroll-margin-top:16px;">
<h3 class="metrics-heading">
    <span>${t("全用例性能指标记录总表")}</span>
    <span class="record-banner">${t("仅记录实际数据，不评分、不评级")}</span>
</h3>
<p style="font-size:12px; color:var(--text-secondary); margin-bottom:14px;">以下18项通用执行性能指标来自本次用例执行记录（口径见4.3），可左右滑动查看全部列；表中等级由场景业务质量得分判定。</p>
<div style="overflow-x:auto; -webkit-overflow-scrolling:touch;">
<table class="raw-data-table" style="min-width:1350px; font-size:12px; white-space:nowrap;">
<thead>
<tr>
<th style="text-align:left; position:sticky; left:0; background:var(--primary-tint); z-index:2; min-width:70px;">用例ID</th>
<th style="min-width:40px;">${t("等级")}</th>
<th style="min-width:62px;">E2E耗时(s)</th>
<th style="min-width:62px;">TTFT(s)</th>
<th style="min-width:62px;">LLM耗时(s)</th>
<th style="min-width:62px;">网络耗时(s)</th>
<th style="min-width:62px;">turn耗时(s)</th>
<th style="min-width:62px;">上下文Token</th>
<th style="min-width:62px;">输出Token</th>
<th style="min-width:62px;">总Token</th>
<th style="min-width:62px;">点数消耗(点)</th>
<th style="min-width:62px;">缓存率(%)</th>
<th style="min-width:62px;">LLM次数</th>
<th style="min-width:62px;">工具次数</th>
<th style="min-width:62px;">工具成功率(%)</th>
<th style="min-width:62px;">平均工具耗时(s)</th>
<th style="min-width:62px;">工具总耗时(s)</th>
<th style="min-width:62px;">round数</th>
<th style="min-width:62px;">turn数</th>
<th style="min-width:62px;">错误恢复率(%)</th>
</tr>
</thead>
<tbody>${items.map((item,i)=>`<tr><td style="text-align:left;position:sticky;left:0;background:var(--card-bg);z-index:1;font-weight:600"><a class="raw-table-link" style="text-decoration:none" href="#case-${i}">${escape(evaluationCaseCode(item))}</a></td><td>${item.quality?.status==="complete"?`<span class="grade grade-${escape(item.quality.grade)}">${escape(item.quality.grade)}</span>`:"—"}</td>${metrics(item.evidence,item.executionCredits).map((v,n)=>`<td>${displayMetric(v,n)}</td>`).join("")}</tr>`).join("")}</tbody>
</table>
</div>
</div>`
  const issueGroups = priorities.flatMap((severity, index) => {
    const groups = [...findings.values()].filter(group => group.severity === severity)
    return groups.length ? [{groups, priority: `P${index}`}] : []
  })
  const issueStats = issueGroups.map(({groups, priority}) =>
    `<button type="button" class="issue-stat-chip chip-${priority.toLowerCase()}" data-issue-filter="${priority}" aria-pressed="false">${priority} × ${groups.length}</button>`).join("")
  const issueCards = issueGroups.flatMap(({groups, priority}) => groups.map(group =>
    `<details class="issue-card" data-issue-priority="${priority}"><summary class="issue-card-header"><span class="priority-badge priority-${priority}">${priority}</span>
    <span><b class="issue-card-title">${escape(group.problem)}</b><span class="issue-card-cases">${[...group.cases].map((i, index) => `<span class="issue-card-case-code">${escape(evaluationCaseCode(items[i]))}${index < group.cases.size - 1 ? "、" : ""}</span>`).join("")}</span></span></summary>
    <div class="report-issue-body"><div><b>${t("涉及维度")}：</b>${[...group.dimensions].map(id => `${escape(id)} ${t(rubric.find(d => d[0] === id)?.[1] ?? "")}`).join(" / ")}</div>
    <div><b>${t("具体证据")}：</b>${[...group.links].join("、") || "—"}</div>
    <div><b>${t("根因分析")}：</b>${[...group.causes].map(escape).join(" / ")}</div>
    <div><b>${t("修改建议")}：</b>${[...group.suggestions].map(escape).join(" / ")}</div></div></details>`)).join("")
  return {detail,qualityOverview,performance,summary,
    issues: issueCards ? `<div class="issue-stats"><button type="button" class="issue-stat-chip" data-issue-filter="all" aria-pressed="true">${t("全部问题")} × ${findings.size}</button>${issueStats}</div>${issueCards}` : "",
    strengths,
    rules:foundationQualityScale+`<details class="rule-section"><summary id="performance-rules">4.3 通用执行性能指标口径（仅记录，不评分）</summary><div class="card"><h3>通用执行性能<span class="record-banner">仅记录</span></h3><table><thead><tr><th>指标</th><th>统计口径（提取方式）</th></tr></thead><tbody>${reportMetricLabels.map((label,i)=>`<tr><td>${t(label)}</td><td>${t(metricDefinitions[i])}</td></tr>`).join("")}</tbody></table></div></details>`}
}
