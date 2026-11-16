import { evaluationDeletionNotice } from "@/services/evaluation-deletion"
import { useState, type ReactNode } from "react"
import { Icon } from "@/ui"
import type { Skill, SkillScope } from "@/mock/fixtures/dev"
import { CurrentScope, SCOPE_HINT_FIRST, ScopeChecks, isFirstSubmission } from "@/features/skill-publish-scope/SkillPublishScopeDialog"
import { channelStatusOf, submitKindOf, type SubmitKind } from "@/features/skill-publish-scope/channel-status"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { CHECK_CATEGORIES, SUBMIT_CATEGORIES } from "@/mock/fixtures/skill-check"
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

/** 第 1 步：勾选技能。行内只显示所选通道一行状态；提交模式按提交成分分三组（一致 / 覆盖 / 首提），组头可收起且恒显示「勾选数/总数」 */

/** 分组列表（第 1 步与确认页共用词汇）：组头 = 箭头 + 组名 + 勾选数/总数，可点击收起 / 展开 */
function GroupBlock(props: {
  title: string
  tone: "warn" | "neutral" | "fail"
  count: string
  closed: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="border-b border-[var(--border-weak-base)] last:border-b-0">
      <div className="flex items-center gap-2 px-3.5 py-2 cursor-pointer select-none" onClick={props.onToggle}>
        <Icon
          name="chevron-right"
          size="small"
          className="size-3 shrink-0 transition-transform text-text-weak"
          style={{ transform: props.closed ? "rotate(0deg)" : "rotate(90deg)" }}
        />
        <span className={cx("text-[12px] font-semibold truncate flex-1", props.tone === "warn" ? "text-[var(--orange-600)]" : props.tone === "fail" ? "text-[#dc2626]" : "text-text-base")}>
          {props.title}
        </span>
        <span className={cx("text-[11px] shrink-0", props.tone === "warn" ? "text-[var(--orange-600)]" : props.tone === "fail" ? "text-[#dc2626]" : "text-text-weak")}>{props.count}</span>
      </div>
      {!props.closed && props.children}
    </div>
  )
}

/** 提交成分三组（一致 / 覆盖 / 首提）的组头文案；企业与个人对仗 */
const GROUP_TITLES = (route: BatchRoute): Record<SubmitKind, string> =>
  route === "personal"
    ? { same: "内容与已安装版本一致，将重新安装", cover: "内容较已安装版本有变化，将安装最新内容", first: "首次安装" }
    : { same: "内容与已有版本一致，将重新进入审核", cover: "有新内容或驳回重提，将提交最新内容", first: "首次提交" }

/** 组内排序（第 1 步与确认页共用）：企业分发按通道状态紧急度排——审核中 → 已驳回 → 已发布（saved 不会出现在一致 / 覆盖组，兜底排最后）；个人安装组内只有「已安装」一种状态，保持列表原序 */
const STATUS_RANK: Record<Skill["enterpriseStatus"], number> = { submitted: 0, rejected: 1, published: 2, saved: 3 }
const byChannelStatus = (route: BatchRoute) => (a: BatchItem, b: BatchItem) =>
  route === "enterprise" ? STATUS_RANK[a.skill.enterpriseStatus] - STATUS_RANK[b.skill.enterpriseStatus] : 0

/** 批量企业分发时，在选择技能这一步一并确定发布范围：首次发布的技能可勾选，已发布的不显示范围 */
export interface ScopePicker {
  scopeOf: (skill: Skill) => SkillScope
  onChange: (skill: Skill, scope: SkillScope) => void
}

export function SelectStep({ run, mode, route, scopePicker }: StepProps & { scopePicker?: ScopePicker }) {
  const t = useT()
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const groupItems = (kind: SubmitKind) => run.items.filter((x) => submitKindOf(x.skill, route) === kind).sort(byChannelStatus(route))
  const toggleClosed = (key: string) => setClosed((cur) => ({ ...cur, [key]: !cur[key] }))

  /** 单行：勾选框 + 图标 + 名称 + 所选通道的状态行（版本状态 + 比对结论）；首提组不显示状态行——组头「首次提交/安装」已说明 */
  const rowOf = (item: BatchItem) => {
    const status = channelStatusOf(item.skill, route)
    return (
      <label
        className="flex items-center gap-2.5 px-3.5 py-[9px] transition-colors cursor-pointer hover:bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]"
      >
        <input
          type="checkbox"
          className="size-4 accent-[#495DFF] shrink-0"
          checked={item.selected}
          onChange={(e) => run.toggleSelect(item.skill.id, e.currentTarget.checked)}
        />
        <DynamicSkillIcon name={item.skill.displayName} size={30} />
          <div className="flex min-w-0 flex-col gap-px">
            <span className="text-[13px] font-medium text-text-strong truncate" title={item.skill.displayName}>
              {item.skill.displayName}
            </span>
          {mode === "submit" && submitKindOf(item.skill, route) !== "first" && (
            <span className="text-[11px] leading-[16px] truncate text-text-base" title={status.text}>
              {status.text}
            </span>
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
        {scopePicker && (
          <div className="ml-auto shrink-0">
            {isFirstSubmission(item.skill) ? (
              <ScopeChecks compact disabled={!item.selected} value={scopePicker.scopeOf(item.skill)} onChange={(value) => scopePicker.onChange(item.skill, value)} />
            ) : (
              <CurrentScope name={item.skill.name} />
            )}
          </div>
        )}
      </label>
    )
  }

  const hintKey = mode === "check" ? "selectHintCheck" : route === "personal" ? "selectHintInstall" : "selectHintSubmit"

  return (
    <>
      <div className="flex items-center justify-between gap-3 text-[12px] text-text-weak mb-2 shrink-0">
        <span>{t(`kcode.skillDev.batch.dialog.${hintKey}`, { count: run.selectedCount })}</span>
        {scopePicker && <span>发布范围：{SCOPE_HINT_FIRST}</span>}
      </div>
      <div className={cx(LIST_BOX, scopePicker && "max-h-[320px]")}>
        {mode === "submit" ? (
          (["same", "cover", "first"] as const)
            .map((kind) => ({ kind, list: groupItems(kind) }))
            .filter(({ list }) => list.length > 0)
            .map(({ kind, list }) => {
              const selN = list.filter((x) => x.selected).length
              return (
                <GroupBlock
                  key={kind}
                  title={GROUP_TITLES(route)[kind]}
                  tone={kind === "same" ? "warn" : "neutral"}
                  count={`${selN}/${list.length} 个`}
                  closed={!!closed[kind]}
                  onToggle={() => toggleClosed(kind)}
                >
                  {list.map((item) => (
                    <div key={item.skill.id}>{rowOf(item)}</div>
                  ))}
                </GroupBlock>
              )
            })
        ) : (
          // 检模式不分组：按上次检查状态排序（不通过 → 未检查 → 通过），状态由行内副标题着色说明——组头对检查场景没有提交组头那样的去向信息，纯排序更紧凑
          run.items
            .map((item) => ({ item, rank: item.skill.inspect === "fail" ? 0 : item.skill.inspect === "pass" ? 2 : 1 }))
            .sort((a, b) => a.rank - b.rank)
            .map(({ item }) => (
              <div key={item.skill.id} className="border-b border-[var(--border-weak-base)] last:border-b-0">
                {rowOf(item)}
              </div>
            ))
        )}
      </div>
      {run.selectedCount > BATCH_MAX && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-[8px] bg-[color-mix(in_srgb,var(--warning-600)_12%,transparent)] border border-[rgba(255,119,0,0.25)] mt-2 shrink-0">
          <Icon name="warning-circle" size="small" className="size-4 text-[#FF7700] shrink-0" />
          <span className="text-[12px] leading-[1.5] text-[#FF7700]">{t("kcode.skillDev.batch.dialog.limitWarn")}</span>
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
        {run.items.map((item) => {
          return (
            <label
              key={item.skill.id}
              className="flex items-center gap-2 px-3 py-2 rounded-[8px] bg-[var(--neutral-50)] cursor-pointer"
            >
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
          )
        })}
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
                        const soft = result.status === "warn"
                        return (
                          <div className="flex items-start gap-2 pl-3 py-[3px]" key={key}>
                            <span className="size-[18px] flex items-center justify-center shrink-0 mt-[1px]">
                              {result.status === "pending" && <span className="text-[11px] text-text-weak">○</span>}
                              {result.status === "running" && <Icon name="loading" size="small" className="size-3 animate-spin text-[#495DFF]" />}
                              {result.status === "pass" && <span className="text-[11px] text-[#16a34a]">✓</span>}
                              {result.status === "fail" && <span className={cx("text-[11px]", soft ? "text-[#a16207]" : "text-[#dc2626]")}>✕</span>}
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

/** 第 4 步（决策点 / 确认页）：检查模式展示结果；提交模式按提交成分四组分组 + 逐技能勾选，不通过组不可勾 */
export function DecisionStep({ run, mode, route }: StepProps) {
  const t = useT()
  const [closed, setClosed] = useState<Record<string, boolean>>({})
  const toggleClosed = (key: string) => setClosed((cur) => ({ ...cur, [key]: !cur[key] }))

  /** 检查结果页的三态成分：有警告（通过但存在 warn 项）与纯通过（不通过＝run.failItems） */
  const warnItems = () => run.scoped.filter((x) => x.reasons.length === 0 && hasWarn(x))
  const passItems = () => run.scoped.filter((x) => x.reasons.length === 0 && !hasWarn(x))

  /** 不通过行（检查结果页与提交确认页共用）：置灰图标 + 名称，行下失败原因按类别分行 + 修复指引——检查模式只出规范/安全类（N3 恒 pending） */
  const failRow = (item: BatchItem) => {
    const failed = SUBMIT_CATEGORIES.map((category) => ({
      label: t(`kcode.skillDev.batch.dialog.cat.${category.key}`),
      reasons: category.items.filter((key) => item.checkItems[key].status === "fail").map((key) => item.checkItems[key].reason ?? key),
      details: category.items.filter((key) => item.checkItems[key].detail).map((key) => item.checkItems[key].detail ?? ""),
    })).filter((x) => x.reasons.length > 0)
    const guides = failed.flatMap((x) => x.details).filter(Boolean)
    return (
      <div className="px-3.5 pb-2.5">
        <div className="flex items-center gap-2.5">
          <div className="shrink-0" style={{ filter: "grayscale(.6)" }}>
            <DynamicSkillIcon name={item.skill.displayName} size={30} />
          </div>
          <span className="text-[13px] font-medium text-text-strong truncate">{item.skill.displayName}</span>
        </div>
        <div className="pl-[54px] flex flex-col gap-0.5">
          {failed.map((x) => (
            <span key={x.label} className="text-[11px] text-[#dc2626] leading-snug" title={`${x.label}：${x.reasons.join("；")}`}>
              {x.label}：{x.reasons.join("；")}
            </span>
          ))}
          {guides.length > 0 && (
            <span className="text-[11px] text-text-weak leading-snug" title={`修复指引：${guides.join("；")}`}>
              修复指引：{guides.join("；")}
            </span>
          )}
        </div>
      </div>
    )
  }

  if (mode === "check")
    return (
      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <span className="text-[13px] text-text-base">
          {run.failItems.length === 0
            ? t("kcode.skillDev.batch.dialog.checkResultAllPass", { count: run.passItems.length })
            : t("kcode.skillDev.batch.dialog.checkResultSummary", { total: run.scoped.length, pass: run.passItems.length, fail: run.failItems.length })}
        </span>
        <div className={LIST_BOX}>
          {/* 与提交确认页共用分组形态（GroupBlock 折叠 + failRow 类别行/修复指引）；组顺序＝需处理程度降序：不通过 → 有警告 → 通过 */}
          {run.failItems.length > 0 && (
            <GroupBlock
              title={t("kcode.skillDev.batch.dialog.resultGroupFail")}
              tone="fail"
              count={`${run.failItems.length} 个`}
              closed={!!closed.fail}
              onToggle={() => toggleClosed("fail")}
            >
              {run.failItems.map((item) => (
                <div key={item.skill.id}>{failRow(item)}</div>
              ))}
            </GroupBlock>
          )}
          {warnItems().length > 0 && (
            <GroupBlock
              title={t("kcode.skillDev.batch.dialog.resultGroupWarn")}
              tone="warn"
              count={`${warnItems().length} 个`}
              closed={!!closed.warn}
              onToggle={() => toggleClosed("warn")}
            >
              {warnItems().map((item) => (
                <div key={item.skill.id} className="px-3.5 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <DynamicSkillIcon name={item.skill.displayName} size={30} />
                    <span className="text-[13px] font-medium text-text-strong truncate" title={item.skill.displayName}>
                      {item.skill.displayName}
                    </span>
                  </div>
                  <div className="pl-[54px] flex flex-col gap-0.5">
                    {Object.values(item.checkItems)
                      .filter((x) => x.status === "warn" && x.reason)
                      .map((x, i) => (
                        <span key={`${i}-${x.reason}`} className="text-[11px] text-[#a16207] leading-snug">
                          {x.reason}
                        </span>
                      ))}
                  </div>
                </div>
              ))}
            </GroupBlock>
          )}
          {passItems().length > 0 && (
            <GroupBlock
              title={t("kcode.skillDev.batch.dialog.resultGroupPass")}
              tone="neutral"
              count={`${passItems().length} 个`}
              closed={!!closed.pass}
              onToggle={() => toggleClosed("pass")}
            >
              {passItems().map((item) => (
                <div key={item.skill.id} className="flex items-center gap-2.5 px-3.5 py-2.5">
                  <DynamicSkillIcon name={item.skill.displayName} size={30} />
                  <span className="text-[13px] font-medium text-text-strong truncate flex-1" title={item.skill.displayName}>
                    {item.skill.displayName}
                  </span>
                </div>
              ))}
            </GroupBlock>
          )}
        </div>
      </div>
    )

  const isPer = route === "personal"
  const titles = GROUP_TITLES(route)
  /** 通过项：勾选框 + 图标 + 名称（勾选联动底部按钮数量）；不通过项：不可勾 + 失败原因按类别分行 + 修复指引 */
  const passRow = (item: BatchItem) => (
    <label className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none hover:bg-[color-mix(in_srgb,var(--primary-600)_10%,transparent)]">
      <input
        type="checkbox"
        className="size-4 accent-[#495DFF] shrink-0"
        checked={run.confirmSet.has(item.skill.id)}
        onChange={() => run.toggleConfirm(item.skill.id)}
      />
      <DynamicSkillIcon name={item.skill.displayName} size={30} />
      <span className="text-[13px] font-medium text-text-strong truncate flex-1" title={item.skill.displayName}>
        {item.skill.displayName}
      </span>
    </label>
  )

  const groups = (["same", "cover", "first"] as const)
    .map((kind) => ({ kind, list: run.passItems.filter((x) => submitKindOf(x.skill, route) === kind).sort(byChannelStatus(route)) }))
    .filter(({ list }) => list.length > 0)

  return (
    <div className="flex flex-col gap-2 flex-1 min-h-0">
      <span className="text-[13px] text-text-base shrink-0">
        {run.failItems.length === 0
          ? t("kcode.skillDev.batch.dialog.checkResultAllPass", { count: run.passItems.length })
          : t("kcode.skillDev.batch.dialog.checkResultSummary", { total: run.scoped.length, pass: run.passItems.length, fail: run.failItems.length })}
      </span>
      <span className="text-[12px] text-text-weak shrink-0">
        {t(isPer ? "kcode.skillDev.batch.dialog.aboutPersonal" : "kcode.skillDev.batch.dialog.aboutEnterprise", { count: run.passItems.length })}
      </span>
      <div className={LIST_BOX}>
        {groups.map(({ kind, list }) => {
          const selN = list.filter((x) => run.confirmSet.has(x.skill.id)).length
          return (
            <GroupBlock
              key={kind}
              title={titles[kind]}
              tone={kind === "same" ? "warn" : "neutral"}
              count={`${selN}/${list.length} 个`}
              closed={!!closed[kind]}
              onToggle={() => toggleClosed(kind)}
            >
              {list.map((item) => (
                <div key={item.skill.id}>{passRow(item)}</div>
              ))}
            </GroupBlock>
          )
        })}
        {run.failItems.length > 0 && (
          <GroupBlock
            title={t(isPer ? "kcode.skillDev.batch.dialog.confirmFailInstall" : "kcode.skillDev.batch.dialog.confirmFailSubmit")}
            tone="fail"
            count={`${run.failItems.length} 个`}
            closed={!!closed.fail}
            onToggle={() => toggleClosed("fail")}
          >
            {run.failItems.map((item) => (
              <div key={item.skill.id}>{failRow(item)}</div>
            ))}
          </GroupBlock>
        )}
      </div>
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
