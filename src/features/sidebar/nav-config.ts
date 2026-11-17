import type { IconName } from "@/ui"

export type DevMode = "skill" | "agent" | "workflow" | "app" | "collab" | "mcpapp" | "expert" | "plugins"

/** 「产物」下的类型页签（默认顺序）。原来各自独立的开发菜单，菜单整合后统一收进「产物」 */
export type ArtifactMode = "skill" | "agent" | "workflow" | "app" | "mcpapp"
export const ARTIFACT_TABS: Array<{ id: ArtifactMode; labelKey: string }> = [
  { id: "skill", labelKey: "proto.artifact.skill" },
  { id: "agent", labelKey: "proto.artifact.agent" },
  { id: "workflow", labelKey: "proto.artifact.workflow" },
  { id: "app", labelKey: "proto.artifact.app" },
  { id: "mcpapp", labelKey: "proto.artifact.mcpapp" },
]
export const isArtifactMode = (mode?: string): mode is ArtifactMode => ARTIFACT_TABS.some((x) => x.id === mode)

/** 产物页签顺序：用户拖动后按人保存在 localStorage，打开「产物」默认进第一个 */
const ORDER_KEY = "lingee.build.art-order"
export function loadArtifactOrder(): ArtifactMode[] {
  const all = ARTIFACT_TABS.map((x) => x.id)
  try {
    const saved = JSON.parse(localStorage.getItem(ORDER_KEY) ?? "null")
    if (Array.isArray(saved) && saved.length === all.length && all.every((k) => saved.includes(k))) return saved
  } catch {
    /* 读不到就用默认顺序 */
  }
  return all
}
export function saveArtifactOrder(order: ArtifactMode[]) {
  try {
    localStorage.setItem(ORDER_KEY, JSON.stringify(order))
  } catch {
    /* ignore */
  }
}

/** 左侧开发菜单（菜单方案二）：新任务 · 协作 · 产物，分隔线下是插件中心 */
export const NAV_ITEMS: Array<{ id: "collab" | "artifacts"; icon: IconName; labelKey: string }> = [
  { id: "collab", icon: "git-pr", labelKey: "proto.nav.collab" },
  { id: "artifacts", icon: "artifact-stack", labelKey: "proto.nav.artifacts" },
]
export const PLUGIN_NAV = { id: "plugins" as const, icon: "cube" as IconName, labelKey: "proto.nav.plugins" }

export type TopTab = "chat" | "work" | "dev"
export const TOP_TABS: Array<{ id: TopTab; icon: IconName; labelKey: string }> = [
  { id: "chat", icon: "chat", labelKey: "kcode.tab.chat" },
  { id: "work", icon: "work", labelKey: "kcode.tab.work" },
  { id: "dev", icon: "dev", labelKey: "kcode.tab.dev" },
]
