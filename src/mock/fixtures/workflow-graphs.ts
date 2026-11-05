import type { WorkflowTemplate } from "./workflows"

/**
 * 工作流定义（模板）。节点配置项对齐原工作流设计器原型（节点配置 / 输入输出两页）。
 * 运行时绑定（MCP 服务账号、智能体版本、办理人）不在这里，见 stores/workflow-docs 的 runtime。
 *
 * 数据流：每个节点声明输出契约（outputs），下游节点的输入映射用 `节点id.字段` 引用；开始节点的业务输入即流程入参。
 * 多出口节点（条件、人工输入、按意图选下一步的智能体）的分支定义在节点配置里，连线用 edge.branch 指向分支 id；
 * 分支可以「未连接」（没有对应连线），完整校验时拦截。并行节点的分支就是它的出边，名称在 edge.label。
 */
export type WfNodeType = "start" | "end" | "agent" | "tool" | "code" | "condition" | "parallel" | "join" | "loop" | "human"

export type WfValueType = "string" | "number" | "boolean" | "object" | "array"

/** 开始节点的业务输入（流程入参）。说明是智能体从对话中抽取参数的依据（方案 3.9） */
export interface WfParam {
  name: string
  type: "string" | "number" | "boolean" | "object" | "file"
  /** 默认值，试运行时预填 */
  example: string
  required: boolean
  desc: string
}

/** 输入映射：上游引用（source）或固定值（value） */
export interface WfInput {
  name: string
  source?: string
  value?: string
}

/** 输出契约：下游可引用的字段。object 可以写结构定义 */
export interface WfOutput {
  name: string
  type: WfValueType
  schema?: string
  /** 试运行的模拟值 */
  example?: string
}

export type WfFieldType = "text" | "textarea" | "number" | "checkbox" | "radio" | "multi" | "group" | "table"

/** 人工输入的表单字段：表单同时生成本节点的输入与输出契约 */
export interface WfFormField {
  key: string
  label: string
  type: WfFieldType
  editable: boolean
  required: boolean
  /** 勾选字段：必须勾选才能提交 */
  mustCheck?: boolean
  options?: string[]
  hint?: string
  /** 对象分组的子字段 / 明细表的行字段 */
  children?: WfFormField[]
}

export type WfOp = "is" | "isNot" | "eq" | "neq" | "lt" | "gt" | "lte" | "gte"

export interface WfRule {
  left: string
  op: WfOp
  right: string
}

/** 条件节点的有序分支：首个命中生效，没有命中走默认出口 */
export interface WfBranch {
  id: string
  label: string
  logic: "and" | "or"
  rules: WfRule[]
}

/** 人工输入的动作：每个动作一个出口 */
export interface WfAction {
  id: string
  name: string
}

/** 智能体「依据处理意图选择下一步」的候选出口 */
export interface WfCandidate {
  id: string
  guide: string
}

export interface WfLoopVar {
  name: string
  type: WfValueType
  init?: string
  initValue?: string
  update?: string
}

export type WfLoopCmp = ">=" | ">" | "==" | "!=" | "<" | "<="

/** 循环的内部流程：按顺序执行的执行体步骤 */
export interface WfLoopStep {
  id: string
  title: string
  type: "agent" | "tool" | "code"
  ref: string
}

export interface WfNodeConfig {
  inputs?: WfInput[]
  outputs?: WfOutput[]
  /** 开始：发起方式与业务输入 */
  launch?: "form" | "agent"
  params?: WfParam[]
  /** 结束：最终输出 */
  results?: WfInput[]
  /** 智能体 */
  mode?: "agent" | "single"
  agentRef?: string
  skillRef?: string
  instruction?: string
  intent?: boolean
  candidates?: WfCandidate[]
  /** MCP 工具；write=写操作（提交清单、审核、试运行前确认都依赖它） */
  mcpServer?: string
  mcpTool?: string
  write?: boolean
  /** 代码 */
  language?: string
  timeout?: string
  codeDesc?: string
  code?: string
  sampleInput?: string
  /** 条件 */
  branches?: WfBranch[]
  /** 人工输入 */
  multi?: boolean
  handleMode?: "single" | "parallel" | "sequential"
  assignee?: string
  guide?: string
  render?: "form" | "html"
  htmlFile?: string
  cssFile?: string
  fields?: WfFormField[]
  actions?: WfAction[]
  deadline?: string
  deadlineUnit?: "s" | "m" | "h" | "d"
  /** 循环 */
  loopMode?: "collection" | "condition"
  collection?: string
  memberKey?: string
  concurrency?: "sequential" | "parallel"
  itemResult?: string
  onError?: "block" | "null" | "exclude"
  flatten?: boolean
  vars?: WfLoopVar[]
  exitLeft?: string
  exitOp?: WfLoopCmp
  exitRight?: string
  maxRounds?: string
  maxRoundsRef?: string
  body?: WfLoopStep[]
  /** 试运行：步骤输出的模拟文本 */
  sample?: string
}

export interface WfNode {
  id: string
  type: WfNodeType
  title: string
  desc?: string
  x: number
  y: number
  config: WfNodeConfig
}

export interface WfEdge {
  id: string
  source: string
  target: string
  /** 并行分支名称 */
  label?: string
  /** 多出口节点的分支 id：条件分支 / 默认出口（default）/ 人工动作 / 智能体候选 */
  branch?: string
}

export interface WfGraph {
  nodes: WfNode[]
  edges: WfEdge[]
}

export const DEFAULT_BRANCH = "default"
export const NODE_W = 208
export const NODE_H = 72
const GAP_X = 40
const GAP_Y = 52

/** 按层级自动排布：开始在最上，每层水平居中；没接入主流程的节点放在最后一层 */
export function autoLayout(graph: WfGraph): WfGraph {
  const level = new Map<string, number>()
  const start = graph.nodes.find((n) => n.type === "start") ?? graph.nodes[0]
  if (!start) return graph
  level.set(start.id, 0)
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false
    for (const edge of graph.edges) {
      const from = level.get(edge.source)
      if (from === undefined) continue
      if ((level.get(edge.target) ?? -1) < from + 1) {
        level.set(edge.target, from + 1)
        changed = true
      }
    }
    if (!changed) break
  }
  graph.nodes.forEach((n) => level.has(n.id) || level.set(n.id, Math.max(0, ...level.values()) + 1))
  const rows = new Map<number, WfNode[]>()
  for (const node of graph.nodes) {
    const l = level.get(node.id) ?? 0
    rows.set(l, [...(rows.get(l) ?? []), node])
  }
  const nodes = graph.nodes.map((node) => {
    const l = level.get(node.id) ?? 0
    const row = rows.get(l) ?? [node]
    const index = row.indexOf(node)
    const width = row.length * NODE_W + (row.length - 1) * GAP_X
    return { ...node, x: -width / 2 + index * (NODE_W + GAP_X), y: l * (NODE_H + GAP_Y) }
  })
  return { ...graph, nodes }
}

let seq = 0
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`

/** 节点的输出字段（下游可引用）：开始=业务输入，人工输入=表单字段，其他=输出契约 */
export function producesOf(node: WfNode): string[] {
  const c = node.config
  if (node.type === "start") return (c.params ?? []).map((p) => p.name)
  if (node.type === "human") return (c.fields ?? []).map((f) => f.key)
  if (node.type === "end" || node.type === "condition" || node.type === "parallel" || node.type === "join") return []
  return (c.outputs ?? []).map((o) => o.name)
}

/** 字段的展示名：人工输入用字段展示名称，其余用字段名 */
export function fieldLabel(node: WfNode, field: string) {
  if (node.type === "human") return node.config.fields?.find((f) => f.key === field)?.label ?? field
  return field
}

const node = (id: string, type: WfNodeType, title: string, config: WfNodeConfig = {}, desc?: string): WfNode => ({ id, type, title, desc, x: 0, y: 0, config })
const edge = (source: string, target: string, extra: Partial<WfEdge> = {}): WfEdge => ({ id: `e_${source}_${target}${extra.branch ? `_${extra.branch}` : ""}`, source, target, ...extra })
const ref = (nodeId: string, field: string) => `${nodeId}.${field}`
const out = (name: string, example?: string, type: WfValueType = "string"): WfOutput => ({ name, type, example })
const field = (key: string, label: string, type: WfFieldType, extra: Partial<WfFormField> = {}): WfFormField => ({ key, label, type, editable: true, required: false, ...extra })

function sales(): WfGraph {
  return autoLayout({
    nodes: [
      node("start", "start", "开始", {
        launch: "form",
        params: [
          { name: "业务范围", type: "string", desc: "要分析的销售区域，如华东区", required: true, example: "华东区" },
          { name: "统计周期", type: "string", desc: "统计的时间范围，如本周、上月", required: true, example: "本周" },
          { name: "需人工确认", type: "boolean", desc: "是否需要销售经理确认后再生成周报", required: true, example: "true" },
        ],
      }),
      node("collect", "agent", "读取销售数据", {
        mode: "agent",
        agentRef: "资料整理智能体",
        skillRef: "业务分析",
        instruction: "读取本次输入和已授权资料，整理可供后续处理的数据。",
        inputs: [{ name: "业务范围", source: ref("start", "业务范围") }, { name: "统计周期", source: ref("start", "统计周期") }],
        outputs: [out("text", "华东区本周订单 1,286 笔，销售额 ¥2,486,000。")],
        sample: "读取华东区本周订单 1,286 笔，销售额 ¥2,486,000。",
      }),
      node("parallel", "parallel", "并行分析"),
      node("analyze", "agent", "分析销售表现", {
        mode: "agent",
        agentRef: "经营分析智能体",
        skillRef: "业务分析",
        instruction: "根据输入材料分析表现和变化原因，并返回结构化结论。",
        inputs: [{ name: "内容", source: ref("collect", "text") }],
        outputs: [out("text", "华东区销售额环比 +8.3%，增长主要来自精密轴承品类。")],
        sample: "华东区销售额环比 +8.3%，增长主要来自精密轴承品类。",
      }),
      node("calc", "code", "计算同比环比", {
        language: "Python",
        timeout: "30",
        codeDesc: "计算指标，并按人审输入契约输出完整审批对象。",
        code: "def calculate(request):\n    return {\n        \"total\": 2486000,\n        \"approval_input\": {\n            \"decision\": None,\n            \"weekly_sales\": 2486000,\n            \"growth_confirmation\": \"本周销售额环比增长 8.3%，请核对经营表现。\",\n        },\n    }",
        inputs: [{ name: "request", source: ref("collect", "text") }],
        outputs: [
          out("total", "2486000", "number"),
          { name: "approval_input", type: "object", schema: '{"type":"object","properties":{"decision":{"type":["string","null"],"title":"经营结论"},"weekly_sales":{"type":["number","null"]},"growth_confirmation":{"type":"string"}}}', example: '{"weekly_sales":2486000}' },
        ],
        sampleInput: '{\n  "text": "华东区本周订单 1,286 笔，销售额 ¥2,486,000。"\n}',
        sample: "total=2486000，环比 +8.3%，同比 +12.6%",
      }),
      node("join", "join", "汇总分支结果"),
      node("cond", "condition", "是否需要人工确认", {
        branches: [{ id: "need", label: "需要确认", logic: "and", rules: [{ left: ref("start", "需人工确认"), op: "is", right: "true" }] }],
      }),
      node("review", "human", "确认经营结论", {
        multi: false,
        handleMode: "single",
        assignee: "initiator",
        guide: "请核对处理结果，填写意见并选择下一步。",
        render: "form",
        htmlFile: "forms/review.html",
        cssFile: "forms/review.css",
        fields: [
          field("decision", "经营结论", "textarea", { required: true, hint: "请综合上方分析与计算结果，给出经营结论" }),
          field("weekly_sales", "本周销售额", "number", { editable: false }),
          field("growth_confirmation", "环比增速确认", "textarea", { hint: "预填自上游分析结果，可修正" }),
          field("risk_level", "风险等级", "radio", { options: ["低", "中", "高"] }),
          field("verified", "已核对原始数据", "checkbox"),
        ],
        actions: [
          { id: "approve", name: "确认通过" },
          { id: "reject", name: "不采纳" },
        ],
        deadline: "0",
        deadlineUnit: "h",
      }),
      node("report", "agent", "生成销售周报", {
        mode: "single",
        instruction: "根据已确认的分析与计算结果，生成报告，并通过结论字段返回正文。",
        inputs: [{ name: "分析结论", source: ref("analyze", "text") }, { name: "指标", source: ref("calc", "total") }, { name: "经营结论", source: ref("review", "decision") }],
        outputs: [out("结论", "华东区本周销售额 ¥2,486,000，环比 +8.3%，同比 +12.6%；增长主要来自精密轴承品类。")],
        sample: "已生成 sales-weekly-report.md 与 sales-metrics.xlsx。",
      }),
      node("send", "tool", "发送周报给负责人", {
        mcpServer: "企业消息 MCP",
        mcpTool: "send_message",
        write: true,
        inputs: [{ name: "接收人", value: "区域销售负责人" }, { name: "内容", source: ref("report", "结论") }],
        outputs: [out("发送结果", "已发送给 3 位区域负责人")],
        sample: "已发送给 3 位区域负责人。",
      }),
      node("end", "end", "结束", { results: [{ name: "销售周报", source: ref("report", "结论") }, { name: "发送结果", source: ref("send", "发送结果") }] }),
    ],
    edges: [
      edge("start", "collect"),
      edge("collect", "parallel"),
      edge("parallel", "analyze", { label: "经营分析" }),
      edge("parallel", "calc", { label: "指标计算" }),
      edge("analyze", "join"),
      edge("calc", "join"),
      edge("join", "cond"),
      edge("cond", "review", { branch: "need" }),
      edge("cond", "report", { branch: DEFAULT_BRANCH }),
      edge("review", "report", { branch: "approve" }),
      edge("review", "end", { branch: "reject" }),
      edge("report", "send"),
      edge("send", "end"),
    ],
  })
}

function expense(): WfGraph {
  return autoLayout({
    nodes: [
      node("start", "start", "开始", {
        launch: "form",
        params: [
          { name: "报销单号", type: "string", desc: "要审核的报销单编号", required: true, example: "BX202610-0386" },
          { name: "申请人", type: "string", desc: "报销申请人姓名", required: true, example: "王敏" },
        ],
      }),
      node("recognize", "agent", "识别报销单据", {
        mode: "agent",
        agentRef: "票据识别智能体",
        skillRef: "文档整理",
        instruction: "识别票据类型、金额与费用明细，计算超出标准的金额。",
        inputs: [{ name: "报销单号", source: ref("start", "报销单号") }],
        outputs: [out("票据明细", "交通 2 张 ¥1,280，住宿 2 张 ¥1,400"), out("超标金额", "120", "number")],
        sample: "识别票据 4 张：交通 2 张、住宿 2 张，合计 ¥2,680。",
      }),
      node("parallel", "parallel", "并行核验"),
      node("verify", "tool", "发票验真", {
        mcpServer: "发票验真 MCP",
        mcpTool: "verify_invoice",
        write: false,
        inputs: [{ name: "票据明细", source: ref("recognize", "票据明细") }],
        outputs: [out("验真结果", "4 张发票均验真通过")],
        sample: "4 张发票均验真通过。",
      }),
      node("policy", "agent", "核对报销政策", {
        mode: "agent",
        agentRef: "费用审核智能体",
        skillRef: "费用审核规范",
        instruction: "对照报销制度核验报销标准。",
        inputs: [{ name: "票据明细", source: ref("recognize", "票据明细") }],
        outputs: [out("政策结论", "住宿 1 晚超出标准 ¥120，其余合规")],
        sample: "住宿 1 晚超出标准 ¥120，其余合规。",
      }),
      node("join", "join", "汇总核验结果"),
      node("cond", "condition", "是否超出标准", {
        branches: [{ id: "over", label: "超出标准", logic: "and", rules: [{ left: ref("recognize", "超标金额"), op: "gt", right: "0" }] }],
      }),
      node("review", "human", "财务确认", {
        multi: false,
        handleMode: "single",
        assignee: "财务审核岗",
        guide: "请核对超标原因和金额，填写审核意见与核准金额。",
        render: "form",
        htmlFile: "forms/review.html",
        cssFile: "forms/review.css",
        fields: [
          field("applicant", "申请人", "text", { editable: false, hint: "来自本次申请对象" }),
          field("opinion", "审核意见", "textarea", { required: true }),
          field("approved_amount", "核准金额", "number", { required: true, hint: "预填自输入，可核对后调整" }),
        ],
        actions: [
          { id: "approve", name: "通过" },
          { id: "reject", name: "退回" },
        ],
        deadline: "2",
        deadlineUnit: "d",
      }),
      node("submit", "tool", "提交报销单", {
        mcpServer: "ERP 费用报销 MCP",
        mcpTool: "submit_expense",
        write: true,
        inputs: [{ name: "报销单号", source: ref("start", "报销单号") }, { name: "核准金额", source: ref("review", "approved_amount") }],
        outputs: [out("单据状态", "待付款")],
        sample: "报销单 BX202610-0386 已提交，状态：待付款。",
      }),
      node("end", "end", "结束", { results: [{ name: "审核结论", source: ref("policy", "政策结论") }, { name: "单据状态", source: ref("submit", "单据状态") }] }),
    ],
    edges: [
      edge("start", "recognize"),
      edge("recognize", "parallel"),
      edge("parallel", "verify", { label: "发票验真" }),
      edge("parallel", "policy", { label: "政策核对" }),
      edge("verify", "join"),
      edge("policy", "join"),
      edge("join", "cond"),
      edge("cond", "review", { branch: "over" }),
      edge("cond", "submit", { branch: DEFAULT_BRANCH }),
      edge("review", "submit", { branch: "approve" }),
      edge("review", "end", { branch: "reject" }),
      edge("submit", "end"),
    ],
  })
}

function batch(): WfGraph {
  return autoLayout({
    nodes: [
      node("start", "start", "开始", {
        launch: "form",
        params: [{ name: "报销单列表", type: "string", desc: "待审批的报销单编号，多个用逗号分隔", required: true, example: "BX-0381,BX-0382,BX-0383,BX-0384,BX-0385,BX-0386" }],
      }),
      node("assign", "code", "生成审核工作项", {
        language: "Python",
        timeout: "30",
        codeDesc: "把报销单列表拆成工作项，每张单据一项。",
        code: "def main(bills):\n    items = [b.strip() for b in bills.split(',') if b.strip()]\n    return {'work_items': [{'id': b} for b in items]}",
        inputs: [{ name: "bills", source: ref("start", "报销单列表") }],
        outputs: [{ name: "work_items", type: "array", example: "6 项" }],
        sampleInput: '{\n  "bills": "BX-0381,BX-0382,BX-0383"\n}',
        sample: "生成 6 个工作项，每张单据一项。",
      }),
      node("reviews", "loop", "逐张审核报销单", {
        loopMode: "collection",
        collection: ref("assign", "work_items"),
        memberKey: "id",
        concurrency: "parallel",
        itemResult: "",
        onError: "exclude",
        flatten: false,
        vars: [{ name: "value", type: "string" }],
        exitOp: ">=",
        exitRight: "3",
        maxRounds: "5",
        body: [
          { id: "b1", title: "审核当前单据", type: "agent", ref: "费用审核智能体" },
          { id: "b2", title: "校验审核结论", type: "code", ref: "Python" },
        ],
        outputs: [{ name: "results", type: "array", example: "通过 5 张，退回 1 张" }],
        sample: "6 张单据审核完成：通过 5 张，退回 1 张。",
      }),
      node("summary", "agent", "汇总审核结果", {
        mode: "single",
        instruction: "收集全部审核结论，输出审批汇总。",
        inputs: [{ name: "审核结论", source: ref("reviews", "results") }],
        outputs: [out("审批汇总", "6 张报销单：通过 5 张，退回 1 张（BX-0384 票据不全）")],
        sample: "已生成 batch-review-summary.md。",
      }),
      node("end", "end", "结束", { results: [{ name: "审批汇总", source: ref("summary", "审批汇总") }] }),
    ],
    edges: [edge("start", "assign"), edge("assign", "reviews"), edge("reviews", "summary"), edge("summary", "end")],
  })
}

function blank(): WfGraph {
  return autoLayout({
    nodes: [node("start", "start", "开始", { launch: "form", params: [{ name: "输入", type: "string", desc: "", required: true, example: "" }] }), node("end", "end", "结束", { results: [] })],
    edges: [edge("start", "end")],
  })
}

/** 模板 → 画布初始内容（sample 与销售分析一致） */
export function templateGraph(template: WorkflowTemplate): WfGraph {
  if (template === "sales" || template === "sample") return sales()
  if (template === "expense") return expense()
  if (template === "expense-dynamic") return batch()
  return blank()
}

export interface TrialFile {
  name: string
  desc: string
  producer: string
  content: string
}

/** 试运行的运行产物（文件）与业务结论摘要，按模板给出 */
export function trialResult(graph: WfGraph): { files: TrialFile[]; summary: string } {
  const has = (id: string) => graph.nodes.some((n) => n.id === id)
  if (has("collect"))
    return {
      files: [
        { name: "sales-weekly-report.md", desc: "销售周报正文", producer: "report", content: "# 华东区销售周报（本周）\n\n- 销售额 **¥2,486,000**，环比 +8.3%，同比 +12.6%\n- 增长主要来自精密轴承品类（+21%）\n- 紧固件套装销量下滑 4%，建议关注渠道库存\n\n## 下周建议\n1. 加大精密轴承重点客户的备货\n2. 复盘紧固件渠道价格" },
        { name: "sales-metrics.json", desc: "关键指标", producer: "calc", content: '```json\n{\n  "total": 2486000,\n  "mom": 0.083,\n  "yoy": 0.126,\n  "orders": 1286\n}\n```' },
        { name: "metrics.py", desc: "指标计算脚本", producer: "calc", content: "```python\ndef calculate(request):\n    return {\"total\": 2486000, \"mom\": 0.083, \"yoy\": 0.126}\n```" },
      ],
      summary: "华东区本周销售额 ¥2,486,000，环比 +8.3%，同比 +12.6%。增长主要来自精密轴承品类，周报已发送给区域负责人。",
    }
  if (has("recognize"))
    return {
      files: [{ name: "review-summary.md", desc: "审核结论", producer: "submit", content: "# 报销审核结论\n\n- 报销单：BX202610-0386（王敏）\n- 合计 ¥2,680，住宿 1 晚超出标准 ¥120\n- 财务核准后已提交，状态：待付款" }],
      summary: "报销单 BX202610-0386 合计 ¥2,680，住宿 1 晚超出标准 ¥120，财务核准后已提交。",
    }
  if (has("reviews"))
    return { files: [{ name: "batch-review-summary.md", desc: "审批汇总", producer: "summary", content: "# 批量审批汇总\n\n| 结果 | 数量 |\n| --- | --- |\n| 通过 | 5 |\n| 退回 | 1（BX-0384 票据不全） |" }], summary: "6 张报销单审核完成：通过 5 张，退回 1 张（票据不全）。" }
  return { files: [], summary: "流程已从开始运行到结束。" }
}

/** 节点库的节点类型与顺序 */
export const NODE_TYPE_ORDER: WfNodeType[] = ["agent", "tool", "code", "condition", "parallel", "join", "human", "loop"]

/** 新建节点时的默认配置 */
export function defaultNode(type: WfNodeType, title: string): WfNode {
  const config: WfNodeConfig =
    type === "agent"
      ? { mode: "agent", agentRef: "", skillRef: "", instruction: "", intent: false, candidates: [], inputs: [], outputs: [{ name: "text", type: "string" }] }
      : type === "tool"
        ? { mcpServer: "", mcpTool: "", write: false, inputs: [], outputs: [{ name: "result", type: "string" }] }
        : type === "code"
          ? { language: "Python", timeout: "30", codeDesc: "", code: "def main(input):\n    return {'result': input}", inputs: [{ name: "input" }], outputs: [{ name: "result", type: "string" }], sampleInput: "" }
          : type === "condition"
            ? { branches: [{ id: newId("br"), label: "分支 1", logic: "and", rules: [{ left: "", op: "is", right: "" }] }] }
            : type === "loop"
              ? { loopMode: "collection", collection: "", memberKey: "id", concurrency: "sequential", itemResult: "", onError: "block", flatten: false, vars: [{ name: "value", type: "string" }], exitOp: ">=", exitRight: "", maxRounds: "5", body: [], outputs: [{ name: "results", type: "array" }] }
              : type === "human"
                ? {
                    multi: false,
                    handleMode: "single",
                    assignee: "initiator",
                    guide: "请核对处理结果，填写意见并选择下一步。",
                    render: "form",
                    htmlFile: "forms/review.html",
                    cssFile: "forms/review.css",
                    fields: [field("opinion", "意见", "textarea", { required: true })],
                    actions: [
                      { id: newId("act"), name: "确认通过" },
                      { id: newId("act"), name: "不采纳" },
                    ],
                    deadline: "0",
                    deadlineUnit: "h",
                  }
                : {}
  return { id: newId(type), type, title, x: 0, y: 0, config }
}

/** 条件比较方式（与原设计器一致） */
export const RULE_OPS: Array<{ value: WfOp; label: string }> = [
  { value: "is", label: "is" },
  { value: "isNot", label: "is not" },
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "lt", label: "<" },
  { value: "gt", label: ">" },
  { value: "lte", label: "≤" },
  { value: "gte", label: "≥" },
]

export const LOOP_CMPS: WfLoopCmp[] = [">=", ">", "==", "!=", "<", "<="]
