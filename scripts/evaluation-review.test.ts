import {afterAll,beforeAll,expect,test} from 'bun:test'
import {diceKey,agentKey,reviewCases,reviewExecution} from '../src/mock/evaluation/review'
import {advanceRuns,simulateAwaitingContinue,continueRun,recoverReviewQuality,startRun,startRunBatch,useEvaluation,verdictLabel,type EvalResult} from '../src/services/evaluation'
import {qualityOf,qualitySummary} from '../src/services/evaluation-quality'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
beforeAll(() => {
  if (originalStorage) return
  const values = new Map<string,string>()
  Object.defineProperty(globalThis, 'localStorage', {configurable:true,value:{
    getItem:(key:string) => values.get(key) ?? null,
    setItem:(key:string,value:string) => values.set(key,value),
    removeItem:(key:string) => values.delete(key),
  }})
})
afterAll(() => { if (!originalStorage) Reflect.deleteProperty(globalThis, 'localStorage') })

test('评测样例回放按对象、输入和标准匹配，编辑后不能沿用预设证据',()=>{
  const c=reviewCases(diceKey)[2]
  expect(reviewExecution(diceKey,c,false).reviewTrace?.scenario).toBe('FD-RD-003')
  expect(reviewExecution(agentKey,c,false).reviewTrace).toBeUndefined()
  c.turns![0].input+=' 改掷两次'
  expect(reviewExecution(diceKey,c,true).demoEvidence).toBeUndefined()
})

test('评分中断按同一批证据恢复一次，原业务判定、用例和账单不变；环境阻塞按零计入',()=>{
  const c=reviewCases(diceKey)[2], blocked={...reviewCases(diceKey)[0],businessId:'BLOCKED',demo:true,demoFailure:'tool_unavailable' as const,outcome:'blocked' as const}
  const id=startRun(diceKey,'掷骰子',[{...c,demoQualityFailure:true},blocked])!
  const read=()=>useEvaluation.getState().runs[diceKey].find(r=>r.id===id)!
  const real=Date.now
  try {Date.now=()=>read().started+15000;advanceRuns()} finally {Date.now=real}
  const original=read()
  expect(verdictLabel(original.results[0])).toBe('通过')
  expect(original.results[0].quality?.total).toBeUndefined()
  expect(qualityOf(original.results[1]).scores).toEqual(Array(8).fill(0))
  expect(qualitySummary(original.results)).toMatchObject({mean:0,count:1,blocked:1,nonblockedMean:undefined})
  const recoveredId=recoverReviewQuality(diceKey,id)
  expect(recoveredId).toBeTruthy()
  const recovered=useEvaluation.getState().runs[diceKey].find(r=>r.id===recoveredId)!
  expect(read()).toEqual(original)
  expect(recovered.sourceRunId).toBe(id)
  expect(recovered.id).not.toBe(id)
  expect(recovered.results[0].quality?.scores).toEqual([16,12,16,16,14,9,8,6])
  expect(qualitySummary(recovered.results)).toMatchObject({mean:48.5,count:2,blocked:1,nonblockedMean:97})
  expect(recovered.results[0].roundResults).toEqual(original.results[0].roundResults)
  expect(recovered.caseSnapshot).toEqual(original.caseSnapshot)
  expect(recoverReviewQuality(diceKey,id)).toBeUndefined()
})

test('按八项整数累计判断等级与通过线，缺项和越界的记录不进入均分',()=>{
  const result = (scores: number[]): EvalResult => ({
    ...reviewCases(diceKey)[0], status:'passed', response:'', evidence:'', tool:'',
    quality:{scores, state:'质量通过', evidence:'当次记录'},
  })
  for (const [scores, total, grade] of [
    [[16,14,16,16,14,10,8,6],100,'S'], [[16,14,16,16,14,10,4,0],90,'S'],
    [[16,14,16,16,14,4,0,0],80,'A'], [[16,14,16,16,8,0,0,0],70,'B'],
    [[16,14,16,14,0,0,0,0],60,'C'], [[16,14,16,13,0,0,0,0],59,'D'],
  ] as [number[],number,string][]) {
    expect(qualityOf(result(scores))).toMatchObject({total,grade,state:total>=60?'质量通过':'质量未通过'})
  }
  const invalid = [result([16]), result([17,0,0,0,0,0,0,0]),result([1.5,0,0,0,0,0,0,0])]
  expect(invalid.map(r=>qualityOf(r).state)).toEqual(Array(3).fill('评分未完成'))
  expect(qualitySummary(invalid)).toMatchObject({count:0,mean:undefined,grade:undefined})
})


test('多模型报告共享并发槽位，分别保存模型快照；活动批次拒绝重复启动',()=>{
  const key='skill:batch-test', cases=reviewCases(diceKey).slice(0,2)
  const judging={id:'judge',name:'Judge',provider:'demo'}
  const models=['a','b'].map(id=>({execution:{id,name:id,provider:'demo'},judging}))
  const ids=startRunBatch(key,'批次',cases,'sandbox',models,2)!
  expect(ids).toHaveLength(2)
  const reports=ids.map(id=>useEvaluation.getState().runs[key].find(r=>r.id===id)!)
  expect(reports[0].batchId).toBe(reports[1].batchId)
  expect(reports[0].caseStartOffsets).toEqual([0,0])
  expect(Math.min(...reports[1].caseStartOffsets!)).toBeGreaterThan(0)
  expect(reports.map(r=>r.models?.execution.id)).toEqual(['a','b'])
  expect(startRunBatch(key,'重复',cases,'sandbox',models,2)).toBeUndefined()
  const real=Date.now
  try { Date.now=()=>reports[0].started+30000; advanceRuns() } finally {Date.now=real}
  expect(useEvaluation.getState().runs[key].every(r=>r.status==='completed')).toBe(true)
  expect(startRunBatch('skill:invalid','非法',cases,'sandbox',models,6)).toBeUndefined()
})


test('重启待继续保留证据，等待期间不推进，确认后执行剩余内容',()=>{
  const key='skill:resume-test', id=startRun(key,'恢复',[reviewCases(diceKey)[0]])!
  const read=()=>useEvaluation.getState().runs[key].find(r=>r.id===id)!
  const real=Date.now, start=read().started
  try {
    Date.now=()=>start+1000; advanceRuns(); simulateAwaitingContinue(key,id)
    const frozen=structuredClone(read().results)
    Date.now=()=>start+20000; advanceRuns(); expect(read().results).toEqual(frozen)
    continueRun(key,id); expect(read().awaitingContinueAt).toBeUndefined()
    Date.now=()=>start+24000; advanceRuns(); expect(read().status).toBe('completed')
  } finally {Date.now=real}
})

 test('扩展来源字段改变后不复用预设执行证据',()=>{
 const c=reviewCases(diceKey)[0]
 c.turns![0].sourceFields={'是否开启联网搜索':'是'}
 expect(reviewExecution(diceKey,c,false).demoEvidence).toBeUndefined()
 })
