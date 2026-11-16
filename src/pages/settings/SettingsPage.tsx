import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Icon, SegmentedControl } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"
import { TENANT } from "@/mock/fixtures/env"
import { SettingsEnvironments } from "./SettingsEnvironments"
import { SettingsGeneral } from "./SettingsGeneral"
import { SettingsSkills } from "./SettingsSkills"
import { SettingsWorktree } from "./SettingsWorktree"
import { SettingsMcp } from "./SettingsMcp"

/**
 * 全屏设置页（「开发配置」，US-2026-043955 环境相关界面）。
 * 线上以独立 webview 全屏挂载、盖掉应用侧栏；左侧菜单为宿主原生菜单（此处示意仿制）。
 * 内容区骨架照录 build 仓 pages/settings.tsx：居中 800px、大标题、SegmentedControl 页签
 * （通用 / 工作树 / 环境 / 技能 / MCP），各页签组件照录线上同名 settings-*.tsx。
 */

const INERT = "现状功能，不在本需求范围"

/** 左侧菜单（宿主原生菜单的示意仿制）：仅「开发配置」可进本页，其余置灰 */
const NAV: Array<{ icon: string; label: string; group: 1 | 2 | 3 }> = [
  { icon: "user", label: "账户管理", group: 1 },
  { icon: "token-usage", label: "点数用量", group: 1 },
  { icon: "settings-gear", label: "通用", group: 2 },
  { icon: "global", label: "浏览器", group: 2 },
  { icon: "pencil-16", label: "快捷键", group: 2 },
  { icon: "dev", label: "开发配置", group: 2 },
  { icon: "memory", label: "个人记忆", group: 2 },
  { icon: "folder-16", label: "归档管理", group: 3 },
  { icon: "info-fill", label: "帮助与反馈", group: 3 },
  { icon: "info", label: "关于", group: 3 },
]

const TABS = [
  { key: "general", label: "通用" },
  { key: "worktree", label: "工作树" },
  { key: "environments", label: "环境" },
  { key: "skills", label: "技能" },
  { key: "mcp", label: "MCP" },
] as const

type TabKey = (typeof TABS)[number]["key"]

function SettingsPage() {
  const navigate = useNavigate()
  const params = useParams()
  const t = useT()
  const initial: TabKey = TABS.some((x) => x.key === params.section) ? (params.section as TabKey) : "environments"
  const [tab, setTab] = useState<TabKey>(initial)

  return (
    <div className="flex size-full bg-background-page">
      {/* 左侧菜单：宿主原生菜单的示意仿制（线上为 webview 外的原生侧栏） */}
      <div className="flex w-[228px] shrink-0 flex-col border-r border-[var(--border-weak-base)] bg-background-white p-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mb-2 flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] text-text-base hover:bg-surface-base"
        >
          <Icon name="arrow-left" size="small" className="text-text-weak" />
          返回应用
        </button>
        {([1, 2, 3] as const).map((group) => (
          <div key={group} className="contents">
            {group > 1 && <div className="my-2 border-t border-[var(--border-weak-base)]" />}
            {NAV.filter((n) => n.group === group).map((n) => {
              const on = n.label === "开发配置"
              return (
                <button
                  key={n.label}
                  type="button"
                  title={on ? undefined : INERT}
                  className={cx(
                    "flex w-full cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13px]",
                    on ? "bg-[#F0F1FF] font-medium text-[#3A3FD6]" : "text-text-base",
                  )}
                >
                  <Icon name={n.icon as never} size="small" className="text-text-weak" />
                  {n.label}
                </button>
              )
            })}
          </div>
        ))}
        <div className="mt-auto px-3 pt-6 text-[12px] text-text-weak">{TENANT.name} · {TENANT.user}</div>
      </div>

      {/* 内容区：居中 800px（build 仓 settings.tsx 同款） */}
      <div className="h-full w-full overflow-y-auto">
        <div className="mx-auto flex h-full w-[800px] max-w-[calc(100%-64px)] flex-col pt-[12px]">
          <div className="pb-[24px]">
            <h1
              className="flex h-9 items-center text-[20px] font-medium leading-[30px] text-[var(--text-color-primary-94,rgba(0,0,0,0.94))]"
              style={{ fontFamily: '"PingFang SC"' }}
            >
              {t("settings.title")}
            </h1>
          </div>
          <div>
            <SegmentedControl className="w-fit" value={tab} onChange={(v) => setTab(v as TabKey)} items={TABS.map((x) => ({ value: x.key, label: x.label }))} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "general" ? (
              <SettingsGeneral hideHeader />
            ) : tab === "worktree" ? (
              <SettingsWorktree hideHeader />
            ) : tab === "environments" ? (
              <SettingsEnvironments hideHeader />
            ) : tab === "skills" ? (
              <SettingsSkills hideHeader />
            ) : (
              <SettingsMcp hideHeader />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** react-router lazy 路由协议：模块导出 Component 供 lazy 加载 */
export const Component = SettingsPage
export default SettingsPage
