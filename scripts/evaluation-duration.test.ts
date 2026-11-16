import { expect, test } from "bun:test"
import { caseDuration, durationText, formatDuration, runDuration } from "../src/services/evaluation-duration"
import type { EvalResult, EvalRun } from "../src/services/evaluation"

const result: EvalResult = { id: "case", name: "示例", input: "", expected: "", source: "none", outcome: "passed", status: "passed", response: "", evidence: "", tool: "", timing: { started: 3000, ended: 5500 } }
const run: EvalRun = { id: "run", name: "示例", started: 1000, ended: 5500, status: "completed", results: [result] }

test("耗时单位覆盖零值、亚秒、分和小时，不舍入成超出实际的整分钟", () => {
  for (const [ms, label] of [[0, "0 秒"], [300, "不足 1 秒"], [2500, "2.5 秒"], [59999, "59.9 秒"], [60000, "1 分 00 秒"], [62000, "1 分 02 秒"], [3723000, "1 小时 02 分 03 秒"]] as const) expect(formatDuration(ms)).toBe(label)
})

test("整体耗时按起止时间，单例排除排队；结束后不随当前时间增长", () => {
  expect(runDuration(run, 100000)).toEqual({ text: "4.5 秒", running: false, milliseconds: 4500 })
  expect(caseDuration(result, run, 100000)).toEqual({ text: "2.5 秒", running: false, milliseconds: 2500 })
  for (const status of ["running", "judging", "stopping", "stop_unconfirmed"] as const) {
    const active = { ...run, status, ended: undefined }
    expect(durationText(runDuration(active, 7000))).toBe("6 秒（计时中）")
    expect(durationText(caseDuration({ ...result, status: "running", timing: { started: 3000 } }, active, 7000))).toBe("4 秒（计时中）")
    expect(caseDuration(result, active, 7000).milliseconds).toBe(2500)
  }
  expect(caseDuration({ ...result, judging: true, timing: { started: 3000 } }, { ...run, status: "judging" }, 7000).running).toBe(true)
})

test("待执行、未执行和计时缺失分开，非法时间不显示负数或伪造零耗时", () => {
  expect(caseDuration({ ...result, status: "pending", timing: {} }, run).text).toBe("待执行")
  expect(caseDuration({ ...result, status: "skipped", timing: {} }, run).text).toBe("未执行")
  expect(caseDuration({ ...result, timing: undefined }, run).text).toBe("未记录")
  expect(caseDuration({ ...result, timing: { started: 3000 } }, run).text).toBe("未记录")
  for (const value of [{ ...run, ended: undefined }, { ...run, ended: 500 }, { ...run, started: NaN }, { ...run, ended: Infinity }]) expect(runDuration(value).text).toBe("未记录")
  expect(runDuration({ ...run, started: 0, ended: 0 }).text).toBe("0 秒")
})
