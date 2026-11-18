import type { Agent, Skill } from "@/mock/fixtures/dev"

/**
 * 智能体个人自用到 Work：安装包组成与安装前检测（原型模拟）。
 * - 安装包 = 智能体配置 + 关联技能文件 + 工具依赖声明
 * - MCP 连接器、知识库只保留引用；不打包连接器密钥、授权凭据、调试数据
 * - 检测只看 Build 侧：规范扫描、安全扫描、关联技能声明的工具在当前 Build 开发环境是否存在
 *   （不检查 Work 侧工具、ERP 连接器授权、知识库访问权限）
 */

export type CheckCategory = "spec" | "security" | "tool"

export interface CheckIssue {
  category: CheckCategory
  /** 问题出在哪个技能；智能体自身配置的问题为空 */
  skillName?: string
  problem: string
  suggestion: string
}

export const CHECK_STEPS: Array<{ key: "pack" | CheckCategory; label: string }> = [
  { key: "pack", label: "打包智能体及关联技能" },
  { key: "spec", label: "规范扫描" },
  { key: "security", label: "安全扫描" },
  { key: "tool", label: "工具存在性检测" },
]

export const CATEGORY_LABEL: Record<CheckCategory, string> = {
  spec: "规范扫描",
  security: "安全扫描",
  tool: "工具存在性",
}

/** 当前 Build 开发环境已有的工具（演示数据） */
const BUILD_ENV_TOOLS = new Set([
  "kd_sal_order_query",
  "kd_sal_order_detail",
  "kd_sal_stats_aggregate",
  "kd_doc_render",
  "kd_stock_query",
  "kd_bill_query",
  "kd_bill_submit",
])

/** 技能声明的工具依赖（演示数据，按技能名） */
const SKILL_TOOLS: Record<string, string[]> = {
  "sales-order-query": ["kd_sal_order_query", "kd_sal_order_detail"],
  "sales-data-stats": ["kd_sal_stats_aggregate"],
  "weekly-report-gen": ["kd_doc_render", "kd_mail_send"],
  "realtime-stock-query": ["kd_stock_query"],
  "expense-claim-submit": ["kd_bill_submit", "kd_ocr_invoice"],
}

/** 智能体引用的 MCP 连接器（演示数据，只保留引用） */
const AGENT_MCP: Record<string, string[]> = {
  "sales-weekly-expert": ["金蝶云星空 ERP 连接器"],
  "scm-collab-assistant": ["金蝶云星空 ERP 连接器"],
  "expense-advisor": ["费控系统连接器"],
}

export const toolsOf = (skillName: string) => SKILL_TOOLS[skillName] ?? []
export const mcpRefsOf = (agent: Agent) => AGENT_MCP[agent.id] ?? []
export const knowledgeRefsOf = (agent: Agent) => agent.knowledge.map((k) => k.name)

/**
 * 运行检测，返回问题清单（空 = 通过）。
 * fixed：演示用，用户「去修复」后再次安装，销售周报专家的问题视为已处理。
 */
export function runInstallChecks(agent: Agent, skills: Skill[], fixed: boolean): CheckIssue[] {
  const issues: CheckIssue[] = []
  if (fixed) return issues

  // 演示：销售周报专家首次安装会命中规范 + 工具存在性问题
  if (agent.id === "sales-weekly-expert") {
    issues.push({
      category: "spec",
      skillName: "周报生成",
      problem: "SKILL.md 缺少 description 中的触发说明，智能体无法判断何时调用该技能。",
      suggestion: "在 description 中补充「何时使用」的说明，例如：用户要求生成销售周报时使用。",
    })
  }

  for (const ref of agent.skills) {
    const skill = skills.find((s) => s.name === ref.skillName)
    if (skill?.inspect === "fail") {
      issues.push({
        category: "spec",
        skillName: ref.name,
        problem: "技能检查未通过：存在不符合技能规范的必修项。",
        suggestion: "在技能开发页对该技能执行「检查」，按提示修复后重新提交。",
      })
    }
    for (const tool of toolsOf(ref.skillName)) {
      if (!BUILD_ENV_TOOLS.has(tool)) {
        issues.push({
          category: "tool",
          skillName: ref.name,
          problem: `声明的工具「${tool}」在当前 Build 开发环境中不存在。`,
          suggestion: "在开发环境中接入该工具，或从技能中移除对它的引用后重新提交。",
        })
      }
    }
  }

  // 演示：财务报销顾问带一个安全问题
  if (agent.id === "expense-advisor") {
    issues.push({
      category: "security",
      skillName: "费用报销提交",
      problem: "scripts/submit.py 中包含明文 AccessKey。",
      suggestion: "删除脚本中的密钥，改为通过连接器授权获取凭据。",
    })
  }
  return issues
}
