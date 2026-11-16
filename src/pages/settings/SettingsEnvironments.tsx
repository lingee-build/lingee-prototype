import { useState } from "react"
import { Button, Dialog, DropdownMenu, Icon, useDialog, showToast } from "@/ui"
import { cx } from "@/lib/cx"
import { ConfirmDialog } from "@/ui"
import { LINGEE_ENVS, LEGACY_COSMIC, type LingeeEnv } from "@/mock/fixtures/env"
import { envNoticeOf, loginEnvOf, sourceEnvOf, useEnvScenario } from "@/features/env-source/env-scenario"

/**
 * 设置 → 环境 页签（US-2026-043955）。
 * 「苍穹应用开发 测试环境」板块与行结构照录 build 仓 settings-environments.tsx
 * （板块头 / SettingsList / ErpRow 的 tag 体系与下拉动作 / eye 详情 / 从云端刷新确认），
 * 数据与动作 mock；「灵基环境」板块为本需求落地形态，替换线上「Lingee 测试环境」板块。
 */

const INERT = "现状功能，示意演示"

/** mock 的 ERP 环境条目（对应线上 devEnv.kdEnvList 的 KdEnvEntry） */
interface MockErpEntry {
  configName: string
  url: string
  source: "local" | "remote"
  authMode?: "oauth_pkce"
  /** OAuth 授权失效时间戳，null 表示未失效 / 非 OAuth */
  oauthExpiresAt: number | null
}

const INITIAL_ERP: MockErpEntry[] = [
  { configName: "本地开发环境", url: "https://dev-cosmic.kingdee.com/kos", source: "local", oauthExpiresAt: null },
  { configName: "云端标准环境", url: "https://cosmic.kingdee.com/kos", source: "remote", oauthExpiresAt: null },
  {
    configName: "星瀚测试租户",
    url: "https://xk-test.kingdee.com",
    source: "local",
    authMode: "oauth_pkce",
    oauthExpiresAt: Date.now() - 3600_000,
  },
]

/** SettingsList：半透明白底圆角容器（build 仓同款） */
function SettingsList(props: { children: React.ReactNode }) {
  return <div className="rounded-[16px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-2 py-1">{props.children}</div>
}

/** 详情弹窗字段行（build 仓 DetailField 同款） */
function DetailField(props: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="w-[100px] shrink-0 text-[12px] leading-[18px] text-[var(--neutral-700)]">{props.label}</span>
      <span className="flex-1 break-all text-[12px] leading-[18px] text-[var(--neutral-800)]">{props.value || "—"}</span>
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

/** 行内 tag（build 仓 ErpRow 同款规格：圆角 4、10px、半透明底） */
function RowTag(props: { text: string; bg: string; color: string }) {
  return (
    <span
      className="shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] leading-[14px] font-[500]"
      style={{ background: props.bg, color: props.color }}
    >
      {props.text}
    </span>
  )
}

const TAG_INFO = { bg: "rgba(41, 112, 255, 0.1)", color: "var(--env-info-text, var(--brand-base, #2970FF))" }
const TAG_REMOTE = { bg: "rgba(16, 185, 129, 0.1)", color: "var(--env-remote-text, #10B981)" }
const TAG_LOCAL = { bg: "rgba(107, 114, 128, 0.1)", color: "var(--neutral-500, #6B7280)" }
const TAG_WARN = { bg: "rgba(245, 158, 11, 0.12)", color: "var(--env-warning-text, #D97706)" }

/** ERP 列表行：照录线上 ErpRow——tag 体系（默认/云端/本地/OAuth）+ 失效重授权 + "..." 下拉动作 */
function ErpRow(props: {
  entry: MockErpEntry
  isDefault: boolean
  busyKey: string | null
  defaultLabel: string
  onEdit: () => void
  onTest: () => void
  onSwitchDefault: () => void
  onDelete: () => void
  onReauthorize: () => void
}) {
  const env = props.entry
  const isOauth = env.authMode === "oauth_pkce"
  const oauthExpired = env.oauthExpiresAt !== null && env.oauthExpiresAt < Date.now()
  const testing = props.busyKey === `test:${env.configName}`
  const anyBusy = !!props.busyKey

  return (
    <div className="group flex flex-wrap items-center justify-between gap-3 px-1 py-1 last:border-none">
      {/* 点击行主体 = 主操作：本地记录进编辑，云端记录进查看 */}
      <div
        className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5"
        role="button"
        tabIndex={0}
        aria-label={`${env.source === "remote" ? "查看" : "编辑"} ${env.configName}`}
        onClick={() => !anyBusy && (env.source === "remote" ? showToast({ variant: "default", title: "云端记录由企业管理中心维护，仅供查看" }) : showToast({ variant: "default", title: `编辑环境 ${env.configName}（示意）` }))}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return
          e.preventDefault()
          if (!anyBusy) env.source === "remote" ? showToast({ variant: "default", title: "云端记录由企业管理中心维护，仅供查看" }) : showToast({ variant: "default", title: `编辑环境 ${env.configName}（示意）` })
        }}
      >
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]">{env.configName}</span>
          {props.isDefault && <RowTag text="默认" {...TAG_INFO} />}
          {env.source === "remote" ? <RowTag text="云端" {...TAG_REMOTE} /> : <RowTag text="本地" {...TAG_LOCAL} />}
          {isOauth && (oauthExpired ? <RowTag text="授权已失效" {...TAG_WARN} /> : <RowTag text="OAuth 授权" {...TAG_INFO} />)}
        </div>
        <span className="truncate text-[12px] leading-[18px] text-[var(--neutral-500)]">{env.url}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {/* 失效恢复入口：仅推算失效时显示（线上同款） */}
        {isOauth && oauthExpired && (
          <Button
            size="small"
            disabled={anyBusy}
            className="h-[28px] rounded-[8px] bg-[var(--button-primary-bg)] px-3 text-[12px] leading-[20px] font-[500] text-[var(--button-primary-text)] hover:bg-[var(--button-primary-bg-hover)]"
            onClick={() => props.onReauthorize()}
            title={INERT}
          >
            重新授权
          </Button>
        )}
        <DropdownMenu placement="bottom-end">
          <DropdownMenu.Trigger
            className={cx("size-7 shrink-0 cursor-pointer border-none bg-transparent p-0 text-text-weak hover:bg-surface-base-hover data-[expanded]:bg-surface-base-active", testing && "animate-pulse")}
            aria-label="更多操作"
            title={INERT}
          >
            <Icon name="dot-grid" size="small" />
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content className="mt-1" style={{ minWidth: 160 }}>
              {env.source !== "remote" && (
                <DropdownMenu.Item disabled title={INERT} onSelect={() => props.onEdit()}>
                  <DropdownMenu.ItemLabel>编辑</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item onSelect={() => props.onTest()}>
                <DropdownMenu.ItemLabel>测试连接</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
              {!props.isDefault && (
                <DropdownMenu.Item onSelect={() => props.onSwitchDefault()}>
                  <DropdownMenu.ItemLabel>设为默认</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Separator />
              <DropdownMenu.Item data-variant="destructive" onSelect={() => props.onDelete()}>
                <DropdownMenu.ItemLabel>删除</DropdownMenu.ItemLabel>
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu>
      </div>
    </div>
  )
}

/** 灵基环境板块的行 tag 集合（PRD 口径） */
function lingeeTags(env: LingeeEnv, login: string, source: string) {
  const tags: Array<{ text: string; tone: "blue" | "green" | "orange" | "gray" | "red" }> = []
  tags.push({ text: env.status === "on" ? "启用" : "禁用", tone: env.status === "on" ? "green" : "red" })
  tags.push({ text: env.kind === "生产" ? "生产环境" : "测试环境", tone: env.kind === "生产" ? "green" : "blue" })
  if (env.id === login) tags.push({ text: "当前登录", tone: "gray" })
  if (env.id === source) tags.push({ text: "资源来源", tone: source === login ? "gray" : "orange" })
  return tags
}

const LINGEE_TONES = {
  blue: "bg-[rgba(41,112,255,0.1)] text-[#2970FF]",
  green: "bg-[rgba(16,185,129,0.1)] text-[#10B981]",
  orange: "bg-[rgba(245,158,11,0.12)] text-[#D97706]",
  gray: "bg-[rgba(107,114,128,0.1)] text-[#6B7280]",
  red: "bg-[rgba(239,68,68,0.1)] text-[#EF4444]",
}

export function SettingsEnvironments(props: { hideHeader?: boolean }) {
  const dialog = useDialog()
  const scenario = useEnvScenario()
  const login = loginEnvOf(scenario)
  const source = sourceEnvOf(scenario)
  const notice = envNoticeOf(scenario)
  // 无测试环境（含被禁用）时环境清单只含生产（其余环境不属于环境清单）
  const list = scenario.noSandbox ? LINGEE_ENVS.filter((e) => e.id === "pro") : LINGEE_ENVS

  const [erpList, setErpList] = useState(INITIAL_ERP)
  const [defaultName, setDefaultName] = useState("本地开发环境")
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const refresh = () => {
    if (busyKey === "refresh") return
    setBusyKey("refresh")
    window.setTimeout(() => setBusyKey(null), 800)
    if (scenario.envApiError) {
      showToast({ variant: "error", title: "环境信息接口失败", description: "已保留当前判定，可稍后重试" })
      return
    }
    showToast({ variant: "success", title: "环境信息已刷新" })
  }

  const handleTest = (entry: MockErpEntry) => {
    if (busyKey) return
    setBusyKey(`test:${entry.configName}`)
    window.setTimeout(() => {
      setBusyKey(null)
      showToast({ variant: "success", title: "连接成功" })
    }, 900)
  }

  const handleSwitchDefault = (entry: MockErpEntry) => {
    if (busyKey || entry.configName === defaultName) return
    setDefaultName(entry.configName)
    showToast({ variant: "success", title: "默认环境已切换" })
  }

  const handleReauthorize = (entry: MockErpEntry) => {
    if (busyKey) return
    setBusyKey(`reauth:${entry.configName}`)
    window.setTimeout(() => {
      setErpList((xs) => xs.map((x) => (x === entry ? { ...x, oauthExpiresAt: Date.now() + 30 * 86400_000 } : x)))
      setBusyKey(null)
      showToast({ variant: "success", title: "授权已保存" })
    }, 900)
  }

  const handleDelete = (entry: MockErpEntry) => {
    dialog.show(() => (
      <ConfirmDialog
        title="删除环境"
        description={`确认删除「${entry.configName}」？该操作不可恢复。`}
        confirmText="删除"
        variant="danger"
        onCancel={() => {
          dialog.close()
          dialog.show(() => <SettingsEnvironments hideHeader />)
        }}
        onConfirm={() => {
          setErpList((xs) => xs.filter((x) => x !== entry))
          dialog.close()
          showToast({ variant: "success", title: "环境已删除" })
          dialog.show(() => <SettingsEnvironments hideHeader />)
        }}
      />
    ))
  }

  /** 从云端刷新：线上走确认弹窗（用户主动交还云端权威的唯一入口） */
  const handleCloudRefresh = () => {
    if (busyKey) return
    dialog.show(() => (
      <ConfirmDialog
        title="从云端刷新"
        description="将用云端环境列表覆盖本地：同名条目（含本地修改）被云端版本取代，云端已移除的条目被清理。确认继续？"
        confirmText="从云端刷新"
        variant="primary"
        onConfirm={() => {
          dialog.close()
          setBusyKey("cloudRefresh")
          window.setTimeout(() => {
            setBusyKey(null)
            showToast({ variant: "success", title: "已从云端刷新" })
          }, 900)
        }}
      />
    ))
  }

  return (
    <div className="settings-environments relative flex h-full flex-col px-5 py-4">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-5">
          {/* ───── 苍穹应用开发 测试环境（照录线上板块） ───── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between pb-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-[16px] leading-[24px] font-[600] text-[var(--neutral-700)]">{LEGACY_COSMIC.title}</h3>
                <span className="text-[12px] leading-[18px] font-[400] text-[var(--neutral-500)]">
                  适用版本：苍穹 V8.0.1 / 8.0.4 / 8.0.8 / 8.0.10+
                </span>
              </div>
              <div className="flex items-center gap-2">
                {/* 全页面挂载时 header 被隐藏，此处补一个小号刷新按钮（线上同款） */}
                {props.hideHeader && (
                  <button
                    type="button"
                    aria-label="刷新"
                    title="刷新"
                    disabled={busyKey === "refresh"}
                    onClick={refresh}
                    className={cx("flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border-none bg-transparent p-0 text-text-weak transition-colors hover:bg-surface-base-hover", busyKey === "refresh" && "animate-spin")}
                  >
                    <Icon name="refresh" size="small" />
                  </button>
                )}
                <Button variant="ghost" size="small" disabled={busyKey === "cloudRefresh"} className="text-[12px] leading-[20px] text-[var(--neutral-600)]" onClick={handleCloudRefresh}>
                  从云端刷新
                </Button>
                <Button variant="primary" size="small" className="h-[28px] gap-1 rounded-[8px] px-3 text-[14px] leading-[22px]" title={INERT}>
                  <Icon name="plus-small" size="small" className="-ml-1" />
                  新增
                </Button>
              </div>
            </div>
            <SettingsList>
              {erpList.length > 0 ? (
                erpList.map((entry) => (
                  <ErpRow
                    key={entry.configName}
                    entry={entry}
                    isDefault={entry.configName === defaultName}
                    busyKey={busyKey}
                    defaultLabel="默认"
                    onEdit={() => showToast({ variant: "default", title: `编辑环境 ${entry.configName}（示意）` })}
                    onTest={() => handleTest(entry)}
                    onSwitchDefault={() => handleSwitchDefault(entry)}
                    onDelete={() => handleDelete(entry)}
                    onReauthorize={() => handleReauthorize(entry)}
                  />
                ))
              ) : (
                <div className="px-2 py-2 text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]">暂无环境</div>
              )}
            </SettingsList>
          </div>

          {/* ───── 灵基环境（本需求新增，替换线上「Lingee 测试环境」板块） ───── */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between pb-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <h3 className="text-[16px] leading-[24px] font-[600] text-[var(--neutral-700)]">灵基环境</h3>
                <span className="max-w-[560px] text-[12px] leading-[18px] font-[400] text-[var(--neutral-500)]">
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
              <div className="rounded-[12px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-3 py-2.5">
                <span className={cx("text-[12px] leading-[18px]", notice.tone === "warn" ? "text-[var(--env-error-text,rgba(239,68,68,0.8))]" : "text-[#2970FF]")}>{notice.text}</span>
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
                    {lingeeTags(env, login, source).map((tag) => (
                      <span key={tag.text} className={cx("shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10px] leading-[14px] font-[500]", LINGEE_TONES[tag.tone])}>
                        {tag.text}
                      </span>
                    ))}
                  </div>
                  <span className="w-full truncate text-[12px] leading-[18px] text-[var(--neutral-500)]">{env.url}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
