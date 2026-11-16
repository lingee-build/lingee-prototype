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
const DEMO_PICK: InstallInput & { path: string } = {
  name: "mo-solution-design",
  displayName: "mo-solution-design",
  desc: "生成企业级解决方案 PPT 大纲，适用于产品、客户、行业解决方案与培训演示场景。",
  projectId: "downloads",
  projectName: "本地目录",
  path: "/Users/kingdee/Downloads/mo-solution-design",
}

/** 说明行：实心圆点 + 深灰文字（照线上弹窗） */
const HINT_ROW = "flex items-start gap-2 text-[14px] leading-[21px] text-[#666]"
const HINT_DOT = "mt-[8px] size-[5px] shrink-0 rounded-full bg-[#999]"
/** 来源区：虚线描边 + 浅灰底（照线上弹窗） */
const SOURCE_BOX = "flex items-center gap-3 rounded-[16px] border border-dashed border-[#C7C9F2] bg-[#F7F8FA] px-3.5 py-3"
/** 来源区左侧图标容器：浅灰蓝底 + 蓝紫 folder-plus（照线上弹窗） */
const ICON_BOX = "flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E8EAF6]"

/**
 * 「安装个人技能」弹窗：与设置 → 技能 →「+ 安装技能」共用同一个弹窗，布局与文案照线上复刻。
 * 卡片菜单进来时只有来源区不同：已填入该技能（名称 + 工程目录），不可改选、无移除按钮；
 * 同名覆盖分支共用：主按钮变「覆盖并安装」，覆盖沿用原启用状态。
 */
export function InstallPersonalSkillDialog(props: { source: InstallSource }) {
  const t = useT()
  const { close } = useDialog()
  const items = usePersonalSkills((s) => s.items)
  const install = usePersonalSkills((s) => s.install)
  const [picked, setPicked] = useState<InstallInput & { path: string } | null>(null)
  const [installing, setInstalling] = useState(false)

  // 先在组件体收窄来源类型，回调里不再访问联合分支
  const skill = props.source.kind === "project" ? props.source.skill : undefined
  const project = useSync((s) => (skill ? s.projects.find((x) => x.id === skill.projectId) : undefined))
  const target: (InstallInput & { path: string }) | null =
    props.source.kind === "project"
      ? {
          name: props.source.skill.name,
          displayName: props.source.skill.displayName,
          desc: props.source.skill.desc,
          projectId: props.source.skill.projectId,
          projectName: project?.name ?? t("proto.personalInstall.unknownProject"),
          path: project ? `${project.worktree}/skills/${props.source.skill.name}` : "",
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
      className="w-[560px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]"
      // 安装进行中不可用 Esc 关闭
      onEscapeKeyDown={(event) => installing && event.preventDefault()}
    >
      <div className="flex flex-col px-6 pt-6 pb-6">
        <Radix.Title asChild>
          <span className="text-[20px] font-medium text-text-strong">{t("settings.skills.install.title")}</span>
        </Radix.Title>

        {/* 来源区：local 待选择 / 已选择可移除；project 已定不可改选 */}
        {target ? (
          <div className={`mt-4 ${SOURCE_BOX}`}>
            <div className={ICON_BOX}>
              <Icon name="folder-add-left" className="size-5 text-[#4F46E5]" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[16px] font-semibold text-text-strong">{target.displayName}</span>
              {target.path && <span className="truncate text-[12px] leading-[18px] text-text-weak">{target.path}</span>}
            </div>
            {props.source.kind === "local" && (
              <button
                type="button"
                aria-label="remove"
                className="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-none bg-transparent text-text-weak transition-colors hover:bg-[#E8EAF6] hover:text-text-strong"
                onClick={() => setPicked(null)}
              >
                <Icon name="close" size="small" className="size-3.5" />
              </button>
            )}
          </div>
        ) : (
          <button type="button" className={`mt-4 cursor-pointer text-left ${SOURCE_BOX}`} onClick={() => setPicked(DEMO_PICK)}>
            <div className={ICON_BOX}>
              <Icon name="folder-add-left" className="size-5 text-[#4F46E5]" />
            </div>
            <span className="text-[14px] text-[#666]">{t("settings.skills.install.selectPlaceholder")}</span>
          </button>
        )}

        {/* 说明区：与设置页同一套三条格式要求 */}
        <div className="mt-4 flex flex-col gap-1.5">
          <span className={HINT_ROW}>
            <span className={HINT_DOT} />
            {t("settings.skills.install.requirements.item1")}
          </span>
          <span className={HINT_ROW}>
            <span className={HINT_DOT} />
            {t("settings.skills.install.requirements.item2")}
          </span>
          <span className={HINT_ROW}>
            <span className={HINT_DOT} />
            {t("settings.skills.install.requirements.item3")}
          </span>
        </div>

        {/* 同名覆盖：线上 conflict 文案，主按钮改「覆盖并安装」 */}
        {conflict && (
          <div className="mt-3 flex flex-col gap-1">
            <span className="text-[13px] leading-[19px] text-[var(--danger-600)]">
              {t("settings.skills.install.conflict", { name: conflict.displayName })}
            </span>
            {!conflict.enabled && (
              <span className="text-[12px] leading-[18px] text-text-base">
                {t("proto.personalInstall.conflictDisabled")}
              </span>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <BrandButton variant="text" onClick={close} disabled={installing}>
            {t("kcode.skillDev.action.cancel")}
          </BrandButton>
          <BrandButton variant="primary" disabled={!target || installing} onClick={() => void run()}>
            {installing
              ? t("proto.personalInstall.installing")
              : t(conflict ? "settings.skills.install.overwriteBtn" : "settings.skills.install.confirm")}
          </BrandButton>
        </div>
      </div>
    </Dialog>
  )
}
