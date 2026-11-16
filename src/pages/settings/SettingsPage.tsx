import { useState } from "react"
import { useNavigate, useParams } from "react-router"
import { Button, Dialog, DropdownMenu, Icon, useDialog, showToast } from "@/ui"
import { cx } from "@/lib/cx"
import { LINGEE_ENVS, LEGACY_COSMIC, TENANT, type LingeeEnv } from "@/mock/fixtures/env"
import { envNoticeOf, loginEnvOf, sourceEnvOf, useEnvScenario } from "@/features/env-source/env-scenario"

/**
 * 全屏设置页（US-2026-043955 环境相关界面）。
 * 线上设置页以独立 webview 全屏挂载、盖掉应用侧栏；左侧菜单为宿主原生菜单（此处示意仿制），
 * 内容区结构照录 build 仓 pages/settings.tsx：居中 800px、大标题、胶囊 Tab。
 * 环境页样式照录 build 仓 settings-environments.tsx（区块头 / SettingsList 半透明列表 / 行内 tag / eye 详情）。
 * 「灵基环境」区块为 PRD 落地后形态，替换线上「Lingee 测试环境」板块。
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

/** 行内 tag（build 仓 ErpRow 同款规格：圆角 4、10px、半透明底） */
function RowTag(props: { text: string; tone: "blue" | "green" | "orange" | "gray" | "red" }) {
  const tones = {
    blue: "bg-[rgba(41,112,255,0.1)] text-[#2970FF]",
    green: "bg-[rgba(16,185,129,0.1)] text-[#10B981]",
    orange: "bg-[rgba(245,158,11,0.12)] text-[#D97706]",
    gray: "bg-[rgba(107,114,128,0.1)] text-[#6B7280]",
    red: "bg-[rgba(239,68,68,0.1)] text-[#EF4444]",
  }
  return <span className={cx("shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] leading-[14px] font-medium", tones[props.tone])}>{props.text}</span>
}

/** SettingsList：半透明白底圆角容器（build 仓同款） */
function SettingsList(props: { children: React.ReactNode }) {
  return <div className="rounded-[16px] bg-[color-mix(in_srgb,white_82%,transparent)] px-2 py-1">{props.children}</div>
}

/** 详情弹窗字段行（build 仓 DetailField 同款） */
function DetailField(props: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-[100px] shrink-0 text-[12px] leading-[18px] text-text-weak">{props.label}</span>
      <span className="flex-1 break-all text-[12px] leading-[18px] text-text-base">{props.value || "—"}</span>
    </div>
  )
}

/** 环境详情弹窗：PRD 附录口径 7 行（租户名称/编码、环境类型、租户状态、管理地址、集群名称/编码） */
function EnvDetailDialog(props: { env: LingeeEnv; onClose: () => void }) {
  return (
    <Dialog fit title="环境配置详情" width="420px">
      <div className="flex flex-col px-5 pb-5">
        <DetailField label="租户名称" value={props.env.name} />
        <DetailField label="租户编码" value={props.env.tenantCode} />
        <DetailField label="环境类型" value={props.env.kind === "生产" ? "生产环境" : "测试环境"} />
        <DetailField label="租户状态" value={props.env.status === "on" ? "启用" : "禁用"} />
        <DetailField label="管理地址" value={props.env.url} />
        <DetailField label="集群名称" value={props.env.clusterName} />
        <DetailField label="集群编码" value={props.env.clusterCode} />
        <div className="flex justify-end pt-2">
          <Button size="small" onClick={props.onClose}>关闭</Button>
        </div>
      </div>
    </Dialog>
  )
}

/** 环境页：苍穹现状板块（照录）+ 灵基环境板块（本需求新增，PRD 落地后形态） */
function EnvSection() {
  const dialog = useDialog()
  const scenario = useEnvScenario()
  const login = loginEnvOf(scenario)
  const source = sourceEnvOf(scenario)
  const notice = envNoticeOf(scenario)
  // 无测试环境（含被禁用）时环境清单只含生产（其余环境不属于环境清单）
  const list = scenario.noSandbox ? LINGEE_ENVS.filter((e) => e.id === "pro") : LINGEE_ENVS

  const refresh = () => {
    if (scenario.envApiError) {
      showToast({ variant: "error", title: "环境信息接口失败", description: "已保留当前判定，可稍后重试" })
      return
    }
    showToast({ variant: "success", title: "环境信息已刷新" })
  }

  const rowTags = (env: LingeeEnv) => {
    const tags: Array<{ text: string; tone: "blue" | "green" | "orange" | "gray" | "red" }> = []
    tags.push({ text: env.status === "on" ? "启用" : "禁用", tone: env.status === "on" ? "green" : "red" })
    tags.push({ text: env.kind === "生产" ? "生产环境" : "测试环境", tone: env.kind === "生产" ? "green" : "blue" })
    if (env.id === login) tags.push({ text: "当前登录", tone: "gray" })
    if (env.id === source) tags.push({ text: "资源来源", tone: source === login ? "gray" : "orange" })
    return tags
  }

  return (
    <div className="flex h-full flex-col px-5 py-4">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-5">
          {/* ───── 苍穹应用开发测试环境（现状照录） ───── */}
          <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between pb-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-[16px] leading-[24px] font-semibold text-text-strong">{LEGACY_COSMIC.title}</h3>
                <span className="text-[12px] leading-[18px] text-text-weak">{LEGACY_COSMIC.desc}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="small" className="text-[12px] leading-[20px] text-text-weak" title={INERT}>从云端刷新</Button>
                <Button variant="primary" size="small" className="h-[28px] gap-1 rounded-[8px] px-3 text-[14px] leading-[22px]" title={INERT}>
                  <Icon name="plus-small" size="small" className="-ml-1" />
                  新增
                </Button>
              </div>
            </div>
            <SettingsList>
              <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-1">
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[14px] leading-[22px] text-text-strong">{LEGACY_COSMIC.card.name}</span>
                    <RowTag text="默认" tone="blue" />
                    <RowTag text="云端" tone="green" />
                  </div>
                  <span className="truncate text-[12px] leading-[18px] text-text-weak">{LEGACY_COSMIC.card.url}</span>
                </div>
                <DropdownMenu placement="bottom-end">
                  <DropdownMenu.Trigger className="size-7 shrink-0 cursor-pointer border-none bg-transparent p-0 text-text-weak hover:bg-surface-base-hover" aria-label="更多操作" title={INERT}>
                    <Icon name="dot-grid" size="small" />
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.Content className="mt-1" style={{ minWidth: 160 }}>
                      {["编辑", "测试连接", "设为默认"].map((label) => (
                        <DropdownMenu.Item key={label} disabled title={INERT}>
                          <DropdownMenu.ItemLabel>{label}</DropdownMenu.ItemLabel>
                        </DropdownMenu.Item>
                      ))}
                    </DropdownMenu.Content>
                  </DropdownMenu.Portal>
                </DropdownMenu>
              </div>
            </SettingsList>
          </section>

          {/* ───── 灵基环境（本需求新增，替换线上「Lingee 测试环境」板块） ───── */}
          <section className="flex flex-col gap-1">
            <div className="flex items-center justify-between pb-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-[16px] leading-[24px] font-semibold text-text-strong">灵基环境</h3>
                <span className="max-w-[560px] text-[12px] leading-[18px] text-text-weak">
                  当前登录环境是灵基用户身份所在环境。开发时可用的企业 AI 资源优先选择测试环境；测试环境被禁用或无可用 SaaS 连接器时，切换生产环境为资源来源。
                </span>
              </div>
              <button
                type="button"
                className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-text-weak transition-colors hover:bg-surface-base-hover"
                onClick={refresh}
                title="刷新环境信息"
                aria-label="刷新环境信息"
              >
                <Icon name="refresh" size="small" />
              </button>
            </div>
            {notice && (
              <div className="rounded-[12px] bg-[color-mix(in_srgb,white_82%,transparent)] px-3 py-2.5">
                <span className={cx("text-[12px] leading-[18px]", notice.tone === "warn" ? "text-[rgba(239,68,68,0.8)]" : "text-[#2970FF]")}>{notice.text}</span>
              </div>
            )}
            {/* 环境卡片：白底无边框，每环境一块，整块点击查看详情 */}
            <div className="flex flex-col gap-2">
              {list.map((env) => (
                <button
                  key={env.id}
                  type="button"
                  className="flex w-full cursor-pointer flex-col items-start gap-1.5 rounded-xl border border-transparent bg-background-white px-4 py-3.5 text-left transition-colors hover:border-[#495dff]"
                  onClick={() => dialog.show(() => <EnvDetailDialog env={env} onClose={() => dialog.close()} />)}
                  title={`查看环境详情 ${env.name}`}
                  aria-label={`查看环境详情 ${env.name}`}
                >
                  <span className="text-[14px] font-medium leading-[22px] text-text-strong">{env.name}</span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rowTags(env).map((tag) => (
                      <RowTag key={tag.text} text={tag.text} tone={tag.tone} />
                    ))}
                  </div>
                  <span className="w-full truncate text-[12px] leading-[18px] text-text-weak">{env.url}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function SettingsPage() {
  const navigate = useNavigate()
  const params = useParams()
  const initial: TabKey = TABS.some((t) => t.key === params.section) ? (params.section as TabKey) : "environments"
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
            <h1 className="text-[20px] font-medium leading-[30px] text-text-strong">开发配置</h1>
          </div>
          <div className="flex w-fit gap-1 rounded-full bg-[#F3F4F6] p-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cx(
                  "cursor-pointer rounded-full border-none px-4 py-1.5 text-[13px] transition-colors",
                  tab === t.key ? "bg-background-white font-medium text-text-strong shadow-sm" : "bg-transparent text-text-weak hover:text-text-base",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {tab === "environments" ? (
              <EnvSection />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-text-weak">{INERT}</div>
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
