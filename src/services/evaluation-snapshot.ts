import { devStore } from "@/mock/dev-store"
import { skillDetailOf } from "@/mock/fixtures/skill-detail"

/** 评测运行时冻结的被测对象配置；仅记录可核对的字段，缺失时不虚构。 */
export interface ObjectSnapshot {
  version?: string
  prompt?: string
  knowledge?: string[]
  skills?: string[]
  tools?: string[]
  modelLevel?: string
}

const clip = (text: string, limit = 1200) => text.length > limit ? `${text.slice(0, limit)}…（完整内容见对象详情）` : text

export function objectSnapshotOf(key: string): ObjectSnapshot | undefined {
  if (key.startsWith("skill:")) {
    const id = key.slice("skill:".length)
    const skill = devStore.skills.find(item => item.id === id)
    if (!skill) return undefined
    const detail = skillDetailOf(skill)
    return { version: detail.version, prompt: clip(detail.content), tools: detail.tools.map(tool => tool.name) }
  }
  if (key.startsWith("agent:")) {
    const id = key.slice("agent:".length)
    const agent = devStore.agents.find(item => item.id === id)
    if (!agent) return undefined
    return {
      prompt: clip(agent.role || ""),
      knowledge: (agent.knowledge || []).map(item => `${item.name}${item.kind === "catalog" ? "（目录）" : "（文档）"}`),
      skills: (agent.skills || []).map(item => item.name),
      modelLevel: agent.defaultModelLevel,
    }
  }
  return undefined
}
