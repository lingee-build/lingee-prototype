/** Presentation-only service backed by local fixtures; no live ERP/DC requests. */
import { businessEntities as entities, discoveredTools as tools, historyRecords, priceCatalogEntity, procurementGraphRelations, procurementContextRules, purchaseOrder } from '@/mock/fixtures/procurement-context'
export { purchaseOrder } from '@/mock/fixtures/procurement-context'

export const procurementPrompt = '帮我创建一个采购价格异常预警技能，能够自动分析采购订单价格是否合理，识别异常定价，并提供预警及分析依据。'
export type Rules = { reference: 'both' | 'history' | 'catalog'; days: number; threshold: number; mode: 'any' | 'all'; average: 'simple' | 'weighted' }
export const defaultRules: Rules = { reference: 'both', days: 90, threshold: 15, mode: 'any', average: 'simple' }
export const flow = [
  { title: '输入采购订单号', detail: '技能输入：采购订单号，例如 PO202600128。' },
  { title: '查询采购订单及物料明细', detail: `${tools[0].name} · 输入：${tools[0].input}；输出：${tools[0].output}。` },
  { title: '查询历史采购价格', detail: `${tools[1].name} · 输入：${tools[1].input}；输出：${tools[1].output}。通过图谱实体“采购历史价格查询”获取历史记录。` },
  { title: '查询采购价目表', detail: `${tools[2].name} · 输入：${tools[2].input}；输出：${tools[2].output}。与历史价格查询并行。` },
  { title: '统一价格比较口径', detail: 'Skill 内部逻辑：按同物料、供应商、币种、计量单位与含税口径比较；不一致时不强行计算，输出待核实。' },
  { title: '计算价格偏差', detail: 'Skill 内部计算，无需 ERP 工具。偏差 =（当前价 / 参考价 − 1）× 100%；数量加权均价 = Σ(单价×数量)/Σ数量。' },
  { title: '判断异常并生成报告', detail: '按用户确认的参考依据、阈值及任一/全部判断方式输出预警、偏差和依据。' },
]
/** Exact scene object wins; otherwise a sole candidate is safe, multiple candidates require clarification. */
export function resolveEntityCandidates(candidates: string[], expected: string) {
  const names = [...new Set(candidates)]
  const selected = names.includes(expected) ? expected : names.length === 1 ? names[0] : undefined
  return { selected, candidates: names, needsClarification: names.length > 1 && !selected }
}
// Replaceable DC adapter; each endpoint returns a scene-specific graph projection.
export const procurementService = {
  searchEntities(keyword: string) {
    return { request: { keyword }, candidates: [
      { name: '场景化采购订单', domain: '国际贸易管理', purpose: '场景菜单、过滤条件与数据卡片配置', relations: ['工具栏按钮配置', '过滤条件配置', '数据卡片栏'] },
      { name: '采购订单', domain: '采购协同', purpose: '采购协同业务操作与业务规则', relations: ['采购协同应用', '业务操作', '业务规则'] },
      { name: '采购订单', domain: '供应链 / 采购管理', purpose: '采购单据、物料明细及价格参考', relations: ['物料明细', '采购历史价格查询', '采购价目表'] },
    ], response: [...entities, priceCatalogEntity], relations: procurementGraphRelations }
  },
  getEntityMcpTools(entityNames: string | string[]) { const names = [entityNames].flat(); return { request: { entityNames: names }, response: tools.filter(t => names.includes(t.entity) && t.type === 'MCP') } },
  getEntityOpenApis(entityNames: string | string[]) { const names = [entityNames].flat(); return { request: { entityNames: names }, response: tools.filter(t => names.includes(t.entity) && t.type === 'OpenAPI') } },
  getEntityTransformRules(entityNames: string | string[]) { const names = [entityNames].flat(); return { request: { entityNames: names, detail: '简版' }, response: procurementContextRules.filter(rule => rule.entities.some(name => names.includes(name))) } },
  discover() {
    // One keyword request returns three candidate subgraphs, including related price entities.
    const queries = [this.searchEntities('采购订单')]
    const retained = queries[0].response
    const entityNames = ['采购订单', '采购历史价格查询', '采购价目表']
    const resolution = { selected: '采购订单', candidates: queries[0].candidates.map(candidate => `${candidate.name}（${candidate.domain}）`), needsClarification: false }
    const relations = procurementGraphRelations
    return { objective: '采购订单价格异常分析', coreEntity: resolution.selected ?? '', resolution, queries, entities: retained, entityNames, relations,
      rules: this.getEntityTransformRules(entityNames).response,
      tools: [...this.getEntityMcpTools(entityNames).response, ...this.getEntityOpenApis(entityNames).response],
      coverage: '采购订单、采购历史价格查询及采购价目表能力已覆盖', missing: [], questions: ['参考依据', '历史范围', '预警阈值', '判断方式', '均价算法'] }
  },
  test(rules: Rules) {
    // Timestamp-relative fixtures make the selected history window affect the actual sample set.
    const records = historyRecords.filter(x => x.age <= rules.days)
    const history = records.reduce((sum, x) => sum + x.price * (rules.average === 'weighted' ? x.qty : 1), 0) / records.reduce((sum, x) => sum + (rules.average === 'weighted' ? x.qty : 1), 0)
    return purchaseOrder.lines.map((line, index) => ({ material: line.materialName, materialCode: line.materialCode, specification: line.specification, unit: line.unit, quantity: line.quantity, current: line.unitPrice, catalog: index === 0 ? 105 : 102 })).map(row => {
      const hd = Number(((row.current / history - 1) * 100).toFixed(10)), cd = Number(((row.current / row.catalog - 1) * 100).toFixed(10))
      const selected = rules.reference === 'both' ? [hd, cd] : rules.reference === 'history' ? [hd] : [cd]
      return { ...row, history, hd, cd, samples: records.length, alert: rules.mode === 'any' ? selected.some(x => x > rules.threshold) : selected.every(x => x > rules.threshold) }
    })
  },
  generate(r: Rules) {
    const reference = r.reference === 'both' ? '历史均价 + 采购价目表' : r.reference === 'history' ? '历史均价' : '采购价目表'
    return {
      'SKILL.md': `---\nname: procurement-price-alert\ndescription: 采购价格异常预警\n---\n\n# 采购价格异常预警\n\n## 技能描述与适用场景\n识别采购订单中异常定价，提供参考依据，供采购审核使用。基于采购组织、供应商及物料维度获取可比较的价格参考。\n\n## 输入与输出\n输入：采购订单号。输出：物料、当前价、参考价、偏差、预警及分析依据。\n\n## 依赖工具\n${tools.map(t => `- ${t.name}（${t.type}）：${t.description}；输入 ${t.input}；输出 ${t.output}`).join('\n')}\n\n## 执行流程\n${flow.filter((_, i) => !(i === 2 && r.reference === 'catalog') && !(i === 3 && r.reference === 'history')).map((x, i) => `${i + 1}. ${x.title}`).join('\n')}\n\n## 价格异常判断规则\n参考依据：${reference}。历史范围：最近 ${r.days} 天。均价：${r.average === 'simple' ? '简单平均' : '按采购数量加权平均'}。\n偏差 = (当前价 / 参考价 - 1) × 100%。${r.mode === 'any' ? '任一' : '全部'}选中参考价上涨偏差严格高于 ${r.threshold}% 时预警。\n先统一币种、计量单位与含税口径。仅选中的参考依据参与判断。\n\n## 异常处理\n订单不存在、工具不可用时终止并说明原因；缺少选中参考价格、参考价为零、口径无法统一时标记待核实，不输出正常结论。\n\n## 使用示例\n输入 PO202600128，查看价格分析结果。规则 ${JSON.stringify(r)}。\n`,
      'references/test-cases.md': `# 价格异常判断评测用例\n\n${['正常价格不触发预警', '高于历史参考价触发判断', '高于价目表参考价触发判断', '等于阈值不触发预警', '任一参考价判断', '全部参考价判断', '历史价格日期范围过滤', '采购数量加权均价', '缺少参考价标记待核实', '币种或单位不一致标记待核实'].map((title, index) => `${index + 1}. ${title}`).join('\n')}\n\n使用已确认规则：${JSON.stringify(r)}。`,
      'scripts/price_analyzer.py': `# Procurement price deviation analyzer\nRULES = ${JSON.stringify(r)}\n\ndef analyze(current, history, catalog):\n    refs = {'history': [history], 'catalog': [catalog], 'both': [history, catalog]}[RULES['reference']]\n    if any(value is None or value <= 0 for value in refs):\n        return {'status': 'needs_review'}\n    deviations = [round((current / value - 1) * 100, 10) for value in refs]\n    flagged = [value > RULES['threshold'] for value in deviations]\n    alert = any(flagged) if RULES['mode'] == 'any' else all(flagged)\n    return {'alert': alert, 'deviations': deviations}\n`,
    }
  },
}
