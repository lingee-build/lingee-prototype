import { useState } from "react"
import { BrandButton, ConfirmDialog, Icon, Search, showToast, Switch, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { usePersonalSkills } from "@/stores/personal-skills"
import { InstallPersonalSkillDialog } from "@/features/skill-install/InstallPersonalSkillDialog"

const LIST = "rounded-[16px] bg-[color-mix(in_srgb,white_82%,transparent)] px-2 py-1"
const TOOL = "flex size-[28px] cursor-pointer items-center justify-center rounded-[8px] border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--surface-base)] hover:text-text-base"

/**
 * 设置 → 技能：我的技能列表部分（照线上结构，文案取线上键）。
 * 「+ 安装技能」与技能开发页卡片菜单共用同一个「安装个人技能」弹窗，只差来源模式。
 *
 * 两种用法：
 * - 不传 props（keyword === undefined）：独立渲染，自带二级页签 / 搜索 / 刷新 / 安装按钮（原行为不变）；
 * - 传 keyword：嵌入 SettingsSkills 的外层结构，本组件退化为纯列表（过滤用外层搜索词，
 *   页签与安装按钮由 SettingsSkills 提供，避免结构重复）。
 */
export function PersonalSkillsSection(props: { keyword?: string }) {
  const t = useT()
  const dialog = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const setEnabled = usePersonalSkills((s) => s.setEnabled)
  const uninstall = usePersonalSkills((s) => s.uninstall)
  const [tab, setTab] = useState<"mySkills" | "moreSkills">("mySkills")
  const [ownKeyword, setOwnKeyword] = useState("")
  const embedded = props.keyword !== undefined
  const keyword = props.keyword ?? ownKeyword

  const visible = items.filter((x) => {
    const kw = keyword.trim().toLowerCase()
    return !kw || x.displayName.toLowerCase().includes(kw) || x.desc.toLowerCase().includes(kw)
  })

  const askUninstall = (name: string, displayName: string) =>
    dialog.show(() => (
      <ConfirmDialog
        title={t("settings.skills.detail.removeTitle")}
        description={t("settings.skills.detail.removeConfirm", { name: displayName })}
        cancelText={t("kcode.skillDev.action.cancel")}
        confirmText={t("settings.skills.detail.remove")}
        variant="danger"
        onConfirm={() => {
          uninstall(name)
          showToast({ variant: "success", description: t("settings.skills.detail.removeSuccess") })
        }}
      />
    ))

  return (
    <div className="flex flex-col pt-4">
      {/* 工具栏：二级 tab + 搜索 + 刷新 + 安装技能（线上同款布局）；嵌入 SettingsSkills 时由外层提供，整块隐藏 */}
      {!embedded && (
      <div className="mb-3 flex items-center gap-2">
        <div className="flex w-fit gap-1 rounded-full bg-[#F3F4F6] p-1">
          {(["mySkills", "moreSkills"] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={`cursor-pointer rounded-full border-none px-3 py-1 text-[12px] transition-colors ${
                tab === key ? "bg-background-white font-medium text-text-strong shadow-sm" : "bg-transparent text-text-weak"
              }`}
              onClick={() => setTab(key)}
            >
              {t(`settings.skills.tab.${key}`)}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Search value={keyword} onChange={setOwnKeyword} placeholder={t("settings.skills.search.placeholder")} className="w-[200px]" />
          <button type="button" className={TOOL} aria-label="refresh" onClick={() => showToast(t("proto.personalSkills.refreshed"))}>
            <Icon name="refresh" size="small" className="size-4" />
          </button>
          <BrandButton variant="primary" size="small" onClick={() => dialog.show(() => <InstallPersonalSkillDialog source={{ kind: "local" }} />)}>
            <span className="text-[12px]">+ {t("settings.skills.add")}</span>
          </BrandButton>
        </div>
      </div>
      )}

      {tab === "moreSkills" ? (
        <div className={LIST}>
          <div className="flex h-[200px] items-center justify-center text-[13px] text-text-weak">
            {t("settings.skills.build.empty")}
          </div>
        </div>
      ) : visible.length === 0 ? (
        <div className={LIST}>
          <div className="flex h-[200px] flex-col items-center justify-center gap-1 text-center">
            <span className="text-[13px] leading-[20px] text-text-base">
              {keyword ? t("proto.personalSkills.noMatch") : t("settings.skills.empty")}
            </span>
          </div>
        </div>
      ) : (
        <div className={LIST}>
          {visible.map((item, index) => (
            <div
              key={item.name}
              data-slot="personal-skill-row"
              data-skill={item.name}
              className={`flex items-center gap-2.5 px-2 py-2.5 ${index > 0 ? "border-t border-[var(--border-weak-base)]" : ""}`}
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-13-medium text-text-strong">{item.displayName}</span>
                  <span className="shrink-0 rounded-[4px] bg-[rgba(41,112,255,0.1)] px-1.5 py-0.5 text-[10px] font-medium leading-[14px] text-[#2970FF]">
                    {t("settings.skills.label.personal")}
                  </span>
                </div>
                <span className="truncate text-[12px] leading-[18px] text-text-weak">{item.desc}</span>
              </div>
              <span className="shrink-0 text-[11px] leading-[16px] text-text-weak">
                {t("proto.personalSkills.installedAt", { time: item.installedAt })}
              </span>
              <Switch checked={item.enabled} onChange={(enabled) => setEnabled(item.name, enabled)} hideLabel />
              <button
                type="button"
                className={`${TOOL} hover:text-[var(--danger-600)]`}
                aria-label={t("settings.skills.detail.remove")}
                data-skill={item.name}
                onClick={() => askUninstall(item.name, item.displayName)}
              >
                <Icon name="trash-16" size="small" className="size-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 底部说明：线上 SettingsSkills 页签结构无此块，嵌入时随工具栏一起隐藏 */}
      {!embedded && <p className="mt-2 px-1 text-[12px] leading-[18px] text-text-weak">{t("settings.skills.note")}</p>}
    </div>
  )
}
