import type { IconName } from "@/ui"

export type DevMode = "skill" | "agent" | "workflow" | "app" | "mcpapp" | "expert"

/** 左侧开发导航：顺序、图标、文案 key 与线上一致；「工作流开发」为原型新增入口（proto.* 文案） */
export const NAV_ITEMS: Array<{ id: DevMode; icon: IconName; labelKey: string }> = [
  { id: "skill", icon: "skill-bolt", labelKey: "kcode.nav.skillDev" },
  { id: "agent", icon: "ai-partner", labelKey: "kcode.nav.agentDev" },
  { id: "workflow", icon: "git-branch-network", labelKey: "proto.nav.workflowDev" },
  { id: "app", icon: "app-grid", labelKey: "kcode.nav.appDev" },
  { id: "mcpapp", icon: "cube", labelKey: "kcode.nav.mcpDev" },
  { id: "expert", icon: "collab", labelKey: "kcode.nav.expertDev" },
]

export type TopTab = "chat" | "work" | "dev"

export const TOP_TABS: Array<{ id: TopTab; icon: IconName; labelKey: string }> = [
  { id: "chat", icon: "chat", labelKey: "kcode.tab.chat" },
  { id: "work", icon: "work", labelKey: "kcode.tab.work" },
  { id: "dev", icon: "dev", labelKey: "kcode.tab.dev" },
]
