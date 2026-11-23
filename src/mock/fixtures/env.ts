/**
 * 开发时灵基环境与 AI 资源管理（US-2026-043955）演示数据。
 * 租户、环境地址、集群编号为虚构演示数据；场景开关与来源判定见 features/env-source/env-scenario.ts。
 */

export type EnvKey = "pro" | "sbx-01" | "sbx-02"

export interface LingeeEnv {
  id: EnvKey
  kind: "生产" | "测试"
  name: string
  clusterName: string
  clusterCode: string
  url: string
  status: "on" | "off"
  sandbox: boolean
  tenantCode: string
}

/** 当前登录租户（登录环境为生产；「直接登录测试环境」是演示场景开关） */
export const TENANT = { name: "金蝶软件（中国）有限公司", code: "KDEMO2026", loginEnv: "pro" as EnvKey, user: "邹茂桃" }

/** 客户名下全部灵基环境：生产 + 两个测试（一个启用、一个禁用，演示禁用口径） */
export const LINGEE_ENVS: LingeeEnv[] = [
  { id: "pro", kind: "生产", name: "金蝶软件（中国）有限公司", clusterName: "生产集群", clusterCode: "PROD", url: "https://app.lingee.com", status: "on", sandbox: false, tenantCode: "2490585124371802112" },
  { id: "sbx-01", kind: "测试", name: "金蝶软件（中国）有限公司 · 测试", clusterName: "测试集群", clusterCode: "SH-01", url: "https://test.lingee.com", status: "on", sandbox: true, tenantCode: "2490585124371804316" },
  { id: "sbx-02", kind: "测试", name: "金蝶软件（中国）有限公司 · 深圳测试", clusterName: "深圳测试集群", clusterCode: "SH-02", url: "https://sbx02-lingee.kingdee.com", status: "off", sandbox: true, tenantCode: "2490585124371805250" },
]

/**
 * 会话内来源告知样例（功能点 1 顺带告知）的默认回复：
 * 消费方 conversations.ts（预置样例会话）与 SessionPage（按场景实时替换），见 env-scenario.ts 的 sourceReplyOf。
 */
export const ENV_SOURCE_SAMPLE_REPLY = "当前资源来源环境（金蝶软件（中国）有限公司 · 测试，https://test.lingee.com）。订单查询相关的工具找到 12 个，……"

/** 现状保留区块（照录，本需求不改）：苍穹应用开发测试环境 */
export const LEGACY_COSMIC = {
  title: "苍穹应用开发 测试环境",
  desc: "适用版本：苍穹 V8.0.1 / 8.0.4 / 8.0.8 / 8.0.10+",
  card: { name: "ierpuat", tags: ["默认", "云端"], url: "https://ierpuat.kingdee.com/ierp" },
}
