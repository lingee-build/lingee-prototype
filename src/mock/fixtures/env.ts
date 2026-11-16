import type { KnowledgeCategory } from "./knowledge"

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

/** 现状保留区块（照录，本需求不改）：苍穹应用开发测试环境 */
export const LEGACY_COSMIC = {
  title: "苍穹应用开发 测试环境",
  desc: "适用版本：苍穹 V8.0.1 / 8.0.4 / 8.0.8 / 8.0.10+",
  card: { name: "ierpuat", tags: ["默认", "云端"], url: "https://ierpuat.kingdee.com/ierp" },
}

/**
 * 智能体「+ 添加 → 更多技能」清单按来源环境两套：
 * 测试环境 = 本原型技能列表里的已发布技能（消费方按 everPublished 过滤）；
 * 生产环境 = 虚构演示数据（测试环境里没有的技能，用来演示清单差异）。
 */
export const PROD_SKILL_POOL = [
  { name: "订单全链路查询", skillName: "order-chain-query", desc: "查询订单从下单到发货的全链路状态，支持按订单号、客户与时间范围筛选" },
  { name: "合同条款摘要", skillName: "contract-clause-summary", desc: "对上传的合同文件按条款分段摘要，标出付款、违约与续约关键项" },
  { name: "数据报表生成", skillName: "data-report-generate", desc: "按数据集配置生成分析报表并导出为 Excel，支持定时刷新" },
  { name: "客户案例检索", skillName: "customer-case-search", desc: "按行业与产品线检索相似客户案例，输出方案参考摘要" },
]

const dir = (id: string, name: string, count: number): KnowledgeCategory => ({ id, name, count, children: [] })

/** 企业知识文件夹树按来源两套：测试环境沿用 knowledgeTree（现状），生产环境为虚构演示数据 */
export const PROD_KNOWLEDGE_TREE: KnowledgeCategory[] = [
  dir("kc_prod_rpt", "经营分析报告", 9),
  dir("kc_prod_case", "客户案例库", 21),
  dir("kc_prod_release", "产品发布说明", 7),
  dir("kc_prod_finance", "财务制度文档", 13),
]
