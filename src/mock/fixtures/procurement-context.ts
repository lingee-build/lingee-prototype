/** Presentation fixtures only. IDs are local aliases, not verified ERP/DC identifiers. */
export const purchaseOrder = {
  billNo: 'PO202600128', status: '已审核', orderDate: '2026-10-15',
  organization: '华东制造事业部', purchasingDepartment: '供应链采购部', buyer: '李晨',
  supplierCode: 'SUP-0186', supplierName: '华东精工供应有限公司', currency: 'CNY',
  priceTaxIncluded: true, taxRate: 13, paymentTerms: '验收后 60 天付款',
  lines: [
    { lineNo: 1, materialCode: 'MAT-6205', materialName: '精密深沟球轴承', specification: '6205-2RS / P6', unit: '件', quantity: 120, unitPrice: 128, amount: 15360, requiredDate: '2026-10-25', warehouse: '华东制造原材料仓' },
    { lineNo: 2, materialCode: 'MAT-3048', materialName: '不锈钢紧固件套装', specification: 'M8×30 / 304', unit: '套', quantity: 80, unitPrice: 98, amount: 7840, requiredDate: '2026-10-25', warehouse: '华东制造原材料仓' },
  ],
  totalAmount: 23200,
}
export const historyRecords = [
  { billNo: 'PO202600117', age: 10, date: '2026-10-05', price: 98, qty: 120 },
  { billNo: 'PO202600096', age: 45, date: '2026-08-31', price: 100, qty: 240 },
  { billNo: 'PO202600072', age: 80, date: '2026-07-27', price: 102, qty: 120 },
  { billNo: 'PO202600031', age: 150, date: '2026-05-18', price: 110, qty: 720 },
]
export const catalogRows = purchaseOrder.lines.map((line, index) => ({
  materialCode: line.materialCode, materialName: line.materialName, specification: line.specification,
  supplierCode: purchaseOrder.supplierCode, unit: line.unit, currency: 'CNY', taxIncluded: true,
  referencePrice: index === 0 ? 105 : 102, effectiveFrom: '2026-10-01', effectiveTo: '2026-12-31',
  organization: purchaseOrder.organization, priority: '组织 + 供应商 + 物料', status: '生效',
}))
export const businessEntities = [
  { name: '采购订单', alias: 'purchase_order', domain: '供应链 / 采购管理', description: '采购价格分析的入口，提供采购组织、供应商、交易币种、订单状态及物料明细。', relationship: '包含 → 物料明细（分录实体）；关联 → 采购历史价格查询；关联 → 采购价目表', fields: ['订单编号 billNo:string（唯一）', '订单日期 orderDate:date', '采购组织 organization:string', '供应商 supplierCode:string', '交易币种 currency:string', '含税标识 priceTaxIncluded:boolean', '单据状态 status:enum'], filter: '已审核；当前用户有权采购组织', volume: '近 90 天 286 张已审核采购订单' },
  { name: '物料明细', alias: 'purchase_order_material_line', domain: '供应链 / 采购订单分录', description: '采购订单包含的物料分录，提供当前采购数量、单价与规格；不作为独立业务单据。', relationship: '从属于 → 采购订单；物料编码、供应商及价格口径用于匹配两类价格参考', fields: ['物料编码 materialCode:string', '规格型号 specification:string', '采购单位 unit:string', '采购数量 quantity:decimal', '含税单价 unitPrice:decimal(18,6)', '税率 taxRate:decimal', '价税合计 amount:decimal'], filter: '随采购订单读取；仅保留有效物料行', volume: '近 90 天 1,042 条有效采购分录' },
  { name: '采购历史价格查询', alias: 'purchase_history_price_query', domain: '供应链 / 采购价格分析', description: '图谱中的历史价格查询实体，按物料、供应商、采购组织与日期范围提供历史采购价格记录。', relationship: '关联 → 采购订单；按物料明细的物料、供应商及比较口径匹配历史记录', fields: ['来源订单 billNo:string', '订单日期 orderDate:date', '物料编码 materialCode:string', '供应商编码 supplierCode:string', '采购数量 quantity:decimal', '历史单价 unitPrice:decimal', '币种 currency:string', '采购单位 unit:string', '含税标识 taxIncluded:boolean'], filter: '同物料、采购组织与供应商；排除未审核、作废及不可比记录', volume: '近 90 天 1,042 条可筛选历史采购记录' },
]
export const priceCatalogEntity = {
  name: '采购价目表', alias: 'purchase_price_list', domain: '供应链 / 采购价格管理',
  description: '维护供应商、物料及采购组织的约定价格，按生效日期和数量阶梯匹配有效基准。',
  relationship: '按组织 + 供应商 + 物料 → 匹配有效价格；包含 → 采购价目表价格行',
  fields: ['价目表编号 priceListNo:string', '物料编码 materialCode:string', '供应商编码 supplierCode:string', '采购组织 organization:string', '参考价格 referencePrice:decimal(18,6)', '生效日期 effectiveFrom:date', '失效日期 effectiveTo:date', '计价单位 unit:string', '含税标识 taxIncluded:boolean'],
  filter: '已审核并生效；组织、供应商、币种、单位及价格有效期匹配', volume: '有效价目表 24 张，覆盖 1,680 条物料价格',
}
export const discoveredTools = [
  { name: 'query_purchase_order', displayName: '采购订单及明细查询', type: 'MCP', entity: '采购订单', description: '按订单号读取订单主信息和物料明细；返回含税单价、数量、币种与单位。', input: '订单号、采购组织、是否包含明细', output: '订单状态、供应商、币种、税率、物料编码、规格、数量、单价、金额', parameters: ['billNo:string（必填，精确匹配）', 'organization:string（取当前采购组织）', 'includeLines:boolean（默认 true）'], returns: ['order:object（主信息）', 'lines:array（物料明细）', 'totalAmount:decimal（价税合计）'], checks: ['覆盖订单明细单价、数量、币种和税率字段', '当前组织的采购订单只读权限已配置', '订单号及组织参数可由技能输入与会话上下文提供'], availability: '只读查询；查询超时 15 秒；单次最多返回 200 条明细', sampleRequest: { billNo: purchaseOrder.billNo, organization: purchaseOrder.organization, includeLines: true }, sampleResponse: purchaseOrder },
  { name: 'query_purchase_history_prices', displayName: '历史采购价格查询', type: 'MCP', entity: '采购历史价格查询', description: '按物料、供应商和日期范围筛选有效历史采购明细，用于简单平均或按数量加权平均。', input: '物料编码、供应商、采购组织、起止日期、页码', output: '历史单价、数量、订单日期、来源订单号、币种、单位及含税口径', parameters: ['materialCodes:string[]（必填）', 'supplierCode:string（必填）', 'dateFrom/dateTo:date（必填）', 'organization:string', 'page/pageSize:integer（默认 1/100）'], returns: ['records:array（历史明细）', 'total:integer（匹配记录数）', 'hasMore:boolean（分页标记）'], checks: ['支持按物料、供应商及起止日期筛选', '返回采购数量，可支持数量加权均价', '已审核、非作废历史记录可用，分页条件完整'], availability: '只读查询；每页最多 100 条；支持自动分页与空记录返回', sampleRequest: { materialCodes: purchaseOrder.lines.map(l => l.materialCode), supplierCode: purchaseOrder.supplierCode, organization: purchaseOrder.organization, dateFrom: '2026-07-17', dateTo: '2026-10-15', page: 1, pageSize: 100 }, sampleResponse: { total: 6, hasMore: false, records: purchaseOrder.lines.flatMap(line => historyRecords.filter(r => r.age <= 90).map(r => ({ billNo: r.billNo, orderDate: r.date, materialCode: line.materialCode, materialName: line.materialName, supplierCode: purchaseOrder.supplierCode, unit: line.unit, quantity: r.qty, unitPrice: r.price, currency: 'CNY', taxIncluded: true, status: '已审核' }))) } },
  { name: 'query_purchase_price_list', displayName: '采购价目表有效价格查询', type: 'OpenAPI', entity: '采购价目表', description: '按采购组织、供应商、物料和业务日期定位生效的价格行；多条价格时优先匹配更具体的组织与数量阶梯。', input: '物料编码、供应商、采购组织、业务日期、采购数量', output: '生效基准价、有效期、匹配优先级、币种、计价单位及含税口径', parameters: ['materialCodes:string[]（必填）', 'supplierCode:string（必填）', 'organization:string（必填）', 'businessDate:date（必填）', 'quantities:object（数量阶梯匹配）'], returns: ['priceListNo:string', 'prices:array（有效价格行）', 'unmatchedMaterials:string[]（未匹配物料）'], checks: ['已检查接口执行适配、鉴权配置和必填参数映射', '可按业务日期过滤有效价目表', '参考价及币种、计价单位、含税标识返回完整'], availability: '只读接口；组织范围鉴权；最多查询 100 个物料；无匹配返回未覆盖清单', sampleRequest: { materialCodes: purchaseOrder.lines.map(l => l.materialCode), supplierCode: purchaseOrder.supplierCode, organization: purchaseOrder.organization, businessDate: purchaseOrder.orderDate, quantities: { 'MAT-6205': 120, 'MAT-3048': 80 } }, sampleResponse: { priceListNo: 'PPL2026Q4-0186', prices: catalogRows, unmatchedMaterials: [] } },
]

/** Compact, scene-specific DC graph projection. Unrelated graph branches are not expanded in the conversation. */
export const procurementGraphRelations = [
  { from: '采购订单', relation: '包含', to: '物料明细', kind: '分录实体' },
  { from: '采购订单', relation: '关联', to: '采购历史价格查询', kind: '实体' },
  { from: '采购订单', relation: '关联', to: '采购价目表', kind: '实体' },
]
export const procurementContextRules = [
  { name: '采购订单业务流程', entities: ['采购订单'], flow: '采购订单保存 → 审核 → 后续业务处理', rule: '本技能只读取已审核采购订单及有效物料明细，不触发下推、变更或反审核。' },
  { name: '历史价格取数规则', entities: ['采购订单', '采购历史价格查询'], flow: '订单物料明细 → 匹配历史采购记录 → 按日期范围取全分页', rule: '按组织、供应商、物料匹配，排除当前订单、未审核及作废记录；保留币种、单位、含税标识进行可比性校验。' },
  { name: '有效价目表匹配规则', entities: ['采购订单', '采购价目表'], flow: '订单日期与采购数量 → 有效价目表 → 匹配价格行', rule: '匹配组织、供应商、物料、有效期与数量阶梯；无匹配返回待核实，不以零价代替参考价。' },
]
