import { useState } from "react"
import { Icon } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { CHECK_ICONS } from "./check-icons.gen"
import { summarize, type ValidationGroup } from "./validation"

/** 检查页签里的彩色小图标（同步自线上的 SVG） */
export function CheckIcon(props: { name: keyof typeof CHECK_ICONS; className?: string }) {
  const icon = CHECK_ICONS[props.name]
  return <svg className={props.className} viewBox={icon.viewBox} fill="none" xmlns="http://www.w3.org/2000/svg" dangerouslySetInnerHTML={{ __html: icon.html }} />
}

function WarningCircle(props: { className?: string }) {
  return (
    <svg className={props.className} viewBox="0 0 20 20" fill="none">
      <path
        d="M10.0002 0.833008C15.0628 0.833008 19.1668 4.93706 19.1668 9.99967C19.1668 15.0623 15.0628 19.1663 10.0002 19.1663C4.93755 19.1663 0.833496 15.0623 0.833496 9.99967C0.833496 4.93706 4.93755 0.833008 10.0002 0.833008ZM10.0978 12.5827C9.54563 12.5827 9.09778 13.0307 9.09766 13.5828C9.09766 14.1351 9.54555 14.583 10.0978 14.583C10.6501 14.583 11.098 14.1351 11.098 13.5828C11.0979 13.0307 10.65 12.5827 10.0978 12.5827ZM10.0002 5.41634C9.54006 5.41634 9.16705 5.78962 9.16683 6.24967V10.5002C9.16705 10.9602 9.54006 11.3335 10.0002 11.3335C10.4604 11.3335 10.8335 10.9596 10.8335 10.4993V6.24886C10.8331 5.789 10.4601 5.41634 10.0002 5.41634Z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * 一组检查项：标题行（组名 + 通过数 n/m）可折叠，有未通过项时默认展开。
 * 每条规则显示名称、级别（必检项 / 提示项）、说明；未通过的可以「查看原因」，传了 onFixPrompt 时还有「去修复」。结构对齐线上的 CheckGroup。
 */
export function CheckGroup(props: { group: ValidationGroup; onFixPrompt?: (ruleId: string, message: string) => void }) {
  const t = useT()
  const { rules } = props.group
  const failed = rules.filter((x) => x.status !== "ok")
  const hasBlock = failed.some((x) => x.severity === "block")
  const [expanded, setExpanded] = useState(failed.length > 0)
  const [reasons, setReasons] = useState<Record<number, boolean>>({})
  const allOk = failed.length === 0

  return (
    <div className="rounded-[16px] border-none bg-[color-mix(in_srgb,var(--surface-raised-stronger-non-alpha)_82%,transparent)] overflow-hidden" data-check-has-fail={allOk ? undefined : "true"}>
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer border-none bg-transparent hover:bg-surface-base-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-[8px] bg-gradient-to-br from-[var(--purple-gray-100)] to-[var(--blue-100)]">
            <CheckIcon name="CheckItemIcon" className="size-4 text-[#3370FF]" />
          </div>
          <span className="text-14-medium leading-none text-text-strong truncate" title={props.group.label}>
            {props.group.label}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cx(
              "flex items-center justify-center rounded-[12px] px-2 py-px text-[12px] leading-[22px] whitespace-nowrap",
              allOk ? "bg-surface-skill-success text-[var(--green-600)]" : hasBlock ? "bg-surface-skill-fail text-[var(--danger-600)]" : "bg-surface-skill-warn text-[var(--warning-600)]",
            )}
          >
            {rules.length - failed.length}/{rules.length}
          </span>
          <Icon name="chevron-right-16" size="small" className="size-4 shrink-0 text-[var(--neutral-500)] transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
        </div>
      </button>
      {expanded && (
        <>
          <div className="mx-4 border-t border-[var(--border-search-base)]" />
          {rules.map((rule, index) => {
            const ok = rule.status === "ok"
            const block = rule.severity === "block"
            const open = !!reasons[index]
            return (
              <div key={rule.name} className="px-6 py-4 flex flex-col">
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    {ok ? (
                      <CheckIcon name="CheckSuccessIcon" className="size-4 shrink-0" />
                    ) : (
                      <WarningCircle className={cx("size-4 shrink-0", block ? "text-[var(--danger-600)]" : "text-[var(--warning-600)]")} />
                    )}
                    <span className="ms-1 text-[14px] font-medium leading-[20px] truncate" title={rule.name}>
                      {rule.name}
                    </span>
                    <span className="shrink-0 rounded-[21px] border border-[var(--border-skill-severity)] bg-surface-skill-severity px-2 py-px text-[12px] leading-[18px] text-[var(--gray-blue-700)]">
                      {t(block ? "kcode.skillPreview.check.severity.block" : "kcode.skillPreview.check.severity.warn")}
                    </span>
                  </div>
                  {rule.msg && (
                    <button
                      type="button"
                      className={cx(
                        "flex shrink-0 items-center gap-1 rounded-[8px] px-1.5 py-0.5 cursor-pointer border-none hover:opacity-80 transition-opacity",
                        block
                          ? "bg-[linear-gradient(146deg,rgba(255,41,59,0.12)_0%,rgba(255,41,59,0.02)_100%)] text-[var(--danger-600)]"
                          : "bg-[linear-gradient(146deg,rgba(255,109,55,0.12)_0%,rgba(255,109,55,0.02)_100%)] text-[var(--warning-600)]",
                      )}
                      onClick={() => setReasons((prev) => ({ ...prev, [index]: !open }))}
                    >
                      <CheckIcon name={block ? "ErrorIcon" : "CheckWarningIcon"} className="size-4 shrink-0" />
                      <span className="text-[14px] font-medium leading-[20px]">{t("kcode.skillPreview.check.viewReason")}</span>
                      <Icon className="size-3 shrink-0 transition-transform" containerClass="text-[var(--warning-600)]" style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }} name="chevron-right" />
                    </button>
                  )}
                  {!ok && props.onFixPrompt && (
                    <button
                      type="button"
                      className="flex shrink-0 items-center gap-1 rounded-[8px] px-2 py-0.5 cursor-pointer border border-[var(--primary-200)] bg-[var(--primary-50)] text-[var(--primary-600)] hover:bg-[var(--primary-100)] transition-colors"
                      onClick={() => props.onFixPrompt?.(rule.id, rule.msg ?? rule.desc)}
                    >
                      <Icon name="edit" size="small" className="size-3.5 shrink-0" />
                      <span className="text-[13px] font-medium leading-[20px]">{t("kcode.skillPreview.check.fixPrompt")}</span>
                    </button>
                  )}
                </div>
                <div className="pl-7 mt-1">
                  <div className="text-[12px] text-[var(--text-tile-desc)]">{rule.desc}</div>
                </div>
                {rule.msg && open && (
                  <div
                    className={cx(
                      "mt-2 ml-7 rounded-[8px] px-3 py-2 text-[13px] leading-[20px] break-words",
                      block
                        ? "bg-[linear-gradient(146deg,rgba(255,41,59,0.08)_0%,rgba(255,41,59,0.02)_100%)] text-[var(--danger-600)]"
                        : "bg-[linear-gradient(146deg,rgba(255,109,55,0.08)_0%,rgba(255,109,55,0.02)_100%)] text-[var(--warning-600)]",
                    )}
                  >
                    {rule.msg}
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

/** 「规范检查」这一大类的手风琴容器（详情弹窗里用）；线上还有安全、资源两类，只在提交流水线跑过之后才有数据 */
export function CheckCategorySection(props: { groups: ValidationGroup[]; onFixPrompt?: (ruleId: string, message: string) => void }) {
  const t = useT()
  const [expanded, setExpanded] = useState(true)
  const hasFail = props.groups.some((group) => group.rules.some((rule) => rule.status !== "ok"))
  return (
    <div className="rounded-[16px] border border-[var(--neutral-130)] bg-[color-mix(in_srgb,var(--surface-raised-stronger-non-alpha)_60%,transparent)] overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between px-5 py-3 cursor-pointer border-none bg-transparent hover:bg-surface-base-hover transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium leading-none text-text-strong">{t("kcode.skillPreview.check.category.spec")}</span>
          {hasFail && (
            <span className="rounded-[10px] bg-surface-skill-fail px-1.5 py-px text-[11px] leading-[18px] text-[var(--danger-600)]">{t("kcode.skillPreview.check.category.hasFail")}</span>
          )}
        </div>
        <Icon name="chevron-right-16" size="small" className="size-4 shrink-0 text-[var(--neutral-500)] transition-transform" style={{ transform: expanded ? "rotate(90deg)" : "rotate(0deg)" }} />
      </button>
      {expanded && (
        <div className="px-3 pb-3 flex flex-col gap-3">
          {props.groups.map((group) => (
            <CheckGroup key={group.id} group={group} onFixPrompt={props.onFixPrompt} />
          ))}
        </div>
      )}
    </div>
  )
}

/** 汇总条：通过 n/m，全部通过 / 有几项未通过 */
export function ValidationSummary(props: { groups: ValidationGroup[] }) {
  const t = useT()
  const summary = summarize(props.groups)
  const status = summary.allPass
    ? t("kcode.skillPreview.check.allPass")
    : t("kcode.skillPreview.check.hasFail", { fail: summary.fail }) + t("kcode.skillPreview.check.failDetail", { block: summary.block, warn: summary.warn })
  return (
    <div
      className={cx(
        "rounded-[16px] px-[11px] py-[9px] flex items-center gap-2 mb-6 border",
        summary.allPass ? "bg-[var(--green-50)] border-[var(--green-200)]" : "bg-[var(--orange-50)] border-[var(--orange-200)]",
      )}
    >
      <CheckIcon name={summary.allPass ? "PassIcon" : "UnpassIcon"} className="size-5 shrink-0" />
      <span className="text-[16px] leading-[24px] text-[var(--gray-800)]">{t("kcode.skillPreview.check.summary", { ok: summary.ok, total: summary.total, status })}</span>
    </div>
  )
}

/** 完整的校验报告（抽屉里用）：汇总条 + 各组检查项 */
export function ValidationReport(props: { groups: ValidationGroup[] }) {
  return (
    <>
      <ValidationSummary groups={props.groups} />
      <div className="flex flex-col gap-4">
        {props.groups.map((group) => (
          <CheckGroup key={group.id} group={group} />
        ))}
      </div>
    </>
  )
}
