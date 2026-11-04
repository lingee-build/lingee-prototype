import { expect, test } from 'bun:test'
import { evaluationIntent, reportConversationText, reportRerunPrompt, reportRerunIds } from '../src/features/evaluation/conversation-context'
import type { EvalRun } from '../src/services/evaluation'

test('报告、进度与生成意图分离', () => {
  expect(evaluationIntent('查看报告结论')).toBe('report')
  expect(evaluationIntent('查看运行进度')).toBe('report')
  expect(evaluationIntent('运行全部')).toBe('run')
  expect(evaluationIntent('为查询技能生成评测用例')).toBe('cases')
})
test('摘要仅使用传入运行，无运行时引导选择，不回退历史', () => {
  const run = { id:'r', name:'对象 A', started:1, status:'running', results:[], caseSnapshot:{version:'V8',capturedAt:1,cases:[]} } as EvalRun
  expect(reportConversationText(run)).toContain('对象 A')
  expect(reportConversationText(run)).not.toContain('V8')
  expect(reportConversationText(run)).toContain('尚未结束')
  expect(reportConversationText({...run,status:'completed'})).toContain('通过 0 条')
  expect(reportConversationText()).toContain('选择一次运行')
  expect(reportConversationText()).not.toContain('V8')
})

test('运行对话区分查询、控制、修复和再次验证，否定语句不执行', () => {
  for (const text of ['跑到哪了？', '还有几条没结束？', '打开侧边报告', '看看未通过的用例', '打开第 3 条的结果', '为什么这么久？']) expect(evaluationIntent(text)).toBe('report')
  expect(evaluationIntent('停止这次评测')).toBe('stop')
  expect(evaluationIntent('只跑上次未通过的用例')).toBe('rerun')
  expect(evaluationIntent('再跑一次，看看修好了没有')).toBe('rerun')
  expect(evaluationIntent('修复这次评测发现的问题')).toBe('repair')
  expect(evaluationIntent('优先解决参数遗漏的问题')).toBe('repair')
  expect(evaluationIntent('确认修复')).toBe('confirmRepair')
  expect(evaluationIntent('改了什么？')).toBe('repairStatus')
  expect(evaluationIntent('修到哪了？')).toBe('repairStatus')
  for (const text of ['不要停止运行', '暂不修复', '如何修复问题']) expect(evaluationIntent(text)).toBe('help')
})
test('停止请求与完成状态分开，运行阶段从实际记录读取', () => {
  const run = { id: 'r', name: '对象', status: 'stopping', results: [] } as unknown as EvalRun
  expect(reportConversationText(run)).toContain('等待停止确认')
  expect(reportConversationText({ ...run, status: 'judging' })).toContain('正在判定结果')
  expect(reportConversationText({ ...run, status: 'cancelled' })).toContain('本次已停止')
})


test('报告菜单自然语言明确来源及范围，并正确触发两类重跑', () => {
  const run = { id: 'source', code: 'ER-0020', name: '发货通知单查询', status: 'completed', results: [
    { id: 'pass', status: 'passed', verdict: 'passed' },
    { id: 'fail', status: 'failed', verdict: 'failed' },
    { id: 'unknown', status: 'blocked', verdict: 'unknown' },
  ] } as EvalRun
  const all = reportRerunPrompt(run, false)
  const partial = reportRerunPrompt(run, true)
  expect(all).toContain('ER-0020')
  expect(all).toContain('本次全部用例，共 3 条')
  expect(partial).toContain('不通过及无法判定用例，共 2 条')
  expect(partial).toContain('不通过 1 条，无法判定 1 条')
  expect(evaluationIntent(all)).toBe('rerun')
  expect(evaluationIntent(partial)).toBe('rerun')
  expect(reportRerunIds(run, all)).toBeUndefined()
  expect(reportRerunIds(run, partial)).toEqual(['fail', 'unknown'])
  expect(reportRerunIds(run, '只重跑无法判定用例')).toEqual(['unknown'])
  expect(reportRerunIds(run, '只重跑不通过用例')).toEqual(['fail'])
})
