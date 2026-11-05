import { verdictLabel, type EvalRun } from '@/services/evaluation'

export interface ReportContextSelection { runs: EvalRun[]; source: string; error?: string }
/** 报告只属于本轮上下文；显式引用失败时不回退，连续指代保留讨论范围。 */
export function resolveReportContext(text: string, runs: EvalRun[], currentId?: string, previousIds: string[] = []): ReportContextSelection {
  const codes = [...new Set((text.match(/ER-\d+/gi) || []).map(code => `ER-${String(Number(code.slice(3))).padStart(4, '0')}`))]
  const sorted = [...runs].sort((a, b) => b.started - a.started)
  const select = (ids: string[], source: string): ReportContextSelection => {
    const found = ids.map(id => runs.find(run => run.id === id))
    return found.some(run => !run) ? { runs: [], source, error: '引用的报告已不存在，请重新指定当前对象中的报告。' } : { runs: found as EvalRun[], source }
  }
  if (codes.length) {
    const found = codes.map(code => runs.find(run => run.code === code))
    const missing = codes.filter((_, i) => !found[i])
    return missing.length ? { runs: [], source: '指定报告', error: `未找到评测报告 ${missing.join('、')}，请确认当前对象中的编码。` } : { runs: found as EvalRun[], source: '指定报告' }
  }
  if (/全部报告|所有报告/.test(text)) return { runs: sorted, source: '全部报告', ...(!sorted.length ? { error: '当前对象还没有评测报告。' } : {}) }
  const count = text.match(/(?:最新|最近|上次)\s*([两二三四五六七八九十]|\d+)\s*(?:份|次)/)
  if (count || /最新|最近|上次/.test(text)) {
    const amount = count ? (/^\d+$/.test(count[1]) ? Number(count[1]) : count[1] === '两' ? 2 : '一二三四五六七八九十'.indexOf(count[1]) + 1) : 1
    if (amount < 1 || sorted.length < amount) return { runs: [], source: '最近报告', error: `当前对象只有 ${sorted.length} 份报告，请调整查询范围。` }
    return { runs: sorted.slice(0, amount), source: '最近报告' }
  }
  if (/当前(?:打开的)?报告|右侧(?:这份)?报告/.test(text)) return currentId ? select([currentId], '当前页面') : { runs: [], source: '当前页面', error: '当前未打开具体报告，请指定 ER 编码或打开一份报告。' }
  if (currentId) return select([currentId], '当前页面')
  if (/重跑|重新运行|运行|停止|修复/.test(text)) return { runs: [], source: '未指定', error: '请打开或指定要操作的报告（ER 编码）。' }
  if (/这份|这次|该报告|它|刚才|上述|这些|这几份|两份|两次|它们|继续/.test(text) && previousIds.length) {
    if (previousIds.length > 1 && /这份|该报告|它(?!们)/.test(text)) return { runs: [], source: '连续追问', error: '刚才讨论了多份报告，请指定你指的是哪一份（ER 编码）。' }
    return select(previousIds, '连续追问')
  }
  if (currentId) return select([currentId], '当前页面')
  if (previousIds.length) return select(previousIds, '连续追问')
  return { runs: [], source: '未指定' }
}

export function reportEvidence(run: EvalRun) {
  return { id: run.id, code: run.code || run.id, started: run.started, status: run.status,
    results: run.results.map(result => ({ id: result.id, code: result.code, name: result.name, verdict: verdictLabel(result), evidence: result.evidence || '' })) }
}

/** 本地原型只比较已记录结果，不推测模型或对象变化的因果关系。 */
export function compareReportText(runs: EvalRun[]) {
  const ordered = [...runs].sort((a, b) => a.started - b.started)
  const lines = ordered.map(run => {
    const counts = ['通过', '不通过', '无法判定'].map(label => `${label} ${run.results.filter(result => verdictLabel(result) === label).length}`)
    const rate = run.results.length ? `${Math.round(run.results.filter(result => verdictLabel(result) === '通过').length / run.results.length * 100)}%` : '无用例'
    return `${run.code || run.id}：${counts.join('，')}；通过率 ${rate}（分母为本次全部 ${run.results.length} 条用例）。`
  })
  if (ordered.length > 1) {
    const first = ordered[0], last = ordered[ordered.length - 1]
    const common = last.results.flatMap(result => {
      const old = first.results.find(item => item.id === result.id)
      return old ? [{ old, result }] : []
    })
    const improved = common.filter(({ old, result }) => verdictLabel(old) === '不通过' && verdictLabel(result) === '通过')
    const regressed = common.filter(({ old, result }) => verdictLabel(old) === '通过' && verdictLabel(result) === '不通过')
    lines.push(`从 ${first.code || first.id} 到 ${last.code || last.id}，按稳定用例 ID 匹配 ${common.length} 条：`,
      `不通过转通过：${improved.map(({ result }) => `${result.code || ''} ${result.name}`).join('、') || '无'}。`,
      `通过转不通过：${regressed.map(({ result }) => `${result.code || ''} ${result.name}`).join('、') || '无'}。`,
      '范围、用例内容、对象和模型可能变化；未匹配用例不视为退步，状态变化不等同于同条件效果提升。')
  }
  return lines.join('\n\n') + '\n\n本地原型仅汇总已记录结果，运行未结束时结论仍会变化；尚未接入真实 AI 跨报告归因。'
}
