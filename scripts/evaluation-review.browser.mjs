const {chromium}=await import(process.env.PLAYWRIGHT_MODULE || 'playwright')
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
const base=process.env.REVIEW_URL || 'http://127.0.0.1:5186', root=process.cwd(), output=process.env.REVIEW_OUTPUT || root+'/outputs/evaluation-review'
await fs.mkdir(output,{recursive:true})
// 忽略阅读者手动展开的状态，比较两个入口中同一份报告的完整正文及呈现颜色。
async function verifyDownloadedReport(page, download, path) {
  await download.saveAs(path)
  const standalone = await page.context().newPage()
  try {
    await standalone.goto(pathToFileURL(path).href)
    const snapshot = main => {
      const body = main.cloneNode(true)
      body.querySelectorAll('[data-cases],[data-rounds]').forEach(button => button.remove())
      return {
        sections: [...main.querySelectorAll(':scope > section > h2, :scope > section > div > h2')].map(h => h.textContent),
        text: body.textContent.replace(/\s+/g, ' ').trim(),
        leftBorder: getComputedStyle(main.querySelector('.quality-detail')).borderLeftWidth,
        background: getComputedStyle(main.querySelector('.quality-detail')).backgroundColor,
      }
    }
    const preview = page.frameLocator('.eval-report-document')
    const live = await preview.locator('main').evaluate(snapshot)
    const offline = await standalone.locator('main').evaluate(snapshot)
    assert.deepEqual(offline, live)
    assert.equal(live.leftBorder, '0px')
    assert.deepEqual(live.sections, ['一、关键发现与改进建议','二、评测概览','三、详细分析','四、评分标准'])
    await standalone.locator('aside a[href="#rubric"]').click()
    await standalone.locator('.rubric').first().locator('summary').click()
    assert.ok(await standalone.locator('.rubric').first().locator('table').isVisible())
    await standalone.locator('aside a[href="#case-0"]').click()
    assert.ok(await standalone.locator('details.case').first().evaluate(d => d.open))
    await standalone.locator('aside a[href="#dimensions"]').click()
    assert.equal(await standalone.locator('.dimension-table tbody tr').count(),8)
  } finally { await standalone.close() }
}
async function walk(mode) {
const b=await chromium.launch({channel:process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome',headless:true})
const context=await b.newContext({viewport:{width:1560,height:990}})
const p=await context.newPage()
const errors=[]
p.on('pageerror',e=>errors.push(e.message))
p.setDefaultTimeout(18000)
try {
const kind=mode==='agent'?'agent':'skill', name=kind==='skill'?'掷骰子':'库存核对助手'
await p.goto(base+'/dev/'+kind)
await p.locator('form input').first().fill('zhangle');await p.locator('input[type=password]').fill('kingdee');await p.locator('form button').last().click()
const card=p.getByText(name,{exact:true}).last()
await card.waitFor()
const more=card.locator('xpath=ancestor::*[.//button[@aria-haspopup="menu"]][1]').locator('button[aria-haspopup=menu]').first()
await card.hover();await more.click();await p.getByRole('menuitem',{name:/评测/}).click()
if(mode==='import'){
 await p.getByRole('button',{name:'导入用例',exact:true}).click()
 await p.locator('#eval-import-workbook').setInputFiles(root+'/public/templates/roll-dice.xlsx')
 const preview=p.getByText('预览：',{exact:false})
 await preview.waitFor();assert.match(await preview.innerText(),/4 条用例 · 5 个业务轮次/)
 await p.getByRole('button',{name:'确认新增 4 条用例'}).click()
} else await p.getByRole('button',{name:/生成(?:掷骰子|库存明细导出)用例/}).click()
await p.getByRole('button',{name:/运行全部/}).click();await p.getByRole('button',{name:'开始运行',exact:true}).click()
const repair=p.getByRole('button',{name:'分析并修复',exact:true})
await repair.waitFor({timeout:45000})
const iframe=p.frameLocator('iframe.eval-report-document')
const issue=iframe.locator('.issue a').first()
await issue.click()
const idx=kind==='skill'?2:0
const detail=iframe.locator('#case-'+idx).locator("..")
await detail.locator('.quality-detail details > summary').click()
assert.equal(await detail.locator('.quality-detail tbody tr').count(),8)
assert.match(await detail.innerText(),kind==='skill'?/97 \/ 100/:/94 \/ 100/)
console.log(mode,'首次报告已验证')
assert.deepEqual(errors,[])
if(mode!=='import'){
 await iframe.getByText(/统计中/).first().waitFor({state:'detached'})
 await p.getByRole('button',{name:'更多',exact:true}).click()
 const download=p.waitForEvent('download')
 await p.getByRole('menuitem',{name:'下载报告'}).click()
 await verifyDownloadedReport(p, await download, output+'/'+name+'-首测.html')
} else return
await repair.click()
await p.getByRole('radio',{name:/确认修复/}).click({timeout:45000})
await p.locator('[data-slot="question-confirm-area"] button').click()
await p.waitForFunction(()=>document.body.innerText.includes("上保存模拟修改"),{},{timeout:50000})
await p.getByRole('button',{name:'返回评测',exact:true}).click()
await p.getByRole('button',{name:'重新运行',exact:true}).click()
await p.getByRole('menuitem',{name:/本次全部用例/}).click()
await p.getByRole('button',{name:'开始运行',exact:true}).click()
await iframe.locator('.quality-numbers strong').filter({hasText:/^100$/}).waitFor({timeout:45000})
await iframe.getByText(/统计中/).first().waitFor({state:'detached'})
await p.getByRole('button',{name:'更多',exact:true}).click()
const dl=p.waitForEvent('download');await p.getByRole('menuitem',{name:'下载报告'}).click()
await verifyDownloadedReport(p, await dl, output+'/'+name+'-复测.html')
await p.reload();await iframe.locator('.quality-summary').waitFor()
assert.equal(await iframe.locator('.quality-numbers strong').textContent(),'100')
console.log(mode,'已验证确认修复、复测对照、导出和刷新。',errors)
assert.deepEqual(errors,[])
} catch(e) {console.error(mode,p.url(),(await p.locator('body').innerText()).slice(-2500));await p.screenshot({path:output+'/error-'+mode+'.png'});throw e}finally{await b.close()}
}
const jobs=await Promise.allSettled((process.argv.length>2 ? process.argv.slice(2) : ['skill','agent','import']).map(walk))
for(const r of jobs) if (r.status==='rejected') {console.error(String(r.reason));process.exitCode=1}
