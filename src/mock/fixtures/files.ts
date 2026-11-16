/** 项目文件与会话变更的 mock。路径一律用 "/" 分隔的相对路径 */

const SKILL_MD = `---
name: delivery-notice-query
description: 按单据编号、状态、通知日期查询发货通知单，返回分页列表或物料行明细
---

# 发货通知单查询

## 何时使用

用户想查发货通知单的列表，或查看某张单据的物料明细时使用。

## 入参

| 参数 | 说明 | 必填 |
| --- | --- | --- |
| \`billno\` | 单据编号，支持模糊匹配 | 否 |
| \`status\` | 单据状态：A 暂存 / B 已提交 / C 已审核 | 否 |
| \`date_range\` | 通知日期区间 | 否 |

## 输出

- 默认返回分页表格（每页 20 条）
- 用户要求时展开物料行明细
- 查询为空时提示调整筛选条件
`

const QUERY_PY = `"""发货通知单查询脚本"""
from client import KingdeeClient

client = KingdeeClient.from_env()
PAGE_SIZE = 20


def build_filters(billno=None, status=None, date_range=None):
    filters = []
    if billno:
        filters.append(("billno", "like", f"%{billno}%"))
    if status:
        filters.append(("billstatus", "=", status))
    if date_range:
        filters.append(("bizdate", "between", date_range))
    return filters


def query(billno=None, status=None, date_range=None, page=1, size=PAGE_SIZE):
    filters = build_filters(billno, status, date_range)
    rows = client.query("sm_delivernotice", filters, page=page, size=size)
    if not rows:
        return "没有符合条件的单据，请调整筛选条件"
    return render_table(rows)


def render_table(rows):
    header = "| 单据编号 | 状态 | 发货组织 | 订货客户 |\\n| --- | --- | --- | --- |"
    body = "\\n".join(f"| {r.billno} | {r.status} | {r.org} | {r.customer} |" for r in rows)
    return f"{header}\\n{body}"
`

const FIELDS_MD = `# 发货通知单字段

| 字段 | 标识 | 说明 |
| --- | --- | --- |
| 单据编号 | \`billno\` | 支持模糊匹配 |
| 单据状态 | \`billstatus\` | A 暂存 / B 已提交 / C 已审核 |
| 通知日期 | \`bizdate\` | 日期区间 |
| 发货组织 | \`org.name\` | 取当前用户有权组织 |
| 订货客户 | \`customer.name\` | — |
`

const generic = (path: string) =>
  path.endsWith(".md")
    ? `# ${path.split("/").slice(-2, -1)[0] ?? path}\n\n这是原型工程里的示例文件，内容由 mock 生成。\n`
    : path.endsWith(".json")
      ? `{\n  "name": "${path.split("/")[0]}",\n  "version": "1.0.0",\n  "private": true\n}\n`
      : `# ${path}\n# 原型工程示例文件\n\ndef main():\n    print("hello lingee")\n`

const CONTENT: Record<string, string> = {
  "delivery-notice-query/SKILL.md": SKILL_MD,
  "delivery-notice-query/scripts/query.py": QUERY_PY,
  "delivery-notice-query/references/fields.md": FIELDS_MD,
}

export const projectFilePaths: Record<string, string[]> = {
  "scm-skills": [
    "delivery-notice-query/SKILL.md",
    "delivery-notice-query/scripts/query.py",
    "delivery-notice-query/references/fields.md",
    "realtime-stock-query/SKILL.md",
    "realtime-stock-query/scripts/stock.py",
    "purchase-order-push/SKILL.md",
    "purchase-order-push/scripts/push.py",
    "README.md",
    "package.json",
  ],
  "hr-assistant": ["leave-request/SKILL.md", "leave-request/scripts/submit.py", "payslip-explain/SKILL.md", "agents/hr-assistant.json", "README.md"],
  workspace: ["expense-claim-submit/SKILL.md", "expense-claim-card/src/App.tsx", "expense-claim-card/package.json", "notes.md"],
}

export const fileContent = (path: string) => CONTENT[path] ?? generic(path)

export interface FileDiff {
  path: string
  kind: "add" | "mix" | "del"
  additions: number
  deletions: number
  /** 统一 diff 的行：首字符 "+" 新增、"-" 删除、空格为上下文 */
  lines: string[]
}

const added = (path: string): FileDiff => {
  const lines = fileContent(path).trimEnd().split("\n")
  return { path, kind: "add", additions: lines.length, deletions: 0, lines: lines.map((line) => `+${line}`) }
}

/** 每个会话产生的变更；没配的会话视为没有变更 */
export const sessionDiffs: Record<string, FileDiff[]> = {
  ses_delivery: [
    added("delivery-notice-query/SKILL.md"),
    added("delivery-notice-query/scripts/query.py"),
    {
      path: "README.md",
      kind: "mix",
      additions: 2,
      deletions: 1,
      lines: [" # 供应链技能包", " ", "-目前包含 2 个技能。", "+目前包含 3 个技能：", "+- delivery-notice-query：发货通知单查询", " - realtime-stock-query：即时库存查询"],
    },
  ],
}
