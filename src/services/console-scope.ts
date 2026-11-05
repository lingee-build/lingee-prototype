import { consoleScopes, type SkillScope } from "@/mock/fixtures/dev"
import { latency } from "@/mock/latency"

/**
 * Console 的技能发布范围接口（mock）。Build 不存发布范围，每次展示都实时来这里取。
 * 在地址栏加 ?scopeFail=1 可以模拟接口失败，查看「加载失败，重试」和智能体提交被拦的效果。
 */
const store: Record<string, SkillScope> = structuredClone(consoleScopes)
const failing = () => typeof window !== "undefined" && new URLSearchParams(window.location.search).has("scopeFail")
const reject = <T>() => new Promise<T>((_, fail) => setTimeout(() => fail(new Error("scope service unavailable")), 500))

export const consoleScopeService = {
  /** 取单个已发布技能的发布范围；Console 没有记录时按都不开处理 */
  get: (name: string) => (failing() ? reject<SkillScope>() : latency(store[name] ?? { mall: false, build: false }, 450)),
  /** 批量取：智能体提交时判断引用的技能是不是商城技能 */
  getMany: (names: string[]) =>
    failing() ? reject<Record<string, SkillScope>>() : latency(Object.fromEntries(names.map((name) => [name, store[name] ?? { mall: false, build: false }])), 450),
  /** 技能商城里的技能（添加技能弹窗的「更多技能」页签用） */
  mallNames: () => latency(Object.keys(store).filter((name) => store[name].mall), 300),
  /** 首次发布时随提交带上的范围。原型不模拟审核，直接记到 Console */
  submitFirst(name: string, scope: SkillScope) {
    store[name] = scope
    return latency(true)
  },
}
