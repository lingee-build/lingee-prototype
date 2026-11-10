import { create } from "zustand"
import { devStore } from "@/mock/dev-store"

export type ArtifactKind = "agent" | "skill" | "mcpapp"
export type ConfigTarget = { kind: ArtifactKind; id: string; name: string; projectId: string }
export const useArtifactConfig = create<{
  completed: string[]
  pending?: ConfigTarget
  sessions: Record<string, ConfigTarget>
}>(() => ({ completed: [], sessions: {} }))
const demoMissing: Record<ArtifactKind, string[]> = {
  skill: ["sk_stock"], agent: ["supplier-access-review"], mcpapp: ["kdcloud_fin_expense_claim_card"],
}
export function configTarget(kind: ArtifactKind, id: string): ConfigTarget | undefined {
  if (kind === "skill") {
    const item = devStore.skills.find(x => x.id === id || x.name === id)
    return item && { kind, id: item.id, name: item.displayName, projectId: item.projectId }
  }
  if (kind === "agent") {
    const item = devStore.agents.find(x => x.id === id)
    return item && { kind, id: item.id, name: item.name, projectId: item.projectId }
  }
  const item = devStore.mcpApps.find(x => x.appCode === id)
  return item && { kind, id: item.appCode, name: item.appName, projectId: item.projectId }
}
export function configMissing(target: ConfigTarget) {
  return demoMissing[target.kind].includes(target.id) && !useArtifactConfig.getState().completed.includes(`${target.kind}:${target.id}`)
}
/** 仅在测试/提交/导出操作前检查。浏览、编辑、删除和历史对话不受限制。 */
export function guardArtifactConfig(kind: ArtifactKind, id: string): boolean {
  const target = configTarget(kind, id)
  if (!target || !configMissing(target)) return false
  useArtifactConfig.setState({ pending: target })
  return true
}
export function completeArtifactConfig(target: ConfigTarget) {
  const current = configTarget(target.kind, target.id)
  if (!current || current.projectId !== target.projectId) return false
  useArtifactConfig.setState(s => ({ completed: [...new Set([...s.completed, `${target.kind}:${target.id}`])] }))
  return true
}
export function completeFromCard(kind: string, config: Record<string, string>) {
  const type = kind === "kdskill" ? "skill" : kind === "ai-partner" ? "agent" : kind === "kdapp-artifact" ? "mcpapp" : undefined
  if (!type) return
  const target = configTarget(type, config.id || config.appCode || "")
  if (target) completeArtifactConfig(target)
}
