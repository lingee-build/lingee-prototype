import { evaluationDeletionNotice } from "@/services/evaluation-deletion"
import { Icon } from "@/ui"
import type { Skill, SkillScope } from "@/mock/fixtures/dev"
import { CurrentScope, SCOPE_HINT_FIRST, ScopeChecks, isFirstSubmission } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { CHECK_CATEGORIES } from "@/mock/fixtures/skill-check"
import { DynamicSkillIcon } from "@/features/dev-page/DynamicSkillIcon"
import { BATCH_MAX, type BatchItem, type BatchMode, type BatchRoute, type BatchRun } from "./use-batch-run"

const LIST_BOX = "max-h-[220px] min-h-0 overflow-y-auto rounded-[10px] border border-[var(--border-weak-base)]"
const hasWarn = (item: BatchItem) => Object.values(item.checkItems).some((x) => x.status === "warn")

interface StepProps {
  run: BatchRun
  mode: BatchMode
  route: BatchRoute
}

/** 进度条头部：左边是当前在做什么，右边是百分比 */
function ProgressHeader(props: { label: string; value: number }) {
  return (
    <div className="mb-3 shrink-0">
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span className="text-text-base">{props.label}</span>
        <span className="text-[var(--neutral-500)]">{props.value}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--neutral-130)] overflow-hidden">
        <div className="h-full bg-[var(--primary-500)] transition-all" style={{ width: `${props.value}%` }} />
      </div>
    </div>
  )
}

/** 第 1 步：勾选技能。没有改动的技能置灰不可选，超过上限给出警告 */
/** 批量企业分发时，在选择技能这一步一并确定发布范围：首次发布的技能可勾选，已发布的不显示范围 */
export interface ScopePicker {
  scopeOf: (skill: Skill) => SkillScope
  onChange: (skill: Skill, scope: SkillScope) => void
}
export function SelectStep({ run, mode, route, scopePicker }: StepProps & { scopePicker?: ScopePicker }) {
  const t = useT()
  // 选择屏的副标题：当前通道状态 · 无变化/有修改 · 另一通道的补充说明
  const subOf = (item: BatchItem) => {
    const { skill } = item
    const enterprise =
      skill.enterpriseStatus === "submitted"
        ? t("kcode.skillDev.batch.dialog.subEntSubmitted")
        : skill.enterpriseStatus === "published"
          ? t("kcode.skillDev.batch.dialog.subEntPublished")
          : skill.enterpriseStatus === "rejected"
            ? t("kcode.skillDev.batch.dialog.subEntRejected")
            : t("kcode.skillDev.batch.dialog.subEntNone")
    const personal = t(skill.personalInstalled ? "kcode.skillDev.batch.dialog.subPerInstalled" : "kcode.skillDev.batch.dialog.subPerNotInstalled")
    return [
      route === "personal" ? personal : enterprise,
      item.skipReason ? t("kcode.skillDev.batch.dialog.subUnchanged") : skill.changed ? t("kcode.skillDev.batch.dialog.subChanged") : "",
      route !== "personal" && skill.personalInstalled ? t("kcode.skillDev.batch.dialog.subPerInstalledNote") : "",
      route === "personal" && skill.enterpriseStatus !== "saved" ? t("kcode.skillDev.batch.dialog.subEntNote", { status: enterprise }) : "",
    ]
      .filter(Boolean)
      .join(" · ")
  }
  const hintKey = mode === "check" ? "selectHintCheck" : route === "personal" ? "selectHintInstall" : "selectHintSubmit"

  return (
    <>
      <div className="flex items-center justify-between gap-3 text-[12px] text-text-weak mb-2 shrink-0">
        <span>{t(`kcode.skillDev.batch.dialog.${hintKey}`, { count: run.selectedCount })}</span>
        {scopePicker && <span>发布范围：{SCOPE_HINT_FIRST}</span>}
      </div>
      <div className={cx(LIST_BOX, scopePicker && "max-h-[320px]")}>
        {run.items.map((item) => (
          <div key={item.skill.id} className="border-b border-[var(--border-weak-base)] last:border-b-0">
          <label
            className={cx(
              "flex items-center gap-2.5 px-3.5 py-[9px] transition-colors",
              item.selected && !item.skipReason && "bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]",
              item.skipReason ? "opacity-45 cursor-default" : "cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]",
            )}
          >
            <input
              type="checkbox"
              className="size-4 accent-[#495DFF] shrink-0"
              checked={item.selected && !item.skipReason}
              disabled={!!item.skipReason}
              onChange={(e) => run.toggleSelect(item.skill.id, e.currentTarget.checked)}
            />
            <DynamicSkillIcon name={item.skill.displayName} size={30} />
            <div className="flex min-w-0 flex-col gap-px">
              <span className="text-[13px] font-medium text-text-strong truncate" title={item.skill.displayName}>
                {item.skill.displayName}
              </span>
              {mode === "submit" && (
                <span className={cx("text-[11px] leading-[16px] truncate", item.skipReason ? "text-text-weak" : "text-text-base")}>{subOf(item)}</span>
              )}
              {mode === "check" && (
                <span
                  className={cx(
                    "text-[11px] leading-[16px] truncate",
                    item.skill.inspect === "pass" ? "text-[#16a34a]" : item.skill.inspect === "fail" ? "text-[#dc2626]" : "text-text-weak",
                  )}
                >
                  {item.skill.inspect ? t(`kcode.skillDev.inspect.${item.skill.inspect}`) : t("kcode.skillDev.batch.dialog.inspectNone")}
                </span>
              )}
            </div>
            {scopePicker && !item.skipReason && (
              <div className="ml-auto shrink-0">
                {isFirstSubmission(item.skill) ? (
                  <ScopeChecks compact disabled={!item.selected} value={scopePicker.scopeOf(item.skill)} onChange={(value) => scopePicker.onChange(item.skill, value)} />
                ) : (
                  <CurrentScope name={item.skill.name} />
                )}
              </div>
            )}
          </label>
          </div>
        ))}
      </div>
      {run.selectedCount > BATCH_MAX && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-[color-mix(in_srgb,var(--warning-600)_12%,transparent)] border border-[rgba(255,119,0,0.25)] mt-2 shrink-0">
          <Icon name="warning-circle" size="small" className="size-4 text-[#FF7700] shrink-0" />
          <span className="text-[12px] leading-[1.5] text-[#FF7700]">{t("kcode.skillDev.batch.dialog.limitWarn")}</span>
        </div>
      )}
      {run.disabledCount > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)] mt-2 shrink-0">
          <Icon name="info-fill" size="small" className="size-4 text-[#2970FF] shrink-0" />
          <span className="text-[12px] leading-[1.5] text-[#2970FF]">{t("kcode.skillDev.batch.dialog.unchangedWarn", { count: run.disabledCount })}</span>
        </div>
      )}
    </>
  )
}

/** 删除确认：弹窗内二次勾选（默认全选）+ 本地删除不可恢复的警告 */
export function DeleteConfirmStep({ run }: StepProps) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <span className="text-[13px] text-text-base">{t("kcode.skillDev.batch.dialog.deleteConfirmBody", { count: run.items.filter((x) => x.selected).length })}</span>
      <div className="flex flex-col gap-1 max-h-[220px] min-h-0 overflow-y-auto">
        {run.items.map((item) => (
          <label key={item.skill.id} className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--neutral-50)] cursor-pointer">
            <input
              type="checkbox"
              className="size-4 accent-[var(--danger-500)]"
              checked={item.selected}
              onChange={(e) => run.toggleSelect(item.skill.id, e.currentTarget.checked)}
            />
            <span className="text-[13px] text-text-strong truncate" title={item.skill.displayName}>
              {item.skill.displayName}
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-start gap-2 px-3 py-2.5 rounded-[8px] bg-[var(--danger-50)] border border-[rgba(241,34,52,0.25)]">
        <Icon name="warning-circle" size="small" className="size-4 text-[var(--danger-500)] shrink-0 mt-0.5" />
        <span className="text-[12px] leading-[1.5] text-[var(--danger-600)]">{t("kcode.skillDev.batch.dialog.deleteLocalWarn")} {evaluationDeletionNotice}</span>
      </div>
    </div>
  )
}

/** 第 2 步：检查中。按技能分组、可折叠，三大类检查项逐条出结果 */
export function CheckingStep({ run }: StepProps) {
  const t = useT()
  const label = run.running ? `${run.running.skill.displayName} · ${t("kcode.skillDev.batch.dialog.checkRunning")}` : t("kcode.skillDev.batch.dialog.checking")
  const summaryOf = (item: BatchItem) => {
    if (item.status === "running") return { text: t("kcode.skillDev.batch.dialog.checkRunning"), color: "text-[#495DFF]" }
    if (item.status === "pass")
      return hasWarn(item)
        ? { text: t("kcode.skillDev.batch.dialog.checkPassedWithWarn"), color: "text-[#a16207]" }
        : { text: t("kcode.skillDev.batch.dialog.checkPassed"), color: "text-[#16a34a]" }
    if (item.status === "fail") return { text: t("kcode.skillDev.batch.dialog.checkFailed"), color: "text-[#dc2626]" }
    return { text: t("kcode.skillDev.batch.dialog.checkWaiting"), color: "text-text-weak" }
  }

  return (
    <>
      <ProgressHeader label={label} value={run.progress} />
      <div className={LIST_BOX}>
        {run.scoped.map((item) => {
          const summary = summaryOf(item)
          return (
            <div key={item.skill.id} className="border-b border-[var(--border-weak-base)] last:border-b-0">
              <div className="flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]" onClick={() => run.toggleExpanded(item.skill.id)}>
                <Icon
                  name="chevron-right"
                  size="small"
                  className="size-3 text-text-weak shrink-0 transition-transform"
                  style={{ transform: item.expanded ? "rotate(90deg)" : "rotate(0deg)" }}
                />
                <DynamicSkillIcon name={item.skill.displayName} size={22} />
                <span className="text-[12px] font-semibold text-text-strong truncate">{item.skill.displayName}</span>
                <span className={`text-[11px] ml-auto shrink-0 ${summary.color}`}>{summary.text}</span>
              </div>
              {item.expanded && (
                <div className="px-3.5 pb-2 pt-1">
                  {CHECK_CATEGORIES.map((category) => (
                    <div className="mb-1.5" key={category.key}>
                      <div className="text-[11px] font-semibold text-[#6366f1] tracking-wide py-0.5">{t(`kcode.skillDev.batch.dialog.cat.${category.key}`)}</div>
                      {category.items.map((key) => {
                        const result = item.checkItems[key]
                        // 资源缺失（N3）可以在下一步自动补齐，所以按警告色而不是错误色显示
                        const soft = key === "N3" || result.status === "warn"
                        return (
                          <div className="flex items-start gap-2 pl-3 py-[3px]" key={key}>
                            <span className="size-[18px] flex items-center justify-center shrink-0 mt-[1px]">
                              {result.status === "pending" && <span className="text-[11px] text-text-weak">○</span>}
                              {result.status === "running" && <Icon name="loading" size="small" className="size-3 animate-spin text-[#495DFF]" />}
                              {result.status === "pass" && <span className="text-[11px] text-[#16a34a]">✓</span>}
                              {result.status === "fail" && <span className={cx("text-[11px]", soft ? "text-[#a16207]" : "text-[#dc2626]")}>{key === "N3" ? "!" : "✕"}</span>}
                              {result.status === "warn" && <span className="text-[11px] text-[#a16207]">!</span>}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="text-[12px] text-[var(--neutral-600)]">{t(`kcode.skillDev.batch.dialog.chk.${key}`)}</div>
                              {(result.status === "fail" || result.status === "warn") && result.reason && (
                                <div className={cx("text-[11px] mt-0.5 leading-snug break-all", result.status === "warn" ? "text-[#a16207]" : "text-[#dc2626]")}>
                                  {result.reason}
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}

/** 第 3 步：资源更新。只有检查出缺少依赖的工具时才会停在这一步 */
export function ResourceStep({ run }: StepProps) {
  const t = useT()
  return (
    <>
      <ProgressHeader label={t("kcode.skillDev.batch.dialog.resourceRunning")} value={run.progress} />
      <div className={LIST_BOX}>
        {run.scoped
          .filter((item) => item.checkItems.N3.status === "fail")
          .map((item) => (
            <div key={item.skill.id} className="flex items-start gap-2.5 px-3.5 py-2.5 border-b border-[var(--border-weak-base)] last:border-b-0">
              <DynamicSkillIcon name={item.skill.displayName} size={30} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-text-strong truncate">{item.skill.displayName}</span>
                  <span className={cx("text-[12px] shrink-0", run.progress < 100 ? "text-[#495DFF]" : "text-[#dc2626]")}>
                    {t(run.progress < 100 ? "kcode.skillDev.batch.dialog.resourceUpdating" : "kcode.skillDev.batch.dialog.resUnresolved")}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-text-base break-all">{item.checkItems.N3.reason}</div>
              </div>
            </div>
          ))}
      </div>
    </>
  )
}

/** 第 4 步（决策点）：检查模式展示结果；提交模式确认要不要继续提交通过的技能 */
export function DecisionStep({ run, mode, route }: StepProps) {
  const t = useT()
  if (mode === "check")
    return (
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <span className="text-[13px] text-text-base">
          {run.failItems.length === 0
            ? t("kcode.skillDev.batch.dialog.checkResultAllPass", { count: run.passItems.length })
            : t("kcode.skillDev.batch.dialog.checkResultSummary", { total: run.scoped.length, pass: run.passItems.length, fail: run.failItems.length })}
        </span>
        <div className={LIST_BOX}>
          {run.scoped.map((item) => {
            const pass = item.reasons.length === 0
            return (
              <div key={item.skill.id} className="border-b border-[var(--border-weak-base)] last:border-b-0">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <div className="shrink-0" style={pass ? undefined : { filter: "grayscale(.6)" }}>
                    <DynamicSkillIcon name={item.skill.displayName} size={30} />
                  </div>
                  <span className="text-[13px] text-text-strong truncate flex-1">{item.skill.displayName}</span>
                  <span className={cx("text-[11px] font-medium shrink-0", pass ? (hasWarn(item) ? "text-[#a16207]" : "text-[#16a34a]") : "text-[#dc2626]")}>
                    {t(
                      pass
                        ? hasWarn(item)
                          ? "kcode.skillDev.batch.dialog.checkPassedWithWarn"
                          : "kcode.skillDev.batch.dialog.checkPassed"
                        : "kcode.skillDev.batch.dialog.checkFailed",
                    )}
                  </span>
                </div>
                {!pass && (
                  <div className="px-3.5 pb-2.5 pl-[52px] flex flex-col gap-0.5">
                    {item.reasons.map((reason) => (
                      <span key={reason} className="text-[11px] text-[#dc2626] leading-snug">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    )

  return (
    <div className="flex flex-col">
      {run.passItems.length > 0 && (
        <span className="text-[13px] text-[#16a34a] mb-1.5">✓ {t("kcode.skillDev.batch.dialog.decisionPass", { count: run.passItems.length })}</span>
      )}
      {run.passItems.filter(hasWarn).map((item) => (
        <span key={item.skill.id} className="text-[12px] text-[#a16207] py-[3px]">
          {item.skill.displayName} — {t("kcode.skillDev.batch.dialog.decisionWarnHint")}
        </span>
      ))}
      {run.failItems.length > 0 && (
        <>
          <span className="text-[13px] text-[#dc2626] my-1.5">✗ {t("kcode.skillDev.batch.dialog.decisionFail", { count: run.failItems.length })}</span>
          {run.failItems.map((item) => (
            <span key={item.skill.id} className="py-[3px] text-[12px] text-[#dc2626]">
              {item.skill.displayName} — {item.reasons.join("；")}
            </span>
          ))}
        </>
      )}
      {run.failItems.length === 0 && (
        <div className="px-3 py-3 rounded-[8px] bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)] text-[13px] text-[#1e40af] leading-[1.6]">
          {t(route === "personal" ? "kcode.skillDev.batch.dialog.aboutPersonal" : "kcode.skillDev.batch.dialog.aboutEnterprise", { count: run.passItems.length })}
        </div>
      )}
    </div>
  )
}

/** 提交 / 删除进行中：逐个技能出结果 */
export function UploadingStep({ run, mode }: StepProps) {
  const t = useT()
  const rows = mode === "delete" ? run.items.filter((x) => x.selected) : run.passItems
  const running = rows.find((x) => x.status === "running")
  const label =
    mode === "delete"
      ? t("kcode.skillDev.batch.dialog.deleting")
      : running
        ? t("kcode.skillDev.batch.dialog.uploadingName", { name: running.skill.displayName })
        : t("kcode.skillDev.batch.dialog.uploading")
  return (
    <>
      <ProgressHeader label={label} value={run.progress} />
      <div className="flex flex-col gap-2">
        {rows.map((item) => (
          <div key={item.skill.id} className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--neutral-50)]">
            {item.status === "running" && <Icon name="loading" size="small" className="size-4 animate-spin text-[var(--primary-500)] shrink-0" />}
            {item.status === "pass" && <Icon name="circle-check" size="small" className="size-4 text-[var(--success-500)] shrink-0" />}
            {item.status === "fail" && <Icon name="circle-x" size="small" className="size-4 text-[var(--danger-500)] shrink-0" />}
            {item.status === "pending" && <span className="size-4 shrink-0" />}
            <span className="text-[13px] text-text-strong truncate">{item.skill.displayName}</span>
          </div>
        ))}
      </div>
    </>
  )
}

/** 汇总：删除 / 提交各有一套结果文案 */
export function SummaryStep({ run, mode, route }: StepProps) {
  const t = useT()
  const done = mode === "delete" ? run.items.filter((x) => x.selected).length : run.passItems.length
  const danger = mode === "delete"
  const title = danger
    ? t("kcode.skillDev.batch.dialog.deleteDoneTitle")
    : t(route === "personal" ? "kcode.skillDev.batch.dialog.installDoneTitle" : "kcode.skillDev.batch.dialog.submitDoneTitle")
  const text = danger
    ? t("kcode.skillDev.batch.dialog.deleteDoneTxt", { count: done })
    : t(route === "personal" ? "kcode.skillDev.batch.dialog.installDoneTxt" : "kcode.skillDev.batch.dialog.submitDoneTxt", { count: done })
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <div className={cx("flex size-12 items-center justify-center rounded-full", danger ? "bg-[var(--danger-50)]" : "bg-[var(--success-50)]")}>
        <Icon name="circle-check" size="medium" className={cx("size-6", danger ? "text-[var(--danger-500)]" : "text-[var(--success-500)]")} />
      </div>
      <span className={cx("text-[16px] font-medium", danger ? "text-[var(--danger-600)]" : "text-text-strong")}>{title}</span>
      <span className="text-[13px] text-[var(--neutral-500)]">{text}</span>
    </div>
  )
}
