import { test, expect } from 'bun:test'
import type { Session } from '../src/mock/types'
import type { EvalRun } from '../src/services/evaluation'
const storage = new Map<string,string>()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k:string) => storage.get(k) || null, setItem: (k:string,v:string) => storage.set(k,v), removeItem: (k:string) => storage.delete(k) } })
const { registerEvaluationRepair, useEvaluationRepairs, findRepairSession, evaluationRepairTarget } = await import('../src/services/evaluation-repair')
test.each(['skill', 'agent'] as const)('%s：同报告复用，明确复测链延续，独立运行与其他对象不串会话', (objectType) => {
 useEvaluationRepairs.setState({ items: {}, links: {} })
 const session = { id:'repair-flow', projectId:'p', title:'修复', status:'idle', time:{created:1,updated:1} } as Session
 const r1 = {id:'r1'} as EvalRun
 registerEvaluationRepair(session, '分析第一轮', {objectType,objectId:'delivery',runId:'r1'})
 expect(findRepairSession(`${objectType}:delivery`,r1)?.session.id).toBe(session.id)
 expect(findRepairSession(`${objectType}:delivery`,{id:'r2',sourceRunId:'r1'} as EvalRun)?.session.id).toBe(session.id)
 expect(findRepairSession(`${objectType}:delivery`,{id:'independent'} as EvalRun)).toBeUndefined()
 expect(findRepairSession(`${objectType === "skill" ? "agent" : "skill"}:delivery`,r1)).toBeUndefined()
 const oldMessage = {id:'m1',sessionId:session.id,role:'assistant',time:{created:1},parts:[]} as const
 useEvaluationRepairs.setState(s=>({items:{...s.items,[session.id]:{...s.items[session.id],messages:[structuredClone(oldMessage) as any]}}}))
 registerEvaluationRepair(session, '分析第二轮', {objectType,objectId:'delivery',runId:'r2'})
 expect(useEvaluationRepairs.getState().items[session.id].runIds).toEqual(['r1','r2'])
 expect(useEvaluationRepairs.getState().items[session.id].messages[0].id).toBe('m1')
 expect(evaluationRepairTarget(session.id)?.runId).toBe('r2')
 expect(findRepairSession(`${objectType}:delivery`,{id:'r3',sourceRunId:'r2'} as EvalRun)?.session.id).toBe(session.id)
})
