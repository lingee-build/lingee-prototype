import { useState } from "react"
import { BrandButton, Empty, Icon, Tag, showToast } from "@/ui"
import { useT } from "@/i18n"
import { sleep } from "@/mock/latency"
import { CheckCategorySection, ValidationSummary } from "./CheckGroup"
import { summarize, type ValidationGroup } from "./validation"

const stamp = (date: Date) =>
  `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`

/**
 * 详情弹窗里的「检查」页签：工具栏（上次检查时间、结论、重新检查）+ 汇总条 +「规范检查」分类下的各组检查项。
 * 没检查过的技能先显示空态，点「重新检查」后才有报告。未通过的规则可以「去修复」。结构对齐线上 skill-detail。
 */
export function CheckTab(props: {
  /** 这份技能跑出来的校验报告 */
  groups: ValidationGroup[]
  /** 是否已经检查过；没检查过时先不展示报告 */
  checked: boolean
  onChecked: () => void
  onFixPrompt: (ruleId: string, message: string) => void
}) {
  const t = useT()
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<string | null>(props.checked ? "2026.10.08 14:20" : null)
  const pass = summarize(props.groups).block === 0

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
        <BrandButton variant="secondary" size="normal" className="shrink-0" disabled={checking} onClick={() => void recheck()}>
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
          <ValidationSummary groups={props.groups} />
          <div className="flex flex-col gap-4">
            <CheckCategorySection groups={props.groups} onFixPrompt={props.onFixPrompt} />
          </div>
        </>
      )}
    </div>
  )
}
