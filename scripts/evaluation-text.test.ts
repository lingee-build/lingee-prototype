import { test, expect } from "bun:test"
import { matchEvaluationText, evaluationRegex, normalizeEvaluationText, suggestEvaluationRegex } from "../src/services/evaluation-text"
import { responseText } from "../src/services/evaluation"
test("字面匹配区分大小写、保留 Markdown 与空格，只统一换行", () => {
  expect(matchEvaluationText("abc", "ABC", "all")).toBe(false)
  expect(matchEvaluationText("未完成", "完成", "all")).toBe(true)
  expect(matchEvaluationText("**完成**", "**", "all")).toBe(true)
  expect(matchEvaluationText("未 完成", "未完成", "all")).toBe(false)
  expect(normalizeEvaluationText("a\r\nb\rc")).toBe("a\nb\nc")
  expect(matchEvaluationText("完成", "失败\n完成", "any")).toBe(true)
  expect(matchEvaluationText("完成", "失败", "none")).toBe(true)
})
test("正则默认无 flags，匹配任意子串，空回复与缺失回复分别处理", () => {
  expect(evaluationRegex("a").flags).toBe("")
  expect(matchEvaluationText("cat", "a", "regex")).toBe(true)
  expect(matchEvaluationText("a\nb", "a.b", "regex")).toBe(false)
  expect(matchEvaluationText("a\nb", "^b", "regex")).toBe(false)
  expect(matchEvaluationText(undefined, "禁词", "none")).toBeUndefined()
  expect(matchEvaluationText("", "禁词", "none")).toBe(true)
  expect(matchEvaluationText("", "^$", "regex")).toBe(true)
  expect(responseText({ response: "", responseRecorded: true })).toBe("最终回复为空")
  expect(responseText({ response: "", responseRecorded: false })).toBe("未记录实际回复")
})

test("正则辅助按用户指定长度生成，不附加数字段位数上限", () => {
  const result = suggestEvaluationRegex("CODE- 开头，后接 101 位数字")
  expect(result).toBeDefined()
  expect(result!.pattern).toContain("{101}")
  expect(matchEvaluationText("CODE-" + "1".repeat(101), result!.pattern, "regex")).toBe(true)
  expect(matchEvaluationText("CODE-" + "1".repeat(100), result!.pattern, "regex")).toBe(false)
  expect(matchEvaluationText("", result!.pattern, "regex")).toBe(false)
  expect(suggestEvaluationRegex("CODE- 开头，后接 9007199254740993 位数字")).toBeUndefined()
})
