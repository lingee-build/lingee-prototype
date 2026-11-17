import { useState } from "react"
import { BrandButton, Dialog, Icon, useDialog } from "@/ui"
import { defaultScopeOf, isFirstSubmission } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import type { Skill, SkillScope } from "@/mock/fixtures/dev"
import { SUBMIT_ORDER } from "@/mock/fixtures/skill-check"
import { type SkillFixEntry } from "./fix-prompt"
import { CheckingStep, DecisionStep, DeleteConfirmStep, SelectStep, SummaryStep, UploadingStep } from "./steps"
import { BATCH_MAX, useBatchRun, type BatchMode, type BatchRoute, type Phase } from "./use-batch-run"

export interface BatchDialogProps {
  mode: BatchMode
  /** 提交通道：企业分发 / 个人提交（仅 submit 模式用到） */
  route?: BatchRoute
  skills: Skill[]
  /** 单个技能从卡片菜单进来时跳过「选择技能」这一步 */
  skipSelect?: boolean
  /** 提交成功的技能；scopes 为首次发布技能的发布范围（按技能 name），只有企业分发才有 */
  onSubmitted?: (skills: Skill[], route: BatchRoute, scopes?: Record<string, SkillScope>) => void
  onDeleted?: (skills: Skill[]) => void | Promise<void>
  /** 检查不通过时点「去修复」：带上每个技能的失败明细（checkId / 原因 / 修复指引），供分项目建修复会话拼分层指令 */
  onGoFix?: (entries: SkillFixEntry[]) => void
}

const PHASE_STEP: Record<Phase, number> = { select: 1, deleteConfirm: 1, checking: 2, decision: 3, uploading: 3, summary: 3 }

/**
 * 技能批量操作向导：检查 / 企业分发 / 个人提交 / 删除共用一个弹窗。
 * 这里只负责外壳（标题、步骤条、底部按钮），各步内容在 steps.tsx，流程推进在 use-batch-run.ts。
 */
export function BatchDialog(props: BatchDialogProps) {
  const t = useT()
  const dialog = useDialog()
  const route = props.route ?? "enterprise"
  const single = !!props.skipSelect
  const run = useBatchRun({ mode: props.mode, route, skills: props.skills, skipSelect: single })
  const stepProps = { run, mode: props.mode, route }
  // 首次发布的发布范围：默认上架商城、不下发 Build；Build 不存范围，首次发布被驳回后再提交也回到默认值。开发者改过的值记在 overrides 里
  const enterprise = props.mode === "submit" && route === "enterprise"
  const [overrides, setOverrides] = useState<Record<string, SkillScope>>({})
  const scopeOf = (skill: Skill) => overrides[skill.name] ?? defaultScopeOf()
  const setScopeOf = (skill: Skill, value: SkillScope) => setOverrides((cur) => ({ ...cur, [skill.name]: value }))
  const firstScopes = () => Object.fromEntries(props.skills.filter(isFirstSubmission).map((skill) => [skill.name, scopeOf(skill)]))
  // 范围选择并入第 1 步列表行内：单技能与批量同一形态（需求项 3；首提技能显示范围，已发布的只读展示 Console 当前值）
  const scopePicker = enterprise ? { scopeOf, onChange: setScopeOf } : undefined
  const busy = run.phase === "checking" || run.phase === "uploading"

  const title =
    props.mode === "submit"
      ? t(`kcode.skillDev.batch.dialog.${route === "personal" ? "install" : "submit"}${single ? "Single" : ""}Title`)
      : props.mode === "check"
        ? t(single ? "kcode.skillDev.batch.dialog.checkSingleTitle" : "kcode.skillDev.batch.dialog.checkTitle")
        : t(props.skills.length > 1 ? "kcode.skillDev.batch.dialog.deleteTitle" : "kcode.skillDev.batch.dialog.deleteSingleTitle")

  const allSteps = [
    t("kcode.skillDev.batch.step.select"),
    t("kcode.skillDev.batch.step.check"),
    t(props.mode === "submit" ? "kcode.skillDev.batch.step.submit" : "kcode.skillDev.batch.step.result"),
  ]
  const steps = props.mode === "delete" ? [] : single ? allSteps.slice(1) : allSteps
  // 单技能入口没有「选择技能」这一步：第 1 屏不高亮任何步骤，其余步骤前移一位
  const current = single ? (run.phase === "select" ? 0 : PHASE_STEP[run.phase] - 1) : PHASE_STEP[run.phase]

  const upload = () => void run.runUpload((skills) => props.onSubmitted?.(skills, route, enterprise ? firstScopes() : undefined))
  const cancelButton = (
    <BrandButton variant="auxiliary" size="normal" onClick={dialog.close}>
      {t("kcode.skillDev.action.cancel")}
    </BrandButton>
  )
  const goFix = () => {
    // 带上失败明细与提示项（warn 不阻断提交但一并带给修复会话，指令里单独标注）供拼分层指令；资源缺失（N3）由会话里的澄清卡处理
    const entries: SkillFixEntry[] = run.failItems.map((item) => ({
      skill: item.skill,
      items: SUBMIT_ORDER.filter((key) => item.checkItems[key].status === "fail" || item.checkItems[key].status === "warn").map((key) => ({
        checkId: key,
        ...item.checkItems[key],
        status: item.checkItems[key].status === "warn" ? ("warn" as const) : ("fail" as const),
      })),
    }))
    props.onGoFix?.(entries)
    dialog.close()
  }

  return (
    <Dialog fit className="w-[560px] !self-center !rounded-[24px] overflow-hidden shadow-[0px_6px_16px_0px_rgba(0,0,0,0.12)]">
      <div className="relative flex flex-col w-full px-5 pt-5 pb-5">
        <button
          type="button"
          className="absolute top-4 right-4 z-[2] size-8 flex items-center justify-center rounded-[8px] cursor-pointer border-none bg-transparent hover:bg-[var(--surface-base)]"
          onClick={dialog.close}
          disabled={busy}
        >
          <Icon name="close" size="small" className="size-4 text-text-base" />
        </button>

        <div className="pr-8 mb-4 text-[18px] font-medium leading-[28px] text-text-strong shrink-0">{title}</div>

        {steps.length > 0 && (
          <div className="flex items-center mb-5 shrink-0">
            {steps.map((label, i) => (
              <div className="contents" key={label}>
                {i > 0 && <div className={cx("flex-1 h-0.5 mx-1.5 mb-[18px] rounded-full", current > i + 1 ? "bg-[#B7C1FF]" : "bg-[rgba(0,0,0,0.08)]")} />}
                <div className="flex flex-col items-center gap-1.5 shrink-0">
                  <div
                    className={cx(
                      "size-8 rounded-full flex items-center justify-center text-[14px]",
                      current === i + 1 && "bg-[#495DFF] text-[#fff]",
                      current > i + 1 && "bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)] text-[#495DFF]",
                      current < i + 1 && "bg-[var(--surface-base)] text-text-weak",
                    )}
                  >
                    {current > i + 1 ? "✓" : i + 1}
                  </div>
                  <span className={cx("text-[12px] whitespace-nowrap", current === i + 1 ? "text-[#495DFF] font-medium" : "text-text-weak")}>{label}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
          {run.phase === "select" && <SelectStep {...stepProps} scopePicker={scopePicker} />}
          {run.phase === "deleteConfirm" && <DeleteConfirmStep {...stepProps} />}
          {run.phase === "checking" && <CheckingStep {...stepProps} />}
          {run.phase === "decision" && <DecisionStep {...stepProps} />}
          {run.phase === "uploading" && <UploadingStep {...stepProps} />}
          {run.phase === "summary" && <SummaryStep {...stepProps} />}
        </div>

        <div className="flex items-center justify-end gap-3 mt-auto pt-5 shrink-0">
          {run.phase === "select" && (
            <>
              {cancelButton}
              <BrandButton variant="primary" size="normal" onClick={() => void run.runCheck()} disabled={run.selectedCount === 0 || run.selectedCount > BATCH_MAX}>
                {t(props.mode === "check" ? "kcode.skillDev.batch.dialog.startCheck" : "kcode.skillDev.batch.dialog.next")}
              </BrandButton>
            </>
          )}
          {run.phase === "deleteConfirm" && (
            <>
              {cancelButton}
              <BrandButton
                variant="primary"
                size="normal"
                className="!bg-[var(--danger-500)] hover:!bg-[var(--danger-600)] !border-[var(--danger-500)] hover:!border-[var(--danger-600)]"
                onClick={() => void run.runDelete((skills) => props.onDeleted?.(skills))}
                disabled={!run.items.some((x) => x.selected)}
              >
                {t("kcode.skillDev.batch.dialog.confirmDelete")}
              </BrandButton>
            </>
          )}
          {busy && (
            <>
              <BrandButton variant="auxiliary" size="normal" onClick={run.cancel} disabled={props.mode === "delete"}>
                {t("kcode.skillDev.action.cancel")}
              </BrandButton>
              {props.mode !== "delete" && (
                <BrandButton variant="primary" size="normal" disabled>
                  {t(run.phase === "uploading" ? "kcode.skillDev.batch.dialog.uploading" : "kcode.skillDev.batch.dialog.checking")}
                </BrandButton>
              )}
            </>
          )}
          {run.phase === "decision" && props.mode === "check" && (
            <>
              {run.failItems.length > 0 ? (
                <>
                  {cancelButton}
                  <BrandButton variant="auxiliary" size="normal" onClick={goFix} className="!border-[#fca5a5] !text-[#dc2626]">
                    {t("kcode.skillDev.batch.dialog.goFix")}
                  </BrandButton>
                </>
              ) : (
                <BrandButton variant="primary" size="normal" onClick={dialog.close}>
                  {t("kcode.skillDev.batch.dialog.close")}
                </BrandButton>
              )}
            </>
          )}
          {run.phase === "decision" && props.mode === "submit" && (
            <>
              {cancelButton}
              {run.failItems.length > 0 && (
                <BrandButton variant="auxiliary" size="normal" onClick={goFix} className="!border-[#fca5a5] !text-[#dc2626]">
                  {t("kcode.skillDev.batch.dialog.goFix")}
                </BrandButton>
              )}
              <BrandButton variant="primary" size="normal" onClick={upload} disabled={run.confirmCount === 0}>
                {t(route === "personal" ? "kcode.skillDev.batch.dialog.confirmInstallCount" : "kcode.skillDev.batch.dialog.confirmSubmitCount", { count: run.confirmCount })}
              </BrandButton>
            </>
          )}
          {run.phase === "summary" && (
            <BrandButton variant="primary" size="normal" onClick={dialog.close}>
              {t(props.mode === "submit" && route !== "personal" ? "kcode.skillDev.batch.dialog.gotIt" : "kcode.skillDev.batch.dialog.done")}
            </BrandButton>
          )}
        </div>
      </div>
    </Dialog>
  )
}
