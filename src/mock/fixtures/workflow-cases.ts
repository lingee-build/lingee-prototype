import type { WorkflowTemplate } from "./workflows"

/** 工作流开发的创建技能（输入框胶囊上显示为 workflow-builder） */
export const WORKFLOW_CREATOR = "workflow-creator"

export interface WorkflowCaseQuestion {
  question: string
  /** [选项, 说明]，第一项为推荐 */
  options: Array<[string, string]>
}

/**
 * 新任务页「场景模板」里的工作流案例。
 * 画布内容由设计器内置的同名示例生成（template），这里补充对话剧本需要的说明、节点与待确认事项。
 */
export interface WorkflowCase {
  id: "sales" | "expense" | "batch"
  template: WorkflowTemplate
  /** 场景模板卡片上的标题 */
  title: { zh: string; en: string }
  /** 点击卡片后填进输入框的提示词 */
  prompt: { zh: string; en: string }
  /** 生成的工作流名称与描述 */
  name: string
  desc: string
  /** 关键词：用户自己输入需求时据此匹配案例 */
  keywords: RegExp
  /** 执行方案（与设计器生成的画布节点一致） */
  flow: string
  /** 节点说明表：[节点, 类型, 作用] */
  nodes: Array<[string, string, string]>
  agents: string[]
  questions: WorkflowCaseQuestion[]
}

export const WORKFLOW_CASES: WorkflowCase[] = [
  {
    id: "sales",
    template: "sales",
    title: { zh: "销售分析", en: "Sales analysis" },
    prompt: {
      zh: `/${WORKFLOW_CREATOR} 创建一个销售分析工作流：读取华东区本周的销售数据，并行完成经营分析和同比环比指标计算，汇总结果后按需交由销售经理人工确认，最后生成销售周报。`,
      en: `/${WORKFLOW_CREATOR} Create a sales analysis workflow: read this week's East China sales data, run business analysis and YoY/MoM metrics in parallel, merge the results, send them to the sales manager for review when needed, then write the weekly sales report.`,
    },
    name: "销售分析流程",
    desc: "读取销售数据，并行完成经营分析与指标计算，按需人工确认后生成销售周报。",
    keywords: /销售|周报|业绩|同比|环比/,
    flow: "开始（业务范围、统计周期、需人工确认）\n  ↓\n读取销售数据（智能体）\n  ↓\n并行分析\n  ├─ 分析销售表现（智能体）\n  └─ 计算同比环比（代码）\n  ↓\n汇总分支结果\n  ↓\n是否需要人工确认（条件）\n  ├─ 需要确认 → 确认经营结论（人工输入）\n  └─ 默认 ↓\n生成销售周报（智能体）\n  ↓\n发送周报给负责人（MCP 工具 · 写操作）\n  ↓\n结束",
    nodes: [
      ["开始", "开始", "流程入参：业务范围、统计周期（必填），需人工确认"],
      ["读取销售数据", "智能体", "资料整理智能体读取已授权的销售资料"],
      ["分析销售表现 / 计算同比环比", "并行", "两条分支同时执行，全部成功后汇聚"],
      ["是否需要人工确认", "条件", "按「需人工确认」输入决定是否进入人审"],
      ["确认经营结论", "人工输入", "表单：经营结论、本周销售额、风险等级；动作：确认通过 / 不采纳"],
      ["生成销售周报", "智能体", "汇总结论，输出周报文件"],
      ["发送周报给负责人", "MCP 工具 · 写操作", "企业消息 MCP · send_message"],
    ],
    agents: ["资料整理智能体", "经营分析智能体", "报告撰写智能体"],
    questions: [
      {
        question: "人工确认由谁办理",
        options: [
          ["销售经理", "由发起区域的销售经理确认经营结论，适合日常周报。"],
          ["区域总监", "由区域总监确认，适合需要管理层把关的周报。"],
          ["发起人本人", "由发起人自行确认后继续，流程更快。"],
        ],
      },
      {
        question: "周报输出形式",
        options: [
          ["Markdown 报告 + 指标表", "正文说明表现与原因，附关键指标表格。"],
          ["Excel 指标表", "以表格为主，便于继续加工数据。"],
        ],
      },
    ],
  },
  {
    id: "expense",
    template: "expense",
    title: { zh: "费用审核", en: "Expense review" },
    prompt: {
      zh: `/${WORKFLOW_CREATOR} 创建一个费用报销审核工作流：识别报销单据后，并行完成发票验真和报销政策核对，超出标准时交由财务确认核准金额，最后把报销单提交到 ERP。`,
      en: `/${WORKFLOW_CREATOR} Create an expense review workflow: after recognizing the claim documents, verify receipts against policy and calculate amounts in parallel, merge the findings for finance to confirm, then compile the reimbursement list.`,
    },
    name: "费用报销审核流程",
    desc: "识别票据后并行验真与核对政策，超出标准时交财务确认，最后提交报销单。",
    keywords: /报销|费用|票据|发票/,
    flow: "开始（报销单号、申请人）\n  ↓\n识别报销单据（智能体）\n  ↓\n并行核验\n  ├─ 发票验真（MCP 工具）\n  └─ 核对报销政策（智能体）\n  ↓\n汇总核验结果\n  ↓\n是否超出标准（条件）\n  ├─ 超出标准 → 财务确认（人工输入）\n  └─ 默认 ↓\n提交报销单（MCP 工具 · 写操作）\n  ↓\n结束",
    nodes: [
      ["开始", "开始", "流程入参：报销单号、申请人"],
      ["识别报销单据", "智能体", "识别票据类型、金额与超标金额"],
      ["发票验真 / 核对报销政策", "并行", "验真与政策核对同时执行"],
      ["是否超出标准", "条件", "超标金额大于 0 时进入财务确认"],
      ["财务确认", "人工输入", "表单：审核意见、核准金额；动作：通过 / 退回"],
      ["提交报销单", "MCP 工具 · 写操作", "ERP 费用报销 MCP · submit_expense"],
    ],
    agents: ["票据识别智能体", "费用审核智能体"],
    questions: [
      {
        question: "哪些情况需要财务人工确认",
        options: [
          ["超出报销标准或核验存疑", "仅异常单据进入人审，其余自动通过，减少财务工作量。"],
          ["全部单据", "每张报销单都由财务确认，管控最严格。"],
        ],
      },
      {
        question: "人工确认的办理人",
        options: [
          ["财务审核岗", "由财务共享中心的审核岗统一办理。"],
          ["部门负责人", "先由申请人所在部门负责人确认。"],
        ],
      },
    ],
  },
  {
    id: "batch",
    template: "expense-dynamic",
    title: { zh: "批量审批", en: "Batch approval" },
    prompt: {
      zh: `/${WORKFLOW_CREATOR} 创建一个报销单批量审批工作流：先把报销单拆成工作项，循环逐张审核报销单并校验审核结论，最后汇总全部审核结果。`,
      en: `/${WORKFLOW_CREATOR} Create a batch approval workflow for expense claims: dispatch review instances up to a concurrency limit, have each instance review claims one by one and check the conclusions, then merge all results.`,
    },
    name: "报销单批量审批流程",
    desc: "把报销单拆成工作项，循环逐张审核并校验结论，最后汇总全部审核结果。",
    keywords: /批量|逐张|循环|审批/,
    flow: "开始（报销单列表）\n  ↓\n生成审核工作项（代码）\n  ↓\n逐张审核报销单（循环 · 按集合并行）\n  ├─ 审核当前单据（智能体）\n  └─ 校验审核结论（代码）\n  ↓\n汇总审核结果（智能体）\n  ↓\n结束",
    nodes: [
      ["开始", "开始", "流程入参：报销单列表（必填）"],
      ["生成审核工作项", "代码", "把报销单列表拆成工作项，每张单据一项"],
      ["逐张审核报销单", "循环 · 按集合", "每个工作项执行一次内部流程：审核单据并校验结论"],
      ["汇总审核结果", "智能体", "收集全部结论，输出审批汇总"],
    ],
    agents: ["费用审核智能体"],
    questions: [
      {
        question: "工作项的执行模式",
        options: [
          ["并行执行", "各张单据同时审核，缩短整体耗时，适合日常批量审批。"],
          ["顺序执行", "逐张依次审核，便于排查问题。"],
        ],
      },
      {
        question: "单张单据审核失败时",
        options: [
          ["排除失败项，继续处理其余单据", "失败单据在汇总中单独列出，不阻塞整批。"],
          ["终止并等待处理", "任一单据失败时循环受阻，等待处理后再继续。"],
        ],
      },
    ],
  },
]

/** 用户自己输入需求时按关键词匹配最接近的案例；都不匹配时返回 undefined（生成空白画布） */
export const matchWorkflowCase = (prompt: string) =>
  WORKFLOW_CASES.find((x) => prompt.includes(x.prompt.zh.slice(WORKFLOW_CREATOR.length + 2, 40))) ??
  [...WORKFLOW_CASES].reverse().find((x) => x.keywords.test(prompt))
