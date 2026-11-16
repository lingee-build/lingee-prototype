import { useMemo, useState } from "react"
import { Button, Search, SegmentedControl, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { cx } from "@/lib/cx"
import { usePersonalSkills } from "@/stores/personal-skills"
import { InstallPersonalSkillDialog } from "@/features/skill-install/InstallPersonalSkillDialog"
import { PersonalSkillsSection } from "./PersonalSkillsSection"

/** 线上 settings-toolbar.tsx 的共享工具栏样式（32px 高主按钮），照抄 */
const SETTINGS_TOOLBAR_PRIMARY_CLASS =
  "h-8 gap-1 rounded-[8px] border-none bg-[var(--button-primary-bg)] px-3 text-[14px] font-[500] leading-[22px] text-[var(--button-primary-text)] [&_[data-slot=icon-svg]]:text-[var(--button-primary-text)] [&_[data-component=icon]]:-ml-1 hover:bg-[var(--button-primary-bg-hover)] hover:text-[var(--button-primary-text)] active:bg-[var(--button-primary-bg-active)] active:text-[var(--button-primary-text)]"

/** 线上 settings-toolbar.tsx 的「刷新」按钮样式（32px 高、蓝色描边），照抄 */
const REFRESH_CLASS =
  "h-8 gap-1 rounded-[8px] border border-[var(--primary-600,#495dff)] bg-transparent px-3 text-[14px] font-[500] leading-[22px] text-[var(--primary-600,#495dff)] [&_[data-slot=icon-svg]]:text-[var(--primary-600,#495dff)]"

/** 列表容器（与 PersonalSkillsSection 的 LIST 一致） */
const LIST = "rounded-[16px] bg-[color-mix(in_srgb,white_82%,transparent)] px-2 py-1"

/** 线上 listBuildSkillsPage 的 BuildSkillItem 字段子集（原型 mock 用） */
interface BuildSkillItem {
  skillName: string
  skillDisplayName: string
  skillDesc: string
  developerType: "KINGDEE_OFFICIAL" | "PUBLIC_SKILL"
  openSourceAuthor: string
  license: string
  sourceUrl: string
  updateTime: number
  currentVersion: string
}

/** mock：技能市场（console）里的社区技能，列名用线上 settings.skills.col.* 键 */
const BUILD_SKILLS: BuildSkillItem[] = [
  {
    skillName: "mo-solution-design",
    skillDisplayName: "解决方案大纲设计",
    skillDesc: "生成企业级解决方案 PPT 大纲，适用于产品、客户、行业解决方案与培训演示场景。",
    developerType: "KINGDEE_OFFICIAL",
    openSourceAuthor: "金蝶云",
    license: "MIT",
    sourceUrl: "https://github.com/lingee-official/mo-solution-design",
    updateTime: new Date("2026-11-06T10:30:00+08:00").getTime(),
    currentVersion: "1.2.0",
  },
  {
    skillName: "supplier-admission-file-parser",
    skillDisplayName: "供应商准入附件解析",
    skillDesc: "解析供应商准入评审附件（PDF / 扫描件 / Word / Excel），提取文本与表格供审查节点使用。",
    developerType: "KINGDEE_OFFICIAL",
    openSourceAuthor: "金蝶云",
    license: "Apache-2.0",
    sourceUrl: "https://github.com/lingee-official/supplier-admission-file-parser",
    updateTime: new Date("2026-10-28T16:00:00+08:00").getTime(),
    currentVersion: "1.0.4",
  },
  {
    skillName: "fin-report-explain",
    skillDisplayName: "财务报表智能解读",
    skillDesc: "读取资产负债表与利润表，输出结构化的经营分析与风险提示。",
    developerType: "PUBLIC_SKILL",
    openSourceAuthor: "陈明远",
    license: "MIT",
    sourceUrl: "https://github.com/chenmy/fin-report-explain",
    updateTime: new Date("2026-11-12T09:10:00+08:00").getTime(),
    currentVersion: "2.1.0",
  },
  {
    skillName: "invoice-ocr-extract",
    skillDisplayName: "增值税发票 OCR 识别",
    skillDesc: "识别增值税发票的关键字段，输出结构化 JSON 便于报销与入账流程。",
    developerType: "PUBLIC_SKILL",
    openSourceAuthor: "openpie",
    license: "MIT",
    sourceUrl: "https://github.com/openpie/invoice-ocr-extract",
    updateTime: new Date("2026-11-02T14:45:00+08:00").getTime(),
    currentVersion: "0.9.3",
  },
]

/** 线上 settings-skills.tsx 的 formatDate，照抄 */
function formatDate(value: number) {
  if (!value) return "-"
  const date = new Date(value)
  if (isNaN(date.getTime())) return "-"
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/**
 * 设置 → 技能：照线上 settings-skills.tsx 的 SettingsSkills 移植整体结构——
 * 「我的技能 / 更多技能」二级页签、搜索、刷新、「+ 个人安装」、个人技能列表、
 * 「更多技能」build 技能列表区块。个人技能列表复用 PersonalSkillsSection（纯列表模式），
 * 「+ 个人安装」打开 InstallPersonalSkillDialog（原型已有的 DialogInstallSkill 等价实现）。
 * 线上的技能详情视图（点击行进入）与远端 fetch 不在本次原型范围。
 */
export function SettingsSkills(props: { hideHeader?: boolean }) {
  const t = useT()
  const dialog = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const [activeTab, setActiveTab] = useState<"my" | "more">("my")
  const [mySearch, setMySearch] = useState("")
  const [moreSearch, setMoreSearch] = useState("")
  const [refreshing, setRefreshing] = useState(false)
  const [installing, setInstalling] = useState<string | null>(null)
  const [installedNames, setInstalledNames] = useState<string[]>([])

  // 线上 searchQuery / setSearchQuery：搜索词跟随当前页签
  const searchQuery = () => (activeTab === "my" ? mySearch : moreSearch)
  const setSearchQuery = (v: string) => (activeTab === "my" ? setMySearch(v) : setMoreSearch(v))

  const isMoreSkillInstalled = (skill: BuildSkillItem) =>
    installedNames.includes(skill.skillName) || items.some((s) => s.name === skill.skillName)

  const sourceLabel = (skill: BuildSkillItem) =>
    skill.developerType === "KINGDEE_OFFICIAL" ? t("settings.skills.col.kingdeeOfficial") : t("settings.skills.col.publicSkill")

  const filteredBuildSkills = useMemo(() => {
    const q = moreSearch.toLowerCase().trim()
    if (!q) return BUILD_SKILLS
    return BUILD_SKILLS.filter(
      (s) =>
        s.skillName.toLowerCase().includes(q) ||
        s.skillDisplayName.toLowerCase().includes(q) ||
        (s.skillDesc || "").toLowerCase().includes(q),
    )
  }, [moreSearch])

  const switchTab = (tab: "my" | "more") => {
    if (activeTab === tab) return
    setActiveTab(tab)
  }

  // 线上 load(refresh)：原型无后端，用短延时 + toast 模拟刷新
  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    window.setTimeout(() => {
      setRefreshing(false)
      showToast({ variant: "success", title: t("proto.personalSkills.refreshed") })
    }, 600)
  }

  // 线上 installBuildSkill：原型用短延时模拟下载安装，完成后切到「已添加」
  const installBuildSkill = (skill: BuildSkillItem) => {
    if (installing || isMoreSkillInstalled(skill)) return
    setInstalling(skill.skillName)
    window.setTimeout(() => {
      setInstalledNames((prev) => (prev.includes(skill.skillName) ? prev : [...prev, skill.skillName]))
      setInstalling(null)
      showToast({ variant: "success", title: t("settings.skills.install.presetSuccess") })
    }, 800)
  }

  return (
    <div className="relative flex h-full flex-col py-4 px-5" style={{ background: "var(--color-background-page)" }}>
      {!props.hideHeader && (
        <div>
          <div className="flex flex-col gap-1 pb-5">
            <h2 className="flex h-9 items-center text-[20px] leading-[36px] font-[600] text-[var(--neutral-700)]">
              {t("settings.skills.title")}
            </h2>
          </div>
        </div>
      )}
      <div className="no-scrollbar flex-1 overflow-y-auto flex w-full flex-col gap-5">
        <div className="flex items-center justify-between pb-2">
          <SegmentedControl
            value={activeTab}
            onChange={(v) => switchTab(v as "my" | "more")}
            items={[
              { value: "my", label: t("settings.skills.tab.mySkills") },
              { value: "more", label: t("settings.skills.tab.moreSkills") },
            ]}
          />
          <div className="flex items-center gap-2">
            <Search
              value={searchQuery()}
              onChange={setSearchQuery}
              placeholder={t("settings.skills.search.placeholder")}
              className="w-[200px]"
            />
            <Button
              size="small"
              variant="secondary"
              icon="refresh"
              disabled={refreshing}
              className={cx(REFRESH_CLASS, refreshing && "[&_svg]:animate-spin")}
              onClick={refresh}
            >
              {t("settings.environments.refresh")}
            </Button>
            <Button
              size="small"
              variant="ghost"
              icon="plus-small"
              className={SETTINGS_TOOLBAR_PRIMARY_CLASS}
              onClick={() => dialog.show(() => <InstallPersonalSkillDialog source={{ kind: "local" }} />)}
            >
              {t("settings.skills.add")}
            </Button>
          </div>
        </div>

        {/* 「我的技能」Tab：外层结构由本组件提供，列表部分复用 PersonalSkillsSection（搜索词从外层传入） */}
        {activeTab === "my" && <PersonalSkillsSection keyword={mySearch} />}

        {/* 「更多技能」Tab：线上 build 技能列表区块（mock 数据），列名用线上 settings.skills.col.* 键 */}
        {activeTab === "more" && (
          <div>
            {/* 列头：名称 / 来源 / 作者 / 许可证 / 最近更新 / 操作 */}
            <div className="flex items-center gap-2 px-2 pb-1 text-[12px] text-text-weak">
              <span className="min-w-0 flex-1">{t("settings.skills.col.skill")}</span>
              <span className="w-[90px] shrink-0">{t("settings.skills.col.source")}</span>
              <span className="w-[110px] shrink-0">{t("settings.skills.col.author")}</span>
              <span className="w-[100px] shrink-0">{t("settings.skills.col.license")}</span>
              <span className="w-[100px] shrink-0">{t("settings.skills.col.updated")}</span>
              <span className="w-[72px] shrink-0 text-right">{t("settings.skills.col.actions")}</span>
            </div>
            {filteredBuildSkills.length === 0 ? (
              <div className={LIST}>
                <div className="px-2 py-3 text-[14px] leading-[22px] text-[var(--neutral-700)]">
                  {t("settings.skills.build.empty")}
                </div>
              </div>
            ) : (
              <div className={LIST}>
                {filteredBuildSkills.map((skill, index) => (
                  <div key={skill.skillName}>
                    {index > 0 && <div className="mx-2 h-px bg-[color-mix(in_srgb,var(--text-strong)_8%,transparent)]" />}
                    <div className="my-1 flex cursor-pointer items-center rounded-[16px] px-2 py-3 transition-colors hover:bg-[var(--surface-base-hover)]">
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="block truncate text-[14px] leading-[22px] text-[var(--text-strong)]" title={skill.skillDisplayName || skill.skillName}>
                            {skill.skillDisplayName || skill.skillName}
                          </span>
                          {isMoreSkillInstalled(skill) && (
                            <span className="shrink-0 whitespace-nowrap rounded-full border border-[var(--border-base)] px-2 py-0.5 text-[12px] leading-[18px] text-[var(--text-secondary)]">
                              {t("settings.skills.label.added")}
                            </span>
                          )}
                        </div>
                        <div className="truncate text-[12px] leading-[18px] text-[var(--text-weak)]" title={skill.skillDesc}>
                          {skill.skillDesc}
                        </div>
                      </div>
                      <span className="w-[90px] shrink-0 text-[13px] leading-[22px] text-text-base">{sourceLabel(skill)}</span>
                      <span className="w-[110px] shrink-0 truncate text-[13px] leading-[22px] text-text-base" title={skill.openSourceAuthor}>
                        {skill.openSourceAuthor || "-"}
                      </span>
                      <span className="w-[100px] shrink-0 text-[13px] leading-[22px] text-text-base">{skill.license || "-"}</span>
                      <span className="w-[100px] shrink-0 text-[13px] leading-[22px] text-text-base">{formatDate(skill.updateTime)}</span>
                      <div className="flex w-[72px] shrink-0 items-center justify-end">
                        <button
                          type="button"
                          onClick={() => installBuildSkill(skill)}
                          disabled={installing === skill.skillName}
                          aria-label={t("settings.skills.install.confirm")}
                          data-skill={skill.skillName}
                          className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg border-none bg-transparent text-[var(--text-secondary)] transition-colors hover:bg-[var(--icon-bg-hover)] disabled:cursor-default disabled:opacity-60"
                        >
                          {installing === skill.skillName ? (
                            <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" />
                            </svg>
                          ) : isMoreSkillInstalled(skill) ? null : (
                            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg">
                              <path
                                d="M6.33333 0C6.70152 0 7 0.298477 7 0.666667V5.66667H12C12.3682 5.66667 12.6667 5.96514 12.6667 6.33333C12.6667 6.70152 12.3682 7 12 7H7V12C7 12.3682 6.70152 12.6667 6.33333 12.6667C5.96514 12.6667 5.66667 12.3682 5.66667 12V7H0.666667C0.298477 7 0 6.70152 0 6.33333C0 5.96514 0.298477 5.66667 0.666667 5.66667H5.66667V0.666667C5.66667 0.298477 5.96514 0 6.33333 0Z"
                                fill="currentColor"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
