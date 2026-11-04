import { test, expect } from 'bun:test'
import { resolveReportContext, compareReportText, reportEvidence } from '../src/features/evaluation/report-context'
import type { EvalRun } from '../src/services/evaluation'
const make = (id: string, code: string, started: number, status = 'completed') => ({ id, code, name: '测试对象', started, status, results: [] } as unknown as EvalRun)
const a = make('a', 'ER-0001', 1), b = make('b', 'ER-0002', 2), c = make('c', 'ER-0003', 3, 'running')
const runs = [b, a, c]
test('显式多报告优先于页面和之前上下文，无效报告不回退', () => {
 expect(resolveReportContext('比较 ER-1 和 ER-2', runs, 'c', ['c']).runs.map(r => r.id)).toEqual(['a','b'])
 expect(resolveReportContext('分析 ER-999', runs, 'a', ['b']).runs).toEqual([])
 expect(resolveReportContext('分析 ER-999', runs).error).toContain('ER-0999')
})
test('最近两次按开始时间定位且包含运行中记录，数量不足澄清', () => {
 expect(resolveReportContext('对比最近两次报告', runs).runs.map(r => r.id)).toEqual(['c','b'])
 expect(resolveReportContext('最近五份', runs).error).toBeTruthy()
 expect(resolveReportContext('最新报告', []).error).toBeTruthy()
})
test('当前页面优先于旧指代，操作不可继承历史目标', () => {
 expect(resolveReportContext('继续分析它们', runs, 'c', ['a','b']).runs.map(r => r.id)).toEqual(['c'])
 expect(resolveReportContext('修复这份报告', runs, 'c', ['a','b']).runs[0].id).toBe('c')
 expect(resolveReportContext('重跑一下', runs, undefined, ['a']).error).toBeTruthy()
 expect(resolveReportContext('分析当前报告', runs, 'c', ['a','b']).runs[0].id).toBe('c')
 expect(resolveReportContext('分析结果', runs, undefined, ['a']).runs[0].id).toBe('a')
 expect(resolveReportContext('分析结果', runs).runs).toEqual([])
 expect(resolveReportContext('继续分析', [b], undefined, ['a']).error).toBeTruthy()
})
test('跨报告比较按稳定 ID 匹配，引用摘要独立于随后变化的结果', () => {
 const first = {...a, results: [{id:'case',code:'EC-1',name:'查询',status:'failed',evidence:'缺少字段'}]} as EvalRun
 const last = {...b, results: [{id:'case',code:'EC-1',name:'查询',status:'passed',evidence:'字段齐全'}]} as EvalRun
 const snapshot=reportEvidence(first)
 expect(compareReportText([last,first])).toContain('不通过转通过：EC-1 查询')
 first.results[0].evidence='后续变化'
 expect(snapshot.results[0].evidence).toBe('缺少字段')
})
