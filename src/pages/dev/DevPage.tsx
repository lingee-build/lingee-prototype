import { useParams } from "react-router"
import { Empty } from "@/ui"
import { useT } from "@/i18n"
import { PLUGIN_NAV, isArtifactMode } from "@/features/sidebar/nav-config"
import { ArtifactTabs, InArtifactTabsContext } from "@/features/dev-page/ArtifactTabs"
import { AgentDevPage } from "./agent/AgentDevPage"
import { McpAppDevPage } from "./mcp-app/McpAppDevPage"
import { SkillDevPage } from "./skill/SkillDevPage"
import { WorkflowDevPage } from "./workflow/WorkflowDevPage"
import { LegacyFrame } from "./legacy/LegacyFrame"

/** /dev/:mode 的分发页。技能 / 智能体 / 工作流 / 应用 / MCP 应用统一放在「产物」页签下 */
export function Component() {
  const t = useT()
  const { mode } = useParams()

  const content =
    mode === "skill" ? (
      <SkillDevPage />
    ) : mode === "agent" ? (
      <AgentDevPage />
    ) : mode === "workflow" ? (
      <WorkflowDevPage />
    ) : mode === "mcpapp" ? (
      <McpAppDevPage />
    ) : mode === "app" ? (
      // 应用开发：嵌入旧版原型的应用开发视图（应用卡片/新建应用/应用会话）
      <LegacyFrame view="apps" title={t("kcode.nav.appDev")} />
    ) : mode === "collab" ? (
      // 协作：嵌入旧版原型的协作开发视图（任务/工作台/评审/专家/团队/设置）
      <LegacyFrame view="collab" title={t("proto.nav.collab")} />
    ) : (
      <div className="size-full flex items-center justify-center">
        <Empty description={`${t(mode === PLUGIN_NAV.id ? PLUGIN_NAV.labelKey : "ui.empty.description")} · 原型待建`} />
      </div>
    )

  if (!isArtifactMode(mode)) return <div className="flex-1 min-h-0 w-full bg-background-page">{content}</div>

  return (
    <div className="flex-1 min-h-0 w-full bg-background-page flex flex-col">
      <ArtifactTabs active={mode} />
      <InArtifactTabsContext.Provider value>
        <div className="flex-1 min-h-0">{content}</div>
      </InArtifactTabsContext.Provider>
    </div>
  )
}
