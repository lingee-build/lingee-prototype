import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { Button, Empty, IconButton, Switch, Tooltip, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"

/*
 * 设置 → MCP：按线上 kcode-web/src/components/settings-mcp.tsx 1:1 移植（Solid → React）。
 * 结构、类名、文案 key 与线上一致；MCP 服务列表 / computer-use 状态全部为组件内 mock 数据，
 * action（连接/断开、授权、刷新、添加、编辑、JSON 预览）用本地 state + showToast 模拟。
 */

const statusLabelKeys = {
  connected: "mcp.status.connected",
  failed: "mcp.status.failed",
  needs_auth: "mcp.status.needs_auth",
  needs_client_registration: "mcp.status.needs_client_registration",
  disabled: "mcp.status.disabled",
} as const

const statusColor: Record<StatusKind, string> = {
  connected: "var(--success-700)",
  failed: "var(--danger-700)",
  needs_auth: "var(--warning-700)",
  needs_client_registration: "var(--warning-700)",
  disabled: "var(--neutral-500)",
}

const statusBg: Record<StatusKind, string> = {
  connected: "var(--success-50)",
  failed: "var(--danger-50)",
  needs_auth: "var(--warning-50)",
  needs_client_registration: "var(--warning-50)",
  disabled: "var(--neutral-100)",
}

const SYSTEM_COMPUTER_USE_MCP_NAME = "open_computer_use"
// 原型固定演示为桌面端（线上由 usePlatform().platform 提供）
const MOCK_PLATFORM: "desktop" | "web" = "desktop"
const TOOL_PAGE_SIZE = 20

type StatusKind = "connected" | "failed" | "needs_auth" | "needs_client_registration" | "disabled"

/** 线上 McpStatus 的 mock 版本（只保留本页用到的字段） */
interface MockMcpStatus {
  status: StatusKind
  error?: string
  toolCount?: number
  toolsUpdatedAt?: number
}

/** 线上 ComputerUseStatus（host-bridge）的 mock 版本 */
interface ComputerUseStatus {
  bundled: boolean
  prepared: boolean
  node_found: boolean
  platform: "darwin" | "win32" | "linux"
  last_error?: string
  permission_state?: "ok" | "needs_accessibility" | "needs_screen_recording"
}

interface McpConfig {
  enabled?: boolean
  type: "local" | "remote"
  command?: string
  url?: string
}

interface McpTool {
  name: string
  description?: string
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// 相对时间格式化（locale-aware，自动适配中英文）
const relativeTimeFmt = new Intl.RelativeTimeFormat(undefined, { style: "short" })
const formatRelativeTime = (timestamp: number) => {
  const diff = timestamp - Date.now()
  const absDiff = Math.abs(diff)
  if (absDiff < 60_000) return relativeTimeFmt.format(Math.round(diff / 1000), "second")
  if (absDiff < 3_600_000) return relativeTimeFmt.format(Math.round(diff / 60_000), "minute")
  if (absDiff < 86_400_000) return relativeTimeFmt.format(Math.round(diff / 3_600_000), "hour")
  return relativeTimeFmt.format(Math.round(diff / 86_400_000), "day")
}

/* ------------------------------------------------------------------ */
/* mock 数据：4 个 MCP 服务（已连接 / 需要授权 / 失败 / 已禁用）+ computer-use 就绪态 */
/* ------------------------------------------------------------------ */

const DEMO_MCP: Record<string, MockMcpStatus> = {
  context7: {
    status: "failed",
    error:
      "Failed to connect: spawn npx ENOENT (command not found). Please make sure Node.js is installed and npx is available in PATH.",
  },
  filesystem: { status: "connected", toolCount: 26, toolsUpdatedAt: Date.now() - 5 * 60_000 },
  github: { status: "needs_auth" },
  kderp: { status: "disabled" },
  // 系统托管的 computer-use MCP：不进列表，但参与 computer-use 板块的状态判定
  [SYSTEM_COMPUTER_USE_MCP_NAME]: { status: "disabled" },
}

const DEMO_CONFIG: Record<string, McpConfig> = {
  context7: { enabled: true, type: "local", command: "npx -y @upstash/context7-mcp" },
  filesystem: {
    enabled: true,
    type: "local",
    command: "npx -y @modelcontextprotocol/server-filesystem /Users/kingdee/Documents",
  },
  github: { enabled: true, type: "remote", url: "https://api.githubcopilot.com/mcp/" },
  kderp: { enabled: false, type: "remote", url: "https://mcp.kingdee.com/kderp/mcp" },
}

const DEMO_COMPUTER_USE: ComputerUseStatus = {
  bundled: true,
  prepared: true,
  node_found: true,
  platform: "darwin",
  permission_state: "ok",
}

const DEMO_TOOLS_LIST: Record<string, McpTool[]> = {
  context7: [
    { name: "resolve-library-id", description: "Resolve a library name to a context7-compatible library ID." },
    { name: "get-library-docs", description: "Fetch documentation for a library using a context7-compatible library ID." },
  ],
  filesystem: [
    { name: "read_file", description: "Read the complete contents of a file from the file system." },
    { name: "read_multiple_files", description: "Read multiple files at once, each with its absolute path." },
    { name: "write_file", description: "Create a new file or overwrite an existing file with content." },
    { name: "edit_file", description: "Make line-based edits to a text file." },
    { name: "get_file_info", description: "Retrieve metadata about a file or directory." },
    { name: "list_directory", description: "Get a detailed listing of files and subdirectories in a directory." },
    { name: "directory_tree", description: "Get a recursive tree view of files and directories as a JSON structure." },
    { name: "create_directory", description: "Create a new directory or ensure a directory exists." },
    { name: "list_allowed_directories", description: "List the directories this server is allowed to access." },
    { name: "move_file", description: "Move or rename files and directories." },
    { name: "search_files", description: "Recursively search for files matching a pattern." },
    { name: "read_file_backwards", description: "Read a file backwards, useful for large log files." },
    { name: "read_excel", description: "Read an Excel file and return sheets, rows and cells." },
    { name: "write_excel", description: "Write rows and cells into an Excel workbook file." },
    { name: "list_spreadsheet_sheets", description: "List all sheet names in a spreadsheet file." },
    { name: "read_sheet_to_csv", description: "Read a single sheet of a spreadsheet and output it as CSV." },
    { name: "read_pdf", description: "Extract text, metadata and pages from a PDF file." },
    { name: "read_docx", description: "Extract paragraphs, tables and headers from a Word document." },
    { name: "list_pdf_pages", description: "List page numbers and sizes of a PDF file." },
    { name: "extract_pdf_text", description: "Extract text from a page range of a PDF file." },
    { name: "zip_files", description: "Compress multiple files into a zip archive." },
    { name: "unzip_file", description: "Extract a zip archive into a target directory." },
    { name: "create_thumbnail", description: "Create a thumbnail image from an image or PDF page." },
    { name: "grep_content", description: "Search file content with a regular expression and return matches." },
    { name: "count_lines", description: "Count lines, words and characters in a text file." },
    { name: "get_file_checksum", description: "Compute the SHA-256 checksum of a file." },
  ],
  github: [
    { name: "search_repositories", description: "Search GitHub repositories with filters." },
    { name: "get_issue", description: "Get details of a GitHub issue." },
    { name: "list_pull_requests", description: "List pull requests of a repository." },
    { name: "create_issue", description: "Create a new issue in a repository." },
    { name: "get_file_contents", description: "Get the contents of a file or directory from a repository." },
    { name: "list_commits", description: "List commits of a branch." },
  ],
  kderp: [
    { name: "query_erp_bill", description: "Query ERP bills with filters like bill number, org and date range." },
    { name: "get_erp_master_data", description: "Query ERP master data such as supplier, customer and material." },
    { name: "submit_erp_bill", description: "Submit an ERP bill to the workflow." },
  ],
  [SYSTEM_COMPUTER_USE_MCP_NAME]: [
    { name: "screenshot", description: "Capture a screenshot of the screen or a window." },
    { name: "click", description: "Click at coordinates in the active application." },
    { name: "type_text", description: "Type text into the focused element." },
  ],
}

const DEMO_TOOLS_UPDATED_AT: Record<string, number> = {
  filesystem: Date.now() - 5 * 60_000,
}

// 首次连接成功后回填的 toolCount（与 DEMO_TOOLS_LIST 条数一致）
const connectedToolCount = (name: string) => DEMO_TOOLS_LIST[name]?.length ?? 0

/* ------------------------------------------------------------------ */
/* 线上 settings-list.tsx / settings-toolbar.tsx 的本文件内移植          */
/* ------------------------------------------------------------------ */

/** 线上 SettingsList：rounded-[16px] 半透明底容器（class 覆盖默认内边距） */
export function SettingsList(props: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "rounded-[16px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)]",
        !props.className && "px-2 py-1",
        props.className,
      )}
    >
      {props.children}
    </div>
  )
}

/** 线上 SETTINGS_TOOLBAR_PRIMARY_CLASS：工具栏主按钮（32px 高、8px 圆角） */
const SETTINGS_TOOLBAR_PRIMARY_CLASS =
  "h-8 gap-1 rounded-[8px] border-none bg-[var(--button-primary-bg)] px-3 text-[14px] font-[500] leading-[22px] text-[var(--button-primary-text)] [&_[data-slot=icon-svg]]:text-[var(--button-primary-text)] [&_[data-component=icon]]:-ml-1 hover:bg-[var(--button-primary-bg-hover)] hover:text-[var(--button-primary-text)] active:bg-[var(--button-primary-bg-active)] active:text-[var(--button-primary-text)]"

/** 线上 REFRESH_CLASS：工具栏刷新按钮（32px 高、蓝色描边） */
const REFRESH_CLASS =
  "h-8 gap-1 rounded-[8px] border border-[var(--primary-600,#495dff)] bg-transparent px-3 text-[14px] font-[500] leading-[22px] text-[var(--primary-600,#495dff)] [&_[data-slot=icon-svg]]:text-[var(--primary-600,#495dff)]"

/** 线上 SettingsToolbarRefresh：旋转动画只作用在图标上 */
function SettingsToolbarRefresh(props: { label: string; spinning?: boolean; onClick: () => void }) {
  return (
    <Button
      size="small"
      variant="secondary"
      icon="refresh"
      disabled={props.spinning}
      className={cx(REFRESH_CLASS, props.spinning && "[&_svg]:animate-spin")}
      onClick={props.onClick}
    >
      {props.label}
    </Button>
  )
}

/* ------------------------------------------------------------------ */
/* 「添加 MCP」菜单：线上 settings-mcp-menu.css 的关键规则内联为 Tailwind  */
/* ------------------------------------------------------------------ */

const ADD_MENU_CLASS =
  "box-border min-w-[181px] p-1 flex flex-col gap-0.5 rounded-[16px] border-[0.5px] border-[var(--neutral-200,rgba(0,0,0,0.12))] bg-[var(--neutral-0,var(--surface-raised-stronger-non-alpha,#fff))] bg-clip-padding shadow-[0px_4px_12px_0_var(--neutral-130,rgba(0,0,0,0.08))]"

const ADD_MENU_ITEM_CLASS =
  "box-border w-full h-8 px-2 flex items-center gap-1 shrink-0 border-none rounded-[16px] bg-transparent cursor-pointer select-none text-left whitespace-nowrap font-sans text-[14px] not-italic font-normal leading-5 tracking-[var(--letter-spacing-normal)] text-[var(--neutral-700,var(--text-strong,rgba(0,0,0,0.82)))] hover:bg-[var(--neutral-50,var(--surface-card-base,rgba(0,0,0,0.03)))] focus-visible:bg-[var(--neutral-50,var(--surface-card-base,rgba(0,0,0,0.03)))] focus-visible:outline-none"

/* ------------------------------------------------------------------ */

export function SettingsMcp(props: { hideHeader?: boolean }) {
  const t = useT()
  const dialog = useDialog()
  // 线上：hideHeader 时由弹窗版设置提供返回行为；原型无这些编辑弹窗，仅保留行为占位
  const returnHandler = props.hideHeader ? () => dialog.close() : undefined

  const [mcpStatuses, setMcpStatuses] = useState<Record<string, MockMcpStatus>>(() => ({ ...DEMO_MCP }))
  const [computerUseStatus, setComputerUseStatus] = useState<ComputerUseStatus | null>(DEMO_COMPUTER_USE)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshingTools, setRefreshingTools] = useState<Set<string>>(new Set())
  // 展开工具列表的服务器名集合
  const [expandedServers, setExpandedServers] = useState<Set<string>>(new Set())
  // 每个服务展开后的搜索关键词
  const [toolSearch, setToolSearch] = useState<Record<string, string>>({})
  // 每个服务当前显示的工具条数（分页，默认 20）
  const [toolPageCount, setToolPageCount] = useState<Record<string, number>>({})
  const [toolsUpdatedAt, setToolsUpdatedAt] = useState<Record<string, number>>(() => ({ ...DEMO_TOOLS_UPDATED_AT }))
  // 线上 toggle / authorize mutation 的 pending 服务名（对应 toggle.variables / authorize.variables）
  const [pendingToggle, setPendingToggle] = useState<string | undefined>(undefined)
  const [pendingAuth, setPendingAuth] = useState<string | undefined>(undefined)
  // 线上 computerUseAction.isPending
  const [cuPending, setCuPending] = useState(false)

  // 「添加 MCP」下拉菜单：线上 Portal 到 body 避开滚动容器裁剪，React 用 createPortal 等价实现
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const [addMenuPos, setAddMenuPos] = useState<{ top: string; right: string }>()
  const addMenuRef = useRef<HTMLDivElement>(null)

  // 线上 useScrollBottom：底部渐隐提示（不在底部时显示）
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollAtBottom, setScrollAtBottom] = useState(true)

  // mock：真实连接状态已回填（线上 statusLoaded），列表直接渲染，无「检测中」态
  const statusLoaded = true
  const configError: string | undefined = undefined
  const configFilePath: string | undefined = undefined

  const toggleAddMenu = (trigger: HTMLElement) => {
    // 先切状态再算位置：定位失败也不能拖累菜单的开合
    setAddMenuOpen((v) => !v)
    const rect = trigger.getBoundingClientRect()
    setAddMenuPos({ top: `${rect.bottom + 4}px`, right: `${window.innerWidth - rect.right}px` })
  }

  // 全局点击关闭（冒泡阶段，不影响菜单内按钮自身的 click）
  useEffect(() => {
    if (!addMenuOpen) return
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      // 用 data 属性判断触发器，不依赖 ref
      if (target.closest("[data-action='mcp-add-trigger']")) return
      if (addMenuRef.current?.contains(target)) return
      setAddMenuOpen(false)
    }
    const timer = setTimeout(() => document.addEventListener("click", handler), 0)
    return () => {
      clearTimeout(timer)
      document.removeEventListener("click", handler)
    }
  }, [addMenuOpen])

  const items = useMemo(() => {
    // 以 mcpStatuses 的键为唯一来源（排除内部字段与系统托管的 computer-use）
    const names = Object.keys(mcpStatuses).filter((k) => !k.startsWith("__") && k !== SYSTEM_COMPUTER_USE_MCP_NAME)
    return names.map((name) => ({ name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [mcpStatuses])

  const computerUseMcpStatus = mcpStatuses[SYSTEM_COMPUTER_USE_MCP_NAME]
  const computerUseConnected = computerUseMcpStatus?.status === "connected"
  const computerUsePrepared = !!computerUseStatus?.bundled && !!computerUseStatus?.prepared
  const computerUseCanManage = !!computerUseStatus?.bundled

  const computerUseSummary = useMemo(() => {
    const status = computerUseStatus
    if (!status?.bundled) return t("settings.mcp.computerUse.notBundled")
    if (!status.prepared) return t("settings.mcp.computerUse.notPrepared")
    if (!status.node_found) return t("settings.mcp.computerUse.nodeMissing")
    if (status.last_error) return status.last_error
    if (status.permission_state === "needs_accessibility") return t("settings.mcp.computerUse.needsAccessibility")
    if (status.permission_state === "needs_screen_recording") return t("settings.mcp.computerUse.needsScreenRecording")
    if (computerUseMcpStatus?.status === "failed") return t("settings.mcp.computerUse.runtimeError")
    if (computerUseConnected) return t("settings.mcp.computerUse.enabled")
    return t("settings.mcp.computerUse.ready")
  }, [computerUseStatus, computerUseMcpStatus, computerUseConnected, t])

  /* ---------------- mock 动作 ---------------- */

  // 线上 toggle mutation：连接 / 断开（失败的服务重试连接仍失败并提示错误）
  const toggle = async (name: string) => {
    if (pendingToggle || pendingAuth) return
    setPendingToggle(name)
    await sleep(800)
    setPendingToggle(undefined)
    const status = mcpStatuses[name]
    if (status?.status === "failed") {
      showToast({ variant: "error", title: t("common.requestFailed"), description: status.error })
      return
    }
    const wasConnected = status?.status === "connected"
    setMcpStatuses((prev) => ({
      ...prev,
      [name]: wasConnected
        ? { status: "disabled" }
        : { status: "connected", toolCount: connectedToolCount(name), toolsUpdatedAt: Date.now() },
    }))
    if (!wasConnected) setToolsUpdatedAt((prev) => ({ ...prev, [name]: Date.now() }))
  }

  // 线上 authorize mutation：OAuth 授权成功后回填为已连接
  const authorize = async (name: string) => {
    if (pendingAuth || pendingToggle) return
    setPendingAuth(name)
    await sleep(900)
    setPendingAuth(undefined)
    setMcpStatuses((prev) => ({
      ...prev,
      [name]: { status: "connected", toolCount: connectedToolCount(name), toolsUpdatedAt: Date.now() },
    }))
    setToolsUpdatedAt((prev) => ({ ...prev, [name]: Date.now() }))
  }

  // 线上 computerUseAction：prepare / doctor / enable / disable / uninstall
  const computerUseAction = async (action: "prepare" | "doctor" | "enable" | "disable" | "uninstall") => {
    if (cuPending) return
    setCuPending(true)
    try {
      await sleep(900)
      if (action === "prepare") {
        setComputerUseStatus({ ...DEMO_COMPUTER_USE, prepared: true })
        return
      }
      if (action === "doctor") {
        setComputerUseStatus({ ...DEMO_COMPUTER_USE })
        showToast({ variant: "success", title: t("settings.mcp.computerUse.doctor") })
        return
      }
      if (action === "uninstall") {
        setComputerUseStatus({ ...DEMO_COMPUTER_USE, prepared: false })
        setMcpStatuses((prev) => {
          const next = { ...prev }
          delete next[SYSTEM_COMPUTER_USE_MCP_NAME]
          return next
        })
        showToast({ variant: "success", title: t("settings.mcp.computerUse.uninstall") })
        return
      }
      if (action === "disable") {
        setMcpStatuses((prev) => ({ ...prev, [SYSTEM_COMPUTER_USE_MCP_NAME]: { status: "disabled" } }))
        return
      }
      setMcpStatuses((prev) => ({
        ...prev,
        [SYSTEM_COMPUTER_USE_MCP_NAME]: {
          status: "connected",
          toolCount: connectedToolCount(SYSTEM_COMPUTER_USE_MCP_NAME),
          toolsUpdatedAt: Date.now(),
        },
      }))
      showToast({ variant: "success", title: t("settings.mcp.computerUse.enabled") })
    } finally {
      setCuPending(false)
    }
  }

  // 线上 refresh：工具栏整页刷新（600ms 最短转圈时长）
  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    await sleep(600)
    setMcpStatuses({ ...DEMO_MCP })
    setComputerUseStatus(DEMO_COMPUTER_USE)
    setToolsUpdatedAt({ ...DEMO_TOOLS_UPDATED_AT })
    setRefreshing(false)
  }

  // 线上 refreshServerTools：单服务手动刷新工具列表
  const refreshServerTools = async (name: string) => {
    if (refreshingTools.has(name)) return
    setRefreshingTools((prev) => new Set(prev).add(name))
    await sleep(1000)
    setRefreshingTools((prev) => {
      const next = new Set(prev)
      next.delete(name)
      return next
    })
    setToolsUpdatedAt((prev) => ({ ...prev, [name]: Date.now() }))
  }

  const toggleExpand = (name: string) => {
    setExpandedServers((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
    // 收起时重置搜索和分页
    setToolSearch((prev) => ({ ...prev, [name]: "" }))
    setToolPageCount((prev) => ({ ...prev, [name]: 1 }))
  }

  // 线上打开 DialogJsonPreview / DialogEditMcp / DialogAddMcp / DialogImportJson：
  // 原型不移植这些弹窗，用 toast 演示同等动作
  const jsonPreview = (name: string) =>
    JSON.stringify({ mcpServers: { [name]: DEMO_CONFIG[name] } }, null, 2)
  const editMcp = (name: string) => {
    const cfg = DEMO_CONFIG[name]
    return cfg.type === "local" ? cfg.command : cfg.url
  }

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    setScrollAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 2)
  }

  return (
    <div className="relative flex h-full flex-col px-5 py-4" style={{ background: "var(--color-background-page)" }}>
      {!props.hideHeader && (
        <div>
          <div className="flex flex-col gap-1 pb-5">
            <h2 className="text-[20px] leading-[36px] h-9 flex items-center font-[600] text-[var(--neutral-700)]">
              {t("settings.mcp.title")}
            </h2>
            <span className="text-[12px] leading-[18px] text-[var(--neutral-500)]">{t("settings.mcp.description")}</span>
          </div>
        </div>
      )}
      <div className="no-scrollbar flex-1 overflow-y-auto" ref={scrollRef} onScroll={onScroll}>
        <div className="flex min-h-full w-full flex-col gap-5">
          {MOCK_PLATFORM === "desktop" && (
            <div className="flex flex-col gap-2 rounded-2xl bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <h3 className="text-[16px] leading-[24px] font-[600] text-[var(--neutral-700)]">
                    {t("settings.mcp.computerUse.title")}
                  </h3>
                </div>
                {computerUsePrepared ? (
                  <div className="flex shrink-0 items-center gap-2">
                    <Button size="small" variant="ghost" disabled={cuPending} onClick={() => void computerUseAction("uninstall")}>
                      {t("settings.mcp.computerUse.uninstall")}
                    </Button>
                    {computerUseStatus?.platform === "darwin" && (
                      <Button size="small" variant="ghost" disabled={cuPending} onClick={() => void computerUseAction("doctor")}>
                        {t("settings.mcp.computerUse.doctor")}
                      </Button>
                    )}
                    <Switch
                      checked={computerUseConnected}
                      disabled={cuPending}
                      onChange={() => void computerUseAction(computerUseConnected ? "disable" : "enable")}
                    />
                  </div>
                ) : (
                  <Button
                    size="small"
                    variant="primary"
                    disabled={cuPending || !computerUseCanManage}
                    onClick={() => void computerUseAction("prepare")}
                  >
                    {t("settings.mcp.computerUse.prepare")}
                  </Button>
                )}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[12px] leading-[18px] text-[var(--neutral-500)]">
                  {t("settings.mcp.computerUse.description")}
                </span>
                {computerUseStatus?.last_error && (
                  <span className="text-[12px] leading-[18px] text-[var(--danger-600)] break-all">
                    {computerUseStatus.last_error}
                  </span>
                )}
              </div>
              {computerUsePrepared && !computerUseStatus?.node_found && computerUseStatus?.bundled && (
                <span className="text-[12px] leading-[18px] text-[var(--warning-700)]">
                  {t("settings.mcp.computerUse.nodeGuide")}
                </span>
              )}
            </div>
          )}

          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-1.5">
                <h3 className="text-[16px] leading-[24px] font-[600] text-[var(--neutral-700)]">
                  {t("settings.mcp.section.list")}
                </h3>
                <Tooltip value={t("settings.mcp.localOnlyTip")} placement="top" contentStyle={{ zIndex: 1200 }}>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="cursor-pointer text-[var(--neutral-500)] hover:text-[var(--primary-600)]"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 7v6M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </Tooltip>
              </div>
              <div className="flex items-center gap-2">
                <SettingsToolbarRefresh label={t("settings.environments.refresh")} spinning={refreshing} onClick={() => void refresh()} />
                <Button
                  size="small"
                  variant="ghost"
                  icon="plus-small"
                  className={SETTINGS_TOOLBAR_PRIMARY_CLASS}
                  data-action="mcp-add-trigger"
                  onClick={(e) => toggleAddMenu(e.currentTarget)}
                >
                  {t("settings.mcp.add")}
                </Button>
              </div>
            </div>

            {items.length > 0 ? (
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const mcpStatus = mcpStatuses[item.name]
                  // 已连接时的额外字段（toolCount / toolsUpdatedAt）
                  const connectedInfo = mcpStatus?.status === "connected" ? mcpStatus : undefined
                  const status = mcpStatus?.status ?? (DEMO_CONFIG[item.name]?.enabled === false ? ("disabled" as const) : undefined)
                  const enabled = status === "connected"
                  const needsAuth = status === "needs_auth"
                  const error = mcpStatus?.status === "failed" ? mcpStatus.error : undefined
                  const isToggling = pendingToggle === item.name
                  const isAuthing = pendingAuth === item.name
                  const loading = isToggling || isAuthing
                  const loadingLabel = isAuthing
                    ? t("dialog.mcp.auth.authorizing")
                    : isToggling
                      ? enabled
                        ? t("mcp.status.disconnecting")
                        : t("mcp.status.connecting")
                      : undefined
                  const loadingColor = isAuthing
                    ? "var(--primary-600)"
                    : isToggling
                      ? enabled
                        ? "var(--danger-600)"
                        : "var(--primary-600)"
                      : "var(--primary-600)"
                  const label = status ? t(statusLabelKeys[status]) : undefined
                  const updatedAt = connectedInfo?.toolsUpdatedAt ?? toolsUpdatedAt[item.name]
                  return (
                    <div key={item.name} className="rounded-xl bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)]">
                      <div className="group flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="min-w-0 truncate text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]"
                            style={{ maxWidth: "150px" }}
                            title={item.name}
                          >
                            {item.name}
                          </span>
                          {loading ? (
                            <span
                              className="text-[12px] leading-[18px] font-[500] shrink-0 whitespace-nowrap"
                              style={{ color: loadingColor }}
                            >
                              {loadingLabel}
                            </span>
                          ) : label ? (
                            <span
                              className="text-[11px] leading-[16px] px-1.5 py-px rounded-full shrink-0"
                              style={{
                                color: status ? statusColor[status] : undefined,
                                background: status ? statusBg[status] : undefined,
                              }}
                            >
                              {label}
                            </span>
                          ) : null}
                          {/* 已连接：工具数量角标 + 更新时间，点击展开工具列表 */}
                          {status === "connected" && !loading && (
                            <>
                              <span
                                className="text-[11px] leading-[16px] px-1.5 py-px rounded-full shrink-0 cursor-pointer select-none flex items-center gap-0.5"
                                style={{ color: "var(--primary-700)", background: "var(--primary-50)" }}
                                onClick={() => toggleExpand(item.name)}
                              >
                                {t("settings.mcp.tools.count", {
                                  count: connectedInfo?.toolCount ?? DEMO_TOOLS_LIST[item.name]?.length ?? 0,
                                })}
                                <span
                                  className="text-[8px] transition-transform"
                                  style={{ transform: expandedServers.has(item.name) ? "rotate(180deg)" : "none" }}
                                >
                                  ▼
                                </span>
                              </span>
                              {updatedAt !== undefined && (
                                <span className="text-[11px] leading-[16px] text-[var(--neutral-400)] shrink-0 whitespace-nowrap">
                                  {t("settings.mcp.tools.updated")}
                                  {formatRelativeTime(updatedAt)}
                                </span>
                              )}
                            </>
                          )}
                          {error && !loading && (
                            <Tooltip
                              value={error}
                              placement="top"
                              contentClass="max-w-[400px]"
                              contentStyle={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                            >
                              <span className="text-[12px] leading-[18px] text-[var(--danger-600)] cursor-default shrink-0">
                                {t("settings.mcp.error.short")}
                              </span>
                            </Tooltip>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {needsAuth && (
                            <Button
                              size="small"
                              variant="primary"
                              disabled={pendingAuth !== undefined}
                              onClick={() => void authorize(item.name)}
                            >
                              {isAuthing ? t("dialog.mcp.auth.authorizing") : t("dialog.mcp.auth.authorize")}
                            </Button>
                          )}
                          {/* 单服务刷新按钮 */}
                          {status === "connected" && !loading && !needsAuth && (
                            <Tooltip value={t("settings.mcp.tools.refresh")} placement="top">
                              <IconButton
                                icon="refresh"
                                variant="ghost"
                                iconSize="small"
                                disabled={refreshingTools.has(item.name)}
                                aria-label={t("settings.mcp.tools.refresh")}
                                className={cx(refreshingTools.has(item.name) && "animate-spin")}
                                onClick={() => void refreshServerTools(item.name)}
                              />
                            </Tooltip>
                          )}
                          {/* 查看 JSON */}
                          <IconButton
                            icon="code-slash"
                            variant="ghost"
                            iconSize="small"
                            aria-label={t("dialog.mcp.jsonPreview.title")}
                            onClick={() =>
                              showToast({
                                variant: "default",
                                title: t("dialog.mcp.jsonPreview.title"),
                                description: jsonPreview(item.name),
                              })
                            }
                          />
                          {/* 编辑 */}
                          <IconButton
                            icon="edit"
                            variant="ghost"
                            iconSize="small"
                            aria-label={t("settings.mcp.edit")}
                            onClick={() =>
                              showToast({
                                variant: "default",
                                title: t("settings.mcp.edit.title", { name: item.name }),
                                description: editMcp(item.name),
                              })
                            }
                          />
                          {!needsAuth && (
                            <Switch
                              checked={enabled}
                              disabled={!statusLoaded || (pendingToggle !== undefined && pendingToggle === item.name)}
                              onChange={() => void toggle(item.name)}
                            />
                          )}
                        </div>
                      </div>
                      {/* 展开工具列表 */}
                      {status === "connected" && expandedServers.has(item.name) && (() => {
                        const allTools = DEMO_TOOLS_LIST[item.name] ?? []
                        const query = (toolSearch[item.name] ?? "").trim().toLowerCase()
                        const filtered = query
                          ? allTools.filter(
                              (tool) =>
                                tool.name.toLowerCase().includes(query) || (tool.description ?? "").toLowerCase().includes(query),
                            )
                          : allTools
                        const page = toolPageCount[item.name] ?? 1
                        const shown = filtered.slice(0, page * TOOL_PAGE_SIZE)
                        const hasMore = shown.length < filtered.length
                        return (
                          <div className="border-t border-[var(--neutral-100)]">
                            {/* 搜索框 */}
                            {allTools.length > 5 && (
                              <div className="px-3 py-1.5">
                                <input
                                  type="text"
                                  value={toolSearch[item.name] ?? ""}
                                  onChange={(e) => {
                                    setToolSearch((prev) => ({ ...prev, [item.name]: e.currentTarget.value }))
                                    setToolPageCount((prev) => ({ ...prev, [item.name]: 1 }))
                                  }}
                                  placeholder={t("settings.mcp.tools.search")}
                                  className="w-full text-[12px] leading-[18px] px-2 py-1 rounded-md border border-[var(--neutral-100)] bg-[var(--neutral-0)] text-[var(--neutral-700)] outline-none focus:border-[var(--primary-400)]"
                                />
                              </div>
                            )}
                            {/* 工具列表（搜索过滤 + 分页） */}
                            <div className="max-h-[240px] overflow-y-auto">
                              {allTools.length === 0 ? (
                                <div className="px-3 py-2 text-[12px] text-[var(--neutral-400)]">
                                  {t("settings.mcp.tools.loading")}
                                </div>
                              ) : (
                                <>
                                  {filtered.length === 0 && (
                                    <div className="px-3 py-2 text-[12px] text-[var(--neutral-400)]">
                                      {t("settings.mcp.tools.noResults")}
                                    </div>
                                  )}
                                  {shown.map((tool) => (
                                    <div
                                      key={tool.name}
                                      className="flex items-center gap-2 px-3 py-1 hover:bg-[color-mix(in_srgb,var(--neutral-50)_50%,transparent)]"
                                    >
                                      <span className="text-[12px] leading-[18px] font-[500] text-[var(--neutral-600)] shrink-0 font-mono whitespace-nowrap select-text">
                                        {tool.name}
                                      </span>
                                      <Tooltip
                                        value={tool.description ?? ""}
                                        placement="top"
                                        className="min-w-0 flex-1"
                                        contentStyle={{ maxWidth: "360px", whiteSpace: "normal", wordBreak: "break-word" }}
                                      >
                                        <span className="text-[12px] leading-[18px] text-[var(--neutral-400)] truncate min-w-0 select-text cursor-text">
                                          {tool.description}
                                        </span>
                                      </Tooltip>
                                    </div>
                                  ))}
                                  {hasMore && (
                                    <button
                                      className="w-full text-center py-1.5 text-[12px] text-[var(--primary-600)] hover:bg-[color-mix(in_srgb,var(--primary-50)_30%,transparent)]"
                                      onClick={() => setToolPageCount((prev) => ({ ...prev, [item.name]: page + 1 }))}
                                    >
                                      {t("settings.mcp.tools.loadMore")}
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )
                })}
              </div>
            ) : configError ? (
              <div className="flex items-start gap-2.5 rounded-lg bg-[var(--danger-50)] px-3 py-3">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0 mt-0.5 text-[var(--danger-600)]">
                  <path
                    d="M12 2L1 21h22L12 2z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinejoin="round"
                    fill="none"
                  />
                  <path d="M12 9v5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="12" cy="17" r="1" fill="currentColor" />
                </svg>
                <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                  <span className="text-[13px] font-[600] text-[var(--danger-700)]">{t("settings.mcp.configError.title")}</span>
                  <span className="text-[12px] leading-[18px] text-[var(--danger-600)] break-all">{configError}</span>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-[500] text-[var(--danger-600)] hover:text-[var(--danger-700)] cursor-pointer transition-colors whitespace-nowrap"
                  onClick={() =>
                    showToast({
                      variant: "default",
                      title: t("settings.mcp.configError.edit"),
                      description: configFilePath,
                    })
                  }
                >
                  {t("settings.mcp.configError.edit")}
                </button>
              </div>
            ) : (
              <Empty description={t("settings.mcp.empty")} />
            )}
          </div>
        </div>
      </div>
      {!scrollAtBottom && (
        <div
          className="pointer-events-none absolute bottom-4 left-0 right-0 h-8"
          style={{
            background:
              "linear-gradient(0deg, var(--setting-dialog-bottom-bg-start, #FFF) 0%, var(--setting-dialog-bottom-bg-end, rgba(255, 255, 255, 0.00)) 100%)",
          }}
        />
      )}

      {/*
       * 「添加 MCP」菜单：Portal 到 body（React createPortal），避开滚动容器的 overflow 裁剪。
       * 线上 settings-mcp-menu.css 的面板 / 菜单项样式已内联为 Tailwind 任意值类。
       */}
      {addMenuOpen &&
        createPortal(
          <div ref={addMenuRef} data-kb-top-layer="" className={cx(ADD_MENU_CLASS, "pointer-events-auto fixed !z-[51]")} style={addMenuPos}>
            <button
              type="button"
              className={ADD_MENU_ITEM_CLASS}
              onClick={() => {
                setAddMenuOpen(false)
                returnHandler?.()
                showToast({ variant: "success", title: t("dialog.mcp.add.menu.manual"), description: jsonPreview("filesystem") })
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path
                  d="M19.9999 20.0006C20.5521 20.0006 20.9997 20.4484 20.9999 21.0006C20.9997 21.5528 20.5521 22.0006 19.9999 22.0006H3.99988C3.44786 22.0004 3.00003 21.5527 2.99988 21.0006C3.00001 20.4486 3.44784 20.0008 3.99988 20.0006H19.9999Z"
                  fill="currentColor"
                  fillOpacity="0.64"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12.7714 3.39125C14.3356 1.84217 16.8582 1.8482 18.4149 3.40492L18.6815 3.67152C20.2436 5.23362 20.2436 7.76665 18.6815 9.32875L11.5966 16.4137C11.0213 16.9888 10.2846 17.3756 9.48425 17.5211L4.17859 18.485C3.84078 18.5463 3.49462 18.4295 3.26257 18.1764C3.0307 17.9234 2.9449 17.569 3.03503 17.2379L4.32312 12.5123C4.50805 11.8348 4.86902 11.2175 5.36804 10.7233L12.7714 3.39125ZM16.9999 4.81898C16.2215 4.04076 14.9607 4.03765 14.1786 4.81214L6.77527 12.1452C6.52585 12.3923 6.34619 12.7009 6.25378 13.0397L5.38171 16.233L9.12585 15.5534C9.526 15.4807 9.89483 15.2871 10.1825 14.9996L17.2675 7.91468C18.0484 7.1337 18.0483 5.86762 17.2675 5.08656L16.9999 4.81898Z"
                  fill="currentColor"
                  fillOpacity="0.64"
                />
              </svg>
              <span>{t("dialog.mcp.add.menu.manual")}</span>
            </button>
            <button
              type="button"
              className={ADD_MENU_ITEM_CLASS}
              onClick={() => {
                setAddMenuOpen(false)
                returnHandler?.()
                showToast({ variant: "success", title: t("dialog.mcp.import.success", { count: 2 }) })
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="shrink-0">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M18 2C20.2091 2 22 3.79086 22 6V14C22 16.2091 20.2091 18 18 18C18 20.2091 16.2091 22 14 22H6C3.79086 22 2 20.2091 2 18V10C2 7.79086 3.79086 6 6 6C6 3.79086 7.79086 2 10 2H18ZM6 8C4.89543 8 4 8.89543 4 10V18C4 19.1046 4.89543 20 6 20H14C15.1046 20 16 19.1046 16 18V10C16 8.89543 15.1046 8 14 8H6ZM10 4C8.89543 4 8 4.89543 8 6H14C16.2091 6 18 7.79086 18 10V16C19.1046 16 20 15.1046 20 14V6C20 4.89543 19.1046 4 18 4H10Z"
                  fill="currentColor"
                  fillOpacity="0.64"
                />
              </svg>
              <span>{t("dialog.mcp.add.menu.json")}</span>
            </button>
          </div>,
          document.body,
        )}
    </div>
  )
}
