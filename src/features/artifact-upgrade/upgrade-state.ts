import { create } from "zustand"
import { devStore } from "@/mock/dev-store"

// 统一升级提示暂时隐藏；需要恢复时改为 true。单个产物升级不受此开关影响。
export const SHOW_TENANT_UPGRADE_PROMPT = false
// 卡片升级入口和历史会话升级拦截暂时关闭，保留实现供后续恢复。
export const ENABLE_ARTIFACT_UPGRADE = false

// 原型演示数据：显式关联开发会话，普通问答会话不受影响。
export const legacySessions: Record<string, string[]> = {
  ses_stock: ["realtime-stock-query"],
  ses_supplier: ["supplier-access-review"],
  ses_onboard: ["onboarding-guide"],
  ses_card: ["kdcloud_fin_expense_claim_card"],
}
type UpgradeRequest = { ids: string[]; resume: () => void; mode?: "tenant"; addedProject?: boolean }
type TenantRecord = { upgraded: string[]; seenProjects: string[] }
export const useUpgradeStore = create<{
  upgraded: string[]
  tenant: string
  records: Record<string, TenantRecord>
  pending?: UpgradeRequest
  addedLegacy: string[]
}>(() => ({ upgraded: [], tenant: "", records: {}, addedLegacy: [] }))
const legacyIds = new Set(Object.values(legacySessions).flat())
export function needsUpgrade(ids: string[]) {
  const state = useUpgradeStore.getState()
  const canonical = ids.map((id) => devStore.skills.find((skill) => skill.id === id)?.name ?? id)
  return [...new Set(canonical)].filter((id) => (legacyIds.has(id) || state.addedLegacy.includes(id)) && !state.upgraded.includes(id))
}
export function guardUpgrade(ids: string[], resume: () => void): boolean {
  if (!ENABLE_ARTIFACT_UPGRADE) return false
  const state = useUpgradeStore.getState()
  // 初始化的租户级提示优先，避免历史会话先弹出单个升级提示。
  if (!state.tenant || state.pending?.mode === "tenant") return false
  const pending = needsUpgrade(ids)
  if (!pending.length) return false
  useUpgradeStore.setState({ pending: { ids: pending, resume } })
  return true
}
function tenantArtifacts(projectIds: string[]) {
  return [
    ...devStore.agents.filter((x) => projectIds.includes(x.projectId)).map((x) => x.id),
    ...devStore.skills.filter((x) => projectIds.includes(x.projectId)).map((x) => x.id),
    ...devStore.mcpApps.filter((x) => projectIds.includes(x.projectId)).map((x) => x.appCode),
  ]
}
export function initializeTenant(tenant: string, projectIds: string[]) {
  const state = useUpgradeStore.getState()
  const previous = state.records[tenant]
  const added = previous ? projectIds.filter((id) => !previous.seenProjects.includes(id)) : []
  const upgraded = previous?.upgraded ?? []
  const record = { upgraded, seenProjects: projectIds }
  useUpgradeStore.setState({ tenant, upgraded, records: { ...state.records, [tenant]: record } })
  const ids = needsUpgrade(tenantArtifacts(projectIds))
  const newlyAddedIds = needsUpgrade(tenantArtifacts(added))
  if (SHOW_TENANT_UPGRADE_PROMPT && ids.length && (!previous || newlyAddedIds.length)) {
    useUpgradeStore.setState({ pending: { mode: "tenant", ids, addedProject: added.length > 0, resume: () => {} } })
  } else if (state.tenant !== tenant || (!SHOW_TENANT_UPGRADE_PROMPT && state.pending?.mode === "tenant")) {
    useUpgradeStore.setState({ pending: undefined })
  }
}

export function completeUpgrade(ids: string[]) {
  const state = useUpgradeStore.getState()
  const upgraded = [...new Set([...state.upgraded, ...ids])]
  useUpgradeStore.setState({ upgraded, pending: undefined, records: {
    ...state.records, [state.tenant]: {
      upgraded, seenProjects: state.records[state.tenant]?.seenProjects ?? [],
    },
  } })
}
