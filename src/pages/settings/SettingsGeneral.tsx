import { useState, type CSSProperties, type ReactNode } from "react"
import { DropdownMenu, Icon, Input, Switch, showToast } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"

/**
 * 设置 → 通用 页签。按线上 kcode-web src/components/settings-general.tsx 1:1 移植：
 * 结构、类名、文案 key 与线上一致（class→className、Show→条件渲染、For→map）。
 * 线上依赖 host-bridge / globalSync / platform / settings store / 音效资源的数据与动作全部 mock：
 * 配置写入只改本地 state；「检查更新」用 setTimeout + showToast 模拟；演示音效播放无资源、省略。
 */

// ---- mock：线上来自 vite 注入的构建时间与 platform 上下文 ----
const BUILD_TIME_ISO = "2026-11-16T08:00:00.000Z"
const BUILD_TIME_COMPACT = "20261116160000"
const PLATFORM = { platform: "web", version: "1.4.2", checkUpdate: true }

// ---- mock：线上来自 language 上下文的界面语言清单（zh.ts 的 language.* 文案）----
const LOCALES = ["en", "zh", "zht", "ko", "de", "es", "fr", "da", "ja", "pl", "ru", "bs", "ar", "no", "br", "th", "tr"] as const
/** 线上 utils/accept-language.ts 的 Locale → BCP 47 映射（只取主标签） */
const LOCALE_TO_ACCEPT_LANGUAGE: Record<(typeof LOCALES)[number], string> = {
  en: "en-US",
  zh: "zh-CN",
  zht: "zh-TW",
  ko: "ko-KR",
  de: "de-DE",
  es: "es-ES",
  fr: "fr-FR",
  da: "da-DK",
  ja: "ja-JP",
  pl: "pl-PL",
  ru: "ru-RU",
  bs: "bs-BA",
  ar: "ar-SA",
  no: "nb-NO",
  br: "pt-BR",
  th: "th-TH",
  tr: "tr-TR",
}

/** 线上 utils/sound.ts 的 SOUND_OPTIONS（原型无音频资源，仅保清单与文案） */
const SOUND_OPTIONS = [
  { id: "alert-01", label: "sound.option.alert01" },
  { id: "alert-02", label: "sound.option.alert02" },
  { id: "alert-03", label: "sound.option.alert03" },
  { id: "alert-04", label: "sound.option.alert04" },
  { id: "alert-05", label: "sound.option.alert05" },
  { id: "alert-06", label: "sound.option.alert06" },
  { id: "alert-07", label: "sound.option.alert07" },
  { id: "alert-08", label: "sound.option.alert08" },
  { id: "alert-09", label: "sound.option.alert09" },
  { id: "alert-10", label: "sound.option.alert10" },
  { id: "bip-bop-01", label: "sound.option.bipbop01" },
  { id: "bip-bop-02", label: "sound.option.bipbop02" },
  { id: "bip-bop-03", label: "sound.option.bipbop03" },
  { id: "bip-bop-04", label: "sound.option.bipbop04" },
  { id: "bip-bop-05", label: "sound.option.bipbop05" },
  { id: "bip-bop-06", label: "sound.option.bipbop06" },
  { id: "bip-bop-07", label: "sound.option.bipbop07" },
  { id: "bip-bop-08", label: "sound.option.bipbop08" },
  { id: "bip-bop-09", label: "sound.option.bipbop09" },
  { id: "bip-bop-10", label: "sound.option.bipbop10" },
  { id: "staplebops-01", label: "sound.option.staplebops01" },
  { id: "staplebops-02", label: "sound.option.staplebops02" },
  { id: "staplebops-03", label: "sound.option.staplebops03" },
  { id: "staplebops-04", label: "sound.option.staplebops04" },
  { id: "staplebops-05", label: "sound.option.staplebops05" },
  { id: "staplebops-06", label: "sound.option.staplebops06" },
  { id: "staplebops-07", label: "sound.option.staplebops07" },
  { id: "nope-01", label: "sound.option.nope01" },
  { id: "nope-02", label: "sound.option.nope02" },
  { id: "nope-03", label: "sound.option.nope03" },
  { id: "nope-04", label: "sound.option.nope04" },
  { id: "nope-05", label: "sound.option.nope05" },
  { id: "nope-06", label: "sound.option.nope06" },
  { id: "nope-07", label: "sound.option.nope07" },
  { id: "nope-08", label: "sound.option.nope08" },
  { id: "nope-09", label: "sound.option.nope09" },
  { id: "nope-10", label: "sound.option.nope10" },
  { id: "nope-11", label: "sound.option.nope11" },
  { id: "nope-12", label: "sound.option.nope12" },
  { id: "yup-01", label: "sound.option.yup01" },
  { id: "yup-02", label: "sound.option.yup02" },
  { id: "yup-03", label: "sound.option.yup03" },
  { id: "yup-04", label: "sound.option.yup04" },
  { id: "yup-05", label: "sound.option.yup05" },
  { id: "yup-06", label: "sound.option.yup06" },
] as const

/** mock：线上 getLingeeBridge()?.getConfig()?.auth?.knowledgeEnabled */
const KNOWLEDGE_ENABLED = true

/** mock：线上 theme.loadThemes() 拉到的主题清单（主题切换行线上已禁用，仅保留结构） */
const THEME_OPTIONS = [
  { id: "nova", name: "Nova" },
  { id: "ember", name: "Ember" },
]

/** mock：线上 context/settings 的默认值（kcode-web src/context/settings.tsx defaultSettings） */
interface MockSettings {
  general: {
    shellToolPartsExpanded: boolean
    editToolPartsExpanded: boolean
    showSessionDiffs: boolean
    showTerminalIcon: boolean
    showReviewIcon: boolean
    auditEnabled: boolean
    releaseNotes: boolean
  }
  appearance: { uiFont: string; font: string }
  notifications: { agent: boolean; permissions: boolean; errors: boolean }
  sounds: { agentEnabled: boolean; agent: string; permissionsEnabled: boolean; permissions: string; errorsEnabled: boolean; errors: string }
  updates: { startup: boolean }
}

const INITIAL_SETTINGS: MockSettings = {
  general: {
    shellToolPartsExpanded: false,
    editToolPartsExpanded: false,
    showSessionDiffs: true,
    showTerminalIcon: false,
    showReviewIcon: true,
    auditEnabled: true,
    releaseNotes: true,
  },
  appearance: { uiFont: "", font: "" },
  notifications: { agent: true, permissions: true, errors: false },
  sounds: { agentEnabled: true, agent: "staplebops-01", permissionsEnabled: true, permissions: "staplebops-02", errorsEnabled: true, errors: "nope-03" },
  updates: { startup: true },
}

/** 线上 context/settings.tsx 的字体默认值（placeholder 用） */
const sansDefault = "System Sans"
const monoDefault = "System Mono"

/** mock：线上 globalSync.data.config（云端同步的实例配置） */
interface MockExperimental {
  goal_max_rounds?: number
  goal_max_tokens?: number
  goal_max_duration_ms?: number
  plan_mode?: boolean
  mcp_apps?: boolean
}
interface MockConfig {
  context_optimization?: { enabled?: boolean }
  watchdog?: { idle_ms?: number }
  experimental?: MockExperimental
  knowledge?: { builtin_enabled?: boolean; auto_query_lingee?: boolean }
}
const INITIAL_CONFIG: MockConfig = {
  context_optimization: { enabled: true },
  watchdog: { idle_ms: 600_000 },
  experimental: { goal_max_rounds: 12, mcp_apps: true, plan_mode: true },
  knowledge: { builtin_enabled: true },
}

/** mock：线上 permission 上下文判定的当前目录自动接受状态 */
const DIR = "/Users/kingdee/Downloads/demo-project"

interface SelectOption {
  value: string
  label: string
}

/**
 * 线上 @kcode/ui Select 的原型替身：DropdownMenu + 触发按钮。
 * triggerVariant="settings"（透明无边框、右对齐、min-w 160）与 "boxed"（3% 黑底、8px 圆角、28px 高）
 * 两种触发器样式分别照抄 select.css 的 [data-trigger-style] 规则。
 */
function Select(props: {
  options: SelectOption[]
  current: string
  onSelect: (option: SelectOption) => void
  dataAction?: string
  iconClass?: string
  triggerVariant?: "settings" | "boxed"
  triggerStyle?: CSSProperties
}) {
  const current = props.options.find((o) => o.value === props.current)
  return (
    <DropdownMenu>
      <DropdownMenu.Trigger
        data-action={props.dataAction}
        className={cx(
          props.triggerVariant === "boxed"
            ? // 设计稿要求音效下拉框是「有边界的控件」：3% 黑底 + 8px 圆角 + 28px 高
              "flex h-[28px] w-full cursor-pointer items-center gap-[8px] rounded-[8px] border-none bg-[color-mix(in_srgb,black_3%,transparent)] px-2 transition-colors hover:bg-[color-mix(in_srgb,black_6%,transparent)]"
            : // settings 风格：全透明无边框，右端带底色小箭头（select.css [data-trigger-style="settings"]）
              "flex h-[32px] min-w-[160px] cursor-pointer items-center justify-end gap-[12px] rounded-[6px] border-none bg-transparent px-[6px] py-[6px] transition-colors hover:bg-[var(--input-base)]",
        )}
        style={props.triggerStyle}
      >
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-normal leading-[18px] text-[var(--neutral-700)]">
          {current?.label}
        </span>
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] bg-[var(--neutral-100,rgba(0,0,0,0.05))]">
          <Icon name="chevron-down-16" size="xs" className={props.iconClass ?? "text-[var(--neutral-500)]"} />
        </span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="mt-1" style={{ minWidth: 200 }}>
          {props.options.map((option) => (
            <DropdownMenu.Item key={option.value} onClick={() => props.onSelect(option)}>
              <DropdownMenu.ItemLabel>{option.label}</DropdownMenu.ItemLabel>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu>
  )
}

/** SettingsList：半透明白底圆角容器（线上 settings-list.tsx 同款类名） */
function SettingsList(props: { children: ReactNode }) {
  return <div className="rounded-[16px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-2 py-1">{props.children}</div>
}

export function SettingsGeneral(props: { hideHeader?: boolean }) {
  const t = useT()

  // ---- mock：语言 / 主题上下文 ----
  const [locale, setLocale] = useState<(typeof LOCALES)[number]>("zh")
  const [userLocalePreference, setUserLocalePreference] = useState("")
  const [colorScheme, setColorScheme] = useState<"system" | "light" | "dark">("system")
  const [themeId, setThemeId] = useState("nova")
  const [accepting, setAccepting] = useState(false)

  // ---- mock：settings store + globalSync 配置（写入只改本地 state） ----
  const [settings, setSettings] = useState(INITIAL_SETTINGS)
  const [config, setConfig] = useState(INITIAL_CONFIG)
  const [checking, setChecking] = useState(false)
  const [savingMcpApps, setSavingMcpApps] = useState(false)
  const [atBottom, setAtBottom] = useState(true)

  const setGeneral = (patch: Partial<MockSettings["general"]>) => setSettings((p) => ({ ...p, general: { ...p.general, ...patch } }))
  const setSounds = (patch: Partial<MockSettings["sounds"]>) => setSettings((p) => ({ ...p, sounds: { ...p.sounds, ...patch } }))
  const setNotifications = (patch: Partial<MockSettings["notifications"]>) =>
    setSettings((p) => ({ ...p, notifications: { ...p.notifications, ...patch } }))

  const contextOptimizationEnabled = config.context_optimization?.enabled !== false
  const setContextOptimizationEnabled = (enabled: boolean) =>
    setConfig((p) => ({ ...p, context_optimization: { ...p.context_optimization, enabled } }))

  // ---- watchdog idle（无活动自动结束的秒数） ----
  const WATCHDOG_IDLE_DEFAULT_SEC = 600
  const WATCHDOG_IDLE_MIN_SEC = 1
  const WATCHDOG_IDLE_MAX_SEC = 86400 // 24 小时上限，避免误填超大值导致后端校验失败
  const clampIdleSec = (n: number) => Math.min(WATCHDOG_IDLE_MAX_SEC, Math.max(WATCHDOG_IDLE_MIN_SEC, Math.round(n)))
  const currentIdleSec = () => {
    const ms = config.watchdog?.idle_ms
    if (typeof ms !== "number" || !Number.isFinite(ms) || ms <= 0) return WATCHDOG_IDLE_DEFAULT_SEC
    return Math.round(ms / 1000)
  }
  const [watchdogInput, setWatchdogInput] = useState(String(currentIdleSec()))
  const commitWatchdogIdle = () => {
    const parsed = Number(watchdogInput.trim())
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setWatchdogInput(String(currentIdleSec()))
      return
    }
    const sec = clampIdleSec(parsed)
    setWatchdogInput(String(sec))
    // 与输入框展示一致的"有效值"做比较：配置未设置时回落到默认值
    if (sec * 1000 === currentIdleSec() * 1000) return
    setConfig((p) => ({ ...p, watchdog: { ...p.watchdog, idle_ms: sec * 1000 } }))
  }

  // ---- Goal (Quest) mode budgets: round cap + optional token/time hard caps ----
  const GOAL_ROUNDS_DEFAULT = 12
  const GOAL_ROUNDS_MIN = 1
  const GOAL_ROUNDS_MAX = 50
  const GOAL_MINUTES_MAX = 1440 // 24h
  const goalExp = config.experimental ?? {}
  const currentGoalRounds = () => {
    const v = goalExp.goal_max_rounds
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : GOAL_ROUNDS_DEFAULT
  }
  const currentGoalTokens = () => {
    const v = goalExp.goal_max_tokens
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : 0
  }
  const currentGoalMinutes = () => {
    const ms = goalExp.goal_max_duration_ms
    return typeof ms === "number" && Number.isFinite(ms) && ms > 0 ? Math.round(ms / 60000) : 0
  }
  const [goalRoundsInput, setGoalRoundsInput] = useState(String(currentGoalRounds()))
  const [goalTokensInput, setGoalTokensInput] = useState(currentGoalTokens() ? String(currentGoalTokens()) : "")
  const [goalMinutesInput, setGoalMinutesInput] = useState(currentGoalMinutes() ? String(currentGoalMinutes()) : "")

  // Merge a patch into experimental.* — undefined removes the key (falls back to "no cap" / default).
  const commitGoalConfig = (patch: { goal_max_rounds?: number; goal_max_tokens?: number; goal_max_duration_ms?: number }) => {
    setConfig((p) => {
      const exp: Record<string, unknown> = { ...p.experimental }
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined) delete exp[k]
        else exp[k] = v
      }
      return { ...p, experimental: exp as MockExperimental }
    })
  }
  const commitGoalRounds = () => {
    const parsed = Number(goalRoundsInput.trim())
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalRoundsInput(String(currentGoalRounds()))
      return
    }
    const n = Math.min(GOAL_ROUNDS_MAX, Math.max(GOAL_ROUNDS_MIN, Math.round(parsed)))
    setGoalRoundsInput(String(n))
    if (n === currentGoalRounds()) return
    commitGoalConfig({ goal_max_rounds: n })
  }
  const commitGoalTokens = () => {
    const raw = goalTokensInput.trim()
    if (raw === "") {
      if (currentGoalTokens() !== 0) commitGoalConfig({ goal_max_tokens: undefined })
      setGoalTokensInput("")
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalTokensInput(currentGoalTokens() ? String(currentGoalTokens()) : "")
      return
    }
    const n = Math.max(1000, Math.round(parsed))
    setGoalTokensInput(String(n))
    if (n === currentGoalTokens()) return
    commitGoalConfig({ goal_max_tokens: n })
  }
  const commitGoalMinutes = () => {
    const raw = goalMinutesInput.trim()
    if (raw === "") {
      if (currentGoalMinutes() !== 0) commitGoalConfig({ goal_max_duration_ms: undefined })
      setGoalMinutesInput("")
      return
    }
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setGoalMinutesInput(currentGoalMinutes() ? String(currentGoalMinutes()) : "")
      return
    }
    const mins = Math.min(GOAL_MINUTES_MAX, Math.max(1, Math.round(parsed)))
    setGoalMinutesInput(String(mins))
    if (mins === currentGoalMinutes()) return
    commitGoalConfig({ goal_max_duration_ms: mins * 60000 })
  }

  const planModeEnabled = () => config.experimental?.plan_mode !== false
  const commitPlanMode = (enabled: boolean) =>
    setConfig((p) => ({ ...p, experimental: { ...p.experimental, plan_mode: enabled } }))

  // mock：线上走 globalSync.updateConfig 热更新；这里用短延时模拟保存中状态
  const commitMcpApps = (enabled: boolean) => {
    if (savingMcpApps || enabled === (config.experimental?.mcp_apps !== false)) return
    setSavingMcpApps(true)
    setTimeout(() => {
      setConfig((p) => ({ ...p, experimental: { ...p.experimental, mcp_apps: enabled } }))
      setSavingMcpApps(false)
    }, 400)
  }

  // mock：线上 permission 上下文按目录维护白名单
  const toggleAccept = (checked: boolean) => setAccepting(checked)

  // mock：线上 platform.checkUpdate 走宿主；这里延时后提示已是最新版本
  const check = () => {
    if (!PLATFORM.checkUpdate) return
    setChecking(true)
    setTimeout(() => {
      setChecking(false)
      showToast({
        variant: "success",
        title: t("settings.updates.toast.latest.title"),
        description: t("settings.updates.toast.latest.description", { version: PLATFORM.version }),
      })
    }, 900)
  }

  const colorSchemeOptions: { value: "system" | "light" | "dark"; label: string }[] = [
    { value: "system", label: t("theme.scheme.system") },
    { value: "light", label: t("theme.scheme.light") },
    { value: "dark", label: t("theme.scheme.dark") },
  ]

  const languageOptions: SelectOption[] = LOCALES.map((l) => ({ value: l, label: t(`language.${l}`) }))
  const userLocaleOptions: SelectOption[] = [
    { value: "", label: t("settings.general.row.userLocale.auto") },
    ...LOCALES.map((l) => ({ value: LOCALE_TO_ACCEPT_LANGUAGE[l], label: `${t(`language.${l}`)} (${LOCALE_TO_ACCEPT_LANGUAGE[l]})` })),
  ]

  const soundOptions: SelectOption[] = [
    { value: "none", label: t("sound.option.none") },
    ...SOUND_OPTIONS.map((o) => ({ value: o.id, label: t(o.label) })),
  ]

  // 线上 onHighlight 会试播演示音效；原型无音频资源，选择即生效
  const soundSelect = (action: string, enabled: boolean, current: string, setEnabled: (value: boolean) => void, set: (id: string) => void) => (
    <Select
      dataAction={action}
      iconClass="text-[var(--neutral-600)]"
      options={soundOptions}
      current={enabled ? current : "none"}
      onSelect={(option) => {
        if (option.value === "none") {
          setEnabled(false)
          return
        }
        setEnabled(true)
        set(option.value)
      }}
      triggerVariant="boxed"
    />
  )

  const goalNumberField = (
    action: string,
    label: string,
    value: string,
    onInput: (v: string) => void,
    onCommit: () => void,
    placeholder?: string,
  ) => (
    <div
      className="w-full sm:w-[120px]"
      data-action={action}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault()
          ;(document.activeElement as HTMLElement | null)?.blur()
        }
      }}
    >
      <Input
        ariaLabel={label}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(v) => onInput(v.replace(/[^0-9]/g, ""))}
        className="text-12-regular"
        autoComplete="off"
      />
    </div>
  )

  // 以下区块与线上同名内联区块一一对应；按函数调用渲染（而非子组件），避免每次 state 更新整树重挂导致输入框失焦
  const GeneralSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.general.section.basic")}</h3>
      <SettingsList>
        {PLATFORM.platform !== "desktop" && (
          <SettingsRow title={t("settings.general.row.language.title")} description={t("settings.general.row.language.description")}>
            <Select
              iconClass="text-[var(--neutral-600)]"
              dataAction="settings-language"
              options={languageOptions}
              current={locale}
              onSelect={(option) => option && setLocale(option.value as (typeof LOCALES)[number])}
            />
          </SettingsRow>
        )}

        <SettingsRow title={t("settings.general.row.userLocale.title")} description={t("settings.general.row.userLocale.description")}>
          <Select
            iconClass="text-[var(--neutral-600)]"
            dataAction="settings-user-locale"
            options={userLocaleOptions}
            current={userLocalePreference}
            onSelect={(option) => option && setUserLocalePreference(option.value)}
          />
        </SettingsRow>

        <SettingsRow title={t("command.permissions.autoaccept.enable")} description={t("toast.permissions.autoaccept.on.description")}>
          <div data-action="settings-auto-accept-permissions">
            <Switch checked={accepting} disabled={!DIR} onChange={toggleAccept} />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t("settings.general.row.contextOptimization.title")}
          description={t("settings.general.row.contextOptimization.description")}
        >
          <div data-action="settings-context-optimization">
            <Switch checked={contextOptimizationEnabled} onChange={setContextOptimizationEnabled} />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t("settings.general.row.shellToolPartsExpanded.title")}
          description={t("settings.general.row.shellToolPartsExpanded.description")}
        >
          <div data-action="settings-feed-shell-tool-parts-expanded">
            <Switch checked={settings.general.shellToolPartsExpanded} onChange={(checked) => setGeneral({ shellToolPartsExpanded: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t("settings.general.row.editToolPartsExpanded.title")}
          description={t("settings.general.row.editToolPartsExpanded.description")}
        >
          <div data-action="settings-feed-edit-tool-parts-expanded">
            <Switch checked={settings.general.editToolPartsExpanded} onChange={(checked) => setGeneral({ editToolPartsExpanded: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.showSessionDiffs.title")} description={t("settings.general.row.showSessionDiffs.description")}>
          <div data-action="settings-show-session-diffs">
            <Switch checked={settings.general.showSessionDiffs} onChange={(checked) => setGeneral({ showSessionDiffs: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.watchdogIdle.title")} description={t("settings.general.row.watchdogIdle.description")}>
          {/* 线上聚焦态边框样式在 settings-general.css 的 .settings-watchdog-input；
              原型未引入该 CSS，保留类名并用 text-right 保住右对齐排版 */}
          <div
            className="settings-watchdog-input w-full sm:w-[120px]"
            data-action="settings-watchdog-idle"
            onBlur={commitWatchdogIdle}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                ;(document.activeElement as HTMLElement | null)?.blur()
              }
            }}
          >
            <Input
              ariaLabel={t("settings.general.row.watchdogIdle.title")}
              type="text"
              value={watchdogInput}
              onChange={(value) => setWatchdogInput(value.replace(/[^0-9]/g, ""))}
              className="text-12-regular text-right"
              autoComplete="off"
            />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.showTerminal.title")} description={t("settings.general.row.showTerminal.description")}>
          <div data-action="settings-show-terminal-icon">
            <Switch checked={settings.general.showTerminalIcon} onChange={(checked) => setGeneral({ showTerminalIcon: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.showReview.title")} description={t("settings.general.row.showReview.description")}>
          <div data-action="settings-show-review-icon">
            <Switch checked={settings.general.showReviewIcon} onChange={(checked) => setGeneral({ showReviewIcon: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.mcpApps.title")} description={t("settings.general.row.mcpApps.description")} truncate>
          <div data-action="settings-mcp-apps-enabled">
            <Switch
              checked={config.experimental?.mcp_apps !== false}
              disabled={savingMcpApps}
              onChange={(checked) => commitMcpApps(checked)}
              hideLabel
            >
              {t("settings.general.row.mcpApps.title")}
            </Switch>
          </div>
        </SettingsRow>

        {KNOWLEDGE_ENABLED && (
          <SettingsRow title={t("settings.knowledge.title")} description={t("settings.knowledge.enabled.description")}>
            <div data-action="settings-knowledge-enabled">
              <Switch
                checked={config.knowledge?.builtin_enabled ?? config.knowledge?.auto_query_lingee ?? true}
                onChange={(checked) =>
                  setConfig((p) => {
                    const knowledge = { ...p.knowledge }
                    delete knowledge.auto_query_lingee
                    return { ...p, knowledge: { ...knowledge, builtin_enabled: checked } }
                  })
                }
              />
            </div>
          </SettingsRow>
        )}
        <SettingsRow title={t("settings.general.row.auditEnabled.title")} description={t("settings.general.row.auditEnabled.description")}>
          <div data-action="settings-audit-enabled">
            <Switch checked={settings.general.auditEnabled} onChange={(checked) => setGeneral({ auditEnabled: checked })} />
          </div>
        </SettingsRow>
        <SettingsRow title={t("settings.general.row.planMode.title")} description={t("settings.general.row.planMode.description")}>
          <div data-action="settings-plan-mode">
            <Switch checked={planModeEnabled()} onChange={(checked) => commitPlanMode(checked)} />
          </div>
        </SettingsRow>
      </SettingsList>
    </div>
  )

  const GoalModeSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.goal.section.title")}</h3>
      <SettingsList>
        <SettingsRow title={t("settings.goal.row.rounds.title")} description={t("settings.goal.row.rounds.description")}>
          {goalNumberField("settings-goal-rounds", t("settings.goal.row.rounds.title"), goalRoundsInput, setGoalRoundsInput, commitGoalRounds)}
        </SettingsRow>
        <SettingsRow title={t("settings.goal.row.tokens.title")} description={t("settings.goal.row.tokens.description")}>
          {goalNumberField(
            "settings-goal-tokens",
            t("settings.goal.row.tokens.title"),
            goalTokensInput,
            setGoalTokensInput,
            commitGoalTokens,
            t("settings.goal.unlimited"),
          )}
        </SettingsRow>
        <SettingsRow title={t("settings.goal.row.minutes.title")} description={t("settings.goal.row.minutes.description")}>
          {goalNumberField(
            "settings-goal-minutes",
            t("settings.goal.row.minutes.title"),
            goalMinutesInput,
            setGoalMinutesInput,
            commitGoalMinutes,
            t("settings.goal.unlimited"),
          )}
        </SettingsRow>
      </SettingsList>
    </div>
  )

  const AppearanceSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.general.section.appearance")}</h3>

      <SettingsList>
        <SettingsRow title={t("settings.general.row.colorScheme.title")} description={t("settings.general.row.colorScheme.description")}>
          <Select
            iconClass="text-[var(--neutral-600)]"
            dataAction="settings-color-scheme"
            options={colorSchemeOptions}
            current={colorScheme}
            onSelect={(option) => option && setColorScheme(option.value as "system" | "light" | "dark")}
            triggerStyle={{ minWidth: 200 }}
          />
        </SettingsRow>

        {/* Theme switcher temporarily disabled.（线上原样保留的禁用区块） */}
        {false && (
          <SettingsRow
            title={t("settings.general.row.theme.title")}
            description={
              <>
                {t("settings.general.row.theme.description")} <a href="#">{t("common.learnMore")}</a>
              </>
            }
          >
            <Select
              iconClass="text-[var(--neutral-600)]"
              dataAction="settings-theme"
              options={THEME_OPTIONS.map((o) => ({ value: o.id, label: o.name }))}
              current={themeId}
              onSelect={(option) => option && setThemeId(option.value)}
            />
          </SettingsRow>
        )}

        <SettingsRow title={t("settings.general.row.uiFont.title")} description={t("settings.general.row.uiFont.description")}>
          <div className="w-full sm:w-[200px]" data-action="settings-ui-font">
            <Input
              ariaLabel={t("settings.general.row.uiFont.title")}
              type="text"
              value={settings.appearance.uiFont}
              onChange={(value) => setSettings((p) => ({ ...p, appearance: { ...p.appearance, uiFont: value } }))}
              placeholder={sansDefault}
              className="text-12-regular"
              autoComplete="off"
            />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.font.title")} description={t("settings.general.row.font.description")}>
          <div className="w-full sm:w-[200px]" data-action="settings-code-font">
            <Input
              ariaLabel={t("settings.general.row.font.title")}
              type="text"
              value={settings.appearance.font}
              onChange={(value) => setSettings((p) => ({ ...p, appearance: { ...p.appearance, font: value } }))}
              placeholder={monoDefault}
              className="text-12-regular"
              autoComplete="off"
            />
          </div>
        </SettingsRow>
      </SettingsList>
    </div>
  )

  const NotificationsSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.general.section.notifications")}</h3>

      <SettingsList>
        <SettingsRow title={t("settings.general.notifications.agent.title")} description={t("settings.general.notifications.agent.description")}>
          <div data-action="settings-notifications-agent">
            <Switch checked={settings.notifications.agent} onChange={(checked) => setNotifications({ agent: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow
          title={t("settings.general.notifications.permissions.title")}
          description={t("settings.general.notifications.permissions.description")}
        >
          <div data-action="settings-notifications-permissions">
            <Switch checked={settings.notifications.permissions} onChange={(checked) => setNotifications({ permissions: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.notifications.errors.title")} description={t("settings.general.notifications.errors.description")}>
          <div data-action="settings-notifications-errors">
            <Switch checked={settings.notifications.errors} onChange={(checked) => setNotifications({ errors: checked })} />
          </div>
        </SettingsRow>
      </SettingsList>
    </div>
  )

  const SoundsSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.general.section.sounds")}</h3>

      <SettingsList>
        <SettingsRow title={t("settings.general.sounds.agent.title")} description={t("settings.general.sounds.agent.description")}>
          {soundSelect(
            "settings-sounds-agent",
            settings.sounds.agentEnabled,
            settings.sounds.agent,
            (value) => setSounds({ agentEnabled: value }),
            (id) => setSounds({ agent: id }),
          )}
        </SettingsRow>

        <SettingsRow title={t("settings.general.sounds.permissions.title")} description={t("settings.general.sounds.permissions.description")}>
          {soundSelect(
            "settings-sounds-permissions",
            settings.sounds.permissionsEnabled,
            settings.sounds.permissions,
            (value) => setSounds({ permissionsEnabled: value }),
            (id) => setSounds({ permissions: id }),
          )}
        </SettingsRow>

        <SettingsRow title={t("settings.general.sounds.errors.title")} description={t("settings.general.sounds.errors.description")}>
          {soundSelect(
            "settings-sounds-errors",
            settings.sounds.errorsEnabled,
            settings.sounds.errors,
            (value) => setSounds({ errorsEnabled: value }),
            (id) => setSounds({ errors: id }),
          )}
        </SettingsRow>
      </SettingsList>
    </div>
  )

  const UpdatesSection = () => (
    <div className="flex flex-col gap-1">
      <h3 className="pb-2 text-[16px] leading-[24px] text-[var(--neutral-700)] font-[600]">{t("settings.general.section.updates")}</h3>

      <SettingsList>
        <SettingsRow title={t("settings.updates.row.startup.title")} description={t("settings.updates.row.startup.description")}>
          <div data-action="settings-updates-startup">
            <Switch
              checked={settings.updates.startup}
              disabled={!PLATFORM.checkUpdate}
              onChange={(checked) => setSettings((p) => ({ ...p, updates: { ...p.updates, startup: checked } }))}
            />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.general.row.releaseNotes.title")} description={t("settings.general.row.releaseNotes.description")}>
          <div data-action="settings-release-notes">
            <Switch checked={settings.general.releaseNotes} onChange={(checked) => setGeneral({ releaseNotes: checked })} />
          </div>
        </SettingsRow>

        <SettingsRow title={t("settings.updates.row.check.title")} description={t("settings.updates.row.check.description")}>
          <button
            className="flex h-[24px] items-center justify-center gap-[4px] rounded-[8px] bg-[color-mix(in_srgb,var(--neutral-0)_82%,transparent)] px-[12px] text-[12px] font-normal leading-[18px] text-[var(--surface-brand-base)]"
            disabled={checking || !PLATFORM.checkUpdate}
            onClick={check}
          >
            {checking ? t("settings.updates.action.checking") : t("settings.updates.action.checkNow")}
          </button>
        </SettingsRow>
      </SettingsList>
    </div>
  )

  return (
    <div className="relative flex h-full flex-col px-5 py-4 min-h-0 overflow-hidden" style={{ background: "var(--color-background-page)" }}>
      {props.hideHeader ? (
        <div className="pb-5">
          <SettingsList>
            <div className="flex items-center justify-between px-1 py-1">
              <span className="text-[14px] leading-[22px] font-[400] text-[var(--neutral-700)]">{t("settings.general.version")}</span>
              <span className="text-[14px] leading-[22px] font-[400] text-[var(--neutral-500)]" title={BUILD_TIME_ISO}>
                Lingee Build {PLATFORM.version}
                {BUILD_TIME_COMPACT && `(${BUILD_TIME_COMPACT})`}
              </span>
            </div>
          </SettingsList>
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-1 pb-5">
            <h2 className="text-[20px] leading-[36px] h-9 flex items-center font-[600] text-[var(--neutral-700)]">{t("settings.tab.general")}</h2>
          </div>
        </div>
      )}
      <div
        className="no-scrollbar flex-1 min-h-0 overflow-y-auto"
        onScroll={(e) => {
          // mock：线上 useScrollBottom 的底部渐隐控制
          const el = e.currentTarget
          setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8)
        }}
      >
        <div className="flex w-full flex-col gap-5">
          {GeneralSection()}

          {GoalModeSection()}

          {PLATFORM.platform !== "desktop" && AppearanceSection()}

          {NotificationsSection()}

          {SoundsSection()}

          {/* 线上此处注释掉了 WSL 桌面板块与 UpdatesSection，原样保留为不渲染 */}
          {false && UpdatesSection()}
        </div>
      </div>

      {!atBottom && (
        <div
          className="pointer-events-none absolute bottom-4 left-0 right-0 h-8"
          style={{
            background:
              "linear-gradient(0deg, var(--setting-dialog-bottom-bg-start, #FFF) 0%, var(--setting-dialog-bottom-bg-end, rgba(255, 255, 255, 0.00)) 100%)",
          }}
        />
      )}
    </div>
  )
}

interface SettingsRowProps {
  title: string | ReactNode
  description: string | ReactNode
  children: ReactNode
  // 开启后:标题/描述单行超出显示省略号,并在原生 title 上展示完整文案(悬停可见)。
  truncate?: boolean
  // 覆盖标题的排版类(字号/字重/颜色)。不传沿用默认(14px / 400 / neutral-700)。
  titleClass?: string
}

// 线上导出给其他设置页复用(settings-worktree 等)，这里保持导出
export function SettingsRow(props: SettingsRowProps) {
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
