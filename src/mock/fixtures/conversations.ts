import type { Message, Part, ToolPart } from "../types"

const MIN = 60_000

type ToolSpec = [tool: ToolPart["tool"], title: string, detail?: string, output?: string]

interface TurnSpec {
  ask: string
  reasoning?: string
  tools?: ToolSpec[]
  reply: string
  /** 回复末尾的产物卡片 */
  card?: { kind: string; config: Record<string, string> }
}

/**
 * 把一组「提问 → 回复」写成完整的消息列表（用户消息 + 助手消息，含思考、工具调用、正文、产物卡片）。
 * endAgo：最后一轮结束距今多久；前面的轮次依次往前推。
 */
const conversation = (sessionId: string, endAgo: number, turns: TurnSpec[]): Message[] =>
  turns.flatMap((turn, index) => {
    const end = Date.now() - endAgo - (turns.length - 1 - index) * 25 * MIN
    const start = end - 6 * MIN
    const id = (suffix: string) => `${sessionId}_${index}_${suffix}`
    const parts: Part[] = [
      ...(turn.reasoning ? [{ id: id("r"), type: "reasoning" as const, text: turn.reasoning, time: { start, end: start + MIN } }] : []),
      ...(turn.tools ?? []).map(([tool, title, detail, output], i) => ({ id: id(`t${i}`), type: "tool" as const, tool, title, detail, output, state: "completed" as const })),
      { id: id("x"), type: "text" as const, text: turn.reply },
      ...(turn.card ? [{ id: id("c"), type: "text" as const, text: `:::render:${turn.card.kind} ${JSON.stringify(turn.card.config)}:::` }] : []),
    ]
    return [
      { id: id("u"), sessionId, role: "user" as const, time: { created: start, completed: start }, parts: [{ id: id("ux"), type: "text" as const, text: turn.ask }] },
      { id: id("a"), sessionId, role: "assistant" as const, agent: "build", model: "deep", time: { created: start, completed: end }, parts },
    ]
  })

const skillCard = (id: string, title: string) => ({ kind: "kdskill", config: { id, title, directory: `skills/${id}` } })
const agentCard = (id: string, title: string) => ({ kind: "ai-partner", config: { id, title } })

/** 预置会话的完整对话。key 是会话 id，和 projects.ts 里的会话列表一一对应 */
export const conversations: Record<string, Message[]> = {
  ses_stock: conversation("ses_stock", 3 * 60 * MIN, [
    {
      ask: "/kingdee-skill-creator 编辑【即时库存查询】技能：查询结果增加仓位维度，没启用仓位管理的仓库照旧按仓库汇总。",
      reasoning: "现有脚本按物料 + 仓库汇总。要加仓位维度，得先确认即时库存表里仓位字段的标识，以及怎么判断仓库是否启用了仓位管理。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["read", "realtime-stock-query/SKILL.md", undefined, "---\nname: realtime-stock-query\ndescription: 按物料、仓库、仓位查询即时库存与可用量\n---"],
        ["grep", "im_inv_realbalance", "匹配到 9 个字段", "material.number\nwarehouse.name\nlocation.name\nbaseqty\navbbaseqty\nlotnum\n…"],
        ["edit", "realtime-stock-query/scripts/query.py", "+18 -4", "group_keys = ['material', 'warehouse']\nif warehouse.get('isopenlocation'):\n    group_keys.append('location')"],
        ["edit", "realtime-stock-query/SKILL.md", "+6 -1", "## 输出\n- 启用仓位管理的仓库：按 物料 / 仓库 / 仓位 三级展示\n- 未启用的仓库：按 物料 / 仓库 汇总"],
        ["bash", "python scripts/query.py --material A0012 --dry-run", "exit 0", "dry-run ok · 6 rows · 2 warehouses (1 with location) · 141ms"],
      ],
      reply: `已为 **即时库存查询** 增加仓位维度。

## 改动

| 文件 | 改动 |
| --- | --- |
| \`scripts/query.py\` | 仓库启用仓位管理时，分组键追加 \`location\` |
| \`SKILL.md\` | 「输出」一节补充两种展示方式的说明 |

## 效果

- 启用仓位管理的仓库：按 **物料 / 仓库 / 仓位** 三级展示，仓位行缩进显示
- 未启用的仓库：保持原样，按 **物料 / 仓库** 汇总

本地 dry-run 已通过。这个技能之前已提交审核，本次改动还在本地，确认后需要重新提交。`,
      card: skillCard("realtime-stock-query", "即时库存查询"),
    },
    {
      ask: "仓位那一列能不能放在仓库后面，而不是最后一列？",
      tools: [["edit", "realtime-stock-query/scripts/query.py", "+1 -1", "COLUMNS = ['物料', '仓库', '仓位', '库存量', '可用量', '批号']"]],
      reply: "已调整列顺序：**物料 → 仓库 → 仓位 → 库存量 → 可用量 → 批号**。未启用仓位管理的仓库，仓位一列显示为「—」。",
    },
  ]),

  ses_purchase: conversation("ses_purchase", 26 * 60 * MIN, [
    {
      ask: "/kingdee-skill-creator 创建一个「采购订单下推入库」技能：校验采购订单可入库数量后下推生成采购入库单，超收时提示并阻止提交。",
      reasoning: "这是写操作类技能：下推会生成新单据，必须在提交前让用户确认。超收校验要用订单行的「可入库数量」，不能自己拿订单数量减已入库数量去算，否则会漏掉退料的情况。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["grep", "pm_purorderbill", "匹配到 11 个字段", "billno\nbillstatus\nsupplier.name\nbillentry.material.name\nbillentry.qty\nbillentry.joininstockqty\n…"],
        ["write", "purchase-order-push/SKILL.md", undefined, "---\nname: purchase-order-push\ndescription: 校验可入库数量后，将采购订单下推为采购入库单\n---"],
        ["write", "purchase-order-push/scripts/push.py", undefined, "def push(billno, lines):\n    order = load_order(billno)\n    over = [l for l in lines if l.qty > order.receivable(l.seq)]\n    if over:\n        return reject(over)\n    return client.push('pm_purorderbill', 'im_purinbill', billno, lines)"],
        ["bash", "python scripts/push.py --billno CGDD-2026-000318 --dry-run", "exit 0", "dry-run ok · 3 lines · 0 over-receipt"],
      ],
      reply: `**采购订单下推入库** 技能已创建。

## 流程

1. 用户给出采购订单号，技能读出各行的 **可入库数量**
2. 用户确认本次入库的行与数量
3. 逐行校验：本次数量 > 可入库数量即判定为超收，列出超收行并 **阻止提交**
4. 校验通过后向用户复述一遍，确认后才下推生成采购入库单

## 说明

- 这是写操作技能，第 4 步的确认不能省
- 超收提示会带上订单行号、物料、可入库数量与本次数量，方便用户直接改`,
      card: skillCard("purchase-order-push", "采购订单下推入库"),
    },
  ]),

  ses_supplier: conversation("ses_supplier", 2 * 24 * 60 * MIN, [
    {
      ask: "/ai-partner-creator 做一个供应商准入评估的智能体，结合资质文件和历史绩效给出准入评分，输出结构化评估报告。",
      reasoning: "这个智能体面向采购专员，回答可以用业务术语。评分需要依据，应该关联「供应商管理」知识目录里的评分标准，并挂上供应商准入核查技能来取历史交付和质量数据。",
      tools: [
        ["skill", "ai-partner-creator", undefined, "已加载智能体创建规范"],
        ["grep", "skills/*/SKILL.md", "找到可用技能", "supplier-onboarding-check — 供应商准入核查\ndelivery-notice-query — 发货通知单查询"],
        ["write", "ai-partners/supplier-access-review/assistant.json", undefined, '{\n  "name": "供应商准入评估",\n  "domain": "supply-chain",\n  "skills": ["supplier-onboarding-check"],\n  "knowledge": ["供应链制度/供应商管理"]\n}'],
      ],
      reply: `**供应商准入评估** 智能体已创建。

## 配置概览

| 项目 | 内容 |
| --- | --- |
| 所属领域 | 供应链 |
| 角色设定 | 逐项核对资质 → 汇总历史绩效 → 输出评分与风险点 |
| 技能 | 供应商准入核查 |
| 知识 | 供应链制度 / 供应商管理 |

## 评估报告的结构

1. 结论：建议准入 / 有条件准入 / 不建议准入
2. 四个维度的得分：资质、交付、质量、服务
3. 风险点清单，每条附依据

点卡片可以打开配置面板继续调整。`,
      card: agentCard("supplier-access-review", "供应商准入评估"),
    },
  ]),

  ses_price: conversation("ses_price", 4 * 24 * 60 * MIN, [
    {
      ask: "/kingdee-skill-creator 创建「价格表批量调价」技能：按物料分组或供应商批量调整采购价格表，支持按百分比或固定金额调价，调价前先给出影响范围预览。",
      reasoning: "批量改价影响面大，属于高风险写操作。必须先出预览（影响多少行、调价前后对比），用户确认后才执行，并且保留调价前的版本以便回退。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["grep", "pm_purpricelist", "匹配到 8 个字段", "supplier.name\nmaterialgroup.name\nmaterial.number\nprice\ntaxprice\neffectdate\n…"],
        ["write", "price-batch-adjust/SKILL.md", undefined, "---\nname: price-batch-adjust\ndescription: 按物料分组或供应商批量调整采购价格表\n---"],
        ["write", "price-batch-adjust/scripts/adjust.py", undefined, "def preview(scope, mode, value):\n    rows = load_prices(scope)\n    return [(r, apply(r.price, mode, value)) for r in rows]"],
        ["bash", "python scripts/adjust.py --group 标准件 --pct 3 --preview", "exit 0", "preview · 128 rows · avg +3.00% · max delta 4.86"],
      ],
      reply: `**价格表批量调价** 技能已创建。

## 能力

- 范围：按 **物料分组** 或 **供应商** 圈定价格行
- 方式：按 **百分比** 或 **固定金额** 调整，可指定生效日期
- 预览：执行前列出影响行数、调价前后对比、最大变动额

## 安全措施

- 预览与执行是两步，执行前必须由用户确认
- 执行时生成新的价格版本，旧版本保留，可回退`,
      card: skillCard("price-batch-adjust", "价格表批量调价"),
    },
  ]),

  ses_mrp: conversation("ses_mrp", 6 * 24 * 60 * MIN, [
    {
      ask: "帮我解读一下上周五的 MRP 运算结果，为什么 A0012 这个物料建议采购量比平时多了一倍？",
      reasoning: "要解释建议量翻倍，得看这个物料的毛需求、现有库存、在途和安全库存这几项里哪一项变了。",
      tools: [
        ["grep", "mrp_planorder A0012", "匹配到 4 条计划订单", "PO-PLAN-0931  A0012  2400  2026-10-20\nPO-PLAN-0932  A0012  1200  2026-10-27\n…"],
        ["read", "mrp/calc-log-20261002.txt", undefined, "A0012 毛需求 5200（上期 2600）\n现有库存 800 · 在途 400 · 安全库存 600\n净需求 = 5200 - 800 - 400 + 600 = 4600"],
      ],
      reply: `A0012 建议采购量翻倍，原因是 **毛需求翻倍**，不是参数出了问题。

## 计算过程

| 项目 | 本期 | 上期 |
| --- | --- | --- |
| 毛需求 | 5,200 | 2,600 |
| 现有库存 | 800 | 900 |
| 在途 | 400 | 400 |
| 安全库存 | 600 | 600 |
| **净需求** | **4,600** | **1,900** |

## 毛需求为什么涨

上周新增了两张销售订单（合计 2,400 台成品），按 BOM 展开后对 A0012 的需求增加了 2,600。

## 建议

- 两张订单的交期都在 10 月下旬，建议按计划订单分两批下达，避免一次到货占用仓位
- 如果其中一张订单还可能变更，可以先下达 10 月 20 日那一批`,
    },
  ]),

  ses_return: conversation("ses_return", 9 * 24 * 60 * MIN, [
    {
      ask: "帮我梳理一下销售退货的完整流程，后面想做成一个技能。",
      reasoning: "先把流程理清楚，再判断哪些环节适合交给技能：查询类的可以全自动，涉及审批和库存变动的要保留人工确认。",
      tools: [["read", "docs/sales-return-policy.md", undefined, "退货申请须关联原销售出库单；质检不合格品不得直接入良品仓。"]],
      reply: `## 销售退货流程

1. **发起退货申请**：客户或销售员提出，必须关联原销售出库单
2. **审批**：销售主管审核退货原因与数量，超过原出库数量的不予通过
3. **退货入库**：仓库收货，生成销售退货入库单
4. **质检**：合格品入良品仓，不合格品入待处理仓
5. **财务处理**：生成红字应收单，冲减应收或安排退款

## 哪些环节适合做成技能

| 环节 | 建议 | 原因 |
| --- | --- | --- |
| 查询可退数量 | 适合 | 纯查询，无副作用 |
| 发起退货申请 | 适合，需确认 | 写操作，提交前向用户复述 |
| 审批 | 不建议 | 需要人来判断 |
| 生成红字应收 | 暂不建议 | 涉及财务，先人工处理 |

需要的话，我可以先做「查询可退数量 + 发起退货申请」这一段。`,
    },
  ]),

  ses_leave: conversation("ses_leave", 40 * MIN, [
    {
      ask: "/kingdee-skill-creator 创建「办理请假申请」技能：通过对话收集假期类型、起止日期、事由与代理人，校验剩余假期天数，生成请假单草稿并在确认后提交。",
      reasoning: "信息要分步收集，不能一次问完。年假、调休要校验余额；提交是写操作，必须先展示草稿让用户确认。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["grep", "hr_leaveapply", "匹配到 10 个字段", "leavetype.name\nstartdate\nenddate\ndays\nreason\nagent.name\n…"],
        ["write", "leave-request/SKILL.md", undefined, "---\nname: leave-request\ndescription: 通过对话收集请假信息，校验假期余额后提交请假单\n---"],
        ["write", "leave-request/scripts/submit.py", undefined, "def submit(draft):\n    balance = query_balance(draft.user, draft.leave_type)\n    if draft.days > balance:\n        return insufficient(balance)\n    return client.save('hr_leaveapply', draft)"],
        ["bash", "python scripts/submit.py --dry-run", "exit 0", "dry-run ok · balance check passed"],
      ],
      reply: `**办理请假申请** 技能已创建。

## 对话流程

1. 问假期类型（年假 / 调休 / 事假 / 病假）
2. 问起止日期，自动算出天数并排除周末与法定节假日
3. 年假、调休校验剩余天数，不足时告知余额并建议改期或换假种
4. 问事由与工作代理人
5. 展示请假单草稿，**用户确认后才提交**

## 待完善

校验报告里有 3 项未通过：正文引用的 \`references/leave-policy.md\` 还没创建、缺少跨年假期的处理说明、description 超长。点卡片在「检查」页签可以看到明细。`,
      card: skillCard("leave-request", "办理请假申请"),
    },
  ]),

  ses_onboard: conversation("ses_onboard", 5 * 60 * MIN, [
    {
      ask: "/ai-partner-creator 创建一个新员工入职指引的智能体，按岗位生成入职待办清单，逐项引导完成账号开通、制度学习与设备领用。",
      reasoning: "面向刚入职的员工，语气要亲切、步骤要具体。制度类内容必须来自知识库，所以要关联「入职与转正」目录。",
      tools: [
        ["skill", "ai-partner-creator", undefined, "已加载智能体创建规范"],
        ["read", "references/role-template.md", undefined, "角色设定建议包含：角色、工作方式、边界三节。"],
        ["write", "ai-partners/onboarding-guide/assistant.json", undefined, '{\n  "name": "新员工入职指引",\n  "domain": "hr",\n  "knowledge": ["人事制度/入职与转正"]\n}'],
      ],
      reply: `**新员工入职指引** 智能体已创建。

## 它会怎么做

- 先问岗位与入职日期，生成 **第一周待办清单**
- 每完成一项主动提示下一项；账号、设备类问题引导联系 IT 服务台
- 制度类问题引用知识库原文，并给出条款出处

## 配置概览

| 项目 | 内容 |
| --- | --- |
| 所属领域 | 人力资源 |
| 知识 | 人事制度 / 入职与转正 |
| 技能 | 暂未配置 |`,
      card: agentCard("onboarding-guide", "新员工入职指引"),
    },
    {
      ask: "/ai-partner-creator 编辑【新员工入职指引】：回答时先给当天要做的事，再给本周其余待办。",
      tools: [["edit", "ai-partners/onboarding-guide/assistant.json", "+2 -1", "role: 工作方式第 1 条调整为「先给当天要做的事，再列本周其余待办」"]],
      reply: "已更新角色设定：回答时 **先给当天要做的事，再列本周其余待办**。这个智能体已经发布过，本次改动保存在本地，需要重新提交审核后才会生效。",
      card: agentCard("onboarding-guide", "新员工入职指引"),
    },
  ]),

  ses_salary: conversation("ses_salary", 3 * 24 * 60 * MIN, [
    {
      ask: "/kingdee-skill-creator 创建「薪资条查询与解释」技能：查询指定月份的薪资条，并用通俗语言解释各项扣款与补贴的计算依据。",
      reasoning: "薪资是敏感数据，只能查本人的。解释部分要有依据，社保和公积金的比例应该从知识库或接口取，不能写死在技能里。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["grep", "hsas_paydetail", "匹配到 12 个字段", "period\nbasesalary\nperformance\nsocialinsurance\nhousingfund\nincometax\n…"],
        ["write", "payslip-explain/SKILL.md", undefined, "---\nname: payslip-explain\ndescription: 查询本人指定月份薪资条，并解释各项扣款与补贴\n---"],
        ["write", "payslip-explain/scripts/query.py", undefined, "def query(period):\n    return client.query('hsas_paydetail', {'employee': current_user(), 'period': period})"],
      ],
      reply: `**薪资条查询与解释** 技能已创建。

## 能力

- 查询 **本人** 指定月份的薪资条（不支持查他人）
- 逐项解释：应发、社保、公积金、个税、实发
- 对比上月，指出变化超过 5% 的项目并说明原因

## 示例回答

> 10 月实发 18,640 元，比 9 月少 420 元。主要原因是本月个税累计预扣额跨档，税率从 10% 变为 20%，多扣了 386 元。`,
      card: skillCard("payslip-explain", "薪资条查询与解释"),
    },
  ]),

  ses_expense: conversation("ses_expense", 26 * 60 * MIN, [
    {
      ask: "/kingdee-skill-creator 创建「费用报销提交」技能：分步收集费用类型、金额、发生日期和票据附件，自动识别差旅票据，超过限额时提醒走额外审批。",
      reasoning: "票据识别结果可能不准，识别出的金额和日期要让用户核对后再用。限额要按费用类型和职级取，不能写死。",
      tools: [
        ["skill", "kingdee-skill-creator", undefined, "已加载技能创建规范"],
        ["grep", "er_dailyreimbursebill", "匹配到 9 个字段", "expenseitem.name\namount\nhappendate\ninvoiceno\nattachment\n…"],
        ["write", "expense-claim-submit/SKILL.md", undefined, "---\nname: expense-claim-submit\ndescription: 分步收集报销信息并识别票据，校验费用标准后提交报销单\n---"],
        ["write", "expense-claim-submit/scripts/ocr.py", undefined, "def recognize(file):\n    result = ocr_client.invoice(file)\n    return {'amount': result.total, 'date': result.date, 'type': classify(result)}"],
        ["bash", "python scripts/ocr.py samples/train-ticket.jpg", "exit 0", "type=火车票 amount=553.00 date=2026-09-28 confidence=0.97"],
      ],
      reply: `**费用报销提交** 技能已创建。

## 流程

1. 用户上传票据，技能识别出 **类型、金额、日期**，并请用户核对
2. 补充费用类型与事由
3. 按费用类型与职级取限额，超限时提示「需要额外审批」并说明超出多少
4. 展示报销单草稿，确认后提交

## 支持识别的票据

火车票、机票行程单、出租车票、住宿发票、增值税发票。识别置信度低于 0.9 时会提示用户手动核对。`,
      card: skillCard("expense-claim-submit", "费用报销提交"),
    },
  ]),

  ses_card: conversation("ses_card", 8 * 24 * 60 * MIN, [
    {
      ask: "/mcp-apps-builder 做一个「费用报销卡片」业务组件：在对话中展示报销单摘要，支持直接修改金额、补充票据并提交。",
      reasoning: "组件既要展示也要操作，所以需要配置 MCP 连接器：查询用 expense_claim_query，提交用 expense_claim_submit。",
      tools: [
        ["skill", "mcp-apps-builder", undefined, "已加载业务组件开发规范"],
        ["write", "mcp-app/kdcloud_fin_expense_claim_card/src/App.tsx", undefined, "export default function App({ toolInput }) {\n  const { data } = useToolResult('expense_claim_query', toolInput)\n  return <ClaimCard claim={data} onSubmit={submit} />\n}"],
        ["write", "mcp-app/kdcloud_fin_expense_claim_card/info.json", undefined, '{\n  "appCode": "kdcloud_fin_expense_claim_card",\n  "appName": "费用报销卡片",\n  "runMode": "message",\n  "version": "1.0.0"\n}'],
        ["bash", "npm run build", "exit 0", "✓ 41 modules transformed.\ndist/assets/index.js  64.80 kB\n✓ built in 1.42s"],
      ],
      reply: `**费用报销卡片** 已构建完成。

## 产物

- 组件编码：\`kdcloud_fin_expense_claim_card\`
- 关联工具：\`expense_claim_query\`（查询）、\`expense_claim_submit\`（提交）
- 已生成 \`dist.zip\` 与 \`info.json\`

## 交互

- 卡片顶部是报销单摘要：事由、合计金额、票据张数
- 金额可以直接点击修改，修改后自动重算合计
- 「补充票据」上传附件，「提交」前会弹出二次确认

点卡片上的 **详情** 可以查看基本信息与 info.json 完整性检查。`,
      card: { kind: "kdapp-artifact", config: { appCode: "kdcloud_fin_expense_claim_card", title: "费用报销卡片", phase: "preview", jobId: "job_expense_card", url: "http://localhost:5173" } },
    },
  ]),
}
