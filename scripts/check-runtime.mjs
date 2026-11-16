import assert from 'node:assert/strict'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporary = await mkdtemp(path.join(tmpdir(), 'build-runtime-check-'))
// 评测模块依赖浏览器存储和轮询；为 Node 回归提供独立存储，并在结束后清理轮询。
const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const storage = new Map()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
} })
const realInterval = globalThis.setInterval
const intervals = new Set()
globalThis.setInterval = (...args) => {
  const timer = realInterval(...args)
  intervals.add(timer)
  return timer
}
try {
  await build({ entryPoints: [path.join(root,'src/pages/session/timeline/process-groups.ts'),path.join(root,'src/mock/scenarios/procurement-create.ts'),path.join(root,'src/mock/latency.ts'),path.join(root,'src/services/procurement.ts')], bundle:true, platform:'node', format:'esm', outdir:temporary, entryNames:'[name]', outExtension:{'.js':'.mjs'}, alias:{'@':path.join(root,'src')}, logLevel:'silent' })
  const {stageParts,contextRuns,splitFinalParts} = await import(pathToFileURL(path.join(temporary,'process-groups.mjs')))
  const text=id=>({id,type:'text',text:id})
  const tool=(id,kind='read')=>({id,type:'tool',tool:kind,title:id,state:'completed'})
  const reason=id=>({id,type:'reasoning',text:id,time:{start:0,end:1}})
  const parts=[text('intro'),tool('load','skill'),tool('search','grep'),reason('thought'),tool('dc','mcp'),text('update'),tool('read1'),tool('read2'),text('final'),text('card')]
  const split=splitFinalParts(parts)
  assert.deepEqual(split.final.map(p=>p.id),['final','card'])
  assert.deepEqual(stageParts(split.process).map(g=>g.type),['part','stage','part','stage'])
  assert.deepEqual(stageParts(parts.slice(1,5))[0].parts.map(p=>p.id),['load','search','thought','dc'])
  assert.equal(contextRuns([tool('a'),tool('b')]).length,1)
  assert.equal(contextRuns([tool('a'),text('x'),tool('b')]).length,3)
  assert.equal(contextRuns([reason('a'),reason('b')]).length,1)
  assert.equal(stageParts([reason('a'),reason('b')])[0].type,'reasoning')
  assert.equal(splitFinalParts([text('only')]).process.length,0)
  assert.deepEqual(splitFinalParts([tool('one'),text('streaming')],true).process.map(p=>p.id),['one','streaming'])
  assert.equal(splitFinalParts([tool('one'),text('streaming')],true).final.length,0)
  assert.equal(stageParts([tool('only')])[0].type,'part')
  const query = {...tool('query','mcp'),stageGroup:true}
  assert.equal(stageParts([query])[0].type,'stage')
  assert.equal(stageParts([query,reason('match')])[0].key,stageParts([query])[0].key)
  assert.deepEqual(stageParts([tool('query','mcp'),reason('matching')])[0].parts.map(p=>p.id),['query','matching'])
  assert.equal(stageParts([tool('a'),reason('tail'),text('explain')])[0].parts.length,2)

  const {procurementCreateScenario,procurementTestScenario,parseProcurementRules} = await import(pathToFileURL(path.join(temporary,'procurement-create.mjs')))
  assert.equal(parseProcurementRules([]).threshold,15)
  const {resolveEntityCandidates,procurementService}=await import(pathToFileURL(path.join(temporary,'procurement.mjs')))
  assert.equal(resolveEntityCandidates(['采购订单','初始采购订单（旧）'],'采购订单').selected,'采购订单')
  assert.equal(resolveEntityCandidates(['采购订单','采购合同'],'订单').needsClarification,true)
  const context = procurementService.discover()
  assert.deepEqual(context.entityNames,['采购订单','采购历史价格查询','采购价目表'])
  const seen = []
  for (const method of ['getEntityTransformRules','getEntityMcpTools','getEntityOpenApis']) {
    const original = procurementService[method]
    procurementService[method] = function(names) { seen.push({method,names}); return original.call(this,names) }
  }
  procurementService.discover()
  assert.deepEqual(seen.map(call=>call.method),['getEntityTransformRules','getEntityMcpTools','getEntityOpenApis'])
  assert.ok(seen.every(call=>JSON.stringify(call.names)===JSON.stringify(context.entityNames)))
  assert.equal(context.queries.length,1)
  assert.equal(context.queries[0].candidates.length,3)
  assert.equal(new Set(context.queries.map(q=>q.request.keyword)).size,1)
  assert.ok(context.rules.length>0 && !context.resolution.needsClarification)
  const {sleep} = await import(pathToFileURL(path.join(temporary,'latency.mjs')))
  const stop = new AbortController()
  const began = performance.now()
  const pending = sleep(5000,stop.signal)
  stop.abort()
  await pending
  assert.ok(performance.now()-began < 500,'Slower presentation waits must stop immediately')
  for (const [threshold,count] of [['15%',1],['30%',0]]) {
    const scenario=procurementCreateScenario({prompt:'采购价格异常预警',projectId:'scm-skills'})
    const question=scenario.steps.find(s=>s.question)
    assert.equal(question.question.length,5)
    assert.equal(question.question.flatMap(q=>q.options).length,13)
    for (const q of question.question) {
      assert.equal(q.options.filter(o=>o.recommended).length,1)
      assert.ok(q.options.every(o=>o.description?.length >= 20),`Missing business explanation: ${q.question}`)
    }
    assert.equal(scenario.pacing.textUnit,'paragraph')
    assert.ok(scenario.pacing.toolDelayMs >= 700 && scenario.pacing.toolDelayMs <= 1000)
    for (const name of ['searchEntities','getEntityTransformRules','getEntityMcpTools','getEntityOpenApis']) {
      assert.ok(scenario.steps.some(s=>s.tools?.some(t=>t.title===name)),`Missing interface: ${name}`)
    }
    assert.equal(scenario.steps.flatMap(s=>s.tools??[]).filter(t=>t.title==='searchEntities').length,1)
    assert.ok(scenario.steps.some(s=>s.reasoning?.includes('3 个') && s.reasoningDisplay==='scroll' && s.reasoningUnit==='sentence'))
    assert.ok(scenario.steps.flatMap(s=>s.tools??[]).find(t=>t.title==='searchEntities').stageGroup)
    assert.ok(scenario.steps.some(s=>s.plan?.length===6 && s.plan[2].length===2))
    question.onAnswer([['历史均价 + 采购价目表'],['最近 90 天'],[threshold],['任一参考价超过阈值'],['简单平均']])
    const resolved=scenario.steps.map(s=>({...s,...s.resolve?.()}))
    const skill=resolved.flatMap(s=>s.tools??[]).find(t=>t.title==='SKILL.md')
    assert.match(skill.output,new RegExp(threshold))
    assert.doesNotMatch(resolved.at(-1).text,/测试结果|异常价格分析|物料|Mock|模拟/);
    assert.equal(scenario.todos.length,0);
    assert.match(resolved.flatMap(s=>s.tools??[]).find(t=>t.title==='getEntityMcpTools').output,/含税单价|含税|数量/);
    assert.match(resolved.flatMap(s=>s.tools??[]).find(t=>t.title==='searchEntities').output,/关键字段|关联关系/);
    assert.equal(resolved.flatMap(s=>s.tools??[]).filter(t=>t.title==='basic.json').length,1);
    assert.match(resolved.at(-1).text,/已创建并通过校验/);
    assert.doesNotMatch(JSON.stringify(resolved),/Mock|模拟|仅用于演示/);
    assert.match(skill.output,/采购价格异常预警/)
    const allTools=resolved.flatMap(s=>s.tools??[])
    const dc = allTools.filter(t=>['searchEntities','getEntityTransformRules','getEntityMcpTools','getEntityOpenApis'].includes(t.title))
    assert.equal(dc.length,4)
    assert.match(dc[0].output,/场景化采购订单|采购协同/)
    assert.ok(allTools.filter(t=>t.tool==='mcp').every(t=>/^[a-zA-Z_]+$/.test(t.title)))
    assert.ok(dc.slice(1).every(t=>t.detail==='entityNames=[采购订单, 采购历史价格查询, 采购价目表]'))
    assert.ok(!allTools.some(t=>t.title.includes('DC ·')))
    const writes=allTools.filter(t=>t.tool==='write')
    assert.deepEqual(writes.map(t=>t.title),['SKILL.md','basic.json'])
    assert.equal(JSON.parse(writes[1].output).cases.length,10)
    assert.ok(allTools.some(t=>t.title==='output_check'))
    assert.match(skill.output,/企业上下文|相关业务流程与规则/)
    const card=resolved.at(-1).card()
    assert.match(procurementTestScenario(card.config.id).steps.at(-1).text,new RegExp(count+' 项异常价格'))
  }
  // Exercise the real stream with accelerated timers; the emitted content still uses production pacing values.
  await build({stdin:{contents:'export {runAssistantStream,resumeStream,abortStream} from "./src/mock/stream-engine"; export {db} from "./src/mock/db"; export {procurementArtifacts} from "./src/mock/procurement-artifacts"',resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:path.join(temporary,'stream.mjs'),alias:{'@':path.join(root,'src')},logLevel:'silent'})
  const engine = await import(pathToFileURL(path.join(temporary,'stream.mjs')))
  const realTimer = globalThis.setTimeout
  const realClear = globalThis.clearTimeout
  const delays = []
  globalThis.setTimeout = (callback,ms) => { delays.push(ms); queueMicrotask(callback); return 1 }
  globalThis.clearTimeout = () => {}
  try {
    const sessionId = 'procurement-cadence-check'
    engine.db.sessions.push({id:sessionId,projectId:'scm-skills',title:'test',status:'idle',time:{created:0,updated:0}})
    const events = []
    await engine.runAssistantStream(sessionId,'创建采购价格异常预警技能',event=>{
      events.push(event)
      if (event.type==='question.asked') queueMicrotask(()=>engine.resumeStream(sessionId,event.request.questions.map(q=>[q.options[0].label])))
    })
    assert.equal(events.filter(e=>e.type==='question.asked').length,1)
    assert.ok(delays.includes(650) && delays.includes(850) && delays.includes(1100),'Presentation timings must reach the real stream')
    const message = engine.db.messages.find(m=>m.sessionId===sessionId && m.role==='assistant')
    assert.ok(message.time.completed)
    const analysis=message.parts.find(p=>p.type==='reasoning')
    assert.equal(analysis.display,'scroll')
    const updates=events.filter(e=>e.type==='message.part.updated' && e.part.id===analysis.id)
    assert.ok(updates.length>=4,'Candidate analysis must append multiple sentences for visible scrolling')
    assert.ok(message.parts.some(p=>p.type==='execution-plan' && p.stages[2].length===2))
    assert.ok(message.parts.some(p=>p.type==='text' && p.text.includes('已确认按')))
    assert.ok(message.parts.some(p=>p.type==='text' && p.text.includes(':::render:kdskill')))
    assert.equal(events.at(-1).status,'idle')
    const playbackMs = delays.reduce((sum,ms)=>sum+ms,0)
    assert.ok(playbackMs >= 30000 && playbackMs <= 58000,`Automatic playback must stay under one minute: ${playbackMs}ms`)
    const firstTextById = new Map()
    for (const event of events) if(event.type==='message.part.updated' && ['text','reasoning'].includes(event.part.type) && !firstTextById.has(event.part.id)) firstTextById.set(event.part.id,event.part.text)
    assert.ok([...firstTextById].every(([id,value])=>value.length>=Math.min(12,message.parts.find(part=>part.id===id).text.length)),'Text must appear in paragraphs, not individual characters')
    console.log(`Procurement automatic playback: ${(playbackMs/1000).toFixed(1)}s, paragraph output.`)

    const artifact = [...engine.procurementArtifacts.values()].at(-1)
    for (const file of ['SKILL.md','evals/basic.json','manifest.yaml','CHANGELOG.md']) assert.ok(artifact.files[file],`Missing generated artifact: ${file}`)
    assert.equal(JSON.parse(artifact.files['evals/basic.json']).cases.length,10)
    assert.doesNotMatch(artifact.files['manifest.yaml'],/  - 物料明细/)

    const abortId = 'procurement-stop-check'
    engine.db.sessions.push({id:abortId,projectId:'scm-skills',title:'test',status:'idle',time:{created:0,updated:0}})
    await engine.runAssistantStream(abortId,'创建采购价格异常预警技能',event=>{
      if(event.type==='message.part.updated' && event.part.type==='tool') queueMicrotask(()=>engine.abortStream(abortId))
    })
    const stopped = engine.db.messages.find(m=>m.sessionId===abortId && m.role==='assistant')
    assert.ok(stopped.time.completed)
    assert.ok(!stopped.parts.some(p=>p.type==='text' && p.text.includes(':::render:kdskill')),'Aborted playback cannot create an artifact')
  } finally { globalThis.setTimeout=realTimer; globalThis.clearTimeout=realClear }
  const snapshot=path.join(root,'src/source-runtime')
  const manifest=JSON.parse(await readFile(path.join(snapshot,'manifest.json'),'utf8'))
  for (const file of manifest.files.filter(f=>!f.extracted)) {
    const content=await readFile(path.join(snapshot,file.copy))
    assert.equal(createHash('sha256').update(content).digest('hex'),file.sha256,`Source copy changed: ${file.copy}`)
  }
  // UI CSS must remain in the source's components layer so toolbar utilities win.
  const imports = await readFile(path.join(snapshot,'runtime.css'),'utf8')
  for (const name of ['button','icon-button','icon','dock-surface','progress-circle']) {
    assert.ok(imports.includes(`@import "./styles/${name}.css" layer(components);`), `Missing component cascade layer: ${name}`)
  }
  console.log('PASS: source CSS/code integrity; process grouping; reasoning/context merge; final/card visibility; confirmed rules → generated files → reports → local retest.')
} finally {
  for (const timer of intervals) clearInterval(timer)
  globalThis.setInterval = realInterval
  if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage)
  else delete globalThis.localStorage
  await rm(temporary,{recursive:true,force:true})
}
