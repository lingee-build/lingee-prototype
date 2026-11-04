// 运行：PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/report-preview.browser.mjs
// 先启动 bun run dev；测试只使用独立 fixture 页面，不写业务数据。
import assert from "node:assert/strict"
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || "playwright")
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL })
try {
  const page = await browser.newPage()
  const errors = []
  page.on("pageerror", error => errors.push(error.message))
  await page.goto(`${process.env.REPORT_TEST_URL || "http://127.0.0.1:5180"}/scripts/fixtures/report-preview.html`)
  const frame = page.frameLocator("iframe")
  await frame.locator("#case-0 > summary").click()
  await frame.locator("#case-0-round-0 > summary").click()
  await page.locator(".eval-report-metadata summary").click()
  const before = await page.evaluate(() => {
    const doc = document.querySelector("iframe").contentDocument
    const summary = doc.querySelector("#case-0-round-0 > summary")
    summary.focus()
    const text = doc.querySelector('#case-0-round-0 [data-report-key="field-实际回复"] p').firstChild
    doc.getSelection().setBaseAndExtent(text, 1, text, 7)
    window.savedEvidence = text
    window.savedFocus = summary
    window.savedCase = doc.querySelector("#case-0")
    return { selection: doc.getSelection().toString(), time: document.querySelector(".eval-report-metadata .run-duration").textContent }
  })
  await page.waitForTimeout(1100)
  await page.evaluate(() => window.refreshReport())
  await page.waitForFunction(time => document.querySelector(".eval-report-metadata .run-duration").textContent !== time, before.time)
  const check = async () => page.evaluate(() => {
    const doc = document.querySelector("iframe").contentDocument
    return { selection: doc.getSelection().toString(), sameText: window.savedEvidence === doc.querySelector('#case-0-round-0 [data-report-key="field-实际回复"] p').firstChild, focus: doc.activeElement === window.savedFocus, sameCase: doc.querySelector("#case-0") === window.savedCase, caseOpen: doc.querySelector("#case-0").open, roundOpen: doc.querySelector("#case-0-round-0").open, metadataOpen: document.querySelector(".eval-report-metadata details").open }
  })
  const expected = { selection: before.selection, sameText: true, focus: true, sameCase: true, caseOpen: true, roundOpen: true, metadataOpen: true }
  assert.deepEqual(await check(), expected, "计时刷新保持选区、焦点和全部展开状态")
  await page.locator(".eval-report-metadata summary").focus()
  const metadataTime = await page.locator(".eval-report-metadata .run-duration").textContent()
  await page.waitForTimeout(1100)
  await page.evaluate(() => window.refreshReport())
  await page.waitForFunction(time => document.querySelector(".eval-report-metadata .run-duration").textContent !== time, metadataTime)
  assert.equal(await page.locator(".eval-report-metadata summary").evaluate(el => document.activeElement === el), true, "顶部计时刷新不移走焦点")
  await page.evaluate(() => {
    window.savedFocus.focus()
    const selection = document.querySelector("iframe").contentDocument.getSelection()
    selection.setBaseAndExtent(window.savedEvidence, 1, window.savedEvidence, 7)
    window.refreshReport(true)
  })
  await frame.locator(".conclusion-lead").filter({ hasText: "通过率 0%" }).waitFor()
  assert.deepEqual(await check(), expected, "终态及插入工具证据不替换既有回复节点")
  assert.equal(await frame.locator('#case-0-round-0 [data-report-key="field-工具返回"] p').textContent(), "新增工具结果")
  await page.locator(".eval-report-metadata summary").focus()
  await page.evaluate(() => window.refreshReport())
  assert.equal(await page.locator(".eval-report-metadata summary").evaluate(el => document.activeElement === el), true)
  await frame.locator("[data-cases]").click()
  await frame.locator("[data-cases]").click()
  assert.equal(await frame.locator("details.case[open]").count(), 0, "全部折叠仍可操作")
  assert.deepEqual(errors, [])
  console.log("PASS：计时与终态更新、正文选区、键盘焦点、证据节点、用例／轮次／顶部展开状态及折叠操作")
} finally { await browser.close() }
