import { guardUpgrade } from "@/features/artifact-upgrade/UpgradeGate"
import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, ConfirmDialog, Empty, showToast, useDialog } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { SkillSubmitPathDialog, auditLockTip, isFirstSubmission } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import type { Skill } from "@/mock/fixtures/dev"
import { agentService, consoleScopeService, skillService } from "@/services"
import { DEV_GRID, DevPageLayout } from "@/features/dev-page/DevPageLayout"
import { useDevList } from "@/features/dev-page/use-dev-list"
import { useEditSession } from "@/features/dev-page/use-edit-session"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { BatchActionBar } from "./BatchActionBar"
import { SkillCard } from "./SkillCard"
import { SkillCardActions, type SkillActionHandlers } from "./SkillCardActions"
import { UploadDialog } from "./UploadDialog"
import { BatchDialog, type BatchDialogProps } from "@/features/skill-batch/BatchDialog"
import { SkillDetailDialog } from "@/features/skill-detail/SkillDetailDialog"

// 页签 → 企业通道状态
const TAB_STATUS: Record<string, Skill["enterpriseStatus"]> = {
  unsubmitted: "saved",
  pending: "submitted",
  published: "published",
  rejected: "rejected",
}
const HEADER_ICON = "[&_[data-component=icon]]:!w-[14px] [&_[data-component=icon]]:!h-[14px]"

/** 技能开发页：卡片列表 + 状态页签 + 搜索 + 批量操作 + 卡片菜单 */
export function SkillDevPage() {
  const t = useT()
  const dialog = useDialog()
  const startSession = useStartSession()
  const editSession = useEditSession()
  const [batchMode, setBatchMode] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const data = useDevList<Skill>({
    queryKey: "skills",
    fetch: skillService.list,
    matchTab: (skill, tab) => skill.enterpriseStatus === TAB_STATUS[tab],
    searchText: (skill) => `${skill.displayName} ${skill.name} ${skill.desc}`,
  })

  // 审核锁：随智能体审核中的技能，卡片上显示随哪个智能体，不能单独提交或撤回
  const agents = useQuery({ queryKey: ["agents"], queryFn: agentService.list, staleTime: 0 })
  const auditAgentName = (skill: Skill) => (skill.auditAgentId ? agents.data?.find((x) => x.id === skill.auditAgentId)?.name ?? "智能体" : undefined)
  const patch = (id: string, change: Partial<Skill>) => {
    data.update((items) => items.map((x) => (x.id === id ? { ...x, ...change } : x)))
    void skillService.patch(id, change)
  }
  /** 打开批量向导。检查 / 企业分发 / 个人安装 / 删除、单个或多个，都走同一个弹窗 */
  const showBatch = (config: Pick<BatchDialogProps, "mode" | "route" | "skills" | "skipSelect">) =>
    dialog.show(
      () => (
        <BatchDialog
          {...config}
          onSubmitted={(skills, route, scopes) => {
            skills.forEach((skill) => {
              patch(skill.id, route === "personal" ? { personalInstalled: true, changed: false } : { enterpriseStatus: "submitted", changed: false, reason: undefined })
              // 只有首次发布才把发布范围带给 Console；Build 本地不存
              const scope = scopes?.[skill.name]
              if (route === "enterprise" && scope && isFirstSubmission(skill)) void consoleScopeService.submitFirst(skill.name, scope)
            })
            exitBatch()
          }}
          onDeleted={async (skills) => {
            const ids = skills.map((x) => x.id)
            await skillService.remove(ids)
            data.update((items) => items.filter((x) => !ids.includes(x.id)))
            exitBatch()
          }}
          onGoFix={(skills) =>
            startSession(`/kingdee-skill-creator 修复技能检查未通过的问题：${skills.map((x) => x.displayName).join("、")}`, skills[0]?.projectId)
          }
        />
      ),
      undefined,
      { closeOnOverlayClick: false },
    )
  const openBatch = (config: Pick<BatchDialogProps, "mode" | "route" | "skills" | "skipSelect">) => {
    const run = () => showBatch(config)
    if (!guardUpgrade(config.skills.map((skill) => skill.id), run)) run()
  }
  // 编辑：建一个会话直接进去，输入框带上「编辑【名称】技能：」，右侧打开技能预览
  // extra：「去修复」时附在后面的修复提示词
  const edit = (skill: Skill, extra = "") => {
    const draft = t("kcode.skillDev.edit.draft", { name: skill.displayName })
    return void editSession({ title: draft.replace(/[:：]\s*$/, ""), draft: `/kingdee-skill-creator ${draft}${extra}`, projectId: skill.projectId, target: { kdskill: skill.id } })
  }

  const rawHandlers: SkillActionHandlers = {
    onEdit: (skill) => {
      // 已提交 / 已发布的技能，编辑前需要二次确认
      if (skill.enterpriseStatus === "saved" || skill.enterpriseStatus === "rejected") return edit(skill)
      dialog.show(() => (
        <ConfirmDialog
          title={t("kcode.skillDev.edit.confirmTitle")}
          description={t(skill.enterpriseStatus === "submitted" ? "kcode.skillDev.edit.confirmContent.submitted" : "kcode.skillDev.edit.confirmContent")}
          cancelText={t("kcode.skillDev.action.cancel")}
          confirmText={t("kcode.skillDev.edit.confirmBtn")}
          onConfirm={() => edit(skill)}
        />
      ))
    },
    onLocalTest: (skill) => startSession(`使用技能「${skill.displayName}」做一次本地测试`, skill.projectId),
    onCloudTest: (skill) => showToast({ variant: "success", title: `${skill.displayName}：${t("kcode.skillPreview.action.test")}` }),
    onCheck: (skill) => openBatch({ mode: "check", skills: [skill], skipSelect: true }),
    onSubmit: (skill) => {
      const lockedBy = auditAgentName(skill)
      if (lockedBy) return void showToast({ variant: "warning", description: auditLockTip(lockedBy) })
      dialog.show(() => <SkillSubmitPathDialog onConfirm={(route) => openBatch({ mode: "submit", route, skills: [skill], skipSelect: true })} />)
    },
    onWithdraw: (skill) => {
      const lockedBy = auditAgentName(skill)
      if (lockedBy) return void showToast({ variant: "warning", description: auditLockTip(lockedBy) })
      dialog.show(() => (
        <ConfirmDialog
          title={t("kcode.skillPreview.withdraw.confirmTitle")}
          description={t("kcode.skillPreview.withdraw.confirmContent", { name: skill.displayName })}
          cancelText={t("kcode.skillDev.action.cancel")}
          confirmText={t("kcode.skillPreview.withdraw.confirmBtn")}
          onConfirm={() => {
            // 发布后的修改撤回：线上仍是已发布版本，本地修改保留
            patch(skill.id, skill.everPublished ? { enterpriseStatus: "published", changed: true } : { enterpriseStatus: "saved" })
            showToast({ variant: "success", description: t("kcode.skillDev.withdraw.success") })
          }}
        />
      ))
    },
    onDelete: (skill) => {
      const lockedBy = auditAgentName(skill)
      if (lockedBy) return void showToast({ variant: "warning", description: auditLockTip(lockedBy) })
      openBatch({ mode: "delete", skills: [skill] })
    },
  }

  const handlers = Object.fromEntries(Object.entries(rawHandlers).map(([key, action]) => [key, (skill: Skill) => {
    const run = () => action(skill)
    if (!guardUpgrade([skill.id], run)) run()
  }])) as unknown as SkillActionHandlers

  const exitBatch = () => {
    setBatchMode(false)
    setSelected([])
  }
  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]))
  const selectedSkills = data.list.filter((x) => selected.includes(x.id))
  const openDetail = (skill: Skill) => {
    const open = () => dialog.show(() => <SkillDetailDialog skill={skill} onEdit={() => handlers.onEdit(skill)} onFix={(prompt) => edit(skill, prompt)} />)
    if (!guardUpgrade([skill.id], open)) open()
  }

  return (
    <DevPageLayout
      title={t("kcode.skillDev.pageTitle")}
      searchWrapperStyle={{ background: "color-mix(in srgb, var(--surface-raised-stronger-non-alpha) 64%, transparent)", width: 220 }}
      addLabel={t("kcode.skillDev.action.new")}
      addVariant="secondary"
      onAdd={() => startSession("/kingdee-skill-creator ")}
      addBeforeAction={
        <>
          <BrandButton
            variant="auxiliary"
            size="normal"
            icon={batchMode ? "close" : "grid-16"}
            iconSize="xs"
            className={cx(HEADER_ICON, batchMode && "!bg-[var(--surface-base)] !border-[var(--border-weak-base)]")}
            onClick={() => (batchMode ? exitBatch() : setBatchMode(true))}
          >
            {t(batchMode ? "kcode.skillDev.batch.cancelSelect" : "kcode.skillDev.batch.enter")}
          </BrandButton>
          <BrandButton
            variant="auxiliary"
            size="normal"
            icon="submit-upload"
            iconSize="xs"
            className={HEADER_ICON}
            onClick={() =>
              dialog.show(() => (
                <UploadDialog
                  onUploaded={(file, projectId) => {
                    const name = file.name.replace(/\.(zip|tar\.gz)$/i, "")
                    startSession(t("kcode.skillDev.upload.detect.prompt", { name }), projectId)
                  }}
                />
              ))
            }
          >
            {t("kcode.skillDev.action.upload")}
          </BrandButton>
        </>
      }
      tabs={["all", "unsubmitted", "pending", "published", "rejected"].map((value) => ({ value, label: t(`kcode.skillDev.filter.${value}`) }))}
      tab={data.tab}
      onTabChange={(value) => {
        // 切换页签清空当前勾选
        data.setTab(value)
        setSelected([])
      }}
      searchValue={data.query}
      onSearchChange={data.setQuery}
      onRefresh={data.refresh}
      searchPlaceholder={t("kcode.skillDev.search.placeholder")}
      subToolbar={
        batchMode ? (
          <BatchActionBar
            selectedCount={selectedSkills.length}
            totalCount={data.list.length}
            onToggleAll={() => setSelected(selectedSkills.length === data.list.length ? [] : data.list.map((x) => x.id))}
            onCheck={() => openBatch({ mode: "check", skills: selectedSkills })}
            onSubmitEnterprise={() => openBatch({ mode: "submit", route: "enterprise", skills: selectedSkills })}
            onSubmitPersonal={() => openBatch({ mode: "submit", route: "personal", skills: selectedSkills })}
            onDelete={() => openBatch({ mode: "delete", skills: selectedSkills })}
          />
        ) : undefined
      }
    >
      {data.loading ? (
        <div className="text-14-regular text-text-weak py-8 text-center">{t("kcode.skillDev.loading")}</div>
      ) : data.list.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-2">
          <Empty description={t(data.filtered ? "kcode.skillDev.empty.noMatch" : "ui.empty.description")} />
        </div>
      ) : (
        <div className={DEV_GRID}>
          {data.list.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              auditAgentName={auditAgentName(skill)}
              selected={batchMode && selected.includes(skill.id)}
              // 批量模式下卡片点击是勾选，不打开详情
              onClick={() => (batchMode ? toggle(skill.id) : openDetail(skill))}
              onContinueSubmit={(route) => route === "enterprise" ? rawHandlers.onSubmit(skill) : openBatch({ mode: "submit", route, skills: [skill], skipSelect: true })}
              action={
                batchMode ? (
                  <button
                    type="button"
                    className={cx(
                      "flex size-4 shrink-0 items-center justify-center rounded-[3.5px] border-[1.33px] cursor-pointer transition-colors",
                      selected.includes(skill.id) ? "border-[#495DFF] bg-[#495DFF]" : "border-[var(--border-weak-base)] bg-[var(--surface-raised-stronger-non-alpha)]",
                    )}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggle(skill.id)
                    }}
                    aria-label={selected.includes(skill.id) ? "deselect" : "select"}
                  >
                    {selected.includes(skill.id) && (
                      <span className="block h-[4.5px] w-2 -translate-y-[0.5px] -rotate-45 border-b-[1.8px] border-l-[1.8px] border-[#fff]" />
                    )}
                  </button>
                ) : (
                  <SkillCardActions skill={skill} handlers={handlers} lockTip={auditAgentName(skill) ? auditLockTip(auditAgentName(skill)!) : undefined} />
                )
              }
            />
          ))}
        </div>
      )}
    </DevPageLayout>
  )
}
