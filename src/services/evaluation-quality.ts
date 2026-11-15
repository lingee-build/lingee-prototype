import type { EvalResult } from './evaluation'
import { issueText } from '../mock/evaluation/review'
import { qualityGrade, qualityPassScore, qualityRubric } from './lingee-quality-rubric'

export type Quality = {
  state: string
  total?: number
  grade?: string
  scores?: number[]
  issue?: string
  evidence: string
}

function summarizeScores(scores: number[], blocked: boolean, evidence: string, issue?: string): Quality {
  const total = scores.reduce((sum, value) => sum + value, 0)
  return {
    state: blocked ? '环境阻塞' : total >= qualityPassScore ? '质量通过' : '质量未通过',
    total, grade: qualityGrade(total), scores, issue, evidence,
  }
}

export function qualityOf(result: EvalResult): Quality {
  const incomplete = (state: string): Quality => ({ state, evidence: '' })
  if (result.quality) {
    const saved = result.quality
    if (!saved.scores && saved.total == null) {
      return ['质量通过', '质量未通过', '环境阻塞'].includes(saved.state) ? incomplete('评分未完成') : saved
    }
    const blocked = saved.state === '环境阻塞'
    const valid = saved.scores?.length === qualityRubric.length && saved.scores.every((score, index) =>
      Number.isInteger(score) && score >= 0 && score <= qualityRubric[index].max && (!blocked || score === 0))
    if (!valid) return incomplete('评分未完成')
    return summarizeScores(saved.scores!, blocked, saved.evidence, saved.issue)
  }
  if (result.judging || ['running', 'pending'].includes(result.status)) return incomplete('待评分')
  if (['cancelled', 'skipped'].includes(result.status)) return incomplete('未完成执行')
  const failure = result.roundResults?.find(turn => turn.issue)?.issue || result.demoFailure
  const blocked = result.status === 'blocked' && ['connection_failed', 'tool_unavailable', 'timeout'].includes(failure || '')
  if (blocked) return summarizeScores(qualityRubric.map(() => 0), true, result.evidence)
  if (result.demoQualityFailure || result.demoJudgingFailure || result.status === 'blocked') return incomplete('评分未完成')
  const trace = result.reviewTrace
  if (!trace) return incomplete('暂无质量评价')
  const evidence = trace.artifact || result.roundResults?.filter(turn => turn.responseRecorded)
    .map((turn, index) => [
      `第 ${index + 1} 轮`, turn.clarification, turn.toolResult, `最终回复：${turn.response}`,
    ].filter(Boolean).join('\n')).join('\n\n') || ''
  if (!result.responseRecorded || !evidence) return incomplete('评分未完成')
  const issue = trace.fixed ? '' : issueText(trace.scenario)
  const deductions: Record<string, number> = trace.scenario === 'SCM-001' ? { Q4: 6 } : { Q2: 2, Q6: 1 }
  const scores = qualityRubric.map(({id, max}) => max - (issue ? deductions[id] || 0 : 0))
  return summarizeScores(scores, false, evidence, issue)
}

export function qualitySummary(results: EvalResult[]) {
  const scored = results.map(qualityOf).filter((q): q is Quality & { total: number } => q.total !== undefined)
  const sum = scored.reduce((total, q) => total + q.total, 0)
  const nonblocked = scored.filter(q => q.state !== '环境阻塞')
  const roundedMean = (count: number) => count ? Number((sum / count).toFixed(1)) : undefined
  return {
    count: scored.length, passed: scored.filter(q => q.total >= qualityPassScore).length,
    mean: roundedMean(scored.length), grade: scored.length ? qualityGrade(sum / scored.length) : undefined,
    blocked: scored.length - nonblocked.length, nonblockedMean: roundedMean(nonblocked.length),
  }
}
