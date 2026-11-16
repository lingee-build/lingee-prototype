import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { Button, ControlledConfirmDialog, DropdownMenu, Icon, IconButton, Input, showToast } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"

/**
 * 设置 → 工作树：照线上 kcode-web settings-worktree.tsx 的 SettingsWorktree 1:1 移植——
 * 「创建 / 自动清理 / 工作树列表」三段 SettingsList 卡片、行内状态徽标（干净/改动/未推送/
 * 外部/任务/检出中/检出失败）、项目手风琴（一次只展开一个）、超限横幅（清理 / 提高额度的双出口）、
 * 删除确认（inline 弹窗叠在设置面板之上，不 dispose 底层配置面板）。
 *
 * 线上依赖的 git worktree 接口（/experimental/worktree/detail、/cleanliness、DELETE）、
 * host 目录选择器、globalSync 配置读写全部 mock 化为组件内演示数据 + 本地 state + toast。
 */

type ListEntry = {
  directory: string
  name: string
  branch?: string
  sessionCount: number
  lastActivity?: number
  status: "ready" | "pending" | "failed"
  owned: boolean
  branchOwned: boolean
  /** product = 设置页/产品创建的 worktree；task = 任务编排器在 .lingee-task-worktrees 下物化的任务工作区。 */
  kind?: "product" | "task"
}

type Cleanliness = { directory: string; clean: boolean; changeCount: number }

type Probe = "unknown" | "checking" | Cleanliness

/** 线上后端 config.worktree 的演示形态 */
type WorktreeConfig = {
  branchPrefix?: string
  location?: string
  baseRef?: "fresh" | "head"
  maxCount?: number
  cleanupOnSessionDelete?: "clean" | "never"
}

const MAX_COUNT_OPTIONS = [5, 10, 15, 20, 0] as const
const DEFAULT_MAX_COUNT = 15

// 设计稿排版规格:
//   段标题(创建/自动清理/工作树列表):16px / 500 / neutral-700(black-82)。
//   行标题(存储位置/分支前缀/…):14px / 500 / neutral-800(black-94)。
const SECTION_TITLE = "text-[16px] leading-[24px] font-[500] text-[var(--neutral-700)]"
const ROW_TITLE = "text-[14px] leading-[22px] font-[500] text-[var(--neutral-800)]"
// 面板卡片:左右 20px 内边距,行与行之间 0.5px 的 black-8 分隔线。
// 竖直间距由每行自带 16px(py-4)提供 —— 分隔线正好落在行边界,首行顶、末行底同样是 16px。
const PANEL_CARD = "px-5 [&>*]:py-4"

// 状态徽标 / 「当前项目」共用的药丸样式:24px 高 / 1px 8px / 999px 圆角 / 12px 常规字。
const BADGE_CHIP =
  "inline-flex h-6 max-h-6 shrink-0 items-center justify-center whitespace-nowrap rounded-full px-2 py-px text-[12px] leading-[18px] font-[400]"

// 徽标配色（线上同款）:外部=靛蓝、干净=绿、改动/未推送=橙、失败=红、pending=中性灰、任务=紫。
const EXTERNAL = { background: "rgba(81, 85, 246, 0.08)", color: "var(--indigo-600)" }
const TASK = { background: "rgba(139, 92, 246, 0.08)", color: "var(--violet-600)" }
const CLEAN = { background: "rgba(8, 204, 80, 0.08)", color: "var(--success-600)" }
const NEUTRAL = { background: "rgba(107, 114, 128, 0.1)", color: "var(--neutral-600)" }
const WARNING = { background: "rgba(255, 119, 0, 0.08)", color: "var(--orange-600)" }
const DANGER = { background: "rgba(239, 68, 68, 0.1)", color: "var(--error-600, #DC2626)" }

// -------------------------------------------------------------------------
// mock 数据（原型无 git / host-bridge / 后端接口，全部用演示数据模拟）
// -------------------------------------------------------------------------

const PROJECT_ROOT = "/Users/kingdee/Documents/lingee-build"
const ERP_ROOT = "/Users/kingdee/Documents/cosmic-galaxy"

/** 线上 layout.projects.list() 的演示数据；project.name 为空时折叠头回退目录名（线上同规则） */
const MOCK_PROJECTS: Array<{ name?: string; worktree: string }> = [
  { worktree: PROJECT_ROOT },
  { name: "cosmic-galaxy", worktree: ERP_ROOT },
]

/** 线上取路由参数 decode64(params.dir) 反推「当前项目」；演示数据落在项目根内的一个 worktree 上 */
const MOCK_CURRENT_DIR = `${PROJECT_ROOT}/.lingeebuild/worktrees/fix-invoice-rounding`

/** 线上「自定义…」打开宿主目录选择器；原型无 host-bridge，固定返回这个演示目录 */
const DEMO_CUSTOM_LOCATION = "/Users/kingdee/LingeeWorktrees"

/** 线上 /experimental/worktree/detail 的演示数据：线上 badge 语义各占一行（含任务/外部/检出中） */
const initialEntries = (): Record<string, ListEntry[]> => ({
  [PROJECT_ROOT]: [
    {
      directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/fix-invoice-rounding`,
      name: "fix-invoice-rounding",
      branch: "lingeebuild/fix-invoice-rounding",
      sessionCount: 2,
      status: "ready",
      owned: true,
      branchOwned: true,
    },
    {
      directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/vendor-sync-api`,
      name: "vendor-sync-api",
      branch: "lingeebuild/vendor-sync-api",
      sessionCount: 0,
      status: "ready",
      owned: true,
      branchOwned: true,
    },
    {
      directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/glazing-cost-verify`,
      name: "glazing-cost-verify",
      branch: "lingeebuild/glazing-cost-verify",
      sessionCount: 0,
      status: "ready",
      owned: true,
      branchOwned: true,
    },
    {
      directory: `${PROJECT_ROOT}/.lingee-task-worktrees/task-2816-month-close`,
      name: "task-2816-month-close",
      branch: "lingeebuild/task-2816-month-close",
      sessionCount: 1,
      status: "ready",
      owned: true,
      branchOwned: true,
      kind: "task",
    },
    {
      directory: "/Users/kingdee/work/lingee-build-hotfix",
      name: "lingee-build-hotfix",
      branch: "hotfix/model-timeout",
      sessionCount: 0,
      status: "ready",
      owned: false,
      branchOwned: false,
    },
  ],
  [ERP_ROOT]: [
    {
      directory: `${ERP_ROOT}/.lingeebuild/worktrees/report-export`,
      name: "report-export",
      branch: "lingeebuild/report-export",
      sessionCount: 0,
      status: "pending",
      owned: true,
      branchOwned: true,
    },
  ],
})

/** 线上 POST /experimental/worktree/cleanliness 的演示结果（任务 worktree 不探测） */
const MOCK_PROBES: Record<string, Cleanliness> = {
  [`${PROJECT_ROOT}/.lingeebuild/worktrees/fix-invoice-rounding`]: {
    directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/fix-invoice-rounding`,
    clean: false,
    changeCount: 3,
  },
  [`${PROJECT_ROOT}/.lingeebuild/worktrees/vendor-sync-api`]: {
    directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/vendor-sync-api`,
    clean: false,
    changeCount: 0,
  },
  [`${PROJECT_ROOT}/.lingeebuild/worktrees/glazing-cost-verify`]: {
    directory: `${PROJECT_ROOT}/.lingeebuild/worktrees/glazing-cost-verify`,
    clean: true,
    changeCount: 0,
  },
}

/** 线上 getFilename：取路径最后一段（原型用 split 实现） */
const getFilename = (p: string) => p.split(/[\\/]/).filter(Boolean).pop() ?? p

// project.name 只有用户主动改过名字才有值,否则为空 —— 回退到目录名（线上同规则）。
const projectLabel = (project: { name?: string; worktree: string }) =>
  project.name || getFilename(project.worktree) || project.worktree

/** 线上 SettingsList（settings-list.tsx 同款）：rounded-[16px] 半透明底容器，class 覆盖内边距 */
function SettingsList(props: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("rounded-[16px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)]", !props.className && "px-2 py-1", props.className)}>
      {props.children}
    </div>
  )
}

interface SettingsRowProps {
  title: ReactNode
  description: ReactNode
  children: ReactNode
  /** 开启后:标题/描述单行超出显示省略号,并在原生 title 上展示完整文案(悬停可见)。 */
  truncate?: boolean
  /** 覆盖标题的排版类(字号/字重/颜色)。本页按设计稿传 500 字重 + neutral-800。 */
  titleClass?: string
}

/** 线上 SettingsRow（settings-general.tsx 同款）：左标题/描述 + 右侧控件 */
function SettingsRow(props: SettingsRowProps) {
  return (
    <div className="flex w-full flex-wrap items-center gap-4 px-1 py-1 sm:flex-nowrap">
      <div className="flex min-w-55 flex-1 flex-col gap-0.5">
        <span
          className={cx(props.titleClass ?? "text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]", props.truncate && "truncate")}
          title={props.truncate && typeof props.title === "string" ? props.title : undefined}
        >
          {props.title}
        </span>
        <span
          className={cx("text-[12px] leading-[18px] font-[400] text-[var(--neutral-500)]", props.truncate && "truncate")}
          title={props.truncate && typeof props.description === "string" ? props.description : undefined}
        >
          {props.description}
        </span>
      </div>
      <div className="flex w-full justify-end sm:w-auto sm:shrink-0">{props.children}</div>
    </div>
  )
}

/**
 * 线上 Select（variant=secondary / size=small / triggerVariant=boxed）的原型等价物：
 * DropdownMenu + 盒式触发器（半透明底、灰色选中勾），存储位置 / 最大数量 / 会话删除后清理共用同一套。
 * 触发器与选项挂 title：自定义路径较长时会被截断，悬停才能看全（沿用线上行为）。
 */
function BoxedSelect(props: {
  value: string
  options: Array<{ value: string; label: string }>
  onSelect: (value: string) => void
  dataAction?: string
  triggerMaxWidth?: string
  contentMaxWidth?: string
}) {
  const current = props.options.find((o) => o.value === props.value)
  return (
    <DropdownMenu placement="bottom-end" gutter={4}>
      <DropdownMenu.Trigger
        data-action={props.dataAction}
        className="flex h-[28px] cursor-pointer items-center gap-1.5 rounded-[8px] border-none bg-[color-mix(in_srgb,var(--neutral-600)_10%,transparent)] px-2 text-[12px] leading-[18px] font-[400] text-[var(--neutral-800)] transition-colors hover:bg-[color-mix(in_srgb,var(--neutral-600)_16%,transparent)]"
        style={{ maxWidth: props.triggerMaxWidth }}
        title={current?.label ?? ""}
      >
        <span className="min-w-0 truncate">{current?.label}</span>
        <Icon name="chevron-down-16" size="xs" className="shrink-0 text-[var(--neutral-500)]" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mt-1" style={{ maxWidth: props.contentMaxWidth }}>
          {props.options.map((o) => (
            <DropdownMenu.Item key={o.value} title={o.label} onSelect={() => props.onSelect(o.value)}>
              <DropdownMenu.ItemLabel>
                <span className="block truncate" title={o.label}>
                  {o.label}
                </span>
              </DropdownMenu.ItemLabel>
              {props.value === o.value && (
                <DropdownMenu.ItemIndicator>
                  <Icon name="check" size="xs" className="text-[var(--neutral-600)]" />
                </DropdownMenu.ItemIndicator>
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

export function SettingsWorktree(props: { hideHeader?: boolean }) {
  const t = useT()

  // -------------------------------------------------------------------------
  // 配置（线上 = 服务端 globalSync 配置 + 乐观覆盖 + 串行合并写；原型 = 本地 state）
  // -------------------------------------------------------------------------

  // maxCount 用 2 而非默认 15：让演示数据（3 个产品工作树）触发超限横幅，
  // 完整展示「清理干净项 / 提高上限」两个出口；随点随改，与线上一致。
  const [config, setConfig] = useState<WorktreeConfig>({
    branchPrefix: "lingeebuild",
    location: undefined,
    maxCount: 2,
    cleanupOnSessionDelete: "clean",
  })
  const updateWorktree = (patch: Partial<WorktreeConfig>) => setConfig((prev) => ({ ...prev, ...patch }))

  const PROJECT = "project"
  const rawLocation = config.location ?? PROJECT
  const isCustomPath = rawLocation !== PROJECT
  // 「自定义…」是个动作项(哨兵值),选中它不落库,而是打开目录选择器。
  const CUSTOM_LOCATION = "__worktree_custom_location__"
  const locationOptions: Array<{ value: string; label: string }> = [{ value: PROJECT, label: t("settings.worktree.location.project") }]
  if (isCustomPath) locationOptions.push({ value: rawLocation, label: rawLocation })
  locationOptions.push({ value: CUSTOM_LOCATION, label: t("settings.worktree.location.custom") })

  const onSelectLocation = (value: string) => {
    if (value === CUSTOM_LOCATION) return void pickCustomLocation()
    if (value === PROJECT) {
      // 已经是 project 就不再写（线上防 onSelect 死循环的同款短路）。
      if (!isCustomPath) return
      return void updateWorktree({ location: undefined })
    }
    // 选中的是当前已生效的自定义路径,无需改动。
  }

  /** 线上打开宿主目录选择器（platform.openDirectoryPickerDialog）；原型固定返回演示目录 */
  const pickCustomLocation = () => void updateWorktree({ location: DEMO_CUSTOM_LOCATION })

  const [prefixInput, setPrefixInput] = useState(config.branchPrefix ?? "")

  const commitPrefix = () => {
    const next = prefixInput.trim()
    // 线上写配置会 dispose 实例中断会话，值没变就绝不写；原型保留同款判断。
    if (next === (config.branchPrefix ?? "")) return
    void updateWorktree({ branchPrefix: next || undefined })
  }

  const maxCount = () => {
    const v = config.maxCount
    return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : DEFAULT_MAX_COUNT
  }
  const commitMaxCount = (next: number) => {
    if (next === maxCount()) return // 同上:避免空写打断会话
    void updateWorktree({ maxCount: next })
  }

  const maxCountOptions = MAX_COUNT_OPTIONS.map((n) => ({
    value: String(n),
    label: n === 0 ? t("settings.worktree.maxCount.unlimited") : String(n),
  }))
  const cleanupOptions = [
    { value: "clean" as const, label: t("settings.worktree.cleanupOnDelete.clean") },
    { value: "never" as const, label: t("settings.worktree.cleanupOnDelete.never") },
  ]

  const cleanupMode = () => config.cleanupOnSessionDelete ?? "clean"
  const commitCleanupMode = (next: "clean" | "never") => {
    if (next === cleanupMode()) return
    void updateWorktree({ cleanupOnSessionDelete: next })
  }

  // -------------------------------------------------------------------------
  // 列表数据（mock）
  // -------------------------------------------------------------------------

  const [entries, setEntries] = useState<Record<string, ListEntry[]>>(initialEntries)
  const [probes, setProbes] = useState<Record<string, Probe>>(() => ({ ...MOCK_PROBES }))
  const [loading, setLoading] = useState(false)
  const [failed] = useState(false)
  // 单值 state（不是 Set）：结构上保证一次只展开一个项目（线上同款手风琴）。
  const [expanded, setExpanded] = useState<string | undefined>(() => currentRootOf(initialEntries()))
  // 删除确认目标：inline 受控弹窗叠在底层面板之上（线上用本地 Kobalte 弹窗的同款理由）。
  const [deleteTarget, setDeleteTarget] = useState<{ root: string; row: ListEntry } | null>(null)

  // 线上 currentRoot：路径前缀匹配 + 外部 worktree 反查。演示数据命中前缀分支。
  function currentRootOf(es: Record<string, ListEntry[]>): string | undefined {
    const byPrefix = MOCK_PROJECTS.filter((p) => MOCK_CURRENT_DIR === p.worktree || MOCK_CURRENT_DIR.startsWith(`${p.worktree}/`))
      .sort((a, b) => b.worktree.length - a.worktree.length)[0]
    if (byPrefix) return byPrefix.worktree
    for (const p of MOCK_PROJECTS) {
      if ((es[p.worktree] ?? []).some((r) => r.directory === MOCK_CURRENT_DIR)) return p.worktree
    }
    return undefined
  }
  const currentRoot = useMemo(() => currentRootOf(entries), [entries])

  // 最新值引用：延时回调（模拟探测往返）里读列表/探测结果，避免闭包读到旧值。
  const entriesRef = useRef(entries)
  const probesRef = useRef(probes)
  useEffect(() => {
    entriesRef.current = entries
    probesRef.current = probes
  })

  /** 只探测某一个项目的 worktree —— 由手风琴展开触发（线上同语义：折叠的项目一个 git 都不跑）。
   *  任务 worktree 不参与探测：徽标由 kind=task 单独渲染。原型用 500ms 延时模拟 POST /cleanliness。 */
  const probeProject = (root: string) => {
    const targets = (entriesRef.current[root] ?? []).filter((r) => r.kind !== "task" && probesRef.current[r.directory] === undefined)
    if (targets.length === 0) return
    setProbes((prev) => {
      const next = { ...prev }
      for (const r of targets) next[r.directory] = "checking"
      return next
    })
    window.setTimeout(() => {
      setProbes((prev) => {
        const next = { ...prev }
        for (const r of targets) next[r.directory] = MOCK_PROBES[r.directory] ?? "unknown"
        return next
      })
    }, 500)
  }

  const toggle = (root: string) => {
    const next = expanded === root ? undefined : root
    setExpanded(next)
    if (next) probeProject(next)
  }

  /** 刷新：线上 reconcile({}) 清探测 + 重拉 detail；原型 = 转圈 600ms + 重走一遍 checking → 结果 */
  const refresh = () => {
    if (loading) return
    setLoading(true)
    window.setTimeout(() => {
      setProbes({})
      setLoading(false)
      if (expanded) window.setTimeout(() => probeProject(expanded), 0)
    }, 600)
  }

  // -------------------------------------------------------------------------
  // 派生
  // -------------------------------------------------------------------------

  const ownedRows = (root: string) => (entries[root] ?? []).filter((r) => r.owned && r.kind !== "task")
  const overLimit = (root: string) => maxCount() > 0 && ownedRows(root).length > maxCount()
  // 折叠头计数展示列表总行数(含任务工作区)；overLimit / cleanableRows 仍只按产品条目算（线上同口径）。
  const rowCount = (root: string) => (entries[root] ?? []).length
  const taskCount = (root: string) => (entries[root] ?? []).filter((r) => r.kind === "task").length

  /** 「清理干净项」会真正删掉的条数（干净 + 无会话 + 我方创建 + ready；任务工作区一票排除）。 */
  const cleanableRows = (root: string) =>
    (entries[root] ?? []).filter((r) => {
      if (r.kind === "task" || !r.owned || r.status !== "ready" || r.sessionCount > 0) return false
      const p = probes[r.directory]
      return typeof p === "object" && p.clean
    })

  // 超限横幅的第二个出口：把上限提到刚好容纳现有数量的档位（超过最大档位 20 时取消限制）。
  const raisedLimit = (root: string) => MAX_COUNT_OPTIONS.find((n) => n > 0 && n >= ownedRows(root).length) ?? 0
  const raiseLimit = (root: string) => {
    const next = raisedLimit(root)
    if (next === maxCount()) return
    commitMaxCount(next)
  }

  // -------------------------------------------------------------------------
  // 删除（线上 = dispose + DELETE /worktree + 会话重挂；原型 = 本地 state + toast）
  // -------------------------------------------------------------------------

  const removeWorktree = (root: string, row: ListEntry) => {
    setEntries((prev) => ({ ...prev, [root]: (prev[root] ?? []).filter((r) => r.directory !== row.directory) }))
    setProbes((prev) => {
      const next = { ...prev }
      delete next[row.directory]
      return next
    })
  }

  const confirmDelete = (root: string, row: ListEntry) => setDeleteTarget({ root, row })

  // 确认框展示数据：脏/干净、changeCount、逐条描述（线上 deleteInfo 同款派生）。
  const deleteInfo = useMemo(() => {
    if (!deleteTarget) return null
    const { root, row } = deleteTarget
    const p = probes[row.directory]
    // 探测不出来也按脏处理（fail-closed）；任务 worktree 恒按「归档后删除」走。
    const task = row.kind === "task"
    const dirty = task || (typeof p === "object" ? !p.clean : true)
    const changeCount = typeof p === "object" ? p.changeCount : 0
    // 逐条拼描述:把「会丢什么」说全,别让用户靠猜。
    const lines = [row.name]
    if (task) {
      lines.push(t("settings.worktree.delete.task"))
    } else if (dirty) {
      lines.push(changeCount > 0 ? t("settings.worktree.delete.dirty", { count: String(changeCount) }) : t("settings.worktree.delete.unknown"))
    }
    if (row.sessionCount > 0) {
      lines.push(t("settings.worktree.delete.sessions", { count: String(row.sessionCount) }))
    }
    if (row.branch && !row.branchOwned) {
      // 分支不是我们建的就会保留 —— 说清楚，免得用户以为分支也一起没了。
      lines.push(t("settings.worktree.delete.branchKept", { branch: row.branch }))
    }
    return { root, row, dirty, description: lines.join("\n") }
  }, [deleteTarget, probes, t])

  // 滚动容器 ref：线上的逐帧钉滚动防的是批量删除的多次 await 中间帧；原型清理是一次同步提交，无此问题。
  const scrollEl = useRef<HTMLDivElement>(null)

  const cleanupClean = (root: string) => {
    const rows = cleanableRows(root)
    if (rows.length === 0) return
    setEntries((prev) => ({ ...prev, [root]: (prev[root] ?? []).filter((r) => !rows.some((c) => c.directory === r.directory)) }))
    showToast({ title: t("settings.worktree.cleanup.done", { count: String(rows.length) }) })
  }

  // -------------------------------------------------------------------------
  // 渲染
  // -------------------------------------------------------------------------

  /** 状态徽标。外部 worktree 只标「外部」；任务 worktree 单独标「任务」；均不显示脏/干净（线上同规则）。 */
  const StatusBadge = (p: { row: ListEntry }) => {
    const probe = probes[p.row.directory]
    if (p.row.kind === "task") {
      return (
        <span className={BADGE_CHIP} style={TASK} title={t("settings.worktree.badge.taskHint")}>
          {t("settings.worktree.badge.task")}
        </span>
      )
    }
    if (p.row.status !== "ready") {
      return (
        <span className={BADGE_CHIP} style={p.row.status === "failed" ? DANGER : NEUTRAL}>
          {p.row.status === "failed" ? t("settings.worktree.badge.failed") : t("settings.worktree.badge.pending")}
        </span>
      )
    }
    if (!p.row.owned) {
      return (
        <span className={BADGE_CHIP} style={EXTERNAL} title={t("settings.worktree.badge.externalHint")}>
          {t("settings.worktree.badge.external")}
        </span>
      )
    }
    if (typeof probe !== "object") {
      return (
        <span className="shrink-0 whitespace-nowrap px-1.5 text-[12px] leading-[18px] text-[var(--neutral-500)]">
          {probe === "checking" ? t("settings.worktree.badge.checking") : t("settings.worktree.badge.unknown")}
        </span>
      )
    }
    if (probe.clean) {
      return (
        <span className={BADGE_CHIP} style={CLEAN}>
          {t("settings.worktree.badge.clean")}
        </span>
      )
    }
    // clean=false 有两种成因:有未提交改动,或有未推送提交;changeCount=0 时是后者。
    return (
      <span className={BADGE_CHIP} style={WARNING}>
        {probe.changeCount > 0
          ? t("settings.worktree.badge.changes", { count: String(probe.changeCount) })
          : t("settings.worktree.badge.unpushed")}
      </span>
    )
  }

  const ProjectRows = (p: { root: string }) => {
    const rows = entries[p.root] ?? []
    if (rows.length === 0) {
      return <div className="px-1 py-3 text-center text-[12px] text-[var(--neutral-400)]">{t("settings.worktree.empty")}</div>
    }
    return (
      <>
        {rows.map((row) => (
          // 行级 flex + items-center:删除图标相对「名字行 + 分支/会话行」整体垂直居中。
          <div key={row.directory} className="flex items-center gap-3 px-1 py-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {/* 名字 min-w-0 + truncate 负责截断(完整路径挂 title),徽标 shrink-0 不参与压缩。 */}
                <span
                  className={cx(
                    "min-w-0 truncate text-[14px] leading-[22px] font-[400] text-[var(--neutral-800)]",
                    !row.owned && "text-[var(--neutral-400)]",
                  )}
                  title={row.directory}
                >
                  {row.name}
                </span>
                <StatusBadge row={row} />
              </div>
              <div className="flex items-center gap-2 text-[12px] leading-[18px] text-[var(--neutral-500)]">
                {row.branch && (
                  <span className="min-w-0 truncate" title={row.branch}>
                    {row.branch}
                  </span>
                )}
                <span className="shrink-0 whitespace-nowrap">
                  {row.sessionCount > 0
                    ? t("settings.worktree.sessions", { count: String(row.sessionCount) })
                    : t("settings.worktree.noSessions")}
                </span>
              </div>
            </div>
            {/* 与「记忆」面板一致的删除图标:neutral-400 常态 + hover 转深。外部项与任务工作区禁用并降透明度。 */}
            <IconButton
              data-action="settings-worktree-delete"
              icon="delete"
              variant="ghost"
              iconSize="small"
              className={cx(
                "h-7 w-7 shrink-0",
                row.owned && row.kind !== "task" && "text-[var(--neutral-400)] hover:bg-[var(--neutral-100)] hover:text-[var(--neutral-600)]",
                (!row.owned || row.kind === "task") && "cursor-not-allowed text-[var(--neutral-400)] opacity-50",
              )}
              disabled={!row.owned || row.kind === "task"}
              title={
                row.kind === "task"
                  ? t("settings.worktree.delete.taskDisabled")
                  : row.owned
                    ? t("common.delete")
                    : t("settings.worktree.badge.externalHint")
              }
              onClick={() => confirmDelete(p.root, row)}
              aria-label={t("common.delete")}
            />
          </div>
        ))}
      </>
    )
  }

  return (
    // 与「记忆」等页签一致:外层 px-5 py-4 给左右间距,标题固定在滚动区之外。
    <div className="relative flex h-full flex-col px-5 py-4" style={{ background: "var(--color-background-page)" }}>
      {!props.hideHeader && (
        <div>
          <div className="flex flex-col gap-1 pb-5">
            <h2 className="text-[20px] leading-[30px] font-[600] text-[var(--neutral-700)]">{t("settings.worktree.title")}</h2>
            <span className="text-[12px] leading-[18px] text-[var(--neutral-500)]">{t("settings.worktree.description")}</span>
          </div>
        </div>
      )}

      <div ref={scrollEl} className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex w-full flex-col gap-5">
          {/* 创建 */}
          <div className="flex flex-col gap-1">
            <h3 className={`pb-2 ${SECTION_TITLE}`}>{t("settings.worktree.section.create")}</h3>
            <SettingsList className={PANEL_CARD}>
              <SettingsRow
                truncate
                titleClass={ROW_TITLE}
                title={t("settings.worktree.location.title")}
                description={t("settings.worktree.location.description")}
              >
                <BoxedSelect
                  dataAction="settings-worktree-location"
                  value={isCustomPath ? rawLocation : PROJECT}
                  options={locationOptions}
                  onSelect={onSelectLocation}
                  triggerMaxWidth="220px"
                  contentMaxWidth="min(360px, 80vw)"
                />
              </SettingsRow>
              <SettingsRow
                truncate
                titleClass={ROW_TITLE}
                title={t("settings.worktree.branchPrefix.title")}
                description={t("settings.worktree.branchPrefix.description")}
              >
                {/* 设计稿:输入框宽 194 / 高 28px；聚焦态 gray-blue-1000 边框且无聚焦光环
                    （选择器按原型 Input 的 data-slot=form-input-wrapper 落点）。 */}
                <div
                  className="w-full sm:w-[194px] sm:max-w-[194px] [&_[data-slot=form-input-wrapper]:not(:focus-within)]:!border-[var(--neutral-200)] [&_[data-slot=form-input-wrapper]:focus-within]:!border-[var(--gray-blue-1000)] [&_[data-slot=form-input-wrapper]:focus-within]:!shadow-none"
                  data-action="settings-worktree-branch-prefix"
                  onBlur={commitPrefix}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault()
                      ;(e.target as HTMLInputElement | null)?.blur()
                    }
                  }}
                >
                  <Input
                    ariaLabel={t("settings.worktree.branchPrefix.title")}
                    type="text"
                    value={prefixInput}
                    onChange={setPrefixInput}
                    placeholder="lingeebuild"
                    autoComplete="off"
                    className="text-12-regular !h-[28px]"
                  />
                </div>
              </SettingsRow>
            </SettingsList>
          </div>

          {/* 自动清理 */}
          <div className="flex flex-col gap-1">
            <h3 className={`pb-2 ${SECTION_TITLE}`}>{t("settings.worktree.section.cleanup")}</h3>
            <SettingsList className={PANEL_CARD}>
              <SettingsRow titleClass={ROW_TITLE} title={t("settings.worktree.maxCount.title")} description={t("settings.worktree.maxCount.description")}>
                <BoxedSelect
                  dataAction="settings-worktree-max-count"
                  value={String(maxCount())}
                  options={maxCountOptions}
                  onSelect={(v) => commitMaxCount(Number(v))}
                />
              </SettingsRow>
              <SettingsRow
                titleClass={ROW_TITLE}
                title={t("settings.worktree.cleanupOnDelete.title")}
                description={
                  cleanupMode() === "never" ? (
                    t("settings.worktree.cleanupOnDelete.descriptionNever")
                  ) : (
                    <>
                      {t("settings.worktree.cleanupOnDelete.description")}
                      <br />
                      {t("settings.worktree.noRemoteHint")}
                    </>
                  )
                }
              >
                <BoxedSelect
                  dataAction="settings-worktree-cleanup-mode"
                  value={cleanupMode()}
                  options={cleanupOptions}
                  onSelect={(v) => commitCleanupMode(v as "clean" | "never")}
                />
              </SettingsRow>
            </SettingsList>
          </div>

          {/* 列表 */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between pb-2">
              <h3 className={SECTION_TITLE}>{t("settings.worktree.section.list")}</h3>
              <IconButton
                tabIndex={-1}
                data-action="settings-worktree-refresh"
                icon="refresh"
                variant="ghost"
                iconSize="small"
                className={cx("h-7 w-7", loading && "animate-spin")}
                disabled={loading}
                onClick={refresh}
                aria-label={t("settings.worktree.refresh")}
              />
            </div>

            {failed && (
              <div className="mb-1 rounded-[8px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-3 py-2 text-[12px] leading-[18px] text-[var(--neutral-600)]">
                {t("settings.worktree.loadFailed")}
              </div>
            )}

            {/* 列表卡:左右 20px 内边距,不加上下内边距(项目行自带 py-4)。 */}
            <SettingsList className="px-5">
              {MOCK_PROJECTS.map((project) => {
                const root = project.worktree
                const isOpen = expanded === root
                return (
                  <div key={root}>
                    <button
                      type="button"
                      data-action="settings-worktree-project-toggle"
                      className="flex w-full cursor-pointer items-center gap-2 py-4 text-left"
                      onClick={() => toggle(root)}
                      title={root}
                    >
                      {/* 与「记忆」面板一致的展开/收起图标 + 90° 旋转动画。 */}
                      <Icon
                        name="tool-arrow-right"
                        size="small"
                        className={cx("shrink-0 text-[var(--neutral-500)] transition-transform duration-150", isOpen ? "rotate-90" : "rotate-0")}
                      />
                      {/* 项目名可能很长,允许截断,别把计数挤掉。 */}
                      <span className="min-w-0 truncate text-[14px] leading-[22px] font-[400] text-[var(--neutral-800)]">{projectLabel(project)}</span>
                      {currentRoot === root && (
                        <span className={BADGE_CHIP} style={{ background: "rgba(41, 112, 255, 0.1)", color: "var(--brand-base, #2970FF)" }}>
                          {t("settings.worktree.badge.current")}
                        </span>
                      )}
                      {/* whitespace-nowrap:否则「0 / 15」会在窄容器里折成两行。 */}
                      <span
                        className={cx(
                          "ml-auto shrink-0 whitespace-nowrap px-2 text-[12px] leading-[18px] tabular-nums",
                          overLimit(root) ? "text-[var(--text-danger)]" : "text-[var(--neutral-600)]",
                        )}
                        title={taskCount(root) > 0 ? t("settings.worktree.count.taskHint", { count: String(taskCount(root)) }) : undefined}
                      >
                        {maxCount() > 0 ? `${rowCount(root)} / ${maxCount()}` : String(rowCount(root))}
                      </span>
                    </button>

                    {/* 展开容器左缩进,让 worktree 子项名和项目名对齐(线上同款 20+4=24px 对齐)。 */}
                    {isOpen && (
                      <div className="flex flex-col gap-1 pb-2 pl-5">
                        {/* 超限提醒。软限制:只提醒,不自动删;「清理」之外的恒有「调整上限」出口。 */}
                        {overLimit(root) && (
                          <div className="mx-1 flex items-center justify-between gap-3 rounded-[8px] px-3 py-2" style={{ background: "rgba(245, 158, 11, 0.12)" }}>
                            <div className="flex min-w-0 flex-col gap-0.5">
                              <span className="text-[12px] leading-[18px] font-[500]" style={{ color: "var(--warning-700, #B45309)" }}>
                                {t("settings.worktree.overLimit", {
                                  count: String(ownedRows(root).length),
                                  max: String(maxCount()),
                                })}
                              </span>
                              <span className="text-[12px] leading-[18px] text-[var(--neutral-500)]">
                                {cleanableRows(root).length > 0
                                  ? t("settings.worktree.overLimit.cleanable", {
                                      cleanable: String(cleanableRows(root).length),
                                    })
                                  : t("settings.worktree.overLimit.none")}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-3">
                              {cleanableRows(root).length > 0 && (
                                <Button
                                  size="small"
                                  variant="ghost"
                                  data-action="settings-worktree-cleanup-clean"
                                  className="h-auto shrink-0 border-none bg-transparent px-1 py-0 text-[12px] leading-[18px] font-[500] whitespace-nowrap text-[var(--primary-600)] hover:bg-transparent hover:text-[var(--primary-500)] active:text-[var(--primary-700)]"
                                  onClick={(e) => {
                                    // 先移开焦点:按钮马上会随横幅从 DOM 移除,焦点回落会带着页面跳。
                                    e.currentTarget.blur()
                                    cleanupClean(root)
                                  }}
                                >
                                  {t("settings.worktree.cleanup.action")}
                                </Button>
                              )}
                              <Button
                                size="small"
                                variant="ghost"
                                data-action="settings-worktree-overlimit-raise"
                                className="h-auto shrink-0 border-none bg-transparent px-1 py-0 text-[12px] leading-[18px] font-[500] whitespace-nowrap text-[var(--primary-600)] hover:bg-transparent hover:text-[var(--primary-500)] active:text-[var(--primary-700)]"
                                onClick={(e) => {
                                  // 先移开焦点:横幅会随设置生效立即从 DOM 移除。
                                  e.currentTarget.blur()
                                  raiseLimit(root)
                                }}
                              >
                                {raisedLimit(root) === 0
                                  ? t("settings.worktree.overLimit.raiseUnlimited")
                                  : t("settings.worktree.overLimit.raiseTo", {
                                      limit: String(raisedLimit(root)),
                                    })}
                              </Button>
                            </div>
                          </div>
                        )}
                        <ProjectRows root={root} />
                      </div>
                    )}
                  </div>
                )
              })}
            </SettingsList>
          </div>
        </div>
      </div>

      {/* 删除确认弹窗:线上 inline 独立弹窗叠在「设置」弹窗之上;原型用 ControlledConfirmDialog 同构实现。 */}
      <ControlledConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("settings.worktree.delete.title")}
        description={deleteInfo?.description ?? ""}
        cancelText={t("common.cancel")}
        confirmText={deleteInfo?.dirty ? t("settings.worktree.delete.archiveAndDelete") : t("common.delete")}
        variant="danger"
        onConfirm={() => {
          if (!deleteInfo) return
          // 线上:脏的/任务的传 force + archiveDirty 先归档再删;干净的走默认路径。原型统一本地删除。
          removeWorktree(deleteInfo.root, deleteInfo.row)
        }}
      />
    </div>
  )
}

export default SettingsWorktree
