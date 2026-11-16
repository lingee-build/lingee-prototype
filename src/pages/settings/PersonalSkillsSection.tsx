import { BrandButton, ConfirmDialog, Icon, showToast, Switch, useDialog } from "@/ui"
import { useT } from "@/i18n"
import { usePersonalSkills } from "@/stores/personal-skills"

const LIST = "rounded-[16px] bg-[color-mix(in_srgb,white_82%,transparent)] px-2 py-1"

/**
 * 设置 → 技能 → 我的技能（US-2026-082714）。
 * 只列个人技能：启用开关、来源工程、安装时间、卸载；项目技能不在这里出现。
 */
export function PersonalSkillsSection() {
  const t = useT()
  const dialog = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const setEnabled = usePersonalSkills((s) => s.setEnabled)
  const uninstall = usePersonalSkills((s) => s.uninstall)

  const askUninstall = (name: string, displayName: string) =>
    dialog.show(() => (
      <ConfirmDialog
        title={t("proto.personalSkills.uninstallTitle")}
        description={t("proto.personalSkills.uninstallDesc", { name: displayName })}
        cancelText={t("kcode.skillDev.action.cancel")}
        confirmText={t("proto.personalSkills.uninstall")}
        variant="danger"
        onConfirm={() => {
          uninstall(name)
          showToast({ variant: "success", description: t("proto.personalSkills.uninstalled") })
        }}
      />
    ))

  return (
    <div className="pt-4">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[13px] font-medium leading-[20px] text-text-strong">{t("proto.personalSkills.title")}</span>
        <span className="text-[12px] leading-[18px] text-text-weak">{t("proto.personalSkills.count", { count: items.length })}</span>
      </div>

      {items.length === 0 ? (
        <div className={LIST}>
          <div className="flex flex-col items-center gap-1 px-3 py-8 text-center">
            <span className="text-[13px] leading-[20px] text-text-base">{t("proto.personalSkills.empty")}</span>
            <span className="text-[12px] leading-[18px] text-text-weak">{t("proto.personalSkills.emptyHint")}</span>
          </div>
        </div>
      ) : (
        <div className={LIST}>
          {items.map((item, index) => (
            <div
              key={item.name}
              data-slot="personal-skill-row"
              data-skill={item.name}
              className={`flex items-center gap-2.5 px-2 py-2.5 ${index > 0 ? "border-t border-[var(--border-weak-base)]" : ""}`}
            >
              <div className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--surface-base)]">
                <Icon name="checklist" size="small" className="size-4 text-text-base" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-13-medium text-text-strong">{item.displayName}</span>
                <span className="truncate text-[11px] leading-[16px] text-text-weak">
                  {t("proto.personalSkills.source", { project: item.projectName, time: item.installedAt })}
                </span>
              </div>
              <Switch checked={item.enabled} onChange={(enabled) => setEnabled(item.name, enabled)} hideLabel />
              <BrandButton
                variant="text"
                size="small"
                className="shrink-0"
                data-skill={item.name}
                onClick={() => askUninstall(item.name, item.displayName)}
              >
                {t("proto.personalSkills.uninstall")}
              </BrandButton>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 px-1 text-[12px] leading-[18px] text-text-weak">{t("proto.personalSkills.tip")}</p>
    </div>
  )
}
