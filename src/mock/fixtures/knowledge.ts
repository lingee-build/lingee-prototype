export interface KnowledgeCategory {
  id: string
  name: string
  /** 目录内文档数（含子目录） */
  count: number
  children: KnowledgeCategory[]
}

export interface KnowledgeEntry {
  id: string
  name: string
  format: string
  categoryId: string
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED"
  size: number
  creatorName?: string
  timeUpdated: string
  /** 解析后的正文（Markdown） */
  content: string
}

const dir = (id: string, name: string, count: number, children: KnowledgeCategory[] = []): KnowledgeCategory => ({ id, name, count, children })

/** 企业知识目录树（mock）：智能体只能按目录关联 */
export const knowledgeTree: KnowledgeCategory[] = [
  dir("kc_hr", "人事制度", 7, [
    dir("kc_hr_attendance", "考勤与假期", 3),
    dir("kc_hr_salary", "薪酬福利", 2),
    dir("kc_hr_onboard", "入职与转正", 2),
  ]),
  dir("kc_fin", "财务制度", 4, [dir("kc_fin_expense", "费用报销制度", 3), dir("kc_fin_budget", "预算管理", 1)]),
  dir("kc_scm", "供应链制度", 5, [dir("kc_scm_supplier", "供应商管理", 2), dir("kc_scm_stock", "仓储与盘点", 3)]),
  dir("kc_it", "IT 服务指南", 2),
]

const doc = (
  id: string,
  categoryId: string,
  name: string,
  format: string,
  size: number,
  timeUpdated: string,
  summary: string,
  extra: Partial<KnowledgeEntry> = {},
): KnowledgeEntry => ({
  id,
  categoryId,
  name,
  format,
  size,
  timeUpdated,
  status: "READY",
  creatorName: "王敏",
  content: `# ${name.replace(/\.\w+$/, "")}\n\n${summary}\n\n## 适用范围\n\n本制度适用于集团及各分子公司全体正式员工。\n\n## 主要条款\n\n1. 申请须在系统内发起，线下口头申请无效。\n2. 审批链路按组织层级自动匹配，特殊情况由部门负责人指定。\n3. 相关记录保存期限不少于三年。\n\n> 本文为原型工程的示例内容。`,
  ...extra,
})

export const knowledgeDocs: KnowledgeEntry[] = [
  doc("kd_1", "kc_hr_attendance", "员工考勤与请假管理办法.docx", "docx", 86_211, "2026-09-12T02:00:00Z", "规定了工作时间、打卡要求以及各类假期的申请条件与审批权限。"),
  doc("kd_2", "kc_hr_attendance", "年假与调休规则说明.pdf", "pdf", 412_887, "2026-08-30T06:00:00Z", "说明年假天数的计算方式、跨年结转规则，以及加班调休的有效期。"),
  doc("kd_3", "kc_hr_attendance", "2026 年法定节假日安排.md", "md", 3_120, "2026-01-05T01:00:00Z", "列出 2026 年各法定节假日的放假与调休日期。", { status: "PROCESSING" }),
  doc("kd_4", "kc_hr_salary", "薪酬结构与发放规则.docx", "docx", 124_500, "2026-07-18T03:00:00Z", "介绍固定工资、绩效奖金与各项补贴的构成，以及每月发薪日。"),
  doc("kd_5", "kc_hr_salary", "社保公积金缴纳基数说明.xlsx", "xlsx", 58_004, "2026-07-01T03:00:00Z", "列出各城市社保与公积金的缴纳基数上下限与比例。"),
  doc("kd_6", "kc_hr_onboard", "新员工入职手册.pdf", "pdf", 1_920_331, "2026-06-20T03:00:00Z", "入职第一周需要完成的事项：账号开通、制度学习、设备领用。"),
  doc("kd_7", "kc_hr_onboard", "试用期转正流程.md", "md", 4_890, "2026-05-11T03:00:00Z", "转正评估的时间节点、评估维度与审批流程。"),
  doc("kd_8", "kc_fin_expense", "费用报销管理制度.docx", "docx", 143_077, "2026-09-02T03:00:00Z", "规定各类费用的报销标准、票据要求与审批权限。"),
  doc("kd_9", "kc_fin_expense", "差旅费标准（2026 版）.xlsx", "xlsx", 37_660, "2026-03-15T03:00:00Z", "按城市级别列出住宿、交通与餐补的报销上限。"),
  doc("kd_10", "kc_fin_expense", "发票合规检查要点.pdf", "pdf", 688_120, "2026-04-22T03:00:00Z", "列举常见的不合规发票情形与处理方式。", { status: "FAILED" }),
  doc("kd_11", "kc_fin_budget", "年度预算编制指引.pptx", "pptx", 2_410_998, "2026-02-01T03:00:00Z", "预算编制的时间表、口径与提交流程。"),
  doc("kd_12", "kc_scm_supplier", "供应商准入评分标准.xlsx", "xlsx", 44_210, "2026-08-08T03:00:00Z", "从资质、交付、质量、服务四个维度给出评分细则。"),
  doc("kd_13", "kc_scm_supplier", "供应商年度考核办法.docx", "docx", 97_300, "2026-07-27T03:00:00Z", "年度考核的指标、权重与结果应用。"),
  doc("kd_14", "kc_scm_stock", "仓库盘点作业规范.docx", "docx", 77_012, "2026-06-30T03:00:00Z", "盘点周期、盘点方法与差异处理流程。"),
  doc("kd_15", "kc_scm_stock", "呆滞物料处理流程.md", "md", 5_233, "2026-05-19T03:00:00Z", "呆滞物料的判定标准与处置审批流程。"),
  doc("kd_16", "kc_scm_stock", "库位编码规则.pdf", "pdf", 210_440, "2026-04-02T03:00:00Z", "库区、货架、层位的编码规则与示例。"),
  doc("kd_17", "kc_it", "VPN 与远程办公接入指南.md", "md", 6_010, "2026-09-09T03:00:00Z", "远程办公的账号申请、客户端安装与常见问题。"),
  doc("kd_18", "kc_it", "办公设备领用与归还.docx", "docx", 52_480, "2026-03-28T03:00:00Z", "笔记本、显示器等办公设备的领用标准与归还流程。"),
]
