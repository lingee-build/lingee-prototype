import { expect, test } from "bun:test"
import JSZip from "jszip"
import { openEvaluationImport } from "../src/services/evaluation-import-package"

async function archive(entries: Record<string, string>) {
  const zip = new JSZip()
  for (const [name, text] of Object.entries(entries)) zip.file(name, text)
  return new File([await zip.generateAsync({ type: "arraybuffer" })], "用例.zip")
}

test("ZIP 以文件名匹配各目录中的引用附件，忽略额外文件和 Mac 元数据", async () => {
  const file = await archive({
    "用例/模板.xlsx": "workbook",
    "用例/附件/首轮.csv": "session",
    "其他目录/续轮.csv": "turn",
    "其他目录/无关.csv": "extra",
    "__MACOSX/._模板.xlsx": "metadata",
  })
  const bundle = await openEvaluationImport(file, key => key)
  expect(bundle.workbook.name).toBe("模板.xlsx")
  const files = await bundle.attachments(["首轮.csv", "续轮.csv", "缺失.csv"])
  expect(await Promise.all(files.map(async file => [file.name, await file.text()]))).toEqual([
    ["首轮.csv", "session"], ["续轮.csv", "turn"],
  ])
})

test("ZIP 拒绝歧义工作簿及重名引用附件", async () => {
  const multiple = await archive({ "甲.xlsx": "a", "乙.xlsx": "b" })
  await expect(openEvaluationImport(multiple, key => key)).rejects.toThrow("有且只有一份")
  const duplicate = await archive({ "甲.xlsx": "a", "一/附件.csv": "1", "二/附件.csv": "2" })
  const bundle = await openEvaluationImport(duplicate, key => key)
  await expect(bundle.attachments(["附件.csv"])).rejects.toThrow("同名引用附件")
})
