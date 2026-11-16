import { useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { BrandButton, Dialog, Icon, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { useSync } from "@/stores/sync"
import { usePersonalSkills } from "@/stores/personal-skills"

const ROW = "flex items-start gap-2 text-[12px] leading-[20px]"
const LABEL = "w-[52px] shrink-0 text-text-weak"

/**
 * 安装为个人技能确认弹窗（US-2026-082714 功能点 1）。
 * 名字取自技能名；个人技能库里已有同名时改走覆盖分支，主按钮变「覆盖并安装」。
 */
export function InstallPersonalSkillDialog(props: { skill: Skill }) {
  const t = useT()
  const { close } = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const install = usePersonalSkills((s) => s.install)
  const projectName = useSync((s) => s.projects.find((x) => x.id === props.skill.projectId)?.name)
  const [installing, setInstalling] = useState(false)

  const conflict = items.find((x) => x.name === props.skill.name)
  const run = async () => {
    if (installing) return
    setInstalling(true)
    // 原型用短延时模拟复制技能目录
    await new Promise((resolve) => setTimeout(resolve, 700))
    install({
      name: props.skill.name,
      displayName: props.skill.displayName,
      desc: props.skill.desc,
      projectId: props.skill.projectId,
      projectName: projectName || t("proto.personalSkills.unknownProject"),
    })
    close()
    showToast({ variant: "success", description: t("proto.personalInstall.success") })
  }

  return (
    <Dialog
      fit
      customHeader
      className="w-[440px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]"
      // 安装进行中不可用 Esc 关闭
      onEscapeKeyDown={(event) => installing && event.preventDefault()}
    >
      <div className="flex flex-col px-5 pt-5 pb-5">
        <div className="flex items-center gap-2">
          <Icon name="download" size="small" className="size-4 text-[var(--primary-600)]" />
          <Radix.Title asChild>
            <span className="text-16-medium text-text-strong">{t("proto.personalInstall.title")}</span>
          </Radix.Title>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-13-medium text-text-strong">{props.skill.displayName}</span>
          <span className="font-mono text-[10px] text-text-weak">{props.skill.name}</span>
        </div>

        <div className="mt-3 flex flex-col gap-1.5 rounded-[12px] bg-[var(--surface-base)] px-3 py-2.5">
          <div className={ROW}>
            <span className={LABEL}>{t("proto.personalInstall.locationLabel")}</span>
            <span className="text-text-base">{t("proto.personalInstall.location")}</span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>{t("proto.personalInstall.contentLabel")}</span>
            <span className="text-text-base">{t("proto.personalInstall.content")}</span>
          </div>
          <div className={ROW}>
            <span className={LABEL}>{t("proto.personalInstall.noteLabel")}</span>
            <span className="text-text-base">{t("proto.personalInstall.note")}</span>
          </div>
        </div>

        {conflict && (
          <div className="mt-2.5 flex gap-2 rounded-[12px] bg-[rgba(239,68,68,0.08)] px-3 py-2.5">
            <Icon name="info-fill" size="small" className="mt-0.5 size-3.5 shrink-0 text-[var(--danger-600)]" />
            <div className="flex flex-col gap-1">
              <span className="text-[12px] leading-[18px] text-[var(--danger-600)]">
                {t("proto.personalInstall.conflict", { name: conflict.displayName })}
              </span>
              {!conflict.enabled && (
                <span className="text-[12px] leading-[18px] text-text-base">{t("proto.personalInstall.conflictDisabled")}</span>
              )}
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <BrandButton variant="secondary" onClick={close} disabled={installing}>
            {t("kcode.skillDev.action.cancel")}
          </BrandButton>
          <BrandButton variant="primary" onClick={() => void run()} disabled={installing}>
            {installing ? t("proto.personalInstall.installing") : t(conflict ? "proto.personalInstall.overwrite" : "proto.personalInstall.confirm")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}