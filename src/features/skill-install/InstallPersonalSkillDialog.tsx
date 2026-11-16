import { useState } from "react"
import { Dialog as Radix } from "radix-ui"
import { BrandButton, Dialog, Icon, showToast, useDialog } from "@/ui"
import { useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { useSync } from "@/stores/sync"
import { usePersonalSkills, type InstallInput } from "@/stores/personal-skills"

/** 来源已定：技能开发页卡片菜单进入（US-2026-082714） */
export type ProjectSkillSource = { kind: "project"; skill: Skill }
/** 来源待选：设置页「+ 安装技能」进入（现状入口），原型用固定演示目录模拟选择 */
export type LocalDirSource = { kind: "local" }
export type InstallSource = ProjectSkillSource | LocalDirSource

/** local 模式点击来源区后的演示选择（对应线上选文件夹 / 压缩包） */
const DEMO_PICK: InstallInput & { path: string; fileKind: string } = {
  name: "mo-solution-design",
  displayName: "mo-solution-design",
  desc: "生成企业级解决方案 PPT 大纲，适用于产品、客户、行业解决方案与培训演示场景。",
  projectId: "downloads",
  projectName: "本地目录",
  path: "/Users/kingdee/Downloads/mo-solution-design",
  fileKind: "文件夹",
}

const HINT = "flex items-start gap-1.5 text-[12px] leading-[18px] text-text-base"

/**
 * 「安装个人技能」弹窗：与设置 → 技能 →「+ 安装技能」共用同一个弹窗（文案直接取线上键）。
 * 两个入口只差来源区：设置页要用户选文件夹 / 压缩包；卡片菜单进来时来源已定，说明区换成快照提示。
 * 同名判定与覆盖分支共用：主按钮变「覆盖并安装」，覆盖沿用原启用状态。
 */
export function InstallPersonalSkillDialog(props: { source: InstallSource }) {
  const t = useT()
  const { close } = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const install = usePersonalSkills((s) => s.install)
  const [picked, setPicked] = useState<InstallInput & { path: string; fileKind: string } | null>(null)
  const [installing, setInstalling] = useState(false)

  // 先在组件体收窄来源类型，回调里不再访问联合分支
  const skill = props.source.kind === "project" ? props.source.skill : undefined
  const project = useSync((s) => (skill ? s.projects.find((x) => x.id === skill.projectId) : undefined))
  const target: (InstallInput & { path: string; fileKind: string }) | null =
    props.source.kind === "project"
      ? {
          name: props.source.skill.name,
          displayName: props.source.skill.displayName,
          desc: props.source.skill.desc,
          projectId: props.source.skill.projectId,
          projectName: project?.name ?? t("proto.personalInstall.unknownProject"),
          path: project ? `${project.worktree}/skills/${props.source.skill.name}` : "",
          fileKind: t("proto.personalInstall.sourceTag"),
        }
      : picked

  const conflict = target ? items.find((x) => x.name === target.name) : undefined
  const run = async () => {
    if (!target || installing) return
    setInstalling(true)
    // 原型用短延时模拟复制技能目录
    await new Promise((resolve) => setTimeout(resolve, 700))
    install({
      name: target.name,
      displayName: target.displayName,
      desc: target.desc,
      projectId: target.projectId,
      projectName: target.projectName,
    })
    close()
    showToast({ variant: "success", description: t("settings.skills.install.success") })
  }

  return (
    <Dialog
      fit
      customHeader
      className="w-[480px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]"
      // 安装进行中不可用 Esc 关闭
      onEscapeKeyDown={(event) => installing && event.preventDefault()}
    >
      <div className="flex flex-col px-5 pt-5 pb-5">
        <Radix.Title asChild>
          <span className="text-16-medium text-text-strong">{t("settings.skills.install.title")}</span>
        </Radix.Title>

        {/* 来源区：local 待选择 / 已选择可移除；project 已定不可改选 */}
        {target ? (
          <div className="mt-3 flex items-center gap-2.5 rounded-[12px] border border-dashed border-[var(--border-strong-base)] bg-[var(--surface-base)] px-3 py-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(99,102,241,0.12)]">
              <Icon name="folder" size="small" className="size-4.5 text-[var(--primary-600)]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-text-strong">{target.displayName}</span>
                <span className="shrink-0 rounded-[4px] bg-[rgba(41,112,255,0.1)] px-1.5 py-0.5 text-[10px] font-medium leading-[14px] text-[#2970FF]">
                  {target.fileKind}
                </span>
              </div>
              {target.path && <span className="truncate text-[11px] leading-[16px] text-text-weak">{target.path}</span>}
            </div>
            {props.source.kind === "local" && (
              <button
                type="button"
                aria-label="remove"
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-text-weak transition-colors hover:bg-[var(--surface-base)] hover:text-text-strong"
                onClick={() => setPicked(null)}
              >
                <Icon name="close" size="small" className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 flex cursor-pointer items-center gap-2.5 rounded-[12px] border border-dashed border-[var(--border-strong-base)] bg-[var(--surface-base)] px-3 py-2.5 text-left"
            onClick={() => setPicked(DEMO_PICK)}
          >
            <div className="flex size-9 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(99,102,241,0.12)]">
              <Icon name="folder-add-left" size="small" className="size-4.5 text-[var(--primary-600)]" />
            </div>
            <span className="text-[13px] text-text-base">{t("settings.skills.install.selectPlaceholder")}</span>
          </button>
        )}

        {/* 说明区：local 用线上的三条格式要求；project 换成快照说明 */}
        <div className="mt-3 flex flex-col gap-1.5 pl-1">
          {props.source.kind === "local" ? (
            <>
              <span className={HINT}>· {t("settings.skills.install.requirements.item1")}</span>
              <span className={HINT}>· {t("settings.skills.install.requirements.item2")}</span>
              <span className={HINT}>· {t("settings.skills.install.requirements.item3")}</span>
            </>
          ) : (
            <>
              <span className={HINT}>· {t("proto.personalInstall.note1")}</span>
              <span className={HINT}>· {t("proto.personalInstall.note2")}</span>
            </>
          )}
        </div>

        {conflict && target && (
          <div className="mt-2.5 flex gap-2 rounded-[12px] bg-[rgba(239,68,68,0.08)] px-3 py-2.5">
            <Icon name="info-fill" size="small" className="mt-0.5 size-3.5 shrink-0 text-[var(--danger-600)]" />
            <div className="flex flex-col gap-1">
              <span className="text-[12px] leading-[18px] text-[var(--danger-600)]">
                {t("settings.skills.install.conflict", { name: conflict.displayName })}
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
          <BrandButton
            variant="primary"
            disabled={!target || installing}
            onClick={() => void run()}
          >
            {installing
              ? t("proto.personalInstall.installing")
              : t(conflict ? "settings.skills.install.overwriteBtn" : "settings.skills.install.confirm")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}
