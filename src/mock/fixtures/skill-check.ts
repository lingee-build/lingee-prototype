/** 技能检查的 mock：独立检查只跑规范/安全（分工见 US-2026-060940，资源存在性收敛到提交时点）；个别技能预置了不通过 / 警告的结果 */

export type CheckItemKey = "dir" | "yaml" | "body" | "script" | "kingdee" | "N1" | "N2" | "security" | "S1" | "N3"
export type CheckStatus = "pending" | "running" | "pass" | "fail" | "warn"
export interface CheckResult {
  status: CheckStatus
  /** 不通过 / 警告的原因（短句） */
  reason?: string
  /** 修复指引（去修复提示词里拼在原因后的括号详情） */
  detail?: string
}

/** 独立检查分组（检查步 / 检查页签渲染）：只含规范与安全 */
export const CHECK_CATEGORIES: Array<{ key: "spec" | "security"; items: CheckItemKey[] }> = [
  { key: "spec", items: ["dir", "yaml", "body", "script", "kingdee", "N1", "N2"] },
  { key: "security", items: ["security", "S1"] },
]

export const CHECK_ORDER = CHECK_CATEGORIES.flatMap((x) => x.items)

/** 提交时点口径分组（确认页不通过组 / 去修复明细用）：规范/安全来自独立检查，资源类为提交时 Console 实时检查结果 */
export const SUBMIT_CATEGORIES = [...CHECK_CATEGORIES, { key: "resource", items: ["N3" as CheckItemKey] }]
export const SUBMIT_ORDER = SUBMIT_CATEGORIES.flatMap((x) => x.items)

export const emptyCheckItems = () =>
  // 键集用 SUBMIT_ORDER（规范/安全 + N3）：检查循环只跑 CHECK_ORDER，但确认页/去修复按 SUBMIT_ORDER 读键——
  // 若只建规范/安全键，规范失败而资源无缺失的技能进确认页时 checkItems.N3 为 undefined（运行时报错）
  Object.fromEntries(SUBMIT_ORDER.map((key) => [key, { status: "pending" }])) as Record<CheckItemKey, CheckResult>

/** 预置的非通过结果：技能 id → 检查项 → 结果。没列出的项一律通过 */
export const presetCheckResults: Record<string, Partial<Record<CheckItemKey, CheckResult>>> = {
  // hr-assistant 项目：规范检查失败
  sk_leave: {
    yaml: { status: "fail", reason: "Frontmatter 缺少 name 字段", detail: "SKILL.md Frontmatter 中未找到必填的 name 字段" },
  },
  sk_ar: { N1: { status: "warn", reason: "SKILL.md 已达 18KB，建议把字段说明拆到 references/" } },
  // workspace 项目：合规声明失败 + 文件过大警告（与 sk_invoice 的失败预设错开，避免确认页两条修复指引文字雷同被误读为重复渲染）
  sk_expense: {
    kingdee: { status: "fail", reason: "缺少金蝶技能合规声明", detail: "SKILL.md 中未找到金蝶技能合规声明段落" },
    N1: { status: "warn", reason: "SKILL.md 已达 12KB，建议把费用类型说明拆到 references/" },
  },
  // scm-skills 项目：资源检查失败（MCP 工具不存在）
  sk_supplier: { N3: { status: "fail", reason: "引用工具不存在", detail: "在所有来源未找到 MCP 工具 supplier_score_query" } },
  // workspace 项目：资源检查三档演示——组件未发布（需先发布前置资源）、个人源工具（企业环境不可达）
  sk_invoice: {
    kingdee: { status: "fail", reason: "缺少金蝶技能合规声明", detail: "SKILL.md 中未找到金蝶技能合规声明段落" },
    S1: { status: "fail", reason: "动态安全扫描超时，未给出结论", detail: "沙箱内动态扫描 60 秒未完成，请重试或检查脚本是否存在长阻塞" },
    N3: { status: "fail", reason: "引用组件未发布", detail: "组件 'invoice-ocr' 未发布，请前往业务组件开发页发布，或去会话移除后重试" },
  },
  sk_contract: {
    yaml: { status: "fail", reason: "Frontmatter 缺少 name 字段", detail: "SKILL.md Frontmatter 中未找到必填的 name 字段" },
    security: { status: "fail", reason: "静态扫描发现提示词注入风险", detail: "正文中检测到疑似提示词注入片段，请检查用户输入拼接处" },
    N3: { status: "fail", reason: "引用个人源工具", detail: "MCP 工具 ocr_parse_receipt 来自个人源，企业环境无法访问" },
  },
}
