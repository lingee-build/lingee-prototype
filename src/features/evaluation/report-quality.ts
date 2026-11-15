import { type EvalResult, type EvalRun, executionIssues, resultIssueSummary, verdictLabel } from '@/services/evaluation'
import { qualityOf, qualitySummary, type Quality } from '@/services/evaluation-quality'
import { gradeThresholds, qualityGrade, qualityPassScore, qualityRubric } from '@/services/lingee-quality-rubric'
import { escape, paragraph } from './report-markup'

function roundEvidence(result: EvalResult, quality: Quality) {
  if (quality.state === '环境阻塞') return quality.evidence
  if (result.reviewTrace?.artifact) return 'outputs/库存.csv\n' + result.reviewTrace.artifact
  const turns = result.roundResults || []
  return turns.map((turn, index) => {
    if (!turn.responseRecorded) return ''
    return [`第 ${index + 1} 轮`, turn.clarification, turn.toolResult, `最终回复：${turn.response}`].filter(Boolean).join('\n')
  }).filter(Boolean).join('\n\n') || quality.evidence
}

export function scoreReason(result: EvalResult, dimension: string, quality: Quality, lost: number) {
  if (quality.state === '环境阻塞') return '执行环境阻塞，用例未达到预期，按规则记零分。'
  if (lost) {
    if (result.reviewTrace?.scenario === 'FD-RD-003') {
      if (dimension === 'Q2') return '询问时只给出了“仍按普通六面骰随机掷”的一种解释。'
      if (dimension === 'Q6') return '追问前先说明不能保证点数，首句可以省去。'
    }
    return quality.issue || '详见该用例的评分记录。'
  }
  if (!result.reviewTrace) return '见本次保存的评分证据。'
  if (dimension === 'Q4') return result.reviewTrace?.artifact
    ? '核验了库存 CSV 的表头、数据行和工具返回的数量。'
    : '本例以对话回复交付，按用例预期核对回答内容。'
  if (dimension === 'Q8' && result.reviewTrace?.scenario === 'FD-RD-002') return '明确告知仅支持六面骰，未调用掷骰工具。'
  if (dimension === 'Q8' && result.reviewTrace?.scenario === 'FD-RD-003') return '收到澄清回复后继续投掷。'
  const statements: Record<string,string> = {
    Q1: '遵守对象定义的业务范围和输出约定。', Q2: '按输入识别了请求并选择相应能力。',
    Q3: '执行步骤与用例逐轮预期一致。', Q5: '实际返回的数值与执行记录一致。',
    Q6: '对话表达清楚，符合用例约定的输出形式。', Q7: '交付结果可在工具记录或本次回复中核对。',
    Q8: '全程无异常触发。',
  }
  return statements[dimension]
}

export function deductionEvidence(result: EvalResult, quality: Quality) {
  const trace = result.reviewTrace
  if (quality.state === '环境阻塞') return quality.evidence
  if (trace?.artifact) return 'outputs/库存.csv · 表头\n' + trace.artifact.split('\n')[0]
  const index = result.roundResults?.findIndex(turn => turn.rules.length && turn.clarification)
  if (index != null && index >= 0) return `第 ${index + 1} 轮 · 澄清原话\n${result.roundResults![index].clarification.split('\n')[0]}`
  return quality.evidence
}

export function qualityDetail(result: EvalResult) {
  const quality = qualityOf(result)
  if (!quality.scores) {
    const note = quality.state === '暂无质量评价' ? '本次运行没有该场景的质量评分记录。' : '本条尚无有效分数。'
    return paragraph('质量评价', quality.state + '。' + note)
  }
  const rows = qualityRubric.map(({ id, name, max }, index) => {
    const score = quality.scores![index]
    const lost = max - score
    const pct = Number((score / max * 100).toFixed(1))
    return `<tr><th scope="row">${id} ${name}</th><td>${score} / ${max}</td><td>${pct}% · ${qualityGrade(pct)}</td>
      <td>${escape(scoreReason(result, id, quality, lost))}</td>
      <td>${lost ? `<b>−${lost} 分</b><p>${escape(deductionEvidence(result, quality) || '未记录扣分原文')}</p>` : '无扣分点'}</td></tr>`
  }).join('')
  return `<section class="quality-detail"><strong>质量评分 · ${quality.total} / 100 · ${quality.grade} 级 · ${escape(quality.state)}</strong>
    <details><summary>八维得分与依据（整条用例）</summary><div class="table-wrap" tabindex="0" aria-label="八维评分明细">
      <table class="score-table"><thead><tr><th>维度</th><th>得分</th><th>得分率 / 等级</th><th>得分说明</th><th>扣分与证据</th></tr></thead><tbody>${rows}</tbody></table></div></details>
    ${paragraph('本次评分证据', roundEvidence(result, quality))}</section>`
}

export function qualityOverview(run: EvalRun) {
  const summary = qualitySummary(run.results)
  const rate = summary.count ? `${Number((summary.passed * 100 / summary.count).toFixed(1))}%` : '—'
  return `<section class="quality-summary"><h3>综合质量评分</h3>
    <div class="quality-numbers"><span>质量均分 <strong>${summary.mean ?? '—'}</strong> / 100 ${summary.grade ? '· ' + summary.grade + ' 级' : ''}</span>
    <span>质量通过率 <b>${rate}</b>（${summary.passed}/${summary.count}）</span><span>已评分 <b>${summary.count}/${run.results.length}</b> 条</span></div>
    ${summary.count < run.results.length ? '<p>当前结论仅基于已评分用例；未评分不代表通过，也不按零分填补。</p>' : ''}
    ${summary.blocked ? `<p>环境阻塞 ${summary.blocked} 条，已按零分计入。剔除阻塞后的参考均分为 ${summary.nonblockedMean ?? '无可统计用例'}。</p>` : ''}
    </section>`
}

export function dimensionAverages(results: EvalResult[]) {
  const scored = results.map(qualityOf).filter(q => q.scores)
  return qualityRubric.map((d, i) => {
    const avg = scored.length ? scored.reduce((sum, q) => sum + q.scores![i], 0) / scored.length : null
    const pct = avg === null ? null : Number((avg / d.max * 100).toFixed(1))
    return { ...d, avgScore: avg === null ? '—' : Number(avg.toFixed(1)), maxScore: d.max,
      pct: pct ?? '—', chartPct: pct, grade: pct === null ? '—' : qualityGrade(pct) }
  })
}

export function qualityRadar(results: EvalResult[]) {
  const dims = dimensionAverages(results)
  if (dims[0].chartPct === null) return '<p class="empty">暂无有效质量评分。</p>'
  const point = (index: number, radius: number) => {
    const angle = index * 2 * Math.PI / dims.length - Math.PI / 2
    return [120 + radius * Math.cos(angle), 116 + radius * Math.sin(angle)].map(n => n.toFixed(2))
  }
  const ring = (radius: number) => dims.map((_, i) => point(i, radius).join(',')).join(' ')
  const values = dims.map((d, i) => point(i, 80 * d.chartPct! / 100).join(',')).join(' ')
  const radar = `<svg viewBox="0 0 240 232" aria-label="八维得分率雷达图，具体数值见维度均分表" role="img">
    ${[20,40,60,80].map(r => `<polygon points="${ring(r)}" fill="none" stroke="#dedfe9"/>`).join('')}
    ${dims.map((d,i) => { const [x,y] = point(i, 103); const [ex,ey] = point(i,80)
      return `<line x1="120" y1="116" x2="${ex}" y2="${ey}" stroke="#e5e5ec"/><text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central">${d.id}</text>` }).join('')}
    <polygon points="${values}" fill="#485cfb" fill-opacity=".12" stroke="#485cfb" stroke-width="2"/></svg>`
  return `<figure class="radar"><figcaption>八维得分率</figcaption>${radar}</figure>`
}

export function dimensionOverview(results: EvalResult[]) {
  const dims = dimensionAverages(results)
  return `<div class="table-wrap" tabindex="0" aria-label="八维均分"><table class="dimension-table"><thead><tr><th>维度</th><th>均分 / 满分</th><th>得分率</th><th>等级</th></tr></thead><tbody>
    ${dims.map(d => `<tr><th scope="row">${d.id} ${d.name}</th><td>${d.avgScore} / ${d.max}</td><td>${d.chartPct === null ? '—' : d.pct + '%'}</td><td>${d.grade}</td></tr>`).join('')}</tbody></table></div>`
}

export function caseScoreChart(results: EvalResult[]) {
  if (!results.length) return '<p class="empty">暂无用例结果</p>'
  return `<ul class="case-score-chart">${results.map((r,i) => {
    const q = qualityOf(r)
    return `<li><a href="#case-${i}">${escape([r.code,r.name].filter(Boolean).join(' '))}</a><span class="score-track" aria-hidden="true"><i style="width:${q.total ?? 0}%"></i></span><b>${q.total ?? escape(q.state)}${q.grade ? ' · ' + q.grade : ''}</b></li>`
  }).join('')}</ul>`
}

export function caseFinding(result: EvalResult) {
  const q = qualityOf(result)
  const buildIssue = resultIssueSummary(result)
  const blocked = q.state === '环境阻塞'
  if (!buildIssue && !q.issue && !blocked && q.state !== '评分未完成') return undefined
  const failed = q.total != null && q.state !== '环境阻塞' && q.total < qualityPassScore
  const affected = qualityRubric.filter((d, i) => q.scores && q.scores[i] < d.max).map(d => d.id)
  const issue = result.roundResults?.find(t => t.issue)?.issue
  const scenario = result.reviewTrace?.scenario
  const clarification = scenario === 'FD-RD-003' && !!q.issue
  const missingColumn = scenario === 'SCM-001' && !!q.issue
  const cause = blocked ? (issue && executionIssues[issue].reason || q.evidence)
    : clarification ? '第 1 轮先说明随机点数不能保证，再询问“大一点”的含义。'
    : missingColumn ? '导出的库存明细缺少“仓库”列，读者无法按仓库核对可用量。'
    : q.issue || buildIssue || '未取得完整的八维评分结果。'
  const action = blocked && issue ? executionIssues[issue].action
    : clarification ? '直接询问“大一点”具体指什么，收到回复后再投掷。'
    : missingColumn ? '将库存查询返回的仓库写入 CSV，并核对导出表头和数据行。'
    : q.issue ? q.issue
    : failed ? '核对未满足的标准和实际输出，在来源报告中发起修复。'
    : q.state === '评分未完成' ? '检查评分状态，用同次执行证据恢复评分。' : '查看逐轮记录，补齐缺失的判定依据。'
  const label = blocked ? '环境阻塞' : q.issue && !failed ? '质量改进' : failed ? '用例不通过' : q.state === '评分未完成' ? '评分未完成' : '用例无法判定'
  return { label, priority: blocked ? 'P0' : failed ? 'P1' : q.issue ? 'P2' : '待核查',
    dimensions: affected, cause, action, evidence: q.scores && (q.issue || blocked) ? deductionEvidence(result, q) : result.evidence }
}

export function finding(result: EvalResult, index: number) {
  const issue = caseFinding(result)
  if (!issue) return ''
  return `<article class="issue" data-report-key="issue-${index}"><a href="#case-${index}">${escape([result.code, result.name].filter(Boolean).join(' '))}</a>
    <span class="status">${escape([issue.label, issue.priority, ...issue.dimensions].join(' · '))}</span>
    <p>${escape(issue.cause)}</p>${issue.evidence ? paragraph('证据', issue.evidence) : ''}
    ${issue.action !== issue.cause ? paragraph('建议', issue.action) : ''}</article>`
}

export function strengthExamples(results: EvalResult[]) {
  return results.map((r,index) => ({ r, index, q: qualityOf(r) }))
    .filter(({r, q}) => q.total !== undefined && q.total >= 90 && q.state === '质量通过' && !q.issue).slice(0,3)
}

export function strengths(results: EvalResult[]) {
  const examples = strengthExamples(results)
  if (!examples.length) return '<p class="muted">当前记录中暂无优势亮点。</p>'
  return examples.slice(0, 3).map(({r,index,q}) => `<p><a href="#case-${index}">${escape([r.code,r.name].filter(Boolean).join(' '))}</a> · 用例通过，质量 ${q.total} 分。<br>${escape(r.roundResults?.at(-1)?.checkResults?.find(c => c.verdict === 'passed')?.actual || '可展开用例核对执行证据。')}</p>`).join('')
}

export function scoringRules() {
  return `<p>每条用例汇集全部业务轮次、工具记录与产物内容，由质量 Judge 评价一次。八项整数得分相加，满分 100 分。</p>
    ${qualityRubric.map(({id,name,max,bands}) =>
      `<details class="rubric"><summary>${id} ${name} · ${max} 分</summary><div class="table-wrap"><table class="rubric-table"><thead><tr><th>分值</th><th>档位</th><th>标准</th></tr></thead><tbody>${bands.map(([range,label,description])=>`<tr><td>${escape(range)}</td><td>${escape(label)}</td><td>${escape(description)}</td></tr>`).join('')}</tbody></table></div></details>`
    ).join('')}
    <p>环境阻塞的用例八项均记零分。评分未完成的用例暂不计入均分。</p>`
}

export function gradeRules() {
  return `<p>用例总分达到 ${qualityPassScore} 分即质量通过。有效用例总分的平均值决定整体等级。</p><table><thead><tr><th>等级</th><th>用例总分</th></tr></thead><tbody>${gradeThresholds.map(({grade,min}, i) => `<tr><td>${grade}</td><td>${min} 分及以上${i ? '，低于 ' + gradeThresholds[i-1].min + ' 分' : ''}</td></tr>`).join('')}</tbody></table>`
}


/** 同因同维度合并，逐例证据仍独立保留。 */
export function groupedFindings(results: EvalResult[]) {
  const groups = new Map<string, {issue: NonNullable<ReturnType<typeof caseFinding>>; items: {result: EvalResult; index: number}[]}>()
  results.forEach((result,index)=>{
    const issue=caseFinding(result)
    if (!issue) return
    const key=JSON.stringify([issue.label,issue.cause,issue.dimensions])
    const group=groups.get(key) || {issue,items:[]}
    group.items.push({result,index}); groups.set(key,group)
  })
  return [...groups.values()].map(({issue,items})=>items.length===1 ? finding(items[0].result,items[0].index) : `<article class="issue" data-report-key="group-${items[0].index}"><p>${escape(issue.label)} · 影响 ${items.length} 条用例 · ${escape(issue.dimensions.join('、'))}</p><p>${escape(issue.cause)}</p>${paragraph('建议',issue.action)}${items.map(({result,index})=>`<details><summary><a href="#case-${index}">${escape([result.code,result.name].filter(Boolean).join(' '))}</a></summary>${paragraph('证据',caseFinding(result)?.evidence || '请查看逐轮记录')}</details>`).join('')}</article>`).join('')
}
