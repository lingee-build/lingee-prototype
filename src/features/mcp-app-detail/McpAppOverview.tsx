import { showToast, Tooltip } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { McpApp } from "@/mock/fixtures/dev"
import { useSync } from "@/stores/sync"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { getField } from "@/vendor/kcode-web/src/utils/mcp-app-check"
import { statusKey } from "./status"

function ApplicationIcon(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 20 20" fill="none">
      <rect x="2.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="2.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="11.5" y="11.5" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

/** info.json 里的 MCP 连接器列表 */
const connectorsOf = (app: McpApp) => {
  const value = app.info ? getField(app.info, "mcpConnector") : undefined
  return Array.isArray(value) ? value.filter((x): x is Record<string, unknown> => !!x && typeof x === "object") : []
}

/**
 * 业务组件的「概览」：组件卡片、关联工具、基本信息、更新日志。
 * 开发页的详情弹窗和会话里的详情抽屉共用。
 */
export function McpAppOverview(props: { app: McpApp }) {
  const t = useT()
  const { app } = props
  const project = useSync((s) => s.projects.find((x) => x.id === app.projectId))
  const user = useSync((s) => s.user)
  const componentDir = `${project?.worktree ?? ""}/mcp-app/${app.appCode}`
  const connectors = connectorsOf(app)
  const instanceIds = connectors.map((x) => x.mcpInstanceId).filter((x): x is string => typeof x === "string" && x.length > 0)

  // 虚拟入口工具固定有一个；其余来自各连接器的 relateTools
  const tools = [
    { name: "entryTool", type: "virtual", desc: t("kcode.mcpApp.preview.tool.entryToolDesc") },
    ...connectors.flatMap((conn) =>
      (Array.isArray(conn.relateTools) ? conn.relateTools : [])
        .map((tool) => (tool && typeof tool === "object" ? (tool as Record<string, unknown>).name : undefined))
        .filter((name): name is string => typeof name === "string" && name.length > 0)
        .map((name) => ({
          name,
          type: typeof conn.type === "string" && conn.type ? conn.type : "MCP",
          desc: typeof conn.mcpInstanceId === "string" && conn.mcpInstanceId ? conn.mcpInstanceId : t("kcode.mcpApp.preview.tool.mcpToolDesc"),
        })),
    ),
  ]

  const pathLabel = t("kcode.mcpApp.preview.field.artifactPath")
  const fields: Array<[string, string]> = [
    ["appCode", app.appCode || "-"],
    [t("kcode.mcpApp.preview.field.developer"), user?.displayName ?? "-"],
    [t("kcode.mcpApp.preview.field.localStatus"), t(app.buildStatus === "success" ? "kcode.mcpApp.status.built" : "kcode.mcpApp.preview.status.notBuilt")],
    [t("kcode.mcpApp.preview.field.onlineStatus"), t(statusKey(app.mcpStatus))],
    [pathLabel, componentDir],
    [t("kcode.mcpApp.preview.field.version"), app.version],
    [t("kcode.mcpApp.preview.field.mcpInstanceId"), instanceIds.join(", ") || "-"],
    ...(app.mcpStatus === "REJECTED" && app.reviewRemark ? ([[t("kcode.mcpApp.preview.field.reviewRemark"), app.reviewRemark]] as Array<[string, string]>) : []),
  ]
  const artifacts = [...app.artifacts].reverse()

  return (
    <>
      <div className="flex gap-3 items-start">
        <DynamicSkillIcon name={app.appName || app.appCode} size={60} />
        <div className="flex flex-col min-w-0">
          <div className="mt-1 flex gap-2 items-center min-w-0">
            <div className="truncate text-[16px] font-[600] leading-[24px] text-text-strong" title={app.appName}>
              {app.appName || app.appCode || t("kcode.mcpApp.preview.defaultTitle")}
            </div>
          </div>
          <div className="mt-1">
            <span className="text-[14px] text-[var(--text-tile-desc)] font-medium leading-[22px]">{app.appDescription || t("kcode.mcpApp.preview.noDescription")}</span>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[16px] font-medium leading-[24px] text-text-strong mb-3">{t("kcode.mcpApp.preview.relatedTools")}</div>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {tools.map((tool) => (
            <div key={`${tool.type}:${tool.name}`} className="flex items-center gap-2 rounded-[16px] border border-[var(--border-weak-base)] bg-surface-base px-3 py-3">
              <div className="size-10 shrink-0 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #EBFADC 0%, #D4FCE9 100%)" }}>
                <ApplicationIcon className="size-5 text-[#34A853]" />
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-semibold text-text-strong truncate" title={tool.name}>
                    {tool.name}
                  </span>
                  <span className="shrink-0 rounded-[21px] border border-[var(--gray-blue-400)] px-2 py-px text-[12px] leading-[18px] text-[var(--gray-blue-700)]">{tool.type}</span>
                </div>
                <div className="text-[12px] leading-[18px] text-[var(--text-tile-desc)] truncate" title={tool.desc}>
                  {tool.desc}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <div className="text-[16px] font-medium leading-[24px] text-text-strong mb-3">{t("kcode.mcpApp.preview.basicInfo")}</div>
        <div className="bg-surface-skill-info rounded-[16px] px-5 py-4 flex flex-col gap-2">
          {fields.map(([label, value]) => (
            <div key={label} className="flex items-start gap-2 text-[14px] leading-[22px]">
              <span className="text-[var(--neutral-500)] shrink-0 w-[80px]">{label}</span>
              {label === pathLabel ? (
                <Tooltip value={t("kcode.project.openFolder")} placement="top" gutter={4}>
                  <span
                    className="text-[var(--primary-600)] break-all cursor-pointer underline transition-colors"
                    onClick={() => showToast({ description: `${t("kcode.project.openFolder")}：${value}` })}
                  >
                    {value}
                  </span>
                </Tooltip>
              ) : (
                <span className="text-text-base break-all">{value}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {artifacts.length > 0 && (
        <div className="mt-5">
          <div className="text-[16px] font-medium leading-[24px] text-text-strong mb-3">{t("kcode.mcpApp.preview.changelog")}</div>
          <div className="flex flex-col">
            {artifacts.map((entry, index) => (
              <div key={`${entry.version}-${entry.createdAt}`} className="flex gap-[8px]">
                <div className="relative w-[7px] shrink-0">
                  <div className="size-[7px] rounded-full mt-[8px] relative z-[1] bg-[var(--blue-500)]" />
                  <div
                    className={cx(
                      "absolute left-1/2 -translate-x-1/2 w-px",
                      artifacts.length > 1 && "bg-[var(--neutral-200)]",
                      artifacts.length > 1 && (index === 0 ? "top-[11px]" : "top-0"),
                      artifacts.length > 1 && (index === artifacts.length - 1 ? "h-[11px]" : "-bottom-3"),
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-14-medium text-text-strong uppercase">{entry.version}</span>
                    {entry.createdAt && <span className="text-12-regular text-text-base truncate">{entry.createdAt.slice(0, 10)}</span>}
                    {index === 0 && (
                      <span className="text-[12px] font-medium leading-5 text-[var(--blue-500)] px-2 rounded-[8px] bg-surface-skill-latest truncate">{t("kcode.mcpApp.preview.latest")}</span>
                    )}
                  </div>
                  {entry.changeDesc && (
                    <div className="mt-2 bg-surface-skill-info rounded-[16px] p-[12px]">
                      <div className="text-[14px] text-text-base leading-[22px]">{entry.changeDesc}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
