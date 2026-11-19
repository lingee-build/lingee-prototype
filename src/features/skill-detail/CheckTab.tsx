import { useState } from "react"
import { BrandButton, Empty, Icon, Tag, showToast } from "@/ui"
import { cx } from "@/lib/cx"
import { useT } from "@/i18n"
import { sleep } from "@/mock/latency"
import { CheckCategorySection } from "./CheckGroup"
import { summarize, type ValidationGroup, type ValidationRule } from "./validation"

const stamp = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`

/**
 * 详情弹窗里的「检查」页签：工具栏（上次检查时间、结论、通过数、去修复 / 重新检查）+「规范检查」分类下的各组检查项。
 * 没检查过的技能先显示空态，点「重新检查」后才有报告。未通过的规则可以逐条「去修复」；检查不通过时工具栏另有
 * 整单「去修复」（带全部失败明细与提示项，与提交向导确认页的去修复同机制，见 use-fix-sessions）。结构对齐线上 skill-detail。
 */
export function CheckTab(props: {
  /** 这份技能跑出来的校验报告 */
  groups: ValidationGroup[]
  /** 是否已经检查过；没检查过时先不展示报告 */
  checked: boolean
  onChecked: () => void
  onFixPrompt: (ruleId: string, message: string, severity?: ValidationRule["severity"]) => void
  /** 工具栏整单「去修复」：带全部未通过项（含提示项）进修复会话；不传时按钮不显示 */
  onFixAll?: (items: Array<{ checkId: string; reason: string; status: "fail" | "warn" }>) => void
}) {
  const t = useT()
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<string | null>(props.checked ? "2026.10.08" : null)
  const summary = summarize(props.groups)
  const pass = summary.block === 0

  // 整单去修复：带全部未通过项，必检项归必修段、提示项（warn）单列成段，分层口径同 PRD 需求项 5
  const fixAll = () => {
    const items = props.groups
      .flatMap((group) => group.rules)
      .filter((rule) => rule.status !== "ok")
      .map((rule) => ({ checkId: rule.id, reason: rule.msg ?? rule.desc, status: rule.severity === "warn" ? ("warn" as const) : ("fail" as const) }))
    props.onFixAll?.(items)
  }

  const recheck = async () => {
    setChecking(true)
    await sleep(1200)
    props.onChecked()
    setCheckedAt(stamp(new Date()))
    setChecking(false)
    showToast({ variant: pass ? "success" : "warning", title: t(pass ? "kcode.skillPreview.check.recheckPass" : "kcode.skillPreview.check.recheckHasFail") })
  }

  return (
    <div className="px-6 pb-4">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2 min-w-0">
          {checkedAt && (
            <span className="text-[13px] leading-[20px] text-[var(--neutral-500)] truncate">{t("kcode.skillPreview.check.lastCheckedAt", { time: checkedAt })}</span>
          )}
          {props.checked && (
            <Tag type={pass ? "normal" : "error"} className="shrink-0">
              {t(pass ? "kcode.skillPreview.check.statusPass" : "kcode.skillPreview.check.statusFail")}
            </Tag>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {props.checked && (
            <span
              className={cx(
                "text-[13px] leading-[20px] font-medium whitespace-nowrap",
                pass ? "text-[var(--green-600)]" : "text-[var(--danger-600)]",
              )}
            >
              {t(pass ? "kcode.skillPreview.check.passCount" : "kcode.skillPreview.check.failCount", { ok: summary.ok, total: summary.total })}
            </span>
          )}
          {props.checked && !pass && props.onFixAll && (
            <BrandButton variant="auxiliary" size="normal" className="!border-[#fca5a5] !text-[#dc2626]" onClick={fixAll}>
              {t("kcode.skillPreview.check.fixPrompt")}
            </BrandButton>
          )}
          <BrandButton variant="secondary" size="normal" disabled={checking} onClick={() => void recheck()}>
            {checking ? (
              <span className="flex items-center gap-1">
                <Icon name="loading" size="small" className="size-4 animate-spin" />
                {t("kcode.skillPreview.check.rechecking")}
              </span>
            ) : (
              t("kcode.skillPreview.check.recheck")
            )}
          </BrandButton>
        </div>
      </div>

      {!props.checked ? (
        <div className="flex items-center justify-center gap-2 py-10">
          {checking ? (
            <>
              <Icon name="loading" size="small" className="size-4 animate-spin text-[var(--primary-500)]" />
              <span className="text-[13px] text-[var(--neutral-500)]">{t("kcode.skillPreview.check.rechecking")}</span>
            </>
          ) : (
            <Empty description={t("kcode.skillPreview.check.empty")} />
          )}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <CheckCategorySection groups={props.groups} onFixPrompt={props.onFixPrompt} />
          </div>
        </>
      )}
    </div>
  )
}
