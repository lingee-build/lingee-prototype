import { ObjectEvaluationReport } from "@/features/evaluation/ObjectEvaluationReport"
import { useMemo, useState, type CSSProperties } from "react"
import { useQuery } from "@tanstack/react-query"
import { BrandButton, CapsuleTag, ConfirmDialog, DropdownMenu, Empty, Icon, IconButton, Markdown, SegmentedControl, Tag, Tooltip, showToast, useDialog } from "@/ui"
import { useLocaleStore, useT } from "@/i18n"
import type { Skill } from "@/mock/fixtures/dev"
import { skillDetailOf } from "@/mock/fixtures/skill-detail"
import { sleep } from "@/mock/latency"
import { skillService } from "@/services"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { useStartSession } from "@/features/dev-page/use-start-session"
import { BatchDialog } from "@/features/skill-batch/BatchDialog"
import { ValidationReport } from "@/features/skill-detail/CheckGroup"
import { OverviewTab } from "@/features/skill-detail/OverviewTab"
import { validationOf } from "@/features/skill-detail/validation"

type Tab = "overview" | "preview" | "check" | "evaluation"

const FADE = "linear-gradient(to bottom, transparent 0, black 24px, black 100%)"
const Spinner = () => (
  <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
)

/** 标题旁的状态标签：本地改过但云端有记录时显示「已保存」+ 云朵；已驳回时悬停看原因 */
function StatusTag(props: { skill: Skill }) {
  const t = useT()
  const { skill } = props
  const backend = skill.enterpriseStatus
  const reason = skill.reason ? t("ui.tile.rejectionReason", { reason: skill.reason }) : ""
  if (skill.changed && backend !== "saved")
    return (
      <Tooltip value={`${t(`kcode.skillDev.changedTip.${backend}`)}${backend === "rejected" && reason ? `\n${reason}` : ""}`} placement="top" gutter={4}>
        <Tag type="normal" className="whitespace-nowrap shrink-0 cursor-pointer" style={{ background: "transparent" }}>
          <Icon name="cloud" className="size-4 mr-1 inline-block" />
          {t("kcode.agentDev.status.saved")}
        </Tag>
      </Tooltip>
    )
  if (backend === "rejected" && reason)
    return (
      <Tooltip value={reason} placement="top" gutter={4}>
        <Tag type="error" className="whitespace-nowrap shrink-0 cursor-pointer">
          <Icon name="info" className="size-4 text-[var(--danger-600)] mr-1 inline-block" />
          {t("kcode.agentDev.status.rejected")}
        </Tag>
      </Tooltip>
    )
  return (
    <Tag type={backend === "rejected" ? "error" : "normal"} className="whitespace-nowrap shrink-0" style={backend === "rejected" ? undefined : { background: "transparent" }}>
      {t(`kcode.agentDev.status.${backend}`)}
    </Tag>
  )
}

/**
 * 技能产物抽屉：点会话里的技能卡片、或从技能开发页点「编辑」时打开。结构对齐线上的 kdskill-preview：
 * - 头部：标题 + 状态标签；右侧「撤回」（审核中才有）/「测试 ▾」（本地测试、云端测试）/「提交」
 * - 页签：概述 / 预览（SKILL.md）/ 检查（校验报告，6 组检查项）
 * working：会话里模型还在输出时按钮不可用。
 */
export function SkillDrawer(props: { id: string; working: boolean }) {
  const t = useT()
  const dialog = useDialog()
  const locale = useLocaleStore((s) => s.locale)
  const startSession = useStartSession()
  const [tab, setTab] = useState<Tab>("overview")
  const [busy, setBusy] = useState<"test" | "withdraw">()
  const query = useQuery({ queryKey: ["skill", props.id, props.working], queryFn: () => skillService.get(props.id), staleTime: 0, placeholderData: (prev) => prev })
  const skill = query.data
  const detail = useMemo(() => (skill ? skillDetailOf(skill) : undefined), [skill])
  const report = useMemo(() => (skill ? validationOf(skill, locale) : []), [skill, locale])
  if (!skill || !detail) return null
  const locked = props.working || !!busy

  const patch = (change: Partial<Skill>) => skillService.patch(skill.id, change).then(() => query.refetch())

  /** 云端测试：先切到检查页签（线上测试前会重跑一遍校验），再推到沙箱 */
  const cloudTest = async () => {
    setTab("check")
    setBusy("test")
    await sleep(1500)
    setBusy(undefined)
    showToast({ variant: "success", title: `${skill.displayName}：${t("kcode.skillPreview.action.test")}` })
  }
  /** 提交：走和技能开发页同一个向导（检查 → 资源更新 → 提交），跳过选择技能那一步 */
  const submit = () => {
    setTab("check")
    dialog.show(
      () => (
        <BatchDialog
          mode="submit"
          route="enterprise"
          skills={[skill]}
          skipSelect
          onSubmitted={() => void patch({ enterpriseStatus: "submitted", changed: false })}
          onGoFix={() => setTab("check")}
        />
      ),
      undefined,
      { closeOnOverlayClick: false },
    )
  }
  const withdraw = () =>
    dialog.show(() => (
      <ConfirmDialog
        title={t("kcode.skillPreview.withdraw.confirmTitle")}
        description={t("kcode.skillPreview.withdraw.confirmContent", { name: skill.displayName })}
        cancelText={t("kcode.skillDev.action.cancel")}
        confirmText={t("kcode.skillPreview.withdraw.confirmBtn")}
        onConfirm={async () => {
          setBusy("withdraw")
          await sleep(700)
          await patch({ enterpriseStatus: "saved", changed: false })
          setBusy(undefined)
        }}
      />
    ))

  return (
    <div className="flex h-full flex-col">
      <div className="pt-3 pb-6 text-[16px] font-[600] leading-[24px] text-text-strong flex items-center justify-between px-6 shrink-0 gap-3">
        <div className="flex-1 flex items-center gap-3 min-w-0">
          <span className="text-[20px] min-w-0 truncate" title={t("kcode.skillPreview.title")}>
            {t("kcode.skillPreview.title")}
          </span>
          <StatusTag skill={skill} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {skill.enterpriseStatus === "submitted" && (
            <BrandButton variant="secondary" size="normal" icon={busy === "withdraw" ? undefined : "undo"} disabled={locked} onClick={withdraw}>
              {busy === "withdraw" && <Spinner />}
              {t("kcode.skillPreview.action.withdraw")}
            </BrandButton>
          )}
          <DropdownMenu gutter={4} placement="bottom-end">
            <DropdownMenu.Trigger disabled={locked} data-component="brand-button" data-variant="secondary" data-size="normal">
              {busy === "test" ? <Spinner /> : <Icon name="test-flask" size="small" />}
              {t("kcode.skillPreview.action.testDropdown")}
              <Icon name="chevron-down-16" size="small" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="test-dropdown-menu">
                <DropdownMenu.Item className="flex items-center gap-2 cursor-pointer" onSelect={() => startSession(`/${skill.name} `, skill.projectId)}>
                  <Icon name="monitor" size="small" />
                  <DropdownMenu.ItemLabel>{t("kcode.skillPreview.action.localTest")}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex items-center gap-2 cursor-pointer" onSelect={() => void cloudTest()}>
                  <Icon name="cloud-test" size="small" />
                  <DropdownMenu.ItemLabel>{t("kcode.skillPreview.action.test")}</DropdownMenu.ItemLabel>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu>
          <BrandButton variant="primary" size="normal" icon="submit-upload" disabled={locked} onClick={submit}>
            {t("kcode.skillPreview.action.submit")}
          </BrandButton>
        </div>
      </div>

      <div
        className="light-segmented flex items-center px-6 h-10 shrink-0"
      >
        <SegmentedControl
          value={tab}
          onChange={(value) => setTab(value as Tab)}
          items={[...(["overview", "preview", "check"] as const).map((value) => ({ value, label: t(`kcode.skillPreview.tab.${value}`) })), { value: "evaluation", label: "评测报告" }]}
        />
        <IconButton icon="refresh" variant="ghost" iconSize="small" className="ml-auto h-7 w-7" title={t("session.files.refresh")} onClick={() => void query.refetch()} />
      </div>

      <div className={`flex-1 min-h-0 overflow-y-auto no-scrollbar ${tab === "evaluation" ? "" : "py-6"}`} style={tab === "evaluation" ? undefined : { maskImage: FADE, WebkitMaskImage: FADE }}>
        {tab === "evaluation" && <ObjectEvaluationReport objectId={`skill:${skill.id}`} />}
        {tab === "overview" && (
          <>
            <div className="flex gap-3 items-start px-6 pb-5">
              <DynamicSkillIcon name={skill.displayName} size={60} />
              <div className="flex flex-col min-w-0">
                <div className="mt-1 flex gap-2 items-center min-w-0">
                  <div className="truncate select-text text-[16px] font-[600] leading-[24px] text-text-strong" title={skill.displayName}>
                    {skill.displayName}
                  </div>
                  <CapsuleTag className="shrink-0">{skill.category}</CapsuleTag>
                </div>
                <div className="mt-1">
                  <span className="select-text text-[14px] text-[var(--text-tile-desc)] font-medium leading-[22px]">{skill.name}</span>
                </div>
              </div>
            </div>
            <OverviewTab skill={skill} detail={detail} />
          </>
        )}
        {tab === "preview" && (
          <div className="px-6 select-text">
            <Markdown text={detail.content.replace(/^---\n[\s\S]*?\n---\n/, "")} className="skill-detail-markdown leading-relaxed" />
          </div>
        )}
        {tab === "check" &&
          (report.length === 0 ? (
            <Empty description={t("kcode.skillPreview.check.empty")} />
          ) : (
            <div className="px-6">
              <ValidationReport groups={report} />
            </div>
          ))}
      </div>
    </div>
  )
}
