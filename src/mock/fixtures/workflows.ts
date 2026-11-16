/** 工作流开发的演示数据。画布内容见 workflow-graphs（模板定义），保存记录与提交基线见 stores/workflow-docs */

/**
 * 首次打开时用哪份内容初始化画布：
 * - sample / sales：销售分析
 * - expense：费用审核
 * - expense-dynamic：批量审批
 * - blank：只有开始、结束节点
 */
export type WorkflowTemplate = "sample" | "blank" | "sales" | "expense" | "expense-dynamic"

/** 与智能体开发对齐的四态（方案 10.1） */
export type WorkflowStatus = "saved" | "submitted" | "published" | "rejected"

export interface Workflow {
  id: string
  name: string
  desc: string
  status: WorkflowStatus
  template: WorkflowTemplate
  /** 最近一个已发布版本（语义化三段号）；无则表示从未发布 */
  publishedVersion?: string
  /** 正在审核或被驳回的版本号；驳回不消耗版本号，重提沿用 */
  pendingVersion?: string
  rejectReason?: string
  /** 关联的 Build 会话：在会话里对话修改，右侧打开画布 */
  sessionId?: string
  projectId?: string
  creator: string
  createdAt: string
  updatedAt: string
}

export const workflowSeeds: Workflow[] = [
  {
    id: "wf_sales_analysis",
    name: "销售分析流程",
    desc: "读取销售数据，并行完成经营分析与指标计算，按需人工确认后生成销售周报并发送给负责人。",
    status: "published",
    publishedVersion: "1.0.0",
    template: "sales",
    creator: "张乐",
    createdAt: "2026-10-20T09:30:00.000Z",
    updatedAt: "2026-10-24T15:12:00.000Z",
  },
  {
    id: "wf_expense_review",
    name: "费用报销审核流程",
    desc: "识别票据后并行验真与核对政策，超出标准时交财务确认，最后提交报销单。",
    status: "rejected",
    pendingVersion: "1.0.0",
    rejectReason: "「提交报销单」是写操作，请补充财务确认的核准金额校验后再提交。",
    template: "expense",
    creator: "刘顺",
    createdAt: "2026-10-22T02:10:00.000Z",
    updatedAt: "2026-10-26T08:40:00.000Z",
  },
  {
    id: "wf_expense_dispatch",
    name: "报销单批量审批流程",
    desc: "把报销单拆成工作项，循环逐张审核并校验结论，最后汇总审批结果。",
    status: "saved",
    template: "expense-dynamic",
    creator: "张乐",
    createdAt: "2026-10-25T06:00:00.000Z",
    updatedAt: "2026-10-25T06:00:00.000Z",
  },
]
