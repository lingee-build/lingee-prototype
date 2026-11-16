// 智能体所属领域的存储值 → 展示名词条映射。
// 独立成模块供 agent-config-components（下拉选择）与 agent-changelog（变更文案渲染）
// 共享同一份数据，避免双源漂移；key 为 assistant.json 中 domain 字段的存储值。

export const domainI18nKeys: Record<string, string> = {
  "finance": "kcode.agentConfig.basic.domain.finance",
  "hr": "kcode.agentConfig.basic.domain.hr",
  "sales": "kcode.agentConfig.basic.domain.sales",
  "supply-chain": "kcode.agentConfig.basic.domain.supplyChain",
  "admin": "kcode.agentConfig.basic.domain.admin",
  "legal": "kcode.agentConfig.basic.domain.legal",
  "it": "kcode.agentConfig.basic.domain.it",
  "general": "kcode.agentConfig.basic.domain.general",
}

/** 领域存储值的展示名：无映射时原样返回（兼容历史数据中的旧编码） */
export function domainLabel(value: string, t: (key: string) => string): string {
  const key = domainI18nKeys[value]
  return key ? t(key) : value
}
