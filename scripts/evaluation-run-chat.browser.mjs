import assert from 'node:assert/strict'
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL})
try {
 for(const kind of ['skill','agent']) {
  const page=await browser.newPage()
  await page.goto('http://127.0.0.1:5180')
  const id=await page.evaluate(async kind=>{
   const {useAuth}=await import('/src/stores/auth.ts');const {accounts,PASSWORD}=await import('/src/mock/fixtures/accounts.ts');useAuth.getState().login(accounts[0].account,PASSWORD)
   const {devStore}=await import('/src/mock/dev-store.ts');const id=(kind==='skill'?devStore.skills:devStore.agents)[0].id
   const {saveCases}=await import('/src/services/evaluation.ts');const {basicEvaluationSample}=await import('/src/services/evaluation-samples.ts')
   saveCases(`${kind}:${id}`,[basicEvaluationSample({name:'运行指令测试',input:'查询 DEMO-001',expected:'返回查询结果',source:'skill',outcome:'passed'})]);return id
  },kind)
  await page.goto(`http://127.0.0.1:5180/dev/${kind}/${id}/evaluation`)
  await page.locator('.eval-native-session [data-component=prompt-session-header]').waitFor()
  const editor=page.locator('[contenteditable=true]').last();await editor.fill('保留的草稿')
  await page.getByRole('button',{name:/运行全部/}).click()
  await page.keyboard.press('Escape')
  assert.equal(await page.locator('[data-slot=session-turn-list]').innerText(),'')
  await page.getByRole('button',{name:/运行全部/}).click()
  await page.getByRole('button',{name:'开始运行',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('[data-slot=session-turn-list]')?.textContent.includes('已开始评测'))
  const data=await page.evaluate(()=>({chat:Object.values(JSON.parse(localStorage.getItem('lingee.evaluation-conversations.v1')).state.items)[0],runs:JSON.parse(localStorage.getItem('lingee.evaluation.v1')).state.runs}))
  assert.equal(data.chat.messages.filter(m=>m.role==='user').length,1)
  assert.match(data.chat.messages[0].parts[0].text,/请运行.*全部用例.*1 条用例.*执行模型：.*判定模型：/)
  assert.equal(data.runs[`${kind}:${id}`].length,1)
  assert.equal(data.runs[`${kind}:${id}`][0].conversationId,data.chat.session.id)
  assert.match(await editor.innerText(),/保留的草稿/)
  await page.reload();await page.locator('[data-slot=session-turn-list] > *').first().waitFor()
  assert.match(await page.locator('[data-slot=session-turn-list]').innerText(),/请运行/)
  console.log(`PASS ${kind}: 取消不发送，确认仅发送一次并关联运行，保留草稿，刷新恢复`)
  await page.close()
 }
}finally{await browser.close()}
