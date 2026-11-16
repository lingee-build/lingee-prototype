import { create } from "zustand"
import { TENANT, type EnvKey } from "@/mock/fixtures/env"

/**
 * 开发时灵基环境与 AI 资源管理（US-2026-043955）演示场景开关与来源判定。
 * 开关造出 PRD §2 变体与异常口径（无测试环境 / 无可用 SaaS 连接器 / 登录测试环境 / 接口失败 / 后门 / 无身份 / 凭据过期）；
 * 来源只按默认规则判定（测试环境优先，需有可用 SaaS 连接器），不支持手动切换（2026-11-09 团队决议）。
 */

export interface ScenarioFlags {
  noSandbox: boolean
  noSaasConn: boolean
  loginTest: boolean
  envApiError: boolean
  /** 来源覆盖文件（后门，上线过渡）：内容正确时来源以文件配置为准（演示值＝生产） */
  srcOverride: boolean
  noIdentity: boolean
  credExpired: boolean
}

interface EnvScenarioState extends ScenarioFlags {
  /** 上一次来源判定（接口失败时保持，不作放行依据） */
  lastSource: EnvKey
  toggle: (key: keyof ScenarioFlags) => void
}

export const useEnvScenario = create<EnvScenarioState>((set) => ({
  noSandbox: false,
  noSaasConn: false,
  loginTest: false,
  envApiError: false,
  srcOverride: false,
  noIdentity: false,
  credExpired: false,
  lastSource: "sbx-01",
  toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<EnvScenarioState>),
}))

/** URL 直达演示场景（?env-scenario=no-sandbox,no-identity…）：刷新/分享链接后场景仍生效 */
const SCENARIO_QUERY_KEYS: Record<string, keyof ScenarioFlags> = {
  "no-sandbox": "noSandbox",
  "no-saas-conn": "noSaasConn",
  "login-test": "loginTest",
  "env-api-error": "envApiError",
  "src-override": "srcOverride",
  "no-identity": "noIdentity",
  "cred-expired": "credExpired",
}
{
  const keys = new URLSearchParams(location.search).get("env-scenario")?.split(",") ?? []
  const patch: Partial<ScenarioFlags> = {}
  keys.forEach((k) => { const key = SCENARIO_QUERY_KEYS[k.trim()]; if (key) patch[key] = true })
  if (Object.keys(patch).length) useEnvScenario.setState(patch)
}

/** 当前登录环境：默认生产；「直接登录测试环境」时为测试 */
export const loginEnvOf = (f: ScenarioFlags): EnvKey => (f.loginTest ? "sbx-01" : TENANT.loginEnv)

/** 资源来源判定（与 PRD 功能点 2 判定表同口径，优先级从上到下） */
export const sourceEnvOf = (f: ScenarioFlags & { lastSource: EnvKey }): EnvKey => {
  if (f.srcOverride) return "pro" // 来源覆盖文件（功能点 9 后门）：内容正确时来源以文件配置为准
  if (f.envApiError) return f.lastSource // 接口失败：保持上一次判定，不强制切换
  if (f.loginTest) return "sbx-01" // 登录测试环境：来源锁定测试
  if (f.noSandbox || f.noSaasConn) return "pro" // 无测试环境或无可用 SaaS 连接器：来源生产
  return "sbx-01" // 默认：测试环境优先（多个测试环境取第一个启用的）
}

/** 环境页警示口径（PRD §4 来源告知口径矩阵） */
export const envNoticeOf = (f: ScenarioFlags): { tone: "warn" | "info"; text: string } | undefined => {
  if (f.envApiError) return { tone: "warn", text: "环境信息获取失败，开发时可用的企业 AI 资源来源保持当前判定" }
  if (f.loginTest) return { tone: "info", text: "用户登录测试环境，生产环境资源不可用于开发" }
  if (f.noSaasConn) return { tone: "warn", text: "测试环境无可用 SaaS 连接器，开发时可用的企业 AI 资源从生产环境拉取" }
  if (f.noSandbox) return { tone: "warn", text: "没有测试环境或测试环境被禁用，开发时可用的企业 AI 资源从生产环境拉取" }
  return undefined
}

/** 本地 / 远端测试的准入拦截（功能点 4）：返回拦截文案；通过则执行并提示「已在测试环境执行」 */
export const testBlockOf = (f: ScenarioFlags): string | undefined => {
  if (f.noSandbox) return "Lingee 测试环境未就绪，暂无法测试"
  if (f.noIdentity) return "未获取到测试环境用户身份。请确认已配置测试环境并完成登录"
  if (f.credExpired) return "测试环境凭据已过期，请刷新凭据后重试"
  return undefined
}

/** 会话内 agent 拉取开发资源时的来源告知样例（功能点 1 顺带告知） */
export const sourceReplyOf = (f: ScenarioFlags & { lastSource: EnvKey }): string => {
  const source = sourceEnvOf(f)
  const env = source === "pro" ? "金蝶软件（中国）有限公司 · 生产，https://app.lingee.com" : "金蝶软件（中国）有限公司 · 测试，https://test.lingee.com"
  if (f.loginTest) return `用户登录测试环境，生产环境资源不可用于开发；开发时可用的企业 AI 资源来自测试环境（${env}）。订单查询相关的工具找到 12 个，……`
  if (f.srcOverride) return `来源覆盖文件生效：开发时可用的企业 AI 资源来源按文件配置（${env}）。订单查询相关的工具找到 12 个，……`
  return `当前资源来源环境（${env}）。订单查询相关的工具找到 12 个，……`
}

/** hook 形态：组件里读当前场景（登录环境、来源、警示与测试拦截口径一次拿全） */
export function useEnvSource() {
  const flags = useEnvScenario()
  return {
    flags,
    login: loginEnvOf(flags),
    source: sourceEnvOf(flags),
    notice: envNoticeOf(flags),
    testBlock: testBlockOf(flags),
  }
}
