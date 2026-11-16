import type { Project, Session, Message, Model, User } from "../types"
import { conversations } from "./conversations"

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const now = Date.now()

export const user: User = { userId: "liangpx", displayName: "梁平先", tenantName: "金蝶软件（中国）有限公司" }

export const projects: Project[] = [
  { id: "workspace", worktree: "/Users/liangpx/lingeebuild/workspace", name: "workspace", git: false },
  { id: "scm-skills", worktree: "/Users/liangpx/code/scm-skills", name: "供应链技能包", git: true, branch: "feature_dev" },
  { id: "hr-assistant", worktree: "/Users/liangpx/code/hr-assistant", name: "HR 智能助手", git: true, branch: "main" },
]

const session = (id: string, projectId: string, title: string, ago: number, extra?: Partial<Session>): Session => ({
  id,
  projectId,
  title,
  time: { created: now - ago - 20 * MIN, updated: now - ago },
  status: "idle",
  ...extra,
})

export const sessions: Session[] = [
  session("ses_delivery", "scm-skills", "创建发货通知单查询技能", 12 * MIN),
  session("ses_stock", "scm-skills", "即时库存查询技能增加仓位维度", 3 * HOUR, { unread: true }),
  session("ses_purchase", "scm-skills", "采购订单下推入库单校验", DAY + 2 * HOUR),
  session("ses_supplier", "scm-skills", "供应商准入评估智能体", 2 * DAY),
  session("ses_price", "scm-skills", "价格表批量调价技能", 4 * DAY),
  session("ses_mrp", "scm-skills", "MRP 运算结果解读", 6 * DAY),
  session("ses_return", "scm-skills", "销售退货流程梳理", 9 * DAY),
  session("ses_leave", "hr-assistant", "办理请假申请技能", 40 * MIN),
  session("ses_onboard", "hr-assistant", "新员工入职指引智能体", 5 * HOUR),
  session("ses_salary", "hr-assistant", "薪资条查询与解释", 3 * DAY),
  session("ses_expense", "workspace", "差旅报销单据识别", 26 * HOUR),
  session("ses_card", "workspace", "费用报销卡片业务组件", 8 * DAY),
]

const DELIVERY_REPLY = `已完成 **发货通知单查询** 技能的创建，下面是本次产出的概要。

## 技能能力

- 支持按 **单据编号、单据状态、通知日期** 组合筛选
- 返回分页列表，或展开查看物料行明细
- 查询结果为空时，提示用户调整筛选条件

## 目录结构

\`\`\`text
delivery-notice-query/
├── SKILL.md
├── scripts/
│   └── query.py
└── references/
    └── fields.md
\`\`\`

## 关键字段

| 字段 | 标识 | 说明 |
| --- | --- | --- |
| 单据编号 | \`billno\` | 支持模糊匹配 |
| 单据状态 | \`billstatus\` | A 暂存 / B 已提交 / C 已审核 |
| 发货组织 | \`org.name\` | 取当前用户有权组织 |
| 订货客户 | \`customer.name\` | — |

接下来可以点击右上角的 **本地测试** 验证效果，确认无误后再提交发布。`

export const messages: Message[] = [
  {
    id: "msg_delivery_1",
    sessionId: "ses_delivery",
    role: "user",
    time: { created: now - 30 * MIN, completed: now - 30 * MIN },
    parts: [
      {
        id: "prt_delivery_1",
        type: "text",
        text: "/kingdee-skill-creator 创建一个发货通知单查询技能，支持按单据编号、状态和通知日期等条件组合筛选，返回分页列表或物料行明细。",
      },
    ],
  },
  {
    id: "msg_delivery_2",
    sessionId: "ses_delivery",
    role: "assistant",
    agent: "build",
    model: "deep",
    time: { created: now - 30 * MIN, completed: now - 12 * MIN },
    parts: [
      {
        id: "prt_delivery_2",
        type: "reasoning",
        text: "用户需要一个查询类技能。先确认发货通知单的表单标识与可筛选字段，再按技能规范生成 SKILL.md 与查询脚本。",
        time: { start: now - 30 * MIN, end: now - 29 * MIN },
      },
      { id: "prt_delivery_3", type: "tool", tool: "skill", title: "kingdee-skill-creator", state: "completed" },
      { id: "prt_delivery_4", type: "tool", tool: "grep", title: "sm_delivernotice", detail: "匹配到 14 个字段", state: "completed" },
      { id: "prt_delivery_5", type: "tool", tool: "write", title: "delivery-notice-query/SKILL.md", state: "completed" },
      { id: "prt_delivery_6", type: "tool", tool: "write", title: "delivery-notice-query/scripts/query.py", state: "completed" },
      { id: "prt_delivery_7", type: "tool", tool: "bash", title: "python scripts/query.py --dry-run", detail: "exit 0", state: "completed" },
      { id: "prt_delivery_8", type: "text", text: DELIVERY_REPLY },
      { id: "prt_delivery_9", type: "text", text: ':::render:kdskill {"id":"delivery-notice-query","title":"发货通知单查询","directory":"skills/delivery-notice-query"}:::' },
    ],
  },
  // 其余预置会话的完整对话
  ...Object.values(conversations).flat(),
]

export const models: Model[] = [
  { id: "lingee-fast", name: "快速", provider: "kingdee-maas", modelLevel: "fast", consumptionCoefficient: "0.5" },
  { id: "lingee-deep", name: "深度", provider: "kingdee-maas", modelLevel: "deep", consumptionCoefficient: "1" },
  { id: "lingee-expert", name: "专家", provider: "kingdee-maas", modelLevel: "expert", consumptionCoefficient: "3" },
  { id: "qwen3-max", name: "Qwen3-Max", provider: "kingdee-maas", consumptionCoefficient: "1.2" },
  { id: "deepseek-v3", name: "DeepSeek-V3", provider: "kingdee-maas", consumptionCoefficient: "0.8" },
]
