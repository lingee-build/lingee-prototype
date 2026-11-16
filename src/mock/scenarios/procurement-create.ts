import { defaultRules, flow, procurementService, purchaseOrder, type Rules } from '@/services/procurement'
import { procurementArtifacts } from '../procurement-artifacts'
import { devStore } from '../dev-store'
import { uid } from '../latency'
import type { Scenario, ScenarioContext } from './types'

const options = (choices: [label: string, description: string][], question: string, custom = false) => ({ question, custom, options: choices.map(([label, description], i) => ({ label, description, recommended: i === 0 })) })
export function parseProcurementRules(answers: string[][]): Rules {
  const values = Array.from({ length: 5 }, (_, i) => answers[i]?.[0] ?? '')
  const threshold = Number.parseFloat(values[2])
  return {
    reference: values[0] === '仅历史均价' ? 'history' : values[0] === '仅采购价目表' ? 'catalog' : 'both',
    days: values[1].includes('180') ? 180 : values[1].includes('30') ? 30 : 90,
    threshold: Number.isFinite(threshold) && threshold >= 0 && threshold <= 1000 ? threshold : 15,
    mode: values[3] === '全部参考价超过阈值' ? 'all' : 'any',
    average: values[4] === '按采购数量加权平均' ? 'weighted' : 'simple',
  }
}
const referenceLabel = (r: Rules) => r.reference === 'both' ? '历史均价 + 采购价目表' : r.reference === 'history' ? '历史均价' : '采购价目表'
const table = (headers: string[], rows: (string | number)[][]) => `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n${rows.map(row => `| ${row.join(' | ')} |`).join('\n')}`
export function procurementReport(rules: Rules) {
  const rows = procurementService.test(rules)
  return `## 采购价格异常分析\n\n采购订单：\`PO202600128\` · ${purchaseOrder.organization} · ${purchaseOrder.supplierName}\n\n订单日期：${purchaseOrder.orderDate}；币种：人民币；价格口径：含税，税率 13%。\n\n参考依据：${referenceLabel(rules)}；历史范围：最近 ${rules.days} 天；${rules.average === 'simple' ? '简单平均' : '按采购数量加权平均'}；上涨阈值 ${rules.threshold}%；${rules.mode === 'any' ? '任一' : '全部'}选中参考价超过阈值触发。\n\n${table(['物料 / 规格', '当前价', '历史均价', '价目表价格', '历史价偏差', '基准价偏差', '预警结果'], rows.map(row => [`${row.material}（${row.specification}）`, row.current, row.history.toFixed(2), row.catalog, `${row.hd > 0 ? '+' : ''}${row.hd.toFixed(1)}%`, `${row.cd > 0 ? '+' : ''}${row.cd.toFixed(1)}%`, row.alert ? '价格异常' : '正常']))}\n\n识别出 **${rows.filter(row => row.alert).length} 项异常价格**。按相同采购组织、供应商、币种及各物料采购单位比较，仅选中的参考依据参与判断。\n\n${rows.some(row => row.alert) ? '建议采购负责人核实异常物料的议价记录、规格变更及临时采购原因，再确认当前订单价格。' : '所选参考口径下，各物料价格均未超过预警阈值。'}`
}
type Context = ReturnType<typeof procurementService.discover>
function entityResult(context: Context, names: string[]) {
  const entities = context.entities.filter(entity => names.includes(entity.name))
  const catalog = names.includes('采购价目表')
  return `## ${catalog ? '价格参考业务对象' : '采购业务对象'}\n\n查询范围：供应链业务域；采购组织：${purchaseOrder.organization}。\n\n${entities.map(entity => `### ${entity.name}\n\n${entity.description}\n\n业务域：${entity.domain}；实体标识：\`${entity.alias}\`。\n\n**关联关系**：${entity.relationship}\n\n**关键字段**\n${entity.fields.map(field => `- ${field}`).join('\n')}\n\n**数据范围**：${entity.filter}\n\n**可用数据**：${entity.volume}`).join('\n\n')}\n\n${catalog ? '价格匹配顺序：采购组织 → 供应商 → 物料 → 业务日期 → 数量阶梯。通过采购历史价格查询实体获取参考记录，避免将重复单据或不同计价口径直接混入均价。' : '价格分析关联路径：采购订单 → 物料明细；按物料编码与供应商匹配价格参考。保留组织、币种、计量单位和含税标识，用于后续筛选可比价格。'}`
}
function toolResult(context: Context, type: 'MCP' | 'OpenAPI') {
  return context.tools.filter(tool => tool.type === type).map(tool => {
    const preview = tool.entity === '采购订单'
      ? table(['物料编码', '名称 / 规格', '单位', '数量', '含税单价', '金额'], purchaseOrder.lines.map(line => [line.materialCode, `${line.materialName} / ${line.specification}`, line.unit, line.quantity, line.unitPrice, line.amount]))
      : tool.entity === '采购历史价格查询'
        ? table(['来源订单', '日期', '物料编码', '采购单价', '数量', '币种 / 口径'], ['2026-10-05', '2026-08-31', '2026-07-27'].map((date, i) => [['PO202600117', 'PO202600096', 'PO202600072'][i], date, 'MAT-6205', [98,100,102][i], [120,240,120][i], 'CNY / 含税']))
        : table(['价目表', '物料编码', '参考价', '有效期', '匹配规则'], [['PPL2026Q4-0186', 'MAT-6205', 105, '2026-10-01 至 2026-12-31', '组织 + 供应商 + 物料'], ['PPL2026Q4-0186', 'MAT-3048', 102, '2026-10-01 至 2026-12-31', '组织 + 供应商 + 物料']])
    return `## ${tool.name}\n\n类型：**${tool.type}**；关联实体：**${tool.entity}**。\n\n${tool.description}\n\n### 输入参数\n${tool.parameters.map(parameter => `- ${parameter}`).join('\n')}\n\n### 返回结构\n${tool.returns.map(field => `- ${field}`).join('\n')}\n\n### 调用约束\n${tool.availability}\n\n### 参数映射示例\n\`\`\`json\n${JSON.stringify(tool.sampleRequest, null, 2)}\n\`\`\`\n\n### 返回数据结构示例\n${preview}\n\n${tool.entity === '采购订单' ? `订单状态：${purchaseOrder.status}；供应商：${purchaseOrder.supplierName}；采购员：${purchaseOrder.buyer}；价税合计：¥${purchaseOrder.totalAmount.toLocaleString('zh-CN')}。` : tool.entity === '采购历史价格查询' ? '返回结构同时包含订单状态、供应商编码、计量单位与含税标识；支持分页取全所选日期范围的记录。' : '未匹配物料清单为空；多条生效价格按组织、供应商与数量阶梯的优先级选取，不使用失效价目表。'}\n\n### 需求匹配\n${tool.checks.map(check => `- ✓ ${check}`).join('\n')}`
  }).join('\n\n---\n\n')
}
const executionPlan = '# 技能执行方案\n\n采购订单号\n  ↓\n查询采购订单及物料明细\n  ↓\n获取价格参考依据\n  ├─ 查询历史采购价格（MCP）\n  └─ 查询采购价目表（OpenAPI）\n  ↓\n统一价格比较口径\n  ↓\n计算价格偏差\n  ↓\n判断是否异常\n  ↓\n生成价格异常预警报告\n\n' + flow.map(node => `## ${node.title}\n${node.detail}`).join('\n\n')
export const procurementCreateScenario = ({ projectId }: ScenarioContext): Scenario => {
  let rules = { ...defaultRules }
  const name = `procurement-price-alert-${uid('skill').slice(-6)}`
  const directory = `skills/${name}`
  const context = procurementService.discover()
  const generated = () => {
    const files = procurementService.generate(rules)
    return { ...files,
      'evals/basic.json': JSON.stringify({ skill: name, rules, cases: files['references/test-cases.md'].split('\n').filter(line => /^\d+\./.test(line)).map((line,index) => ({ id: `price-${index+1}`, description: line.replace(/^\d+\. /,''), input: { orderNo: 'PO202600128' }, rules })) }, null, 2),
      'manifest.yaml': `schema_version: 1\nname: ${name}\nversion: 1.0.0\nentities:\n${context.entityNames.map(entity => `  - ${entity}`).join('\n')}\ntools:\n  - query_purchase_order\n  - query_purchase_history_prices\n  - query_purchase_price_list\n`,
      'CHANGELOG.md': '# 更新记录\n\n## 1.0.0\n- 创建采购价格异常预警技能。\n- 写入已确认业务规则、企业上下文与只读工具依赖。\n- 添加 10 条评测用例。\n',
      'SKILL.md': files['SKILL.md'].replace('name: procurement-price-alert', `name: ${name}`) + '\n## 企业上下文\n' + context.relations.map(edge => `- ${edge.from} ${edge.relation} ${edge.to}`).join('\n') + '\n\n## 相关业务流程与规则\n' + context.rules.map(rule => `- ${rule.name}：${rule.rule}`).join('\n') }
  }
  return {
    todos: [],
    pacing: { textUnit: 'paragraph', textChunk: 1, textDelayMs: 650, textHoldMs: 1100, toolDelayMs: 850, stepPauseMs: 100 },
    steps: [
      { text: '我来加载技能创建（skill-builder）技能，按照规范流程为你创建这个采购价格异常预警技能。' },
      { tools: [{ tool: 'skill', title: 'kingdee-skill-creator', output: '已加载技能创建规范、工具发现与生成校验参考文件。' }] },
      { text: '技能加载完成。这是采购管理场景下的技能创建任务，需要查询订单、对比价格并生成异常预警。我先并行执行：扫描已有技能、加载工具检索能力、读取生成准备参考文件。' },
      { tools: [
        { tool: 'bash', title: '扫描 skills 目录检测撞技能', output: 'skills/delivery-notice-query/ — 发货通知单查询\nskills/inventory-query/ — 即时库存查询\n现有技能与采购价格异常判断不重叠。' },
        { tool: 'mcp', title: 'search_tools', detail: 'query_mcp_tools', output: 'query_mcp_tools 已就绪；可按业务对象和所需能力检索企业工具。' },
        { tool: 'mcp', title: 'search_tools', detail: 'list_skill_types', output: '技能类型清单已加载。当前场景：供应链 / 采购管理。' },
        ...['SKILL.md','references/creation-guide.md','references/tool-discovery.md','references/validation.md','references/evals.md'].map(file => ({ tool: 'read' as const, title: `skills/skill-builder/${file}`, output: '已读取技能创建参考：业务目标、工具发现、技能文件结构、评测用例及输出门检要求。' })),
      ] },
      { text: '参考文件已就绪。`skills/` 下现有发货通知单查询、即时库存查询等技能，与本次采购价格对比和异常预警不重叠，无撞技能。工具检索能力与技能类型清单已加载，接下来发现当前业务场景的企业上下文。' },
      { text: '技能创建目标已明确：以采购订单为入口，对物料采购单价做异常判断。我将把业务场景、目标和所需能力交给“企业业务上下文发现”，先确认实体与关系，再获取相关业务流程、规则和工具。' },
      { tools: [{ tool: 'skill', title: '企业业务上下文发现', detail: '接收业务场景、业务目标和所需能力', output: '输入场景：采购订单价格审核。\n输入目标：识别价格异常并提供预警与依据。\n所需能力：采购订单读取、采购历史价格查询、采购价目表匹配。\n阶段一：实体关键词提取、查询、消歧、覆盖检查与关系裁剪。\n阶段二：根据保留的实体与关系列表，查询转换规则简版、MCP 工具和 OpenAPI 工具。' }] },
      { text: '先以“采购订单”为关键词，一次查询相关实体和各自的关联信息。返回后结合价格对比、异常预警的业务目标，判断哪一个实体对应实际业务单据，再裁剪相关对象。' },
      { tools: [{ tool: 'mcp', title: 'searchEntities', stageGroup: true, detail: 'keyword="采购订单"', output: '## 实体关键词查询结果\n\n' + table(['候选实体','所属业务域 / 应用','主要关联'], context.queries[0].candidates.map(candidate => [candidate.name,candidate.domain,candidate.relations.join('、')])) + '\n\n## 供应链采购订单子图\n\n' + entityResult(context, context.entities.map(entity => entity.name)) }] },
      { reasoningUnit: 'sentence', reasoningDelayMs: 1400, reasoningDisplay: 'scroll', reasoning: '这次查询返回了 3 个与采购订单有关的候选实体及关联关系。“场景化采购订单”关联菜单、过滤条件和数据卡片，属于界面场景配置；“采购协同”应用下的采购订单主要关联协同业务操作。当前目标是读取订单物料单价、与历史价格及价目表对比，供应链采购管理下的采购订单同时具备物料明细、采购历史价格查询和采购价目表关联，和目标最匹配，因此可以自动确定。' },
      { text: '已匹配供应链采购管理下的“采购订单”。与价格分析直接相关的业务实体只有“采购订单 / 采购历史价格查询 / 采购价目表”；“物料明细”是采购订单包含的分录，随订单读取，不作为独立实体传给后续接口。\n\n本次返回已覆盖当前价格、历史价格和约定价格，无需再次查询关键词。下面使用裁剪后的三个实体获取相关流程规则、MCP 与 OpenAPI 工具。' },
      { tools: [{ tool: 'mcp', title: 'getEntityTransformRules', detail: 'entityNames=[采购订单, 采购历史价格查询, 采购价目表]', output: '请求实体：采购订单 / 采购历史价格查询 / 采购价目表。\n物料明细作为采购订单的分录随单据返回，不是接口的实体参数。\n\n## 场景实体与关系列表\n\n' + table(['起点', '关系', '终点'], context.relations.map(edge => [edge.from, edge.relation, edge.to])) + '\n\n## 相关业务流程与规则\n\n' + context.rules.map(rule => `### ${rule.name}\n业务流程：${rule.flow}\n\n规则：${rule.rule}`).join('\n\n') }] },
      { text: '转换规则简版已返回相关业务流程与取数规则。价格分析只读取已审核采购订单及有效物料明细；历史价格需要排除当前订单和无效记录，价目表按订单日期、物料与数量阶梯匹配。\n\n这些规则会作为技能的前置检查与异常处理依据，不触发单据转换。接下来使用相同实体列表获取 MCP 和 OpenAPI 工具，核对规则是否有对应能力支撑。' },
      { tools: [{ tool: 'mcp', title: 'getEntityMcpTools', detail: 'entityNames=[采购订单, 采购历史价格查询, 采购价目表]', output: toolResult(context, 'MCP') }] },
      { text: 'MCP 清单已返回 2 项能力：采购订单及明细查询、历史采购价格查询，分别对应“采购订单”和“采购历史价格查询”实体。订单号用于读取当前价格；组织、供应商、物料及日期范围用于获取历史记录，币种、单位和含税标识用于后续口径校验。历史结果按分页取全，再按规则筛选。' },
      { tools: [{ tool: 'mcp', title: 'getEntityOpenApis', detail: 'entityNames=[采购订单, 采购历史价格查询, 采购价目表]', output: toolResult(context, 'OpenAPI') }] },
      { text: 'OpenAPI 清单已返回采购价目表有效价格查询能力，能够按采购组织、供应商、物料、业务日期和采购数量定位价格行。返回的计价单位、币种和含税标识将与订单比较，未匹配时保留待核实。\n\n企业业务上下文发现完成：已交回裁剪后的实体关系、相关流程规则、2 项 MCP 和 1 项 OpenAPI 能力。现在返回 skill-builder，继续规划技能并确认业务口径。' },
      { tools: [{ tool: 'bash', title: '校验工具能力与调用条件', detail: '业务规则、参数映射与只读能力已衔接', output: context.tools.map(tool => `${tool.name} [${tool.type}]\n${tool.checks.map(check => `  ✓ ${check}`).join('\n')}`).join('\n\n') + '\n\n企业上下文已交回：实体关系列表、转换规则简版、MCP 工具与 OpenAPI 工具。\n业务访问限定当前采购组织，不申请写入能力。' }] },
      { text: '执行方案已就绪。', plan: [[flow[0]], [flow[1]], [flow[2], flow[3]], [flow[4]], [flow[5]], [flow[6]]] },
      { text: '下面确认价格参考依据、历史时间范围、上涨阈值、判断方式和均价算法。确认后按这份执行方案生成技能文件，并写入企业上下文中的规则与工具依赖。' },
      { question: [
        options([['历史均价 + 采购价目表', '同时对照历史成交水平与约定价格，提供两类价格偏差及依据。'], ['仅历史均价', '以可比采购记录的均价为依据，适合尚未维护采购价目表的物料。'], ['仅采购价目表', '以订单日期内生效的约定价为依据，适合按合同或协议价格采购。']], '价格参考依据'),
        options([['最近 90 天', '兼顾近期价格变化与样本数量；仅统计满足比较口径的已审核采购记录。'], ['最近 30 天', '更贴近近期行情，适合价格波动较快的物料，但可用样本可能较少。'], ['最近 180 天', '扩大历史样本，适合采购频率较低的物料，但对近期行情变化不够敏感。']], '历史价格范围'),
        options([['15%', '当前价相对参考价上涨超过 15% 时预警，便于较早发现异常涨价。'], ['20%', '上涨超过 20% 时预警，容忍常见价格波动，减少提示频率。'], ['30%', '仅对超过 30% 的明显上涨预警，适合价格波动较大的物料。']], '价格上涨预警阈值（%）', true),
        options([['任一参考价超过阈值', '只要相对任一选中参考价的上涨偏差超过阈值就预警，发现异常更及时。'], ['全部参考价超过阈值', '相对全部选中参考价的上涨偏差均超过阈值才预警，判断更审慎。']], '预警判断方式'),
        options([['简单平均', '每条可比采购记录权重相同，按单价求平均，口径直观、便于解释。'], ['按采购数量加权平均', '按采购数量分配权重，采购量大的记录影响更大，更接近实际采购成本。']], '历史均价计算方式'),
      ], onAnswer: answers => { rules = parseProcurementRules(answers) } },
      { resolve: () => ({ text: `已确认按「${referenceLabel(rules)}」继续：最近 ${rules.days} 天，${rules.average === 'simple' ? '简单平均' : '按采购数量加权平均'}，相对${rules.mode === 'any' ? '任一' : '全部'}参考价上涨超过 ${rules.threshold}% 时预警。现在进入生成阶段，一次性写入技能文件（SKILL.md、evals、manifest、CHANGELOG）：` }) },
      { resolve: () => ({ tools: [
        { tool: 'write', title: 'SKILL.md', detail: `/${directory}/`, output: generated()['SKILL.md'] },
        { tool: 'write', title: 'basic.json', detail: `/${directory}/evals/`, output: generated()['evals/basic.json'] },
        { tool: 'bash', title: '生成 manifest.yaml 与 CHANGELOG.md', output: `已生成 /${directory}/manifest.yaml\n已生成 /${directory}/CHANGELOG.md\n已生成 /${directory}/scripts/price_analyzer.py\n已保存已确认规则与工具依赖。` },
        { tool: 'bash', title: '校验技能并执行输出门检查', output: ['✓ SKILL.md 名称、描述和输入输出完整', '✓ evals/basic.json 包含 10 条评测用例', '✓ manifest.yaml 工具依赖与实体参数完整', '✓ CHANGELOG.md 版本记录完整', `✓ 规则：最近 ${rules.days} 天，上涨阈值 ${rules.threshold}%`, '✓ 异常分支：缺少参考价、零参考价、口径不一致均标记待核实', '✓ 门检查通过'].join('\n') },
      ] }) },
      { text: '校验通过。调用输出门检：' },
      { tools: [{ tool: 'mcp', title: 'output_check', output: 'PASS\n技能文件齐全；业务规则与用户确认一致；工具依赖与三个实体参数完整；未包含业务写入操作；产物入口可用。' }] },
      { text: '采购价格异常预警 已创建并通过校验，内置 10 条价格异常判断评测用例。\n\n技能将按已确认规则分析采购订单价格；缺少参考价格或币种、单位无法统一时，会标记为待核实。可通过「本地测试」输入采购订单号查看分析结果。',
        card: () => {
          procurementArtifacts.set(name, { projectId, rules: { ...rules }, files: { ...generated(), 'references/execution-plan.md': executionPlan }, report: procurementReport(rules) })
          devStore.skills = [{ id: `sk_${name}`, name, displayName: '采购价格异常预警', desc: '基于采购订单、历史采购价格与有效价目表，按已确认规则识别异常定价，并提供预警及分析依据。', category: '供应链', projectId, personalInstalled: false, enterpriseStatus: 'saved' }, ...devStore.skills]
          return { kind: 'kdskill', config: { id: name, title: '采购价格异常预警', directory } }
        },
      },
    ],
  }
}
export function procurementTestScenario(name: string): Scenario {
  const artifact = procurementArtifacts.get(name)!
  return { todos: [], steps: [
    { tools: [{ tool: 'skill', title: name, detail: '读取技能与已确认业务规则', output: artifact.files['SKILL.md'] }] },
    { tools: [{ tool: 'bash', title: '价格异常分析 · PO202600128', detail: '订单价格与参考依据分析完成', output: artifact.report }], text: artifact.report },
  ] }
}
