import { procurementArtifacts } from "../procurement-artifacts"
import { procurementService } from "@/services/procurement"
import type { Skill } from "./dev"
import { fileContent } from "./files"

export interface SkillDetail {
  developer: string
  version: string
  updateTime: string
  connector: string
  /** SKILL.md 全文（含 front matter） */
  content: string
  tools: Array<{ name: string; desc: string; type: string }>
  features: string[]
  changelog: Array<{ version: string; date: string; items: string[] }>
}

const TOOLS: Record<string, SkillDetail["tools"]> = {
  供应链: [
    { name: "单据查询", desc: "按条件查询供应链单据列表与明细", type: "MCP" },
    { name: "基础资料查询", desc: "查询物料、客户、供应商等基础资料", type: "MCP" },
  ],
  人力资源: [{ name: "假勤服务", desc: "查询假期余额、提交请假与销假申请", type: "API" }],
  财务: [{ name: "费用报销服务", desc: "创建报销单、上传票据、发起审批", type: "API" }],
}

/** 技能详情的 mock：由卡片数据推导，保证同一个技能每次打开内容一致 */
export function skillDetailOf(skill: Skill): SkillDetail {
  const artifact = procurementArtifacts.get(skill.name)
  if (artifact) return {
    developer: "Build", version: "1.0.0", updateTime: "2026.10.15", connector: "DC 企业上下文",
    content: artifact.files["SKILL.md"],
    tools: procurementService.discover().tools.map(tool => ({ name: tool.name, desc: tool.description, type: tool.name === "query_purchase_price_list" ? "MCP" : tool.type })),
    features: ["业务对象及工具发现", `按已确认规则预警：最近 ${artifact.rules.days} 天，上涨阈值 ${artifact.rules.threshold}%`, "价格比较口径统一与缺失数据处理"],
    changelog: [{ version: "v1.0.0", date: "2026.10.15", items: ["根据企业上下文发现结果与用户确认规则创建"] }],
  }
  const seed = Array.from(skill.id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0)
  const real = fileContent(`${skill.name}/SKILL.md`)
  return {
    developer: "梁平先",
    version: `1.${seed % 4}.${seed % 7}`,
    updateTime: `2026.${String((seed % 3) + 8).padStart(2, "0")}.${String((seed % 27) + 1).padStart(2, "0")}`,
    connector: "kingdee-cosmic 8.2",
    content: real.startsWith("---")
      ? real
      : `---\nname: ${skill.name}\ndescription: ${skill.desc}\n---\n\n# ${skill.displayName}\n\n## 何时使用\n\n${skill.desc}\n\n## 步骤\n\n1. 确认用户意图与必填信息\n2. 调用对应工具完成查询或提交\n3. 以表格或卡片形式返回结果，并给出下一步建议\n`,
    tools: TOOLS[skill.category] ?? [],
    features: ["支持多条件组合筛选", "结果为空时给出调整建议", "关键操作前向用户二次确认"],
    changelog: [
      { version: `v1.${seed % 4}.${seed % 7}`, date: "2026.10.08", items: ["优化空结果时的提示话术", "补充字段说明"] },
      { version: "v1.0.0", date: "2026.09.12", items: ["首次创建"] },
    ],
  }
}
