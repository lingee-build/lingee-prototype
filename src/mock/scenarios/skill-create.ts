import { devStore } from "../dev-store"
import type { Scenario, ScenarioContext } from "./types"
import { entityName, slugOf } from "./types"

const SKILL_MD = `---
name: delivery-notice-query
description: 按单据编号、状态、通知日期查询发货通知单
---

# 发货通知单查询

## 何时使用
用户想查发货通知单的列表或某张单据的物料明细时。`

const QUERY_PY = `def query(billno=None, status=None, date_range=None, page=1, size=20):
    filters = build_filters(billno, status, date_range)
    rows = client.query("sm_delivernotice", filters, page=page, size=size)
    return render_table(rows) if rows else "没有符合条件的单据，请调整筛选条件"`

const body = (prompt: string) => prompt.replace(/^\/\S+\s*/, "").trim().slice(0, 120)

/** 剧本：一次典型的「技能创建」。回放引擎按顺序把它拆成流式事件 */
export const skillCreateScenario = ({ prompt, projectId }: ScenarioContext): Scenario => ({
  todos: ["确认需求与筛选条件", "查找业务对象元数据", "生成 SKILL.md 与查询脚本", "本地试运行并汇总"],
  steps: [
    {
      todo: 0,
      reasoning: "先理解需求里的业务对象和筛选条件。结果按分页表格展示、支持展开物料行明细，这是这类查询技能最常见的形态，直接按此实现。",
      tools: [{ tool: "skill", title: "kingdee-skill-creator", output: "已加载技能创建规范" }],
    },
    {
      todo: 1,
      tools: [
        { tool: "grep", title: "sm_delivernotice", detail: "匹配到 12 个字段", output: "billno\nbillstatus\nbizdate\norg.name\ncustomer.name\nmaterialentry.material.name\n…" },
        { tool: "read", title: "references/skill-spec.md", output: "技能目录需包含 SKILL.md；脚本放在 scripts/ 下；参考资料放在 references/ 下。" },
      ],
    },
    {
      todo: 2,
      tools: [
        { tool: "write", title: "SKILL.md", output: SKILL_MD },
        { tool: "write", title: "scripts/query.py", output: QUERY_PY },
      ],
    },
    {
      todo: 3,
      tools: [{ tool: "bash", title: "python scripts/query.py --dry-run", detail: "exit 0", output: "dry-run ok · 3 rows · 124ms" }],
      text: `已根据你的描述完成技能初稿。

## 我做了什么

1. 解析需求：${prompt.replace(/^\/\S+\s*/, "").slice(0, 48) || "按描述创建技能"}…
2. 生成 \`SKILL.md\`，写明触发场景、入参与输出格式
3. 生成查询脚本并通过了本地 dry-run

## 核心脚本

\`\`\`python
${QUERY_PY}
\`\`\`

## 下一步

- 点击 **本地测试**，用真实数据验证一次
- 如需调整字段或话术，直接告诉我要改的地方

> 这是原型工程的模拟回复，内容由剧本生成。`,
      // 回复末尾给出技能产物卡片；同时把技能写进开发页的数据里，「技能开发」页能看到这张新卡片
      card: () => {
        // 提示词里点了已有技能（「编辑【xxx】技能」）就是在它上面修改：标成本地有改动，不新建
        const target = devStore.skills.find((x) => prompt.includes(`【${x.name}】`) || prompt.includes(`【${x.displayName}】`))
        if (target) {
          devStore.skills = devStore.skills.map((x) => (x.id === target.id ? { ...x, entChanged: x.enterpriseStatus !== "saved", perChanged: x.personalInstalled } : x))
          return { kind: "kdskill", config: { id: target.name, title: target.displayName, directory: `skills/${target.name}` } }
        }
        const displayName = entityName(prompt, "技能")
        const name = slugOf(displayName, "skill")
        const exists = devStore.skills.some((x) => x.name === name)
        if (!exists)
          devStore.skills = [
            { id: `sk_${name}`, name, displayName, desc: body(prompt) || `${displayName}：由对话生成的技能。`, category: "供应链", projectId, personalInstalled: false, enterpriseStatus: "saved" },
            ...devStore.skills,
          ]
        return { kind: "kdskill", config: { id: name, title: displayName, directory: `skills/${name}` } }
      },
    },
  ],
})
