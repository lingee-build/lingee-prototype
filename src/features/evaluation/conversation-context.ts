import { finishedCaseCount, isActiveRun, verdictLabel, unsuccessfulRunResults, type EvalRun } from '@/services/evaluation'

export function evaluationIntent(raw: string) {
  const text = raw.replace(/^\/(?:evaluation-builder|evaluation-assistant|evaluation-case-designer)\s*/, "").trim()
  // 否定或咨询不触发写操作。
  if (/不要|不用|先别|暂不|如何|怎么(?:运行|停止|修复)/.test(text)) return 'help'
  if (/修到哪|修复进度|改了什么|修改了什么|修复结果/.test(text)) return 'repairStatus'
  if (/确认修复|确认修改|按.*方案.*(?:修复|修改)|继续修复/.test(text)) return 'confirmRepair'
  if (/修复|优先解决|先解决/.test(text)) return 'repair'
  if (/停止|终止|取消.*(?:运行|评测)/.test(text)) return 'stop'
  if (/再跑|重跑|重新(?:运行|评测)|只跑/.test(text)) return 'rerun'
  if (/分析.*报告|报告.*分析|查看.*报告|打开.*报告|看看.*(?:结果|用例)|评测报告|报告.*(结论|结果|怎么样)|进度|跑到哪|还有.*条|为什么.*久|异常|第\s*[一二三四五六七八九十\d]+\s*条.*结果/.test(text)) return 'report'
  if (/^(?:请|帮我)?(?:开始|发起|运行|执行)(评测|运行|执行|全部|选中|用例|测试|这|这些|当前|\s|$)/.test(text)) return 'run'
  return 'cases'
}

export function reportConversationText(run?: EvalRun) {
  if (!run) return '请从右侧评测报告列表选择一次运行，再查看对应进度、结论与证据。如需生成或修改用例，请切换到评测用例。'
  const scope = `${run.name}，${finishedCaseCount(run)} / ${run.results.length} 条已结束。`
  if (run.status === 'stopping' || run.status === 'stop_unconfirmed') return `${scope}正在等待停止确认，已产生的结果会保留。`
  if (isActiveRun(run)) return `${scope}当前运行尚未结束，${run.status === 'judging' || run.results.some(item => item.judging) ? '正在判定结果' : run.results.some(item => item.status === 'running') ? '正在执行用例' : '正在准备执行'}。可继续查询进度、打开报告或停止运行。`
  const counts = ['通过', '不通过', '无法判定'].map(label => `${label} ${run.results.filter(result => verdictLabel(result) === label).length} 条`).join('，')
  return `${scope}${run.status === 'cancelled' ? '本次已停止。' : run.status === 'error' ? '本次运行异常结束。' : ''}${counts}。\n\n本地原型按已记录结果展示摘要，详细结论与证据请查看右侧报告。可以继续说“修复这次评测的问题”或“只重跑未通过的用例”。`
}

export function reportRerunPrompt(run: EvalRun, unsuccessful: boolean) {
  const results = unsuccessful ? unsuccessfulRunResults(run) : run.results
  const counts = unsuccessful ? `（不通过 ${results.filter(c => verdictLabel(c) === '不通过').length} 条，无法判定 ${results.filter(c => verdictLabel(c) === '无法判定').length} 条）` : ''
  return `请重新运行「${run.name}」评测报告 ${run.code || run.id} 中的${unsuccessful ? '不通过及无法判定用例' : '本次全部用例'}，共 ${results.length} 条${counts}。使用该报告保存的用例和最新已保存的对象内容，生成新的评测报告。`
}
export function reportRerunIds(run: EvalRun, text: string) {
  const failed = /未通过|不通过|失败/.test(text)
  const unknown = /无法判定/.test(text)
  if (!failed && !unknown) return undefined
  return run.results.filter(c => (failed && verdictLabel(c) === '不通过') || (unknown && verdictLabel(c) === '无法判定')).map(c => c.id)
}
