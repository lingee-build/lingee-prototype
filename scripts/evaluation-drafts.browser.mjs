// 先启动 bun run dev；在独立浏览器上下文验证对象级会话与草稿。
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL })
const base = process.env.REPORT_TEST_URL || 'http://127.0.0.1:5180'
try {
  for (const kind of ['skill', 'agent']) {
    const page = await browser.newPage()
    const errors=[]; page.on('pageerror',e=>errors.push(e.message))
    await page.goto(`${base}/dev/${kind}`)
    const id=await page.evaluate(async kind=>{
      const {useAuth}=await import('/src/stores/auth.ts'); const {accounts,PASSWORD}=await import('/src/mock/fixtures/accounts.ts')
      useAuth.getState().login(accounts[0].account,PASSWORD)
      const {devStore}=await import('/src/mock/dev-store.ts')
      const id=(kind==='skill'?devStore.skills:devStore.agents)[0].id
      const {useEvaluation}=await import('/src/services/evaluation.ts')
      useEvaluation.setState(s=>({runs:{...s.runs,[`${kind}:${id}`]:[2,1].map(n=>({id:`shared-run-${n}`,code:`ER-000${n}`,name:'对象级会话测试',started:Date.now()-10000+n*1000,ended:Date.now()-1000,status:'completed',results:[],caseSnapshot:{version:'V1',capturedAt:Date.now()-10000,cases:[]}}))}}))
      return id
    },kind)
    await page.goto(`${base}/dev/${kind}/${id}/evaluation`)
    const editor=page.locator('[contenteditable=true]').last()
    const draft=()=>editor.innerText().then(t=>t.replace(/^evaluation-builder\s*/,''))
    const cases=()=>page.getByRole('tab',{name:/评测用例/}).click()
    const reports=()=>page.getByRole('tab',{name:/评测报告/}).click()
    await editor.fill('跨页面保留的正文')
    await page.locator('.eval-native-session input[type=file]').first().setInputFiles({name:'draft.txt',mimeType:'text/plain',buffer:Buffer.from('附件草稿')})
    await reports()
    assert.equal(await draft(),'跨页面保留的正文')
    assert.equal(await page.locator('.eval-workbench').getAttribute('data-chat-open'),'true')
    await page.getByRole('button',{name:'ER-0001',exact:true}).click()
    assert.equal(await draft(),'跨页面保留的正文')
    assert.match(await page.locator('[data-component=prompt-attachments]').innerText(),/draft.txt/)
    await page.locator('.eval-panel-header button[aria-expanded]').click()
    await reports()
    assert.equal(await page.locator('.eval-workbench').getAttribute('data-chat-open'),null)
    await page.locator('.eval-panel-header button[aria-expanded]').click()
    await page.getByRole('button',{name:'ER-0002',exact:true}).click()
    assert.equal(await draft(),'跨页面保留的正文')
    const state=()=>page.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('lingee.evaluation-conversations.v1') || '{"state":{"items":{}}}').state.items))
    async function send(text) {
      const before=(await state())[0]?.reportTurns?.length || 0
      await editor.fill(text); await editor.press('Enter')
      await page.waitForFunction(({before,text})=>{
        const c=Object.values(JSON.parse(localStorage.getItem('lingee.evaluation-conversations.v1') || '{"state":{"items":{}}}').state.items)[0]
        return (c?.reportTurns?.length||0)>before && c.reportTurns.at(-1).prompt.startsWith(text) && c.messages.at(-1)?.role==='assistant' && !!c.messages.at(-1)?.time.completed && c.messages.filter(m=>m.role==='user').at(-1)?.parts.some(p=>p.text?.startsWith(text)) && c.session.status!=='running'
      },{before,text})
      await page.waitForFunction(()=>!document.querySelector('[contenteditable=true]')?.textContent.replace(/^evaluation-builder\s*/,''))
      return (await state())[0]
    }
    let conversation=await send('分析 ER-0001')
    const sessionId=conversation.session.id
    assert.deepEqual(conversation.reportContext,['shared-run-1'])
    assert.equal(conversation.runId,undefined)
    assert.equal(await page.locator('[data-component=prompt-attachments]').count(),0)
    await reports(); await page.getByRole('button',{name:'ER-0002',exact:true}).click()
    assert.equal(new URL(page.url()).searchParams.get('conversation'),sessionId)
    conversation=await send('继续分析它')
    assert.deepEqual(conversation.reportTurns.at(-1).reportIds,['shared-run-1'],'连续追问不被新页面覆盖')
    conversation=await send('对比 ER-0001 和 ER-0002')
    assert.deepEqual(conversation.reportContext,['shared-run-1','shared-run-2'])
    assert.match(conversation.reportTurns.at(-1).response,/引用报告：ER-0001、ER-0002/)
    conversation=await send('重新运行它们')
    assert.match(conversation.reportTurns.at(-1).response,/请指定/)
    assert.equal(await page.getByRole('dialog').count(),0,'歧义操作不打开运行弹窗')
    conversation=await send('分析 ER-9999')
    assert.deepEqual(conversation.reportTurns.at(-1).reportIds,[],'失效引用不能兜底')
    await cases(); assert.equal((await state()).length,1)
    await page.reload()
    await page.locator('[data-type=agent]').waitFor()
    await page.locator('.eval-native-session [data-component=prompt-session-header]').waitFor()
    assert.equal((await state())[0].session.id,sessionId)
    conversation=await send('继续对比它们')
    assert.deepEqual(conversation.reportTurns.at(-1).reportIds,['shared-run-1','shared-run-2'])
    assert.equal(conversation.session.id,sessionId)
    await editor.fill('尚未发送')
    await reports(); await cases()
    assert.equal(await draft(),'尚未发送')
    const historyUrl=page.url()
    const historyMessages=conversation.messages.length
    await page.goto(`${base}/dev/${kind}/${id}/evaluation`)
    await page.locator('.eval-native-session [data-component=prompt-session-header]').waitFor()
    assert.equal(await page.locator('[data-slot=session-turn-list]').innerText(),'','从评测入口进入不显示旧会话消息')
    assert.equal((await state())[0].messages.length,historyMessages,'新入口不删除历史消息')
    assert.equal(await draft(),'','新入口不带入旧草稿')
    await reports()
    await page.getByRole('button',{name:'ER-0002',exact:true}).waitFor({state:'visible'})
    assert.match(await page.locator('.eval-report-heading').filter({has:page.getByRole('button',{name:'ER-0002',exact:true})}).innerText(),/ER-0002\s*已完成\s*最新/)
    await page.goto(historyUrl)
    await page.locator('[data-slot=session-turn-list] > *').first().waitFor()
    assert.equal(new URL(page.url()).searchParams.get('conversation'),sessionId)
    assert.equal((await state())[0].messages.length,historyMessages,'历史会话仍可恢复')
    assert.deepEqual(errors,[])
    console.log(`PASS ${kind}：对象会话复用、跨视图文字附件保留、多报告引用、连续追问、歧义操作阻断、无效引用不回退、刷新恢复`)
    await page.close()
  }
} finally {await browser.close()}
