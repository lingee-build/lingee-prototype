import { test, expect } from 'bun:test'
import { respondToEvaluation } from '../src/features/evaluation/conversation-response'
import type { EvaluationConversation } from '../src/services/evaluation-conversations'
const conversation = (): EvaluationConversation => ({ session: { id: 'session', projectId: 'workspace', title: '评测', status: 'idle', time: { created: 0, updated: 0 } }, objectId: 'skill:sk_delivery', objectName: '发货通知单查询', messages: [], request: '', rule: '', files: [], drafts: [], adopted: {} })
test('数字输入不生成用例，也不推进需求状态', () => {
 const c = conversation()
 for (const input of ['1', '2', '3']) expect(respondToEvaluation(c, input).changed).toBe(false)
 expect(c.drafts).toHaveLength(0)
 expect(c.request).toBe('')
})
test('需求澄清、确认生成、去重和指定草稿更新', () => {
 const c = conversation()
 expect(respondToEvaluation(c, '/evaluation-case-designer 为发货通知单查询生成评测用例').changed).toBe(false)
 expect(respondToEvaluation(c, '按建议生成').changed).toBe(true)
 expect(c.drafts).toHaveLength(3)
 expect(respondToEvaluation(c, '新增正常查询').changed).toBe(false)
 const id = c.drafts[0].id
 expect(respondToEvaluation(c, '第1条改成多轮查询').changed).toBe(true)
 expect(c.drafts[0].id).toBe(id)
 expect(c.drafts[0].turns).toHaveLength(2)
 expect(respondToEvaluation(c, '第9条改成多轮').changed).toBe(false)
 expect(c.drafts).toHaveLength(3)
})
test('包含明确场景与要求时直接生成，不重复追问', () => {
 const c = conversation()
 expect(respondToEvaluation(c, '正常查询返回明细，缺少组织时先询问').changed).toBe(true)
 expect(c.drafts).toHaveLength(2)
})
test('增加轮次保留原输入、名称、标准及澄清回复', () => {
 const c = conversation()
 respondToEvaluation(c, '正常查询返回明细')
 const d = c.drafts[0]
 d.name = '自定义名称'
 d.turns![0].input = '查询 A001'
 d.turns![0].rules = [{ id: 'rule', match: '哪个组织', responses: ['华东公司'] }]
 const first = structuredClone(d.turns![0])
 respondToEvaluation(c, '第1条改成多轮')
 expect(c.drafts[0].name).toBe('自定义名称')
 expect(c.drafts[0].turns![0]).toEqual(first)
 expect(respondToEvaluation(c, '第1条改成多轮').changed).toBe(false)
 expect(c.drafts[0].turns).toHaveLength(2)
})
test('明确修改对应字段，模糊修改不写入标准', () => {
 const c = conversation()
 respondToEvaluation(c, '正常查询返回明细')
 respondToEvaluation(c, '第1条名称改为按单号查询')
 expect(c.drafts[0].name).toBe('按单号查询')
 respondToEvaluation(c, '第1条用户输入改为查询 A001')
 expect(c.drafts[0].turns![0].input).toBe('查询 A001')
 expect(respondToEvaluation(c, '第1条修改一下').changed).toBe(false)
 expect(c.drafts[0].checks).toHaveLength(0)
 respondToEvaluation(c, '第1条补充评测标准：返回客户名称')
 expect(c.drafts[0].checks![0].text).toBe('返回客户名称')
})

test('旧加入标记不阻止对当前用例继续修改', () => {
 const c = conversation()
 respondToEvaluation(c, '正常查询返回明细，缺少组织时先询问')
 c.adopted[c.drafts[0].id] = 'added'
 expect(respondToEvaluation(c, '第1条名称改为新名称').changed).toBe(true)
 expect(c.drafts[0].name).toBe('新名称')
})

test('编码引用不受排序影响，不存在的编码不修改或生成用例', () => {
 const c = conversation()
 respondToEvaluation(c, '正常查询返回明细，缺少组织时先询问')
 c.drafts[0].code = 'EC-0001'; c.drafts[1].code = 'EC-0002'
 const id = c.drafts[0].id
 c.drafts.reverse()
 expect(respondToEvaluation(c, 'EC-0001 名称改为按单号查询').changed).toBe(true)
 expect(c.drafts.find(item => item.id === id)?.name).toBe('按单号查询')
 const before = structuredClone(c.drafts)
 expect(respondToEvaluation(c, 'EC-9999 名称改为不存在').changed).toBe(false)
 expect(c.drafts).toEqual(before)
})
