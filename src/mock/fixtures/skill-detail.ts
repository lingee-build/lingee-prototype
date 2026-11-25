import { procurementArtifacts } from "../procurement-artifacts"
import { procurementService } from "@/services/procurement"
import type { Skill } from "./dev"
import { fileContent } from "./files"

/** manifest tool_access.tools 的单个条目：线上解析器只认一层「键: 值」 */
export type ManifestToolEntry = Record<string, string>

export interface SkillDetail {
  developer: string
  version: string
  updateTime: string
  connector: string
  /** SKILL.md 全文（含 front matter） */
  content: string
  /** tool_access.tools 原样条目：分组与第二行徽标由 features/skill-detail/tool-groups.ts 推导 */
  tools: ManifestToolEntry[]
  features: string[]
  changelog: Array<{ version: string; date: string; items: string[] }>
  /** 技能所在目录的相对路径（跨工具技能有值，Lingee Build 原生技能为 undefined） */
  location?: string
}

/** 新技能的 manifest 条目：来源 / 供应商 / 服务都按线上字段名写 */
const tool = (
  id: string,
  display_name: string,
  description: string,
  source: string,
  provider_type: string,
  service_name: string,
  type = "MCP",
): ManifestToolEntry => ({ id, display_name, description, type, source, provider_type, service_name })

/** 旧技能条目：manifest 里没有来源记录，按 type 走旧样式（不分组、不显示第二行） */
const legacyTool = (display_name: string, description: string, type: string): ManifestToolEntry => ({ display_name, description, type })

const TOOLS: Record<string, ManifestToolEntry[]> = {
  // 8 条、5 个分组：演示搜索框与跨分组过滤
  供应链: [
    tool("query_purchase_price_list", "采购价格查询", "查询采购订单与价格表的最新价格、历史价格与供应商报价", "tenant", "KDERP", "供应链服务"),
    tool("query_supplier", "供应商档案查询", "按编码或名称查询供应商档案、联系人、结算方式与准入状态", "tenant", "KDERP", "基础资料服务"),
    tool("qcc_company_risk", "企业工商风险", "查询企业工商变更、司法风险与经营异常", "third_party", "THIRD", "企查查"),
    tool("local_price_ledger", "本地价格台账", "读取本地维护的价格台账文件，用于和历史报价做比对", "personal", "LINGEE_MCP", "本地文件"),
    tool("kdapp_purchase_price_board", "采购价格异常看板", "展示价格异常明细、处理状态与影响范围", "project_mcpapps", "LINGEE", ""),
    tool("web_search", "网页检索", "检索公开网页资料，并在结果中给出来源链接", "builtin", "LINGEE", "内置工具"),
    tool("file_read_write", "文件读写", "读取或写入工程内的文本与 CSV 文件", "builtin", "LINGEE", "内置工具"),
    tool("code_run", "代码执行", "在本地沙箱执行 Python 片段并返回输出", "builtin", "LINGEE", "内置工具"),
  ],
  // 恰好 6 条：搜索框阈值的下界
  财务: [
    tool("query_ar_aging", "应收账龄查询", "按客户与账期区间统计应收余额和逾期天数", "tenant", "KDERP", "财务服务"),
    tool("query_customer_credit", "客户信用查询", "查询授信额度、已用额度与逾期次数", "tenant", "KDERP", "财务服务"),
    tool("kdapp_customer_credit_board", "客户信用看板", "展示客户信用等级分布与放单建议", "mcpapps", "LINGEE", "信用评估组件"),
    tool("web_search", "网页检索", "检索公开网页资料，并在结果中给出来源链接", "builtin", "LINGEE", "内置工具"),
    tool("file_read_write", "文件读写", "读取或写入工程内的文本与 CSV 文件", "builtin", "LINGEE", "内置工具"),
    tool("code_run", "代码执行", "在本地沙箱执行 Python 片段并返回输出", "builtin", "LINGEE", "内置工具"),
  ],
  // 3 条：不显示搜索框
  人力资源: [
    tool("query_leave_balance", "假勤服务查询", "查询假期余额、已请天数与请假记录", "tenant", "KDERP", "人力资源服务"),
    tool("query_payslip", "薪资条查询", "按月份查询薪资条明细与扣款说明", "tenant", "KDERP", "薪酬服务"),
    tool("web_search", "网页检索", "检索公开网页资料，并在结果中给出来源链接", "builtin", "LINGEE", "内置工具"),
  ],
}

/** 旧技能：manifest 里没有来源记录，展示时不分组、不显示第二行（012603-D6 降级） */
const LEGACY_TOOLS: Record<string, ManifestToolEntry[]> = {
  sk_supplier: [
    legacyTool("供应商档案查询", "按编码或名称查询供应商档案与准入状态", "MCP"),
    legacyTool("企业工商风险", "查询企业工商变更、司法风险与经营异常", "MCP"),
    legacyTool("网页检索", "检索公开网页资料，并在结果中给出来源链接", "内置"),
  ],
}

/** 技能详情的 mock：由卡片数据推导，保证同一个技能每次打开内容一致 */
export function skillDetailOf(skill: Skill): SkillDetail {
  // 跨工具技能有自己的 location；其他技能按来源补默认产物路径
  const defaultLocation = skill.location
    ?? (skill.personalInstalled
      ? `/Users/demo/.lingeebuild/skills/${skill.name}`
      : `/Users/demo/projects/supply-chain/skills/${skill.name}`)
  const artifact = procurementArtifacts.get(skill.name)
  if (artifact) return {
    developer: "Build", version: "1.0.0", updateTime: "2026.10.15", connector: "DC 企业上下文",
    content: artifact.files["SKILL.md"],
    tools: procurementService.discover().tools.map(tool => ({
      id: tool.name,
      display_name: tool.name,
      description: tool.description,
      type: tool.type || "MCP",
      source: "tenant",
      provider_type: "KDERP",
      service_name: "采购云",
    })),
    features: ["业务对象及工具发现", `按已确认规则预警：最近 ${artifact.rules.days} 天，上涨阈值 ${artifact.rules.threshold}%`, "价格比较口径统一与缺失数据处理"],
    changelog: [{ version: "v1.0.0", date: "2026.10.15", items: ["根据企业上下文发现结果与用户确认规则创建"] }],
    location: defaultLocation,
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
    tools: LEGACY_TOOLS[skill.id] ?? TOOLS[skill.category] ?? [],
    features: ["支持多条件组合筛选", "结果为空时给出调整建议", "关键操作前向用户二次确认"],
    changelog: [
      { version: `v1.${seed % 4}.${seed % 7}`, date: "2026.10.08", items: ["优化空结果时的提示话术", "补充字段说明"] },
      { version: "v1.0.0", date: "2026.09.12", items: ["首次创建"] },
    ],
    location: defaultLocation,
  }
}