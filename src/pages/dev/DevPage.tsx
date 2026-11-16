import { useParams } from "react-router"
import { Empty } from "@/ui"
import { useT } from "@/i18n"
import { NAV_ITEMS } from "@/features/sidebar/nav-config"
import { AgentDevPage } from "./agent/AgentDevPage"
import { McpAppDevPage } from "./mcp-app/McpAppDevPage"
import { SkillDevPage } from "./skill/SkillDevPage"
import { WorkflowDevPage } from "./workflow/WorkflowDevPage"

/** /dev/:mode 的分发页。已实现的开发页直接渲染，其余入口先放占位 */
export function Component() {
  const t = useT()
  const { mode } = useParams()
  return (
    <div className="flex-1 min-h-0 w-full bg-background-page">
      {mode === "skill" ? (
        <SkillDevPage />
      ) : mode === "agent" ? (
        <AgentDevPage />
      ) : mode === "workflow" ? (
        <WorkflowDevPage />
      ) : mode === "mcpapp" ? (
        <McpAppDevPage />
      ) : (
        <div className="size-full flex items-center justify-center">
          <Empty description={`${t(NAV_ITEMS.find((x) => x.id === mode)?.labelKey ?? "ui.empty.description")} · 原型待建`} />
        </div>
      )}
    </div>
  )
}
