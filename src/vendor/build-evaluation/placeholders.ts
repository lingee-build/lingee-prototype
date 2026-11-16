export type PlaceholderData = Record<string, unknown>
type Context = { data: PlaceholderData; now: number; batchNo: string; sessionCode: string; turnIndex: number; vars: Record<string, string>; random?: () => number; uuid?: () => string }
const tokens = /\\?\{\{([^{}]+)\}\}/g
const time = /^(date|now|(?:week|month|quarter|year)(?:Start|End))((?:[+-]\d+[yQMwdHms])*)(?::(.+))?$/
const known = /^(?:date|now|timestamp|(?:week|month|quarter|year)(?:Start|End)|roundNum|roundStr|roundRange|roundPick|uuid|batchNo|sessionCode|turnIndex)(?:$|[:+-])/
const staticToken = /^diyJson(?:$|[.\[])/
const assignment = /^([\p{L}_][\p{L}\p{N}_]*)=(.*)$/u
const recognized = (body: string) => !/\s/.test(body) && (staticToken.test(body) || known.test(body) || body.startsWith("var.") || assignment.test(body))

export function parsePlaceholderData(text: string): PlaceholderData {
  const value: unknown = JSON.parse(text.trim() || "{}")
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("问题占位数据须为 JSON 对象")
  return value as PlaceholderData
}

export function hasPlaceholders(text: string) {
  return [...text.matchAll(tokens)].some(([raw, body]) => raw.startsWith("\\") || recognized(body))
}

function lookup(data: unknown, path: string) {
  const parts = path.replace(/\[(\d+)\]/g, ".$1").split(".")
  let value = data
  for (const key of parts) {
    if (!key || !value || typeof value !== "object" || !Object.hasOwn(value, key)) throw new Error("字段不存在")
    value = (value as PlaceholderData)[key]
  }
  return value
}

function staticValue(body: string, data: PlaceholderData) {
  const value = body === "diyJson" ? data : lookup(data, body.slice(7).replace(/^\./, "").replace(/^\[(\d+)\]/, "$1"))
  return typeof value === "string" ? value : JSON.stringify(value)
}

function dateValue(match: RegExpMatchArray, now: number) {
  const [, name, offsets, pattern] = match
  // Beijing civil time represented with UTC getters, independent of host TZ.
  const d = new Date(now + 8 * 3600_000)
  for (const [, number, unit] of offsets.matchAll(/([+-]\d+)([yQMwdHms])/g)) {
    const n = Number(number)
    if (name === "date" && /[Hms]/.test(unit)) throw new Error("date 只支持天及以上偏移")
    if (/[yQM]/.test(unit)) {
      const day = d.getUTCDate()
      d.setUTCDate(1)
      d.setUTCMonth(d.getUTCMonth() + n * (unit === "y" ? 12 : unit === "Q" ? 3 : 1))
      const end = new Date(d)
      end.setUTCMonth(end.getUTCMonth() + 1, 0)
      d.setUTCDate(Math.min(day, end.getUTCDate()))
    } else {
      const scale = { w: 604800, d: 86400, H: 3600, m: 60, s: 1 }[unit]
      d.setTime(d.getTime() + n * scale! * 1000)
    }
  }
  const boundary = name.match(/^(week|month|quarter|year)(Start|End)$/)
  if (boundary) {
    const [, period, edge] = boundary
    const end = edge === "End"
    const m = d.getUTCMonth()
    if (period === "week") d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7 + (end ? 6 : 0))
    if (period === "month") d.setUTCMonth(m + Number(end), end ? 0 : 1)
    if (period === "quarter") d.setUTCMonth(Math.floor(m / 3) * 3 + (end ? 3 : 0), end ? 0 : 1)
    if (period === "year") d.setUTCMonth(end ? 12 : 0, end ? 0 : 1)
    d.setUTCHours(0, 0, 0, 0)
  }
  if (!Number.isFinite(d.getTime())) throw new Error("日期超出范围")
  const pad = (n: number, width = 2) => String(n).padStart(width, "0")
  const y = d.getUTCFullYear(), M = d.getUTCMonth() + 1, day = d.getUTCDate(), H = d.getUTCHours()
  const m = d.getUTCMinutes(), s = d.getUTCSeconds(), h = H % 12 || 12
  const weekday = "日一二三四五六"[d.getUTCDay()]
  const fields = { yyyy: pad(y, 4), YYYY: pad(y, 4), yy: pad(y % 100), MM: pad(M), M, dd: pad(day), DD: pad(day), d: day,
    HH: pad(H), H, hh: pad(h), h, mm: pad(m), m, ss: pad(s), s, SSS: pad(d.getUTCMilliseconds(), 3),
    Q: Math.ceil(M / 3), E: "周" + weekday, EEEE: "星期" + weekday, a: H < 12 ? "上午" : "下午" }
  return (pattern ?? (name === "now" ? "yyyy-MM-dd HH:mm:ss" : "yyyy-MM-dd"))
    .replace(/'([^']*)'|yyyy|YYYY|EEEE|SSS|yy|MM|dd|DD|HH|hh|mm|ss|[M dHhmsQEa]/g,
      (raw, literal) => literal ?? fields[raw as keyof typeof fields] ?? raw)
}

function resolve(body: string, ctx: Context): string {
  const random = ctx.random ?? Math.random
  if (staticToken.test(body)) return staticValue(body, ctx.data)
  const assigned = body.match(assignment)
  if (assigned) {
    if (!recognized(assigned[2]) || assignment.test(assigned[2])) throw new Error("变量定义无效")
    const value = resolve(assigned[2], ctx)
    Object.defineProperty(ctx.vars, assigned[1], { value, enumerable: true, writable: true, configurable: true })
    return value
  }
  if (body.startsWith("var.")) {
    const key = body.slice(4)
    if (!Object.hasOwn(ctx.vars, key)) throw new Error("变量未定义")
    return ctx.vars[key]
  }
  const date = body.match(time)
  if (date) return dateValue(date, ctx.now)
  if (body === "timestamp") return String(ctx.now)
  if (body === "timestamp:s") return String(Math.floor(ctx.now / 1000))
  if (body === "uuid") return (ctx.uuid ?? (() => crypto.randomUUID()))()
  if (body === "batchNo" || body === "sessionCode" || body === "turnIndex") return String(ctx[body])
  const [kind, arg] = body.split(/:(.*)/s)
  const pick = (values: string) => values[Math.floor(random() * values.length)]
  if (kind === "roundNum" || kind === "roundStr") {
    const digits = kind === "roundNum"
    const size = arg === undefined ? (digits ? 4 : 8) : /^\d+$/.test(arg) ? Number(arg) : 0
    if (size < 1 || size > (digits ? 32 : 64)) throw new Error("随机长度无效")
    return Array.from({ length: size }, (_, i) => pick(digits ? (i ? "0123456789" : "123456789") : "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")).join("")
  }
  if (kind === "roundPick" && arg) {
    const choices = arg.split("|")
    if (choices.every(Boolean)) return choices[Math.floor(random() * choices.length)]
  }
  if (kind === "roundRange" && arg) {
    const [min, max, precision, ...extra] = arg.split(",")
    if (!extra.length && [min, max].every(v => /^-?\d+(?:\.\d+)?$/.test(v ?? ""))) {
      const places = precision === undefined ? Math.max(min.split(".")[1]?.length ?? 0, max.split(".")[1]?.length ?? 0) : /^\d+$/.test(precision) ? Number(precision) : -1
      const scale = 10 ** places
      const lo = Math.ceil(Number(min) * scale - 1e-9), hi = Math.floor(Number(max) * scale + 1e-9)
      if (places >= 0 && places <= 15 && Number.isSafeInteger(lo) && Number.isSafeInteger(hi) && Number.isSafeInteger(hi - lo + 1) && lo <= hi)
        return ((lo + Math.floor(random() * (hi - lo + 1))) / scale).toFixed(places)
    }
  }
  throw new Error("占位符参数无效")
}

export function renderPlaceholders(text: string, options:
  | { mode: "preview" | "expected"; data: PlaceholderData }
  | { mode: "send"; context: Context }) {
  const errors: string[] = []
  const dynamic: string[] = []
  const value = text.replace(tokens, (raw, body: string) => {
    if (raw.startsWith("\\")) return raw.slice(1)
    if (!recognized(body)) return raw
    try {
      if (options.mode === "send") return resolve(body, options.context)
      if (staticToken.test(body)) return staticValue(body, options.data)
      if (options.mode === "expected") throw new Error("预期答案仅支持静态 diyJson")
      const expression = body.match(assignment)?.[2] ?? body
      if (!expression.startsWith("var.")) {
        if (!recognized(expression) || assignment.test(expression)) throw new Error("变量定义无效")
        // Check deterministic errors without touching the run clock, RNG or variables.
        resolve(expression, {
          data: options.data, now: Date.UTC(2026, 0, 1), batchNo: "", sessionCode: "", turnIndex: 1,
          vars: {}, random: () => 0, uuid: () => "",
        })
      }
      dynamic.push(raw)
      return raw
    } catch (error) {
      errors.push(raw + "：" + (error instanceof Error ? error.message : String(error)))
      return raw
    }
  })
  return { value, errors, dynamic }
}
