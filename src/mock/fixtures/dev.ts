export type ReviewStatus = "saved" | "submitted" | "published" | "rejected"

/**
 * 发布范围：两个独立开关。Build 不存这份数据，展示时都从 Console 取（见 services/console-scope.ts）；
 * 只在首次发布时由 Build 随提交带上默认值或开发者勾选的值。
 */
export interface SkillScope {
  /** 上架技能商城 */
  mall: boolean
  /** 下发 Build */
  build: boolean
}

export interface Skill {
  id: string
  name: string
  displayName: string
  desc: string
  category: string
  projectId: string
  /** 个人通道是否已安装 */
  personalInstalled: boolean
  /** 企业分发通道的审核状态 */
  enterpriseStatus: ReviewStatus
  /** 是否发布过：从未发布过的技能（含首次提交被驳回、撤回）再次提交仍算首次发布，可以选发布范围 */
  everPublished?: boolean
  /** 随哪个智能体一起审核中（审核锁）：有值时技能不能单独提交或撤回，只能撤回整个智能体 */
  auditAgentId?: string
  /** 提交后本地又有修改，卡片上出现「云朵」提示继续提交 */
  changed?: boolean
  reason?: string
  /** 上次检查结论；没检查过则为空 */
  inspect?: "pass" | "fail"
}

export type ModelLevel = "auto" | "fast" | "expert" | "ultra"

/** 智能体里挂的一条技能（对应 assistant.json 的 skills 项） */
export interface AgentSkill {
  id: string
  name: string
  skillName: string
  desc: string
  builtin?: boolean
  /** 添加时的来源：本地技能（本项目）/ 更多技能（技能商城） */
  source?: "local" | "marketplace"
  publishStatus?: "unpublished" | "reviewing" | "published"
}

/** 智能体挂载的一条知识关联：企业知识按目录关联，个人知识按单篇文档 */
export interface KnowledgeBinding {
  id: string
  name: string
  path: string
  kind: "catalog" | "document"
  scope: "enterprise" | "personal"
  updatedAt?: string
  /** 仅个人知识：文件大小与审核状态（0 待审核 / 1 已驳回 / 2 已通过） */
  size?: number
  status?: 0 | 1 | 2
  reviewComment?: string
}

export interface AgentChangeRecord {
  createdAt: string
  operator: string
  summary: string
}

export interface AgentVersion {
  version: string
  releasedAt: string
  operator: string
  summary?: string
  lines: string[]
}

export interface Agent {
  /** 智能体编码，同时是目录名 */
  id: string
  projectId: string
  name: string
  desc: string
  avatar: string
  status: ReviewStatus
  /** 云端审核状态；本地有未提交修改时卡片显示「已保存」并用它做提示 */
  backendStatus?: ReviewStatus
  isChanged?: boolean
  rejectionRemark?: string
  domain: string
  preset?: boolean
  createdAt: string
  allowModelSwitch?: boolean
  defaultModelLevel?: ModelLevel
  role: string
  skills: AgentSkill[]
  knowledge: KnowledgeBinding[]
  changelog: { pending: AgentChangeRecord[]; versions: AgentVersion[] }
}

export type McpAppStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "OFFLINE"

export interface McpApp {
  appCode: string
  appName: string
  appDescription: string
  projectId: string
  /** 线上状态；空字符串 = 暂存（从未提交） */
  mcpStatus: McpAppStatus | ""
  /** 本地构建状态：null 未构建 / success 已构建 */
  buildStatus: string | null
  tested: boolean
  /** source 源码包可重新构建；dist 成品包没有源码 */
  packageKind: "source" | "dist" | null
  version: string
  artifacts: Array<{ version: string; createdAt: string; changeDesc: string }>
  /** info.json 内容，检查页签按它逐项核对 */
  info: Record<string, unknown> | null
  reviewRemark?: string
}

/**
 * 演示数据覆盖的情况：
 * - 发货通知单查询：已上架商城、本地有修改 → 引用它的智能体要等它单独审核通过才能提交
 * - 即时库存查询：发布后的修改正在单独审核（审核锁）
 * - 采购订单下推入库：首次发布被驳回
 * - 办理请假申请 / 薪资条查询与解释：单独审核中
 * - 费用报销提交 / 应收账龄分析：未提交 → 引用它们的智能体不能提交
 * - 供应商准入核查：首次发布正在单独审核（审核锁）
 * - 价格表批量调价：已发布，下发 Build
 * - 客户信用评估：已发布、本地有修改 → 需先提交
 */
const rawSkills: Skill[] = [
  { id: "sk_delivery", name: "delivery-notice-query", displayName: "发货通知单查询", desc: "按单据编号、状态和通知日期组合筛选发货通知单，返回分页列表或物料行明细，查询为空时提示调整条件。", category: "供应链", projectId: "scm-skills", personalInstalled: true, enterpriseStatus: "published", inspect: "pass", changed: true },
  { id: "sk_stock", name: "realtime-stock-query", displayName: "即时库存查询", desc: "按物料、仓库、仓位查询即时库存与可用量，支持批号与辅助属性维度展开。", category: "供应链", projectId: "scm-skills", personalInstalled: true, enterpriseStatus: "submitted", everPublished: true },
  { id: "sk_purchase", name: "purchase-order-push", displayName: "采购订单下推入库", desc: "校验采购订单可入库数量后下推生成采购入库单，超收时给出明确提示并阻止提交。", category: "供应链", projectId: "scm-skills", personalInstalled: false, enterpriseStatus: "rejected", reason: "缺少超收场景的处理说明，请补充后重新提交。", inspect: "fail" },
  { id: "sk_leave", name: "leave-request", displayName: "办理请假申请", desc: "通过对话收集假期类型、起止日期、事由与代理人，自动校验剩余假期天数，生成请假单草稿并在确认后提交。", category: "人力资源", projectId: "hr-assistant", personalInstalled: true, enterpriseStatus: "submitted", inspect: "pass" },
  { id: "sk_expense", name: "expense-claim-submit", displayName: "费用报销提交", desc: "分步收集费用类型、金额、发生日期和票据附件，超过限额时提醒走额外审批流程。", category: "财务", projectId: "workspace", personalInstalled: false, enterpriseStatus: "saved" },
  { id: "sk_salary", name: "payslip-explain", displayName: "薪资条查询与解释", desc: "查询指定月份薪资条，并用通俗语言解释各项扣款与补贴的计算依据。", category: "人力资源", projectId: "hr-assistant", personalInstalled: true, enterpriseStatus: "submitted", everPublished: true },
  { id: "sk_supplier", name: "supplier-onboarding-check", displayName: "供应商准入核查", desc: "汇总供应商资质、历史交付与质量评分，输出准入建议和风险点清单。", category: "供应链", projectId: "scm-skills", personalInstalled: false, enterpriseStatus: "submitted" },
  { id: "sk_price", name: "price-batch-adjust", displayName: "价格表批量调价", desc: "按物料分组或供应商批量调整采购价格表，支持按百分比或固定金额调价，调价前先给出影响范围预览。", category: "供应链", projectId: "scm-skills", personalInstalled: false, enterpriseStatus: "published" },
  { id: "sk_ar", name: "ar-aging-analysis", displayName: "应收账龄分析", desc: "按客户与账期区间统计应收余额，标记逾期重点客户并给出催收优先级。", category: "财务", projectId: "workspace", personalInstalled: false, enterpriseStatus: "saved" },
  { id: "sk_credit", name: "customer-credit-check", displayName: "客户信用评估", desc: "结合历史回款、逾期次数与授信额度评估客户信用等级，给出是否放单的建议。", category: "财务", projectId: "workspace", personalInstalled: false, enterpriseStatus: "published", changed: true, inspect: "pass" },
]
/** 发布过 = 已发布，或者显式标记（发布后的修改正在审核） */
export const skills: Skill[] = rawSkills.map((skill) => ({ ...skill, everPublished: skill.everPublished ?? skill.enterpriseStatus === "published" }))

/**
 * Console 侧的发布范围（只给已发布的技能）。Build 不存，每次展示都从这里取。
 * 存量技能怎么换算成两个开关由 Console 处理，Build 直接用返回值。
 */
export const consoleScopes: Record<string, SkillScope> = {
  "delivery-notice-query": { mall: true, build: false },
  "realtime-stock-query": { mall: false, build: false },
  "payslip-explain": { mall: false, build: false },
  "price-batch-adjust": { mall: false, build: true },
  "customer-credit-check": { mall: false, build: false },
}

const skillRef = (id: string, source: AgentSkill["source"] = "local"): AgentSkill => {
  const skill = skills.find((x) => x.id === id)!
  return {
    id: skill.name,
    name: skill.displayName,
    skillName: skill.name,
    desc: skill.desc,
    source,
    publishStatus: skill.enterpriseStatus === "submitted" ? "reviewing" : skill.everPublished ? "published" : "unpublished",
  }
}

const catalog = (id: string, name: string, path: string): KnowledgeBinding => ({ id, name, path, kind: "catalog", scope: "enterprise", updatedAt: "2026-09-18T08:00:00Z" })

const role = (name: string, duty: string, rules: string[]) =>
  `# 角色\n你是「${name}」，${duty}\n\n# 工作方式\n${rules.map((rule, i) => `${i + 1}. ${rule}`).join("\n")}\n\n# 边界\n- 不确定的制度条款先检索知识库，查不到就明确告知并建议联系对应负责人\n- 涉及提交、审批等写操作前，必须向用户复述关键信息并得到确认`

export const agents: Agent[] = [
  {
    id: "scm-collab-assistant", projectId: "scm-skills", name: "供应链协同助手", desc: "覆盖采购、库存、发货全链路的问答与单据处理，能够跨单据追溯上下游关系。", avatar: "/preset-agent-avatar-1.png",
    status: "published", backendStatus: "published", domain: "supply-chain", preset: true, createdAt: "2026-03-02T02:00:00Z", defaultModelLevel: "expert",
    role: role("供应链协同助手", "负责解答采购、库存、发货相关问题，并协助处理单据。", ["先确认用户关心的单据类型与组织范围", "查询结果用表格呈现，超过 20 行时先给汇总", "发现上下游数量不一致时主动提示"]),
    skills: [skillRef("sk_delivery"), skillRef("sk_stock")], knowledge: [catalog("kc_scm", "供应链制度", "供应链制度")],
    changelog: {
      pending: [
        { createdAt: "2026-10-15T08:20:00Z", operator: "张乐", summary: "优化采购订单查询规则，补充组织与日期筛选。" },
      ],
      versions: [
        { version: "1.0.0", releasedAt: "2026-09-18T01:30:00Z", operator: "梁平贤", summary: "供应链协同助手首次发布", lines: ["接入采购、库存、发货查询技能，支持上下游单据追溯。", "关联供应链制度知识库，提供业务流程问答。"] },
        { version: "1.0.1", releasedAt: "2026-10-10T06:00:00Z", operator: "张乐", summary: "完善销售履约协同能力", lines: ["接入销售履约智能体，支持订单到回款的进度跟踪。"] },
      ],
    },
  },
  {
    id: "hr-assistant", projectId: "hr-assistant", name: "HR 智能助手", desc: "解答假期、薪资、入转调离等员工高频问题，并可代为发起请假与证明开具。", avatar: "/preset-agent-avatar-2.png",
    status: "submitted", backendStatus: "submitted", domain: "hr", createdAt: "2026-08-21T03:20:00Z", allowModelSwitch: true, defaultModelLevel: "auto",
    role: role("HR 智能助手", "面向全体员工解答人事制度问题，并代办请假、开具证明等事务。", ["回答制度问题时引用知识库原文并给出条款出处", "办理请假前校验剩余假期天数", "薪资类问题只回答本人数据"]),
    skills: [skillRef("sk_leave"), skillRef("sk_salary")],
    knowledge: [
      catalog("kc_hr_attendance", "考勤与假期", "人事制度/考勤与假期"),
      catalog("kc_hr_salary", "薪酬福利", "人事制度/薪酬福利"),
      { id: "kp_1", name: "2026 年度调休安排.pdf", path: "2026 年度调休安排.pdf", kind: "document", scope: "personal", size: 482133, status: 0, updatedAt: "2026-09-28T06:12:00Z" },
    ],
    changelog: {
      pending: [],
      versions: [
        { version: "1.0.0", releasedAt: "2026-08-25T09:30:00Z", operator: "梁平先", lines: [] },
        { version: "1.0.1", releasedAt: "2026-09-12T07:10:00Z", operator: "梁平先", summary: "补充薪资条解释能力", lines: ["新增技能「薪资条查询与解释」", "知识范围调整：新增关联 目录「薪酬福利」"] },
      ],
    },
  },
  {
    id: "expense-advisor", projectId: "workspace", name: "财务报销顾问", desc: "指导员工按制度填写报销单，自动识别票据并校验费用标准。", avatar: "/preset-agent-avatar-3.png",
    status: "saved", domain: "finance", createdAt: "2026-09-30T08:00:00Z",
    role: role("财务报销顾问", "帮助员工按公司费用制度完成报销。", ["先问清费用类型与发生日期", "超过标准的费用提示需要额外审批", "票据不清晰时请用户重新上传"]),
    skills: [skillRef("sk_expense"), skillRef("sk_delivery", "marketplace"), skillRef("sk_price", "marketplace")], knowledge: [catalog("kc_fin_expense", "费用报销制度", "财务制度/费用报销制度")],
    changelog: { pending: [{ createdAt: "2026-09-30T08:00:00Z", operator: "梁平先", summary: "创建智能体" }], versions: [] },
  },
  {
    id: "supplier-access-review", projectId: "scm-skills", name: "供应商准入评估", desc: "结合资质文件与历史绩效给出准入评分，输出结构化评估报告。", avatar: "/avatar-agent-1.png",
    status: "rejected", backendStatus: "rejected", rejectionRemark: "知识库引用的评分标准已过期，请更新后重新提交。", domain: "supply-chain", createdAt: "2026-09-05T02:40:00Z",
    role: role("供应商准入评估", "根据资质与历史绩效评估供应商是否可以准入。", ["逐项核对资质文件有效期", "历史交付与质量数据不足时在报告里注明", "输出评分与风险点清单"]),
    skills: [skillRef("sk_supplier")], knowledge: [catalog("kc_scm_supplier", "供应商管理", "供应链制度/供应商管理")],
    changelog: { pending: [], versions: [{ version: "1.0.0", releasedAt: "2026-09-06T03:00:00Z", operator: "梁平先", lines: [] }] },
  },
  {
    id: "onboarding-guide", projectId: "hr-assistant", name: "新员工入职指引", desc: "按岗位生成入职待办清单，逐项引导完成账号开通、制度学习与设备领用。", avatar: "/avatar-agent-2.png",
    status: "saved", backendStatus: "published", isChanged: true, domain: "hr", createdAt: "2026-07-14T05:00:00Z",
    role: role("新员工入职指引", "陪伴新员工完成入职第一周的各项事务。", ["按岗位给出待办清单并跟进完成情况", "制度学习类内容给出原文链接", "遇到账号或设备问题引导联系 IT 服务台"]),
    skills: [], knowledge: [catalog("kc_hr_onboard", "入职与转正", "人事制度/入职与转正")],
    changelog: {
      pending: [
        { createdAt: "2026-10-08T02:15:00Z", operator: "梁平先", summary: "角色设定调整为「陪伴新员工完成入职第一周的各项事务。」" },
        { createdAt: "2026-10-08T02:21:00Z", operator: "梁平先", summary: "知识范围调整：新增关联 目录「入职与转正」" },
      ],
      versions: [{ version: "1.0.0", releasedAt: "2026-07-20T06:00:00Z", operator: "梁平先", lines: [] }],
    },
  },
  {
    id: "sales-order-tracker", projectId: "workspace", name: "销售订单跟单员", desc: "跟踪订单从下单到回款的各节点，主动提醒延期风险并给出处理建议。", avatar: "/avatar-agent-3.png",
    status: "saved", backendStatus: "published", isChanged: true, domain: "sales", createdAt: "2026-06-02T01:00:00Z", allowModelSwitch: false, defaultModelLevel: "fast",
    role: role("销售订单跟单员", "跟踪销售订单的交付与回款进度。", ["每次回答先给当前节点与下一步", "发现延期风险时给出可选处理方案", "金额类数据保留两位小数"]),
    skills: [skillRef("sk_ar"), skillRef("sk_credit")], knowledge: [],
    changelog: {
      pending: [
        { createdAt: "2026-11-02T03:10:00Z", operator: "王敏", summary: "新增技能「应收账龄分析」" },
        { createdAt: "2026-11-02T03:40:00Z", operator: "王敏", summary: "修改技能「客户信用评估」的放单规则" },
      ],
      versions: [
        { version: "1.0.0", releasedAt: "2026-06-05T02:00:00Z", operator: "梁平先", lines: [] },
        { version: "1.1.0", releasedAt: "2026-08-01T02:00:00Z", operator: "王敏", summary: "接入客户信用评估", lines: ["新增技能「客户信用评估」", "默认模型等级调整为「快速」"] },
      ],
    },
  },
]

const info = (appCode: string, appName: string, description: string, extra: Record<string, unknown> = {}) => ({
  cloud: "kdcloud",
  domain: "scm",
  appCode,
  appName,
  description,
  runMode: "message",
  version: "1.0.0",
  entryTool: { virtual: { inputSchema: { type: "object", properties: { billNo: { type: "string" } } } } },
  ...extra,
})

export const mcpApps: McpApp[] = [
  {
    appCode: "kdcloud_fin_expense_claim_card", appName: "费用报销卡片", appDescription: "在对话中展示报销单摘要，支持直接修改金额、补充票据并提交。", projectId: "workspace",
    mcpStatus: "PUBLISHED", buildStatus: "success", tested: true, packageKind: "source", version: "1.2.0",
    artifacts: [
      { version: "1.0.0", createdAt: "2026-07-02T03:00:00Z", changeDesc: "首次构建" },
      { version: "1.1.0", createdAt: "2026-08-11T06:30:00Z", changeDesc: "支持补充票据附件" },
      { version: "1.2.0", createdAt: "2026-09-20T02:10:00Z", changeDesc: "金额修改后自动重算合计" },
    ],
    info: info("kdcloud_fin_expense_claim_card", "费用报销卡片", "展示报销单摘要并支持提交", {
      domain: "fin", version: "1.2.0",
      capabilityDescription: { support: "查看报销摘要、修改金额、补充票据、提交", notSupport: "不支持批量报销" },
      mcpConnector: [{ type: "MCP", mcpInstanceId: "fin-expense-service", relateTools: [{ name: "expense_claim_query" }, { name: "expense_claim_submit" }] }],
    }),
  },
  {
    appCode: "kdcloud_scm_stock_table", appName: "库存明细表格", appDescription: "可排序、可筛选的即时库存表格组件，支持按仓库分组折叠。", projectId: "scm-skills",
    mcpStatus: "PENDING_REVIEW", buildStatus: "success", tested: true, packageKind: "source", version: "1.0.1",
    artifacts: [
      { version: "1.0.0", createdAt: "2026-09-01T03:00:00Z", changeDesc: "首次构建" },
      { version: "1.0.1", createdAt: "2026-09-26T08:45:00Z", changeDesc: "用户手动打包" },
    ],
    info: info("kdcloud_scm_stock_table", "库存明细表格", "即时库存表格", {
      version: "1.0.1",
      mcpConnector: [{ type: "MCP", mcpInstanceId: "scm-inventory-service", relateTools: [{ name: "realtime_stock_query" }] }],
    }),
  },
  {
    appCode: "kdcloud_hr_leave_form", appName: "请假申请表单", appDescription: "带日期范围选择与剩余假期提示的请假表单，提交前做完整性校验。", projectId: "hr-assistant",
    mcpStatus: "", buildStatus: null, tested: false, packageKind: "source", version: "1.0.0", artifacts: [],
    info: { appCode: "kdcloud_hr_leave_form", appName: "请假申请表单", description: "请假表单", runMode: "message" },
  },
  {
    appCode: "kdcloud_bpm_approval_flow", appName: "审批流程图", appDescription: "以时间线形式展示单据审批进度，高亮当前节点与处理人。", projectId: "workspace",
    mcpStatus: "REJECTED", buildStatus: "success", tested: true, packageKind: "dist", version: "1.0.0", reviewRemark: "节点处理人为空时页面报错，请修复后重新提交。",
    artifacts: [{ version: "1.0.0", createdAt: "2026-09-15T05:00:00Z", changeDesc: "" }],
    info: info("kdcloud_bpm_approval_flow", "审批流程图", "审批进度时间线", { domain: "bpm" }),
  },
  {
    appCode: "kdcloud_sal_order_summary_card", appName: "订单摘要卡片", appDescription: "展示销售订单关键信息与交付进度，可一键跳转到单据详情。", projectId: "workspace",
    mcpStatus: "", buildStatus: "success", tested: false, packageKind: "source", version: "1.0.0",
    artifacts: [{ version: "1.0.0", createdAt: "2026-10-02T05:00:00Z", changeDesc: "首次构建" }],
    info: info("kdcloud_sal_order_summary_card", "订单摘要卡片", "销售订单摘要", { domain: "sal" }),
  },
]
